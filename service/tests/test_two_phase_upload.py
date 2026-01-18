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


def _touch(path: Path) -> None:
    path.write_bytes(b"test")


class TwoPhaseUploadTests(unittest.TestCase):
    def test_uploads_start_after_all_cleans(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp).resolve()
            input_dir = base / "Input"
            input_dir.mkdir(parents=True, exist_ok=True)

            _touch(input_dir / "a.png")
            _touch(input_dir / "b.png")

            events = []

            def fake_process_file(path: Path, output_dir: Path, delete_originals: bool):
                events.append(("clean", path.name))
                output_dir.mkdir(parents=True, exist_ok=True)
                out_path = output_dir / f"{path.stem}_clean.png"
                out_path.write_bytes(b"clean")
                return True, str(out_path)

            def fake_handle_upload(url, file_path, delete_cleaned):
                events.append(("upload", Path(file_path).name))
                return True, "ok", None

            original_base = app_module.BASE_DIR
            original_process = app_module.process_file
            original_upload = app_module.handle_upload
            try:
                app_module.BASE_DIR = base
                app_module.process_file = fake_process_file
                app_module.handle_upload = fake_handle_upload

                client = TestClient(app_module.app)
                payload = {
                    "input_subdir": "Input",
                    "output_subdir": "Output",
                    "upload_enabled": True,
                    "upload_url": "https://example.com/upload",
                    "delete_originals": False,
                    "delete_cleaned": False,
                }

                resp = client.post("/clean", json=payload)

                self.assertEqual(resp.status_code, 200)
                data = resp.json()
                self.assertEqual(data.get("total"), 2)
                self.assertEqual(data.get("success"), 2)
                self.assertEqual(data.get("upload_total"), 2)

                upload_index = next((i for i, e in enumerate(events) if e[0] == "upload"), None)
                self.assertIsNotNone(upload_index)
                self.assertTrue(all(e[0] == "clean" for e in events[:upload_index]))
                self.assertTrue(all(e[0] == "upload" for e in events[upload_index:]))
            finally:
                app_module.BASE_DIR = original_base
                app_module.process_file = original_process
                app_module.handle_upload = original_upload


if __name__ == "__main__":
    unittest.main()
