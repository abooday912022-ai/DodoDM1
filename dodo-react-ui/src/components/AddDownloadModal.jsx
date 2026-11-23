import React, { useEffect, useRef, useState } from 'react';
import {
  X, Search, FolderOpen, Link2, ShieldCheck, AlertTriangle, Play, Clock,
  Film, ChevronDown, ChevronUp, Loader2, Magnet
} from 'lucide-react';
import { api } from '../api';

export function AddDownloadModal({
  initialData,
  settings,
  queues,
  onClose,
  onAdded,
  onSwitchToTorrent,
  onSelectExisting,
  tr,
}) {
  const [url, setUrl] = useState(initialData?.url || '');
  const [fileName, setFileName] = useState(initialData?.fileName || '');
  const hasMediaMeta = Boolean(initialData?.audioUrl || initialData?.sourcePage);
  const [category, setCategory] = useState(hasMediaMeta ? 'Video' : 'General');
  const [saveDir, setSaveDir] = useState(() => {
    const base = settings?.download_dir || '';
    if (hasMediaMeta && settings?.category_folders) {
      if (settings?.category_dirs?.Video) return settings.category_dirs.Video;
      const sep = base.includes('\\') ? '\\' : '/';
      return base ? (base.endsWith(sep) ? `${base}Video` : `${base}${sep}Video`) : base;
    }
    return base;
  });
  const [dirManual, setDirManual] = useState(false);
  const [rememberPath, setRememberPath] = useState(false);
  const [connections, setConnections] = useState(settings?.connections || 8);
  const [queueId, setQueueId] = useState('');
  const [description, setDescription] = useState('');
  const [checksum, setChecksum] = useState('');
  const [authUser, setAuthUser] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [referer, setReferer] = useState(initialData?.referer || '');
  const [cookies, setCookies] = useState(initialData?.cookies || '');
  const [userAgent, setUserAgent] = useState(initialData?.userAgent || '');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [probing, setProbing] = useState(false);
  const [probe, setProbe] = useState(null);
  const [probeError, setProbeError] = useState('');
  const [selectedVideoKey, setSelectedVideoKey] = useState('');
  const [dupPolicy, setDupPolicy] = useState(String(settings?.duplicate_action ?? 0));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const lastProbedUrl = useRef('');
  const userEditedNameRef = useRef(false);
  const isGenericStreamName = (n) => !n || /^videoplayback(\s*\(\d+\))?(\.\w+)?$/i.test(n.trim());

  const catFolderFor = (catName) => {
    if (settings?.category_dirs && settings.category_dirs[catName]) {
      return settings.category_dirs[catName];
    }
    const base = settings?.download_dir || '';
    if (!settings?.category_folders || !catName || catName === 'General') return base;
    const sep = base.includes('\\') ? '\\' : '/';
    return base.endsWith(sep) ? `${base}${catName}` : `${base}${sep}${catName}`;
  };

  const runProbe = async (targetUrl = url) => {
    const u = (targetUrl || '').trim();
    if (!u) return;
    lastProbedUrl.current = u;
    setProbing(true);
    setProbeError('');
    setProbe(null);
    try {
      const res = await api.probeUrl({
        url: u,
        user: authUser || undefined,
        password: authPassword || undefined,
        referer: referer || undefined,
        cookies: cookies || undefined,
        user_agent: userAgent || undefined,
        audio_url: initialData?.audioUrl || undefined,
        source_page: initialData?.sourcePage || undefined,
      });
      setProbe(res);
      if (res.file_name && !userEditedNameRef.current) {
        if (res.kind === 'video_page' || isGenericStreamName(fileName) || u !== initialData?.url) {
          setFileName(res.file_name);
        }
      }
      if (res.category) {
        setCategory(res.category);
        if (!dirManual) {
          setSaveDir(res.suggested_dir || catFolderFor(res.category));
        }
      }
      if (Array.isArray(res.video_options) && res.video_options.length > 0) {
        setSelectedVideoKey(res.video_options[0].key);
      } else {
        setSelectedVideoKey('');
      }
    } catch (e) {
      setProbeError(e.message || tr('Probe failed'));
    } finally {
      setProbing(false);
    }
  };

  useEffect(() => {
    if (initialData?.url && initialData.url.trim()) {
      runProbe(initialData.url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCategoryChange = (nextCat) => {
    setCategory(nextCat);
    if (!dirManual) {
      setSaveDir(catFolderFor(nextCat));
    }
  };

  const handlePickFolder = async () => {
    try {
      const res = await api.pickFolder(saveDir);
      if (res?.path) {
        setSaveDir(res.path);
        setDirManual(true);
      }
    } catch {
      /* ignore cancel */
    }
  };

  const handleSubmit = async (startNow) => {
    const trimmed = url.trim();
    if (!trimmed) {
      setSubmitError(tr('Paste the address first.'));
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      let targetUrl = trimmed;
      let audioUrl = initialData?.audioUrl || undefined;
      let sourcePage = initialData?.sourcePage || undefined;
      let sourceKey = initialData?.sourceKey || undefined;
      let finalName = fileName.trim();

      if (probe?.kind === 'video_page' && Array.isArray(probe.video_options) && probe.video_options.length > 0) {
        const picked = probe.video_options.find((o) => o.key === selectedVideoKey) || probe.video_options[0];
        if (picked) {
          targetUrl = picked.videoUrl || trimmed;
          audioUrl = picked.audioUrl || undefined;
          sourcePage = probe.source_page || trimmed;
          sourceKey = picked.key;
          if ((!finalName || isGenericStreamName(finalName)) && probe.title) {
            finalName = `${probe.title}.${picked.ext || 'mp4'}`;
          } else if (finalName && picked.ext && !finalName.toLowerCase().endsWith(`.${picked.ext.toLowerCase()}`)) {
            const dot = finalName.lastIndexOf('.');
            const base = dot > 0 ? finalName.slice(0, dot) : finalName;
            finalName = `${base}.${picked.ext}`;
          }
        }
      } else if (probe?.final_url && !targetUrl.startsWith('magnet:')) {
        targetUrl = probe.final_url;
      }

      const payload = {
        url: targetUrl,
        file_name: finalName || undefined,
        save_dir: saveDir.trim() || undefined,
        category,
        remember_path: rememberPath,
        connections: Number(connections) || undefined,
        queue: queueId ? Number(queueId) : undefined,
        description: description.trim() || undefined,
        checksum: checksum.trim() || probe?.digest || undefined,
        auth_user: authUser.trim() || undefined,
        auth_password: authPassword || undefined,
        referer: referer.trim() || undefined,
        cookies: cookies.trim() || undefined,
        user_agent: userAgent.trim() || undefined,
        post: initialData?.post || undefined,
        post_type: initialData?.postType || undefined,
        audio_url: audioUrl,
        source_page: sourcePage,
        source_key: sourceKey,
        probe_final_url: probe?.kind === 'file' ? probe.final_url || undefined : undefined,
        probe_file_name: probe?.kind === 'file' ? probe.file_name || undefined : undefined,
        probe_total_size: probe?.kind === 'file' && !probe.has_audio && typeof probe.total_size === 'number' ? probe.total_size : undefined,
        probe_resumable: probe?.kind === 'file' && typeof probe.resumable === 'boolean' ? probe.resumable : undefined,
        probe_content_type: probe?.kind === 'file' ? probe.content_type || undefined : undefined,
        probe_etag: probe?.kind === 'file' ? probe.etag || undefined : undefined,
        probe_kind: probe?.kind === 'file' ? probe.download_kind || undefined : undefined,
        start_now: startNow,
        duplicate_policy: Number(dupPolicy),
      };

      const res = await api.addDownload(payload);
      if (res?.duplicate && res.existing && onSelectExisting) {
        onSelectExisting(res.existing);
        onClose();
        return;
      }
      if (onAdded) {
        await onAdded(res, startNow);
      } else {
        onClose();
      }
    } catch (e) {
      setSubmitError(e.message || tr('Could not add download'));
    } finally {
      setSubmitting(false);
    }
  };

  const categories = settings?.categories || [];
  const selectedVid = probe?.video_options?.find((o) => o.key === selectedVideoKey);
  const looksTorrent = url.trim().toLowerCase().startsWith('magnet:') || /\.torrent(\?|$)/i.test(url.trim());

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel w-[580px] max-w-[95vw] max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl">
          <div className="flex items-center gap-2 font-semibold text-[var(--text)]">
            <Link2 size={16} className="text-[var(--accent)]" />
            <span>{tr('New Download')}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--row-hover)] text-[var(--muted)]">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3 text-[13px]">
          {/* URL Row */}
          <div>
            <label className="block text-[11px] font-medium text-[var(--muted)] mb-1">{tr('Address (URL)')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && url.trim() !== lastProbedUrl.current) runProbe(url);
                }}
                placeholder="https://example.com/file.zip"
                className="flex-1 px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => runProbe(url)}
                disabled={probing || !url.trim()}
                className="px-3 py-1.5 rounded bg-[var(--panel-elev)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text)] flex items-center gap-1.5 disabled:opacity-50"
              >
                {probing ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                <span>{tr('Check')}</span>
              </button>
            </div>
          </div>

          {looksTorrent && onSwitchToTorrent && (
            <div className="flex items-center justify-between px-3 py-2 rounded bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[12px]">
              <span className="flex items-center gap-2 text-[var(--text)]">
                <Magnet size={14} className="text-[var(--accent)]" />
                {tr('This looks like a torrent/magnet link. Pick specific files inside it?')}
              </span>
              <button
                type="button"
                onClick={() => onSwitchToTorrent(url.trim())}
                className="px-2.5 py-1 rounded bg-[var(--accent)] text-[var(--on-accent)] font-medium"
              >
                {tr('Inspect Files')}
              </button>
            </div>
          )}

          {probeError && (
            <div className="px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-[12px]">
              {probeError}
            </div>
          )}

          {probe?.duplicate_id && (
            <div className="px-3 py-2 rounded bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <span className="flex items-center gap-1.5 text-amber-300">
                <AlertTriangle size={14} />
                {tr('This address is already in your downloads.')}
              </span>
              <select
                value={dupPolicy}
                onChange={(e) => setDupPolicy(e.target.value)}
                className="px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)] text-[11px]"
              >
                <option value="1">{tr('Number the new file')}</option>
                <option value="2">{tr('Replace existing')}</option>
                <option value="3">{tr('Show existing')}</option>
              </select>
            </div>
          )}

          {/* Video Options (if video page) */}
          {probe?.kind === 'video_page' && Array.isArray(probe.video_options) && probe.video_options.length > 0 && (
            <div className="p-2.5 rounded bg-[var(--panel-elev)] border border-[var(--border)] space-y-1.5">
              <div className="flex items-center justify-between text-[12px] font-medium text-[var(--text)]">
                <span className="flex items-center gap-1.5">
                  <Film size={14} className="text-[var(--accent)]" />
                  {probe.site || tr('Video')} {probe.title ? `— ${probe.title}` : ''}
                </span>
                {selectedVid?.sub && <span className="text-[11px] text-[var(--muted)]">{selectedVid.sub}</span>}
              </div>
              <select
                value={selectedVideoKey}
                onChange={(e) => setSelectedVideoKey(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]"
              >
                {probe.video_options.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label} {opt.sub ? `(${opt.sub})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* File Info Strip */}
          {probe && probe.kind !== 'video_page' && (
            <div className="flex flex-wrap items-center gap-3 px-3 py-1.5 rounded bg-[var(--panel-elev)] border border-[var(--border)] text-[12px] text-[var(--muted)]">
              <span>
                {tr('Size')}: <strong className="text-[var(--text)]">{probe.total_size_fmt || tr('Unknown')}</strong>
              </span>
              <span>•</span>
              <span>
                {tr('Resume capability')}:{' '}
                <strong className={probe.resumable ? 'text-emerald-400' : 'text-amber-400'}>
                  {probe.resumable ? tr('Yes') : tr('No')}
                </strong>
              </span>
              {probe.content_type && (
                <>
                  <span>•</span>
                  <span className="truncate max-w-[200px]">{probe.content_type}</span>
                </>
              )}
            </div>
          )}

          {/* File Name & Category */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-[var(--muted)] mb-1">{tr('File Name')}</label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => {
                  userEditedNameRef.current = true;
                  setFileName(e.target.value);
                }}
                placeholder={tr('Auto-detected')}
                className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--muted)] mb-1">{tr('Category')}</label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-2 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]"
              >
                {categories.map((c) => (
                  <option key={c.name} value={c.name}>
                    {tr(c.name)}
                  </option>
                ))}
                {!categories.some((c) => c.name === category) && <option value={category}>{tr(category)}</option>}
              </select>
            </div>
          </div>

          {/* Save Directory */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-medium text-[var(--muted)]">{tr('Save To')}</label>
              <label className="flex items-center gap-1.5 text-[11px] text-[var(--muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberPath}
                  onChange={(e) => setRememberPath(e.target.checked)}
                />
                <span>{tr('Remember this path for category')}</span>
              </label>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={saveDir}
                onChange={(e) => {
                  setSaveDir(e.target.value);
                  setDirManual(true);
                }}
                dir="ltr"
                className="flex-1 px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]"
              />
              <button
                type="button"
                onClick={handlePickFolder}
                className="px-3 py-1.5 rounded bg-[var(--panel-elev)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text)] flex items-center gap-1"
              >
                <FolderOpen size={14} />
                <span>{tr('Browse')}</span>
              </button>
            </div>
          </div>

          {/* Queue & Connections */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-[var(--muted)] mb-1">{tr('Queue')}</label>
              <select
                value={queueId}
                onChange={(e) => setQueueId(e.target.value)}
                className="w-full px-2 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]"
              >
                <option value="">{tr('None (Normal download)')}</option>
                {(queues || []).map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--muted)] mb-1">
                {tr('Connections')}: {connections}
              </label>
              <input
                type="range"
                min="1"
                max="64"
                value={connections}
                onChange={(e) => setConnections(Number(e.target.value))}
                className="w-full accent-[var(--accent)] mt-1.5"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-medium text-[var(--muted)] mb-1">{tr('Description')}</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tr('Optional note')}
              className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]"
            />
          </div>

          {/* Advanced Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1.5 text-[12px] text-[var(--accent)] hover:underline"
          >
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>{tr('Authorization, Referer & Checksum')}</span>
          </button>

          {showAdvanced && (
            <div className="p-3 rounded bg-[var(--panel-elev)] border border-[var(--border)] space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Username')}</label>
                  <input
                    type="text"
                    value={authUser}
                    onChange={(e) => setAuthUser(e.target.value)}
                    className="w-full px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Password')}</label>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Referer')}</label>
                <input
                  type="text"
                  value={referer}
                  onChange={(e) => setReferer(e.target.value)}
                  dir="ltr"
                  className="w-full px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]"
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-[11px] text-[var(--muted)] mb-1">
                  <ShieldCheck size={12} />
                  <span>{tr('Expected SHA-256 Checksum')}</span>
                </label>
                <input
                  type="text"
                  value={checksum}
                  onChange={(e) => setChecksum(e.target.value)}
                  placeholder="sha256:..."
                  dir="ltr"
                  className="w-full px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)] font-mono text-[11px]"
                />
              </div>
            </div>
          )}

          {submitError && (
            <div className="px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-[12px]">
              {submitError}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--panel-elev)] rounded-b-xl flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded border border-[var(--border)] text-[var(--text)] hover:bg-[var(--row-hover)] text-[13px]"
          >
            {tr('Cancel')}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit(false)}
            className="px-3.5 py-1.5 rounded border border-[var(--border)] bg-[var(--panel)] hover:border-[var(--accent)] text-[var(--text)] flex items-center gap-1.5 text-[13px] disabled:opacity-50"
          >
            <Clock size={14} />
            <span>{tr('Download Later')}</span>
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit(true)}
            className="px-4 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] font-medium hover:brightness-110 flex items-center gap-1.5 text-[13px] disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            <span>{tr('Start Download')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
