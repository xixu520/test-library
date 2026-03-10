"""
PDF 文本提取与 OCR 识别模块。
负责从 PDF 中解析出标准号、发布日期、实施日期和废止日期。
遵守防御性编程原则：所有外部调用均以 try-except 包裹。
基于空间位置进行高精度抽取。
"""

import re
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
import os

import pdfplumber
import pytesseract
from PIL import Image

# Import our baidu integration
try:
    from core.baidu_ocr import recognize_pdf_baidu
except ImportError:
    recognize_pdf_baidu = None

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


@dataclass
class TextBlock:
    """带空间位置的文本块"""
    text: str
    x0: float
    top: float
    x1: float
    bottom: float


# ─── 日期解析工具 ───────────────────────────────────────
DATE_PATTERNS: list[re.Pattern] = [
    re.compile(r"(\d{4})\s*[-年./]\s*(\d{1,2})\s*[-月./]\s*(\d{1,2})\s*[日号]?"),
    re.compile(r"(\d{4})(\d{2})(\d{2})"),
]

def parse_date_flexible(text: str) -> str:
    """尝试从文本中提取日期，返回 YYYY-MM-DD 格式。"""
    for pattern in DATE_PATTERNS:
        # Search all matches to find a valid one, not just the first one
        for match in pattern.finditer(text):
            try:
                year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
                # Restrict year to a reasonable range to avoid matching standard numbers like 7689
                if year < 1900 or year > 2100:
                    continue
                dt = datetime(year, month, day)
                return dt.strftime("%Y-%m-%d")
            except (ValueError, IndexError):
                continue
    return ""


# ─── 标准号正则 ───────────────────────────────────────
STANDARD_NUMBER_PATTERNS: list[re.Pattern] = [
    re.compile(r"(GB/T\s*\d+[\.\-]?\d*\s*[-—一\s]+\s*\d{4})", re.IGNORECASE),
    re.compile(r"(GB\s*\d+[\.\-]?\d*\s*[-—一\s]+\s*\d{4})", re.IGNORECASE),
    re.compile(r"(JGJ/T\s*\d+[\.\-]?\d*\s*[-—一\s]+\s*\d{4})", re.IGNORECASE),
    re.compile(r"(JGJ\s*\d+[\.\-]?\d*\s*[-—一\s]+\s*\d{4})", re.IGNORECASE),
    re.compile(r"(JG/T\s*\d+[\.\-]?\d*\s*[-—一\s]+\s*\d{4})", re.IGNORECASE),
    re.compile(r"(JG[-\s]T\s*\d+[\.\-]?\d*\s*[-—一\s]+\s*\d{4})", re.IGNORECASE),
    re.compile(r"(JG\s*\d+[\.\-]?\d*\s*[-—一\s]+\s*\d{4})", re.IGNORECASE),
    re.compile(r"(JC/T\s*\d+[\.\-]?\d*\s*[-—一\s]+\s*\d{4})", re.IGNORECASE),
    re.compile(r"(CJJ\s*\d+[\.\-]?\d*\s*[-—一\s]+\s*\d{4})", re.IGNORECASE),
    re.compile(r"(DB\d{2}/T?\s*\d+[\.\-]?\d*\s*[-—一\s]+\s*\d{4})", re.IGNORECASE),
    re.compile(r"(T/\w+\s*\d+[\.\-]?\d*\s*[-—一\s]+\s*\d{4})", re.IGNORECASE),
]

def clean_standard_num(std_num: str) -> str:
    std_num = std_num.strip().replace('一', '-').replace('—', '-')
    std_num = re.sub(r'^JG[-\s]T', 'JG/T', std_num, flags=re.IGNORECASE)
    return std_num

EXCLUDE_REGEX = re.compile(r"代替|发布|实施|ICS|UDC|页|ISO|总目录|备案号|UDC|中华人民共和国|建设部|总局|委员会|出版社|[\da-zA-Z]{10,}")
CHINESE_NAME_LINE_REGEX = re.compile(r"([\u4e00-\u9fa5\d\s：，第部分]{2,})")
ENGLISH_TITLE_REGEX = re.compile(r"^[a-zA-Z\s\-\.,:;()]{10,}$")

# ─── 空间布局提取 ─────────────────────────────────────
def extract_spatial_fields(blocks: List[TextBlock], page_width: float, page_height: float) -> tuple[str, str, str, str]:
    """基于象限/位置提取对应字段。"""
    std_num = ""
    std_name = ""
    publish_date = ""
    effective_date = ""

    # Sort blocks natively top to bottom
    blocks.sort(key=lambda b: b.top)

    center_blocks = []

    for block in blocks:
        text = block.text.strip()
        if not text: continue
        
        # 1. Top Right: Standard Number
        if block.top < page_height * 0.35 and block.x0 > page_width * 0.4:
            for pattern in STANDARD_NUMBER_PATTERNS:
                match = pattern.search(text)
                if match:
                    std_num = clean_standard_num(match.group(1))
                    break
        
        # 2. Bottom Left: Publish Date
        if block.top > page_height * 0.65 and block.x1 < page_width * 0.6:
            d = parse_date_flexible(text)
            if d:
                # Prefer blocks that contain the keyword "发布", otherwise keep the first valid date found
                if "发布" in text:
                    publish_date = d
                elif not publish_date:
                    publish_date = d

        # 3. Bottom Right: Effective Date
        if block.top > page_height * 0.65 and block.x0 > page_width * 0.4:
            d = parse_date_flexible(text)
            if d:
                if "实施" in text:
                    effective_date = d
                elif not effective_date:
                    effective_date = d

        # 4. Center Area: Potential Title
        # Title is usually in the upper-middle of the page, below the standard number but above the dates.
        if page_height * 0.2 < block.top < page_height * 0.7:
             if not EXCLUDE_REGEX.search(text) and not re.search(r"^\d{4}-\d{2}-\d{2}", text):
                 if not ENGLISH_TITLE_REGEX.match(text):
                     if CHINESE_NAME_LINE_REGEX.search(text):
                         # Clean text
                         text = text.replace("，", " ").replace(",", " ")
                         han_chars = re.findall(r"[\u4e00-\u9fa5]", text)
                         spaces = re.findall(r"\s+", text)
                         if len(spaces) >= len(han_chars) - 1 and len(han_chars) > 0:
                             text = re.sub(r"\s+", "", text)
                         else:
                             text = re.sub(r"\s+", " ", text)
                         center_blocks.append(text)

    if center_blocks:
        std_name = " ".join(center_blocks).strip()
        std_name = re.sub(r"\s+", " ", std_name)

    return std_num, std_name, publish_date, effective_date


# ─── 核心提取函数 ─────────────────────────────────────
def extract_from_pdf(
    pdf_path: str,
    use_remote: bool = False,
    ak_id: str = "",
    ak_secret: str = ""
) -> dict:
    """
    从 PDF 文件提取文本和元数据。
    """
    result = ExtractionResult()
    blocks = []
    page_w, page_h = 1000, 1000 # Default fallback dimensions
    full_text = ""

    try:
        with pdfplumber.open(pdf_path) as pdf:
            if not pdf.pages:
                raise ValueError("PDF 文件不包含任何页面。")
            page = pdf.pages[0]
            page_w, page_h = page.width, page.height
            full_text = page.extract_text() or ""

            logger.info("正在使用本地提取策略处理文档首页...")
            words = page.extract_words()
            for w in words:
                 blocks.append(TextBlock(
                     text=w['text'],
                     x0=w['x0'],
                     top=w['top'],
                     x1=w['x1'],
                     bottom=w['bottom']
                 ))

            # 快速检查本地是否提取到了中文字符。如果没有，极大概率是纯图片PDF。
            has_chinese = any('\u4e00' <= char <= '\u9fa5' for char in full_text)
            
            # 使用现有本地逻辑简单检查标准号，决定是否需要 fallback
            local_doc_num = ""
            if blocks and has_chinese:
                local_doc_num, _, _, _ = extract_spatial_fields(blocks, page_w, page_h)

            needs_remote = use_remote or (not local_doc_num)
            
            if needs_remote and ak_id and ak_secret and recognize_pdf_baidu:
                reason = "用户强制指定" if use_remote else "本地未能识别到标准号，自动回退"
                logger.info("触发远程百度云 OCR (%s)...", reason)
                # 使用相对较小的分辨率加快速度，高精度 OCR 通常足够强
                img = page.to_image(resolution=200).original
                import tempfile
                with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_img:
                    img.save(tmp_img, format="PNG")
                    tmp_img_path = tmp_img.name
                
                try:
                    remote_blocks = recognize_pdf_baidu(tmp_img_path, ak_id, ak_secret)
                    if remote_blocks:
                        blocks = []
                        full_text = ""
                        # Baidu doesn't give us page dimensions easily here, 
                        # so we use the image dimensions
                        img_w, img_h = img.size
                        page_w, page_h = img_w, img_h
                        for b in remote_blocks:
                            blocks.append(TextBlock(
                                text=b['text'], x0=b['x0'], top=b['top'], x1=b['x1'], bottom=b['bottom']
                            ))
                            full_text += b['text'] + "\n"
                        logger.info("百度云 OCR(含位置) 提取成功")
                except Exception as page_err:
                    logger.warning("百度云 OCR 处理失败: %s", page_err)
                finally:
                    if os.path.exists(tmp_img_path):
                        os.remove(tmp_img_path)

    except Exception as e:
        logger.error("PDF 打开失败 (%s): %s", pdf_path, e)
        result.error = f"PDF 文件解析失败: {str(e)}"
        return result.to_dict()

    result.extracted_text = full_text

    # 执行空间属性提取
    if blocks:
        n, name, p_date, e_date = extract_spatial_fields(blocks, float(page_w), float(page_h))
        result.document_number = n
        result.standard_name = name
        result.publish_date = p_date
        result.effective_date = e_date

    # 如果还是漏了日期，再使用传统的正则补救一下
    if not result.publish_date:
        match = re.search(r"(.{0,15})发布(?:日期)?\s*[:：]?\s*(.{0,15})", full_text)
        if match: result.publish_date = parse_date_flexible(match.group(1) + " " + match.group(2))
    if not result.effective_date:
        match = re.search(r"(.{0,15})实施(?:日期)?\s*[:：]?\s*(.{0,15})", full_text)
        if match: result.effective_date = parse_date_flexible(match.group(1) + " " + match.group(2))

    return result.to_dict()
