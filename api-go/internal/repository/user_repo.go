package repository

import (
	"gorm.io/gorm"
	"pdf-manager/api-go/internal/models"
)

// UserRepository handles all database operations for users.
type UserRepository struct {
	db *gorm.DB
}

// NewUserRepository creates a new user repository instance.
func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

// Create inserts a new user record.
func (r *UserRepository) Create(user *models.User) error {
	return r.db.Create(user).Error
}

// FindByUsername retrieves a user by username.
func (r *UserRepository) FindByUsername(username string) (*models.User, error) {
	var user models.User
	err := r.db.Where("username = ?", username).First(&user).Error
	return &user, err
}

// FindByID retrieves a user by ID.
func (r *UserRepository) FindByID(id uint) (*models.User, error) {
	var user models.User
	err := r.db.First(&user, id).Error
	return &user, err
}

// ListAll retrieves all users.
func (r *UserRepository) ListAll() ([]models.User, error) {
	var users []models.User
	err := r.db.Find(&users).Error
	return users, err
}

// Delete removes a user by ID.
func (r *UserRepository) Delete(id uint) error {
	return r.db.Delete(&models.User{}, id).Error
}
