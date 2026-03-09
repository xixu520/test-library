import sys
import io
import json
from alibabacloud_ocr_api20210707.client import Client as ocr_api20210707Client
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_ocr_api20210707 import models as ocr_api_20210707_models
from alibabacloud_tea_util import models as util_models

def test_stream():
    ak = "invalid_ak"
    sk = "invalid_sk"
    endpoint = "ocr-api.cn-hangzhou.aliyuncs.com"
    config = open_api_models.Config(access_key_id=ak, access_key_secret=sk, endpoint=endpoint)
    client = ocr_api20210707Client(config)

    buf = io.BytesIO(b"Hello World")
    request = ocr_api_20210707_models.RecognizeAdvancedRequest(body=buf)
    runtime = util_models.RuntimeOptions()

    try:
        client.recognize_advanced_with_options(request, runtime)
    except Exception as e:
        print(f"WITH io.BytesIO: {str(e)}")

    class ResettingBytesIO(io.BytesIO):
        def read(self, size=-1):
            res = super().read(size)
            if not res:
                self.seek(0)
            return res

    buf2 = ResettingBytesIO(b"Hello World")
    request2 = ocr_api_20210707_models.RecognizeAdvancedRequest(body=buf2)
    try:
        client.recognize_advanced_with_options(request2, runtime)
    except Exception as e:
        print(f"WITH ResettingBytesIO: {str(e)}")

if __name__ == "__main__":
    test_stream()
