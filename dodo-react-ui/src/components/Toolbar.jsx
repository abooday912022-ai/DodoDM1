import React from 'react';
import {
  Plus,
  Layers,
  Globe,
  ListVideo,
  Scissors,
  Magnet,
  Play,
  Pause,
  Square,
  Trash2,
  CalendarClock,
  Gauge,
  Compass,
  Settings,
  Search,
  X,
} from 'lucide-react';

function ToolButton({ icon: Icon, label, color, onClick, disabled, active, small, primary }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      style={{
        display: 'flex',
        flexDirection: small ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: small ? '5px' : '3px',
        padding: small ? '5px 9px' : '6px 10px',
        minWidth: small ? 'auto' : '58px',
        borderRadius: '6px',
        border: active
          ? '1px solid var(--accent-primary)'
          : primary
            ? '1px solid var(--accent-primary)'
            : '1px solid transparent',
        background: active
          ? 'rgba(91, 157, 255, 0.18)'
          : primary
            ? 'var(--accent-primary)'
            : 'transparent',
        color: primary ? '#ffffff' : 'var(--toolbar-text)',
        fontSize: '0.7rem',
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.36 : 1,
        transition: 'all 0.12s ease',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !primary && !active) {
          e.currentTarget.style.background = 'var(--bg-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!primary && !active) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <Icon size={small ? 15 : 19} color={primary ? '#ffffff' : color} />
      <span>{label}</span>
    </button>
  );
}

export default function Toolbar({
  tr,
  small,
  selectedRows,
  speedLimitOn,
  searchQuery,
  setSearchQuery,
  onOpenModal,
  onAction,
}) {
  const hasSel = selectedRows.length > 0;
  const canResume = selectedRows.some((r) => ['Paused', 'Failed', 'Queued'].includes(r.status));
  const canStop = selectedRows.some((r) => ['Downloading', 'Connecting', 'Assembling', 'Queued'].includes(r.status));

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 10px',
        background: 'linear-gradient(180deg, var(--toolbar-top), var(--toolbar-bot))',
        borderBottom: '1px solid var(--border-color)',
        gap: '6px',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexWrap: 'wrap' }}>
        <ToolButton small={small} primary icon={Plus} label={tr('Add URL')} onClick={() => onOpenModal('add', { url: '' })} />
        <ToolButton small={small} icon={Layers} color="#3b82f6" label={tr('Add Batch')} onClick={() => onOpenModal('batch', { fromClipboard: false })} />
        <ToolButton small={small} icon={Globe} color="#10b981" label={tr('Site Grabber')} onClick={() => onOpenModal('grabber')} />
        <ToolButton small={small} icon={ListVideo} color="#a855f7" label={tr('Playlist')} onClick={() => onOpenModal('playlist')} />
        <ToolButton small={small} icon={Scissors} color="#f97316" label={tr('Video Part')} onClick={() => onOpenModal('clip')} />
        <ToolButton small={small} icon={Magnet} color="#ec4899" label={tr('Torrent')} onClick={() => onOpenModal('torrent')} />

        <div style={{ width: '1px', height: small ? '20px' : '34px', background: 'var(--border-color)', margin: '0 4px' }} />

        <ToolButton small={small} icon={Play} color="#22c55e" label={tr('Resume')} disabled={!canResume} onClick={() => onAction('resume')} />
        <ToolButton small={small} icon={Pause} color="#f59e0b" label={tr('Stop')} disabled={!canStop} onClick={() => onAction('pause')} />
        <ToolButton small={small} icon={Square} color="#ef4444" label={tr('Stop All')} onClick={() => onAction('stop_all')} />
        <ToolButton small={small} icon={Trash2} color="#ef4444" label={tr('Delete')} disabled={!hasSel} onClick={() => onAction('delete')} />

        <div style={{ width: '1px', height: small ? '20px' : '34px', background: 'var(--border-color)', margin: '0 4px' }} />

        <ToolButton small={small} icon={CalendarClock} color="#06b6d4" label={tr('Scheduler')} onClick={() => onOpenModal('scheduler')} />
        <ToolButton
          small={small}
          icon={Gauge}
          color={speedLimitOn ? '#22c55e' : 'var(--text-secondary)'}
          active={speedLimitOn}
          label={tr('Speed Limiter')}
          onClick={() => onAction('toggle_limiter')}
        />
        <ToolButton small={small} icon={Compass} color="#3b82f6" label={tr('Browsers')} onClick={() => onOpenModal('browsers')} />
        <ToolButton small={small} icon={Settings} color="var(--text-secondary)" label={tr('Options')} onClick={() => onOpenModal('settings', 0)} />
      </div>

      {/* Quick search box */}
      <div style={{ position: 'relative', width: '205px' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={tr('Search…')}
          className="input"
          style={{
            paddingInlineStart: '28px',
            paddingInlineEnd: searchQuery ? '26px' : '8px',
            height: '30px',
            fontSize: '0.78rem',
          }}
        />
        <Search size={13} color="var(--text-muted)" style={{ position: 'absolute', insetInlineStart: '9px', top: '8px', pointerEvents: 'none' }} />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute',
              insetInlineEnd: '6px',
              top: '7px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
