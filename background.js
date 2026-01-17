// Background service worker: download images without CORS issues.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === 'downloadImage' && message.url && message.filename) {
    chrome.downloads.download({
      url: message.url,
      filename: message.filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ ok: true, downloadId });
      }
    });
    return true;
  }
});
