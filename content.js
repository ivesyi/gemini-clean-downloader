// Gemini Original Downloader Content Script (Step 1 of 2)
(function() {
  'use strict';

  const CONFIG = {
    checkInterval: 2000,
    buttonId: 'gcd-clean-downloader-fab',
    panelId: 'gcd-clean-downloader-panel',
    downloadDelayMs: 200,
    maxBatchCount: 500
  };

  let isExpanded = false;
  let cachedImages = [];
  let t = (key, vars) => key;

  const i18nReady = window.GCDI18n?.init
    ? window.GCDI18n.init().then(() => { t = window.GCDI18n.t; })
    : Promise.resolve();

  // ---------- Utilities ----------
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const normalizeToS0 = (url) => {
    if (!url || !url.includes('googleusercontent.com')) return url;
    let updated = url.replace(/=[sw]\d+(-[a-z0-9]+)*(?=[?#]|$)/i, '=s0');
    if (updated === url) {
      updated = url.replace(/=w\d+-h\d+(-[a-z0-9]+)*(?=[?#]|$)/i, '=s0');
    }
    return updated;
  };

  const buildFilename = (index, total) => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    if (total <= 1) return `gemini-original-${ts}.png`;
    return `gemini-original-${ts}-${String(index + 1).padStart(3, '0')}.png`;
  };

  const updateStatus = (message, type = 'info') => {
    const statusEl = document.querySelector('.gcd-panel-status');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `gcd-panel-status gcd-status-${type}`;
    statusEl.style.display = message ? 'block' : 'none';
  };

  const requestCleanNow = () => {
    updateStatus(t('status_request_clean'), 'info');
    chrome.runtime.sendMessage({ action: 'cleanNow' }, (resp) => {
      if (resp && resp.ok) {
        const data = resp.data || {};
        const uploadTotal = data.upload_total || 0;
        if (uploadTotal > 0) {
          updateStatus(t('status_clean_upload_result', {
            success: data.success || 0,
            failed: data.failed || 0,
            upload_success: data.upload_success || 0,
            upload_failed: data.upload_failed || 0
          }), 'success');
        } else {
          updateStatus(t('status_clean_result', { success: data.success || 0, failed: data.failed || 0 }), 'success');
        }
        setTimeout(() => updateStatus(''), 4000);
      } else {
        updateStatus(t('status_clean_failed', { error: resp?.error || 'unknown error' }), 'error');
      }
    });
  };

  const openSettings = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      chrome.runtime.sendMessage({ action: 'openOptions' });
    }
  };

  const downloadOriginal = (url, filename) => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'downloadImage',
      url,
      filename: `Gemini-Originals/${filename}`
    }, (resp) => {
      if (resp && resp.ok) {
        resolve(resp);
      } else {
        reject(new Error(resp?.error || 'Download failed'));
      }
    });
  });

  // ---------- DOM Discovery ----------
  const findGeneratedImages = () => {
    const images = [];

    const downloadButtons = document.querySelectorAll('download-generated-image-button button[data-test-id="download-generated-image-button"]');
    downloadButtons.forEach((btn) => {
      const container = btn.closest('generated-image') || btn.closest('single-image') || btn.closest('.generated-image-container');
      if (!container) return;
      const img = container.querySelector('img.image') || container.querySelector('img[src*="googleusercontent.com"]');
      if (img && img.src && img.src.includes('googleusercontent.com')) {
        images.push({
          src: img.src,
          element: img,
          container,
          index: images.length
        });
      }
    });

    if (images.length === 0) {
      const allImages = document.querySelectorAll('generated-image img.image, single-image img.image, .generated-image-container img');
      allImages.forEach((img) => {
        if (img.src && img.src.includes('googleusercontent.com')) {
          images.push({
            src: img.src,
            element: img,
            container: img.closest('generated-image') || img.closest('single-image') || img.closest('.generated-image-container'),
            index: images.length
          });
        }
      });
    }

    cachedImages = images;
    return images;
  };

  const updateImageCount = () => {
    const images = findGeneratedImages();
    const badge = document.querySelector('.gcd-fab-badge');
    const panelCount = document.querySelector('.gcd-panel-count');

    if (badge) {
      badge.textContent = images.length;
      badge.style.display = images.length > 0 ? 'flex' : 'none';
    }
    if (panelCount) {
      panelCount.textContent = t('panel_count', { count: images.length });
    }

    const allBtn = document.querySelector('.gcd-btn-all');
    if (allBtn) allBtn.disabled = images.length === 0;

    return images.length;
  };

  // ---------- UI ----------
  const createFAB = () => {
    const existing = document.getElementById(CONFIG.buttonId);
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = CONFIG.buttonId;
    container.className = 'gcd-fab-container';

    const button = document.createElement('button');
    button.className = 'gcd-fab-button';
    button.innerHTML = `
      <svg class="gcd-fab-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="gcd-fab-badge">0</span>
    `;
    button.title = 'Gemini Originals Downloader';
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      isExpanded = !isExpanded;
      const panel = document.getElementById(CONFIG.panelId);
      if (isExpanded) {
        panel.classList.add('gcd-panel-visible');
        container.classList.add('gcd-expanded');
        updateImageCount();
      } else {
        panel.classList.remove('gcd-panel-visible');
        container.classList.remove('gcd-expanded');
      }
    });

    const panel = document.createElement('div');
    panel.id = CONFIG.panelId;
    panel.className = 'gcd-panel';
    panel.innerHTML = `
      <div class="gcd-panel-header">
        <span class="gcd-panel-title" data-i18n="panel_title">Original Downloads</span>
        <span class="gcd-panel-count">0</span>
      </div>
      <div class="gcd-panel-buttons">
        <button class="gcd-panel-btn gcd-btn-all" data-i18n-title="btn_download_all_title" title="Download all original images">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span data-i18n="btn_download_all">Download All Originals</span>
        </button>
        <button class="gcd-panel-btn gcd-btn-clean" data-i18n-title="btn_clean_now_title" title="Run local watermark removal now">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 4H20V9C20 12.3137 17.3137 15 14 15H10C6.68629 15 4 12.3137 4 9V4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 19H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 15V19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span data-i18n="btn_clean_now">Remove Watermark</span>
        </button>
        <button class="gcd-panel-btn gcd-btn-settings" data-i18n-title="btn_settings_title" title="Open settings">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 15.5C13.933 15.5 15.5 13.933 15.5 12C15.5 10.067 13.933 8.5 12 8.5C10.067 8.5 8.5 10.067 8.5 12C8.5 13.933 10.067 15.5 12 15.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M19.4 15C19.5667 14.5 19.6667 13.8 19.6667 13C19.6667 12.2 19.5667 11.5 19.4 11L21 9L19 5L17 6C16.5 5.83333 15.8 5.73333 15 5.66667L14 3H10L9 5.66667C8.2 5.73333 7.5 5.83333 7 6L5 5L3 9L4.6 11C4.43333 11.5 4.33333 12.2 4.33333 13C4.33333 13.8 4.43333 14.5 4.6 15L3 17L5 21L7 20C7.5 20.1667 8.2 20.2667 9 20.3333L10 23H14L15 20.3333C15.8 20.2667 16.5 20.1667 17 20L19 21L21 17L19.4 15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span data-i18n="btn_settings">Settings</span>
        </button>
      </div>
      <div class="gcd-panel-status"></div>
    `;

    panel.querySelector('.gcd-btn-all').addEventListener('click', downloadAllOriginals);
    panel.querySelector('.gcd-btn-clean').addEventListener('click', requestCleanNow);
    panel.querySelector('.gcd-btn-settings').addEventListener('click', openSettings);

    container.appendChild(panel);
    container.appendChild(button);
    document.body.appendChild(container);

    if (window.GCDI18n?.apply) {
      window.GCDI18n.apply(container);
    }

    updateImageCount();
  };

  document.addEventListener('click', (e) => {
    const container = document.getElementById(CONFIG.buttonId);
    if (container && isExpanded && !container.contains(e.target)) {
      isExpanded = false;
      const panel = document.getElementById(CONFIG.panelId);
      panel.classList.remove('gcd-panel-visible');
      container.classList.remove('gcd-expanded');
    }
  });

  // ---------- Single download interception ----------
  const attachDownloadInterceptor = () => {
    document.addEventListener('click', async (event) => {
      const button = event.target.closest('download-generated-image-button button[data-test-id="download-generated-image-button"]');
      if (!button) return;

      const container = button.closest('generated-image') || button.closest('single-image') || button.closest('.generated-image-container');
      const img = container?.querySelector('img.image') || container?.querySelector('img[src*="googleusercontent.com"]');
      if (!img || !img.src) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const filename = buildFilename(0, 1);
      updateStatus(t('status_downloading_single'), 'info');

      try {
        await downloadOriginal(normalizeToS0(img.src), filename);
        updateStatus(t('status_downloaded_single'), 'success');
        setTimeout(() => updateStatus(''), 2500);
      } catch (error) {
        console.warn('[Gemini Originals Downloader] Download failed:', error);
        updateStatus(t('status_download_failed'), 'error');
      }
    }, true);
  };

  // ---------- Batch download ----------
  const downloadAllOriginals = async () => {
    const images = findGeneratedImages();
    if (images.length === 0) {
      updateStatus(t('status_no_images'), 'error');
      return;
    }

    const total = Math.min(images.length, CONFIG.maxBatchCount);
    updateStatus(t('status_downloading_batch', { total }), 'info');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < total; i++) {
      try {
        updateStatus(t('status_downloading_progress', { index: i + 1, total }), 'info');
        const filename = buildFilename(i, total);
        await downloadOriginal(normalizeToS0(images[i].src), filename);
        successCount++;
        await sleep(CONFIG.downloadDelayMs);
      } catch (error) {
        console.warn(`[Gemini Originals Downloader] Failed ${i + 1}:`, error);
        failCount++;
      }
    }

    if (failCount === 0) {
      updateStatus(t('status_downloaded_batch', { success: successCount }), 'success');
    } else {
      updateStatus(t('status_downloaded_batch_partial', { success: successCount, failed: failCount }), 'warning');
    }

    setTimeout(() => updateStatus(''), 5000);
  };

  // ---------- Init ----------
  const init = () => {
    const start = () => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createFAB);
      } else {
        createFAB();
      }
    };

    i18nReady.then(start);

    attachDownloadInterceptor();

    setInterval(updateImageCount, CONFIG.checkInterval);

    let scrollTimeout;
    document.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(updateImageCount, 500);
    }, true);

    const observer = new MutationObserver((mutations) => {
      if (mutations.some(m => m.addedNodes.length > 0)) {
        setTimeout(updateImageCount, 500);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  };

  init();
})();
