package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"strings"

	"pdf-manager/api-go/internal/repository"

	"github.com/gofiber/fiber/v2"
)

type SettingHandler struct {
	settingRepo repository.SettingRepository
}

func NewSettingHandler(repo repository.SettingRepository) *SettingHandler {
	return &SettingHandler{settingRepo: repo}
}

// GetOCRSettings returns the current Alibaba OCR settings (hiding the secret).
func (h *SettingHandler) GetOCRSettings(c *fiber.Ctx) error {
	settings, err := h.settingRepo.GetAll()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "无法获取设置"})
	}

	appKey := settings["alibaba_access_key_id"]
	appSecret := settings["alibaba_access_key_secret"]

	// Mask secret for frontend viewing
	if len(appSecret) > 4 {
		appSecret = appSecret[0:2] + "******" + appSecret[len(appSecret)-2:]
	} else if len(appSecret) > 0 {
		appSecret = "******"
	}

	return c.JSON(fiber.Map{
		"alibaba_access_key_id":     appKey,
		"alibaba_access_key_secret": appSecret,
	})
}

// UpdateOCRSettings saves the new Alibaba OCR settings.
func (h *SettingHandler) UpdateOCRSettings(c *fiber.Ctx) error {
	var body struct {
		AccessKeyID     string `json:"alibaba_access_key_id"`
		AccessKeySecret string `json:"alibaba_access_key_secret"`
	}

	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "无效的请求格式"})
	}

	if body.AccessKeyID != "" {
		h.settingRepo.SetSetting("alibaba_access_key_id", strings.TrimSpace(body.AccessKeyID))
	}

	// Only update secret if it's not the masked version and not empty
	if body.AccessKeySecret != "" && body.AccessKeySecret != "******" && len(body.AccessKeySecret) > 0 {
		// Only save unmasked secrets
		if !strings.Contains(body.AccessKeySecret, "******") {
			h.settingRepo.SetSetting("alibaba_access_key_secret", strings.TrimSpace(body.AccessKeySecret))
		}
	}

	return c.JSON(fiber.Map{"message": "设置已保存"})
}

// GetLogs proxies the log request to the Python OCR service.
func (h *SettingHandler) GetLogs(c *fiber.Ctx) error {
	ocrURL := os.Getenv("OCR_SERVICE_URL")
	if ocrURL == "" {
		ocrURL = "http://ocr-python:8001"
	}

	resp, err := http.Get(ocrURL + "/api/logs")
	if err != nil {
		log.Printf("[Logs] 获取日志失败: %v", err)
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": "无法连接 OCR 服务获取日志"})
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	c.Set("Content-Type", "application/json")
	return c.Send(body)
}

// TestOCRAPI proxies the test request to the Python OCR service using real credentials.
func (h *SettingHandler) TestOCRAPI(c *fiber.Ctx) error {
	ocrURL := os.Getenv("OCR_SERVICE_URL")
	if ocrURL == "" {
		ocrURL = "http://ocr-python:8001"
	}

	// Read real (unmasked) credentials from DB
	akID, _ := h.settingRepo.GetSetting("alibaba_access_key_id")
	akSecret, _ := h.settingRepo.GetSetting("alibaba_access_key_secret")

	if akID == "" || akSecret == "" {
		return c.JSON(fiber.Map{"success": false, "message": "未配置阿里云 OCR 凭证，请先保存 Access Key"})
	}

	// Build multipart form
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	writer.WriteField("alibaba_access_key_id", akID)
	writer.WriteField("alibaba_access_key_secret", akSecret)
	writer.WriteField("alibaba_endpoint", "ocr-api.cn-hangzhou.aliyuncs.com")
	writer.Close()

	req, err := http.NewRequest("POST", ocrURL+"/api/ocr/test", &buf)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "message": "请求构建失败"})
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[TestAPI] 连接 OCR 服务失败: %v", err)
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"success": false, "message": "无法连接 OCR 服务"})
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return c.JSON(result)
}
