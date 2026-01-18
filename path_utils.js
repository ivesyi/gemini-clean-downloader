(function() {
  const DEFAULT_SUBDIR = 'Gemini-Originals';

  const resolveDownloadSubdir = (value, fallback = DEFAULT_SUBDIR) => {
    if (typeof value !== 'string') return fallback;
    let out = value.trim();
    out = out.replace(/^[\\/]+/, '').replace(/[\\/]+$/, '');
    if (!out) return fallback;
    return out;
  };

  const api = { resolveDownloadSubdir };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.GCDPathUtils = api;
  }
})();
