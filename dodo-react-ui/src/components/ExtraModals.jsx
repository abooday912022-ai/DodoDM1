import React, { useEffect, useState } from 'react';
import {
  X, Compass, Wrench, RefreshCw, ShieldAlert, CheckCircle2, Info, Search,
  Columns, FolderEdit, Link2, Keyboard, Sparkles, Download, ExternalLink, Copy
} from 'lucide-react';
import { api } from '../api';

export function BrowserModal({ onClose, onToast, tr }) {
  const [data, setData] = useState(null);
  const [testing, setTesting] = useState(false);
  const [installInfo, setInstallInfo] = useState(null);

  const load = async () => {
    try {
      setData(await api.getBrowsers());
    } catch (e) {
      onToast?.(e.message, 'error');
    }
  };
  useEffect(() => { load(); }, []);

  const act = async (action, index = 0, browserName = '') => {
    try {
      if (action === 'test_link') setTesting(true);
      const r = await api.browserAction(action, index);
      if (r?.steps || r?.folder) {
        setInstallInfo({
          browser: browserName,
          folder: r.folder || data?.extension_folder || '',
          steps: r.steps || '',
        });
      }
      if (r?.message) onToast?.(r.message);
      await load();
    } catch (e) {
      onToast?.(e.message, 'error');
    } finally {
      setTesting(false);
    }
  };

  const folderPath = installInfo?.folder || data?.extension_folder || '';
  const copyFolder = async () => {
    if (!folderPath) return;
    try {
      await navigator.clipboard?.writeText(folderPath);
      onToast?.(tr('Copied to clipboard'));
    } catch { /* ignore */ }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel w-[640px] max-w-[95vw] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl">
          <div className="flex items-center gap-2 font-semibold text-[var(--text)]">
            <Compass size={16} className="text-[var(--accent)]" />
            <span>{tr('Browser Integration')}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--row-hover)] text-[var(--muted)]"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto text-[13px]">
          <div className="space-y-2">
            {(data?.browsers || []).map((b) => (
              <div key={b.index} className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--panel-elev)] border border-[var(--border)]">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: b.color || '#22d3ee' }} />
                  <span className="font-medium">{b.name}</span>
                  <span className="text-[11px] text-[var(--muted)]">
                    {b.installed ? tr('Detected') : tr('Not detected')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => act('add', b.index, b.name)}
                  className="px-3 py-1 rounded bg-[var(--accent)] text-[var(--on-accent)] text-[12px] font-medium"
                >
                  {b.firefox ? tr('Install Add-on (.xpi)') : tr('Add to Browser')}
                </button>
              </div>
            ))}
          </div>

          {installInfo?.steps && (
            <div className="p-3 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent)] space-y-1.5">
              <div className="font-semibold text-[12px] text-[var(--accent)]">
                {installInfo.browser ? `${installInfo.browser} — ` : ''}{tr('Installation Steps')}
              </div>
              <div className="text-[12px] whitespace-pre-wrap leading-relaxed text-[var(--text)]">
                {installInfo.steps}
              </div>
            </div>
          )}

          {folderPath && (
            <div className="p-2.5 rounded-lg bg-[var(--panel-elev)] border border-[var(--border)] space-y-1.5">
              <div className="text-[11px] text-[var(--muted)]">{tr('Extension Folder')}</div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={folderPath}
                  dir="ltr"
                  className="flex-1 px-2.5 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px] font-mono text-[var(--text)]"
                />
                <button
                  type="button"
                  onClick={copyFolder}
                  className="px-2.5 py-1 rounded border border-[var(--border)] hover:border-[var(--accent)] text-[12px] flex items-center gap-1 shrink-0"
                >
                  <Copy size={12} /> <span>{tr('Copy Path')}</span>
                </button>
              </div>
            </div>
          )}

          <div className="text-[11px] text-[var(--muted)] leading-relaxed">
            {tr('Note: Chrome, Edge, Brave, and Opera require loading local extensions via Developer Mode unless the extension is published on the browser store.')}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => act('open_folder')} className="px-3 py-1.5 rounded border border-[var(--border)] hover:border-[var(--accent)] text-[12px]">
              {tr('Open Extension Folder')}
            </button>
            <button type="button" onClick={() => act('repair')} className="px-3 py-1.5 rounded border border-[var(--border)] hover:border-[var(--accent)] text-[12px] flex items-center gap-1.5">
              <Wrench size={13} /> <span>{tr('Repair Extension')}</span>
            </button>
            <button type="button" onClick={() => act('reinstall_host')} className="px-3 py-1.5 rounded border border-[var(--border)] hover:border-[var(--accent)] text-[12px] flex items-center gap-1.5">
              <RefreshCw size={13} /> <span>{tr('Reinstall Native Host')}</span>
            </button>
            <button type="button" disabled={testing} onClick={() => act('test_link')} className="px-3 py-1.5 rounded border border-[var(--border)] hover:border-[var(--accent)] text-[12px]">
              {testing ? tr('Testing...') : tr('Test Link')}
            </button>
          </div>

          {data?.link_report && (
            <pre className="p-2.5 rounded bg-[var(--panel-elev)] border border-[var(--border)] text-[11px] font-mono whitespace-pre-wrap" dir="ltr">
              {data.link_report}
            </pre>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--panel-elev)] rounded-b-xl flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-1.5 rounded border border-[var(--border)] text-[13px]">{tr('Close')}</button>
        </div>
      </div>
    </div>
  );
}

export function ColumnsModal({ settings, onClose, onSaved, tr }) {
  const all = settings?.all_columns || ['name', 'size', 'status', 'progress', 'time_left', 'speed', 'added', 'last_try', 'category', 'save_to', 'description'];
  const [selected, setSelected] = useState(new Set(settings?.columns || all));

  const toggle = (c) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(c) && next.size > 1) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const save = async () => {
    await api.saveSettings({ columns: all.filter((c) => selected.has(c)) });
    onSaved?.();
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel w-[400px] max-w-[95vw] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl">
          <span className="flex items-center gap-2 font-semibold"><Columns size={15} className="text-[var(--accent)]" /> {tr('Choose Columns')}</span>
          <button onClick={onClose} className="text-[var(--muted)]"><X size={16} /></button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-2 text-[13px]">
          {all.map((col) => (
            <label key={col} className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-[var(--row-hover)]">
              <input type="checkbox" checked={selected.has(col)} onChange={() => toggle(col)} />
              <span>{tr(col)}</span>
            </label>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={onClose} className="px-3.5 py-1.5 rounded border border-[var(--border)] text-[13px]">{tr('Cancel')}</button>
          <button onClick={save} className="px-4 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] text-[13px] font-medium">{tr('Save')}</button>
        </div>
      </div>
    </div>
  );
}

export function CategoryModal({ category, onClose, onSaved, onToast, tr }) {
  const [name, setName] = useState(category?.name || '');
  const [exts, setExts] = useState((category?.exts || []).join(' '));
  const [sites, setSites] = useState((category?.sites || []).join(' '));
  const [dir, setDir] = useState(category?.dir || '');

  const save = async () => {
    try {
      await api.categorySave({ old_name: category?.name || undefined, name, exts, sites, dir });
      onToast?.(tr('Category saved'));
      onSaved?.();
      onClose();
    } catch (e) {
      onToast?.(e.message, 'error');
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel w-[460px] max-w-[95vw] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl">
          <span className="flex items-center gap-2 font-semibold"><FolderEdit size={15} className="text-[var(--accent)]" /> {category ? tr('Edit Category') : tr('New Category')}</span>
          <button onClick={onClose} className="text-[var(--muted)]"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3 text-[13px]">
          <div>
            <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Category Name')}</label>
            <input type="text" disabled={Boolean(category?.builtin)} value={name} onChange={(e) => setName(e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
          </div>
          <div>
            <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('File types (space-separated)')}</label>
            <input type="text" dir="ltr" value={exts} onChange={(e) => setExts(e.target.value)} placeholder="iso img dmg" className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
          </div>
          <div>
            <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Sites (optional)')}</label>
            <input type="text" dir="ltr" value={sites} onChange={(e) => setSites(e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
          </div>
          <div>
            <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Default Folder')}</label>
            <div className="flex gap-2">
              <input type="text" dir="ltr" value={dir} onChange={(e) => setDir(e.target.value)} className="flex-1 px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
              <button type="button" onClick={() => api.pickFolder(dir).then((r) => r?.path && setDir(r.path)).catch(() => {})} className="px-3 py-1 rounded border border-[var(--border)]">{tr('Browse')}</button>
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={onClose} className="px-3.5 py-1.5 rounded border border-[var(--border)]">{tr('Cancel')}</button>
          <button onClick={save} className="px-4 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] font-medium">{tr('Save')}</button>
        </div>
      </div>
    </div>
  );
}

export function PropertiesModal({ download, queues, onClose, onSaved, onToast, tr }) {
  const [url, setUrl] = useState(download?.url || '');
  const [saveDir, setSaveDir] = useState(download?.save_dir || '');
  const [fileName, setFileName] = useState(download?.file_name || '');
  const [referer, setReferer] = useState(download?.referer || '');
  const [description, setDescription] = useState(download?.description || '');
  const [checksum, setChecksum] = useState(download?.checksum || '');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [queue, setQueue] = useState(download?.queue ? String(download.queue) : '');

  const save = async () => {
    try {
      await api.doAction({
        action: 'update_properties',
        ids: [download.id],
        url,
        save_dir: saveDir,
        file_name: fileName,
        referer,
        description,
        checksum,
        user: user || undefined,
        password: password || undefined,
      });
      await api.doAction({ action: 'set_queue', ids: [download.id], queue: queue ? Number(queue) : null });
      onToast?.(tr('Properties updated'));
      onSaved?.();
      onClose();
    } catch (e) {
      onToast?.(e.message, 'error');
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel w-[540px] max-w-[95vw] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl">
          <span className="font-semibold">{tr('Properties')} — {download?.file_name}</span>
          <button onClick={onClose} className="text-[var(--muted)]"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-2.5 text-[12px] overflow-y-auto max-h-[75vh]">
          <div className="grid grid-cols-3 gap-2 text-[var(--muted)] bg-[var(--panel-elev)] p-2 rounded">
            <span>{tr('Size')}: <strong className="text-[var(--text)]">{download?.total_size_fmt || '?'}</strong></span>
            <span>{tr('Added')}: <strong className="text-[var(--text)]">{download?.added_at}</strong></span>
            <span>{tr('Category')}: <strong className="text-[var(--text)]">{tr(download?.category || 'General')}</strong></span>
          </div>
          <div>
            <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Address (URL)')}</label>
            <input type="text" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('File Name')}</label>
              <input type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Queue')}</label>
              <select value={queue} onChange={(e) => setQueue(e.target.value)} className="w-full px-2 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]">
                <option value="">{tr('None')}</option>
                {(queues || []).map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Save To')}</label>
            <div className="flex gap-2">
              <input type="text" dir="ltr" value={saveDir} onChange={(e) => setSaveDir(e.target.value)} className="flex-1 px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
              <button type="button" onClick={() => api.pickFolder(saveDir).then((r) => r?.path && setSaveDir(r.path)).catch(() => {})} className="px-3 py-1 rounded border border-[var(--border)]">{tr('Browse')}</button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Referer')}</label>
            <input type="text" dir="ltr" value={referer} onChange={(e) => setReferer(e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
          </div>
          <div>
            <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Description')}</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
          </div>
          <div>
            <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('SHA-256 Checksum')}</label>
            <input type="text" dir="ltr" value={checksum} onChange={(e) => setChecksum(e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder={tr('New Username (optional)')} value={user} onChange={(e) => setUser(e.target.value)} className="px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
            <input type="password" placeholder={tr('New Password (optional)')} value={password} onChange={(e) => setPassword(e.target.value)} className="px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
          </div>
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={onClose} className="px-3.5 py-1.5 rounded border border-[var(--border)]">{tr('Cancel')}</button>
          <button onClick={save} className="px-4 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] font-medium">{tr('Save')}</button>
        </div>
      </div>
    </div>
  );
}

export function RefreshUrlModal({ download, onClose, onSaved, onToast, tr }) {
  const [url, setUrl] = useState(download?.url || '');
  const submit = async () => {
    try {
      const res = await api.doAction({ action: 'refresh_url', ids: [download.id], url });
      onToast?.(tr('Address refreshed & download resumed'));
      if (onSaved) {
        await onSaved(res);
      } else {
        onClose();
      }
    } catch (e) {
      onToast?.(e.message, 'error');
    }
  };
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel w-[500px] max-w-[95vw] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl">
          <span className="flex items-center gap-2 font-semibold"><Link2 size={15} className="text-[var(--accent)]" /> {tr('Refresh Download Address')}</span>
          <button onClick={onClose} className="text-[var(--muted)]"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-2.5 text-[13px]">
          <p className="text-[12px] text-[var(--muted)]">{tr('Paste the fresh link to resume this expired download without losing already downloaded bytes:')}</p>
          <input type="text" dir="ltr" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={onClose} className="px-3.5 py-1.5 rounded border border-[var(--border)]">{tr('Cancel')}</button>
          <button onClick={submit} className="px-4 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] font-medium">{tr('Resume with New URL')}</button>
        </div>
      </div>
    </div>
  );
}

export function CompleteModal({ download, onClose, onToast, tr }) {
  if (!download) return null;
  const act = async (action) => {
    try {
      await api.doAction({ action, ids: [download.id] });
      onClose();
    } catch (e) {
      onToast?.(e.message || tr('Action failed'), 'error');
    }
  };
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel w-[460px] max-w-[95vw] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl">
          <span className="flex items-center gap-2 font-semibold text-emerald-400"><CheckCircle2 size={16} /> {tr('Download complete')}</span>
          <button onClick={onClose} className="text-[var(--muted)]"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-2 text-[13px]">
          <div className="font-semibold break-all">{download.file_name}</div>
          <div className="text-[12px] text-[var(--muted)]">{tr('Size')}: {download.total_size_fmt || download.downloaded_fmt}</div>
          <div className="text-[11px] text-[var(--muted)] break-all" dir="ltr">{download.save_path}</div>
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] flex flex-wrap justify-end gap-2 text-[12px]">
          <button onClick={() => act('open')} className="px-3.5 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] font-medium">{tr('Open / Play Now')}</button>
          <button onClick={() => act('open_with')} className="px-3 py-1.5 rounded border border-[var(--border)]">{tr('Open with...')}</button>
          <button onClick={() => act('open_folder')} className="px-3 py-1.5 rounded border border-[var(--border)]">{tr('Open Folder')}</button>
          <button onClick={onClose} className="px-3 py-1.5 rounded border border-[var(--border)]">{tr('Close')}</button>
        </div>
      </div>
    </div>
  );
}

export function PairConfirmModal({ req, onRespond, tr }) {
  if (!req) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal-panel w-[440px] max-w-[95vw] flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl font-semibold text-amber-300">
          <ShieldAlert size={16} /> <span>{tr('Browser Extension Pairing')}</span>
        </div>
        <div className="p-4 space-y-2 text-[13px]">
          <p>{tr('A browser extension wants to connect to DODO DM1:')}</p>
          <div className="p-2.5 rounded bg-[var(--panel-elev)] border border-[var(--border)] text-[12px] font-mono" dir="ltr">
            {req.browser} ({req.id})
          </div>
          <p className="text-[11px] text-[var(--muted)]">{tr('Allow only if you just clicked the DODO DM1 icon in your browser.')}</p>
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2 text-[12px]">
          <button onClick={() => onRespond(req.pair_id, false)} className="px-3.5 py-1.5 rounded border border-[var(--border)]">{tr('Deny')}</button>
          <button onClick={() => onRespond(req.pair_id, true)} className="px-4 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] font-medium">{tr('Allow')}</button>
        </div>
      </div>
    </div>
  );
}

function fmtMb(bytes) {
  const n = Number(bytes) || 0;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function UpdatePromptModal({ currentVersion, newVersion, onUpdate, onLater, tr }) {
  if (!newVersion) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onLater()}>
      <div className="modal-panel w-[440px] max-w-[95vw] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl">
          <div className="flex items-center gap-2 font-semibold text-[var(--text)]">
            <Sparkles size={16} className="text-[var(--accent)]" />
            <span>{tr('New Update Available')}</span>
          </div>
          <button onClick={onLater} className="p-1 rounded hover:bg-[var(--row-hover)] text-[var(--muted)]"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-3 text-[13px]">
          <p className="text-[var(--text)] leading-relaxed">
            {tr('A new version of DODO DM1 is available. Do you want to download and install it now?')}
          </p>
          <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-[var(--panel-elev)] border border-[var(--border)] text-[12px]">
            <div>
              <div className="text-[11px] text-[var(--muted)]">{tr('Current version')}</div>
              <div className="font-semibold font-mono" dir="ltr">v{currentVersion || '1.0.12'}</div>
            </div>
            <div>
              <div className="text-[11px] text-[var(--muted)]">{tr('New version')}</div>
              <div className="font-semibold font-mono text-[var(--accent)]" dir="ltr">v{newVersion}</div>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--panel-elev)] rounded-b-xl flex justify-end gap-2">
          <button
            type="button"
            onClick={onLater}
            className="px-4 py-1.5 rounded border border-[var(--border)] text-[13px] hover:bg-[var(--row-hover)]"
          >
            {tr('Later')}
          </button>
          <button
            type="button"
            onClick={onUpdate}
            className="px-4 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download size={14} /> <span>{tr('Update')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function InfoTextModal({ mode, infoTexts, version, onClose, onToast, tr }) {
  const [upd, setUpd] = useState(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceInit, setSourceInit] = useState(false);

  useEffect(() => {
    if (mode !== 'update') {
      setSourceInit(false);
      return;
    }
    let active = true;
    const syncOnce = async () => {
      try {
        const s = await api.updateState();
        if (!active) return;
        setUpd(s);
        if (!sourceInit && typeof s.source_url === 'string') {
          setSourceUrl(s.source_url);
          setSourceInit(true);
        }
        return s;
      } catch {
        return null;
      }
    };
    (async () => {
      const s = await syncOnce();
      if (active && !s?.downloading) {
        await api.updateCheckApp({}).catch(() => {});
        await syncOnce();
      }
    })();
    const poll = setInterval(() => { syncOnce(); }, 450);
    return () => {
      active = false;
      clearInterval(poll);
    };
  }, [mode]);

  const checkWithSource = async (customUrl = sourceUrl) => {
    try {
      await api.updateCheckApp({ update_url: customUrl });
      const s = await api.updateState();
      setUpd(s);
    } catch (e) {
      onToast?.(e.message, 'error');
    }
  };

  const browseManifest = async () => {
    try {
      const r = await api.pickFile('version.json', ['json']);
      if (r?.path) {
        setSourceUrl(r.path);
        await checkWithSource(r.path);
      }
    } catch { /* canceled */ }
  };

  const startInstall = async () => {
    try {
      await api.updateInstallApp();
      const s = await api.updateState();
      setUpd(s);
    } catch (e) {
      onToast?.(e.message, 'error');
    }
  };

  if (!mode) return null;

  const whatsNew = infoTexts?.whats_new || [];
  const pct = typeof upd?.progress === 'number' && upd.progress >= 0 ? Math.min(100, Math.round(upd.progress)) : null;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel w-[540px] max-w-[95vw] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl">
          <div className="flex items-center gap-2 font-semibold">
            {mode === 'about' && <Info size={16} className="text-[var(--accent)]" />}
            {mode === 'shortcuts' && <Keyboard size={16} className="text-[var(--accent)]" />}
            {mode === 'whatsnew' && <Sparkles size={16} className="text-[var(--accent)]" />}
            {mode === 'update' && <RefreshCw size={16} className="text-[var(--accent)]" />}
            <span>
              {mode === 'about' ? tr('About DODO DM1')
                : mode === 'shortcuts' ? tr('Keyboard Shortcuts')
                : mode === 'whatsnew' ? tr("What's New")
                : tr('Check for Updates')}
            </span>
          </div>
          <button onClick={onClose} className="text-[var(--muted)]"><X size={16} /></button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3 text-[13px]">
          {mode === 'about' && (
            <div className="flex flex-col items-center text-center space-y-3 py-2">
              <img src="./logo.png" alt="DODO DM1" style={{ width: '64px', height: '64px', objectFit: 'contain' }} />
              <div>
                <div className="text-[18px] font-bold">DODO DM1</div>
                <div className="text-[12px] text-[var(--muted)]">{tr('Version')} {version || infoTexts?.version || '1.0.12'}</div>
              </div>
              <p className="text-[12px] text-[var(--muted)] max-w-md">
                {tr('High-speed segmented multi-connection download manager with video capture, torrent/magnet support, site grabber, playlists, scheduler, and full browser integration.')}
              </p>
              <a
                href="https://github.com/dododm1"
                onClick={(e) => { e.preventDefault(); }}
                className="text-[11px] text-[var(--muted)] flex items-center gap-1"
              >
                <ExternalLink size={11} /> DODO DM1 Desktop Edition
              </a>
            </div>
          )}

          {mode === 'shortcuts' && (
            <pre className="p-3 rounded bg-[var(--panel-elev)] border border-[var(--border)] text-[12px] whitespace-pre-wrap font-mono leading-relaxed">
              {infoTexts?.shortcuts || ''}
            </pre>
          )}

          {mode === 'whatsnew' && (
            <div className="space-y-2.5">
              {whatsNew.map((entry, idx) => {
                const isPair = Array.isArray(entry);
                const ver = isPair ? entry[0] : null;
                const text = isPair ? entry[1] : String(entry || '');
                return (
                  <div key={ver || idx} className="p-3 rounded bg-[var(--panel-elev)] border border-[var(--border)]">
                    {ver && <div className="font-semibold text-[var(--accent)] mb-1">v{ver}</div>}
                    <div className="text-[12px] whitespace-pre-wrap text-[var(--text)]">{text}</div>
                  </div>
                );
              })}
            </div>
          )}

          {mode === 'update' && (
            <div className="space-y-3 py-1">
              <div className="p-3 rounded-lg bg-[var(--panel-elev)] border border-[var(--border)] text-center space-y-2.5">
                <div className="text-[11px] text-[var(--muted)]">
                  {tr('Current version')}: <span className="font-mono font-semibold text-[var(--text)]" dir="ltr">v{version || infoTexts?.version || '1.0.12'}</span>
                </div>
                <div className="text-[13px] font-semibold text-[var(--text)]">
                  {upd?.message || tr('Checking for updates...')}
                </div>

                {upd?.downloading && (
                  <div className="space-y-1.5 pt-1">
                    <div className="w-full h-2.5 rounded-full bg-[var(--border)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] transition-all duration-200"
                        style={{ width: `${pct !== null ? pct : 35}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-[var(--muted)] font-mono" dir="ltr">
                      {upd.setup_bytes ? `${fmtMb(upd.downloaded_bytes)} / ${fmtMb(upd.setup_bytes)} (${pct ?? 0}%)` : fmtMb(upd.downloaded_bytes)}
                    </div>
                  </div>
                )}

                {upd?.error && (
                  <div className="p-2 rounded bg-red-500/10 border border-red-500/40 text-red-400 text-[11px] text-start break-all" dir="ltr">
                    {upd.error}
                  </div>
                )}

                {upd?.latest_version && !upd?.downloading && (
                  <button
                    type="button"
                    onClick={startInstall}
                    className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] font-semibold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Download size={14} /> <span>{tr('Update')} (v{upd.latest_version})</span>
                  </button>
                )}
              </div>

              <div className="p-3 rounded-lg bg-[var(--panel-elev)] border border-[var(--border)] space-y-2">
                <label className="block text-[11px] text-[var(--muted)]">
                  {tr('Update source URL or folder (version.json)')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://.../version.json  |  C:\Updates\version.json"
                    dir="ltr"
                    className="flex-1 px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px] text-[var(--text)]"
                  />
                  <button
                    type="button"
                    onClick={browseManifest}
                    className="px-2.5 py-1.5 rounded border border-[var(--border)] hover:border-[var(--accent)] text-[12px] shrink-0"
                  >
                    {tr('Browse file')}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(upd?.checking || upd?.downloading)}
                    onClick={() => checkWithSource(sourceUrl)}
                    className="px-3 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] text-[12px] font-medium shrink-0"
                  >
                    {tr('Check Now')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 rounded border border-[var(--border)] text-[13px]">{tr('Close')}</button>
        </div>
      </div>
    </div>
  );
}


export function MoveRenameModal({ download, onClose, onSaved, onToast, tr }) {
  const [fileName, setFileName] = useState(download?.file_name || '');
  const [saveDir, setSaveDir] = useState(download?.save_dir || '');
  const [description, setDescription] = useState(download?.description || '');

  const save = async () => {
    try {
      await api.doAction({
        action: 'move_rename',
        ids: [download.id],
        file_name: fileName,
        save_dir: saveDir,
        description,
      });
      onToast?.(tr('File moved / renamed'));
      onSaved?.();
      onClose();
    } catch (e) {
      onToast?.(e.message, 'error');
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel w-[460px] max-w-[95vw] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl">
          <span className="font-semibold">{tr('Move / Rename')}</span>
          <button onClick={onClose} className="text-[var(--muted)]"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3 text-[13px]">
          <div>
            <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('File Name')}</label>
            <input type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
          </div>
          <div>
            <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Save To')}</label>
            <div className="flex gap-2">
              <input type="text" dir="ltr" value={saveDir} onChange={(e) => setSaveDir(e.target.value)} className="flex-1 px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
              <button type="button" onClick={() => api.pickFolder(saveDir).then((r) => r?.path && setSaveDir(r.path)).catch(() => {})} className="px-3 py-1 rounded border border-[var(--border)]">{tr('Browse')}</button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Description')}</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
          </div>
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={onClose} className="px-3.5 py-1.5 rounded border border-[var(--border)]">{tr('Cancel')}</button>
          <button onClick={save} className="px-4 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] font-medium">{tr('Save')}</button>
        </div>
      </div>
    </div>
  );
}

export function DeleteConfirmModal({ count, defaultDeleteFiles, onConfirm, onClose, tr }) {
  const [deleteFile, setDeleteFile] = useState(Boolean(defaultDeleteFiles));
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel w-[420px] max-w-[95vw] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl">
          <span className="font-semibold">{tr('Confirm Delete')}</span>
          <button onClick={onClose} className="text-[var(--muted)]"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3 text-[13px]">
          <p>{tr('Remove')} <strong>{count}</strong> {tr('selected item(s) from the download list?')}</p>
          <label className="flex items-center gap-2 text-[12px] cursor-pointer text-amber-300">
            <input type="checkbox" checked={deleteFile} onChange={(e) => setDeleteFile(e.target.checked)} />
            <span>{tr('Also delete completed downloaded files from disk')}</span>
          </label>
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={onClose} className="px-3.5 py-1.5 rounded border border-[var(--border)]">{tr('Cancel')}</button>
          <button onClick={() => onConfirm(deleteFile)} className="px-4 py-1.5 rounded bg-red-600 text-white font-medium">{tr('Delete')}</button>
        </div>
      </div>
    </div>
  );
}

export function Sha256Modal({ result, onClose, tr }) {
  if (!result) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel w-[520px] max-w-[95vw] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl">
          <span className="font-semibold">{tr('Verify SHA-256')} — {result.file_name}</span>
          <button onClick={onClose} className="text-[var(--muted)]"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-2.5 text-[12px]">
          <div>
            <div className="text-[var(--muted)] mb-0.5">{tr('Computed SHA-256')}:</div>
            <div className="p-2 rounded bg-[var(--panel-elev)] border border-[var(--border)] font-mono break-all select-all" dir="ltr">{result.sha256}</div>
          </div>
          {result.expected && (
            <>
              <div>
                <div className="text-[var(--muted)] mb-0.5">{tr('Expected SHA-256')}:</div>
                <div className="p-2 rounded bg-[var(--panel-elev)] border border-[var(--border)] font-mono break-all select-all" dir="ltr">{result.expected}</div>
              </div>
              <div className={`font-semibold ${result.matched ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.matched ? tr('Checksum matches!') : tr('WARNING: Checksum mismatch!')}
              </div>
            </>
          )}
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 rounded border border-[var(--border)]">{tr('Close')}</button>
        </div>
      </div>
    </div>
  );
}


export function FindModal({ initialQuery = '', onSearch, onClose, tr }) {
  const [q, setQ] = useState(initialQuery);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel w-[420px] max-w-[95vw] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl">
          <span className="flex items-center gap-2 font-semibold"><Search size={15} className="text-[var(--accent)]" /> {tr('Find in Downloads')}</span>
          <button onClick={onClose} className="text-[var(--muted)]"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-2 text-[13px]">
          <input
            type="text"
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); onSearch(e.target.value); }}
            onKeyDown={(e) => e.key === 'Enter' && onClose()}
            placeholder={tr('Type file name, URL, or description...')}
            className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]"
          />
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={() => { onSearch(''); onClose(); }} className="px-3.5 py-1.5 rounded border border-[var(--border)]">{tr('Clear')}</button>
          <button onClick={onClose} className="px-4 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] font-medium">{tr('Done')}</button>
        </div>
      </div>
    </div>
  );
}
