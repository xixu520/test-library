package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"pdf-manager/api-go/internal/config"
	"pdf-manager/api-go/internal/handlers"
	"pdf-manager/api-go/internal/middleware"
	"pdf-manager/api-go/internal/models"
	"pdf-manager/api-go/internal/repository"
	"pdf-manager/api-go/internal/services"
)

func main() {
	cfg := config.Load()

	// Connect to PostgreSQL
	db, err := gorm.Open(postgres.Open(cfg.DSN()), &gorm.Config{})
	if err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}
	log.Println("数据库连接成功")

	// Auto-migrate models
	if err := db.AutoMigrate(&models.User{}, &models.Document{}); err != nil {
		log.Fatalf("数据库迁移失败: %v", err)
	}

	// Ensure storage directory exists
	if err := os.MkdirAll(cfg.StoragePath, 0755); err != nil {
		log.Fatalf("存储目录创建失败: %v", err)
	}

	// Initialize repositories
	userRepo := repository.NewUserRepository(db)
	docRepo := repository.NewDocumentRepository(db)

	// Initialize services
	ocrService := services.NewOCRService(cfg.OCRServiceURL)
	cleanupService := services.NewCleanupService(docRepo)
	defer cleanupService.Stop()

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(userRepo, cfg.JWTSecret)
	docHandler := handlers.NewDocumentHandler(docRepo, ocrService, cfg.StoragePath)

	// Setup Fiber app
	app := fiber.New(fiber.Config{
		BodyLimit: 200 * 1024 * 1024, // 200MB max upload
	})

	// Global middleware
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PUT, DELETE, OPTIONS",
	}))

	// Public routes
	api := app.Group("/api")
	api.Post("/auth/register", authHandler.Register)
	api.Post("/auth/login", authHandler.Login)
	api.Get("/categories", docHandler.GetCategories)

	// Protected routes (require JWT)
	protected := api.Group("", middleware.JWTMiddleware(cfg.JWTSecret))
	protected.Post("/documents/upload", docHandler.Upload)
	protected.Get("/documents", docHandler.List)
	protected.Get("/documents/search", docHandler.Search)
	protected.Get("/documents/:id", docHandler.GetByID)
	protected.Get("/documents/:id/preview", docHandler.PreviewPDF)

	// Admin-only routes
	admin := protected.Group("", middleware.AdminOnly())
	admin.Put("/documents/:id", docHandler.UpdateMetadata)
	admin.Delete("/documents/:id", docHandler.Delete)
	admin.Get("/recycle-bin", docHandler.ListRecycleBin)
	admin.Post("/recycle-bin/:id/restore", docHandler.Restore)

	// Graceful shutdown
	go func() {
		if err := app.Listen(":" + cfg.ServerPort); err != nil {
			log.Fatalf("服务启动失败: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("正在关闭服务...")
	app.Shutdown()
}
