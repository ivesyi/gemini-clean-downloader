import os
import threading
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

from uploader import handle_upload, upload_file

ALPHA_THRESHOLD = 0.002
MAX_ALPHA = 0.99
LOGO_VALUE = 255

BASE_DIR = Path(os.environ.get("BASE_DIR", "/data")).resolve()
DEFAULT_INPUT = os.environ.get("DEFAULT_INPUT", "Gemini-Originals")
DEFAULT_OUTPUT = os.environ.get("DEFAULT_OUTPUT", "Gemini-Clean")
TEST_IMAGE_PATH = Path(__file__).resolve().parent / "assets" / "test_upload.png"

app = FastAPI(title="Gemini Clean Service", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CleanRequest(BaseModel):
    input_subdir: Optional[str] = None
    output_subdir: Optional[str] = None
    delete_originals: bool = False
    upload_enabled: bool = False
    upload_url: Optional[str] = None
    delete_cleaned: bool = False


class CleanResponse(BaseModel):
    total: int
    success: int
    failed: int
    output_dir: str
    upload_total: int = 0
    upload_success: int = 0
    upload_failed: int = 0
    uploaded_urls: list[str] = []


class CleanStartResponse(BaseModel):
    job_id: str


class CleanStatusResponse(BaseModel):
    job_id: str
    total: int
    success: int
    failed: int
    upload_total: int = 0
    upload_success: int = 0
    upload_failed: int = 0
    done: bool
    error: Optional[str] = None


class UploadTestRequest(BaseModel):
    upload_url: str


class UploadTestResponse(BaseModel):
    ok: bool
    url: str


ALPHA_48 = None
ALPHA_96 = None

JOBS: dict[str, dict] = {}
JOBS_LOCK = threading.Lock()


def load_alpha_map(bg_path: Path):
    img = Image.open(bg_path).convert("RGB")
    width, height = img.size
    data = list(img.getdata())
    alpha_map = [0.0] * (width * height)
    for i, (r, g, b) in enumerate(data):
        alpha_map[i] = max(r, g, b) / 255.0
    return alpha_map


def detect_config(width: int, height: int):
    if width > 1024 and height > 1024:
        return {"size": 96, "margin_right": 64, "margin_bottom": 64}
    return {"size": 48, "margin_right": 32, "margin_bottom": 32}


def remove_watermark(image: Image.Image, alpha_map, wm_size, pos_x, pos_y):
    pixels = image.load()
    width, height = image.size

    for row in range(wm_size):
        for col in range(wm_size):
            x = pos_x + col
            y = pos_y + row
            if x < 0 or y < 0 or x >= width or y >= height:
                continue

            alpha = alpha_map[row * wm_size + col]
            if alpha < ALPHA_THRESHOLD:
                continue

            alpha = min(alpha, MAX_ALPHA)
            one_minus = 1.0 - alpha
            r, g, b, a = pixels[x, y]
            r = int(max(0, min(255, round((r - alpha * LOGO_VALUE) / one_minus))))
            g = int(max(0, min(255, round((g - alpha * LOGO_VALUE) / one_minus))))
            b = int(max(0, min(255, round((b - alpha * LOGO_VALUE) / one_minus))))
            pixels[x, y] = (r, g, b, a)

    return image


def resolve_subdir(subdir: str) -> Path:
    if subdir.startswith("/"):
        raise HTTPException(status_code=400, detail="Absolute paths are not allowed")
    candidate = (BASE_DIR / subdir).resolve()
    if BASE_DIR not in candidate.parents and candidate != BASE_DIR:
        raise HTTPException(status_code=400, detail="Path escapes base directory")
    return candidate


def iter_images(input_dir: Path):
    exts = {".png", ".jpg", ".jpeg", ".webp"}
    for entry in sorted(input_dir.iterdir()):
        if entry.is_file() and entry.suffix.lower() in exts:
            yield entry


def ensure_input_dir(input_dir: Path):
    if input_dir.exists():
        if not input_dir.is_dir():
            raise HTTPException(status_code=400, detail=f"Input path is not a directory: {input_dir}")
        return
    input_dir.mkdir(parents=True, exist_ok=True)


def process_file(path: Path, output_dir: Path, delete_originals: bool):
    try:
        img = Image.open(path).convert("RGBA")
    except Exception as exc:
        return False, f"open failed: {exc}"

    width, height = img.size
    config = detect_config(width, height)
    wm_size = config["size"]
    pos_x = width - config["margin_right"] - wm_size
    pos_y = height - config["margin_bottom"] - wm_size

    if pos_x < 0 or pos_y < 0:
        return False, "image too small"

    alpha_map = ALPHA_96 if wm_size == 96 else ALPHA_48
    remove_watermark(img, alpha_map, wm_size, pos_x, pos_y)

    output_dir.mkdir(parents=True, exist_ok=True)
    out_name = path.stem + "_clean.png"
    out_path = output_dir / out_name

    try:
        img.save(out_path, format="PNG")
    except Exception as exc:
        return False, f"save failed: {exc}"

    if delete_originals:
        try:
            path.unlink()
        except Exception:
            pass

    return True, str(out_path)


def init_job(job_id: str, total: int):
    with JOBS_LOCK:
        JOBS[job_id] = {
            "job_id": job_id,
            "total": total,
            "success": 0,
            "failed": 0,
            "upload_total": 0,
            "upload_success": 0,
            "upload_failed": 0,
            "done": False,
            "error": None,
        }


def update_job(job_id: str, **updates):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return
        job.update(updates)


def get_job(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return None
        return dict(job)


def run_clean_loop(images, output_dir: Path, request: CleanRequest, job_id: Optional[str] = None):
    total = len(images)
    success = 0
    failed = 0
    upload_total = 0
    upload_success = 0
    upload_failed = 0
    uploaded_urls: list[str] = []
    cleaned_paths: list[str] = []

    for image_path in images:
        ok, result = process_file(image_path, output_dir, request.delete_originals)
        if ok:
            success += 1
            cleaned_paths.append(result)
        else:
            failed += 1

        if job_id:
            update_job(
                job_id,
                success=success,
                failed=failed,
                upload_total=upload_total,
                upload_success=upload_success,
                upload_failed=upload_failed,
            )

    if request.upload_enabled and request.upload_url and cleaned_paths:
        upload_total = len(cleaned_paths)
        if job_id:
            update_job(job_id, upload_total=upload_total)

        for cleaned_path in cleaned_paths:
            upload_ok, upload_result, _ = handle_upload(
                request.upload_url,
                cleaned_path,
                request.delete_cleaned,
            )
            if upload_ok:
                upload_success += 1
                uploaded_urls.append(upload_result)
            else:
                upload_failed += 1

            if job_id:
                update_job(
                    job_id,
                    upload_total=upload_total,
                    upload_success=upload_success,
                    upload_failed=upload_failed,
                )

    return {
        "total": total,
        "success": success,
        "failed": failed,
        "upload_total": upload_total,
        "upload_success": upload_success,
        "upload_failed": upload_failed,
        "uploaded_urls": uploaded_urls,
    }


def run_clean_job(job_id: str, images, output_dir: Path, request: CleanRequest):
    try:
        result = run_clean_loop(images, output_dir, request, job_id=job_id)
        update_job(
            job_id,
            success=result["success"],
            failed=result["failed"],
            upload_total=result["upload_total"],
            upload_success=result["upload_success"],
            upload_failed=result["upload_failed"],
            done=True,
        )
    except Exception as exc:
        update_job(job_id, error=str(exc), done=True)


@app.on_event("startup")
def load_assets():
    global ALPHA_48, ALPHA_96
    assets_dir = Path(__file__).resolve().parent / "assets"
    ALPHA_48 = load_alpha_map(assets_dir / "bg_48.png")
    ALPHA_96 = load_alpha_map(assets_dir / "bg_96.png")


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/clean", response_model=CleanResponse)
def clean_images(request: CleanRequest):
    input_subdir = request.input_subdir or DEFAULT_INPUT
    output_subdir = request.output_subdir or DEFAULT_OUTPUT
    if request.upload_enabled and not request.upload_url:
        raise HTTPException(status_code=400, detail="upload_url is required when upload is enabled")

    input_dir = resolve_subdir(input_subdir)
    output_dir = resolve_subdir(output_subdir)

    ensure_input_dir(input_dir)

    images = list(iter_images(input_dir))
    result = run_clean_loop(images, output_dir, request)

    return CleanResponse(
        total=result["total"],
        success=result["success"],
        failed=result["failed"],
        output_dir=str(output_dir),
        upload_total=result["upload_total"],
        upload_success=result["upload_success"],
        upload_failed=result["upload_failed"],
        uploaded_urls=result["uploaded_urls"],
    )


@app.post("/clean/start", response_model=CleanStartResponse)
def clean_start(request: CleanRequest):
    input_subdir = request.input_subdir or DEFAULT_INPUT
    output_subdir = request.output_subdir or DEFAULT_OUTPUT
    if request.upload_enabled and not request.upload_url:
        raise HTTPException(status_code=400, detail="upload_url is required when upload is enabled")

    input_dir = resolve_subdir(input_subdir)
    output_dir = resolve_subdir(output_subdir)

    ensure_input_dir(input_dir)

    images = list(iter_images(input_dir))
    job_id = uuid.uuid4().hex
    init_job(job_id, len(images))

    if not images:
        update_job(job_id, done=True)
        return CleanStartResponse(job_id=job_id)

    thread = threading.Thread(
        target=run_clean_job,
        args=(job_id, images, output_dir, request),
        daemon=True,
    )
    thread.start()
    return CleanStartResponse(job_id=job_id)


@app.get("/clean/status", response_model=CleanStatusResponse)
def clean_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return CleanStatusResponse(
        job_id=job["job_id"],
        total=job["total"],
        success=job["success"],
        failed=job["failed"],
        upload_total=job["upload_total"],
        upload_success=job["upload_success"],
        upload_failed=job["upload_failed"],
        done=job["done"],
        error=job["error"],
    )


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
