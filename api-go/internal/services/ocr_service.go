package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"
)

// OCRService communicates with the Python OCR/verification service.
type OCRService struct {
	baseURL    string
	httpClient *http.Client
}

// OCRResult represents the response from the Python OCR service.
type OCRResult struct {
	DocumentNumber string `json:"document_number"`
	PublishDate    string `json:"publish_date"`
	EffectiveDate  string `json:"effective_date"`
	AbolishDate    string `json:"abolish_date"`
	ExtractedText  string `json:"extracted_text"`
	Error          string `json:"error,omitempty"`
}

// NewOCRService creates a new OCR service client.
func NewOCRService(baseURL string) *OCRService {
	return &OCRService{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 5 * time.Minute, // OCR can be slow for large files
		},
	}
}

// ExtractText sends a PDF file to the Python OCR service for text extraction.
func (s *OCRService) ExtractText(filePath string, fileContent io.Reader, payload map[string]interface{}) (*OCRResult, error) {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	for k, v := range payload {
		_ = writer.WriteField(k, fmt.Sprintf("%v", v))
	}

	part, err := writer.CreateFormFile("file", filePath)
	if err != nil {
		return nil, fmt.Errorf("创建表单文件失败: %w", err)
	}

	if _, err := io.Copy(part, fileContent); err != nil {
		return nil, fmt.Errorf("复制文件内容失败: %w", err)
	}

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("关闭表单写入器失败: %w", err)
	}

	req, err := http.NewRequest("POST", s.baseURL+"/api/ocr/extract", &buf)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("OCR服务请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("OCR服务返回错误 (%d): %s", resp.StatusCode, string(body))
	}

	var result OCRResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("解析OCR结果失败: %w", err)
	}

	return &result, nil
}

// VerifyDocument asks the Python service to verify document dates against f.csres.com.
type VerifyRequest struct {
	DocumentID     uint   `json:"document_id"`
	DocumentNumber string `json:"document_number"`
	PublishDate    string `json:"publish_date"`
	EffectiveDate  string `json:"effective_date"`
	AbolishDate    string `json:"abolish_date"`
}

// VerifyResult represents the outcome of the verification.
type VerifyResult struct {
	Status  string `json:"status"` // matched | updated | failed
	Message string `json:"message"`
	// Updated fields (only when status == "updated")
	PublishDate   string `json:"publish_date,omitempty"`
	EffectiveDate string `json:"effective_date,omitempty"`
	AbolishDate   string `json:"abolish_date,omitempty"`
}

// Verify sends a verification request to the Python service.
func (s *OCRService) Verify(req *VerifyRequest) (*VerifyResult, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("序列化请求失败: %w", err)
	}

	httpReq, err := http.NewRequest("POST", s.baseURL+"/api/verify", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("核验服务请求失败: %w", err)
	}
	defer resp.Body.Close()

	var result VerifyResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("解析核验结果失败: %w", err)
	}

	return &result, nil
}
