import React, { useEffect, useState } from 'react';
import {
  X, CalendarClock, Plus, Trash2, Play, Square, ArrowUp, ArrowDown,
  FolderOpen, Save
} from 'lucide-react';
import { api } from '../api';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const AFTER_DONE_OPTIONS = [
  'Do nothing',
  'Open file',
  'Open folder',
  'Exit DODO DM1',
  'Sleep computer',
  'Hibernate computer',
  'Shut down computer',
];

export function SchedulerModal({ queues, initialQueueId = null, onClose, onRefreshState, onToast, tr }) {
  const [selectedId, setSelectedId] = useState(initialQueueId || (queues?.[0]?.id ?? 1));
  const [form, setForm] = useState(null);
  const [newQueueName, setNewQueueName] = useState('');
  const [qFiles, setQFiles] = useState([]);

  const activeQueue = (queues || []).find((q) => q.id === selectedId) || queues?.[0];

  useEffect(() => {
    if (activeQueue) {
      setSelectedId(activeQueue.id);
      setForm(JSON.parse(JSON.stringify(activeQueue)));
      api.queueFiles(activeQueue.id).then((r) => setQFiles(r.files || [])).catch(() => setQFiles([]));
    }
  }, [activeQueue?.id, queues?.length]);

  const refreshFiles = async (qid = selectedId) => {
    if (!qid) return;
    const r = await api.queueFiles(qid).catch(() => ({ files: [] }));
    setQFiles(r.files || []);
  };

  const handleAddQueue = async () => {
    if (!newQueueName.trim()) return;
    try {
      const res = await api.queueAdd({ name: newQueueName.trim(), max_parallel: 2 });
      setNewQueueName('');
      onRefreshState?.();
      if (res?.id) setSelectedId(res.id);
      onToast?.(tr('Queue created'));
    } catch (e) {
      onToast?.(e.message, 'error');
    }
  };

  const handleDeleteQueue = async () => {
    if (!form || form.id === 1) return;
    try {
      await api.queueDelete(form.id);
      onRefreshState?.();
      setSelectedId(1);
      onToast?.(tr('Queue deleted'));
    } catch (e) {
      onToast?.(e.message, 'error');
    }
  };

  const handleSave = async () => {
    if (!form) return;
    try {
      await api.queueUpdate({
        id: form.id,
        name: form.name,
        max_parallel: Number(form.max_parallel) || 1,
        folder: form.folder || '',
        retries: Number(form.retries) || 0,
        after_done: Number(form.after_done) || 0,
        open_when_done: Boolean(form.open_when_done),
        schedule: form.schedule,
      });
      onRefreshState?.();
      onToast?.(tr('Queue schedule saved'));
    } catch (e) {
      onToast?.(e.message, 'error');
    }
  };

  const toggleDay = (idx) => {
    setForm((f) => {
      const days = [...(f.schedule?.days || [true, true, true, true, true, true, true])];
      days[idx] = !days[idx];
      return { ...f, schedule: { ...f.schedule, days } };
    });
  };

  const moveFile = async (id, delta) => {
    await api.queueMoveFile(id, delta);
    refreshFiles(selectedId);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel w-[780px] max-w-[96vw] h-[600px] max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl">
          <div className="flex items-center gap-2 font-semibold text-[var(--text)]">
            <CalendarClock size={16} className="text-[var(--accent)]" />
            <span>{tr('Scheduler & Queues')}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--row-hover)] text-[var(--muted)]"><X size={16} /></button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Queues List */}
          <div className="w-56 border-r border-[var(--border)] bg-[var(--panel-elev)] p-2.5 flex flex-col gap-2">
            <div className="text-[11px] font-semibold text-[var(--muted)] uppercase">{tr('Queues')}</div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {(queues || []).map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setSelectedId(q.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[12px] ${
                    q.id === selectedId
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                      : 'hover:bg-[var(--row-hover)] text-[var(--text)]'
                  }`}
                >
                  <span className="truncate">{q.name}</span>
                  <span className="text-[10px] text-[var(--muted)]">{q.running ? '▶ ' : ''}{q.count}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-1 pt-2 border-t border-[var(--border)]">
              <input
                type="text"
                value={newQueueName}
                onChange={(e) => setNewQueueName(e.target.value)}
                placeholder={tr('New queue...')}
                className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[11px]"
              />
              <button type="button" onClick={handleAddQueue} className="p-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)]">
                <Plus size={13} />
              </button>
            </div>
          </div>

          {/* Selected Queue Config + Files */}
          {form && (
            <div className="flex-1 p-4 overflow-y-auto space-y-3 text-[12px]">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--border)]">
                <input
                  type="text"
                  value={form.name}
                  disabled={form.id === 1}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="px-2.5 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)] font-semibold text-[13px]"
                />
                <div className="flex items-center gap-2">
                  {activeQueue?.running ? (
                    <button type="button" onClick={() => api.queueStop(form.id).then(onRefreshState)} className="px-3 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                      <Square size={12} /> {tr('Stop Queue')}
                    </button>
                  ) : (
                    <button type="button" onClick={() => api.queueStart(form.id).then(onRefreshState)} className="px-3 py-1 rounded bg-[var(--accent)] text-[var(--on-accent)] flex items-center gap-1">
                      <Play size={12} /> {tr('Start Queue')}
                    </button>
                  )}
                  {form.id !== 1 && (
                    <button type="button" onClick={handleDeleteQueue} className="p-1.5 rounded border border-[var(--border)] text-red-400 hover:bg-red-500/10">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Schedule Section */}
              <div className="p-3 rounded bg-[var(--panel-elev)] border border-[var(--border)] space-y-2.5">
                <div className="font-semibold">{tr('Schedule')}</div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.schedule?.start_enabled)}
                      onChange={(e) => setForm((f) => ({ ...f, schedule: { ...f.schedule, start_enabled: e.target.checked } }))}
                    />
                    <span>{tr('Start download at')}:</span>
                    <input
                      type="time"
                      value={form.schedule?.start_time || '00:00'}
                      onChange={(e) => setForm((f) => ({ ...f, schedule: { ...f.schedule, start_time: e.target.value } }))}
                      className="px-2 py-0.5 rounded bg-[var(--input-bg)] border border-[var(--border)]"
                    />
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.schedule?.stop_enabled)}
                      onChange={(e) => setForm((f) => ({ ...f, schedule: { ...f.schedule, stop_enabled: e.target.checked } }))}
                    />
                    <span>{tr('Stop download at')}:</span>
                    <input
                      type="time"
                      value={form.schedule?.stop_time || '06:00'}
                      onChange={(e) => setForm((f) => ({ ...f, schedule: { ...f.schedule, stop_time: e.target.value } }))}
                      className="px-2 py-0.5 rounded bg-[var(--input-bg)] border border-[var(--border)]"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.schedule?.once)}
                      onChange={(e) => setForm((f) => ({ ...f, schedule: { ...f.schedule, once: e.target.checked } }))}
                    />
                    <span>{tr('Once on date')}:</span>
                  </label>
                  {form.schedule?.once ? (
                    <input
                      type="date"
                      value={form.schedule?.once_date || ''}
                      onChange={(e) => setForm((f) => ({ ...f, schedule: { ...f.schedule, once_date: e.target.value } }))}
                      className="px-2 py-0.5 rounded bg-[var(--input-bg)] border border-[var(--border)]"
                    />
                  ) : (
                    <div className="flex gap-1">
                      {WEEKDAYS.map((d, idx) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDay(idx)}
                          className={`px-2 py-0.5 rounded text-[11px] border ${
                            form.schedule?.days?.[idx]
                              ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)]'
                              : 'border-[var(--border)] text-[var(--muted)]'
                          }`}
                        >
                          {tr(d)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.schedule?.on_startup)}
                      onChange={(e) => setForm((f) => ({ ...f, schedule: { ...f.schedule, on_startup: e.target.checked } }))}
                    />
                    <span>{tr('Start queue on DODO DM1 startup')}</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.schedule?.wake)}
                      onChange={(e) => setForm((f) => ({ ...f, schedule: { ...f.schedule, wake: e.target.checked } }))}
                    />
                    <span>{tr('Wake computer from sleep')}</span>
                  </label>
                </div>
              </div>

              {/* Queue Options */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Parallel downloads')}</label>
                  <input type="number" min="1" max="32" value={form.max_parallel} onChange={(e) => setForm((f) => ({ ...f, max_parallel: e.target.value }))} className="w-full px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Retries per file')}</label>
                  <input type="number" min="0" max="50" value={form.retries} onChange={(e) => setForm((f) => ({ ...f, retries: e.target.value }))} className="w-full px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('When queue finishes')}</label>
                  <select value={form.after_done} onChange={(e) => setForm((f) => ({ ...f, after_done: Number(e.target.value) }))} className="w-full px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)]">
                    {AFTER_DONE_OPTIONS.map((lbl, idx) => <option key={idx} value={idx}>{tr(lbl)}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <input type="text" dir="ltr" value={form.folder || ''} onChange={(e) => setForm((f) => ({ ...f, folder: e.target.value }))} placeholder={tr('Queue custom folder (optional)')} className="flex-1 px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
                <button type="button" onClick={() => api.pickFolder(form.folder || '').then((r) => r?.path && setForm((f) => ({ ...f, folder: r.path }))).catch(() => {})} className="px-2.5 py-1 rounded border border-[var(--border)]">
                  <FolderOpen size={13} />
                </button>
              </div>

              {/* Files in Queue */}
              <div>
                <div className="font-semibold mb-1">{tr('Files in this queue')} ({qFiles.length})</div>
                <div className="border border-[var(--border)] rounded max-h-36 overflow-y-auto divide-y divide-[var(--border)]">
                  {qFiles.map((f) => (
                    <div key={f.id} className="flex items-center justify-between px-2.5 py-1 text-[11px]">
                      <span className="truncate flex-1">{f.file_name}</span>
                      <span className="text-[var(--muted)] mx-2">{f.total_size_fmt}</span>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => moveFile(f.id, -1)} className="p-0.5 hover:bg-[var(--row-hover)] rounded" title={tr('Move Up')}>
                          <ArrowUp size={12} />
                        </button>
                        <button type="button" onClick={() => moveFile(f.id, 1)} className="p-0.5 hover:bg-[var(--row-hover)] rounded" title={tr('Move Down')}>
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {qFiles.length === 0 && <div className="p-3 text-center text-[var(--muted)]">{tr('No files in this queue.')}</div>}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--panel-elev)] rounded-b-xl flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-1.5 rounded border border-[var(--border)] text-[13px]">{tr('Close')}</button>
          <button type="button" onClick={handleSave} className="px-4 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] font-medium text-[13px] flex items-center gap-1.5">
            <Save size={14} /> <span>{tr('Apply & Save')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
