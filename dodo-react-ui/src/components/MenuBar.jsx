import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { THEMES } from '../themes';
import { LANGUAGES } from '../translations';
import { api } from '../api';

export default function MenuBar({
  tr,
  language,
  selectedRows,
  queues,
  settings,
  whenAllDone,
  speedLimitOn,
  sortBy,
  onOpenModal,
  onAction,
  onSelectAll,
  onSortChange,
  onSaveSettingsPatch,
  onNotify,
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const [subMenu, setSubMenu] = useState(null);
  const barRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) {
        setOpenMenu(null);
        setSubMenu(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const primary = selectedRows[0] || null;
  const hasSel = selectedRows.length > 0;
  const canResume = selectedRows.some((r) => r.status === 'Paused' || r.status === 'Failed' || r.status === 'Queued');
  const canStop = selectedRows.some((r) => ['Downloading', 'Connecting', 'Assembling', 'Queued'].includes(r.status));
  const isDone = primary && primary.status === 'Completed';

  const closeAll = () => {
    setOpenMenu(null);
    setSubMenu(null);
  };

  const runImportExport = async (kind, isExport) => {
    closeAll();
    try {
      const r = isExport ? await api.exportList(kind) : await api.importList(kind);
      if (r && r.ok) {
        onNotify(isExport ? tr('Exported list successfully') : `${r.count || 0} ${tr('links imported')}`, 'info');
      }
    } catch (e) {
      onNotify(e.message, 'error');
    }
  };

  const menuBtnStyle = (key) => ({
    padding: '4px 10px',
    fontSize: '0.78rem',
    fontWeight: 600,
    background: openMenu === key ? 'var(--select-bg)' : 'transparent',
    color: 'var(--text-primary)',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  });

  return (
    <div
      ref={barRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: '2px 8px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        position: 'relative',
        zIndex: 80,
      }}
    >
      {/* TASKS */}
      <div style={{ position: 'relative' }}>
        <button style={menuBtnStyle('tasks')} onClick={() => setOpenMenu(openMenu === 'tasks' ? null : 'tasks')} onMouseEnter={() => openMenu && setOpenMenu('tasks')}>
          {tr('Tasks')}
        </button>
        {openMenu === 'tasks' && (
          <div className="menu-popup" style={{ position: 'absolute', top: '28px', insetInlineStart: 0 }}>
            <button className="menu-item" onClick={() => { closeAll(); onOpenModal('add', { url: '' }); }}>
              <span>{tr('Add new download…')}</span><span style={{ opacity: 0.55 }}>Ctrl+N</span>
            </button>
            <button className="menu-item" onClick={() => { closeAll(); onOpenModal('batch', { fromClipboard: false }); }}>
              <span>{tr('Add batch download…')}</span><span style={{ opacity: 0.55 }}>Ctrl+B</span>
            </button>
            <button className="menu-item" onClick={() => { closeAll(); onOpenModal('batch', { fromClipboard: true }); }}>
              <span>{tr('Add batch download from clipboard')}</span>
            </button>
            <button className="menu-item" onClick={() => { closeAll(); onOpenModal('grabber'); }}>
              <span>{tr('Run site grabber…')}</span>
            </button>
            <button className="menu-item" onClick={() => { closeAll(); onOpenModal('playlist'); }}>
              <span>{tr('Download a playlist…')}</span>
            </button>
            <button className="menu-item" onClick={() => { closeAll(); onOpenModal('clip'); }}>
              <span>{tr('Download a part of a video…')}</span>
            </button>
            <button className="menu-item" onClick={() => { closeAll(); onOpenModal('torrent'); }}>
              <span>{tr('Add a torrent / magnet link…')}</span>
            </button>
            <div className="menu-sep" />
            <div style={{ position: 'relative' }} onMouseEnter={() => setSubMenu('export')} onMouseLeave={() => setSubMenu(null)}>
              <button className="menu-item">
                <span>{tr('Export')}</span><ChevronRight size={13} />
              </button>
              {subMenu === 'export' && (
                <div className="menu-popup" style={{ position: 'absolute', top: 0, insetInlineStart: '100%' }}>
                  <button className="menu-item" onClick={() => runImportExport('ef2', true)}>{tr('To download list file (.ef2)…')}</button>
                  <button className="menu-item" onClick={() => runImportExport('txt', true)}>{tr('To text file…')}</button>
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }} onMouseEnter={() => setSubMenu('import')} onMouseLeave={() => setSubMenu(null)}>
              <button className="menu-item">
                <span>{tr('Import')}</span><ChevronRight size={13} />
              </button>
              {subMenu === 'import' && (
                <div className="menu-popup" style={{ position: 'absolute', top: 0, insetInlineStart: '100%' }}>
                  <button className="menu-item" onClick={() => runImportExport('ef2', false)}>{tr('From download list file (.ef2)…')}</button>
                  <button className="menu-item" onClick={() => runImportExport('txt', false)}>{tr('From text file…')}</button>
                </div>
              )}
            </div>
            <div className="menu-sep" />
            <button className="menu-item" onClick={() => { closeAll(); api.openDownloadFolder(); }}>
              <span>{tr('Open download folder')}</span>
            </button>
            <button className="menu-item" onClick={() => { closeAll(); api.windowAction('quit'); }}>
              <span>{tr('Exit')}</span>
            </button>
          </div>
        )}
      </div>

      {/* FILE */}
      <div style={{ position: 'relative' }}>
        <button style={menuBtnStyle('file')} onClick={() => setOpenMenu(openMenu === 'file' ? null : 'file')} onMouseEnter={() => openMenu && setOpenMenu('file')}>
          {tr('File')}
        </button>
        {openMenu === 'file' && (
          <div className="menu-popup" style={{ position: 'absolute', top: '28px', insetInlineStart: 0 }}>
            <button className="menu-item" disabled={!canResume} onClick={() => { closeAll(); onAction('resume'); }}>
              <span>{tr('Download now')}</span><span style={{ opacity: 0.55 }}>Ctrl+R</span>
            </button>
            <button className="menu-item" disabled={!canStop} onClick={() => { closeAll(); onAction('pause'); }}>
              <span>{tr('Stop download')}</span><span style={{ opacity: 0.55 }}>Ctrl+S</span>
            </button>
            <button className="menu-item" disabled={!hasSel} onClick={() => { closeAll(); onAction('delete'); }}>
              <span>{tr('Remove')}</span><span style={{ opacity: 0.55 }}>Del</span>
            </button>
            <button className="menu-item" disabled={!hasSel} onClick={() => { closeAll(); onAction('restart'); }}>
              <span>{tr('Redownload')}</span>
            </button>
            <button className="menu-item" disabled={!primary || isDone} onClick={() => { closeAll(); onOpenModal('refresh', primary); }}>
              <span>{tr('Refresh download address…')}</span>
            </button>
            <div className="menu-sep" />
            <button className="menu-item" disabled={!isDone} onClick={() => { closeAll(); onAction('open'); }}>
              <span>{tr('Open')}</span><span style={{ opacity: 0.55 }}>Ctrl+O</span>
            </button>
            <button className="menu-item" disabled={!isDone} onClick={() => { closeAll(); onAction('open_with'); }}>
              <span>{tr('Open with…')}</span>
            </button>
            <button className="menu-item" disabled={!primary || isDone} onClick={() => { closeAll(); onAction('preview'); }}>
              <span>{tr('Play while downloading')}</span>
            </button>
            <button className="menu-item" disabled={!primary} onClick={() => { closeAll(); onAction('open_folder'); }}>
              <span>{tr('Open folder')}</span><span style={{ opacity: 0.55 }}>Ctrl+E</span>
            </button>
            <button className="menu-item" disabled={!primary} onClick={() => { closeAll(); onOpenModal('move', primary); }}>
              <span>{tr('Move / Rename…')}</span><span style={{ opacity: 0.55 }}>F2</span>
            </button>
            <button className="menu-item" disabled={!primary} onClick={() => { closeAll(); onAction('copy_url'); }}>
              <span>{tr('Copy address')}</span><span style={{ opacity: 0.55 }}>Ctrl+C</span>
            </button>
            <button className="menu-item" disabled={!isDone} onClick={() => { closeAll(); onAction('verify_sha256'); }}>
              <span>{tr('Check file (SHA-256)')}</span>
            </button>
            <div className="menu-sep" />
            <button className="menu-item" onClick={() => { closeAll(); onSelectAll(); }}>
              <span>{tr('Select all   Ctrl+A')}</span>
            </button>
            <button className="menu-item" disabled={!primary} onClick={() => { closeAll(); onOpenModal('properties', primary); }}>
              <span>{tr('Properties')}</span><span style={{ opacity: 0.55 }}>Alt+Enter</span>
            </button>
          </div>
        )}
      </div>

      {/* DOWNLOADS */}
      <div style={{ position: 'relative' }}>
        <button style={menuBtnStyle('downloads')} onClick={() => setOpenMenu(openMenu === 'downloads' ? null : 'downloads')} onMouseEnter={() => openMenu && setOpenMenu('downloads')}>
          {tr('Downloads')}
        </button>
        {openMenu === 'downloads' && (
          <div className="menu-popup" style={{ position: 'absolute', top: '28px', insetInlineStart: 0 }}>
            <button className="menu-item" onClick={() => { closeAll(); onAction('resume_all'); }}>{tr('Resume all')}</button>
            <button className="menu-item" onClick={() => { closeAll(); onAction('stop_all'); }}>{tr('Stop all')}</button>
            <button className="menu-item" onClick={() => { closeAll(); onAction('delete_completed'); }}>{tr('Delete all completed')}</button>
            <div className="menu-sep" />
            <button className="menu-item" onClick={() => { closeAll(); onOpenModal('find'); }}>{tr('Find…   Ctrl+F')}</button>
            <div className="menu-sep" />
            <div style={{ position: 'relative' }} onMouseEnter={() => setSubMenu('startq')} onMouseLeave={() => setSubMenu(null)}>
              <button className="menu-item"><span>{tr('Start queue')}</span><ChevronRight size={13} /></button>
              {subMenu === 'startq' && (
                <div className="menu-popup" style={{ position: 'absolute', top: 0, insetInlineStart: '100%' }}>
                  {queues.map((q) => (
                    <button key={q.id} className="menu-item" onClick={() => { closeAll(); api.queueStart(q.id); }}>
                      {q.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }} onMouseEnter={() => setSubMenu('stopq')} onMouseLeave={() => setSubMenu(null)}>
              <button className="menu-item"><span>{tr('Stop queue')}</span><ChevronRight size={13} /></button>
              {subMenu === 'stopq' && (
                <div className="menu-popup" style={{ position: 'absolute', top: 0, insetInlineStart: '100%' }}>
                  {queues.map((q) => (
                    <button key={q.id} className="menu-item" onClick={() => { closeAll(); api.queueStop(q.id); }}>
                      {q.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }} onMouseEnter={() => setSubMenu('limiter')} onMouseLeave={() => setSubMenu(null)}>
              <button className="menu-item"><span>{tr('Speed Limiter')}</span><ChevronRight size={13} /></button>
              {subMenu === 'limiter' && (
                <div className="menu-popup" style={{ position: 'absolute', top: 0, insetInlineStart: '100%' }}>
                  <button className="menu-item" onClick={() => { closeAll(); if (!speedLimitOn) onAction('toggle_limiter'); }}>
                    {(speedLimitOn ? '● ' : '○ ') + tr('Turn on')}
                  </button>
                  <button className="menu-item" onClick={() => { closeAll(); if (speedLimitOn) onAction('toggle_limiter'); }}>
                    {(!speedLimitOn ? '● ' : '○ ') + tr('Turn off')}
                  </button>
                  <div className="menu-sep" />
                  <button className="menu-item" onClick={() => { closeAll(); onOpenModal('settings', 4); }}>{tr('Settings…')}</button>
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }} onMouseEnter={() => setSubMenu('alldone')} onMouseLeave={() => setSubMenu(null)}>
              <button className="menu-item"><span>{tr('When all downloads finish')}</span><ChevronRight size={13} /></button>
              {subMenu === 'alldone' && (
                <div className="menu-popup" style={{ position: 'absolute', top: 0, insetInlineStart: '100%' }}>
                  {[
                    [0, tr('Do nothing')],
                    [3, tr('Shut down the computer')],
                    [2, tr('Sleep')],
                    [4, tr('Hibernate')],
                    [1, tr('Exit DODO DM1')],
                  ].map(([idx, lbl]) => (
                    <button key={idx} className="menu-item" onClick={() => { closeAll(); api.doAction({ action: 'set_when_all_done', when_done: idx }); }}>
                      {(whenAllDone === idx ? '● ' : '○ ') + lbl}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="menu-sep" />
            <button className="menu-item" onClick={() => { closeAll(); onOpenModal('scheduler'); }}>{tr('Scheduler…')}</button>
            <button className="menu-item" onClick={() => { closeAll(); onOpenModal('settings', 0); }}>{tr('Options…')}</button>
          </div>
        )}
      </div>

      {/* VIEW */}
      <div style={{ position: 'relative' }}>
        <button style={menuBtnStyle('view')} onClick={() => setOpenMenu(openMenu === 'view' ? null : 'view')} onMouseEnter={() => openMenu && setOpenMenu('view')}>
          {tr('View')}
        </button>
        {openMenu === 'view' && (
          <div className="menu-popup" style={{ position: 'absolute', top: '28px', insetInlineStart: 0 }}>
            <button
              className="menu-item"
              onClick={() => {
                closeAll();
                onSaveSettingsPatch({ hide_categories: !settings?.hide_categories });
              }}
            >
              {(!settings?.hide_categories ? '☑ ' : '☐ ') + tr('Show categories')}
            </button>
            <div style={{ position: 'relative' }} onMouseEnter={() => setSubMenu('arrange')} onMouseLeave={() => setSubMenu(null)}>
              <button className="menu-item"><span>{tr('Arrange files')}</span><ChevronRight size={13} /></button>
              {subMenu === 'arrange' && (
                <div className="menu-popup" style={{ position: 'absolute', top: 0, insetInlineStart: '100%' }}>
                  {[
                    ['added', tr('By order of addition')],
                    ['name', tr('File name')],
                    ['size', tr('Size')],
                    ['status', tr('Status')],
                    ['eta', tr('Time left')],
                    ['speed', tr('Transfer rate')],
                    ['date', tr('Last try date')],
                    ['desc', tr('Description')],
                    ['saveto', tr('Save to')],
                    ['referer', tr('Referer')],
                    ['parent', tr('Parent web page')],
                  ].map(([k, lbl]) => (
                    <button key={k} className="menu-item" onClick={() => { closeAll(); onSortChange(k); }}>
                      {(sortBy === k ? '● ' : '○ ') + lbl}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }} onMouseEnter={() => setSubMenu('tb')} onMouseLeave={() => setSubMenu(null)}>
              <button className="menu-item"><span>{tr('Toolbar')}</span><ChevronRight size={13} /></button>
              {subMenu === 'tb' && (
                <div className="menu-popup" style={{ position: 'absolute', top: 0, insetInlineStart: '100%' }}>
                  <button className="menu-item" onClick={() => { closeAll(); onSaveSettingsPatch({ toolbar_small: false }); }}>
                    {(!settings?.toolbar_small ? '● ' : '○ ') + tr('Large buttons')}
                  </button>
                  <button className="menu-item" onClick={() => { closeAll(); onSaveSettingsPatch({ toolbar_small: true }); }}>
                    {(settings?.toolbar_small ? '● ' : '○ ') + tr('Small buttons')}
                  </button>
                </div>
              )}
            </div>
            <button className="menu-item" onClick={() => { closeAll(); onOpenModal('columns'); }}>{tr('Columns…')}</button>
            <div style={{ position: 'relative' }} onMouseEnter={() => setSubMenu('lang')} onMouseLeave={() => setSubMenu(null)}>
              <button className="menu-item"><span>{tr('Language')}</span><ChevronRight size={13} /></button>
              {subMenu === 'lang' && (
                <div className="menu-popup" style={{ position: 'absolute', top: 0, insetInlineStart: '100%' }}>
                  {LANGUAGES.map((l) => (
                    <button key={l.code} className="menu-item" onClick={() => { closeAll(); onSaveSettingsPatch({ language: l.code }); }}>
                      {(language === l.code ? '● ' : '○ ') + l.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }} onMouseEnter={() => setSubMenu('theme')} onMouseLeave={() => setSubMenu(null)}>
              <button className="menu-item"><span>{tr('Theme')}</span><ChevronRight size={13} /></button>
              {subMenu === 'theme' && (
                <div className="menu-popup" style={{ position: 'absolute', top: 0, insetInlineStart: '100%', maxHeight: '360px', overflowY: 'auto' }}>
                  {THEMES.map((th) => (
                    <button key={th.id} className="menu-item" onClick={() => { closeAll(); onSaveSettingsPatch({ theme: th.id }); }}>
                      {(settings?.theme === th.id ? '● ' : '○ ') + (language === 'ar' ? th.ar : tr(th.label))}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* HELP */}
      <div style={{ position: 'relative' }}>
        <button style={menuBtnStyle('help')} onClick={() => setOpenMenu(openMenu === 'help' ? null : 'help')} onMouseEnter={() => openMenu && setOpenMenu('help')}>
          {tr('Help')}
        </button>
        {openMenu === 'help' && (
          <div className="menu-popup" style={{ position: 'absolute', top: '28px', insetInlineStart: 0 }}>
            <button className="menu-item" onClick={() => { closeAll(); onOpenModal('browsers'); }}>{tr('Add DODO DM1 to my browser…')}</button>
            <button className="menu-item" onClick={() => { closeAll(); onOpenModal('shortcuts'); }}>{tr('Keyboard shortcuts')}</button>
            <button className="menu-item" onClick={() => { closeAll(); onOpenModal('whatsnew'); }}>{tr("What's new")}</button>
            <div className="menu-sep" />
            <button className="menu-item" onClick={() => { closeAll(); onOpenModal('update'); }}>{tr('Check for updates')}</button>
            <button
              className="menu-item"
              onClick={() => {
                closeAll();
                api.updateTools().then(() => onNotify(tr('Updating yt-dlp & ffmpeg in background…'), 'info')).catch((e) => onNotify(e.message, 'error'));
              }}
            >
              {tr('Check for updates (video downloader)')}
            </button>
            <div className="menu-sep" />
            <button className="menu-item" onClick={() => { closeAll(); onOpenModal('about'); }}>{tr('About DODO DM1')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
