package handlers

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"pdf-manager/api-go/internal/models"
	"pdf-manager/api-go/internal/repository"
	"pdf-manager/api-go/internal/services"
)

// DocumentHandler handles document CRUD operations.
type DocumentHandler struct {
	docRepo     *repository.DocumentRepository
	settingRepo repository.SettingRepository
	ocrService  *services.OCRService // Keep this for now, as triggerOCR still uses it.
	storePath   string               // Keep this for now, as Upload still uses it.
}

// NewDocumentHandler creates a new document handler.
func NewDocumentHandler(
	docRepo *repository.DocumentRepository,
	settingRepo repository.SettingRepository,
	ocrService *services.OCRService,
	storePath string,
) *DocumentHandler {
	return &DocumentHandler{
		docRepo:     docRepo,
		settingRepo: settingRepo,
		ocrService:  ocrService,
		storePath:   storePath,
	}
}

// Upload handles PDF file uploads with classification metadata.
func (h *DocumentHandler) Upload(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "请上传PDF文件"})
	}

	// Validate file type (magic bytes check)
	f, err := file.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "文件读取失败"})
	}
	defer f.Close()

	header := make([]byte, 5)
	if _, err := f.Read(header); err != nil || string(header) != "%PDF-" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "文件类型无效，仅支持PDF格式"})
	}
	// Reset reader position
	if seeker, ok := f.(io.Seeker); ok {
		seeker.Seek(0, io.SeekStart)
	}

	standardType := c.FormValue("standard_type")
	engineeringType := c.FormValue("engineering_type")
	if standardType == "" || engineeringType == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "请指定标准类型和工程类型"})
	}

	// Get user ID from JWT context
	userIDFloat, ok := c.Locals("user_id").(float64)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "用户身份异常"})
	}
	userID := uint(userIDFloat)

	// Save file to storage directory
	saveDir := filepath.Join(h.storePath, standardType, engineeringType)
	if err := os.MkdirAll(saveDir, 0755); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "存储目录创建失败"})
	}

	saveName := fmt.Sprintf("%d_%s", time.Now().UnixNano(), file.Filename)
	savePath := filepath.Join(saveDir, saveName)
	if err := c.SaveFile(file, savePath); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "文件保存失败"})
	}
	log.Printf("[Upload] 文件保存成功: %s", savePath)

	// Create database record
	doc := &models.Document{
		UserID:          userID,
		FileName:        file.Filename,
		FilePath:        savePath,
		FileSize:        file.Size,
		StandardType:    standardType,
		EngineeringType: engineeringType,
		OCRStatus:       "processing",
	}
	if err := h.docRepo.Create(doc); err != nil {
		os.Remove(savePath) // cleanup on failure
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "数据库写入失败"})
	}
	log.Printf("[Upload] 数据库记录创建成功 (ID=%d)", doc.ID)

	// Trigger async OCR in background
	go h.triggerOCR(doc, false)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":  "文件上传成功，OCR处理中...",
		"document": doc,
	})
}

// triggerOCR calls the Python OCR service asynchronously.
func (h *DocumentHandler) triggerOCR(doc *models.Document, useRemote bool) {
	log.Printf("[OCR] 触发识别机制 (ID=%d, filePath=%s, remote=%v)", doc.ID, doc.FilePath, useRemote)

	payload := map[string]interface{}{
		"document_id":    doc.ID,
		"file_path":      doc.FilePath,
		"use_remote_api": useRemote,
	}

	if useRemote && h.settingRepo != nil {
		appKey, _ := h.settingRepo.GetSetting("alibaba_access_key_id")
		appSecret, _ := h.settingRepo.GetSetting("alibaba_access_key_secret")
		if appKey != "" && appSecret != "" {
			payload["alibaba_access_key_id"] = appKey
			payload["alibaba_access_key_secret"] = appSecret
			payload["alibaba_endpoint"] = "ocr-api.cn-hangzhou.aliyuncs.com"
		}
	}
	f, err := os.Open(doc.FilePath)
	if err != nil {
		log.Printf("[OCR] 文件打开失败 (ID=%d): %v", doc.ID, err)
		doc.OCRStatus = "failed"
		h.docRepo.Update(doc)
		return
	}
	defer f.Close()

	result, err := h.ocrService.ExtractText(doc.FilePath, f, payload)
	if err != nil {
		log.Printf("[OCR] 提取失败 (ID=%d): %v", doc.ID, err)
		doc.OCRStatus = "failed"
		h.docRepo.Update(doc)
		return
	}

	if result.DocumentNumber != "" {
		doc.DocumentNumber = result.DocumentNumber
	}
	if result.StandardName != "" {
		doc.StandardName = result.StandardName
	}
	doc.ExtractedText = result.ExtractedText
	doc.OCRStatus = "completed"

	// 自动推断标准类型 (只要 OCR 成功找到了有效的标准号就进行判断)
	if doc.DocumentNumber != "" {
		docNum := strings.ToUpper(doc.DocumentNumber)
		switch {
		case strings.HasPrefix(docNum, "GB/T") || strings.HasPrefix(docNum, "GB "):
			doc.StandardType = "国家标准"
		case strings.HasPrefix(docNum, "JC/T") || strings.HasPrefix(docNum, "JC ") ||
			strings.HasPrefix(docNum, "JG/T") || strings.HasPrefix(docNum, "JG ") ||
			strings.HasPrefix(docNum, "JGJ") || strings.HasPrefix(docNum, "CJJ"):
			doc.StandardType = "行业标准"
		case strings.HasPrefix(docNum, "DB"):
			doc.StandardType = "地方标准"
		case strings.HasPrefix(docNum, "T/"):
			doc.StandardType = "团体标准"
		}
	}

	// Parse dates
	if doc.PublishDate == nil && result.PublishDate != "" {
		if t, err := time.Parse("2006-01-02", result.PublishDate); err == nil {
			doc.PublishDate = &t
		}
	}
	if doc.EffectiveDate == nil && result.EffectiveDate != "" {
		if t, err := time.Parse("2006-01-02", result.EffectiveDate); err == nil {
			doc.EffectiveDate = &t
		}
	}
	if doc.AbolishDate == nil && result.AbolishDate != "" {
		if t, err := time.Parse("2006-01-02", result.AbolishDate); err == nil {
			doc.AbolishDate = &t
		}
	}

	h.docRepo.Update(doc)

	// Trigger verification
	go h.triggerVerification(doc)
}

// triggerVerification calls the Python verification service asynchronously.
func (h *DocumentHandler) triggerVerification(doc *models.Document) {
	if doc.DocumentNumber == "" {
		doc.VerificationStatus = "skipped"
		doc.VerificationLog = "标准号为空，跳过核验"
		h.docRepo.Update(doc)
		return
	}

	req := &services.VerifyRequest{
		DocumentID:     doc.ID,
		DocumentNumber: doc.DocumentNumber,
	}
	if doc.PublishDate != nil {
		req.PublishDate = doc.PublishDate.Format("2006-01-02")
	}
	if doc.EffectiveDate != nil {
		req.EffectiveDate = doc.EffectiveDate.Format("2006-01-02")
	}
	if doc.AbolishDate != nil {
		req.AbolishDate = doc.AbolishDate.Format("2006-01-02")
	}

	result, err := h.ocrService.Verify(req)
	if err != nil {
		log.Printf("[Verify] 核验失败 (ID=%d): %v", doc.ID, err)
		doc.VerificationStatus = "failed"
		doc.VerificationLog = fmt.Sprintf("核验请求失败: %v", err)
		h.docRepo.Update(doc)
		return
	}

	doc.VerificationStatus = result.Status
	doc.VerificationLog = result.Message

	if result.Status == "updated" {
		if result.PublishDate != "" {
			if t, err := time.Parse("2006-01-02", result.PublishDate); err == nil {
				doc.PublishDate = &t
			}
		}
		if result.EffectiveDate != "" {
			if t, err := time.Parse("2006-01-02", result.EffectiveDate); err == nil {
				doc.EffectiveDate = &t
			}
		}
		if result.AbolishDate != "" {
			if t, err := time.Parse("2006-01-02", result.AbolishDate); err == nil {
				doc.AbolishDate = &t
			}
		}
	}

	h.docRepo.Update(doc)
	log.Printf("[Verify] 核验完成 (ID=%d) 状态=%s", doc.ID, result.Status)
}

// List returns documents matching filter criteria.
func (h *DocumentHandler) List(c *fiber.Ctx) error {
	standardType := c.Query("standard_type")
	engineeringType := c.Query("engineering_type")
	page, _ := strconv.Atoi(c.Query("page", "1"))
	pageSize, _ := strconv.Atoi(c.Query("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	docs, total, err := h.docRepo.List(standardType, engineeringType, page, pageSize)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "查询失败"})
	}

	return c.JSON(fiber.Map{
		"total":     total,
		"page":      page,
		"page_size": pageSize,
		"documents": docs,
	})
}

// GetByID returns a single document.
func (h *DocumentHandler) GetByID(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "无效的文档ID"})
	}

	doc, err := h.docRepo.FindByID(uint(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "文档未找到"})
	}

	return c.JSON(doc)
}

// UpdateMetadata allows admin to manually edit document properties.
type UpdateMetadataRequest struct {
	DocumentNumber  string `json:"document_number"`
	StandardName    string `json:"standard_name"`
	PublishDate     string `json:"publish_date"`
	EffectiveDate   string `json:"effective_date"`
	AbolishDate     string `json:"abolish_date"`
	StandardType    string `json:"standard_type"`
	EngineeringType string `json:"engineering_type"`
}

// UpdateMetadata updates a document's editable fields.
func (h *DocumentHandler) UpdateMetadata(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "无效的文档ID"})
	}

	doc, err := h.docRepo.FindByID(uint(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "文档未找到"})
	}

	var req UpdateMetadataRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "请求参数格式错误"})
	}

	if req.DocumentNumber != "" {
		doc.DocumentNumber = req.DocumentNumber
	}
	if req.StandardName != "" {
		doc.StandardName = req.StandardName
	}
	if req.StandardType != "" {
		doc.StandardType = req.StandardType
	}
	if req.EngineeringType != "" {
		doc.EngineeringType = req.EngineeringType
	}
	if req.PublishDate != "" {
		if t, err := time.Parse("2006-01-02", req.PublishDate); err == nil {
			doc.PublishDate = &t
		}
	}
	if req.EffectiveDate != "" {
		if t, err := time.Parse("2006-01-02", req.EffectiveDate); err == nil {
			doc.EffectiveDate = &t
		}
	}
	if req.AbolishDate != "" {
		if t, err := time.Parse("2006-01-02", req.AbolishDate); err == nil {
			doc.AbolishDate = &t
		}
	}

	if err := h.docRepo.Update(doc); err != nil {
		log.Printf("[Document] 更新失败 (ID=%d): %v", doc.ID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "更新失败"})
	}

	return c.JSON(fiber.Map{"message": "更新成功", "document": doc})
}

// Delete soft-deletes a document (moves to recycle bin).
func (h *DocumentHandler) Delete(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "无效的文档ID"})
	}

	if err := h.docRepo.SoftDelete(uint(id)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "删除失败"})
	}

	return c.JSON(fiber.Map{"message": "文档已移入回收站"})
}

// ListRecycleBin returns all soft-deleted documents.
func (h *DocumentHandler) ListRecycleBin(c *fiber.Ctx) error {
	docs, err := h.docRepo.ListDeleted()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "查询回收站失败"})
	}
	return c.JSON(fiber.Map{"documents": docs})
}

// Restore recovers a document from the recycle bin.
func (h *DocumentHandler) Restore(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "无效的文档ID"})
	}

	if err := h.docRepo.Restore(uint(id)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "恢复失败"})
	}

	return c.JSON(fiber.Map{"message": "文档已恢复"})
}

// Search performs a keyword search on extracted text.
func (h *DocumentHandler) Search(c *fiber.Ctx) error {
	keyword := c.Query("q")
	if keyword == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "请输入搜索关键词"})
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	pageSize, _ := strconv.Atoi(c.Query("page_size", "20"))

	docs, total, err := h.docRepo.Search(keyword, page, pageSize)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "搜索失败"})
	}

	return c.JSON(fiber.Map{
		"total":     total,
		"page":      page,
		"page_size": pageSize,
		"documents": docs,
	})
}

// PreviewPDF streams the PDF for secure in-browser Canvas rendering.
// The response headers actively prevent downloading.
func (h *DocumentHandler) PreviewPDF(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "无效的文档ID"})
	}

	doc, err := h.docRepo.FindByID(uint(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "文档未找到"})
	}

	// Use SendFile to handle streaming and HTTP Range requests automatically
	c.Set("Content-Type", "application/pdf")
	c.Set("Content-Disposition", "inline")
	c.Set("X-Content-Type-Options", "nosniff")
	c.Set("Cache-Control", "no-store, no-cache, must-revalidate")

	return c.SendFile(doc.FilePath)
}

// GetCategories returns the available classification options.
func (h *DocumentHandler) GetCategories(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"standard_types":    models.StandardTypes,
		"engineering_types": models.EngineeringTypes,
	})
}

// RetryVerify manually re-triggers document verification.
func (h *DocumentHandler) RetryVerify(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "无效的文档ID"})
	}

	doc, err := h.docRepo.FindByID(uint(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "文档未找到"})
	}

	doc.VerificationStatus = "pending"
	doc.VerificationLog = ""
	h.docRepo.Update(doc)

	go h.triggerVerification(doc)

	return c.JSON(fiber.Map{"message": "核验已重新触发"})
}

// RetryOCR manually re-triggers document OCR text extraction.
func (h *DocumentHandler) RetryOCR(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "无效的文档ID"})
	}

	doc, err := h.docRepo.FindByID(uint(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "文档未找到"})
	}

	doc.OCRStatus = "pending"
	// Optional: we can clear existing extracted texts/dates if needed,
	// but keeping them until overwritten might be safer depending on business logic.
	h.docRepo.Update(doc)

	go h.triggerOCR(doc, false)

	return c.JSON(fiber.Map{"message": "OCR 已重新触发"})
}

// RemoteOCR explicitly triggers remote Alibaba Cloud OCR processing on the first page.
func (h *DocumentHandler) RemoteOCR(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "无效的文档ID"})
	}

	doc, err := h.docRepo.FindByID(uint(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "文档未找到"})
	}

	doc.OCRStatus = "pending"
	h.docRepo.Update(doc)

	go h.triggerOCR(doc, true)

	return c.JSON(fiber.Map{"message": "远程 OCR 已触发"})
}

// HardDelete permanently removes a soft-deleted document from database and disk.
func (h *DocumentHandler) HardDelete(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "无效的文档ID"})
	}

	doc, err := h.docRepo.FindDeletedByID(uint(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "回收站中未找到该文档"})
	}

	// Delete physical file
	if doc.FilePath != "" {
		os.Remove(doc.FilePath)
	}

	if err := h.docRepo.HardDelete(uint(id)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "彻底删除失败"})
	}

	return c.JSON(fiber.Map{"message": "文档已彻底删除"})
}

// EmptyTrash permanently removes ALL soft-deleted documents.
func (h *DocumentHandler) EmptyTrash(c *fiber.Ctx) error {
	paths, err := h.docRepo.PurgeAll()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "清空回收站失败"})
	}

	// Delete physical files
	for _, p := range paths {
		os.Remove(p)
	}

	return c.JSON(fiber.Map{"message": fmt.Sprintf("已彻底删除 %d 个文档", len(paths))})
}
