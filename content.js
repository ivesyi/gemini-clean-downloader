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
      panelCount.textContent = `${images.length} image${images.length !== 1 ? 's' : ''}`;
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
        <span class="gcd-panel-title">Original Downloads</span>
        <span class="gcd-panel-count">0 images</span>
      </div>
      <div class="gcd-panel-buttons">
        <button class="gcd-panel-btn gcd-btn-all" title="Download all original images">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Download All Originals</span>
        </button>
      </div>
      <div class="gcd-panel-status"></div>
    `;

    panel.querySelector('.gcd-btn-all').addEventListener('click', downloadAllOriginals);

    container.appendChild(panel);
    container.appendChild(button);
    document.body.appendChild(container);

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
      updateStatus('Downloading original image...', 'info');

      try {
        await downloadOriginal(normalizeToS0(img.src), filename);
        updateStatus('Downloaded original image', 'success');
        setTimeout(() => updateStatus(''), 2500);
      } catch (error) {
        console.warn('[Gemini Originals Downloader] Download failed:', error);
        updateStatus('Download failed', 'error');
      }
    }, true);
  };

  // ---------- Batch download ----------
  const downloadAllOriginals = async () => {
    const images = findGeneratedImages();
    if (images.length === 0) {
      updateStatus('No images found in conversation', 'error');
      return;
    }

    const total = Math.min(images.length, CONFIG.maxBatchCount);
    updateStatus(`Downloading ${total} images...`, 'info');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < total; i++) {
      try {
        updateStatus(`Downloading ${i + 1} of ${total}...`, 'info');
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
      updateStatus(`Downloaded ${successCount} images`, 'success');
    } else {
      updateStatus(`Downloaded ${successCount}, failed ${failCount}`, 'warning');
    }

    setTimeout(() => updateStatus(''), 5000);
  };

  // ---------- Init ----------
  const init = () => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createFAB);
    } else {
      createFAB();
    }

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
