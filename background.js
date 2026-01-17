// Background service worker: download originals and trigger local clean service.
const DEFAULT_SETTINGS = {
  serviceUrl: 'http://127.0.0.1:17811',
  inputSubdir: 'Gemini-Originals',
  outputSubdir: 'Gemini-Clean',
  deleteOriginals: false,
  autoClean: true,
  uploadEnabled: false,
  uploadApiUrl: '',
  deleteCleanedAfterUpload: false,
  debounceMs: 1500
};

let cleanTimer = null;

const getSettings = async () => {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
};

const scheduleClean = async () => {
  const { autoClean, debounceMs } = await getSettings();
  if (!autoClean) return;
  if (cleanTimer) clearTimeout(cleanTimer);
  cleanTimer = setTimeout(() => {
    runClean('auto').catch(() => {});
  }, debounceMs);
};

const runClean = async (source = 'manual') => {
  const settings = await getSettings();
  const response = await fetch(`${settings.serviceUrl}/clean`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input_subdir: settings.inputSubdir,
      output_subdir: settings.outputSubdir,
      delete_originals: settings.deleteOriginals,
      upload_enabled: settings.uploadEnabled,
      upload_url: settings.uploadApiUrl,
      delete_cleaned: settings.deleteCleanedAfterUpload
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status} ${text}`.trim());
  }

  const data = await response.json();
  return { ok: true, source, data };
};

chrome.downloads.onChanged.addListener((delta) => {
  if (!delta.state || delta.state.current !== 'complete') return;
  if (!delta.id) return;

  chrome.downloads.search({ id: delta.id }, async (items) => {
    if (!items || items.length === 0) return;
    const item = items[0];
    if (!item || !item.filename) return;

    const settings = await getSettings();
    const markerUnix = `/${settings.inputSubdir}/`;
    const markerWin = `\\${settings.inputSubdir}\\`;
    if (item.filename.includes(markerUnix) || item.filename.includes(markerWin)) {
      scheduleClean().catch(() => {});
    }
  });
});

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

  if (message?.action === 'cleanNow') {
    runClean('manual')
      .then((resp) => sendResponse(resp))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.action === 'getSettings') {
    getSettings().then((settings) => sendResponse({ ok: true, settings }));
    return true;
  }

  if (message?.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
  }
});
