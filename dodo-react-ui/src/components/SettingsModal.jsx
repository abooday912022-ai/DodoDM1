import React, { useEffect, useState } from 'react';
import {
  X, Settings, FolderOpen, Download, Wifi, Globe, KeyRound, Compass,
  Magnet, Volume2, Palette, Plus, Trash2, RefreshCw, Save
} from 'lucide-react';
import { api } from '../api';
import { THEMES } from '../themes';
import { LANGUAGES } from '../translations';

const TAB_IDS = ['general', 'saveto', 'downloads', 'connection', 'proxy', 'logins', 'browser', 'torrents', 'sounds', 'appearance'];
const normalizeTab = (t) => (typeof t === 'number' ? (TAB_IDS[t] || 'general') : (TAB_IDS.includes(t) ? t : 'general'));

export function SettingsModal({ settings, initialTab = 'general', onClose, onSaved, onOpenBrowsers, onToast, tr }) {
  const [tab, setTab] = useState(normalizeTab(initialTab));
  const [form, setForm] = useState(null);
  const [proxyPassword, setProxyPassword] = useState('');
  const [clearProxyPassword, setClearProxyPassword] = useState(false);
  const [newSkipAddr, setNewSkipAddr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTab(normalizeTab(initialTab));
  }, [initialTab]);

  useEffect(() => {
    if (settings) {
      setForm({
        ...settings,
        skip_addresses: Array.isArray(settings.skip_addresses) ? [...settings.skip_addresses] : [],
        server_limits: Array.isArray(settings.server_limits) ? settings.server_limits.map((x) => ({ ...x })) : [],
        logins: Array.isArray(settings.logins) ? settings.logins.map((x) => ({ ...x, password: '' })) : [],
      });
    }
  }, [settings]);

  if (!form) return null;

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const pickDir = async (key) => {
    try {
      const r = await api.pickFolder(form[key] || '');
      if (r?.path) set(key, r.path);
    } catch { /* canceled */ }
  };

  const pickFilePath = async (key, filterName, extensions) => {
    try {
      const r = await api.pickFile(filterName, extensions);
      if (r?.path) set(key, r.path);
    } catch { /* canceled */ }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (proxyPassword) payload.proxy_password = proxyPassword;
      else if (clearProxyPassword) {
        payload.proxy_password = '';
        payload.clear_proxy_password = true;
      }
      // Make numeric values proper integers/floats
      const numKeys = [
        'connections', 'max_active', 'speed_limit_kb', 'retries', 'mp3_kbps', 'min_split_kb',
        'progress_mode', 'duplicate_action', 'theme', 'opacity', 'font_scale', 'background_strength',
        'torrent_seed_minutes', 'torrent_upload_kb', 'double_click', 'panel_min_video_kb',
        'panel_min_audio_kb', 'connection_type', 'quota_mb', 'quota_hours', 'proxy_mode', 'proxy_port',
      ];
      for (const k of numKeys) {
        payload[k] = Number(payload[k]) || 0;
      }
      payload.torrent_seed_ratio = Number(payload.torrent_seed_ratio) || 0;
      payload.server_limits = (payload.server_limits || [])
        .filter((s) => s.host?.trim())
        .map((s) => ({ host: s.host.trim(), max_connections: Math.max(1, Number(s.max_connections) || 4) }));
      await api.saveSettings(payload);
      onToast?.(tr('Settings saved'));
      onSaved?.();
      onClose();
    } catch (e) {
      onToast?.(e.message || tr('Failed to save settings'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const TABS = [
    { id: 'general', label: tr('General'), Icon: Settings },
    { id: 'saveto', label: tr('Save to'), Icon: FolderOpen },
    { id: 'downloads', label: tr('Downloads'), Icon: Download },
    { id: 'connection', label: tr('Connection'), Icon: Wifi },
    { id: 'proxy', label: tr('Proxy'), Icon: Globe },
    { id: 'logins', label: tr('Site Logins'), Icon: KeyRound },
    { id: 'browser', label: tr('File types & Browser'), Icon: Compass },
    { id: 'torrents', label: tr('Torrents'), Icon: Magnet },
    { id: 'sounds', label: tr('Sounds'), Icon: Volume2 },
    { id: 'appearance', label: tr('Appearance & Tools'), Icon: Palette },
  ];

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel w-[760px] max-w-[96vw] h-[590px] max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-elev)] rounded-t-xl">
          <div className="flex items-center gap-2 font-semibold text-[var(--text)]">
            <Settings size={16} className="text-[var(--accent)]" />
            <span>{tr('Options')} — DODO DM1</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--row-hover)] text-[var(--muted)]">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left Tab Sidebar */}
          <div className="w-48 border-r border-[var(--border)] bg-[var(--panel-elev)] p-2 space-y-0.5 overflow-y-auto shrink-0">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] text-start transition-colors ${
                  tab === id
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                    : 'text-[var(--text)] hover:bg-[var(--row-hover)]'
                }`}
              >
                <Icon size={14} className="shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>

          {/* Right Form Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 text-[13px]">
            {tab === 'general' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Language')}</label>
                    <select
                      value={form.raw_language || form.language || 'auto'}
                      onChange={(e) => set('language', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]"
                    >
                      <option value="auto">{tr('Auto (Windows)')}</option>
                      {LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('On double click')}</label>
                    <select
                      value={form.double_click ?? 0}
                      onChange={(e) => set('double_click', Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]"
                    >
                      <option value={0}>{tr('Open file (or Details)')}</option>
                      <option value={1}>{tr('Open folder')}</option>
                      <option value={2}>{tr('Show Details')}</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  {[
                    ['autostart', 'Launch DODO DM1 on Windows startup'],
                    ['close_to_tray', 'Minimize to System Tray on close instead of exiting'],
                    ['clipboard_monitor', 'Monitor clipboard for download URLs automatically'],
                    ['auto_start_clipboard', 'Start clipboard links automatically without prompt'],
                    ['limiter_on_startup', 'Turn on Speed Limiter automatically on startup'],
                    ['ask_before_remove', 'Ask confirmation before removing downloads'],
                    ['remove_deletes_files', 'Delete completed file from disk when deleting (default)'],
                    ['force_shutdown', 'Force computer shutdown / sleep even if apps wait'],
                    ['auto_check_updates', 'Check for updates automatically on startup'],
                  ].map(([k, lbl]) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer text-[12px]">
                      <input type="checkbox" checked={Boolean(form[k])} onChange={(e) => set(k, e.target.checked)} />
                      <span>{tr(lbl)}</span>
                    </label>
                  ))}
                </div>

                <div className="pt-2 border-t border-[var(--border)]">
                  <label className="block text-[11px] text-[var(--muted)] mb-1">
                    {tr('Update source URL or folder (version.json)')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.update_url || ''}
                      onChange={(e) => set('update_url', e.target.value)}
                      placeholder="https://.../version.json  |  C:\Updates\version.json"
                      dir="ltr"
                      className="flex-1 px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)] text-[12px]"
                    />
                    <button
                      type="button"
                      onClick={() => pickFilePath('update_url', 'version.json', ['json'])}
                      className="px-3 py-1.5 rounded border border-[var(--border)] hover:border-[var(--accent)] text-[12px]"
                    >
                      {tr('Browse file')}
                    </button>
                  </div>
                </div>
              </>
            )}

            {tab === 'saveto' && (
              <>
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Default Download Folder')}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.download_dir || ''}
                      onChange={(e) => set('download_dir', e.target.value)}
                      dir="ltr"
                      className="flex-1 px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]"
                    />
                    <button type="button" onClick={() => pickDir('download_dir')} className="px-3 py-1.5 rounded border border-[var(--border)] hover:border-[var(--accent)]">
                      {tr('Browse')}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Temporary Folder (for parts)')}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.temp_dir || ''}
                      onChange={(e) => set('temp_dir', e.target.value)}
                      placeholder={tr('Default (same folder)')}
                      dir="ltr"
                      className="flex-1 px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]"
                    />
                    <button type="button" onClick={() => pickDir('temp_dir')} className="px-3 py-1.5 rounded border border-[var(--border)] hover:border-[var(--accent)]">
                      {tr('Browse')}
                    </button>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-[12px]">
                  <input type="checkbox" checked={Boolean(form.category_folders)} onChange={(e) => set('category_folders', e.target.checked)} />
                  <span>{tr('Organize downloads into Category subfolders (Video, Music, Programs...)')}</span>
                </label>
              </>
            )}

            {tab === 'downloads' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Duplicate link action')}</label>
                    <select
                      value={form.duplicate_action ?? 0}
                      onChange={(e) => set('duplicate_action', Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]"
                    >
                      <option value={0}>{tr('Ask me')}</option>
                      <option value={1}>{tr('Auto-number new file')}</option>
                      <option value={2}>{tr('Overwrite existing')}</option>
                      <option value={3}>{tr('Show existing download')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Progress dialog mode')}</label>
                    <select
                      value={form.progress_mode ?? 0}
                      onChange={(e) => set('progress_mode', Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]"
                    >
                      <option value={0}>{tr('Normal progress dialog')}</option>
                      <option value={1}>{tr('Minimized')}</option>
                      <option value={2}>{tr('Do not show automatically')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('MP3 Quality (kbps)')}</label>
                    <select
                      value={form.mp3_kbps ?? 192}
                      onChange={(e) => set('mp3_kbps', Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]"
                    >
                      {[128, 192, 256, 320].map((v) => <option key={v} value={v}>{v} kbps</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Subtitle languages')}</label>
                    <input
                      type="text"
                      value={form.subtitle_langs || 'ar en'}
                      onChange={(e) => set('subtitle_langs', e.target.value)}
                      dir="ltr"
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  {[
                    ['show_start_dialog', 'Show Download Info dialog when capturing links'],
                    ['start_while_info', 'Start downloading while editing file info'],
                    ['show_progress_window', 'Show download progress window automatically'],
                    ['show_complete_dialog', 'Show Download Complete dialog'],
                    ['complete_each_in_group', 'Show complete dialog for every file in a group'],
                    ['set_file_date', 'Set downloaded file timestamp to server Last-Modified date'],
                    ['subtitles', 'Download video subtitles automatically when available'],
                  ].map(([k, lbl]) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer text-[12px]">
                      <input type="checkbox" checked={Boolean(form[k])} onChange={(e) => set(k, e.target.checked)} />
                      <span>{tr(lbl)}</span>
                    </label>
                  ))}
                </div>

                <div className="p-2.5 rounded bg-[var(--panel-elev)] border border-[var(--border)] space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-[12px] font-medium">
                    <input type="checkbox" checked={Boolean(form.virus_scan)} onChange={(e) => set('virus_scan', e.target.checked)} />
                    <span>{tr('Scan downloaded files for viruses automatically')}</span>
                  </label>
                  {form.virus_scan && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 flex gap-1">
                        <input
                          type="text"
                          value={form.virus_program || ''}
                          onChange={(e) => set('virus_program', e.target.value)}
                          placeholder="C:\Program Files\Windows Defender\MpCmdRun.exe"
                          dir="ltr"
                          className="flex-1 px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]"
                        />
                        <button type="button" onClick={() => pickFilePath('virus_program', 'Executable', ['exe'])} className="px-2 py-1 rounded border border-[var(--border)] text-[11px]">
                          ...
                        </button>
                      </div>
                      <input
                        type="text"
                        value={form.virus_args || ''}
                        onChange={(e) => set('virus_args', e.target.value)}
                        placeholder="-Scan -ScanType 3 -File {file}"
                        dir="ltr"
                        className="px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]"
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === 'connection' && (
              <>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Default Connections (Threads)')}</label>
                    <input
                      type="number"
                      min="1"
                      max="64"
                      value={form.connections ?? 8}
                      onChange={(e) => set('connections', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Max Concurrent Downloads')}</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={form.max_active ?? 3}
                      onChange={(e) => set('max_active', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Max Retries')}</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={form.retries ?? 5}
                      onChange={(e) => set('retries', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Min Split Size (KB)')}</label>
                    <input
                      type="number"
                      min="64"
                      value={form.min_split_kb ?? 512}
                      onChange={(e) => set('min_split_kb', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Speed Limit (KB/s)')}</label>
                    <input
                      type="number"
                      min="0"
                      value={form.speed_limit_kb ?? 0}
                      onChange={(e) => set('speed_limit_kb', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]"
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer text-[12px]">
                      <input type="checkbox" checked={Boolean(form.speed_limit_on)} onChange={(e) => set('speed_limit_on', e.target.checked)} />
                      <span>{tr('Enable Limiter')}</span>
                    </label>
                  </div>
                </div>

                {/* Bandwidth Quota */}
                <div className="p-2.5 rounded bg-[var(--panel-elev)] border border-[var(--border)] space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-[12px] font-medium">
                    <input type="checkbox" checked={Boolean(form.quota_on)} onChange={(e) => set('quota_on', e.target.checked)} />
                    <span>{tr('Download Bandwidth Quota')}</span>
                  </label>
                  {form.quota_on && (
                    <div className="grid grid-cols-3 gap-2 text-[12px]">
                      <div>
                        <label className="block text-[11px] text-[var(--muted)]">{tr('Max MB')}</label>
                        <input type="number" min="1" value={form.quota_mb ?? 1024} onChange={(e) => set('quota_mb', e.target.value)} className="w-full px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[var(--muted)]">{tr('Per Hours')}</label>
                        <input type="number" min="1" value={form.quota_hours ?? 1} onChange={(e) => set('quota_hours', e.target.value)} className="w-full px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
                      </div>
                      <label className="flex items-center gap-1.5 pt-4 cursor-pointer">
                        <input type="checkbox" checked={Boolean(form.quota_warn)} onChange={(e) => set('quota_warn', e.target.checked)} />
                        <span>{tr('Warn only')}</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Per-Server Max Connections */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium">{tr('Per-Server Connection Exceptions')}</span>
                    <button
                      type="button"
                      onClick={() => set('server_limits', [...(form.server_limits || []), { host: '', max_connections: 4 }])}
                      className="px-2 py-1 rounded border border-[var(--border)] text-[11px] flex items-center gap-1"
                    >
                      <Plus size={12} /> {tr('Add')}
                    </button>
                  </div>
                  {(form.server_limits || []).map((row, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="example.com"
                        dir="ltr"
                        value={row.host}
                        onChange={(e) => {
                          const next = [...form.server_limits];
                          next[idx] = { ...next[idx], host: e.target.value };
                          set('server_limits', next);
                        }}
                        className="flex-1 px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]"
                      />
                      <input
                        type="number"
                        min="1"
                        max="32"
                        value={row.max_connections}
                        onChange={(e) => {
                          const next = [...form.server_limits];
                          next[idx] = { ...next[idx], max_connections: Number(e.target.value) };
                          set('server_limits', next);
                        }}
                        className="w-20 px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]"
                      />
                      <button
                        type="button"
                        onClick={() => set('server_limits', form.server_limits.filter((_, i) => i !== idx))}
                        className="p-1 text-red-400 hover:bg-red-500/10 rounded"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {tab === 'proxy' && (
              <>
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Proxy Mode')}</label>
                  <select
                    value={form.proxy_mode ?? 0}
                    onChange={(e) => set('proxy_mode', Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]"
                  >
                    <option value={0}>{tr('No proxy (direct)')}</option>
                    <option value={1}>{tr('Use Windows system proxy')}</option>
                    <option value={2}>{tr('Manual HTTP/HTTPS proxy')}</option>
                    <option value={3}>{tr('Manual SOCKS5 proxy')}</option>
                  </select>
                </div>
                {(Number(form.proxy_mode) === 2 || Number(form.proxy_mode) === 3) && (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Proxy Host')}</label>
                        <input type="text" dir="ltr" value={form.proxy_host || ''} onChange={(e) => set('proxy_host', e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Port')}</label>
                        <input type="number" value={form.proxy_port ?? 8080} onChange={(e) => set('proxy_port', e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Username')}</label>
                        <input type="text" value={form.proxy_user || ''} onChange={(e) => set('proxy_user', e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[var(--muted)] mb-1">
                          {tr('Password')} {form.proxy_password_set && !clearProxyPassword ? `(${tr('saved')})` : ''}
                        </label>
                        <input type="password" value={proxyPassword} onChange={(e) => { setProxyPassword(e.target.value); setClearProxyPassword(false); }} placeholder="••••••" className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
                      </div>
                    </div>
                    {form.proxy_password_set && (
                      <label className="flex items-center gap-2 text-[11px] cursor-pointer">
                        <input type="checkbox" checked={clearProxyPassword} onChange={(e) => setClearProxyPassword(e.target.checked)} />
                        <span>{tr('Clear saved proxy password')}</span>
                      </label>
                    )}
                    <div>
                      <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Bypass proxy for hosts')}</label>
                      <input type="text" dir="ltr" value={form.proxy_bypass || ''} onChange={(e) => set('proxy_bypass', e.target.value)} placeholder="localhost, 127.0.0.1, *.local" className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
                    </div>
                  </div>
                )}
              </>
            )}

            {tab === 'logins' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[var(--muted)]">{tr('Credentials saved for automatic HTTP/FTP downloads:')}</span>
                  <button
                    type="button"
                    onClick={() => set('logins', [...(form.logins || []), { site: '', user: '', password: '' }])}
                    className="px-2.5 py-1 rounded bg-[var(--accent)] text-[var(--on-accent)] text-[11px] flex items-center gap-1"
                  >
                    <Plus size={12} /> {tr('New Site Login')}
                  </button>
                </div>
                {(form.logins || []).map((row, idx) => (
                  <div key={idx} className="grid grid-cols-10 gap-2 items-center p-2 rounded bg-[var(--panel-elev)] border border-[var(--border)]">
                    <input
                      type="text"
                      placeholder="site.com"
                      dir="ltr"
                      value={row.site}
                      onChange={(e) => {
                        const next = [...form.logins];
                        next[idx] = { ...next[idx], site: e.target.value };
                        set('logins', next);
                      }}
                      className="col-span-3 px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]"
                    />
                    <input
                      type="text"
                      placeholder={tr('Username')}
                      value={row.user}
                      onChange={(e) => {
                        const next = [...form.logins];
                        next[idx] = { ...next[idx], user: e.target.value };
                        set('logins', next);
                      }}
                      className="col-span-3 px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]"
                    />
                    <input
                      type="password"
                      placeholder={row.has_password ? tr('(unchanged)') : tr('Password')}
                      value={row.password || ''}
                      onChange={(e) => {
                        const next = [...form.logins];
                        next[idx] = { ...next[idx], password: e.target.value };
                        set('logins', next);
                      }}
                      className="col-span-3 px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]"
                    />
                    <button
                      type="button"
                      onClick={() => set('logins', form.logins.filter((_, i) => i !== idx))}
                      className="col-span-1 flex justify-center p-1 text-red-400 hover:bg-red-500/10 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {tab === 'browser' && (
              <>
                <div className="flex items-center justify-between p-2.5 rounded bg-[var(--accent-soft)] border border-[var(--accent)]/30">
                  <span className="text-[12px]">{tr('Manage Chrome, Edge, Firefox, Opera & Brave extensions:')}</span>
                  <button
                    type="button"
                    onClick={() => { onClose(); onOpenBrowsers?.(); }}
                    className="px-3 py-1 rounded bg-[var(--accent)] text-[var(--on-accent)] text-[12px] font-medium"
                  >
                    {tr('Browser Integration')}
                  </button>
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Automatically capture these file extensions')}</label>
                  <input type="text" dir="ltr" value={form.capture_exts || ''} onChange={(e) => set('capture_exts', e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]" />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Do not capture from these sites')}</label>
                  <input type="text" dir="ltr" value={form.skip_sites || ''} onChange={(e) => set('skip_sites', e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]" />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Hold key to skip DODO DM1')}</label>
                    <input type="text" dir="ltr" value={form.skip_key || 'Alt'} onChange={(e) => set('skip_key', e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Hold key to force capture')}</label>
                    <input type="text" dir="ltr" value={form.force_key || 'Shift'} onChange={(e) => set('force_key', e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]" />
                  </div>
                </div>

                {/* Video Floating Panel in Browser */}
                <div className="p-2.5 rounded bg-[var(--panel-elev)] border border-[var(--border)] space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-[12px] font-medium">
                    <input type="checkbox" checked={Boolean(form.panel_enabled)} onChange={(e) => set('panel_enabled', e.target.checked)} />
                    <span>{tr('Show "Download this video" panel on browser video players')}</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" dir="ltr" placeholder={tr('Skip panel on sites')} value={form.panel_skip_sites || ''} onChange={(e) => set('panel_skip_sites', e.target.value)} className="col-span-1 px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]" />
                    <input type="number" min="0" placeholder="Min video KB" value={form.panel_min_video_kb ?? 100} onChange={(e) => set('panel_min_video_kb', e.target.value)} className="px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]" />
                    <input type="number" min="0" placeholder="Min audio KB" value={form.panel_min_audio_kb ?? 100} onChange={(e) => set('panel_min_audio_kb', e.target.value)} className="px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]" />
                  </div>
                </div>

                {/* Exception list of skipped URLs */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] text-[var(--muted)]">{tr('Ignored URLs list')}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSkipAddr}
                      onChange={(e) => setNewSkipAddr(e.target.value)}
                      placeholder="https://example.com/..."
                      dir="ltr"
                      className="flex-1 px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newSkipAddr.trim()) return;
                        set('skip_addresses', [...(form.skip_addresses || []), newSkipAddr.trim()]);
                        setNewSkipAddr('');
                      }}
                      className="px-2.5 py-1 rounded border border-[var(--border)] text-[12px]"
                    >
                      {tr('Add')}
                    </button>
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {(form.skip_addresses || []).map((a, i) => (
                      <div key={i} className="flex items-center justify-between px-2 py-1 rounded bg-[var(--panel-elev)] text-[11px]">
                        <span className="truncate font-mono" dir="ltr">{a}</span>
                        <button type="button" onClick={() => set('skip_addresses', form.skip_addresses.filter((_, j) => j !== i))} className="text-red-400">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === 'torrents' && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-[12px] font-medium">
                  <input type="checkbox" checked={Boolean(form.torrent_main)} onChange={(e) => set('torrent_main', e.target.checked)} />
                  <span>{tr('Associate DODO DM1 with .torrent files & magnet: links in Windows')}</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Seed duration (minutes, 0 = none)')}</label>
                    <input type="number" min="0" value={form.torrent_seed_minutes ?? 0} onChange={(e) => set('torrent_seed_minutes', e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Seed ratio stop (e.g. 1.5)')}</label>
                    <input type="number" step="0.1" min="0" value={form.torrent_seed_ratio ?? 0} onChange={(e) => set('torrent_seed_ratio', e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Max Upload Speed (KB/s, 0 = unlim.)')}</label>
                    <input type="number" min="0" value={form.torrent_upload_kb ?? 0} onChange={(e) => set('torrent_upload_kb', e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]" />
                  </div>
                </div>
              </div>
            )}

            {tab === 'sounds' && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-[12px] font-medium">
                  <input type="checkbox" checked={Boolean(form.sounds_on)} onChange={(e) => set('sounds_on', e.target.checked)} />
                  <span>{tr('Play notification sounds')}</span>
                </label>
                {[
                  ['sound_complete', 'Download Complete Sound (.wav)'],
                  ['sound_failed', 'Download Failed Sound (.wav)'],
                  ['sound_queue_start', 'Queue Started Sound (.wav)'],
                  ['sound_queue_done', 'Queue Finished Sound (.wav)'],
                ].map(([k, lbl]) => (
                  <div key={k}>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">{tr(lbl)}</label>
                    <div className="flex gap-2">
                      <input type="text" dir="ltr" value={form[k] || ''} onChange={(e) => set(k, e.target.value)} placeholder={tr('Default system sound')} className="flex-1 px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]" />
                      <button type="button" onClick={() => pickFilePath(k, 'Audio', ['wav'])} className="px-3 py-1 rounded border border-[var(--border)] text-[12px]">{tr('Browse')}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'appearance' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Theme')} (13)</label>
                    <select value={form.theme ?? 0} onChange={(e) => set('theme', Number(e.target.value))} className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)]">
                      {THEMES.map((th) => <option key={th.id} value={th.id}>{tr(th.name)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Font Size')} ({form.font_scale ?? 100}%)</label>
                    <input type="range" min="85" max="135" value={form.font_scale ?? 100} onChange={(e) => set('font_scale', Number(e.target.value))} className="w-full accent-[var(--accent)] mt-2" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted)] mb-1">{tr('Custom Font Family')}</label>
                  <input type="text" value={form.font_family || ''} onChange={(e) => set('font_family', e.target.value)} placeholder="Segoe UI, Cairo, sans-serif" className="w-full px-2.5 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border)] text-[12px]" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-[12px]">
                  <input type="checkbox" checked={Boolean(form.toolbar_small)} onChange={(e) => set('toolbar_small', e.target.checked)} />
                  <span>{tr('Use compact toolbar buttons')}</span>
                </label>

                <div className="p-3 rounded bg-[var(--panel-elev)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-[12px]">{tr('Video & Media Engines (yt-dlp & ffmpeg)')}</div>
                    <div className="text-[11px] text-[var(--muted)]">{tr('Keep YouTube/social extractors & clip converter up to date.')}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => api.updateTools().then(() => onToast?.(tr('Updating yt-dlp & ffmpeg in background...')))}
                    className="px-3 py-1.5 rounded border border-[var(--border)] hover:border-[var(--accent)] flex items-center gap-1.5 text-[12px]"
                  >
                    <RefreshCw size={13} />
                    <span>{tr('Update yt-dlp & ffmpeg')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--panel-elev)] rounded-b-xl flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-1.5 rounded border border-[var(--border)] text-[13px]">{tr('Cancel')}</button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-4 py-1.5 rounded bg-[var(--accent)] text-[var(--on-accent)] font-medium text-[13px] flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save size={14} />
            <span>{tr('Save Settings')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
