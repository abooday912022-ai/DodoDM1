import React from 'react';
import { Link2, Download, X } from 'lucide-react';

export function ClipboardToast({ url, onDownload, onDismiss, tr }) {
  if (!url) return null;
  return (
    <div className="fixed bottom-12 right-4 z-50 w-[340px] max-w-[90vw] p-3 rounded-xl bg-[var(--panel)] border border-[var(--accent)] shadow-2xl space-y-2 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--accent)]">
          <Link2 size={14} />
          <span>{tr('Clipboard link detected')}</span>
        </span>
        <button onClick={onDismiss} className="p-0.5 text-[var(--muted)] hover:text-[var(--text)]">
          <X size={14} />
        </button>
      </div>
      <div className="text-[11px] text-[var(--muted)] truncate" dir="ltr" title={url}>
        {url}
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="px-2.5 py-1 rounded border border-[var(--border)] text-[11px] text-[var(--text)]"
        >
          {tr('Ignore')}
        </button>
        <button
          type="button"
          onClick={() => onDownload(url)}
          className="px-3 py-1 rounded bg-[var(--accent)] text-[var(--on-accent)] text-[11px] font-medium flex items-center gap-1"
        >
          <Download size={12} />
          <span>{tr('Download')}</span>
        </button>
      </div>
    </div>
  );
}
