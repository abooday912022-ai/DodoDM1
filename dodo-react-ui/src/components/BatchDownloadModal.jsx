import React, { useState } from 'react';
import { X, Layers, FolderOpen, Play, Clock, Eye } from 'lucide-react';
import { api } from '../api';

export function BatchDownloadModal({
  initialLinksText = '',
  settings,
  queues,
  onClose,
  onAdded,
  onToast,
  tr,
}) {
  const [mode, setMode] = useState(initialLinksText ? 'links' : 'pattern');
  const [linksText, setLinksText] = useState(initialLinksText);
  const [pattern, setPattern] = useState('');
  const [letters, setLetters] = useState(false);
  const [fromVal, setFromVal] = useState('1');
  const [toVal, setToVal] = useState('10');
  const [padSize, setPadSize] = useState(2);
  const [previewLinks, setPreviewLinks] = useState([]);
  const [previewError, setPreviewError] = useState('');

  const [saveDir, setSaveDir] = useState(settings?.download_dir || '');
  const [queueId, setQueueId] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handlePreview = async () => {
    setPreviewError('');
    try {
      const res = await api.batchPreview({
        pattern,
        letters,
        from: fromVal,
        to: toVal,
        size: Number(padSize) || 1,
      });
      setPreviewLinks(res.links || []);
    } catch (e) {
      setPreviewError(e.message || tr('Invalid pattern'));
      setPreviewLinks([]);
    }
  };

  const handlePickFolder = async () => {
    try {
      const r = await api.pickFolder(saveDir);
      if (r?.path) setSaveDir(r.path);
    } catch { /* cancel */ }
  };

  const handleSubmit = async (startNow) => {
    setBusy(true);
    try {
      const res = await api.addBatch({
        mode,
        links_text: linksText,
        pattern,
        letters,
        from: fromVal,
        to: toVal,
        size: Number(padSize) || 1,
        save_dir: saveDir,
        queue: queueId ? Number(queueId) : undefined,
        start_now: startNow,
        user,
        password,
      });
      onToast?.(`${tr('Added')} ${res.count || 0} ${tr('downloads')}`);
      onAdded?.(res);
      onClose();
    } catch (e) {
      onToast?.(e.message || tr('Batch add failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel w-[620px] max-w-[95vw] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl">
          <div className="flex items-center gap-2 font-semibold text-[var(--text)]">
            <Layers size={16} className="text-[var(--accent)]" />
            <span>{tr('Add Batch Download')}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--row-hover)] text-[var(--muted)]">
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-1 px-4 pt-2 border-b border-[var(--border)] bg-[var(--panel-elev)] text-[12px]">
          <button
            type="button"
            onClick={() => setMode('links')}
            className={`px-3 py-1.5 border-b-2 font-medium ${mode === 'links' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--muted)]'}`}
          >
            {tr('From Clipboard / Links List')}
          </button>
          <button
            type="button"
            onClick={() => setMode('pattern')}
            className={`px-3 py-1.5 border-b-2 font-medium ${mode === 'pattern' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--muted)]'}`}
          >
            {tr('Wildcard Pattern (*)')}
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3 text-[13px]">
          {mode === 'links' ? (
            <div>
              <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Paste multiple links (one per line):')}</label>
              <textarea
                rows={7}
                value={linksText}
                onChange={(e) => setLinksText(e.target.value)}
                dir="ltr"
                placeholder={'https://example.com/file1.zip\nhttps://example.com/file2.zip'}
                className="w-full p-2.5 rounded bg-[var(--input-bg)] border border-[var(--border)] font-mono text-[12px] text-[var(--text)]"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Address with * wildcard (e.g. https://site.com/img_*.jpg)')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    dir="ltr"
                    placeholder="https://example.com/part-*.zip"
                    className="flex-1 px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] font-mono text-[12px]"
                  />
                  <button
                    type="button"
                    onClick={handlePreview}
                    className="px-3 py-1.5 rounded border border-[var(--border)] hover:border-[var(--accent)] flex items-center gap-1.5 text-[12px]"
                  >
                    <Eye size={14} />
                    <span>{tr('Preview')}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2.5 items-end">
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Type')}</label>
                  <select
                    value={letters ? 'letters' : 'numbers'}
                    onChange={(e) => {
                      const isL = e.target.value === 'letters';
                      setLetters(isL);
                      if (isL) {
                        setFromVal('a');
                        setToVal('z');
                      } else {
                        setFromVal('1');
                        setToVal('10');
                      }
                    }}
                    className="w-full px-2 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]"
                  >
                    <option value="numbers">{tr('Numbers')}</option>
                    <option value="letters">{tr('Letters (a-z)')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('From')}</label>
                  <input type="text" value={fromVal} onChange={(e) => setFromVal(e.target.value)} className="w-full px-2 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]" />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('To')}</label>
                  <input type="text" value={toVal} onChange={(e) => setToVal(e.target.value)} className="w-full px-2 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]" />
                </div>
                {!letters && (
                  <div>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Zero-pad digits')}</label>
                    <input type="number" min="1" max="10" value={padSize} onChange={(e) => setPadSize(e.target.value)} className="w-full px-2 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]" />
                  </div>
                )}
              </div>

              {previewError && <div className="text-red-400 text-[12px]">{previewError}</div>}

              {previewLinks.length > 0 && (
                <div className="border border-[var(--border)] rounded p-2 max-h-32 overflow-y-auto bg-[var(--panel-elev)] font-mono text-[11px] space-y-0.5" dir="ltr">
                  <div className="text-[var(--muted)] font-sans mb-1">{previewLinks.length} {tr('generated URLs')}:</div>
                  {previewLinks.slice(0, 50).map((u, i) => <div key={i} className="truncate">{u}</div>)}
                  {previewLinks.length > 50 && <div className="text-[var(--muted)]">... +{previewLinks.length - 50}</div>}
                </div>
              )}
            </div>
          )}

          {/* Folder, Queue, Credentials */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div>
              <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Save To')}</label>
              <div className="flex gap-1.5">
                <input type="text" dir="ltr" value={saveDir} onChange={(e) => setSaveDir(e.target.value)} className="flex-1 px-2 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]" />
                <button type="button" onClick={handlePickFolder} className="px-2.5 py-1.5 rounded border border-[var(--border)]">
                  <FolderOpen size={14} />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Queue')}</label>
              <select value={queueId} onChange={(e) => setQueueId(e.target.value)} className="w-full px-2 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]">
                <option value="">{tr('None (Normal download)')}</option>
                {(queues || []).map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <input type="text" value={user} onChange={(e) => setUser(e.target.value)} placeholder={tr('Username (optional)')} className="px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tr('Password (optional)')} className="px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]" />
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--panel-elev)] rounded-b-xl flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded border border-[var(--border)] text-[13px]">{tr('Cancel')}</button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleSubmit(false)}
            className="px-3.5 py-1.5 rounded border border-[var(--border)] hover:border-[var(--accent)] flex items-center gap-1.5 text-[13px]"
          >
            <Clock size={14} /> <span>{tr('Download Later')}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleSubmit(true)}
            className="px-4 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] font-medium flex items-center gap-1.5 text-[13px]"
          >
            <Play size={14} /> <span>{tr('Start All')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
