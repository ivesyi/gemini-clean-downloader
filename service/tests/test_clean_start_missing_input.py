import os
import sys
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

CURRENT_DIR = os.path.dirname(__file__)
SERVICE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SERVICE_DIR not in sys.path:
    sys.path.insert(0, SERVICE_DIR)

import app as app_module


class CleanStartMissingInputTests(unittest.TestCase):
    def test_clean_start_creates_missing_input_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp).resolve()
            input_dir = base / "Gemini-Originals"
            output_dir = base / "Gemini-Clean"
            output_dir.mkdir(parents=True, exist_ok=True)

            original_base = app_module.BASE_DIR
            try:
                app_module.BASE_DIR = base
                client = TestClient(app_module.app)
                resp = client.post(
                    "/clean/start",
                    json={
                        "input_subdir": "Gemini-Originals",
                        "output_subdir": "Gemini-Clean",
                        "delete_originals": False,
                        "upload_enabled": False,
                        "delete_cleaned": False,
                    },
                )
                self.assertEqual(resp.status_code, 200)
                job_id = resp.json().get("job_id")
                self.assertTrue(job_id)

                status_resp = client.get("/clean/status", params={"job_id": job_id})
                self.assertEqual(status_resp.status_code, 200)
                status = status_resp.json()
                self.assertTrue(status.get("done"))
                self.assertEqual(status.get("total"), 0)
                self.assertTrue(input_dir.exists())
            finally:
                app_module.BASE_DIR = original_base


if __name__ == "__main__":
    unittest.main()
