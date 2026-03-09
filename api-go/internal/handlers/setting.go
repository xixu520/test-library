package handlers

import (
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
		h.settingRepo.SetSetting("alibaba_access_key_id", body.AccessKeyID)
	}

	// Only update secret if it's not the masked version and not empty
	if body.AccessKeySecret != "" && body.AccessKeySecret != "******" && len(body.AccessKeySecret) > 0 {
		h.settingRepo.SetSetting("alibaba_access_key_secret", body.AccessKeySecret)
	}

	return c.JSON(fiber.Map{"message": "设置已保存"})
}
