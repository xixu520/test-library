"""
标准信息核实模块。
通过爬取 http://f.csres.com/ 来核验文档的发布日期、实施日期和废止日期。
遵守防御性编程原则：请求异常不会中断主流程。
"""

import logging
import random
import time
from dataclasses import dataclass, field
from typing import Optional

import requests
from bs4 import BeautifulSoup

from .extractor import parse_date_flexible

logger = logging.getLogger(__name__)

# ─── 防封禁策略 ───────────────────────────────────────
USER_AGENTS: list[str] = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
]

VERIFY_BASE_URL: str = "http://f.csres.com/"


@dataclass
class VerificationResult:
    """核验结果的数据结构。"""

    status: str = "pending"  # matched | updated | failed
    message: str = ""
    publish_date: str = ""
    effective_date: str = ""
    abolish_date: str = ""

    def to_dict(self) -> dict:
        result: dict = {
            "status": self.status,
            "message": self.message,
        }
        if self.status == "updated":
            result["publish_date"] = self.publish_date
            result["effective_date"] = self.effective_date
            result["abolish_date"] = self.abolish_date
        return result


def verify_document(
    document_number: str,
    publish_date: str = "",
    effective_date: str = "",
    abolish_date: str = "",
) -> VerificationResult:
    """
    核验标准文档的日期信息。

    流程：
    1. 使用标准号在 f.csres.com 查询
    2. 如果查询成功且日期一致 → status="matched"
    3. 如果查询成功但日期不一致 → status="updated"，返回网站数据
    4. 如果查询失败 → status="failed"，保留原始数据

    Args:
        document_number: 标准号（如 GB/T 50001-2023）
        publish_date: OCR 识别出的发布日期
        effective_date: OCR 识别出的实施日期
        abolish_date: OCR 识别出的废止日期

    Returns:
        VerificationResult 核验结果
    """
    result = VerificationResult()

    if not document_number:
        result.status = "failed"
        result.message = "标准号为空，无法查询"
        return result

    try:
        # 添加随机延迟防止被封禁
        time.sleep(random.uniform(1.0, 3.0))

        session = requests.Session()
        session.headers.update({
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Referer": VERIFY_BASE_URL,
        })

        # 搜索标准
        search_url = VERIFY_BASE_URL
        search_params = {"q": document_number}

        response = session.get(
            search_url, params=search_params, timeout=15
        )
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # 尝试解析搜索结果页面
        web_dates = _parse_dates_from_page(soup, document_number)

        if web_dates is None:
            result.status = "failed"
            result.message = f"在 f.csres.com 未找到标准 [{document_number}] 的搜索结果"
            return result

        web_publish, web_effective, web_abolish = web_dates

        # 比对日期
        dates_match = True
        if web_publish and publish_date and web_publish != publish_date:
            dates_match = False
        if web_effective and effective_date and web_effective != effective_date:
            dates_match = False
        if web_abolish and abolish_date and web_abolish != abolish_date:
            dates_match = False

        if dates_match:
            result.status = "matched"
            result.message = "日期信息核验一致"
        else:
            result.status = "updated"
            result.message = "日期信息不一致，已使用网站数据覆盖"
            result.publish_date = web_publish or publish_date
            result.effective_date = web_effective or effective_date
            result.abolish_date = web_abolish or abolish_date

    except requests.Timeout:
        result.status = "failed"
        result.message = "查询超时: f.csres.com 响应超时"
        logger.error("核验超时: %s", document_number)

    except requests.RequestException as e:
        result.status = "failed"
        result.message = f"网络请求失败: {str(e)}"
        logger.error("核验网络错误 (%s): %s", document_number, e)

    except Exception as e:
        result.status = "failed"
        result.message = f"核验过程异常: {str(e)}"
        logger.error("核验异常 (%s): %s", document_number, e)

    return result


def _parse_dates_from_page(
    soup: BeautifulSoup, document_number: str
) -> Optional[tuple[str, str, str]]:
    """
    从 f.csres.com 的搜索结果页面中提取日期信息。

    Returns:
        (publish_date, effective_date, abolish_date) 的元组，日期为 YYYY-MM-DD 格式。
        如果未找到匹配结果，返回 None。
    """
    publish_date: str = ""
    effective_date: str = ""
    abolish_date: str = ""

    # 尝试在页面中查找包含标准号的结果行
    text_content = soup.get_text(separator="\n")

    # 检查页面中是否包含标准号
    if document_number.replace(" ", "") not in text_content.replace(" ", ""):
        return None

    # 尝试提取发布日期
    for label in ["发布日期", "发布时间", "发布"]:
        idx = text_content.find(label)
        if idx != -1:
            context = text_content[idx: idx + 40]
            parsed = parse_date_flexible(context)
            if parsed:
                publish_date = parsed
                break

    # 尝试提取实施日期
    for label in ["实施日期", "实施时间", "实施"]:
        idx = text_content.find(label)
        if idx != -1:
            context = text_content[idx: idx + 40]
            parsed = parse_date_flexible(context)
            if parsed:
                effective_date = parsed
                break

    # 尝试提取废止日期
    for label in ["废止日期", "废止时间", "废止"]:
        idx = text_content.find(label)
        if idx != -1:
            context = text_content[idx: idx + 40]
            parsed = parse_date_flexible(context)
            if parsed:
                abolish_date = parsed
                break

    return (publish_date, effective_date, abolish_date)
