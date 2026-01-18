const DEFAULTS = {
  serviceUrl: 'http://127.0.0.1:17811',
  inputSubdir: 'Gemini-Originals',
  outputSubdir: 'Gemini-Clean',
  deleteOriginals: false,
  autoClean: true,
  uploadEnabled: false,
  uploadApiUrl: '',
  deleteCleanedAfterUpload: false,
  uiLanguage: 'auto'
};

const byId = (id) => document.getElementById(id);

let t = (key, vars) => key;
const DEFAULT_INPUT_SUBDIR = DEFAULTS.inputSubdir;
const DEFAULT_OUTPUT_SUBDIR = DEFAULTS.outputSubdir;
const pathUtils = window.GCDPathUtils || {};

const loadSettings = async () => {
  const stored = await chrome.storage.local.get(DEFAULTS);
  const settings = { ...DEFAULTS, ...stored };
  byId('serviceUrl').value = settings.serviceUrl;
  byId('inputSubdir').value = settings.inputSubdir;
  byId('outputSubdir').value = settings.outputSubdir;
  byId('uploadEnabled').checked = settings.uploadEnabled;
  byId('uploadApiUrl').value = settings.uploadApiUrl || '';
  byId('deleteCleanedAfterUpload').checked = settings.deleteCleanedAfterUpload;
  byId('deleteOriginals').checked = settings.deleteOriginals;
  byId('autoClean').checked = settings.autoClean;
  byId('uiLanguage').value = settings.uiLanguage || 'auto';
  updateUploadState();
  updatePathPreview();
};

const saveSettings = async () => {
  const settings = {
    serviceUrl: byId('serviceUrl').value.trim() || DEFAULTS.serviceUrl,
    inputSubdir: byId('inputSubdir').value.trim() || DEFAULTS.inputSubdir,
    outputSubdir: byId('outputSubdir').value.trim() || DEFAULTS.outputSubdir,
    uploadEnabled: byId('uploadEnabled').checked,
    uploadApiUrl: byId('uploadApiUrl').value.trim(),
    deleteCleanedAfterUpload: byId('deleteCleanedAfterUpload').checked,
    deleteOriginals: byId('deleteOriginals').checked,
    autoClean: byId('autoClean').checked,
    uiLanguage: byId('uiLanguage').value || 'auto'
  };
  await chrome.storage.local.set(settings);
  await window.GCDI18n?.init();
  if (window.GCDI18n?.apply) {
    window.GCDI18n.apply(document);
    t = window.GCDI18n.t;
  }
  setStatus(t('status_saved'), 'success');
};

const testConnection = async () => {
  const serviceUrl = byId('serviceUrl').value.trim() || DEFAULTS.serviceUrl;
  setStatus(t('status_test_running'), 'info');
  try {
    const response = await fetch(`${serviceUrl}/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    setStatus(t('status_test_ok'), 'success');
  } catch (error) {
    setStatus(t('status_test_fail', { error }), 'error');
  }
};

const testUpload = async () => {
  const serviceUrl = byId('serviceUrl').value.trim() || DEFAULTS.serviceUrl;
  const uploadUrl = byId('uploadApiUrl').value.trim();
  if (!uploadUrl) {
    setStatus(t('status_upload_test_missing'), 'error');
    return;
  }
  setStatus(t('status_upload_test_running'), 'info');
  try {
    const response = await fetch(`${serviceUrl}/upload-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upload_url: uploadUrl })
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || `HTTP ${response.status}`);
    }
    const data = await response.json();
    setStatus(t('status_upload_test_ok', { url: data.url || '' }), 'success');
  } catch (error) {
    setStatus(t('status_upload_test_fail', { error }), 'error');
  }
};

const setStatus = (text, type) => {
  const el = byId('status');
  el.textContent = text;
  el.className = `status ${type}`;
  if (text) {
    setTimeout(() => {
      el.textContent = '';
      el.className = 'status';
    }, 4000);
  }
};

const updateUploadState = () => {
  const enabled = byId('uploadEnabled').checked;
  byId('uploadApiUrl').disabled = !enabled;
  byId('deleteCleanedAfterUpload').disabled = !enabled;
};

const updatePathPreview = () => {
  const baseLabel = t('label_download_root');
  if (byId('downloadRoot')) {
    byId('downloadRoot').textContent = baseLabel;
  }
  const inputValue = byId('inputSubdir').value;
  const outputValue = byId('outputSubdir').value;
  const buildPreview = pathUtils.buildPreviewPaths;
  if (!buildPreview) return;
  const preview = buildPreview(baseLabel, inputValue, outputValue, {
    input: DEFAULT_INPUT_SUBDIR,
    output: DEFAULT_OUTPUT_SUBDIR
  });
  if (byId('inputPathPreview')) {
    byId('inputPathPreview').textContent = preview.inputPath;
  }
  if (byId('outputPathPreview')) {
    byId('outputPathPreview').textContent = preview.outputPath;
  }
};

byId('saveBtn').addEventListener('click', saveSettings);
byId('testBtn').addEventListener('click', testConnection);
byId('uploadEnabled').addEventListener('change', updateUploadState);
byId('uploadTestBtn').addEventListener('click', testUpload);
byId('inputSubdir').addEventListener('input', updatePathPreview);
byId('outputSubdir').addEventListener('input', updatePathPreview);

const init = async () => {
  if (window.GCDI18n?.init) {
    await window.GCDI18n.init();
    t = window.GCDI18n.t;
    window.GCDI18n.apply(document);
  }
  await loadSettings();
  updatePathPreview();
};

init();
