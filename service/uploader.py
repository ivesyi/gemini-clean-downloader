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


def parse_upload_response(data):
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
