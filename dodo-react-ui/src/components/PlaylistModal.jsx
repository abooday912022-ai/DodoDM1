import React, { useEffect, useState } from 'react';
import { X, ListVideo, Search, FolderOpen, Download, Loader2 } from 'lucide-react';
import { api } from '../api';

const QUALITIES = [
  ['best', 'Best available (MP4)'],
  ['2160', '2160p (4K)'],
  ['1440', '1440p (2K)'],
  ['1080', '1080p (Full HD)'],
  ['720', '720p (HD)'],
  ['480', '480p'],
  ['360', '360p'],
  ['audio', 'Audio only (M4A)'],
  ['mp3', 'Audio only (MP3)'],
];

export function PlaylistModal({ initialUrl = '', settings, onClose, onToast, tr }) {
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState('');
  const [entries, setEntries] = useState([]);
  const [checked, setChecked] = useState({});
  const [quality, setQuality] = useState('1080');
  const [parallel, setParallel] = useState(2);
  const [numbered, setNumbered] = useState(true);
  const [subtitles, setSubtitles] = useState(Boolean(settings?.subtitles));

  const handleFetch = async (u = url) => {
    if (!u.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.playlistFetch(u.trim());
      setTitle(res.title || '');
      setFolder(res.folder || '');
      setEntries(res.entries || []);
      const ck = {};
      for (const e of res.entries || []) ck[e.index] = true;
      setChecked(ck);
    } catch (e) {
      setError(e.message || tr('Could not load playlist'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialUrl && initialUrl.trim()) handleFetch(initialUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickedEntries = entries.filter((e) => checked[e.index]);

  const handleDownload = async (startNow) => {
    try {
      const res = await api.playlistDownload({
        playlist_title: title,
        folder,
        quality,
        parallel: Number(parallel),
        numbered,
        subtitles,
        start_now: startNow,
        entries: pickedEntries.map((e) => ({ index: e.index, title: e.title, url: e.url })),
      });
      onToast?.(`${tr('Playlist queued')}: ${pickedEntries.length} ${tr('videos')}`);
      onClose();
    } catch (e) {
      onToast?.(e.message, 'error');
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel w-[680px] max-w-[95vw] h-[580px] max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl">
          <div className="flex items-center gap-2 font-semibold text-[var(--text)]">
            <ListVideo size={16} className="text-[var(--accent)]" />
            <span>{tr('Download Video Playlist')}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--row-hover)] text-[var(--muted)]"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-3 flex-1 min-h-0 flex flex-col text-[13px]">
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              dir="ltr"
              placeholder="https://www.youtube.com/playlist?list=..."
              className="flex-1 px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]"
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => handleFetch(url)}
              className="px-3.5 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] font-medium flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              <span>{tr('Load')}</span>
            </button>
          </div>

          {error && <div className="px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-[12px]">{error}</div>}

          {entries.length > 0 && (
            <>
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-semibold truncate">{title} ({entries.length})</span>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setChecked(Object.fromEntries(entries.map((e) => [e.index, true])))} className="text-[var(--accent)] hover:underline">{tr('Select all')}</button>
                  <button type="button" onClick={() => setChecked({})} className="text-[var(--muted)] hover:underline">{tr('Unselect all')}</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto border border-[var(--border)] rounded divide-y divide-[var(--border)]">
                {entries.map((e) => (
                  <label key={e.index} className="flex items-center justify-between px-3 py-1.5 hover:bg-[var(--row-hover)] cursor-pointer text-[12px] gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <input type="checkbox" checked={Boolean(checked[e.index])} onChange={(ev) => setChecked((c) => ({ ...c, [e.index]: ev.target.checked }))} />
                      <span className="text-[var(--muted)] w-6 shrink-0">{e.index}.</span>
                      <span className="truncate">{e.title}</span>
                    </span>
                    <span className="text-[11px] text-[var(--muted)] shrink-0">{e.duration_fmt}</span>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-[12px]">
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Quality')}</label>
                  <select value={quality} onChange={(e) => setQuality(e.target.value)} className="w-full px-2 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]">
                    {QUALITIES.map(([v, l]) => <option key={v} value={v}>{tr(l)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Simultaneous downloads')}</label>
                  <select value={parallel} onChange={(e) => setParallel(Number(e.target.value))} className="w-full px-2 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]">
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-[12px]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={numbered} onChange={(e) => setNumbered(e.target.checked)} />
                  <span>{tr('Number file names (01 - Title)')}</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={subtitles} onChange={(e) => setSubtitles(e.target.checked)} />
                  <span>{tr('Include subtitles')}</span>
                </label>
              </div>

              <div className="flex gap-2 text-[12px]">
                <input type="text" dir="ltr" value={folder} onChange={(e) => setFolder(e.target.value)} className="flex-1 px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
                <button type="button" onClick={() => api.pickFolder(folder).then((r) => r?.path && setFolder(r.path)).catch(() => {})} className="px-3 py-1.5 rounded border border-[var(--border)]">
                  <FolderOpen size={14} />
                </button>
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--panel-elev)] rounded-b-xl flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded border border-[var(--border)] text-[13px]">{tr('Cancel')}</button>
          <button type="button" disabled={pickedEntries.length === 0} onClick={() => handleDownload(false)} className="px-3.5 py-1.5 rounded border border-[var(--border)] text-[13px] disabled:opacity-40">
            {tr('Add to Queue')} ({pickedEntries.length})
          </button>
          <button type="button" disabled={pickedEntries.length === 0} onClick={() => handleDownload(true)} className="px-4 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] font-medium text-[13px] flex items-center gap-1.5 disabled:opacity-40">
            <Download size={14} /> <span>{tr('Download')} ({pickedEntries.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
