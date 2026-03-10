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

def recognize_pdf_baidu(image_path: str, api_key: str, secret_key: str) -> list[dict]:
    """
    调用百度通用文字识别（高精度含位置版）识别图片中的文字坐标
    POST https://aip.baidubce.com/rest/2.0/ocr/v1/accurate?access_token=xxx
    """
    try:
        access_token = get_access_token(api_key, secret_key)
        
        with open(image_path, 'rb') as f:
            img_data = f.read()
            img_base64 = base64.b64encode(img_data).decode('utf-8')
            
        params = urllib.parse.urlencode({'image': img_base64}).encode('utf-8')
        
        request_url = f"https://aip.baidubce.com/rest/2.0/ocr/v1/accurate?access_token={access_token}"
        req = request.Request(request_url, data=params)
        req.add_header('Content-Type', 'application/x-www-form-urlencoded')
        
        with request.urlopen(req, timeout=15) as response:
            result_str = response.read().decode('utf-8')
            result_json = json.loads(result_str)
            
            if 'error_code' in result_json:
                raise Exception(f"Baidu OCR API Error: code={result_json['error_code']}, msg={result_json.get('error_msg')}")
                
            blocks = []
            words_result = result_json.get('words_result', [])
            for item in words_result:
                text = item.get('words', '')
                loc = item.get('location', {})
                # Normalize Baidu's location (left, top, width, height) to bounding box
                if text and loc:
                    blocks.append({
                        'text': text,
                        'x0': loc.get('left', 0),
                        'top': loc.get('top', 0),
                        'x1': loc.get('left', 0) + loc.get('width', 0),
                        'bottom': loc.get('top', 0) + loc.get('height', 0)
                    })
            
            return blocks
            
    except Exception as e:
        logging.error(f"Baidu OCR processing failed: {e}")
        raise
