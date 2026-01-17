import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

CURRENT_DIR = os.path.dirname(__file__)
SERVICE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SERVICE_DIR not in sys.path:
    sys.path.insert(0, SERVICE_DIR)

from fastapi.testclient import TestClient
import app as app_module


class UploadTestEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app_module.app)

    def test_upload_test_requires_url(self):
        resp = self.client.post("/upload-test", json={"upload_url": ""})
        self.assertEqual(resp.status_code, 400)

    @patch("app.upload_file")
    def test_upload_test_success_returns_url(self, upload_file_mock):
        upload_file_mock.return_value = (True, "https://cfbed.sanyue.de/file/abc.png")
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            tmp_path = f.name
        try:
            app_module.TEST_IMAGE_PATH = Path(tmp_path)
            resp = self.client.post(
                "/upload-test",
                json={"upload_url": "https://cfbed.sanyue.de/upload?authCode=abc"},
            )
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json().get("url"), "https://cfbed.sanyue.de/file/abc.png")
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)


if __name__ == "__main__":
    unittest.main()
