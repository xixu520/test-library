package main

import (
	"log"

	"pdf-manager/api-go/internal/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := "host=localhost user=pdfadmin password=pdfSecure2024! dbname=pdf_manager port=5432 sslmode=disable TimeZone=Asia/Shanghai"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	var doc models.Document
	if err := db.First(&doc, 17).Error; err != nil {
		log.Fatal("Find error: ", err)
	}

	doc.DocumentNumber = "GB/T 9999-TEST"
	if err := db.Save(&doc).Error; err != nil {
		log.Fatal("Save error: ", err)
	}

	log.Println("Save SUCCESS")
}
