"""
PDF 文档管理系统 - OCR 与核验微服务
FastAPI 高性能异步入口
"""

import logging
import os
import shutil
import tempfile
import collections
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from datetime import datetime

from fastapi import BackgroundTasks, FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from core.extractor import extract_from_pdf
from core.verifier import verify_document

# ─── 日志配置 ─────────────────────────────────────────
# 内存日志缓冲区，供前端实时查看
LOG_BUFFER = collections.deque(maxlen=200)


class BufferingHandler(logging.Handler):
    """将日志写入内存缓冲区。"""
    def emit(self, record):
        try:
            msg = self.format(record)
            LOG_BUFFER.append({
                "time": datetime.now().strftime("%H:%M:%S"),
                "level": record.levelname,
                "message": msg,
            })
        except Exception:
            pass


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
# 添加内存 handler
buf_handler = BufferingHandler()
buf_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
logging.getLogger().addHandler(buf_handler)

logger = logging.getLogger(__name__)

# ─── 存储路径 ─────────────────────────────────────────
STORAGE_PATH: str = os.getenv("STORAGE_PATH", "./storage")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """应用生命周期管理。"""
    logger.info("OCR 服务启动中...")
    os.makedirs(STORAGE_PATH, exist_ok=True)
    yield
    logger.info("OCR 服务关闭")


app = FastAPI(
    title="PDF OCR & 核验服务",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── 请求/响应模型 ────────────────────────────────────
class VerifyRequest(BaseModel):
    """核验请求的数据模型。"""
    document_id: int
    document_number: str
    publish_date: str = ""
    effective_date: str = ""
    abolish_date: str = ""


class HealthResponse(BaseModel):
    """健康检查响应。"""
    status: str
    service: str


# ─── 路由 ─────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """服务健康检查端点。"""
    return HealthResponse(status="ok", service="ocr-python")


@app.get("/api/logs")
async def get_logs():
    """返回最近的日志条目供前端实时显示。"""
    return {"logs": list(LOG_BUFFER)}


@app.post("/api/ocr/test")
async def test_ocr_api(
    baidu_api_key: str = Form(""),
    baidu_secret_key: str = Form("")
):
    """测试百度云 OCR API 连通性。"""
    if not baidu_api_key or not baidu_secret_key:
        logger.warning("API 连通测试失败: 未提供 API Key 或 Secret Key")
        return {"success": False, "message": "未提供 API Key 或 Secret Key"}

    try:
        from core.baidu_ocr import get_access_token
        # 尝试进行一次简单的 OAuth 认证请求，如果不抛出异常且拿到 token 说明连通性 OK
        logger.info("正在测试百度云 OCR API 连通性...")
        token = get_access_token(baidu_api_key, baidu_secret_key)
        
        if token:
            logger.info("百度云 OCR API 连通测试成功！")
            return {"success": True, "message": "API 连通正常，认证成功"}
        else:
            return {"success": False, "message": "获取 Access Token 失败"}

    except Exception as e:
        error_msg = str(e)
        logger.error("百度云 OCR API 连通测试失败: %s", error_msg)
        return {"success": False, "message": f"连接失败: {error_msg[:200]}"}


@app.post("/api/ocr/extract")
async def extract_text(
    file: UploadFile = File(...),
    use_remote_api: str = Form("false"),
    baidu_api_key: str = Form(""),
    baidu_secret_key: str = Form("")
) -> dict:
    """
    接收 PDF 文件并提取文本及结构化元数据。

    防御性策略：
    - 文件先写入临时目录，处理完毕后清理
    - 所有解析异常在 extractor 内部已被捕获
    """
    tmp_dir: str = ""
    try:
        # 创建临时文件
        tmp_dir = tempfile.mkdtemp(prefix="ocr_")
        tmp_path = os.path.join(tmp_dir, file.filename or "upload.pdf")

        with open(tmp_path, "wb") as f:
            content = await file.read()
            f.write(content)

        logger.info("开始处理文件: %s (%d bytes)", file.filename, len(content))

        # 调用核心提取器
        is_remote = (use_remote_api.lower() == "true")
        result = extract_from_pdf(
            tmp_path,
            use_remote=is_remote,
            ak_id=baidu_api_key,
            ak_secret=baidu_secret_key
        )

        logger.info(
            "提取完成: 标准号=%s, 发布=%s, 实施=%s",
            result.get("document_number", ""),
            result.get("publish_date", ""),
            result.get("effective_date", ""),
        )

        return result

    except Exception as e:
        logger.error("文件处理异常: %s", e)
        return {"error": f"处理失败: {str(e)}"}

    finally:
        # 清理临时文件
        if tmp_dir and os.path.exists(tmp_dir):
            try:
                shutil.rmtree(tmp_dir)
            except OSError:
                pass


@app.post("/api/verify")
async def verify_dates(req: VerifyRequest) -> dict:
    """
    核验标准文档的日期信息。

    调用 verifier 模块访问 f.csres.com 进行比对：
    - matched: 日期一致，无需修改
    - updated: 日期不一致，返回网站最新数据
    - failed: 查询失败，保留原始数据并记录日志
    """
    try:
        logger.info(
            "开始核验: ID=%d, 标准号=%s",
            req.document_id,
            req.document_number,
        )

        result = verify_document(
            document_number=req.document_number,
            publish_date=req.publish_date,
            effective_date=req.effective_date,
            abolish_date=req.abolish_date,
        )

        logger.info(
            "核验完成: ID=%d, 状态=%s",
            req.document_id,
            result.status,
        )

        return result.to_dict()

    except Exception as e:
        logger.error("核验异常 (ID=%d): %s", req.document_id, e)
        return {
            "status": "failed",
            "message": f"核验服务内部错误: {str(e)}",
        }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info",
    )
