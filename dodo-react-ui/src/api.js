// Unified authenticated HTTP bridge to the real DODO DM1 Rust backend.

function getBase() {
  if (typeof window !== 'undefined' && typeof window.__DODO_API_BASE__ === 'string') {
    return window.__DODO_API_BASE__;
  }
  return '';
}

function getToken() {
  if (typeof window !== 'undefined' && window.__DODO_UI_TOKEN__) {
    return window.__DODO_UI_TOKEN__;
  }
  const sp = new URLSearchParams(window.location.search);
  const qt = sp.get('t');
  if (qt) {
    window.__DODO_UI_TOKEN__ = qt;
    return qt;
  }
  return '';
}

export async function initApiFromElectron() {
  if (window.dodoElectron && typeof window.dodoElectron.getBackendInfo === 'function') {
    const info = await window.dodoElectron.getBackendInfo();
    if (info && info.baseUrl) {
      window.__DODO_API_BASE__ = info.baseUrl;
      window.__DODO_UI_TOKEN__ = info.token;
    }
  }
}

async function req(method, path, body = undefined) {
  const base = getBase();
  const token = getToken();
  const opts = {
    method,
    headers: {
      'X-Dodo-Session': token,
    },
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(`${base}${path}`, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data.error || `HTTP ${r.status}`);
  }
  return data;
}

export const api = {
  getState: () => req('GET', '/ui/state'),
  getTranslations: (lang) => req('GET', `/ui/translations/${encodeURIComponent(lang)}`),
  getInfoTexts: () => req('GET', '/ui/info/texts'),
  windowAction: (action) => {
    if (typeof window !== 'undefined' && window.dodoElectron?.windowAction && action !== 'drag') {
      return window.dodoElectron.windowAction(action);
    }
    return req('POST', '/ui/window', { action });
  },

  probeUrl: (payload) => req('POST', '/ui/probe', payload),
  addDownload: (payload) => req('POST', '/ui/add', payload),
  batchPreview: (payload) => req('POST', '/ui/batch/preview', payload),
  addBatch: (payload) => req('POST', '/ui/batch', payload),
  doAction: (payload) => req('POST', '/ui/action', payload),

  grabberStart: (payload) => req('POST', '/ui/grabber/start', payload),
  grabberState: () => req('GET', '/ui/grabber/state'),
  grabberStop: () => req('POST', '/ui/grabber/stop', {}),
  grabberDownload: (payload) => req('POST', '/ui/grabber/download', payload),

  playlistFetch: (url) => req('POST', '/ui/playlist/fetch', { url }),
  playlistDownload: (payload) => req('POST', '/ui/playlist/download', payload),

  clipFetch: (url) => req('POST', '/ui/clip/fetch', { url }),
  clipPreview: (payload) => req('POST', '/ui/clip/preview', payload),
  clipPreviewStatus: () => req('GET', '/ui/clip/preview-status'),
  clipDownload: (payload) => req('POST', '/ui/clip/download', payload),

  torrentInspect: (source) => req('POST', '/ui/torrent/inspect', { source }),
  torrentInspectStatus: () => req('GET', '/ui/torrent/inspect-status'),
  torrentAdd: (payload) => req('POST', '/ui/torrent/add', payload),
  torrentLive: (id) => req('GET', `/ui/torrent/live/${id}`),
  torrentLiveAction: (id, payload) => req('POST', `/ui/torrent/live/${id}`, payload),

  queueAdd: (payload) => req('POST', '/ui/queues/add', payload),
  queueUpdate: (payload) => req('POST', '/ui/queues/update', payload),
  queueDelete: (id) => req('POST', '/ui/queues/delete', { id }),
  queueStart: (id) => req('POST', '/ui/queues/start', { id }),
  queueStop: (id) => req('POST', '/ui/queues/stop', { id }),
  queueFiles: (id) => req('GET', `/ui/queues/${id}/files`),
  queueMoveFile: (id, delta) => req('POST', '/ui/queues/move-file', { id, delta }),

  categorySave: (payload) => req('POST', '/ui/categories/save', payload),
  categoryDelete: (name) => req('POST', '/ui/categories/delete', { name }),

  saveSettings: (settings) => req('POST', '/ui/settings', settings),

  pickFolder: (initial) => req('POST', '/ui/dialog/pick-folder', { initial }),
  pickFile: (filterName, extensions) => req('POST', '/ui/dialog/pick-file', { filter_name: filterName, extensions }),
  importList: (kind) => req('POST', '/ui/import', { kind }),
  exportList: (kind) => req('POST', '/ui/export', { kind }),

  getBrowsers: () => req('GET', '/ui/browsers'),
  browserAction: (action, index = 0) => req('POST', '/ui/browsers/action', { action, index }),

  updateCheckApp: (payload = {}) => req('POST', '/ui/updates/check-app', payload),
  updateState: () => req('GET', '/ui/updates/state'),
  updateInstallApp: () => req('POST', '/ui/updates/install-app', {}),
  updateTools: () => req('POST', '/ui/updates/tools', {}),

  respondPair: (pairId, allow) => req('POST', '/ui/pair/respond', { pair_id: pairId, allow }),
  powerAction: (action) => req('POST', '/ui/power', { action }),
  openDownloadFolder: () => req('POST', '/ui/open-download-folder', {}),
};
