package repository

import (
	"time"

	"pdf-manager/api-go/internal/models"

	"gorm.io/gorm"
)

// DocumentRepository handles all database operations for documents.
type DocumentRepository struct {
	db *gorm.DB
}

// NewDocumentRepository creates a new repository instance.
func NewDocumentRepository(db *gorm.DB) *DocumentRepository {
	return &DocumentRepository{db: db}
}

// Create inserts a new document record.
func (r *DocumentRepository) Create(doc *models.Document) error {
	return r.db.Create(doc).Error
}

// FindByID retrieves a single non-deleted document by ID.
func (r *DocumentRepository) FindByID(id uint) (*models.Document, error) {
	var doc models.Document
	err := r.db.First(&doc, id).Error
	return &doc, err
}

// List retrieves documents with optional category filters and pagination.
func (r *DocumentRepository) List(standardType, engineeringType string, page, pageSize int) ([]models.Document, int64, error) {
	query := r.db.Model(&models.Document{})

	if standardType != "" {
		query = query.Where("standard_type = ?", standardType)
	}
	if engineeringType != "" {
		query = query.Where("engineering_type = ?", engineeringType)
	}

	var total int64
	query.Count(&total)

	var docs []models.Document
	offset := (page - 1) * pageSize
	err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&docs).Error
	return docs, total, err
}

// Update modifies an existing document record.
func (r *DocumentRepository) Update(doc *models.Document) error {
	return r.db.Save(doc).Error
}

// SoftDelete marks a document as deleted (moves to recycle bin).
func (r *DocumentRepository) SoftDelete(id uint) error {
	return r.db.Delete(&models.Document{}, id).Error
}

// Restore recovers a soft-deleted document from the recycle bin.
func (r *DocumentRepository) Restore(id uint) error {
	return r.db.Unscoped().Model(&models.Document{}).Where("id = ?", id).Update("deleted_at", nil).Error
}

// ListDeleted retrieves all soft-deleted documents (recycle bin).
func (r *DocumentRepository) ListDeleted() ([]models.Document, error) {
	var docs []models.Document
	err := r.db.Unscoped().Where("deleted_at IS NOT NULL").Order("deleted_at DESC").Find(&docs).Error
	return docs, err
}

// PurgeOlderThan permanently deletes documents that were soft-deleted more than `days` ago.
// Returns the file paths of purged documents for physical file cleanup.
func (r *DocumentRepository) PurgeOlderThan(days int) ([]string, error) {
	cutoff := time.Now().AddDate(0, 0, -days)

	var docs []models.Document
	err := r.db.Unscoped().Where("deleted_at IS NOT NULL AND deleted_at < ?", cutoff).Find(&docs).Error
	if err != nil {
		return nil, err
	}

	var paths []string
	for _, doc := range docs {
		paths = append(paths, doc.FilePath)
	}

	err = r.db.Unscoped().Where("deleted_at IS NOT NULL AND deleted_at < ?", cutoff).Delete(&models.Document{}).Error
	return paths, err
}

// Search performs a PostgreSQL full-text search on extracted text.
func (r *DocumentRepository) Search(keyword string, page, pageSize int) ([]models.Document, int64, error) {
	query := r.db.Model(&models.Document{}).Where(
		"extracted_text ILIKE ?", "%"+keyword+"%",
	)

	var total int64
	query.Count(&total)

	var docs []models.Document
	offset := (page - 1) * pageSize
	err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&docs).Error
	return docs, total, err
}

// FindDeletedByID retrieves a single soft-deleted document by ID.
func (r *DocumentRepository) FindDeletedByID(id uint) (*models.Document, error) {
	var doc models.Document
	err := r.db.Unscoped().Where("id = ? AND deleted_at IS NOT NULL", id).First(&doc).Error
	return &doc, err
}

// HardDelete permanently removes a single document from the database.
func (r *DocumentRepository) HardDelete(id uint) error {
	return r.db.Unscoped().Delete(&models.Document{}, id).Error
}

// PurgeAll permanently deletes ALL soft-deleted documents.
// Returns the file paths for physical file cleanup.
func (r *DocumentRepository) PurgeAll() ([]string, error) {
	var docs []models.Document
	err := r.db.Unscoped().Where("deleted_at IS NOT NULL").Find(&docs).Error
	if err != nil {
		return nil, err
	}

	var paths []string
	for _, doc := range docs {
		paths = append(paths, doc.FilePath)
	}

	err = r.db.Unscoped().Where("deleted_at IS NOT NULL").Delete(&models.Document{}).Error
	return paths, err
}
