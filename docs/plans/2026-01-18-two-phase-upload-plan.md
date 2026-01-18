# Two-Phase Clean-Then-Upload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan.

**Goal:** Ensure the backend finishes watermark removal for all images before starting any uploads, while preserving progress reporting.

**Architecture:** Split cleaning into two phases in `run_clean_loop`: (1) clean all images and collect successful output paths, (2) upload all successful outputs. Update job counters after each step to keep UI progress accurate.

**Tech Stack:** FastAPI (Python), requests, Chrome extension content/background scripts.

---

### Task 1: Add failing tests for two-phase behavior

**Files:**
- Modify: `service/tests/test_clean_start_missing_input.py`
- Create: `service/tests/test_two_phase_upload.py`

**Step 1: Write the failing test**

```python
import io
from pathlib import Path
from unittest import mock

import pytest
from fastapi.testclient import TestClient
from PIL import Image

import app


def _make_png(path: Path):
    img = Image.new("RGBA", (256, 256), (255, 255, 255, 255))
    img.save(path, format="PNG")


def test_two_phase_upload_order(tmp_path, monkeypatch):
    # Arrange: fake base dir
    base = tmp_path / "base"
    base.mkdir()
    monkeypatch.setattr(app, "BASE_DIR", base)

    input_dir = base / "Input"
    output_dir = base / "Output"
    input_dir.mkdir()

    _make_png(input_dir / "a.png")
    _make_png(input_dir / "b.png")

    # Track upload calls
    uploaded = []
    def fake_upload(url, file_path, delete_cleaned):
        uploaded.append(file_path)
        return True, "ok", None

    monkeypatch.setattr(app, "handle_upload", fake_upload)

    client = TestClient(app.app)
    payload = {
        "input_subdir": "Input",
        "output_subdir": "Output",
        "upload_enabled": True,
        "upload_url": "https://example.com/upload",
        "delete_originals": False,
        "delete_cleaned": False
    }

    # Act
    resp = client.post("/clean", json=payload)

    # Assert
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert data["success"] == 2
    # Two-phase: uploads should be called for BOTH outputs
    assert len(uploaded) == 2
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest service/tests/test_two_phase_upload.py -q`
Expected: FAIL because current code uploads inline and test will be flaky when upload called before all cleaned (we’ll enforce via logic in next step).

---

### Task 2: Implement two-phase clean/upload

**Files:**
- Modify: `service/app.py`

**Step 1: Implement minimal code change**

Refactor `run_clean_loop` to:
- Clean all images first, storing successful output paths in `cleaned_paths`.
- Only after cleaning finishes, run uploads if enabled.
- Update `upload_total` once before uploads start.
- Update job counters during both phases.

**Step 2: Run tests**

Run: `python -m pytest service/tests/test_two_phase_upload.py -q`
Expected: PASS

Run: `python -m pytest service/tests -q`
Expected: PASS

**Step 3: Commit**

```bash
git add service/app.py service/tests/test_two_phase_upload.py
git commit -m "feat: upload only after all images are cleaned"
```

---

### Task 3: Update UI messaging (optional)

**Files:**
- Modify: `content.js`
- Modify: `_locales/en/messages.json`
- Modify: `_locales/zh_CN/messages.json`

**Step 1: (Optional) Add a status line for upload phase if upload_total > 0**

Keep existing status text but ensure it doesn’t imply uploads start before cleaning is done. Use the same progress values already emitted by the backend.

**Step 2: Test manually**

- Trigger batch download
- Verify “去水印: x/total” completes first
- Then upload numbers increment

**Step 3: Commit**

```bash
git add content.js _locales/en/messages.json _locales/zh_CN/messages.json
git commit -m "chore: clarify upload starts after cleaning"
```

---

Plan complete and saved to `docs/plans/2026-01-18-two-phase-upload-plan.md`. Two execution options:

1. Subagent-Driven (this session) — use superpowers:subagent-driven-development
2. Parallel Session (separate) — open new session with superpowers:executing-plans

Which approach?
