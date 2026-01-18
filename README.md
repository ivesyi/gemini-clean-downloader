# Gemini Watermark Removal Downloader

[English] | [简体中文](README.zh-CN.md)

One-click download of Gemini original images with **local watermark removal** powered by a Docker service.

## Features
- Single download: intercepts Gemini's native Download button to save **originals**.
- Batch download: download all images in the current conversation.
- Auto remove watermark after downloads finish (or manual "Remove Watermark").
- Optional delete originals after watermark removal.
- Optional upload watermark‑removed images to CloudFlare ImgBed (MarSeventh/CloudFlare-ImgBed).
- Optional delete watermark‑removed files after upload.
- Watermark removal and upload progress shown in the panel (updates every 1s).
- Configurable Result folder (subdir under mounted base).
- UI language: Auto / English / 简体中文.

## How It Works
1. The **Chrome extension** downloads originals into an input folder.
2. The **local Docker service** removes visible watermarks and writes watermark‑removed images to the output folder.
3. If enabled, originals are deleted after watermark removal.

## Open‑source References
- [**gemini-watermark-remover**](https://github.com/journey-ad/gemini-watermark-remover) — watermark removal approach (reverse alpha blending).
- [**GemSaver**](https://github.com/brucevanfdm/GemSaver) — Gemini image download flow inspiration.

## Quick Start
1. Clone the repo:
   ```bash
   git clone git@github.com:ivesyi/gemini-clean-downloader.git
   cd gemini-clean-downloader
   ```
2. Start the local service:
   ```bash
   docker compose up -d
   ```
3. Load the extension:
   - Chrome → `chrome://extensions/`
   - Enable **Developer mode**
   - Click **Load unpacked** → select this folder (`gemini-clean-downloader`)
4. Open Gemini and configure settings in the panel → **Settings**.

## Usage
- **Single image**: click Gemini's built‑in Download button.
- **Batch**: panel → **Download All Originals**.
- If **Auto remove watermark** is ON, removal runs automatically.
- If OFF, click **Remove Watermark**.

## Settings
Available in the extension settings:
- **Service URL** (default `http://127.0.0.1:17811`)
- **Input folder** (default `Gemini-Originals`)
- **Result folder** (default `Gemini-Clean`)
- **Important:** The Docker mount root must match **Chrome’s default download directory**, because the extension can only download under Chrome’s default download path.
- **Delete originals after watermark removal**
- **Auto remove watermark after downloads finish**
- **Enable ImgBed upload**
- **Upload API URL (CloudFlare ImgBed)**, e.g. `https://cfbed.sanyue.de/upload?authCode=xxxx` (from MarSeventh/CloudFlare-ImgBed)
- **Delete watermark‑removed files after upload**
- **UI language**
- **Test Upload** button next to ImgBed API URL uploads a built‑in test image and shows the returned URL

## Docker Mount & Folders
`docker-compose.yml` mounts `${HOME}/Downloads` to `/data` inside the container.

Your input/output folders must be **subdirectories under that mount**:

```
${HOME}/Downloads/
  Gemini-Originals/   # input (default)
  Gemini-Clean/       # output (default)
```

## Local Service API
- `GET /health` → health check
- `POST /clean`
  ```json
  {
    "input_subdir": "Gemini-Originals",
    "output_subdir": "Gemini-Clean",
    "delete_originals": false,
    "upload_enabled": false,
    "upload_url": "https://cfbed.sanyue.de/upload?authCode=xxxx",
    "delete_cleaned": false
  }
  ```

## Troubleshooting
- **Test Connection** in Settings to verify service reachability.
- Ensure Docker is running: `docker compose ps`.
- Make sure input/output folders are under the mounted base directory.

## Limitations
This removes **visible watermarks only**. It does **not** remove invisible watermarks (e.g. SynthID).
Upload currently supports **CloudFlare ImgBed only** (https://github.com/MarSeventh/CloudFlare-ImgBed).
