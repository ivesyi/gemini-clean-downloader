# Gemini Clean Downloader Extension - Design

## Goal
Provide a Chrome MV3 extension that lets users download Gemini images with watermark removal in two flows: (1) click the native Gemini Download button for a single image, and (2) click a floating “Download All Clean” button for batch downloads. The experience must be single-step and require no extra manual processing.

## Architecture
The extension has three parts: `content.js` for DOM interaction and canvas processing, `background.js` for cross-origin image fetch, and static assets (watermark masks and CSS). The content script injects a lightweight floating UI and uses a capture-phase click listener to intercept Gemini’s native download button. The background service worker fetches the image bytes from `googleusercontent.com` to avoid CORS restrictions and returns ArrayBuffer data to the content script. Watermark removal is done locally using reverse alpha blending and fixed watermark masks (48×48 and 96×96).

## Data Flow
Single download: user clicks native download → content script captures click → finds associated image → fetches original image bytes via background → removes watermark on a canvas → triggers file download. Batch download: user clicks floating button → content script enumerates all images in the conversation → processes each sequentially with a small delay to avoid memory spikes → downloads cleaned files with consistent timestamps/indices.

## Error Handling
If watermark removal fails, the extension falls back to downloading the original image. Batch processing continues even if a single image fails, and the UI shows success/failure counts.

## Testing and Validation
Manual testing on Gemini conversations with multiple generated images. Verify: (1) single-click download produces a cleaned image, (2) batch downloads complete with correct counts and filenames, (3) UI appears and updates image count.
