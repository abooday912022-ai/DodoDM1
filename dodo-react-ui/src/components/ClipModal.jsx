import React, { useEffect, useState } from 'react';
import { X, Scissors, Search, Play, Download, Loader2 } from 'lucide-react';
import { api } from '../api';

function fmtSec(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

export function ClipModal({ initialUrl = '', settings, onClose, onAdded, onToast, tr }) {
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(null);
  const [selectedKey, setSelectedKey] = useState('');
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(30);
  const [exactCut, setExactCut] = useState(true);
  const [saveDir, setSaveDir] = useState(settings?.download_dir || '');
  const [previewing, setPreviewing] = useState(false);

  const handleFetch = async (targetUrl = url) => {
    const u = (targetUrl || '').trim();
    if (!u) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.clipFetch(u);
      setInfo(res);
      const opts = res.options || [];
      if (opts.length > 0) setSelectedKey(opts[0].key);
      const dur = Number(res.duration) || 600;
      setStartSec(0);
      setEndSec(Math.min(dur, 30));
    } catch (e) {
      setError(e.message || tr('Could not load video'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialUrl && initialUrl.trim()) handleFetch(initialUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!previewing) return;
    const t = setInterval(async () => {
      try {
        const s = await api.clipPreviewStatus();
        if (s.done) {
          setPreviewing(false);
          if (s.error) onToast?.(s.error, 'error');
        }
      } catch {
        setPreviewing(false);
      }
    }, 600);
    return () => clearInterval(t);
  }, [previewing, onToast]);

  const picked = info?.options?.find((o) => o.key === selectedKey) || info?.options?.[0];
  const maxDur = Math.max(60, Number(info?.duration) || 3600);

  const handlePreview = async () => {
    if (!picked) return;
    setPreviewing(true);
    try {
      await api.clipPreview({
        video_url: picked.videoUrl,
        audio_url: picked.audioUrl || undefined,
        headers: picked.headers || [],
        key: picked.key,
        start: Number(startSec),
        end: Number(endSec),
        exact: exactCut,
      });
    } catch (e) {
      setPreviewing(false);
      onToast?.(e.message, 'error');
    }
  };

  const handleDownload = async () => {
    if (!picked || !info) return;
    try {
      const res = await api.clipDownload({
        title: info.title || 'clip',
        page_url: url.trim(),
        video_url: picked.videoUrl,
        audio_url: picked.audioUrl || undefined,
        headers: picked.headers || [],
        ext: picked.ext || 'mp4',
        key: picked.key,
        start: Number(startSec),
        end: Number(endSec),
        exact: exactCut,
        save_dir: saveDir.trim() || undefined,
      });
      onToast?.(tr('Video clip download started'));
      if (onAdded) {
        await onAdded(res);
      } else {
        onClose();
      }
    } catch (e) {
      onToast?.(e.message, 'error');
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel w-[580px] max-w-[95vw] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl">
          <div className="flex items-center gap-2 font-semibold text-[var(--text)]">
            <Scissors size={16} className="text-[var(--accent)]" />
            <span>{tr('Download Part of a Video')}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--row-hover)] text-[var(--muted)]"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-3 text-[13px]">
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              dir="ltr"
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-1 px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]"
            />
            <button type="button" disabled={loading} onClick={() => handleFetch(url)} className="px-3.5 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] font-medium flex items-center gap-1.5">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              <span>{tr('Load')}</span>
            </button>
          </div>

          {error && <div className="px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-[12px]">{error}</div>}

          {info && (
            <div className="space-y-3">
              <div className="font-semibold text-[var(--text)] truncate">{info.title}</div>
              <div>
                <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Quality')}</label>
                <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]">
                  {(info.options || []).map((o) => <option key={o.key} value={o.key}>{o.label} {o.sub ? `(${o.sub})` : ''}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 rounded bg-[var(--panel-elev)] border border-[var(--border)]">
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Start (seconds)')}: {fmtSec(startSec)}</label>
                  <input type="range" min="0" max={maxDur} value={startSec} onChange={(e) => setStartSec(Math.min(Number(e.target.value), endSec - 1))} className="w-full accent-[var(--accent)]" />
                  <input type="number" min="0" value={startSec} onChange={(e) => setStartSec(Number(e.target.value))} className="w-full mt-1 px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]" />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('End (seconds)')}: {fmtSec(endSec)}</label>
                  <input type="range" min="1" max={maxDur} value={endSec} onChange={(e) => setEndSec(Math.max(Number(e.target.value), startSec + 1))} className="w-full accent-[var(--accent)]" />
                  <input type="number" min="1" value={endSec} onChange={(e) => setEndSec(Number(e.target.value))} className="w-full mt-1 px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                <input type="checkbox" checked={exactCut} onChange={(e) => setExactCut(e.target.checked)} />
                <span>{tr('Exact frame cut (re-encode clip cleanly)')}</span>
              </label>

              <div>
                <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Save To')}</label>
                <input type="text" dir="ltr" value={saveDir} onChange={(e) => setSaveDir(e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]" />
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--panel-elev)] rounded-b-xl flex justify-between gap-2">
          <button
            type="button"
            disabled={!info || previewing}
            onClick={handlePreview}
            className="px-3.5 py-1.5 rounded border border-[var(--border)] hover:border-[var(--accent)] flex items-center gap-1.5 text-[12px] disabled:opacity-40"
          >
            {previewing ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            <span>{tr('Preview (up to 60s)')}</span>
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded border border-[var(--border)] text-[13px]">{tr('Cancel')}</button>
            <button type="button" disabled={!info} onClick={handleDownload} className="px-4 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] font-medium text-[13px] flex items-center gap-1.5 disabled:opacity-40">
              <Download size={14} /> <span>{tr('Download Part')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
