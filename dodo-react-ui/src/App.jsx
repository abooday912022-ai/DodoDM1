import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, initApiFromElectron } from './api';
import { applyThemeToDom } from './themes';
import { createTranslator } from './translations';

import Titlebar from './components/Titlebar';
import MenuBar from './components/MenuBar';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import DownloadsTable from './components/DownloadsTable';
import { StatusBar } from './components/StatusBar';
import { ClipboardToast } from './components/ClipboardToast';

import { AddDownloadModal } from './components/AddDownloadModal';
import { ProgressModal } from './components/ProgressModal';
import { SettingsModal } from './components/SettingsModal';
import { BatchDownloadModal } from './components/BatchDownloadModal';
import { GrabberModal } from './components/GrabberModal';
import { PlaylistModal } from './components/PlaylistModal';
import { ClipModal } from './components/ClipModal';
import { TorrentModal } from './components/TorrentModal';
import { SchedulerModal } from './components/SchedulerModal';
import {
  BrowserModal,
  ColumnsModal,
  CategoryModal,
  PropertiesModal,
  RefreshUrlModal,
  CompleteModal,
  PairConfirmModal,
  InfoTextModal,
  UpdatePromptModal,
  MoveRenameModal,
  DeleteConfirmModal,
  Sha256Modal,
  FindModal,
} from './components/ExtraModals';
import { Sparkles, X } from 'lucide-react';

export default function App() {
  const [appState, setAppState] = useState(null);
  const [ready, setReady] = useState(false);
  const [remoteDict, setRemoteDict] = useState({});
  const [infoTexts, setInfoTexts] = useState(null);
  const loadedLangRef = useRef('');

  const [view, setView] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [lastPickId, setLastPickId] = useState(null);

  const [modal, setModal] = useState(null); // { name, data }
  const [clipboardUrl, setClipboardUrl] = useState('');
  const [toasts, setToasts] = useState([]);
  const [updatePromptVer, setUpdatePromptVer] = useState('');
  const [dismissedUpdateVer, setDismissedUpdateVer] = useState('');

  const addToast = useCallback((message, level = 'info') => {
    if (!message) return;
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, message, level }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  const settings = appState?.settings || {};
  const downloads = appState?.downloads || [];
  const queues = appState?.queues || [];
  const categories = settings.categories || [];
  const language = settings.language || 'en';

  const tr = useMemo(() => createTranslator(language, remoteDict), [language, remoteDict]);

  const handleBackendEvents = useCallback((events, fullState) => {
    if (!Array.isArray(events) || events.length === 0) return;
    const dlList = fullState?.downloads || [];
    for (const ev of events) {
      switch (ev.type) {
        case 'open_add':
          setModal({
            name: 'add',
            data: {
              url: ev.url || '',
              fileName: ev.file_name || '',
              referer: ev.referrer || ev.referer || '',
              cookies: ev.cookies || '',
              userAgent: ev.user_agent || '',
              post: ev.post || '',
              postType: ev.post_type || '',
              audioUrl: ev.audio_url || '',
              sourcePage: ev.source_page || '',
              sourceKey: ev.source_key || '',
            },
          });
          break;
        case 'open_batch_clipboard':
          setModal({ name: 'batch', data: { linksText: Array.isArray(ev.links) ? ev.links.join('\n') : (ev.text || '') } });
          break;
        case 'open_playlist':
          setModal({ name: 'playlist', data: { url: ev.url || '' } });
          break;
        case 'open_grabber_links':
          setModal({
            name: 'grabber',
            data: {
              url: ev.url || '',
              links: ev.links || [],
              cookies: ev.cookies || '',
              userAgent: ev.user_agent || '',
            },
          });
          break;
        case 'open_torrent':
          setModal({ name: 'torrent', data: { source: ev.source || ev.url || '' } });
          break;
        case 'open_scheduler':
          setModal({ name: 'scheduler', data: {} });
          break;
        case 'open_settings':
          setModal({ name: 'settings', data: 0 });
          break;
        case 'open_about':
          setModal({ name: 'about', data: null });
          break;
        case 'pair_ask':
          setModal({ name: 'pair', data: ev });
          break;
        case 'old_firefox_addon':
          setModal({ name: 'browsers', data: null });
          addToast(tr('Your Firefox add-on is out of date — please update it.'), 'error');
          break;
        case 'download_complete': {
          const files = Array.isArray(ev.files)
            ? ev.files
            : (ev.id ? [dlList.find((d) => d.id === ev.id)].filter(Boolean) : []);
          const first = files[0];
          if (first && fullState?.settings?.show_complete_dialog) {
            setModal({ name: 'complete', data: first });
          } else if (first?.file_name || ev.file_name) {
            addToast(`${tr('Download complete')}: ${first?.file_name || ev.file_name}`);
          }
          break;
        }
        case 'clipboard_url':
          if (ev.url) setClipboardUrl(ev.url);
          break;
        case 'progress_focus': {
          const item = ev.download || dlList.find((d) => d.id === ev.id);
          if (item) {
            setSelectedIds([item.id]);
            setModal({ name: 'progress', data: item });
          }
          break;
        }
        case 'toast':
          addToast(ev.message, ev.level || 'info');
          break;
        case 'update_available':
          if (ev.version) {
            setUpdatePromptVer(ev.version);
          }
          break;
        default:
          break;
      }
    }
  }, [addToast, tr]);

  const fetchState = useCallback(async () => {
    try {
      const st = await api.getState();
      setAppState(st);
      setReady(true);
      if (st.events?.length) {
        handleBackendEvents(st.events, st);
      }
    } catch {
      /* backend starting up or momentarily unreachable */
    }
  }, [handleBackendEvents]);

  // Startup initialization
  useEffect(() => {
    let alive = true;
    (async () => {
      await initApiFromElectron();
      if (!alive) return;
      await fetchState();
      api.getInfoTexts().then((tx) => alive && setInfoTexts(tx)).catch(() => {});
    })();
    return () => { alive = false; };
  }, [fetchState]);

  // Adaptive polling (4 FPS while actively downloading so live channels glide smoothly)
  const hasActiveDownloads = downloads.some((d) => ['Downloading', 'Connecting', 'Assembling'].includes(d.status));
  const pollMs = hasActiveDownloads || appState?.power_countdown || modal?.name === 'progress' ? 250 : 1200;

  useEffect(() => {
    if (!ready) return;
    const t = setInterval(fetchState, pollMs);
    return () => clearInterval(t);
  }, [ready, pollMs, fetchState]);

  // Apply theme, font scale, RTL, and remote language dictionary
  useEffect(() => {
    if (!appState?.settings) return;
    const s = appState.settings;
    applyThemeToDom(s.theme ?? 0, s.font_scale ?? 100, s.font_family || '');
    const eff = s.language || 'en';
    document.documentElement.dir = eff === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = eff;
    if (loadedLangRef.current !== eff) {
      loadedLangRef.current = eff;
      api.getTranslations(eff).then((dict) => setRemoteDict(dict || {})).catch(() => {});
    }
  }, [appState?.settings?.theme, appState?.settings?.font_scale, appState?.settings?.font_family, appState?.settings?.language]);

  // Filtered + sorted rows
  const filteredDownloads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let rows = downloads.filter((d) => {
      if (view === 'unfinished' && d.status === 'Completed') return false;
      else if (view === 'finished' && d.status !== 'Completed') return false;
      else if (view.startsWith('cat:') && d.category !== view.slice(4)) return false;
      else if (view.startsWith('unf:') && (d.status === 'Completed' || d.category !== view.slice(4))) return false;
      else if (view.startsWith('fin:') && (d.status !== 'Completed' || d.category !== view.slice(4))) return false;
      else if (view.startsWith('queue:') && String(d.queue ?? '') !== view.slice(6)) return false;

      if (q) {
        const hay = `${d.file_name || ''} ${d.url || ''} ${d.description || ''} ${d.category || ''} ${d.save_dir || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sortBy = settings.sort_by || 'added';
    const desc = Boolean(settings.sort_desc);
    const cmp = (a, b) => {
      let va;
      let vb;
      switch (sortBy) {
        case 'name': va = (a.file_name || '').toLowerCase(); vb = (b.file_name || '').toLowerCase(); break;
        case 'size': va = a.total_size || 0; vb = b.total_size || 0; break;
        case 'status': va = a.status_label || a.status || ''; vb = b.status_label || b.status || ''; break;
        case 'progress': va = a.progress || 0; vb = b.progress || 0; break;
        case 'time_left': va = a.eta_secs ?? 1e12; vb = b.eta_secs ?? 1e12; break;
        case 'speed': va = a.speed || 0; vb = b.speed || 0; break;
        case 'category': va = a.category || ''; vb = b.category || ''; break;
        case 'save_to': va = a.save_dir || ''; vb = b.save_dir || ''; break;
        case 'description': va = a.description || ''; vb = b.description || ''; break;
        case 'last_try': va = a.last_try || ''; vb = b.last_try || ''; break;
        case 'added':
        default:
          va = a.added_ts || a.id || 0; vb = b.added_ts || b.id || 0; break;
      }
      if (va < vb) return desc ? 1 : -1;
      if (va > vb) return desc ? -1 : 1;
      return 0;
    };
    return [...rows].sort(cmp);
  }, [downloads, view, searchQuery, settings.sort_by, settings.sort_desc]);

  const selectedRows = useMemo(
    () => downloads.filter((d) => selectedIds.includes(d.id)),
    [downloads, selectedIds]
  );

  const onPickRow = useCallback((id, ctrl, shift) => {
    if (shift && lastPickId !== null) {
      const idxA = filteredDownloads.findIndex((r) => r.id === lastPickId);
      const idxB = filteredDownloads.findIndex((r) => r.id === id);
      if (idxA !== -1 && idxB !== -1) {
        const [lo, hi] = idxA < idxB ? [idxA, idxB] : [idxB, idxA];
        setSelectedIds(filteredDownloads.slice(lo, hi + 1).map((r) => r.id));
        return;
      }
    }
    if (ctrl) {
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
      setLastPickId(id);
    } else {
      setSelectedIds([id]);
      setLastPickId(id);
    }
  }, [filteredDownloads, lastPickId]);

  const onRightPickRow = useCallback((id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev : [id]));
    setLastPickId(id);
  }, []);

  const openModal = useCallback((name, data = null) => {
    if (name === 'batch' && data?.fromClipboard) {
      if (navigator.clipboard?.readText) {
        navigator.clipboard.readText()
          .then((text) => setModal({ name: 'batch', data: { linksText: text || '' } }))
          .catch(() => setModal({ name: 'batch', data: { linksText: '' } }));
        return;
      }
    }
    setModal({ name, data });
  }, []);

  const upsertDownload = useCallback((dl) => {
    if (!dl?.id) return;
    setAppState((prev) => {
      if (!prev?.downloads) return prev;
      const exists = prev.downloads.some((d) => d.id === dl.id);
      const nextDownloads = exists
        ? prev.downloads.map((d) => (d.id === dl.id ? dl : d))
        : [...prev.downloads, dl];
      return { ...prev, downloads: nextDownloads };
    });
  }, []);

  const handleAction = useCallback(async (actionName, explicitIds = null) => {
    const ids = Array.isArray(explicitIds) ? explicitIds : selectedIds;
    try {
      if (['resume', 'pause', 'restart'].includes(actionName) && ids.length > 0) {
        const primary = downloads.find((d) => d.id === ids[0]);
        if (actionName === 'resume' || actionName === 'restart') {
          if (primary) {
            const initLabel = tr(primary.total_size ? 'Initializing download…' : 'Checking link…');
            const optimisticRow = actionName === 'restart'
              ? {
                  ...primary,
                  status: 'Connecting',
                  status_label: initLabel,
                  downloaded: 0,
                  downloaded_fmt: '0 B',
                  progress: 0,
                  speed: 0,
                  speed_fmt: '--',
                  eta: null,
                  eta_fmt: '',
                  active_connections: 0,
                  error: null,
                }
              : {
                  ...primary,
                  status: 'Connecting',
                  status_label: initLabel,
                  speed: 0,
                  speed_fmt: '--',
                  error: null,
                };
            setSelectedIds([optimisticRow.id]);
            setModal({ name: 'progress', data: optimisticRow });
          }
        }
        setAppState((prev) => {
          if (!prev?.downloads) return prev;
          const nextDownloads = prev.downloads.map((d) => {
            if (!ids.includes(d.id)) return d;
            if (actionName === 'resume') {
              return {
                ...d,
                status: 'Connecting',
                status_label: tr(d.total_size ? 'Initializing download…' : 'Checking link…'),
                speed: 0,
                speed_fmt: '--',
                error: null,
              };
            } else if (actionName === 'pause') {
              return { ...d, status: 'Paused', status_label: tr('Paused'), speed: 0, speed_fmt: '--', active_connections: 0 };
            } else if (actionName === 'restart') {
              return {
                ...d,
                status: 'Connecting',
                status_label: tr(d.total_size ? 'Initializing download…' : 'Checking link…'),
                downloaded: 0,
                downloaded_fmt: '0 B',
                progress: 0,
                speed: 0,
                speed_fmt: '--',
                eta: null,
                eta_fmt: '',
                active_connections: 0,
                error: null,
              };
            }
            return d;
          });
          return { ...prev, downloads: nextDownloads };
        });
      }
      if (actionName === 'copy_url') {
        const urls = downloads.filter((d) => ids.includes(d.id)).map((d) => d.url).join('\n');
        if (urls && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(urls);
          addToast(tr('Address copied to clipboard'));
        }
        return;
      }
      if (actionName === 'delete') {
        if (!ids.length) return;
        if (settings.ask_before_remove) {
          setModal({ name: 'delete_confirm', data: { ids } });
          return;
        }
        await api.doAction({ action: 'delete', ids, delete_file: false });
        setSelectedIds((prev) => prev.filter((x) => !ids.includes(x)));
        fetchState();
        return;
      }
      if (actionName === 'verify_sha256') {
        if (!ids.length) return;
        const item = downloads.find((d) => d.id === ids[0]);
        addToast(tr('Computing SHA-256 checksum...'));
        const res = await api.doAction({ action: 'verify_sha256', ids: [ids[0]] });
        setModal({ name: 'sha256', data: { ...res, file_name: item?.file_name || '' } });
        return;
      }
      const res = await api.doAction({ action: actionName, ids });
      if (['resume', 'restart'].includes(actionName) && res?.download) {
        upsertDownload(res.download);
        setSelectedIds([res.download.id]);
        setModal((prev) => (prev?.name === 'progress' && prev.data?.id === res.download.id ? { name: 'progress', data: res.download } : prev));
      }
      fetchState();
    } catch (e) {
      fetchState();
      addToast(e.message || tr('Action failed'), 'error');
    }
  }, [selectedIds, downloads, settings.ask_before_remove, addToast, tr, fetchState, upsertDownload]);

  const handleSaveSettingsPatch = useCallback(async (patch) => {
    try {
      await api.saveSettings(patch);
      fetchState();
    } catch (e) {
      addToast(e.message, 'error');
    }
  }, [fetchState, addToast]);

  const handleSortChange = useCallback((colKey) => {
    const nextDesc = settings.sort_by === colKey ? !settings.sort_desc : false;
    handleSaveSettingsPatch({ sort_by: colKey, sort_desc: nextDesc });
  }, [settings.sort_by, settings.sort_desc, handleSaveSettingsPatch]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if (e.key === 'Escape' && modal) {
        setModal(null);
        return;
      }
      if (inInput) return;
      if (e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); openModal('add', { url: '' }); }
      else if (e.ctrlKey && e.key.toLowerCase() === 'b') { e.preventDefault(); openModal('batch', {}); }
      else if (e.ctrlKey && e.key.toLowerCase() === 'a') { e.preventDefault(); setSelectedIds(filteredDownloads.map((r) => r.id)); }
      else if (e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); openModal('find'); }
      else if (e.key === 'Delete' && selectedIds.length) { e.preventDefault(); handleAction('delete'); }
      else if (e.key === 'F2' && selectedIds.length === 1) {
        e.preventDefault();
        const item = downloads.find((d) => d.id === selectedIds[0]);
        if (item) openModal('move', item);
      } else if (e.altKey && e.key === 'Enter' && selectedIds.length === 1) {
        e.preventDefault();
        const item = downloads.find((d) => d.id === selectedIds[0]);
        if (item) openModal('properties', item);
      } else if (e.key === 'F1') { e.preventDefault(); openModal('shortcuts'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, filteredDownloads, selectedIds, downloads, openModal, handleAction]);

  const liveProgressDownload = useMemo(() => {
    if (modal?.name !== 'progress' || !modal.data?.id) return modal?.data || null;
    return downloads.find((d) => d.id === modal.data.id) || modal.data;
  }, [modal, downloads]);

  const allColList = settings.all_columns || ['name', 'size', 'status', 'progress', 'time_left', 'speed', 'added', 'last_try', 'category', 'save_to', 'description'];
  const visibleCols = settings.columns?.length ? settings.columns : allColList;

  return (
    <div className="app-container">
      <Titlebar
        tr={tr}
        themeId={settings.theme ?? 0}
        onSelectTheme={(id) => handleSaveSettingsPatch({ theme: id })}
        language={language}
        onSelectLanguage={(code) => handleSaveSettingsPatch({ language: code })}
        onOpenModal={openModal}
      />

      <MenuBar
        tr={tr}
        language={language}
        selectedRows={selectedRows}
        queues={queues}
        settings={settings}
        whenAllDone={appState?.when_all_done ?? 0}
        speedLimitOn={appState?.speed_limit_on ?? false}
        sortBy={settings.sort_by || 'added'}
        onOpenModal={openModal}
        onAction={handleAction}
        onSelectAll={() => setSelectedIds(filteredDownloads.map((r) => r.id))}
        onSortChange={handleSortChange}
        onSaveSettingsPatch={handleSaveSettingsPatch}
        onNotify={addToast}
      />

      <Toolbar
        tr={tr}
        small={Boolean(settings.toolbar_small)}
        selectedRows={selectedRows}
        speedLimitOn={Boolean(appState?.speed_limit_on)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenModal={openModal}
        onAction={handleAction}
      />

      {appState?.update_available && dismissedUpdateVer !== appState.update_available.version && (
        <div
          className="px-4 py-2 flex items-center justify-between gap-3 text-[13px]"
          style={{
            background: 'var(--accent-soft, rgba(34, 211, 238, 0.14))',
            borderBottom: '1px solid var(--accent, #22d3ee)',
          }}
        >
          <div className="flex items-center gap-2 font-medium text-[var(--text)]">
            <Sparkles size={15} className="text-[var(--accent)] shrink-0" />
            <span>
              {tr('New update available for DODO DM1')}{' '}
              <span className="font-mono font-semibold text-[var(--accent)]" dir="ltr">
                (v{appState.update_available.version})
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setUpdatePromptVer('');
                api.updateInstallApp().catch((e) => addToast(e.message, 'error'));
                openModal('update');
              }}
              className="btn btn-primary"
              style={{ padding: '4px 14px', fontSize: '12px' }}
            >
              {appState.update_available.downloading
                ? `${tr('Update')} (${Math.max(0, Math.round(appState.update_available.progress || 0))}%)`
                : tr('Update')}
            </button>
            <button
              type="button"
              onClick={() => setDismissedUpdateVer(appState.update_available.version)}
              className="p-1 rounded hover:bg-[var(--row-hover)] text-[var(--muted)]"
              title={tr('Close')}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="main-body">
        {!settings.hide_categories && (
          <Sidebar
            tr={tr}
            view={view}
            setView={setView}
            downloads={downloads}
            categories={categories}
            queues={queues}
            diskFreeFmt={appState?.disk_free_fmt || ''}
            toolsReady={appState?.tools_ready || {}}
            onOpenModal={openModal}
            onRefreshState={fetchState}
          />
        )}

        <DownloadsTable
          tr={tr}
          downloads={filteredDownloads}
          selectedIds={selectedIds}
          onPickRow={onPickRow}
          onRightPickRow={onRightPickRow}
          visibleCols={visibleCols}
          sortBy={settings.sort_by || 'added'}
          sortDesc={Boolean(settings.sort_desc)}
          onSortChange={handleSortChange}
          queues={queues}
          onAction={handleAction}
          onOpenModal={openModal}
        />
      </div>

      <StatusBar
        state={appState}
        downloads={downloads}
        onOpenSettings={(t) => openModal('settings', t)}
        onToast={addToast}
        tr={tr}
      />

      <ClipboardToast
        url={clipboardUrl}
        tr={tr}
        onDismiss={() => setClipboardUrl('')}
        onDownload={(u) => {
          setClipboardUrl('');
          openModal('add', { url: u });
        }}
      />

      {/* Toast stack */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', bottom: '42px', left: '16px', zIndex: 350, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {toasts.map((t) => (
            <div
              key={t.id}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                background: t.level === 'error' ? '#991b1b' : 'var(--bg-tertiary)',
                color: '#ffffff',
                border: `1px solid ${t.level === 'error' ? '#f87171' : 'var(--accent-primary)'}`,
                boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
              }}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {modal?.name === 'add' && (
        <AddDownloadModal
          initialData={modal.data}
          settings={settings}
          queues={queues}
          tr={tr}
          onClose={() => setModal(null)}
          onAdded={(res, startNow) => {
            if (res?.download) {
              upsertDownload(res.download);
            }
            if (startNow && res?.download) {
              setSelectedIds([res.download.id]);
              setModal({ name: 'progress', data: res.download });
            } else {
              setModal(null);
            }
            fetchState();
          }}
          onSwitchToTorrent={(src) => openModal('torrent', { source: src })}
          onSelectExisting={(id) => {
            setView('all');
            setSelectedIds([id]);
          }}
        />
      )}

      {modal?.name === 'progress' && liveProgressDownload && (
        <ProgressModal
          download={liveProgressDownload}
          tr={tr}
          onClose={() => setModal(null)}
          onRefreshState={fetchState}
          onToast={addToast}
        />
      )}

      {modal?.name === 'settings' && (
        <SettingsModal
          settings={settings}
          initialTab={modal.data}
          tr={tr}
          onClose={() => setModal(null)}
          onSaved={fetchState}
          onOpenBrowsers={() => openModal('browsers')}
          onToast={addToast}
        />
      )}

      {modal?.name === 'batch' && (
        <BatchDownloadModal
          initialLinksText={modal.data?.linksText || ''}
          settings={settings}
          queues={queues}
          tr={tr}
          onClose={() => setModal(null)}
          onAdded={() => fetchState()}
          onToast={addToast}
        />
      )}

      {modal?.name === 'grabber' && (
        <GrabberModal
          initialData={modal.data}
          settings={settings}
          queues={queues}
          tr={tr}
          onClose={() => setModal(null)}
          onToast={addToast}
        />
      )}

      {modal?.name === 'playlist' && (
        <PlaylistModal
          initialUrl={modal.data?.url || ''}
          settings={settings}
          tr={tr}
          onClose={() => setModal(null)}
          onToast={addToast}
        />
      )}

      {modal?.name === 'clip' && (
        <ClipModal
          initialUrl={modal.data?.url || ''}
          settings={settings}
          tr={tr}
          onClose={() => setModal(null)}
          onAdded={(res) => {
            if (res?.download) {
              upsertDownload(res.download);
              setSelectedIds([res.download.id]);
              setModal({ name: 'progress', data: res.download });
            } else {
              setModal(null);
            }
            fetchState();
          }}
          onToast={addToast}
        />
      )}

      {modal?.name === 'torrent' && (
        <TorrentModal
          initialSource={modal.data?.source || ''}
          settings={settings}
          tr={tr}
          onClose={() => setModal(null)}
          onAdded={(res, startNow) => {
            if (res?.download) {
              upsertDownload(res.download);
            }
            if (startNow && res?.download) {
              setSelectedIds([res.download.id]);
              setModal({ name: 'progress', data: res.download });
            } else {
              setModal(null);
            }
            fetchState();
          }}
          onToast={addToast}
        />
      )}

      {modal?.name === 'scheduler' && (
        <SchedulerModal
          queues={queues}
          initialQueueId={modal.data?.queueId || null}
          tr={tr}
          onClose={() => setModal(null)}
          onRefreshState={fetchState}
          onToast={addToast}
        />
      )}

      {modal?.name === 'browsers' && (
        <BrowserModal tr={tr} onClose={() => setModal(null)} onToast={addToast} />
      )}

      {modal?.name === 'columns' && (
        <ColumnsModal settings={settings} tr={tr} onClose={() => setModal(null)} onSaved={fetchState} />
      )}

      {modal?.name === 'category' && (
        <CategoryModal category={modal.data} tr={tr} onClose={() => setModal(null)} onSaved={fetchState} onToast={addToast} />
      )}

      {modal?.name === 'properties' && modal.data && (
        <PropertiesModal download={modal.data} queues={queues} tr={tr} onClose={() => setModal(null)} onSaved={fetchState} onToast={addToast} />
      )}

      {modal?.name === 'refresh' && modal.data && (
        <RefreshUrlModal
          download={modal.data}
          tr={tr}
          onClose={() => setModal(null)}
          onSaved={(res) => {
            if (res?.download) {
              upsertDownload(res.download);
              setSelectedIds([res.download.id]);
              setModal({ name: 'progress', data: res.download });
            } else {
              setModal(null);
            }
            fetchState();
          }}
          onToast={addToast}
        />
      )}

      {modal?.name === 'move' && modal.data && (
        <MoveRenameModal download={modal.data} tr={tr} onClose={() => setModal(null)} onSaved={fetchState} onToast={addToast} />
      )}

      {modal?.name === 'find' && (
        <FindModal initialQuery={searchQuery} onSearch={setSearchQuery} tr={tr} onClose={() => setModal(null)} />
      )}

      {modal?.name === 'complete' && modal.data && (
        <CompleteModal download={modal.data} tr={tr} onToast={addToast} onClose={() => setModal(null)} />
      )}

      {modal?.name === 'pair' && modal.data && (
        <PairConfirmModal
          req={modal.data}
          tr={tr}
          onRespond={async (pairId, allow) => {
            await api.respondPair(pairId, allow).catch(() => {});
            setModal(null);
          }}
        />
      )}

      {modal?.name === 'delete_confirm' && modal.data && (
        <DeleteConfirmModal
          count={modal.data.ids.length}
          defaultDeleteFiles={settings.remove_deletes_files}
          tr={tr}
          onClose={() => setModal(null)}
          onConfirm={async (deleteFile) => {
            const ids = modal.data.ids;
            setModal(null);
            await api.doAction({ action: 'delete', ids, delete_file: deleteFile });
            setSelectedIds((prev) => prev.filter((x) => !ids.includes(x)));
            fetchState();
          }}
        />
      )}

      {modal?.name === 'sha256' && modal.data && (
        <Sha256Modal result={modal.data} tr={tr} onClose={() => setModal(null)} />
      )}

      {['about', 'shortcuts', 'whatsnew', 'update'].includes(modal?.name) && (
        <InfoTextModal
          mode={modal.name}
          infoTexts={infoTexts}
          version={appState?.version}
          tr={tr}
          onClose={() => setModal(null)}
          onToast={addToast}
        />
      )}

      {updatePromptVer && (
        <UpdatePromptModal
          currentVersion={appState?.version}
          newVersion={updatePromptVer}
          tr={tr}
          onLater={() => setUpdatePromptVer('')}
          onUpdate={() => {
            setUpdatePromptVer('');
            api.updateInstallApp().catch((e) => addToast(e.message, 'error'));
            openModal('update');
          }}
        />
      )}
    </div>
  );
}
