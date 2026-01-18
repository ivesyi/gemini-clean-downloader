from urllib.parse import urlparse
import logging
import os
import time
import requests

DEFAULT_TIMEOUT = 60
DEFAULT_RETRIES = 1
LOGGER = logging.getLogger("uploader")


def build_full_url(api_url: str, src: str) -> str:
    if src.startswith("http://") or src.startswith("https://"):
        return src
    parsed = urlparse(api_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    if not src.startswith("/"):
        src = "/" + src
    return origin + src


def parse_upload_response(data):
    if isinstance(data, list) and data:
        return data[0].get("src")
    if isinstance(data, dict):
        inner = data.get("data")
        if isinstance(inner, list) and inner:
            return inner[0].get("src")
    return None


def upload_file(api_url: str, file_path: str, timeout: int = DEFAULT_TIMEOUT, retries: int = DEFAULT_RETRIES):
    last_error = None
    try:
        file_size = os.path.getsize(file_path)
    except Exception:
        file_size = None
    filename = os.path.basename(file_path)
    for attempt in range(retries + 1):
        try:
            start = time.monotonic()
            with open(file_path, "rb") as f:
                resp = requests.post(api_url, files={"file": f}, timeout=timeout)
            duration_ms = int((time.monotonic() - start) * 1000)
            LOGGER.info("upload attempt=%s ok duration_ms=%s size=%s file=%s", attempt + 1, duration_ms, file_size, filename)
            resp.raise_for_status()
            src = parse_upload_response(resp.json())
            if not src:
                return False, "missing src"
            return True, build_full_url(api_url, src)
        except requests.RequestException as exc:
            duration_ms = int((time.monotonic() - start) * 1000) if "start" in locals() else None
            LOGGER.info("upload attempt=%s failed duration_ms=%s size=%s file=%s error=%s", attempt + 1, duration_ms, file_size, filename, exc)
            last_error = exc
            if attempt >= retries:
                return False, str(exc)
        except Exception as exc:
            duration_ms = int((time.monotonic() - start) * 1000) if "start" in locals() else None
            LOGGER.info("upload attempt=%s failed duration_ms=%s size=%s file=%s error=%s", attempt + 1, duration_ms, file_size, filename, exc)
            last_error = exc
            if attempt >= retries:
                return False, str(exc)
    return False, str(last_error) if last_error else "unknown error"


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
