# Gemini Originals Downloader (Two-Step Workflow)

This extension downloads **original Gemini images** in bulk. Use the bundled script to remove visible watermarks **offline**.

## Step 1: Install Extension (Load Unpacked)
1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `gemini-clean-downloader-ext`

## Step 2: Download Originals
- Go to `https://gemini.google.com/`
- **Single image**: click Gemini's native Download button (extension intercepts and downloads original)
- **Batch**: click the floating button (bottom-right) → “Download All Originals”

Files are saved to: `Downloads/Gemini-Originals/`

## Step 3: Remove Watermarks Offline
Install Pillow once:
```bash
pip install pillow
```

Run the cleaning script:
```bash
python3 tools/clean_images.py --input ~/Downloads/Gemini-Originals --output ~/Downloads/Gemini-Clean
```

Cleaned files will be written to: `~/Downloads/Gemini-Clean`

## Notes
- Removes only **visible** Gemini watermark. Invisible watermarks (e.g., SynthID) are not removed.
- Output format is PNG (`*_clean.png`).

## Disclaimer
Watermark removal may have legal or policy implications depending on your use case. You are responsible for ensuring compliance.
