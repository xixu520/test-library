import logging
import base64
import json
import urllib.parse
from urllib import request, error

def get_access_token(api_key: str, secret_key: str) -> str:
    """
    使用 API Key 和 Secret Key 获取 Baidu OCR Access Token
    """
    host = f'https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id={api_key}&client_secret={secret_key}'
    try:
        req = request.Request(host)
        req.add_header('Content-Type', 'application/json')
        req.add_header('Accept', 'application/json')
        
        with request.urlopen(req, timeout=10) as response:
            result = response.read().decode('utf-8')
            res_json = json.loads(result)
            if 'access_token' in res_json:
                return res_json['access_token']
            else:
                logging.error(f"Failed to get Baidu Access Token: {res_json}")
                raise Exception(f"Failed to get Access Token: {res_json.get('error_description', 'Unknown error')}")
                
    except error.URLError as e:
        logging.error(f"Network error while getting Baidu Access Token: {e}")
        raise
    except Exception as e:
        logging.error(f"Error getting Baidu Access Token: {e}")
        raise

def recognize_pdf_baidu(image_path: str, api_key: str, secret_key: str) -> str:
    """
    调用百度通用文字识别（标准版）识别图片中的文字
    按照文档说明：
    POST https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=xxx
    Body: image=Base64编码且UrlEncode过的图片数据
    """
    try:
        # 1. 获取 Access Token
        access_token = get_access_token(api_key, secret_key)
        
        # 2. 读取图片并 Base64 编码
        with open(image_path, 'rb') as f:
            img_data = f.read()
            img_base64 = base64.b64encode(img_data).decode('utf-8')
            
        # 3. 构造请求参数 (URLEncode)
        params = urllib.parse.urlencode({'image': img_base64}).encode('utf-8')
        
        # 4. 发送请求
        request_url = f"https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token={access_token}"
        req = request.Request(request_url, data=params)
        req.add_header('Content-Type', 'application/x-www-form-urlencoded')
        
        with request.urlopen(req, timeout=15) as response:
            result_str = response.read().decode('utf-8')
            result_json = json.loads(result_str)
            
            if 'error_code' in result_json:
                raise Exception(f"Baidu OCR API Error: code={result_json['error_code']}, msg={result_json.get('error_msg')}")
                
            # 5. 拼接识别结果
            words_result = result_json.get('words_result', [])
            full_text = "\n".join([item.get('words', '') for item in words_result])
            return full_text
            
    except Exception as e:
        logging.error(f"Baidu OCR processing failed: {e}")
        raise
