# Gemini Clean Downloader + Local Docker Service - Design

## Goal
Deliver a smooth user flow by combining a Chrome MV3 extension for downloading Gemini originals with a local Docker service that removes visible watermarks and writes results to a user‑selected output folder.

## Architecture
The system has two components:
1) **Chrome extension**: intercepts Gemini download buttons, supports batch download, and triggers cleaning via localhost HTTP. Settings live in `options.html` and are stored via `chrome.storage.local`.
2) **Docker service**: FastAPI app that scans an input folder, removes the visible watermark using reverse alpha blending, and writes cleaned images to the output folder. It can optionally delete originals.

## Data Flow
- User downloads images from Gemini (single or batch).
- Extension uses `chrome.downloads.download` to store originals in `Downloads/Gemini-Originals/`.
- Background listens for download completion and triggers `POST /clean` on the local service (debounced).
- Service processes the directory, writes cleaned files to the configured output folder, and optionally deletes originals.

## Configuration
- Service URL: `http://127.0.0.1:17811` (default).
- Base directory: Docker volume `${HOME}/Downloads` mounted to `/data`.
- Input/output subdirectories are configurable in extension settings.
- Auto‑clean and delete‑originals toggles are exposed in settings.

## Error Handling
- Extension reports clean failures in the panel.
- Service returns HTTP 400 for invalid paths, or partial success counts.

## Testing
- Manual: verify single download triggers clean; batch download triggers one clean run; output directory receives cleaned files; delete‑originals works.
