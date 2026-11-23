import React, { useEffect, useState } from 'react';
import {
  X, Pause, Play, RotateCcw, FolderOpen, Film, Gauge, Plus,
  RefreshCw, Copy, CheckSquare, Square, Users, Radio, HardDrive, Layers
} from 'lucide-react';
import { api } from '../api';
import SegmentsVisualizer from './SegmentsVisualizer';

const AFTER_DONE_OPTIONS = [
  { idx: 0, label: 'Do nothing' },
  { idx: 1, label: 'Open file' },
  { idx: 2, label: 'Open folder' },
  { idx: 3, label: 'Exit DODO DM1' },
  { idx: 4, label: 'Sleep computer' },
  { idx: 5, label: 'Hibernate computer' },
  { idx: 6, label: 'Shut down computer' },
];

export function ProgressModal({
  download: rawDownload,
  onClose,
  onRefreshState,
  onToast,
  tr,
}) {
  const [optimistic, setOptimistic] = useState(null);

  useEffect(() => {
    if (optimistic && rawDownload) {
      if (optimistic.status && rawDownload.status === optimistic.status) {
        setOptimistic(null);
      }
    }
  }, [rawDownload, optimistic]);

  const download = rawDownload ? (optimistic ? { ...rawDownload, ...optimistic } : rawDownload) : null;

  const [tab, setTab] = useState('status');
  const [limitKb, setLimitKb] = useState('');
  const [limitInitId, setLimitInitId] = useState(null);
  const [torrentLive, setTorrentLive] = useState(null);
  const [trackerInput, setTrackerInput] = useState('');
  const [copiedMagnet, setCopiedMagnet] = useState(false);

  const isTorrent = download?.kind === 'Torrent';
  const isCompleted = download?.status === 'Completed';
  const isActive = ['Connecting', 'Downloading', 'Assembling', 'Queued'].includes(download?.status);

  useEffect(() => {
    if (!download) return;
    if (limitInitId !== download.id) {
      setLimitInitId(download.id);
      setLimitKb(download.speed_limit_kb ? String(download.speed_limit_kb) : '');
      setTab('status');
      setOptimistic(null);
    }
  }, [download, limitInitId]);

  useEffect(() => {
    if (!download || !isTorrent) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await api.torrentLive(download.id);
        if (!cancelled) setTorrentLive(res);
      } catch {
        /* ignore */
      }
    };
    poll();
    const timer = setInterval(poll, 1200);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [download?.id, isTorrent]);

  if (!download) return null;

  const act = async (action, extra = {}) => {
    if (action === 'resume') {
      setOptimistic({
        status: 'Connecting',
        status_label: tr(download.total_size ? 'Initializing download…' : 'Checking link…'),
        speed: 0,
        speed_fmt: '--',
        error: null,
      });
    } else if (action === 'pause') {
      setOptimistic({ status: 'Paused', status_label: tr('Paused'), active_connections: 0, speed: 0, speed_fmt: '--' });
    } else if (action === 'restart') {
      setOptimistic({
        status: 'Connecting',
        status_label: tr(download.total_size ? 'Initializing download…' : 'Checking link…'),
        downloaded: 0,
        downloaded_fmt: '0 B',
        progress: 0,
        speed: 0,
        speed_fmt: '--',
        eta: null,
        eta_fmt: '',
        active_connections: 0,
        error: null,
      });
    }
    try {
      await api.doAction({ action, ids: [download.id], ...extra });
      if (onRefreshState) {
        onRefreshState();
      }
    } catch (e) {
      setOptimistic(null);
      onToast?.(e.message || tr('Action failed'), 'error');
    }
  };

  const applySpeedLimit = async () => {
    const val = parseInt(limitKb, 10);
    await act('set_limit', { speed_limit_kb: isNaN(val) || val <= 0 ? 0 : val });
    onToast?.(tr('Speed limit updated'));
  };

  const toggleTorrentFile = async (fileIdx) => {
    if (!torrentLive?.files) return;
    const selectedIndices = torrentLive.files
      .map((f) => (f.index === fileIdx ? (f.selected ? null : f.index) : f.selected ? f.index : null))
      .filter((x) => x !== null);
    try {
      await api.torrentLiveAction(download.id, {
        action: 'set_files',
        select: selectedIndices.join(','),
      });
      const res = await api.torrentLive(download.id);
      setTorrentLive(res);
    } catch (e) {
      onToast?.(e.message, 'error');
    }
  };

  const addTracker = async () => {
    if (!trackerInput.trim()) return;
    try {
      await api.torrentLiveAction(download.id, {
        action: 'add_tracker',
        tracker: trackerInput.trim(),
      });
      setTrackerInput('');
      const res = await api.torrentLive(download.id);
      setTorrentLive(res);
      onToast?.(tr('Tracker added'));
    } catch (e) {
      onToast?.(e.message, 'error');
    }
  };

  const toggleFirstLast = async () => {
    const next = !(torrentLive?.first_last);
    try {
      await api.torrentLiveAction(download.id, { action: 'set_first_last', first_last: next });
      setTorrentLive((prev) => (prev ? { ...prev, first_last: next } : prev));
    } catch (e) {
      onToast?.(e.message, 'error');
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel w-[650px] max-w-[95vw] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl">
          <div className="min-w-0 flex-1 pr-3">
            <div className="font-semibold text-[14px] text-[var(--text)] truncate" title={download.file_name}>
              {download.file_name}
            </div>
            <div className="text-[11px] text-[var(--muted)] truncate" dir="ltr">
              {download.url}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--row-hover)] text-[var(--muted)]">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 pt-2 border-b border-[var(--border)] bg-[var(--panel-elev)] text-[12px]">
          <button
            onClick={() => setTab('status')}
            className={`px-3 py-1.5 border-b-2 font-medium ${tab === 'status' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'}`}
          >
            {tr('Download Status')}
          </button>
          <button
            onClick={() => setTab('limits')}
            className={`px-3 py-1.5 border-b-2 font-medium ${tab === 'limits' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'}`}
          >
            {tr('Speed Limiter & Completion')}
          </button>
          {isTorrent && (
            <>
              <button
                onClick={() => setTab('tfiles')}
                className={`px-3 py-1.5 border-b-2 font-medium ${tab === 'tfiles' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'}`}
              >
                {tr('Files')} ({torrentLive?.files?.length || 0})
              </button>
              <button
                onClick={() => setTab('tpeers')}
                className={`px-3 py-1.5 border-b-2 font-medium ${tab === 'tpeers' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'}`}
              >
                {tr('Peers')} ({torrentLive?.peers?.length || 0})
              </button>
              <button
                onClick={() => setTab('ttrackers')}
                className={`px-3 py-1.5 border-b-2 font-medium ${tab === 'ttrackers' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'}`}
              >
                {tr('Trackers')} & {tr('Pieces')}
              </button>
            </>
          )}
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-3 text-[13px] flex-1">
          {tab === 'status' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px]">
                <div className="p-2 rounded bg-[var(--panel-elev)] border border-[var(--border)]">
                  <div className="text-[11px] text-[var(--muted)]">{tr('Status')}</div>
                  <div className="font-semibold text-[var(--text)] truncate">{download.status_label}</div>
                </div>
                <div className="p-2 rounded bg-[var(--panel-elev)] border border-[var(--border)]">
                  <div className="text-[11px] text-[var(--muted)]">{tr('Downloaded')}</div>
                  <div className="font-semibold text-[var(--text)]">
                    {download.downloaded_fmt} / {download.total_size_fmt || '?'}
                  </div>
                </div>
                <div className="p-2 rounded bg-[var(--panel-elev)] border border-[var(--border)]">
                  <div className="text-[11px] text-[var(--muted)]">{tr('Transfer rate')}</div>
                  <div className="font-semibold text-[var(--accent)]">
                    {download.speed > 0 && download.speed_fmt && download.speed_fmt !== '--' ? download.speed_fmt : '--'}
                  </div>
                </div>
                <div className="p-2 rounded bg-[var(--panel-elev)] border border-[var(--border)]">
                  <div className="text-[11px] text-[var(--muted)]">{tr('Time left')}</div>
                  <div className="font-semibold text-[var(--text)]">{download.eta_fmt || '--'}</div>
                </div>
              </div>

              {download.error && (
                <div className="px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-[12px]">
                  {download.error}
                </div>
              )}

              {/* Step progress bar if converting/merging */}
              {download.step && (
                <div className="p-2.5 rounded bg-[var(--accent-soft)] border border-[var(--accent)]/30 space-y-1">
                  <div className="flex justify-between text-[12px] font-medium">
                    <span>{download.step.label}</span>
                    {download.step.percent >= 0 && <span>{download.step.percent}%</span>}
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] transition-all"
                      style={{ width: `${Math.max(5, Math.min(100, download.step.percent || 50))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Overall progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-[12px]">
                  <span className="text-[var(--muted)]">
                    {tr('Resume capability')}:{' '}
                    <strong className={download.resumable ? 'text-emerald-400' : 'text-amber-400'}>
                      {download.resumable ? tr('Yes') : tr('No')}
                    </strong>
                    {' • '}
                    {tr('Connections')}: <strong>{download.active_connections || 0}</strong>
                  </span>
                  <span className="font-semibold text-[var(--text)]">{Number(download.progress || 0).toFixed(1)}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-[var(--panel-elev)] border border-[var(--border)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, download.progress || 0))}%` }}
                  />
                </div>
              </div>

              {/* Live Multi-Channel Connections Map & Table (IDM-style) */}
              {!isTorrent && (
                <div className="p-2.5 rounded-lg bg-[var(--panel-elev)] border border-[var(--border)] space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text)]">
                      <span>{tr('Download Channels')}</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-[var(--accent-soft)] text-[var(--accent)]">
                        {tr('Active')}: {download.active_connections || 0} / {download.segments?.length || download.connections || 1}
                      </span>
                    </div>

                    {!isCompleted && (
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="text-[var(--muted)]">{tr('Boost Channels')}:</span>
                        {[8, 16, 32, 64].map((n) => {
                          const cur = Number(download.connections || 32);
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => act('set_connections', { connections: n })}
                              className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${
                                cur === n
                                  ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)]'
                                  : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)]'
                              }`}
                            >
                              {n}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {Array.isArray(download.segments) && download.segments.length > 0 ? (
                    <>
                      <SegmentsVisualizer segments={download.segments} totalSize={download.total_size} height={18} />
                      <div className="max-h-44 overflow-y-auto border border-[var(--border)] rounded bg-[var(--panel)]">
                        <table className="w-full text-[11px]">
                          <thead className="bg-[var(--panel-elev)] text-[var(--muted)] sticky top-0">
                            <tr>
                              <th className="text-start px-2 py-1.5 w-10">#</th>
                              <th className="text-start px-2 py-1.5">{tr('Downloaded')}</th>
                              <th className="text-start px-2 py-1.5">{tr('Channel Speed')}</th>
                              <th className="text-start px-2 py-1.5 w-28">{tr('Progress')}</th>
                              <th className="text-start px-2 py-1.5">{tr('Status')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border)]">
                            {download.segments.map((seg) => {
                              const pct = Math.min(100, Math.max(0, Number(seg.progress || 0)));
                              const isDoneSeg = Boolean(seg.done) || pct >= 99.95;
                              const isRecv = Boolean(seg.active) && !isDoneSeg;
                              return (
                                <tr key={seg.id} className="hover:bg-[var(--row-hover)]">
                                  <td className="px-2 py-1 font-mono font-semibold">
                                    <span className="inline-flex items-center gap-1.5">
                                      <span
                                        style={{
                                          width: '7px',
                                          height: '7px',
                                          borderRadius: '9999px',
                                          display: 'inline-block',
                                          background: isDoneSeg ? '#10b981' : isRecv ? '#38bdf8' : '#64748b',
                                          boxShadow: isRecv ? '0 0 6px #38bdf8' : 'none',
                                        }}
                                      />
                                      {seg.id}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1 font-mono text-[10px]">
                                    {seg.downloaded_fmt || '0 B'} / {seg.total_fmt || '?'}
                                  </td>
                                  <td className="px-2 py-1 font-semibold text-[var(--accent)]">
                                    {isRecv && seg.speed_fmt ? seg.speed_fmt : '—'}
                                  </td>
                                  <td className="px-2 py-1">
                                    <div className="flex items-center gap-1.5">
                                      <div style={{ flex: 1, height: '5px', background: 'var(--bar-bg)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div
                                          style={{
                                            width: `${pct}%`,
                                            height: '100%',
                                            background: isDoneSeg ? '#10b981' : isRecv ? '#38bdf8' : '#64748b',
                                            transition: 'width 0.2s linear',
                                          }}
                                        />
                                      </div>
                                      <span className="w-9 text-end font-mono text-[10px]">{pct.toFixed(0)}%</span>
                                    </div>
                                  </td>
                                  <td className="px-2 py-1">
                                    <span className={isDoneSeg ? 'text-emerald-400 font-medium' : isRecv ? 'text-[var(--accent)] font-medium' : 'text-[var(--muted)]'}>
                                      {isDoneSeg ? tr('Complete') : isRecv ? tr('Receiving data') : tr('Waiting')}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="text-[11px] text-[var(--muted)] py-1">
                      {isCompleted
                        ? tr('All channels finished downloading.')
                        : !download.resumable && download.status === 'Downloading'
                          ? tr('Single stream (server does not support split channels)')
                          : tr('Opening parallel channels...')}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'limits' && (
            <div className="space-y-4">
              <div className="p-3 rounded bg-[var(--panel-elev)] border border-[var(--border)] space-y-2">
                <div className="flex items-center gap-2 font-medium text-[var(--text)]">
                  <Gauge size={15} className="text-[var(--accent)]" />
                  <span>{tr('Per-Download Speed Limit (KB/s)')}</span>
                </div>
                <p className="text-[12px] text-[var(--muted)]">{tr('Set 0 or leave empty for unlimited.')}</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    value={limitKb}
                    onChange={(e) => setLimitKb(e.target.value)}
                    placeholder="0"
                    className="w-36 px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]"
                  />
                  <button
                    type="button"
                    onClick={applySpeedLimit}
                    className="px-3 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] font-medium"
                  >
                    {tr('Apply')}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded bg-[var(--panel-elev)] border border-[var(--border)] space-y-2">
                <div className="font-medium text-[var(--text)]">{tr('On Completion')}</div>
                <select
                  value={download.on_complete ?? 0}
                  onChange={(e) => act('set_on_complete', { when_done: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]"
                >
                  {AFTER_DONE_OPTIONS.map((o) => (
                    <option key={o.idx} value={o.idx}>
                      {tr(o.label)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {tab === 'tfiles' && isTorrent && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(torrentLive?.first_last)}
                    onChange={toggleFirstLast}
                  />
                  <span>{tr('Download first & last pieces first (sequential preview)')}</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => api.torrentLiveAction(download.id, { action: 'recheck' }).then(() => onToast?.(tr('Rechecking pieces...')))}
                    className="px-2.5 py-1 rounded border border-[var(--border)] hover:border-[var(--accent)] flex items-center gap-1"
                  >
                    <RefreshCw size={12} />
                    <span>{tr('Recheck')}</span>
                  </button>
                  {torrentLive?.magnet_link && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(torrentLive.magnet_link);
                        setCopiedMagnet(true);
                        setTimeout(() => setCopiedMagnet(false), 1800);
                      }}
                      className="px-2.5 py-1 rounded border border-[var(--border)] hover:border-[var(--accent)] flex items-center gap-1"
                    >
                      <Copy size={12} />
                      <span>{copiedMagnet ? tr('Copied!') : tr('Copy Magnet')}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="border border-[var(--border)] rounded max-h-64 overflow-y-auto divide-y divide-[var(--border)]">
                {(torrentLive?.files || []).map((f) => (
                  <div
                    key={f.index}
                    onClick={() => toggleTorrentFile(f.index)}
                    className="flex items-center justify-between px-2.5 py-1.5 hover:bg-[var(--row-hover)] cursor-pointer text-[12px]"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {f.selected ? <CheckSquare size={14} className="text-[var(--accent)] shrink-0" /> : <Square size={14} className="text-[var(--muted)] shrink-0" />}
                      <span className="truncate">{f.path}</span>
                    </div>
                    <div className="text-[11px] text-[var(--muted)] shrink-0 pl-3">
                      {f.done_fmt} / {f.size_fmt} ({Number(f.progress || 0).toFixed(0)}%)
                    </div>
                  </div>
                ))}
                {(!torrentLive || !torrentLive.files?.length) && (
                  <div className="p-4 text-center text-[var(--muted)] text-[12px]">{tr('Start or resume the torrent to inspect live files.')}</div>
                )}
              </div>
            </div>
          )}

          {tab === 'tpeers' && isTorrent && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12px] text-[var(--muted)]">
                <span className="flex items-center gap-1.5"><Users size={13} /> {tr('Connected Peers')}: {torrentLive?.peers?.length || 0}</span>
                <span className="flex items-center gap-1.5"><HardDrive size={13} /> {tr('Uploaded')}: {torrentLive?.uploaded_fmt || '0 B'}</span>
              </div>
              <div className="border border-[var(--border)] rounded max-h-64 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-[var(--panel-elev)] text-[var(--muted)] sticky top-0">
                    <tr>
                      <th className="text-start px-2 py-1">{tr('Address')}</th>
                      <th className="text-start px-2 py-1">{tr('Down')}</th>
                      <th className="text-start px-2 py-1">{tr('Up')}</th>
                      <th className="text-start px-2 py-1">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {(torrentLive?.peers || []).map((p, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1 font-mono" dir="ltr">{p.address}</td>
                        <td className="px-2 py-1">{p.down_fmt}</td>
                        <td className="px-2 py-1">{p.up_fmt}</td>
                        <td className="px-2 py-1">{Number(p.have || 0).toFixed(1)}% {p.seeder ? '★' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'ttrackers' && isTorrent && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={trackerInput}
                  onChange={(e) => setTrackerInput(e.target.value)}
                  placeholder="udp://tracker.opentrackr.org:1337/announce"
                  dir="ltr"
                  className="flex-1 px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)] text-[12px]"
                />
                <button
                  type="button"
                  onClick={addTracker}
                  className="px-3 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] text-[12px] flex items-center gap-1"
                >
                  <Plus size={13} />
                  <span>{tr('Add Tracker')}</span>
                </button>
              </div>

              <div className="border border-[var(--border)] rounded max-h-32 overflow-y-auto divide-y divide-[var(--border)] text-[11px]">
                {(torrentLive?.trackers || []).map((t, i) => (
                  <div key={i} className="px-2.5 py-1 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-mono truncate" dir="ltr">
                      <Radio size={11} className="text-[var(--accent)] shrink-0" />
                      {typeof t === 'string' ? t : t.url || JSON.stringify(t)}
                    </span>
                    {t.status && <span className="text-[var(--muted)] shrink-0">{t.status}</span>}
                  </div>
                ))}
              </div>

              {Array.isArray(torrentLive?.pieces) && torrentLive.pieces.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)] mb-1">
                    <Layers size={12} />
                    <span>{tr('Pieces Map')}</span>
                  </div>
                  <div className="flex flex-wrap gap-0.5 p-2 rounded bg-[var(--panel-elev)] border border-[var(--border)]">
                    {torrentLive.pieces.map((pc, idx) => (
                      <div
                        key={idx}
                        title={`${pc.from}..${pc.to}`}
                        className={`w-2.5 h-2.5 rounded-xs ${pc.here ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--panel-elev)] rounded-b-xl flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {(download.file_kind === 'video' || download.file_kind === 'audio') && !isCompleted && (
              <button
                type="button"
                onClick={() => act('preview')}
                className="px-3 py-1.5 rounded border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text)] flex items-center gap-1.5 text-[12px]"
              >
                <Film size={13} />
                <span>{tr('Play while downloading')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => act('open_folder')}
              className="px-3 py-1.5 rounded border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text)] flex items-center gap-1.5 text-[12px]"
            >
              <FolderOpen size={13} />
              <span>{tr('Open Folder')}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isCompleted && (
              <button
                type="button"
                onClick={() => act('open')}
                className="px-4 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] font-medium hover:brightness-110 flex items-center gap-1.5 text-[12px]"
              >
                <Play size={13} />
                <span>{tr('Open / Play Now')}</span>
              </button>
            )}
            {!isCompleted && (
              isActive ? (
                <button
                  type="button"
                  onClick={() => act('pause')}
                  className="px-3.5 py-1.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 text-[12px]"
                >
                  <Pause size={13} />
                  <span>{tr('Pause')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => act('resume')}
                  className="px-3.5 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] flex items-center gap-1.5 text-[12px]"
                >
                  <Play size={13} />
                  <span>{tr('Resume')}</span>
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => act('restart')}
              className="px-3 py-1.5 rounded border border-[var(--border)] text-[var(--text)] hover:bg-[var(--row-hover)] flex items-center gap-1.5 text-[12px]"
            >
              <RotateCcw size={13} />
              <span>{tr('Redownload')}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded border border-[var(--border)] text-[var(--text)] hover:bg-[var(--row-hover)] text-[12px]"
            >
              {tr('Close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
