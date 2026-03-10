# release v0.0.3

## [ZH] 0.0.3 版本更新说明

### 核心功能更新与修复
- **OCR 自动化回退机制**：实现本地 OCR（Tesseract）优先识别逻辑。若本地未能提取到标准号，系统将自动触发阿里云高精度远程 OCR 识别，确保高难度、深度扫描文档的识别率。
- **自动持久化**：OCR 识别出的标准号与标准名称现在会自动实时更新至数据库，无需人工干预即可应用识别结果。
- **核验异常诊断强化**：优化了标准核验服务的错误处理机制。现在可以针对“网站访问超时”、“连接失败”、“防爬虫封禁 (HTTP 403/404)”等具体原因提供精确的状态诊断报告。

### 代码审查发现与优化
- 完成了对 Go 后端、Python OCR 及 React 前端的全栈代码审查。
- 编制并发布了详细的《项目代码审查报告》与《系统功能使用手册》。
- 优化了物理文件删除与数据库记录状态同步的业务逻辑。

---

## [EN] Release v0.0.3 Notes

### Core Features & Fixes
- **OCR Automatic Fallback**: Implemented a "local-first" OCR pipeline. If the standard number is not detected via local engines, the system automatically triggers Alibaba Cloud OCR for high-precision recognition.
- **Automatic Persistence**: Recognized standard numbers and names are now automatically saved to the database upon OCR completion.
- **Enhanced Verification Diagnostics**: Improved error handling for the CSRES verification service. The system now provides detailed diagnostics for errors such as "Request Timeout," "Connection Failure," and "Bot Countermeasures (HTTP 403/404)."

### Code Review & Optimization
- Conducted a comprehensive full-stack code review of the Go Backend, Python OCR service, and React Frontend.
- Created and published the "Project Code Review Report" and "System User Manual."
- Optimized the logic for synchronizing physical file deletion with database record updates.
