// Simple i18n helper for auto + manual override.
(function() {
  const DICTS = {
    en: {
      panel_title: 'Original Downloads',
      panel_count: '$COUNT$ images',
      btn_download_all: 'Download All Originals',
      btn_download_all_title: 'Download all original images',
      btn_clean_now: 'Clean Now',
      btn_clean_now_title: 'Run local cleaner now',
      btn_settings: 'Settings',
      btn_settings_title: 'Open settings',
      status_downloading_single: 'Downloading original image...',
      status_downloaded_single: 'Downloaded original image',
      status_download_failed: 'Download failed',
      status_no_images: 'No images found in conversation',
      status_downloading_batch: 'Downloading $TOTAL$ images...',
      status_downloading_progress: 'Downloading $INDEX$ of $TOTAL$...',
      status_downloaded_batch: 'Downloaded $SUCCESS$ images',
      status_downloaded_batch_partial: 'Downloaded $SUCCESS$, failed $FAILED$',
      status_request_clean: 'Requesting clean...',
      status_clean_result: 'Cleaned: $SUCCESS$ ok, $FAILED$ failed',
      status_clean_upload_result: 'Cleaned: $SUCCESS$ ok, $FAILED$ failed. Uploaded: $UPLOAD_SUCCESS$ ok, $UPLOAD_FAILED$ failed',
      status_clean_failed: 'Clean failed: $ERROR$',
      settings_title: 'Gemini Clean Downloader',
      settings_subtitle: 'Configure the local Docker cleaning service.',
      label_service_url: 'Service URL',
      label_input_subdir: 'Input folder (subdir under mounted base)',
      label_output_subdir: 'Result folder (subdir under mounted base)',
      label_upload_enabled: 'Enable ImgBed upload',
      label_upload_api_url: 'ImgBed Upload API URL',
      label_delete_cleaned: 'Delete cleaned files after upload',
      placeholder_upload_api_url: 'https://cfbed.sanyue.de/upload?authCode=xxxx',
      label_delete_originals: 'Delete originals after cleaning',
      label_auto_clean: 'Auto clean after downloads finish',
      label_language: 'UI language',
      btn_save: 'Save Settings',
      btn_test: 'Test Connection',
      status_saved: 'Saved.',
      status_test_running: 'Testing...',
      status_test_ok: 'OK',
      status_test_fail: 'Failed: $ERROR$',
      hint_docker_mount: 'Docker mount reminder: The service only sees the directory mounted into the container (default /data). Your input/output folders must be subdirectories inside that mount.',
      lang_auto: 'Auto (browser)',
      lang_en: 'English',
      lang_zh: '简体中文'
    },
    zh_CN: {
      panel_title: '原图下载',
      panel_count: '$COUNT$ 张',
      btn_download_all: '批量下载原图',
      btn_download_all_title: '下载当前对话所有原图',
      btn_clean_now: '立即清理',
      btn_clean_now_title: '手动触发本地清理',
      btn_settings: '设置',
      btn_settings_title: '打开设置',
      status_downloading_single: '正在下载原图...',
      status_downloaded_single: '原图下载完成',
      status_download_failed: '下载失败',
      status_no_images: '当前对话没有图片',
      status_downloading_batch: '正在下载 $TOTAL$ 张...',
      status_downloading_progress: '正在下载第 $INDEX$ / $TOTAL$ 张...',
      status_downloaded_batch: '已下载 $SUCCESS$ 张',
      status_downloaded_batch_partial: '已下载 $SUCCESS$ 张，失败 $FAILED$ 张',
      status_request_clean: '正在请求清理...',
      status_clean_result: '清理完成：成功 $SUCCESS$ 张，失败 $FAILED$ 张',
      status_clean_upload_result: '清理完成：成功 $SUCCESS$ 张，失败 $FAILED$ 张。上传成功 $UPLOAD_SUCCESS$ 张，失败 $UPLOAD_FAILED$ 张',
      status_clean_failed: '清理失败：$ERROR$',
      settings_title: 'Gemini 清理下载器',
      settings_subtitle: '配置本地 Docker 清理服务',
      label_service_url: '服务地址',
      label_input_subdir: '输入目录（挂载根目录下的子目录）',
      label_output_subdir: '结果目录（挂载根目录下的子目录）',
      label_upload_enabled: '启用 ImgBed 上传',
      label_upload_api_url: 'ImgBed 上传 API 地址',
      label_delete_cleaned: '上传后删除清理文件',
      placeholder_upload_api_url: 'https://cfbed.sanyue.de/upload?authCode=xxxx',
      label_delete_originals: '清理后删除原图',
      label_auto_clean: '下载完成后自动清理',
      label_language: '界面语言',
      btn_save: '保存设置',
      btn_test: '测试连接',
      status_saved: '已保存',
      status_test_running: '正在测试...',
      status_test_ok: '连接正常',
      status_test_fail: '连接失败：$ERROR$',
      hint_docker_mount: '挂载提示：服务只能访问容器内挂载目录（默认 /data）。输入/输出目录必须是该目录下的子目录。',
      lang_auto: '自动（跟随浏览器）',
      lang_en: 'English',
      lang_zh: '简体中文'
    }
  };

  const state = {
    lang: 'auto',
    dict: DICTS.en
  };

  const detectLang = () => {
    const ui = (chrome.i18n?.getUILanguage?.() || navigator.language || 'en').toLowerCase();
    if (ui.startsWith('zh')) return 'zh_CN';
    return 'en';
  };

  const init = async () => {
    const stored = await chrome.storage.local.get({ uiLanguage: 'auto' });
    const selected = stored.uiLanguage || 'auto';
    state.lang = selected === 'auto' ? detectLang() : selected;
    state.dict = DICTS[state.lang] || DICTS.en;
  };

  const format = (message, vars) => {
    if (!vars) return message;
    let out = message;
    for (const [key, value] of Object.entries(vars)) {
      const pattern = new RegExp(`\\$${key}\\$`, 'gi');
      out = out.replace(pattern, String(value));
    }
    return out;
  };

  const t = (key, vars) => {
    const message = state.dict[key] || key;
    return format(message, vars);
  };

  const apply = (root = document) => {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', t(key));
    });
    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.setAttribute('title', t(key));
    });
  };

  window.GCDI18n = { init, t, apply, state };
})();
