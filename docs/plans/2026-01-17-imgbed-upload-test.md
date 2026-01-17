# ImgBed Upload Test Button Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a “Test Upload” button next to the ImgBed API field that uploads a built‑in third‑party public test image via the local service and shows success + returned URL in the status bar.

**Architecture:** The options page calls a new local FastAPI endpoint `/upload-test`, which uses a bundled test image and the existing uploader to send a multipart request to ImgBed. The extension shows upload status (success + URL or error) in the settings status bar. The test image is stored under `service/assets/` and its source is documented.

**Tech Stack:** Chrome MV3 (options/i18n), FastAPI, `requests`, Docker.

---

## Task 1: Add upload-test endpoint with tests (TDD)

**Files:**
- Create: `service/tests/test_upload_test_endpoint.py`
- Modify: `service/app.py`

**Step 1: Write failing tests**

Create `service/tests/test_upload_test_endpoint.py`:
```python
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
```

**Step 2: Run tests to verify RED**
```bash
python3 -m unittest service.tests.test_upload_test_endpoint -v
```
Expected: FAIL (endpoint missing / import error).

**Step 3: Implement endpoint**

In `service/app.py`:
- Import `upload_file` from `uploader`.
- Add constant:
  ```python
  TEST_IMAGE_PATH = Path(__file__).resolve().parent / "assets" / "test_upload.png"
  ```
- Add Pydantic model:
  ```python
  class UploadTestRequest(BaseModel):
      upload_url: str
  class UploadTestResponse(BaseModel):
      ok: bool
      url: str
  ```
- Add endpoint:
  ```python
  @app.post("/upload-test", response_model=UploadTestResponse)
  def upload_test(request: UploadTestRequest):
      if not request.upload_url.strip():
          raise HTTPException(status_code=400, detail="upload_url is required")
      if not TEST_IMAGE_PATH.exists():
          raise HTTPException(status_code=500, detail="test image missing")
      ok, result = upload_file(request.upload_url, str(TEST_IMAGE_PATH))
      if not ok:
          raise HTTPException(status_code=400, detail=str(result))
      return UploadTestResponse(ok=True, url=result)
  ```

**Step 4: Run tests to verify GREEN**
```bash
python3 -m unittest service.tests.test_upload_test_endpoint -v
```
Expected: PASS.

**Step 5: Commit**
```bash
git add service/app.py service/tests/test_upload_test_endpoint.py
git commit -m "feat: add upload-test endpoint"
```

---

## Task 2: Add public test image + credits

**Files:**
- Add: `service/assets/test_upload.png`
- Add: `service/assets/test_upload.CREDITS.md`

**Step 1: Download image**
Use a public/open-source third‑party image (e.g. OpenClipart), download to `service/assets/test_upload.png`.

**Step 2: Add credits**
Create `service/assets/test_upload.CREDITS.md` with source URL and license.

**Step 3: Commit**
```bash
git add service/assets/test_upload.png service/assets/test_upload.CREDITS.md
git commit -m "chore: add public test image for upload"
```

---

## Task 3: Options UI button + i18n + status

**Files:**
- Modify: `options.html`
- Modify: `options.css`
- Modify: `options.js`
- Modify: `i18n.js`
- Modify: `_locales/en/messages.json`
- Modify: `_locales/zh_CN/messages.json`

**Step 1: Add button next to label**
Wrap the label text with a new `label-row`:
```html
<div class="label-row">
  <span data-i18n="label_upload_api_url">ImgBed Upload API URL</span>
  <button id="uploadTestBtn" class="tertiary" type="button" data-i18n="btn_upload_test">Test Upload</button>
</div>
```

**Step 2: Add CSS**
```css
.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
button.tertiary {
  height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  background: #e8f0fe;
  color: #1a73e8;
  font-size: 12px;
}
```

**Step 3: Implement click handler**
In `options.js`, add:
```js
const testUpload = async () => {
  const serviceUrl = byId('serviceUrl').value.trim() || DEFAULTS.serviceUrl;
  const uploadUrl = byId('uploadApiUrl').value.trim();
  if (!uploadUrl) {
    setStatus(t('status_upload_test_missing'), 'error');
    return;
  }
  setStatus(t('status_upload_test_running'), 'info');
  try {
    const resp = await fetch(`${serviceUrl}/upload-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upload_url: uploadUrl })
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(text || `HTTP ${resp.status}`);
    }
    const data = await resp.json();
    setStatus(t('status_upload_test_ok', { url: data.url || '' }), 'success');
  } catch (error) {
    setStatus(t('status_upload_test_fail', { error }), 'error');
  }
};
```
Bind to `uploadTestBtn` click.

**Step 4: Add i18n keys**
Add keys for:
- `btn_upload_test`
- `status_upload_test_running`
- `status_upload_test_ok` (with `$URL$` placeholder)
- `status_upload_test_fail`
- `status_upload_test_missing`

**Step 5: Commit**
```bash
git add options.html options.css options.js i18n.js _locales/en/messages.json _locales/zh_CN/messages.json
git commit -m "feat: add ImgBed test upload button"
```

---

## Task 4: README mention + verification

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`

**Step 1: Add a short note**
Mention the new “Test Upload” button in Settings.

**Step 2: Run tests (if any)**
```bash
python3 -m unittest service.tests.test_upload_test_endpoint -v
```
Expected: PASS.

**Step 3: Commit**
```bash
git add README.md README.zh-CN.md
git commit -m "docs: mention test upload button"
```

---

## Notes / Assumptions
- Upload test uses the local Docker service to avoid CORS issues.
- The test image is a public third‑party image with attribution stored in `service/assets/test_upload.CREDITS.md`.

