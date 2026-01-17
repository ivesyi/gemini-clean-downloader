# CloudFlare ImgBed Upload Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add optional CloudFlare ImgBed upload for cleaned images, with settings to specify upload API URL and optionally delete cleaned files after successful upload.

**Architecture:** The extension stores upload settings in `chrome.storage.local`. The background service passes upload config to the local FastAPI `/clean` endpoint. The service cleans images, optionally uploads each cleaned file to ImgBed via multipart POST, returns upload counts/URLs, and optionally deletes cleaned files after successful upload.

**Tech Stack:** Chrome MV3 (content/background/options/i18n), FastAPI, Pillow, Docker, `requests` (new dependency).

---

## Task 1: Add uploader utility with unit tests

**Files:**
- Create: `service/uploader.py`
- Create: `service/tests/test_uploader.py`
- Modify: `service/requirements.txt`

**Step 1: Write the failing tests**

Create `service/tests/test_uploader.py` with `unittest` tests for:
- `build_full_url(api_url, src)` when `src` is relative (prefix with origin)
- `build_full_url(api_url, src)` when `src` is already absolute (leave as-is)
- `parse_upload_response(json_obj)` handles list `[{'src': '/file/xxx'}]` and dict `{'data': [{'src': '/file/xxx'}]}`
- `upload_file(api_url, file_path)` returns `(True, full_url)` when response contains `src`

```python
import io
import json
import tempfile
import unittest
from unittest.mock import patch

from uploader import build_full_url, parse_upload_response, upload_file

class DummyResp:
    def __init__(self, data, status=200):
        self._data = data
        self.status_code = status
    def raise_for_status(self):
        if self.status_code >= 400:
            raise Exception("HTTP %s" % self.status_code)
    def json(self):
        return self._data

class UploaderTests(unittest.TestCase):
    def test_build_full_url_relative(self):
        api_url = "https://cfbed.sanyue.de/upload?authCode=abc"
        self.assertEqual(build_full_url(api_url, "/file/abc.jpg"), "https://cfbed.sanyue.de/file/abc.jpg")

    def test_build_full_url_absolute(self):
        api_url = "https://cfbed.sanyue.de/upload?authCode=abc"
        self.assertEqual(build_full_url(api_url, "https://cdn.test/img.png"), "https://cdn.test/img.png")

    def test_parse_upload_response_list(self):
        self.assertEqual(parse_upload_response([{ "src": "/file/abc.jpg" }]), "/file/abc.jpg")

    def test_parse_upload_response_dict(self):
        self.assertEqual(parse_upload_response({"data": [{ "src": "/file/abc.jpg" }]}), "/file/abc.jpg")

    @patch("uploader.requests.post")
    def test_upload_file(self, post):
        post.return_value = DummyResp([{ "src": "/file/abc.jpg" }])
        with tempfile.NamedTemporaryFile(suffix=".png") as f:
            ok, url = upload_file("https://cfbed.sanyue.de/upload?authCode=abc", f.name)
        self.assertTrue(ok)
        self.assertEqual(url, "https://cfbed.sanyue.de/file/abc.jpg")

if __name__ == "__main__":
    unittest.main()
```

**Step 2: Run test to verify it fails**

Run:
```bash
python -m unittest service/tests/test_uploader.py -v
```
Expected: FAIL (module `uploader` not found).

**Step 3: Write minimal implementation**

Create `service/uploader.py`:
```python
from urllib.parse import urlparse
import requests


def build_full_url(api_url: str, src: str) -> str:
    if src.startswith("http://") or src.startswith("https://"):
        return src
    parsed = urlparse(api_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    if not src.startswith("/"):
        src = "/" + src
    return origin + src


def parse_upload_response(data) -> str:
    if isinstance(data, list) and data:
        return data[0].get("src")
    if isinstance(data, dict):
        inner = data.get("data")
        if isinstance(inner, list) and inner:
            return inner[0].get("src")
    return None


def upload_file(api_url: str, file_path: str, timeout: int = 30):
    with open(file_path, "rb") as f:
        resp = requests.post(api_url, files={"file": f}, timeout=timeout)
    resp.raise_for_status()
    src = parse_upload_response(resp.json())
    if not src:
        return False, "missing src"
    return True, build_full_url(api_url, src)
```

**Step 4: Update requirements**

Add to `service/requirements.txt`:
```
requests==2.32.3
```

**Step 5: Run tests**

```bash
python -m unittest service/tests/test_uploader.py -v
```
Expected: PASS.

**Step 6: Commit**

```bash
git add service/uploader.py service/tests/test_uploader.py service/requirements.txt
git commit -m "feat: add ImgBed uploader utility"
```

---

## Task 2: Integrate upload into FastAPI clean flow

**Files:**
- Modify: `service/app.py`
- Modify: `service/requirements.txt`
- Test: `service/tests/test_uploader.py`

**Step 1: Write failing test for upload+delete behavior**

Extend `service/tests/test_uploader.py` with a small integration-style test by mocking `upload_file` and creating a temp cleaned file, then calling a new helper `handle_upload(...)` to ensure deletion happens only on success:

```python
from uploader import handle_upload

@patch("uploader.upload_file")
def test_handle_upload_deletes_on_success(self, upload_file):
    upload_file.return_value = (True, "https://cfbed.sanyue.de/file/abc.jpg")
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        path = f.name
    ok, url, deleted = handle_upload("https://cfbed.sanyue.de/upload?authCode=abc", path, delete_after=True)
    self.assertTrue(ok)
    self.assertTrue(deleted)
```

**Step 2: Run tests (should fail)**

```bash
python -m unittest service/tests/test_uploader.py -v
```
Expected: FAIL (handle_upload not found).

**Step 3: Implement upload integration helpers**

Update `service/uploader.py` with:
```python
import os

def handle_upload(api_url: str, file_path: str, delete_after: bool):
    ok, result = upload_file(api_url, file_path)
    deleted = False
    if ok and delete_after:
        try:
            os.remove(file_path)
            deleted = True
        except Exception:
            deleted = False
    return ok, result, deleted
```

**Step 4: Update FastAPI request/response**

In `service/app.py`:
- Extend `CleanRequest` with:
  - `upload_enabled: bool = False`
  - `upload_url: Optional[str] = None`
  - `delete_cleaned: bool = False`
- Extend `CleanResponse` with:
  - `upload_total: int = 0`
  - `upload_success: int = 0`
  - `upload_failed: int = 0`
  - `uploaded_urls: list[str] = []`

**Step 5: Use uploader in `clean_images`**

After saving each cleaned file:
- If `upload_enabled` and `upload_url`:
  - call `handle_upload(upload_url, out_path, delete_cleaned)`
  - increment `upload_total/success/failed`
  - append URL on success

Deletion rule: delete cleaned file **only after upload succeeds**.

**Step 6: Run tests**

```bash
python -m unittest service/tests/test_uploader.py -v
```
Expected: PASS.

**Step 7: Commit**

```bash
git add service/app.py service/uploader.py service/tests/test_uploader.py
git commit -m "feat: upload cleaned images to ImgBed"
```

---

## Task 3: Add upload settings to extension + i18n

**Files:**
- Modify: `background.js`
- Modify: `options.html`
- Modify: `options.js`
- Modify: `options.css`
- Modify: `i18n.js`
- Modify: `_locales/en/messages.json`
- Modify: `_locales/zh_CN/messages.json`
- Modify: `content.js`
- Modify: `README.md`, `README.zh-CN.md`

**Step 1: Add new settings defaults**

In `background.js` and `options.js` defaults add:
- `uploadEnabled: false`
- `uploadApiUrl: ''`
- `deleteCleanedAfterUpload: false`

**Step 2: Update options UI**

In `options.html`, add a new section or labels:
- Checkbox: **Enable ImgBed upload**
- Input: **Upload API URL** (e.g., `https://cfbed.sanyue.de/upload?authCode=xxx&returnFormat=full`)
- Checkbox: **Delete cleaned files after upload**

Add matching i18n keys in `i18n.js` and `_locales` for English + Chinese.

**Step 3: Persist settings**

In `options.js`:
- Load/save new settings
- Ensure values default properly

**Step 4: Send upload config to service**

In `background.js` `runClean()` body add:
```js
upload_enabled: settings.uploadEnabled,
upload_url: settings.uploadApiUrl,
delete_cleaned: settings.deleteCleanedAfterUpload
```

**Step 5: Display upload result (optional)**

In `content.js`, when showing clean result:
- If response includes `upload_total`, use a new i18n key like:
  - `status_clean_upload_result`: "Cleaned: $SUCCESS$ ok, $FAILED$ failed. Uploaded: $UPLOAD_SUCCESS$ ok, $UPLOAD_FAILED$ failed"

**Step 6: Update README**

Add upload settings to both READMEs and mention ImgBed support only.

**Step 7: Manual verification**

Checklist:
- Start Docker service
- Set Upload API URL (with `authCode` or `apiToken`, and `returnFormat=full` if desired)
- Download 1 image → auto clean + upload
- Verify returned URLs in response (or service logs)
- Toggle delete cleaned files and confirm local files are removed only after successful upload

**Step 8: Commit**

```bash
git add background.js options.html options.js options.css i18n.js _locales/en/messages.json _locales/zh_CN/messages.json content.js README.md README.zh-CN.md
git commit -m "feat: add ImgBed upload settings"
```

---

## Task 4: Update Docker + verify end-to-end

**Files:**
- Modify: `Dockerfile` (if needed)
- Verify: `docker-compose.yml`

**Step 1: Rebuild and run**

```bash
docker compose up -d --build
```

**Step 2: Smoke test**

- Upload a cleaned image with ImgBed upload enabled
- Confirm API receives multipart
- Confirm local cleaned file deletion toggles behave

**Step 3: Commit (if any Docker changes)**

```bash
git add Dockerfile docker-compose.yml
git commit -m "chore: rebuild ImgBed upload support"
```

---

## Notes / Assumptions
- The user provides a **full ImgBed upload API URL** (including `authCode` or `apiToken`) in settings.
- If ImgBed returns `src` without host, the service prefixes it with the API URL origin.
- `delete_cleaned` deletes only after **successful upload** to avoid data loss.

## References
- CloudFlare ImgBed Upload API: https://cfbed.sanyue.de/api/upload.html
