#!/usr/bin/env python3
"""
PDF 文档管理系统 - 端到端 (E2E) 验证脚本
验证带有分类标签的文档全生命周期流转。

使用方式:
    python scripts/e2e_test.py [--base-url http://localhost:3000]
"""

import argparse
import json
import os
import sys
import time

try:
    import requests
except ImportError:
    print("请安装 requests: pip install requests")
    sys.exit(1)

# ─── 配置 ─────────────────────────────────────────────
DEFAULT_BASE_URL = "http://localhost:3000"
ADMIN_USER = {"username": "e2e_admin", "password": "TestAdmin123!", "role": "admin"}
VIEWER_USER = {"username": "e2e_viewer", "password": "TestViewer123!"}

# 测试用 PDF（最小有效 PDF 文件）
MINIMAL_PDF = (
    b"%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj "
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj "
    b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n"
    b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n"
    b"0000000058 00000 n \n0000000115 00000 n \n"
    b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF"
)


class E2ETestRunner:
    """端到端测试运行器。"""

    def __init__(self, base_url: str):
        self.api_url = f"{base_url}/api"
        self.session = requests.Session()
        self.passed = 0
        self.failed = 0
        self.admin_token = None
        self.viewer_token = None
        self.uploaded_doc_id = None

    def run_all(self):
        """运行全部测试。"""
        print("=" * 60)
        print("  PDF 文档管理系统 - E2E 测试")
        print("=" * 60)

        # 等待服务就绪
        self._wait_for_service()

        # 测试流程
        self._test_health_check()
        self._test_categories()
        self._test_register_admin()
        self._test_register_viewer()
        self._test_login_admin()
        self._test_login_viewer()
        self._test_upload_document()
        self._test_list_documents()
        self._test_search_documents()
        self._test_get_document_by_id()
        self._test_preview_pdf()
        self._test_update_metadata()
        self._test_soft_delete()
        self._test_recycle_bin()
        self._test_restore_document()
        self._test_unauthorized_access()

        # 结果汇总
        print("\n" + "=" * 60)
        total = self.passed + self.failed
        print(f"  测试结果: {self.passed}/{total} 通过")
        if self.failed > 0:
            print(f"  ❌ {self.failed} 个测试失败")
        else:
            print("  ✅ 全部测试通过！")
        print("=" * 60)

        return self.failed == 0

    def _wait_for_service(self, timeout=60):
        """等待 API 服务就绪。"""
        print("\n⏳ 等待服务就绪...")
        start = time.time()
        while time.time() - start < timeout:
            try:
                resp = requests.get(f"{self.api_url}/../health", timeout=3)
                if resp.status_code == 200:
                    print("  ✅ 服务已就绪\n")
                    return
            except requests.ConnectionError:
                pass
            time.sleep(2)
        print("  ⚠️  服务未在超时时间内就绪，继续尝试...")

    def _check(self, name: str, condition: bool, detail: str = ""):
        """断言检查。"""
        if condition:
            self.passed += 1
            print(f"  ✅ {name}")
        else:
            self.failed += 1
            msg = f"  ❌ {name}"
            if detail:
                msg += f" — {detail}"
            print(msg)

    # ─── 测试用例 ─────────────────────────────────────

    def _test_health_check(self):
        print("\n📋 健康检查")
        try:
            resp = requests.get(f"{self.api_url}/../health", timeout=5)
            self._check("GET /health 返回 200", resp.status_code == 200)
            data = resp.json()
            self._check("响应包含 status=ok", data.get("status") == "ok")
        except Exception as e:
            self._check("健康检查", False, str(e))

    def _test_categories(self):
        print("\n📋 分类数据")
        try:
            resp = requests.get(f"{self.api_url}/categories", timeout=5)
            self._check("GET /api/categories 返回 200", resp.status_code == 200)
            data = resp.json()
            self._check("包含 standard_types", len(data.get("standard_types", [])) > 0)
            self._check("包含 engineering_types", len(data.get("engineering_types", [])) > 0)
        except Exception as e:
            self._check("分类数据", False, str(e))

    def _test_register_admin(self):
        print("\n📋 注册管理员")
        try:
            resp = requests.post(f"{self.api_url}/auth/register", json=ADMIN_USER, timeout=5)
            # 可能已存在 (409) 或新创建 (201)
            self._check(
                "POST /api/auth/register 管理员",
                resp.status_code in (201, 409),
                f"status={resp.status_code}",
            )
        except Exception as e:
            self._check("注册管理员", False, str(e))

    def _test_register_viewer(self):
        print("\n📋 注册普通用户")
        try:
            resp = requests.post(f"{self.api_url}/auth/register", json=VIEWER_USER, timeout=5)
            self._check(
                "POST /api/auth/register 普通用户",
                resp.status_code in (201, 409),
                f"status={resp.status_code}",
            )
        except Exception as e:
            self._check("注册普通用户", False, str(e))

    def _test_login_admin(self):
        print("\n📋 管理员登录")
        try:
            resp = requests.post(
                f"{self.api_url}/auth/login",
                json={"username": ADMIN_USER["username"], "password": ADMIN_USER["password"]},
                timeout=5,
            )
            self._check("POST /api/auth/login 管理员返回 200", resp.status_code == 200)
            data = resp.json()
            self.admin_token = data.get("token")
            self._check("返回 JWT Token", self.admin_token is not None and len(self.admin_token) > 0)
            self._check("返回用户信息", data.get("user", {}).get("username") == ADMIN_USER["username"])
        except Exception as e:
            self._check("管理员登录", False, str(e))

    def _test_login_viewer(self):
        print("\n📋 普通用户登录")
        try:
            resp = requests.post(
                f"{self.api_url}/auth/login",
                json={"username": VIEWER_USER["username"], "password": VIEWER_USER["password"]},
                timeout=5,
            )
            self._check("POST /api/auth/login 普通用户返回 200", resp.status_code == 200)
            data = resp.json()
            self.viewer_token = data.get("token")
            self._check("返回 JWT Token", self.viewer_token is not None)
        except Exception as e:
            self._check("普通用户登录", False, str(e))

    def _test_upload_document(self):
        print("\n📋 上传文档（含分类标签）")
        if not self.admin_token:
            self._check("上传文档", False, "无管理员 Token，跳过")
            return
        try:
            files = {"file": ("test_standard.pdf", MINIMAL_PDF, "application/pdf")}
            data = {"standard_type": "国家标准", "engineering_type": "地基基础"}
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.post(
                f"{self.api_url}/documents/upload",
                files=files,
                data=data,
                headers=headers,
                timeout=15,
            )
            self._check("POST /api/documents/upload 返回 201", resp.status_code == 201)
            result = resp.json()
            doc = result.get("document", {})
            self.uploaded_doc_id = doc.get("id")
            self._check("返回文档 ID", self.uploaded_doc_id is not None)
            self._check("标准类型正确", doc.get("standard_type") == "国家标准")
            self._check("工程类型正确", doc.get("engineering_type") == "地基基础")
            self._check("OCR 状态为 processing", doc.get("ocr_status") == "processing")
        except Exception as e:
            self._check("上传文档", False, str(e))

    def _test_list_documents(self):
        print("\n📋 文档列表")
        if not self.admin_token:
            self._check("文档列表", False, "无 Token，跳过")
            return
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(
                f"{self.api_url}/documents",
                params={"standard_type": "国家标准", "page": 1, "page_size": 10},
                headers=headers,
                timeout=5,
            )
            self._check("GET /api/documents 返回 200", resp.status_code == 200)
            data = resp.json()
            self._check("total >= 1", data.get("total", 0) >= 1)
            self._check("documents 是列表", isinstance(data.get("documents"), list))
        except Exception as e:
            self._check("文档列表", False, str(e))

    def _test_search_documents(self):
        print("\n📋 文档搜索")
        if not self.admin_token:
            self._check("文档搜索", False, "无 Token，跳过")
            return
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(
                f"{self.api_url}/documents/search",
                params={"q": "test"},
                headers=headers,
                timeout=5,
            )
            self._check("GET /api/documents/search 返回 200", resp.status_code == 200)
        except Exception as e:
            self._check("文档搜索", False, str(e))

    def _test_get_document_by_id(self):
        print("\n📋 获取单个文档")
        if not self.admin_token or not self.uploaded_doc_id:
            self._check("获取单个文档", False, "无 Token 或文档 ID，跳过")
            return
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(
                f"{self.api_url}/documents/{self.uploaded_doc_id}",
                headers=headers,
                timeout=5,
            )
            self._check("GET /api/documents/:id 返回 200", resp.status_code == 200)
            data = resp.json()
            self._check("文档 ID 匹配", data.get("id") == self.uploaded_doc_id)
        except Exception as e:
            self._check("获取单个文档", False, str(e))

    def _test_preview_pdf(self):
        print("\n📋 PDF 预览（安全流式传输）")
        if not self.admin_token or not self.uploaded_doc_id:
            self._check("PDF 预览", False, "无 Token 或文档 ID，跳过")
            return
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(
                f"{self.api_url}/documents/{self.uploaded_doc_id}/preview",
                headers=headers,
                timeout=10,
            )
            self._check("GET /api/documents/:id/preview 返回 200", resp.status_code == 200)
            self._check(
                "Content-Type 为 application/pdf",
                "application/pdf" in resp.headers.get("Content-Type", ""),
            )
            self._check(
                "Content-Disposition 为 inline",
                "inline" in resp.headers.get("Content-Disposition", ""),
            )
            self._check(
                "Cache-Control 禁止缓存",
                "no-store" in resp.headers.get("Cache-Control", ""),
            )
        except Exception as e:
            self._check("PDF 预览", False, str(e))

    def _test_update_metadata(self):
        print("\n📋 管理员编辑文档元数据")
        if not self.admin_token or not self.uploaded_doc_id:
            self._check("编辑元数据", False, "无 Token 或文档 ID，跳过")
            return
        try:
            headers = {
                "Authorization": f"Bearer {self.admin_token}",
                "Content-Type": "application/json",
            }
            update_data = {
                "document_number": "GB/T 50001-2023",
                "publish_date": "2023-06-15",
                "effective_date": "2024-01-01",
                "standard_type": "国家标准",
                "engineering_type": "主体结构",
            }
            resp = requests.put(
                f"{self.api_url}/documents/{self.uploaded_doc_id}",
                json=update_data,
                headers=headers,
                timeout=5,
            )
            self._check("PUT /api/documents/:id 返回 200", resp.status_code == 200)
            data = resp.json()
            doc = data.get("document", {})
            self._check("标准号已更新", doc.get("document_number") == "GB/T 50001-2023")
            self._check("工程类型已更新", doc.get("engineering_type") == "主体结构")
        except Exception as e:
            self._check("编辑元数据", False, str(e))

    def _test_soft_delete(self):
        print("\n📋 软删除（移入回收站）")
        if not self.admin_token or not self.uploaded_doc_id:
            self._check("软删除", False, "无 Token 或文档 ID，跳过")
            return
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.delete(
                f"{self.api_url}/documents/{self.uploaded_doc_id}",
                headers=headers,
                timeout=5,
            )
            self._check("DELETE /api/documents/:id 返回 200", resp.status_code == 200)
        except Exception as e:
            self._check("软删除", False, str(e))

    def _test_recycle_bin(self):
        print("\n📋 回收站查看")
        if not self.admin_token:
            self._check("回收站", False, "无 Token，跳过")
            return
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.get(
                f"{self.api_url}/recycle-bin",
                headers=headers,
                timeout=5,
            )
            self._check("GET /api/recycle-bin 返回 200", resp.status_code == 200)
            data = resp.json()
            docs = data.get("documents", [])
            found = any(d.get("id") == self.uploaded_doc_id for d in docs)
            self._check("已删除文档在回收站中", found)
        except Exception as e:
            self._check("回收站", False, str(e))

    def _test_restore_document(self):
        print("\n📋 从回收站恢复")
        if not self.admin_token or not self.uploaded_doc_id:
            self._check("恢复文档", False, "无 Token 或文档 ID，跳过")
            return
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            resp = requests.post(
                f"{self.api_url}/recycle-bin/{self.uploaded_doc_id}/restore",
                headers=headers,
                timeout=5,
            )
            self._check("POST /api/recycle-bin/:id/restore 返回 200", resp.status_code == 200)

            # 验证恢复后可以正常获取
            resp2 = requests.get(
                f"{self.api_url}/documents/{self.uploaded_doc_id}",
                headers=headers,
                timeout=5,
            )
            self._check("恢复后可正常获取文档", resp2.status_code == 200)
        except Exception as e:
            self._check("恢复文档", False, str(e))

    def _test_unauthorized_access(self):
        print("\n📋 权限控制验证")
        try:
            # 无 Token 访问受保护路由
            resp = requests.get(f"{self.api_url}/documents", timeout=5)
            self._check("无 Token 访问文档列表返回 401", resp.status_code == 401)

            # 普通用户尝试删除
            if self.viewer_token and self.uploaded_doc_id:
                headers = {"Authorization": f"Bearer {self.viewer_token}"}
                resp = requests.delete(
                    f"{self.api_url}/documents/{self.uploaded_doc_id}",
                    headers=headers,
                    timeout=5,
                )
                self._check("普通用户删除返回 403", resp.status_code == 403)
        except Exception as e:
            self._check("权限控制", False, str(e))


def main():
    parser = argparse.ArgumentParser(description="PDF 文档管理系统 E2E 测试")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="服务基础 URL")
    args = parser.parse_args()

    runner = E2ETestRunner(args.base_url)
    success = runner.run_all()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
