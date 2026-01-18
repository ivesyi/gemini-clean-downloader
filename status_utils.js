(function() {
  const getStageFromStatus = (status) => {
    if (!status || typeof status !== 'object') return 'clean';
    const uploadTotal = Number(status.upload_total || 0);
    if (uploadTotal > 0) return 'upload';
    return 'clean';
  };

  const api = { getStageFromStatus };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.GCDStatusUtils = api;
  }
})();
