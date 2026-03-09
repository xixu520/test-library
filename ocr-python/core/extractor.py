"""
PDF 文本提取与 OCR 识别模块。
负责从 PDF 中解析出标准号、发布日期、实施日期和废止日期。
遵守防御性编程原则：所有外部调用均以 try-except 包裹。
"""

import re
import logging
from datetime import datetime
from typing import Optional

import pdfplumber
import pytesseract
from PIL import Image

logger = logging.getLogger(__name__)


class ExtractionResult:
    """OCR 提取结果的结构化表示。"""

    def __init__(
        self,
        document_number: str = "",
        publish_date: str = "",
        effective_date: str = "",
        abolish_date: str = "",
        extracted_text: str = "",
        error: Optional[str] = None,
    ):
        self.document_number: str = document_number
        self.publish_date: str = publish_date
        self.effective_date: str = effective_date
        self.abolish_date: str = abolish_date
        self.extracted_text: str = extracted_text
        self.error: Optional[str] = error

    def to_dict(self) -> dict:
        result = {
            "document_number": self.document_number,
            "publish_date": self.publish_date,
            "effective_date": self.effective_date,
            "abolish_date": self.abolish_date,
            "extracted_text": self.extracted_text,
        }
        if self.error:
            result["error"] = self.error
        return result


# ─── 日期解析工具 ───────────────────────────────────────
# 支持多种中文日期格式，增强容错性
DATE_PATTERNS: list[re.Pattern] = [
    re.compile(r"(\d{4})\s*[-年./]\s*(\d{1,2})\s*[-月./]\s*(\d{1,2})\s*[日号]?"),
    re.compile(r"(\d{4})(\d{2})(\d{2})"),  # 20230101
]


def parse_date_flexible(text: str) -> str:
    """尝试从文本中提取日期，返回 YYYY-MM-DD 格式。"""
    for pattern in DATE_PATTERNS:
        match = pattern.search(text)
        if match:
            try:
                year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
                dt = datetime(year, month, day)
                return dt.strftime("%Y-%m-%d")
            except (ValueError, IndexError):
                continue
    return ""


# ─── 标准号提取 ───────────────────────────────────────
STANDARD_NUMBER_PATTERNS: list[re.Pattern] = [
    re.compile(r"(GB/T\s*\d+[\.\-]?\d*\s*[-—]\s*\d{4})", re.IGNORECASE),
    re.compile(r"(GB\s*\d+[\.\-]?\d*\s*[-—]\s*\d{4})", re.IGNORECASE),
    re.compile(r"(JGJ\s*\d+[\.\-]?\d*\s*[-—]\s*\d{4})", re.IGNORECASE),
    re.compile(r"(JG/T\s*\d+[\.\-]?\d*\s*[-—]\s*\d{4})", re.IGNORECASE),
    re.compile(r"(CJJ\s*\d+[\.\-]?\d*\s*[-—]\s*\d{4})", re.IGNORECASE),
    re.compile(r"(DB\d{2}/T?\s*\d+[\.\-]?\d*\s*[-—]\s*\d{4})", re.IGNORECASE),
    re.compile(r"(T/\w+\s*\d+[\.\-]?\d*\s*[-—]\s*\d{4})", re.IGNORECASE),
]


def extract_standard_number(text: str) -> str:
    """从文本中提取标准号。"""
    for pattern in STANDARD_NUMBER_PATTERNS:
        match = pattern.search(text)
        if match:
            return match.group(1).strip()
    return ""


# ─── 核心提取函数 ─────────────────────────────────────
def extract_from_pdf(file_path: str) -> ExtractionResult:
    """
    从 PDF 文件提取文本和元数据。
    优先使用文本层 (pdfplumber)，文本不足时启动 OCR (tesseract)。
    """
    result = ExtractionResult()
    full_text_parts: list[str] = []

    try:
        with pdfplumber.open(file_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                try:
                    text = page.extract_text() or ""

                    # 如果文本太少，尝试 OCR
                    if len(text.strip()) < 20:
                        try:
                            img = page.to_image(resolution=300)
                            pil_image: Image.Image = img.original
                            text = pytesseract.image_to_string(
                                pil_image, lang="chi_sim+eng"
                            )
                        except Exception as ocr_err:
                            logger.warning(
                                "OCR 失败 (页 %d): %s", page_num + 1, ocr_err
                            )

                    full_text_parts.append(text)

                    # 限制处理页数以防 OOM
                    if page_num >= 19:
                        logger.info("文件超过20页，截断处理")
                        break

                except Exception as page_err:
                    logger.warning("页面 %d 处理失败: %s", page_num + 1, page_err)
                    continue

    except Exception as e:
        logger.error("PDF 打开失败 (%s): %s", file_path, e)
        result.error = f"PDF 文件解析失败: {str(e)}"
        return result

    full_text = "\n".join(full_text_parts)
    result.extracted_text = full_text

    # 提取结构化字段
    result.document_number = extract_standard_number(full_text)

    # 尝试提取日期
    publish_match = re.search(r"发布[日期]?\s*[:：]?\s*(.{10,20})", full_text)
    effective_match = re.search(r"实施[日期]?\s*[:：]?\s*(.{10,20})", full_text)
    abolish_match = re.search(r"废止[日期]?\s*[:：]?\s*(.{10,20})", full_text)

    if publish_match:
        result.publish_date = parse_date_flexible(publish_match.group(1))
    if effective_match:
        result.effective_date = parse_date_flexible(effective_match.group(1))
    if abolish_match:
        result.abolish_date = parse_date_flexible(abolish_match.group(1))

    return result
