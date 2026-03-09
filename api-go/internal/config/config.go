package config

import (
	"fmt"
	"os"
)

// Config holds all application configuration.
type Config struct {
	DBHost        string
	DBPort        string
	DBUser        string
	DBPassword    string
	DBName        string
	JWTSecret     string
	OCRServiceURL string
	StoragePath   string
	ServerPort    string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() *Config {
	return &Config{
		DBHost:        getEnv("DB_HOST", "localhost"),
		DBPort:        getEnv("DB_PORT", "5432"),
		DBUser:        getEnv("DB_USER", "pdfadmin"),
		DBPassword:    getEnv("DB_PASSWORD", "pdfSecure2024!"),
		DBName:        getEnv("DB_NAME", "pdf_manager"),
		JWTSecret:     getEnv("JWT_SECRET", "dev-secret-key"),
		OCRServiceURL: getEnv("OCR_SERVICE_URL", "http://localhost:8001"),
		StoragePath:   getEnv("STORAGE_PATH", "./storage"),
		ServerPort:    getEnv("SERVER_PORT", "8080"),
	}
}

// DSN returns the PostgreSQL connection string.
func (c *Config) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable TimeZone=Asia/Shanghai",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName,
	)
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return fallback
}
