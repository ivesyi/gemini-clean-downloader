import os
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image
from fastapi.testclient import TestClient

CURRENT_DIR = os.path.dirname(__file__)
SERVICE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if SERVICE_DIR not in sys.path:
    sys.path.insert(0, SERVICE_DIR)

import app as app_module


def write_png(path: Path):
    img = Image.new("RGBA", (128, 128), (255, 0, 0, 255))
    img.save(path, format="PNG")


class CleanProgressTests(unittest.TestCase):
    def test_clean_start_and_status_progress(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp).resolve()
            input_dir = base / "Gemini-Originals"
            output_dir = base / "Gemini-Clean"
            input_dir.mkdir(parents=True, exist_ok=True)
            output_dir.mkdir(parents=True, exist_ok=True)
            write_png(input_dir / "test.png")

            original_base = app_module.BASE_DIR
            try:
                app_module.BASE_DIR = base
                if app_module.ALPHA_48 is None or app_module.ALPHA_96 is None:
                    app_module.load_assets()

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

                for _ in range(50):
                    status_resp = client.get("/clean/status", params={"job_id": job_id})
                    self.assertEqual(status_resp.status_code, 200)
                    status = status_resp.json()
                    if status.get("done"):
                        self.assertEqual(status.get("total"), 1)
                        self.assertEqual(status.get("success"), 1)
                        self.assertEqual(status.get("failed"), 0)
                        return
                self.fail("job did not finish in time")
            finally:
                app_module.BASE_DIR = original_base


if __name__ == "__main__":
    unittest.main()
