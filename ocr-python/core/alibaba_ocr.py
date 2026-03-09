import os
import io
from alibabacloud_ocr_api20210707.client import Client as ocr_api20210707Client
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_ocr_api20210707 import models as ocr_api_20210707_models
from alibabacloud_tea_util import models as util_models

def create_client(access_key_id: str, access_key_secret: str, endpoint: str) -> ocr_api20210707Client:
    """用 AK/SK 与 Endpoint 初始化账号 Client"""
    config = open_api_models.Config(
        access_key_id=access_key_id,
        access_key_secret=access_key_secret
    )
    config.endpoint = endpoint
    return ocr_api20210707Client(config)

def recognize_pdf_alibaba(image_path: str, ak_id: str, ak_secret: str, endpoint: str) -> str:
    """
    调用阿里云通用 OCR 接口进行文字识别，返回合并后的文本。
    此处使用了 advanced OCR (RecognizeAdvanced)。
    """
    client = create_client(ak_id, ak_secret, endpoint)
    
    with open(image_path, 'rb') as f:
        file_bytes = f.read()

    request = ocr_api_20210707_models.RecognizeAdvancedRequest(
        body=file_bytes
    )
    
    runtime = util_models.RuntimeOptions()

    try:
        response = client.recognize_advanced_with_options(request, runtime)
        # 阿里云通用文字识别高精度版返回 JSON。 Data 字段内包含 content。
        # 不同的接口返回结构可能略有不同。若是 RecognizeAdvanced:
        # response.body.data 是包含 content 的 JSON 字符串
        
        if not response.body or not response.body.data:
            return ""
            
        import json
        data_dict = json.loads(response.body.data)
        
        # 尝试提取 "content" 字段，或者提取 prism_wordsInfo 中的文字
        if "content" in data_dict:
            return data_dict["content"]
        elif "prism_wordsInfo" in data_dict:
            words = []
            for word_info in data_dict["prism_wordsInfo"]:
                words.append(word_info.get("word", ""))
            return "\n".join(words)
            
        return ""

    except Exception as error:
        import logging
        logging.error(f"Alibaba OCR Error: {error}")
        raise error
