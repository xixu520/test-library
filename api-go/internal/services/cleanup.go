package services

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/robfig/cron/v3"
	"pdf-manager/api-go/internal/repository"
)

// CleanupService handles scheduled purging of soft-deleted documents.
type CleanupService struct {
	docRepo *repository.DocumentRepository
	cron    *cron.Cron
}

// NewCleanupService creates and starts the cleanup cron job.
func NewCleanupService(docRepo *repository.DocumentRepository) *CleanupService {
	svc := &CleanupService{
		docRepo: docRepo,
		cron:    cron.New(),
	}
	// Run every day at 03:00 AM
	_, err := svc.cron.AddFunc("0 3 * * *", svc.purgeExpired)
	if err != nil {
		log.Printf("[CleanupService] 定时任务注册失败: %v", err)
	}
	svc.cron.Start()
	log.Println("[CleanupService] 回收站自动清理任务已启动 (每天 03:00)")
	return svc
}

// purgeExpired removes documents that have been in the recycle bin for > 30 days.
func (s *CleanupService) purgeExpired() {
	log.Println("[CleanupService] 开始清理超过30天的回收站文件...")

	paths, err := s.docRepo.PurgeOlderThan(30)
	if err != nil {
		log.Printf("[CleanupService] 数据库清理失败: %v", err)
		return
	}

	for _, p := range paths {
		if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
			log.Printf("[CleanupService] 文件删除失败 %s: %v", filepath.Base(p), err)
		}
	}

	log.Printf("[CleanupService] 已清理 %d 个过期文件", len(paths))
}

// Stop gracefully shuts down the cron scheduler.
func (s *CleanupService) Stop() {
	ctx := s.cron.Stop()
	<-ctx.Done()
	fmt.Println("[CleanupService] 定时清理任务已停止")
}
