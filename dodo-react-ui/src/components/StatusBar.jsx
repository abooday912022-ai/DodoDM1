import React from 'react';
import { Gauge, AlertOctagon, HardDrive, Shield } from 'lucide-react';
import { api } from '../api';

export function StatusBar({
  state,
  downloads,
  onOpenSettings,
  onToast,
  tr,
}) {
  const list = downloads || [];
  const activeCount = list.filter((d) => ['Downloading', 'Connecting', 'Assembling'].includes(d.status)).length;
  const totalSpeedBps = list.reduce((acc, d) => acc + (d.status === 'Downloading' ? Number(d.speed || 0) : 0), 0);

  const fmtSpeed = (bps) => {
    if (!bps || bps <= 0) return '--';
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let v = bps;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  };

  const limitOn = state?.speed_limit_on;
  const limitKb = state?.settings?.speed_limit_kb || 0;
  const quotaOn = state?.settings?.quota_on;
  const powerCountdown = state?.power_countdown;

  const toggleLimiter = async () => {
    try {
      await api.doAction({ action: 'toggle_limiter', ids: [] });
    } catch (e) {
      onToast?.(e.message, 'error');
    }
  };

  return (
    <div className="border-t border-[var(--border)] bg-[var(--panel-elev)] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--muted)] select-none">
      <div className="flex items-center gap-3">
        <span>
          {tr('Downloads')}: <strong className="text-[var(--text)]">{list.length}</strong>
        </span>
        <span>•</span>
        <span>
          {tr('Active')}: <strong className="text-[var(--text)]">{activeCount}</strong>
        </span>
        <span>•</span>
        <span>
          {tr('Speed')}: <strong className="text-[var(--accent)]">{fmtSpeed(totalSpeedBps)}</strong>
        </span>
        {quotaOn && (
          <>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Shield size={11} />
              {tr('Quota')}: <strong className="text-[var(--text)]">{state?.quota_used_fmt} / {state?.settings?.quota_mb} MB</strong>
            </span>
          </>
        )}
      </div>

      {powerCountdown && (
        <div className="flex items-center gap-2 px-2.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300">
          <AlertOctagon size={12} />
          <span>{tr('Power action in')} {powerCountdown.seconds}s</span>
          <button
            type="button"
            onClick={() => api.powerAction('cancel')}
            className="underline hover:text-white"
          >
            {tr('Cancel')}
          </button>
          <button
            type="button"
            onClick={() => api.powerAction('now')}
            className="underline font-semibold hover:text-white"
          >
            {tr('Now')}
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        {state?.disk_free_fmt && (
          <span className="flex items-center gap-1">
            <HardDrive size={11} />
            {tr('Free space')}: <strong className="text-[var(--text)]">{state.disk_free_fmt}</strong>
          </span>
        )}
        <button
          type="button"
          onClick={toggleLimiter}
          onContextMenu={(e) => {
            e.preventDefault();
            onOpenSettings?.('connection');
          }}
          title={tr('Click to toggle Speed Limiter')}
          className={`flex items-center gap-1 px-2 py-0.5 rounded border ${
            limitOn
              ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
              : 'border-[var(--border)] hover:border-[var(--accent)] text-[var(--muted)]'
          }`}
        >
          <Gauge size={11} />
          <span>
            {tr('Speed Limiter')}: {limitOn ? `${limitKb} KB/s` : tr('Off')}
          </span>
        </button>
      </div>
    </div>
  );
}
