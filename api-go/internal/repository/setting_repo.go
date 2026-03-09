package repository

import (
	"errors"

	"pdf-manager/api-go/internal/models"

	"gorm.io/gorm"
)

type SettingRepository interface {
	GetSetting(key string) (string, error)
	SetSetting(key, value string) error
	GetAll() (map[string]string, error)
}

type settingRepository struct {
	db *gorm.DB
}

func NewSettingRepository(db *gorm.DB) SettingRepository {
	return &settingRepository{db: db}
}

func (r *settingRepository) GetSetting(key string) (string, error) {
	var setting models.SystemSetting
	err := r.db.Where("key = ?", key).First(&setting).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil // Return empty string if not found, rather than erroring out
		}
		return "", err
	}
	return setting.Value, nil
}

func (r *settingRepository) SetSetting(key, value string) error {
	var setting models.SystemSetting
	err := r.db.Where("key = ?", key).First(&setting).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Create new
		setting = models.SystemSetting{
			Key:   key,
			Value: value,
		}
		return r.db.Create(&setting).Error
	} else if err != nil {
		return err
	}

	// Update existing
	setting.Value = value
	return r.db.Save(&setting).Error
}

func (r *settingRepository) GetAll() (map[string]string, error) {
	var settings []models.SystemSetting
	if err := r.db.Find(&settings).Error; err != nil {
		return nil, err
	}

	result := make(map[string]string)
	for _, s := range settings {
		result[s.Key] = s.Value
	}
	return result, nil
}
