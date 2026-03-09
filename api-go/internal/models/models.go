package models

import (
	"time"

	"gorm.io/gorm"
)

// User represents a registered user of the system.
type User struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Username  string         `gorm:"uniqueIndex;size:100;not null" json:"username"`
	Password  string         `gorm:"size:255;not null" json:"-"`
	Role      string         `gorm:"size:20;default:viewer;not null" json:"role"` // admin | editor | viewer
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// Document represents a PDF document with classification and date metadata.
type Document struct {
	ID                 uint           `gorm:"primaryKey" json:"id"`
	UserID             uint           `gorm:"index;not null" json:"user_id"`
	FileName           string         `gorm:"size:500;not null" json:"file_name"`
	FilePath           string         `gorm:"size:1000;not null" json:"-"`
	FileSize           int64          `json:"file_size"`
	DocumentNumber     string         `gorm:"size:200;index" json:"document_number"`
	StandardType       string         `gorm:"size:50;index;not null" json:"standard_type"`
	EngineeringType    string         `gorm:"size:50;index;not null" json:"engineering_type"`
	PublishDate        *time.Time     `json:"publish_date"`
	EffectiveDate      *time.Time     `json:"effective_date"`
	AbolishDate        *time.Time     `json:"abolish_date"`
	ExtractedText      string         `gorm:"type:text" json:"-"`
	OCRStatus          string         `gorm:"size:30;default:pending" json:"ocr_status"`
	VerificationStatus string         `gorm:"size:30;default:pending" json:"verification_status"`
	VerificationLog    string         `gorm:"type:text" json:"verification_log,omitempty"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

// SystemSetting stores global key-value configuration flags and credentials.
type SystemSetting struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Key       string    `gorm:"uniqueIndex;size:100;not null" json:"key"`
	Value     string    `gorm:"type:text" json:"value"`
	UpdatedAt time.Time `json:"updated_at"`
}

// StandardTypes enumerates the left sidebar categories.
var StandardTypes = []string{
	"国家标准",
	"行业标准",
	"地方标准",
	"团体/企业标准",
}

// EngineeringTypes enumerates the header tab categories.
var EngineeringTypes = []string{
	"地基基础",
	"主体结构",
	"建筑材料",
	"节能保温",
	"室内装修",
	"防水工程",
	"钢结构",
	"市政道路工程",
	"消防检测",
	"幕墙检测",
}
