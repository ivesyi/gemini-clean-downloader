#!/usr/bin/env python3
"""Remove Gemini visible watermark from downloaded images.

Usage:
  python3 tools/clean_images.py --input ~/Downloads/Gemini-Originals --output ~/Downloads/Gemini-Clean
"""

import argparse
import os
from pathlib import Path
from PIL import Image

ALPHA_THRESHOLD = 0.002
MAX_ALPHA = 0.99
LOGO_VALUE = 255


def load_alpha_map(bg_path):
    img = Image.open(bg_path).convert("RGB")
    width, height = img.size
    data = list(img.getdata())
    alpha_map = [0.0] * (width * height)
    for i, (r, g, b) in enumerate(data):
        alpha_map[i] = max(r, g, b) / 255.0
    return alpha_map, width, height


def detect_config(width, height):
    if width > 1024 and height > 1024:
        return {"size": 96, "margin_right": 64, "margin_bottom": 64}
    return {"size": 48, "margin_right": 32, "margin_bottom": 32}


def remove_watermark(image, alpha_map, wm_size, pos_x, pos_y):
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


def process_file(path, output_dir, alpha_48, alpha_96):
    try:
        img = Image.open(path)
        img = img.convert("RGBA")
    except Exception as exc:
        return False, f"open failed: {exc}"

    width, height = img.size
    config = detect_config(width, height)
    wm_size = config["size"]
    pos_x = width - config["margin_right"] - wm_size
    pos_y = height - config["margin_bottom"] - wm_size

    if pos_x < 0 or pos_y < 0:
        return False, "image too small"

    alpha_map = alpha_96 if wm_size == 96 else alpha_48
    remove_watermark(img, alpha_map, wm_size, pos_x, pos_y)

    output_dir.mkdir(parents=True, exist_ok=True)
    out_name = path.stem + "_clean.png"
    out_path = output_dir / out_name
    try:
        img.save(out_path, format="PNG")
    except Exception as exc:
        return False, f"save failed: {exc}"

    return True, str(out_path)


def iter_images(input_dir):
    exts = {".png", ".jpg", ".jpeg", ".webp"}
    for entry in sorted(input_dir.iterdir()):
        if entry.is_file() and entry.suffix.lower() in exts:
            yield entry


def main():
    parser = argparse.ArgumentParser(description="Remove Gemini visible watermark from images")
    parser.add_argument("--input", required=True, help="Input directory containing downloaded images")
    parser.add_argument("--output", required=True, help="Output directory for cleaned images")
    args = parser.parse_args()

    input_dir = Path(os.path.expanduser(args.input)).resolve()
    output_dir = Path(os.path.expanduser(args.output)).resolve()

    if not input_dir.exists() or not input_dir.is_dir():
        raise SystemExit(f"Input directory not found: {input_dir}")

    base_dir = Path(__file__).resolve().parents[1]
    alpha_48, _, _ = load_alpha_map(base_dir / "assets" / "bg_48.png")
    alpha_96, _, _ = load_alpha_map(base_dir / "assets" / "bg_96.png")

    total = 0
    success = 0
    failures = 0

    for image_path in iter_images(input_dir):
        total += 1
        ok, info = process_file(image_path, output_dir, alpha_48, alpha_96)
        if ok:
            success += 1
            print(f"OK  {image_path.name} -> {info}")
        else:
            failures += 1
            print(f"FAIL {image_path.name}: {info}")

    print(f"Done. total={total} success={success} failed={failures}")


if __name__ == "__main__":
    main()
