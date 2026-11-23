import React, { useState, useEffect } from 'react';
import {
  FileText,
  Video,
  Music,
  Archive,
  Terminal,
  Folder,
  Image as ImageIcon,
  Disc,
  Smartphone,
  Magnet,
  Play,
  Pause,
  FolderOpen,
  Trash2,
  Info,
  Check,
  AlertTriangle,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';
import SegmentsVisualizer from './SegmentsVisualizer';
import { api } from '../api';

function fileIcon(kind) {
  switch (kind) {
    case 'video': return <Video size={16} color="#a56bff" />;
    case 'audio': return <Music size={16} color="#2fc76c" />;
    case 'archive': return <Archive size={16} color="#fb8a2e" />;
    case 'disc': return <Disc size={16} color="#f59e0b" />;
    case 'pdf': return <FileText size={16} color="#ec4652" />;
    case 'doc':
    case 'sheet':
    case 'slides':
    case 'text': return <FileText size={16} color="#10b981" />;
    case 'exe': return <Terminal size={16} color="#3d8bf5" />;
    case 'apk': return <Smartphone size={16} color="#22c55e" />;
    case 'image': return <ImageIcon size={16} color="#2ec4b6" />;
    case 'torrent': return <Magnet size={16} color="#f472b6" />;
    default: return <Folder size={16} color="#f0b323" />;
  }
}

const COL_LABELS = {
  name: 'File Name',
  q: 'Q',
  size: 'Size',
  status: 'Status',
  eta: 'Time Left',
  speed: 'Transfer Rate',
  last: 'Last Try Date',
  desc: 'Description',
  added: 'Date Added',
  saveto: 'Save To',
  referer: 'Referer',
  parent: 'Parent Web Page',
};

export default function DownloadsTable({
  tr,
  downloads,
  selectedIds,
  onPickRow,
  onRightPickRow,
  visibleCols,
  sortBy,
  sortDesc,
  onSortChange,
  queues,
  onAction,
  onOpenModal,
}) {
  const [ctx, setCtx] = useState(null); // { x, y, row }
  const [qSub, setQSub] = useState(false);

  useEffect(() => {
    const close = () => { setCtx(null); setQSub(false); };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const cols = ['name', ...visibleCols.filter((c) => c !== 'name')];

  const statusBadge = (item) => {
    switch (item.status) {
      case 'Downloading':
      case 'Connecting':
      case 'Assembling':
        return (
          <span style={{ color: 'var(--accent-primary)', fontWeight: 700, fontSize: '0.76rem' }}>
            {item.step ? item.step.label : item.status_label}
          </span>
        );
      case 'Completed':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-success)', fontWeight: 700, fontSize: '0.76rem' }}>
            <Check size={12} strokeWidth={3} />
            {item.status_label}
          </span>
        );
      case 'Paused':
        return <span style={{ color: 'var(--accent-warning)', fontWeight: 600, fontSize: '0.76rem' }}>{item.status_label}</span>;
      case 'Failed':
        return (
          <span
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-danger)', fontWeight: 700, fontSize: '0.76rem' }}
            title={item.error || ''}
          >
            <AlertTriangle size={12} />
            {item.status_label}
          </span>
        );
      default:
        return <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.76rem' }}>{item.status_label}</span>;
    }
  };

  if (downloads.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          color: 'var(--text-muted)',
          background: 'var(--bg-primary)',
          padding: '40px',
          textAlign: 'center',
        }}
      >
        <FolderOpen size={38} opacity={0.5} />
        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
          {tr('No downloads in this view')}
        </div>
        <div style={{ fontSize: '0.8rem', maxWidth: '380px' }}>
          {tr('Click "Add URL" or copy any link to start downloading.')}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-primary)', position: 'relative' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'start' }}>
        <thead>
          <tr
            style={{
              background: 'linear-gradient(180deg, var(--header-top), var(--header-bot))',
              borderBottom: '1px solid var(--border-color)',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              color: 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.74rem',
            }}
          >
            {cols.map((k) => (
              <th
                key={k}
                onClick={() => k !== 'q' && onSortChange(k === 'last' ? 'date' : k)}
                style={{
                  padding: '8px 10px',
                  cursor: k === 'q' ? 'default' : 'pointer',
                  whiteSpace: 'nowrap',
                  borderInlineEnd: '1px solid var(--border-color)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span>{tr(COL_LABELS[k] || k)}</span>
                  {(sortBy === k || (k === 'last' && sortBy === 'date')) && (
                    <ArrowUpDown size={11} color="var(--accent-primary)" style={{ transform: sortDesc ? 'scaleY(-1)' : 'none' }} />
                  )}
                </span>
              </th>
            ))}
            <th style={{ padding: '8px 10px', textAlign: 'center', width: '90px' }}>{tr('Actions')}</th>
          </tr>
        </thead>
        <tbody>
          {downloads.map((item) => {
            const isSel = selectedIds.includes(item.id);
            const pct = Math.round(item.progress || 0);
            const isRunning = ['Downloading', 'Connecting', 'Assembling'].includes(item.status);
            const isDone = item.status === 'Completed';

            return (
              <tr
                key={item.id}
                className="dl-row-card"
                onClick={(e) => onPickRow(item.id, e.ctrlKey || e.metaKey, e.shiftKey)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onRightPickRow(item.id);
                  setCtx({ x: e.clientX, y: e.clientY, row: item });
                }}
                onDoubleClick={() => {
                  if (isDone) onAction('open', [item.id]);
                  else onOpenModal('progress', item);
                }}
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  background: isSel ? 'var(--select-bg)' : 'transparent',
                  outline: isSel ? '1px solid var(--select-line)' : 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!isSel) e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isSel) e.currentTarget.style.background = 'transparent';
                }}
              >
                {cols.map((k) => {
                  if (k === 'name') {
                    return (
                      <td key={k} style={{ padding: '7px 10px', maxWidth: '300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {fileIcon(item.file_kind)}
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            <div
                              style={{
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                direction: item.rtl ? 'rtl' : 'ltr',
                                textAlign: 'start',
                              }}
                              title={item.file_name}
                            >
                              {item.file_name}
                            </div>
                            {item.error && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--accent-danger)', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.error}>
                                {item.error}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  }
                  if (k === 'q') {
                    return (
                      <td key={k} style={{ padding: '7px 8px', textAlign: 'center', color: 'var(--accent-primary)', fontWeight: 700 }}>
                        {item.queue || ''}
                      </td>
                    );
                  }
                  if (k === 'size') {
                    return (
                      <td key={k} style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {item.total_size_fmt || item.downloaded_fmt || '—'}
                      </td>
                    );
                  }
                  if (k === 'status') {
                    return (
                      <td key={k} style={{ padding: '7px 10px', minWidth: '165px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                            {statusBadge(item)}
                            {(isRunning || (item.status === 'Paused' && pct > 0)) && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                {isRunning && item.segments && item.segments.length > 0 && (
                                  <span style={{ color: 'var(--accent-primary)', fontSize: '0.66rem' }}>
                                    ⚡ {item.active_connections || 0}/{item.segments.length}
                                  </span>
                                )}
                                <span>{pct}%</span>
                              </span>
                            )}
                          </div>
                          {(isRunning || (item.status === 'Paused' && pct > 0)) && (
                            <>
                              {item.segments && item.segments.length > 1 ? (
                                <SegmentsVisualizer segments={item.segments} totalSize={item.total_size} height={7} />
                              ) : (
                                <div style={{ width: '100%', height: '5px', background: 'var(--bar-bg)', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div
                                    className={isRunning ? 'progress-animated' : ''}
                                    style={{
                                      width: `${pct}%`,
                                      height: '100%',
                                      background: item.status === 'Paused' ? 'var(--accent-warning)' : 'var(--accent-primary)',
                                    }}
                                  />
                                </div>
                              )}
                              {item.step && (
                                <div style={{ width: '100%', height: '3px', background: 'var(--bar-bg)', borderRadius: '2px', overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.round(item.step.progress || 0)}%`, height: '100%', background: '#22c55e' }} />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    );
                  }
                  if (k === 'eta') return <td key={k} style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{item.eta_fmt || '—'}</td>;
                  if (k === 'speed') return <td key={k} style={{ padding: '7px 10px', whiteSpace: 'nowrap', fontWeight: 700, color: item.speed > 0 ? 'var(--accent-primary)' : 'var(--text-muted)' }}>{item.speed > 0 && item.speed_fmt ? item.speed_fmt : '--'}</td>;
                  if (k === 'last') return <td key={k} style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{item.last_try || item.added_at || '—'}</td>;
                  if (k === 'desc') return <td key={k} style={{ padding: '7px 10px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{item.description || ''}</td>;
                  if (k === 'added') return <td key={k} style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{item.added_at || ''}</td>;
                  if (k === 'saveto') return <td key={k} style={{ padding: '7px 10px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }} title={item.save_path}>{item.save_dir}</td>;
                  if (k === 'referer') return <td key={k} style={{ padding: '7px 10px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{item.referer || ''}</td>;
                  if (k === 'parent') return <td key={k} style={{ padding: '7px 10px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{item.parent_page || ''}</td>;
                  return <td key={k} />;
                })}

                <td style={{ padding: '7px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    {isRunning ? (
                      <button className="btn-icon" title={tr('Stop')} onClick={(e) => { e.stopPropagation(); onAction('pause', [item.id]); }}>
                        <Pause size={13} color="#f59e0b" />
                      </button>
                    ) : !isDone ? (
                      <button className="btn-icon" title={tr('Resume')} onClick={(e) => { e.stopPropagation(); onAction('resume', [item.id]); }}>
                        <Play size={13} color="#22c55e" />
                      </button>
                    ) : (
                      <button className="btn-icon" title={tr('Open / Play Now')} onClick={(e) => { e.stopPropagation(); onAction('open', [item.id]); }}>
                        <Play size={13} color="#22c55e" />
                      </button>
                    )}
                    <button className="btn-icon" title={tr('Open folder')} onClick={(e) => { e.stopPropagation(); onAction('open_folder', [item.id]); }}>
                      <FolderOpen size={13} color="#3b82f6" />
                    </button>
                    <button className="btn-icon" title={tr('Details')} onClick={(e) => { e.stopPropagation(); onOpenModal('progress', item); }}>
                      <Info size={13} />
                    </button>
                    <button className="btn-icon" title={tr('Remove')} onClick={(e) => { e.stopPropagation(); onAction('delete', [item.id]); }}>
                      <Trash2 size={13} color="#ef4444" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Full Original Right-Click Context Menu */}
      {ctx && (
        <div
          className="menu-popup"
          style={{
            left: Math.min(ctx.x, window.innerWidth - 260),
            top: Math.min(ctx.y, window.innerHeight - 420),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {selectedIds.length > 1 && (
            <div style={{ padding: '4px 10px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              {tr('{} downloads selected', selectedIds.length)}
            </div>
          )}
          <button
            className="menu-item"
            style={{ fontWeight: 700 }}
            onClick={() => {
              const r = ctx.row;
              setCtx(null);
              if (r.status === 'Completed') onAction('open');
              else onOpenModal('progress', r);
            }}
          >
            {ctx.row.status === 'Completed' ? tr('Open') : tr('Show download progress')}
          </button>
          <button
            className="menu-item"
            disabled={ctx.row.status !== 'Completed'}
            onClick={() => { setCtx(null); onAction('open_with'); }}
          >
            {tr('Open with…')}
          </button>
          {ctx.row.status !== 'Completed' && (ctx.row.file_kind === 'video' || ctx.row.file_kind === 'audio') && (
            <button className="menu-item" onClick={() => { setCtx(null); onAction('preview'); }}>
              <span style={{ color: '#e07a3f', fontWeight: 600 }}>{tr('Play while downloading')}</span>
            </button>
          )}
          {(ctx.row.file_kind === 'video' || ctx.row.file_kind === 'audio') && selectedIds.length <= 1 && (
            <button
              className="menu-item"
              onClick={() => {
                const r = ctx.row;
                setCtx(null);
                onOpenModal('clip', { url: r.parent_page || r.url });
              }}
            >
              {tr('Download a part of it…')}
            </button>
          )}
          <button className="menu-item" onClick={() => { setCtx(null); onAction('open_folder'); }}>
            {tr('Open folder')}
          </button>
          <div className="menu-sep" />
          <button
            className="menu-item"
            disabled={['Completed', 'Downloading', 'Connecting', 'Assembling'].includes(ctx.row.status)}
            onClick={() => { setCtx(null); onAction('resume'); }}
          >
            {tr('Resume download')}
          </button>
          <button
            className="menu-item"
            disabled={!['Downloading', 'Connecting', 'Assembling', 'Queued'].includes(ctx.row.status)}
            onClick={() => { setCtx(null); onAction('pause'); }}
          >
            {tr('Stop download')}
          </button>
          <button className="menu-item" onClick={() => { setCtx(null); onAction('restart'); }}>
            {tr('Redownload')}
          </button>
          <button
            className="menu-item"
            disabled={ctx.row.status === 'Completed'}
            onClick={() => { const r = ctx.row; setCtx(null); onOpenModal('refresh', r); }}
          >
            {tr('Refresh download address…')}
          </button>
          <button className="menu-item" onClick={() => { const r = ctx.row; setCtx(null); onOpenModal('move', r); }}>
            {tr('Move / Rename…')}
          </button>
          <div className="menu-sep" />
          <div style={{ position: 'relative' }} onMouseEnter={() => setQSub(true)} onMouseLeave={() => setQSub(false)}>
            <button className="menu-item">
              <span>{tr('Move to queue')}</span>
              <ChevronRight size={13} />
            </button>
            {qSub && (
              <div className="menu-popup" style={{ position: 'absolute', top: 0, insetInlineStart: '100%', minWidth: '185px' }}>
                {queues.map((q) => (
                  <button
                    key={q.id}
                    className="menu-item"
                    onClick={async () => {
                      setCtx(null);
                      await api.doAction({ action: 'set_queue', ids: selectedIds, queue: q.id });
                    }}
                  >
                    {(ctx.row.queue === q.id ? '✔ ' : '') + q.name}
                  </button>
                ))}
                <div className="menu-sep" />
                <button
                  className="menu-item"
                  disabled={!ctx.row.queue}
                  onClick={async () => {
                    setCtx(null);
                    await api.doAction({ action: 'set_queue', ids: selectedIds, queue: null });
                  }}
                >
                  {tr('Delete from queue')}
                </button>
              </div>
            )}
          </div>
          <div className="menu-sep" />
          <button className="menu-item" onClick={() => { setCtx(null); onAction('copy_url'); }}>
            {tr('Copy address')}
          </button>
          <button
            className="menu-item"
            disabled={ctx.row.status !== 'Completed'}
            onClick={() => { setCtx(null); onAction('verify_sha256'); }}
          >
            {tr('Check file (SHA-256)')}
          </button>
          <button className="menu-item" onClick={() => { const r = ctx.row; setCtx(null); onOpenModal('properties', r); }}>
            {tr('Properties')}
          </button>
          <div className="menu-sep" />
          <button className="menu-item" style={{ color: 'var(--accent-danger)' }} onClick={() => { setCtx(null); onAction('delete'); }}>
            {tr('Remove')}
          </button>
        </div>
      )}
    </div>
  );
}
