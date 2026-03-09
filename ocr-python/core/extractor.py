"""
PDF 文本提取与 OCR 识别模块。
负责从 PDF 中解析出标准号、发布日期、实施日期和废止日期。
遵守防御性编程原则：所有外部调用均以 try-except 包裹。
"""

import re
import logging
from datetime import datetime
from typing import Optional, Dict, Any
import os

import pdfplumber
import pytesseract
from PIL import Image

# Import our alibaba integration (we will create this shortly)
try:
    from core.alibaba_ocr import recognize_pdf_alibaba
except ImportError:
    recognize_pdf_alibaba = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ExtractionResult:
    """OCR 提取结果的结构化表示。"""

    def __init__(
        self,
        document_number: str = "",
        standard_name: str = "",
        publish_date: str = "",
        effective_date: str = "",
        abolish_date: str = "",
        extracted_text: str = "",
        error: Optional[str] = None,
    ):
        self.document_number: str = document_number
        self.standard_name: str = standard_name
        self.publish_date: str = publish_date
        self.effective_date: str = effective_date
        self.abolish_date: str = abolish_date
        self.extracted_text: str = extracted_text
        self.error: Optional[str] = error

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "document_number": self.document_number,
            "standard_name": self.standard_name,
            "publish_date": self.publish_date,
            "effective_date": self.effective_date,
            "abolish_date": self.abolish_date,
            "extracted_text": self.extracted_text,
        }
        if self.error is not None:
            result["error"] = self.error
        return result


# ─── 日期解析工具 ───────────────────────────────────────
# 支持多种中文日期格式，增强容错性
DATE_PATTERNS: list[re.Pattern[str]] = [
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

def extract_date_after_keyword(text: str, *keywords: str) -> str:
    """
    从文本中寻找指定关键词，并在其附近提取日期。
    支持 "关键词: 日期" 或 "日期 关键词" 两种排布形式。
    """
    for keyword in keywords:
        # 扩大范围匹配前后 20 个字符寻找日期
        match = re.search(rf"(.{{0,20}}){re.escape(keyword)}\s*[:：]?\s*(.{{0,20}})", text)
        if match:
            # 匹配上下文：合并前后捕获组交给日期解析工具
            context = f"{match.group(1)} {match.group(2)}"
            return context
    return ""


# ─── 标准号提取 ───────────────────────────────────────
STANDARD_NUMBER_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"(GB/T\s*\d+[\.\-]?\d*\s*[-—一]\s*\d{4})", re.IGNORECASE),
    re.compile(r"(GB\s*\d+[\.\-]?\d*\s*[-—一]\s*\d{4})", re.IGNORECASE),
    re.compile(r"(JGJ/T\s*\d+[\.\-]?\d*\s*[-—一]\s*\d{4})", re.IGNORECASE),
    re.compile(r"(JGJ\s*\d+[\.\-]?\d*\s*[-—一]\s*\d{4})", re.IGNORECASE),
    re.compile(r"(JG/T\s*\d+[\.\-]?\d*\s*[-—一]\s*\d{4})", re.IGNORECASE),
    re.compile(r"(JG[-\s]T\s*\d+[\.\-]?\d*\s*[-—一]\s*\d{4})", re.IGNORECASE),
    re.compile(r"(JG\s*\d+[\.\-]?\d*\s*[-—一]\s*\d{4})", re.IGNORECASE),
    re.compile(r"(JC/T\s*\d+[\.\-]?\d*\s*[-—一]\s*\d{4})", re.IGNORECASE),
    re.compile(r"(CJJ\s*\d+[\.\-]?\d*\s*[-—一]\s*\d{4})", re.IGNORECASE),
    re.compile(r"(DB\d{2}/T?\s*\d+[\.\-]?\d*\s*[-—一]\s*\d{4})", re.IGNORECASE),
    re.compile(r"(T/\w+\s*\d+[\.\-]?\d*\s*[-—一]\s*\d{4})", re.IGNORECASE),
]


def extract_standard_number(text: str) -> tuple[str, str]:
    """从文本中提取标准号，并尝试提取中文名称，返回 (标准号, 标准名称)。"""
    for pattern in STANDARD_NUMBER_PATTERNS:
        match = pattern.search(text)
        if match:
            std_num = match.group(1).strip()
            # 兼容 OCR 可能识别出的全角横杠或汉字“一”
            std_num = std_num.replace('一', '-').replace('—', '-')
            # 将 OCR 可能识别出的 JG-T 标准化为 JG/T
            std_num = re.sub(r'^JG[-\s]T', 'JG/T', std_num, flags=re.IGNORECASE)
            
            # 尝试在标准号之后的几行内寻找中文标准名称
            suffix = text[match.end(1):]
            lines = suffix.split('\n')
            for line in lines[:15]:
                # 排除带有系统性说明的常见干扰词、出版机构名称和备案号等
                # 增加对“发 布”中间带空格的处理，以及常见政府部门名称的屏蔽
                line_str = str(line).strip()
                if len(line_str) > 2 and not re.search(r"代替|发\s*布|实\s*施|ICS|页|ISO|总目录|备案号|UDC|中华人民共和国|建设部|总局|委员会|出版社", line_str):
                    # 如果该行包含中文字符（允许字符间有空格），并且中文字符占据主要部分，很可能就是标准名称
                    # 避免匹配单独的一个字或者全是英文数字的行
                    # ([\u4e00-\u9fa5]\s*){3,} 匹配至少三个中文字符，字符间可有空格
                    if re.search(r"([\u4e00-\u9fa5]\s*){3,}", line_str):
                        # 如果是“陶 瓷 砖 胶 粘 剂”这种形式，则去掉空格，使其标准化
                        # 但如果空格较少，可能是标准名的一部分，这里采用简单的策略：
                        # 如果空格很多且分布均匀，则认为是为了美观加的空格，予以剔除
                        cleaned_name = line_str
                        if ' ' in line_str:
                            # 统计中文字符数和空格数
                            han_chars = re.findall(r"[\u4e00-\u9fa5]", line_str)
                            spaces = re.findall(r"\s+", line_str)
                            if len(spaces) >= len(han_chars) - 1 and len(han_chars) > 0:
                                # 几乎每个字之间都有空格，说明是分散对齐
                                cleaned_name = re.sub(r"\s+", "", line_str)
                        return std_num, cleaned_name
            return std_num, ""
    return "", ""


# ─── 核心提取函数 ─────────────────────────────────────
def extract_from_pdf(
    pdf_path: str,
    use_remote: bool = False,
    ak_id: str = "",
    ak_secret: str = "",
    endpoint: str = "ocr-api.cn-hangzhou.aliyuncs.com"
) -> dict:
    """
    从 PDF 文件提取文本和元数据。
    当 use_remote 为 True 且提供了 ak 时，优先调用阿里云 OCR 进行第一页文档识别。
    优先使用文本层 (pdfplumber)，文本不足时启动 OCR (tesseract)。
    """
    result = ExtractionResult()
    full_text = ""

    try:
        with pdfplumber.open(pdf_path) as pdf:
            if not pdf.pages:
                raise ValueError("PDF 文件不包含任何页面。")
            page = pdf.pages[0]

            # ---------------------------------------------------------
            # REMOTE ALIBABA OCR BRANCH
            # ---------------------------------------------------------
            if use_remote and ak_id and ak_secret and recognize_pdf_alibaba:
                logger.info("正在使用阿里云 OCR 处理文档首页...")
                img = page.to_image(resolution=200).original
                import tempfile
                with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_img:
                    img.save(tmp_img, format="PNG")
                    tmp_img_path = tmp_img.name
                
                try:
                    full_text = recognize_pdf_alibaba(tmp_img_path, ak_id, ak_secret, endpoint)
                    logger.info("阿里云 OCR 提取成功")
                except Exception as page_err:
                    logger.warning("阿里云 OCR 处理失败: %s", page_err)
                    # 回退到下面的本地逻辑？ 为了简单，如果失败就让 full_text 为空，后面会被拦截
                    full_text = ""
                finally:
                    os.remove(tmp_img_path)
            
            # ---------------------------------------------------------
            # LOCAL TESSERACT OCR BRANCH (Or Remote Fallback)
            # ---------------------------------------------------------
            if not full_text:
                logger.info("正在使用本地 OCR/提取策略 处理文档首页...")
                text_plumber = page.extract_text() or ""
                
                has_chinese = any('\u4e00' <= char <= '\u9fa5' for char in text_plumber)
                if len(text_plumber.strip()) > 50 and has_chinese:
                    full_text = text_plumber
                else:
                    logger.info("PDFPlumber 提取文本过少或无中文，开启本地 OCR 兜底...")
                    img = page.to_image(resolution=300).original
                    text_ocr = pytesseract.image_to_string(img, lang="chi_sim+eng")
                    full_text = text_plumber + "\n" + text_ocr

    except Exception as e:
        logger.error("PDF 打开失败 (%s): %s", pdf_path, e)
        result.error = f"PDF 文件解析失败: {str(e)}"
        return result.to_dict()

    result.extracted_text = full_text

    # 提取结构化字段
    result.document_number, result.standard_name = extract_standard_number(full_text)

    # 尝试提取日期
    publish_match = re.search(r"(.{0,20})发布(?:日期)?\s*[:：]?\s*(.{0,20})", full_text)
    effective_match = re.search(r"(.{0,20})实施(?:日期)?\s*[:：]?\s*(.{0,20})", full_text)
    abolish_match = re.search(r"(.{0,20})废止(?:日期)?\s*[:：]?\s*(.{0,20})", full_text)

    if publish_match:
        context = f"{publish_match.group(1)} {publish_match.group(2)}"
        result.publish_date = parse_date_flexible(context)
    if effective_match:
        context = f"{effective_match.group(1)} {effective_match.group(2)}"
        result.effective_date = parse_date_flexible(context)
    if abolish_match:
        context = f"{abolish_match.group(1)} {abolish_match.group(2)}"
        result.abolish_date = parse_date_flexible(context)

    return result.to_dict()
