import React from 'react';

export default function SegmentsVisualizer({ segments, totalSize, height = 8 }) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return null;
  }

  const sumTotal = segments.reduce((acc, s) => acc + Math.max(0, Number(s.total || 0)), 0);
  const denom = Math.max(1, sumTotal || Number(totalSize || 0));

  return (
    <div
      style={{
        display: 'flex',
        gap: '1.5px',
        height: `${height}px`,
        width: '100%',
        background: 'rgba(0, 0, 0, 0.28)',
        borderRadius: height >= 14 ? '6px' : '3px',
        overflow: 'hidden',
        padding: height >= 14 ? '2px' : '1px',
        border: '1px solid var(--border-color)',
      }}
      title={`${segments.length} Download Channels`}
    >
      {segments.map((seg, idx) => {
        const pct = Math.min(100, Math.max(0, Number(seg.progress || 0)));
        const segLen = Math.max(1, Number(seg.total || 0));
        const flexGrow = Math.max(0.25, (segLen / denom) * segments.length);
        const isDone = Boolean(seg.done) || pct >= 99.95;
        const isActive = Boolean(seg.active) && !isDone;
        const tip = `#${seg.id ?? idx + 1}: ${seg.downloaded_fmt || ''} / ${seg.total_fmt || ''} (${pct.toFixed(1)}%)${seg.speed_fmt ? ` · ${seg.speed_fmt}` : ''}`;

        return (
          <div
            key={seg.id ?? idx}
            title={tip}
            style={{
              flex: `${flexGrow} 1 0%`,
              minWidth: '2px',
              background: 'var(--bg-primary)',
              height: '100%',
              borderRadius: '2px',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: isDone
                  ? 'linear-gradient(90deg, #059669, #10b981)'
                  : isActive
                    ? 'linear-gradient(90deg, #2563eb, #38bdf8)'
                    : '#64748b',
                boxShadow: isActive ? '0 0 8px rgba(56, 189, 248, 0.55)' : 'none',
                transition: 'width 0.2s linear',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
