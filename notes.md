# Notes: Gemini downloader + local Docker cleaning service

## Sources
- Existing extension code in this repo
- Previous watermark removal algorithm (reverse alpha blending)

## Synthesized Findings
- Extension must call a localhost service to avoid browser CORS limitations.
- Service can accept input directory and output directory; optionally delete originals.
