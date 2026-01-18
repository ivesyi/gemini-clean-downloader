(function() {
  const DEFAULT_SUBDIR = 'Gemini-Originals';
  const DEFAULT_OUTPUT = 'Gemini-Clean';
  const DEFAULT_BASE = 'Chrome default download directory';

  const resolveDownloadSubdir = (value, fallback = DEFAULT_SUBDIR) => {
    if (typeof value !== 'string') return fallback;
    let out = value.trim();
    out = out.replace(/^[\\/]+/, '').replace(/[\\/]+$/, '');
    if (!out) return fallback;
    return out;
  };

  const buildPreviewPaths = (baseLabel, inputSubdir, outputSubdir, defaults = {}) => {
    const base = typeof baseLabel === 'string' && baseLabel.trim() ? baseLabel.trim() : DEFAULT_BASE;
    const inputFallback = defaults.input || DEFAULT_SUBDIR;
    const outputFallback = defaults.output || DEFAULT_OUTPUT;
    const inputResolved = resolveDownloadSubdir(inputSubdir, inputFallback);
    const outputResolved = resolveDownloadSubdir(outputSubdir, outputFallback);
    return {
      base,
      inputPath: `${base}/${inputResolved}`,
      outputPath: `${base}/${outputResolved}`
    };
  };

  const api = { resolveDownloadSubdir, buildPreviewPaths };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.GCDPathUtils = api;
  }
})();
