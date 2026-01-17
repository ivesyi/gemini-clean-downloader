# Notes: Gemini downloader + local Docker cleaning service

## Sources
- Existing extension code in this repo
- Previous watermark removal algorithm (reverse alpha blending)

## Synthesized Findings
- Extension must call a localhost service to avoid browser CORS limitations.
- Service accepts input/output subdirectories under a mounted base and optional delete-originals flag.
- UI should support auto language plus manual override via settings.
