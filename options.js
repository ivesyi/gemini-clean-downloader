const DEFAULTS = {
  serviceUrl: 'http://127.0.0.1:17811',
  inputSubdir: 'Gemini-Originals',
  outputSubdir: 'Gemini-Clean',
  deleteOriginals: false,
  autoClean: true,
  uiLanguage: 'auto'
};

const byId = (id) => document.getElementById(id);

let t = (key, vars) => key;

const loadSettings = async () => {
  const stored = await chrome.storage.local.get(DEFAULTS);
  const settings = { ...DEFAULTS, ...stored };
  byId('serviceUrl').value = settings.serviceUrl;
  byId('inputSubdir').value = settings.inputSubdir;
  byId('outputSubdir').value = settings.outputSubdir;
  byId('deleteOriginals').checked = settings.deleteOriginals;
  byId('autoClean').checked = settings.autoClean;
  byId('uiLanguage').value = settings.uiLanguage || 'auto';
};

const saveSettings = async () => {
  const settings = {
    serviceUrl: byId('serviceUrl').value.trim() || DEFAULTS.serviceUrl,
    inputSubdir: byId('inputSubdir').value.trim() || DEFAULTS.inputSubdir,
    outputSubdir: byId('outputSubdir').value.trim() || DEFAULTS.outputSubdir,
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

byId('saveBtn').addEventListener('click', saveSettings);
byId('testBtn').addEventListener('click', testConnection);

const init = async () => {
  if (window.GCDI18n?.init) {
    await window.GCDI18n.init();
    t = window.GCDI18n.t;
    window.GCDI18n.apply(document);
  }
  await loadSettings();
};

init();
