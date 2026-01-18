# Watermark Removal Progress Polling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 1‑second polling progress for watermark removal + upload in the extension UI.

**Architecture:** Add async job support in the FastAPI service (`/clean/start` → job_id, `/clean/status` → progress). Extension starts a job and polls status every 1s; UI shows progress counts (remove watermark + upload). Keep existing `/clean` endpoint for compatibility.

**Tech Stack:** Chrome MV3 (content/background scripts), FastAPI, Pillow, requests, unittest.

---

### Task 1: Add job progress model + endpoints in service

**Files:**
- Modify: `service/app.py`
- Create: `service/tests/test_clean_progress.py`

**Step 1: Write failing tests for progress endpoints**

Create `service/tests/test_clean_progress.py` with a minimal job lifecycle test:

```python
import io
import tempfile
from pathlib import Path
from PIL import Image
from fastapi.testclient import TestClient

import service.app as app


def _write_png(path: Path):
    img = Image.new("RGBA", (64, 64), (255, 0, 0, 255))
    img.save(path, format="PNG")


def test_clean_start_and_status_progress():
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp)
        input_dir = base / "Gemini-Originals"
        output_dir = base / "Gemini-Clean"
        input_dir.mkdir(parents=True, exist_ok=True)
        _write_png(input_dir / "test.png")

        # Point the service to temp base dir
        app.BASE_DIR = base

        client = TestClient(app.app)
        resp = client.post("/clean/start", json={
            "input_subdir": "Gemini-Originals",
            "output_subdir": "Gemini-Clean",
            "delete_originals": False,
            "upload_enabled": False,
            "delete_cleaned": False
        })
        assert resp.status_code == 200
        job_id = resp.json()["job_id"]

        # Poll until done
        for _ in range(50):
            status = client.get("/clean/status", params={"job_id": job_id}).json()
            if status["done"]:
                assert status["total"] == 1
                assert status["success"] == 1
                assert status["failed"] == 0
                return

        assert False, "job did not finish in time"
```

**Step 2: Run test to verify it fails**

Run:
```bash
. .venv/bin/activate && python -m unittest service.tests.test_clean_progress -v
```
Expected: FAIL with 404 or missing endpoint/model.

**Step 3: Implement minimal job tracking + endpoints**

In `service/app.py`:
- Add a job store (`JOBS: dict`) and `threading.Lock`.
- Add Pydantic models:
  - `CleanStartResponse { job_id: str }`
  - `CleanStatusResponse { job_id, total, success, failed, upload_total, upload_success, upload_failed, done, error }`
- Add `/clean/start`:
  - Validate request (same as `/clean`).
  - Resolve input/output dirs.
  - Create job entry with counters and `done=False`.
  - Start a background thread to process files, updating counters.
  - Return `job_id`.
- Add `/clean/status`:
  - Return job data or 404 if missing.

Refactor the loop in `/clean` into a helper `run_clean_job(job_id, request, input_dir, output_dir)` that updates counters per file:
- `total` = number of image files detected at job start (list once).
- For each file:
  - update `processed` (or compute via success+failed)
  - update `success`/`failed`
  - if upload enabled: update `upload_total`, `upload_success`, `upload_failed`
- On exception: set `error`, `done=True`.

**Step 4: Re-run tests**

```bash
. .venv/bin/activate && python -m unittest service.tests.test_clean_progress -v
```
Expected: PASS.

**Step 5: Keep existing `/clean` compatibility**

- Implement `/clean` by calling the same helper synchronously and returning a final `CleanResponse`.

---

### Task 2: Background script start + poll APIs

**Files:**
- Modify: `background.js`

**Step 1: Add new background helpers**

Add:
- `startCleanJob()` → `POST ${serviceUrl}/clean/start`
- `getCleanStatus(job_id)` → `GET ${serviceUrl}/clean/status?job_id=...`

**Step 2: Extend message router**

Add runtime messages:
- `action: 'startClean'` → returns `{ ok, jobId }`
- `action: 'getCleanStatus'` → returns `{ ok, status }`

**Step 3: Auto-clean trigger**

When downloads complete and auto‑clean kicks in:
- call `startCleanJob('auto')`
- send `chrome.tabs.sendMessage` to active Gemini tab with `{ action: 'cleanJobStarted', jobId }`

---

### Task 3: Content UI polling and progress text

**Files:**
- Modify: `content.js`
- Modify: `i18n.js`
- Modify: `_locales/en/messages.json`
- Modify: `_locales/zh_CN/messages.json`

**Step 1: Add i18n strings for progress**

Example keys:
- `status_watermark_progress`: "Removing watermark: $DONE$/$TOTAL$, failed $FAILED$. Upload: $UPLOAD_DONE$/$UPLOAD_TOTAL$, failed $UPLOAD_FAILED$"
- `status_watermark_progress_no_upload`: "Removing watermark: $DONE$/$TOTAL$, failed $FAILED$"

Add Chinese equivalents.

**Step 2: Add polling logic in content script**

- On manual click:
  - send `startClean` message to background
  - store `currentJobId`
  - start `setInterval` every 1000ms to call `getCleanStatus`
- On `cleanJobStarted` message (auto):
  - start polling if panel exists

**Step 3: Update UI while polling**

- If `status.done` is false, show progress string (with upload totals if enabled).
- If `status.done` is true, show existing completion summary and clear interval.
- On error: show error and clear interval.

**Step 4: Manual test**

- Start Docker service
- Download 3+ images
- Verify progress updates every second for watermark removal and upload counts

---

### Task 4: README note (optional)

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`

Add one line in “Usage” or “Features” noting progress display for watermark removal/upload.

---

### Task 5: Run full tests

```bash
. .venv/bin/activate && python -m unittest discover -s service/tests -v
```
Expected: PASS.

---

Plan complete and saved to `docs/plans/2026-01-17-watermark-progress-polling.md`. Two execution options:

1. **Subagent-Driven (this session)** – I dispatch a fresh subagent per task, review between tasks
2. **Parallel Session (separate)** – Open a new session using executing-plans and run tasks with checkpoints

Which approach?
