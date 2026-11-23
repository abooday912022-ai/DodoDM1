import React, { useEffect, useMemo, useState } from 'react';
import { X, Globe, Play, Square, FolderOpen, Download, Loader2, CheckSquare } from 'lucide-react';
import { api } from '../api';

const FILTERS = [
  { id: 'all', label: 'All Files' },
  { id: 'images', label: 'Images' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
  { id: 'programs', label: 'Programs & Archives' },
  { id: 'documents', label: 'Documents' },
  { id: 'pages', label: 'Web Pages' },
];

export function GrabberModal({ initialData, settings, queues, onClose, onToast, tr }) {
  const [url, setUrl] = useState(initialData?.url || '');
  const [depth, setDepth] = useState(1);
  const [sameSite, setSameSite] = useState(true);
  const [noParent, setNoParent] = useState(true);
  const [saveDir, setSaveDir] = useState(settings?.download_dir || '');
  const [queueId, setQueueId] = useState('');
  const [filterKind, setFilterKind] = useState('all');
  const [grab, setGrab] = useState({ running: false, finished: false, pages_done: 0, pages_queued: 0, current_url: '', checking: 0, items: [] });
  const [selectedMap, setSelectedMap] = useState({});

  const refreshGrab = async () => {
    try {
      const s = await api.grabberState();
      setGrab(s);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    // If opened from browser "Download all links"
    if (initialData?.links && initialData.links.length > 0) {
      api.grabberStart({
        url: initialData.url || '',
        links: initialData.links,
        referer: initialData.referer,
        cookies: initialData.cookies,
        user_agent: initialData.userAgent,
      }).then(refreshGrab).catch((e) => onToast?.(e.message, 'error'));
    } else {
      refreshGrab();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!grab.running && grab.checking === 0) return;
    const t = setInterval(refreshGrab, 800);
    return () => clearInterval(t);
  }, [grab.running, grab.checking]);

  const startScan = async () => {
    if (!url.trim()) return;
    setSelectedMap({});
    try {
      await api.grabberStart({ url: url.trim(), depth: Number(depth), same_site: sameSite, no_parent: noParent });
      refreshGrab();
    } catch (e) {
      onToast?.(e.message || tr('Scan failed'), 'error');
    }
  };

  const stopScan = async () => {
    await api.grabberStop();
    refreshGrab();
  };

  const visibleItems = useMemo(() => {
    return (grab.items || []).filter((it) => {
      if (it.gone) return false;
      if (filterKind === 'all') return !it.is_page;
      if (filterKind === 'pages') return it.is_page;
      if (filterKind === 'images') return it.kind === 'image';
      if (filterKind === 'video') return it.kind === 'video';
      if (filterKind === 'audio') return it.kind === 'audio';
      if (filterKind === 'programs') return it.kind === 'program' || it.kind === 'archive';
      if (filterKind === 'documents') return it.kind === 'document';
      return true;
    });
  }, [grab.items, filterKind]);

  const isChecked = (it) => (selectedMap[it.url] !== undefined ? selectedMap[it.url] : !it.is_page);

  const toggleAllVisible = (checked) => {
    const next = { ...selectedMap };
    for (const it of visibleItems) next[it.url] = checked;
    setSelectedMap(next);
  };

  const checkedItems = visibleItems.filter((it) => isChecked(it));

  const handleDownload = async (startNow) => {
    if (checkedItems.length === 0) {
      onToast?.(tr('Check the files you want first.'), 'error');
      return;
    }
    try {
      const res = await api.grabberDownload({
        items: checkedItems.map((it) => ({ url: it.url, name: it.name, description: it.text || undefined })),
        save_dir: saveDir,
        queue: queueId ? Number(queueId) : undefined,
        start_now: startNow,
      });
      onToast?.(`${tr('Added')} ${res.count} ${tr('files')}`);
      onClose();
    } catch (e) {
      onToast?.(e.message, 'error');
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel w-[760px] max-w-[96vw] h-[600px] max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl">
          <div className="flex items-center gap-2 font-semibold text-[var(--text)]">
            <Globe size={16} className="text-[var(--accent)]" />
            <span>{tr('Site Grabber')}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--row-hover)] text-[var(--muted)]"><X size={16} /></button>
        </div>

        <div className="p-3 border-b border-[var(--border)] space-y-2.5 text-[12px]">
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              dir="ltr"
              placeholder="https://example.com/gallery/"
              className="flex-1 px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]"
            />
            {grab.running ? (
              <button type="button" onClick={stopScan} className="px-3.5 py-1.5 rounded bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1.5">
                <Square size={13} /> <span>{tr('Stop')}</span>
              </button>
            ) : (
              <button type="button" onClick={startScan} className="px-3.5 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] font-medium flex items-center gap-1.5">
                <Play size={13} /> <span>{tr('Start Scan')}</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-[12px]">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5">
                <span className="text-[var(--muted)]">{tr('Depth')}:</span>
                <select value={depth} onChange={(e) => setDepth(Number(e.target.value))} className="px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)]">
                  {[0, 1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={sameSite} onChange={(e) => setSameSite(e.target.checked)} />
                <span>{tr('Stay on same domain')}</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={noParent} onChange={(e) => setNoParent(e.target.checked)} />
                <span>{tr('Do not ascend above start folder')}</span>
              </label>
            </div>
            <div className="text-[11px] text-[var(--muted)] flex items-center gap-1.5">
              {(grab.running || grab.checking > 0) && <Loader2 size={12} className="animate-spin text-[var(--accent)]" />}
              <span>{tr('Pages')}: {grab.pages_done} • {tr('Found')}: {grab.items?.length || 0}</span>
            </div>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--panel-elev)] border-b border-[var(--border)] gap-2 overflow-x-auto text-[11px]">
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterKind(f.id)}
                className={`px-2.5 py-1 rounded-full border ${
                  filterKind === f.id
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)] font-medium'
                    : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {tr(f.label)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => toggleAllVisible(true)} className="text-[var(--accent)] hover:underline">{tr('Check all')}</button>
            <button type="button" onClick={() => toggleAllVisible(false)} className="text-[var(--muted)] hover:underline">{tr('Uncheck all')}</button>
          </div>
        </div>

        {/* Items Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-[var(--panel-elev)] text-[var(--muted)] sticky top-0 border-b border-[var(--border)]">
              <tr>
                <th className="w-8 p-2"><CheckSquare size={13} /></th>
                <th className="text-start p-2">{tr('File Name')}</th>
                <th className="text-start p-2 w-24">{tr('Type')}</th>
                <th className="text-start p-2 w-24">{tr('Size')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {visibleItems.map((it) => {
                const ck = isChecked(it);
                return (
                  <tr
                    key={it.index}
                    onClick={() => setSelectedMap((m) => ({ ...m, [it.url]: !ck }))}
                    className="hover:bg-[var(--row-hover)] cursor-pointer"
                  >
                    <td className="p-2 text-center">
                      <input type="checkbox" checked={ck} onChange={() => {}} />
                    </td>
                    <td className="p-2 max-w-[360px]">
                      <div className="truncate font-medium text-[var(--text)]">{it.name}</div>
                      <div className="truncate text-[10px] text-[var(--muted)]" dir="ltr">{it.url}</div>
                    </td>
                    <td className="p-2 text-[var(--muted)]">{it.ext || it.kind}</td>
                    <td className="p-2 text-[var(--muted)]">{it.size_fmt || '--'}</td>
                  </tr>
                );
              })}
              {visibleItems.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[var(--muted)]">
                    {grab.running ? tr('Scanning pages...') : tr('Enter a website URL and click Start Scan')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--panel-elev)] rounded-b-xl flex flex-wrap items-center justify-between gap-2 text-[12px]">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <input type="text" dir="ltr" value={saveDir} onChange={(e) => setSaveDir(e.target.value)} className="flex-1 px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
            <button
              type="button"
              onClick={() => api.pickFolder(saveDir).then((r) => r?.path && setSaveDir(r.path)).catch(() => {})}
              className="px-2.5 py-1 rounded border border-[var(--border)]"
            >
              <FolderOpen size={14} />
            </button>
            <select value={queueId} onChange={(e) => setQueueId(e.target.value)} className="px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)]">
              <option value="">{tr('No Queue')}</option>
              {(queues || []).map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => handleDownload(false)} className="px-3 py-1.5 rounded border border-[var(--border)] hover:border-[var(--accent)]">
              {tr('Add to Queue')} ({checkedItems.length})
            </button>
            <button type="button" onClick={() => handleDownload(true)} className="px-3.5 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] font-medium flex items-center gap-1.5">
              <Download size={14} /> <span>{tr('Download Selected')} ({checkedItems.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
