import React, { useEffect, useState } from 'react';
import { X, Magnet, FolderOpen, FileUp, Loader2, Play, Clock } from 'lucide-react';
import { api } from '../api';

export function TorrentModal({ initialSource = '', settings, onClose, onAdded, onToast, tr }) {
  const [source, setSource] = useState(initialSource);
  const [inspecting, setInspecting] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);
  const [checked, setChecked] = useState({});
  const [saveDir, setSaveDir] = useState(settings?.download_dir || '');

  const runInspect = async (src = source) => {
    const s = (src || '').trim();
    if (!s) return;
    setInspecting(true);
    setError('');
    setMeta(null);
    try {
      const res = await api.torrentInspect(s);
      if (res.done) {
        setMeta(res);
        if (res.suggested_folder) setSaveDir(res.suggested_folder);
        const ck = {};
        for (const f of res.files || []) ck[f.index] = true;
        setChecked(ck);
        setInspecting(false);
      }
    } catch (e) {
      setError(e.message || tr('Could not inspect torrent'));
      setInspecting(false);
    }
  };

  useEffect(() => {
    if (initialSource && initialSource.trim()) runInspect(initialSource);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!inspecting) return;
    const t = setInterval(async () => {
      try {
        const res = await api.torrentInspectStatus();
        if (res.done) {
          setInspecting(false);
          if (res.ok) {
            setMeta(res);
            if (res.uri) setSource(res.uri);
            if (res.suggested_folder) setSaveDir(res.suggested_folder);
            const ck = {};
            for (const f of res.files || []) ck[f.index] = true;
            setChecked(ck);
          } else {
            setError(res.error || tr('Failed to fetch magnet metadata'));
          }
        }
      } catch {
        setInspecting(false);
      }
    }, 900);
    return () => clearInterval(t);
  }, [inspecting, tr]);

  const pickTorrentFile = async () => {
    try {
      const r = await api.pickFile('Torrent files', ['torrent']);
      if (r?.path) {
        setSource(r.path);
        runInspect(r.path);
      }
    } catch { /* cancel */ }
  };

  const selectedIndices = (meta?.files || []).filter((f) => checked[f.index]).map((f) => f.index);

  const handleAdd = async (startNow) => {
    try {
      const select =
        meta?.files?.length && selectedIndices.length < meta.files.length
          ? selectedIndices.join(',')
          : undefined;
      const res = await api.torrentAdd({
        source: meta?.uri || source.trim(),
        save_dir: saveDir.trim() || settings?.download_dir || '',
        select,
        start_now: startNow,
      });
      onToast?.(tr('Torrent added'));
      if (onAdded) {
        await onAdded(res, startNow);
      } else {
        onClose();
      }
    } catch (e) {
      onToast?.(e.message, 'error');
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel w-[640px] max-w-[95vw] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl">
          <div className="flex items-center gap-2 font-semibold text-[var(--text)]">
            <Magnet size={16} className="text-[var(--accent)]" />
            <span>{tr('Open Torrent / Magnet Link')}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--row-hover)] text-[var(--muted)]"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1 text-[13px]">
          <div className="flex gap-2">
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              dir="ltr"
              placeholder="magnet:?xt=urn:btih:...  or C:\path\to\file.torrent"
              className="flex-1 px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]"
            />
            <button type="button" onClick={pickTorrentFile} className="px-3 py-1.5 rounded border border-[var(--border)] hover:border-[var(--accent)] flex items-center gap-1 text-[12px]">
              <FileUp size={13} /> <span>.torrent</span>
            </button>
            <button type="button" onClick={() => runInspect(source)} disabled={inspecting} className="px-3 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] text-[12px] font-medium flex items-center gap-1">
              {inspecting && <Loader2 size={13} className="animate-spin" />}
              <span>{tr('Inspect')}</span>
            </button>
          </div>

          {inspecting && (
            <div className="p-4 rounded bg-[var(--panel-elev)] border border-[var(--border)] flex items-center gap-2.5 text-[12px] text-[var(--muted)]">
              <Loader2 size={16} className="animate-spin text-[var(--accent)]" />
              <span>{tr('Fetching torrent metadata from peers & DHT...')}</span>
            </div>
          )}

          {error && <div className="px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-[12px]">{error}</div>}

          {meta && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-semibold text-[var(--text)] truncate">{meta.name}</span>
                <span className="text-[var(--muted)]">{meta.total_size_fmt || ''}</span>
              </div>

              <div className="flex justify-end gap-3 text-[11px]">
                <button type="button" onClick={() => setChecked(Object.fromEntries((meta.files || []).map((f) => [f.index, true])))} className="text-[var(--accent)] hover:underline">{tr('Select all')}</button>
                <button type="button" onClick={() => setChecked({})} className="text-[var(--muted)] hover:underline">{tr('Unselect all')}</button>
              </div>

              <div className="max-h-56 overflow-y-auto border border-[var(--border)] rounded divide-y divide-[var(--border)]">
                {(meta.files || []).map((f) => (
                  <label key={f.index} className="flex items-center justify-between px-2.5 py-1.5 hover:bg-[var(--row-hover)] cursor-pointer text-[12px] gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <input type="checkbox" checked={Boolean(checked[f.index])} onChange={(e) => setChecked((c) => ({ ...c, [f.index]: e.target.checked }))} />
                      <span className="truncate">{f.path}</span>
                    </span>
                    <span className="text-[11px] text-[var(--muted)] shrink-0">{f.size_fmt}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Save To')}</label>
            <div className="flex gap-2">
              <input type="text" dir="ltr" value={saveDir} onChange={(e) => setSaveDir(e.target.value)} className="flex-1 px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]" />
              <button type="button" onClick={() => api.pickFolder(saveDir).then((r) => r?.path && setSaveDir(r.path)).catch(() => {})} className="px-3 py-1.5 rounded border border-[var(--border)]">
                <FolderOpen size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--panel-elev)] rounded-b-xl flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded border border-[var(--border)] text-[13px]">{tr('Cancel')}</button>
          <button type="button" disabled={!source.trim()} onClick={() => handleAdd(false)} className="px-3.5 py-1.5 rounded border border-[var(--border)] text-[13px] flex items-center gap-1.5">
            <Clock size={14} /> <span>{tr('Download Later')}</span>
          </button>
          <button type="button" disabled={!source.trim()} onClick={() => handleAdd(true)} className="px-4 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] font-medium text-[13px] flex items-center gap-1.5">
            <Play size={14} /> <span>{tr('Start Torrent')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
