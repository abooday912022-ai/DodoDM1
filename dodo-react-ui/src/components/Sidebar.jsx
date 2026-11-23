import React, { useState } from 'react';
import {
  Download,
  ChevronDown,
  ChevronRight,
  Video,
  Music,
  Archive,
  FileText,
  Terminal,
  Image as ImageIcon,
  Folder,
  Clock,
  CheckCircle2,
  ListOrdered,
  Play,
  Square,
  HardDrive,
  Plus,
} from 'lucide-react';
import { api } from '../api';

function catIcon(name) {
  switch (name) {
    case 'Compressed': return <Archive size={14} color="#fb8a2e" />;
    case 'Documents': return <FileText size={14} color="#ec4652" />;
    case 'Music': return <Music size={14} color="#2fc76c" />;
    case 'Programs': return <Terminal size={14} color="#3d8bf5" />;
    case 'Video': return <Video size={14} color="#a56bff" />;
    case 'Images': return <ImageIcon size={14} color="#2ec4b6" />;
    case 'General': return <Folder size={14} color="#f0b323" />;
    default: return <Folder size={14} color="#f0b323" />;
  }
}

export default function Sidebar({
  tr,
  view,
  setView,
  downloads,
  categories,
  queues,
  diskFreeFmt,
  toolsReady,
  onOpenModal,
  onRefreshState,
}) {
  const [openAll, setOpenAll] = useState(true);
  const [openUnf, setOpenUnf] = useState(false);
  const [openFin, setOpenFin] = useState(false);
  const [openQueues, setOpenQueues] = useState(true);
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, type: 'cat'|'queue', target }

  const allCats = [
    ...categories,
    { name: 'General', builtin: true, exts: [], sites: [], dir: '' },
  ];

  const countAll = (cat) => downloads.filter((d) => d.category === cat).length;
  const countUnf = (cat) => downloads.filter((d) => d.category === cat && d.status !== 'Completed').length;
  const countFin = (cat) => downloads.filter((d) => d.category === cat && d.status === 'Completed').length;
  const totalUnf = downloads.filter((d) => d.status !== 'Completed').length;
  const totalFin = downloads.filter((d) => d.status === 'Completed').length;

  const itemStyle = (active) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '5px 8px',
    borderRadius: '5px',
    border: 'none',
    background: active ? 'var(--select-bg)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-primary)',
    fontWeight: active ? 700 : 500,
    fontSize: '0.8rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    textAlign: 'start',
  });

  const openCategoryMenu = (e, cat) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, type: 'cat', target: cat });
  };

  const openQueueMenu = (e, q) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, type: 'queue', target: q });
  };

  return (
    <div
      style={{
        width: '235px',
        minWidth: '190px',
        background: 'var(--bg-secondary)',
        borderInlineEnd: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '8px 6px',
        overflowY: 'auto',
      }}
      onClick={() => ctxMenu && setCtxMenu(null)}
    >
      {/* ALL DOWNLOADS TREE */}
      <div style={{ marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            onClick={() => setOpenAll(!openAll)}
            className="btn-icon"
            style={{ padding: '4px' }}
          >
            {openAll ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          <button
            style={itemStyle(view === 'all')}
            onClick={() => setView('all')}
            onContextMenu={(e) => openCategoryMenu(e, null)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={14} color="var(--accent-primary)" />
              <span>{tr('All Downloads')}</span>
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{downloads.length}</span>
          </button>
        </div>

        {openAll && (
          <div style={{ paddingInlineStart: '18px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {allCats.map((c) => {
              const key = `cat:${c.name}`;
              return (
                <button
                  key={c.name}
                  style={itemStyle(view === key)}
                  onClick={() => setView(key)}
                  onContextMenu={(e) => openCategoryMenu(e, c)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {catIcon(c.name)}
                    <span>{tr(c.name)}</span>
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{countAll(c.name)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* UNFINISHED TREE */}
      <div style={{ marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button onClick={() => setOpenUnf(!openUnf)} className="btn-icon" style={{ padding: '4px' }}>
            {openUnf ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          <button style={itemStyle(view === 'unfinished')} onClick={() => setView('unfinished')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} color="#f59e0b" />
              <span>{tr('Unfinished')}</span>
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{totalUnf}</span>
          </button>
        </div>
        {openUnf && (
          <div style={{ paddingInlineStart: '18px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {allCats.map((c) => {
              const key = `unf:${c.name}`;
              return (
                <button key={c.name} style={itemStyle(view === key)} onClick={() => setView(key)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {catIcon(c.name)}
                    <span>{tr(c.name)}</span>
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{countUnf(c.name)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* FINISHED TREE */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button onClick={() => setOpenFin(!openFin)} className="btn-icon" style={{ padding: '4px' }}>
            {openFin ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          <button style={itemStyle(view === 'finished')} onClick={() => setView('finished')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} color="#10b981" />
              <span>{tr('Finished')}</span>
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{totalFin}</span>
          </button>
        </div>
        {openFin && (
          <div style={{ paddingInlineStart: '18px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {allCats.map((c) => {
              const key = `fin:${c.name}`;
              return (
                <button key={c.name} style={itemStyle(view === key)} onClick={() => setView(key)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {catIcon(c.name)}
                    <span>{tr(c.name)}</span>
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{countFin(c.name)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 6px 8px' }} />

      {/* QUEUES TREE */}
      <div style={{ marginBottom: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 4px' }}>
          <button
            onClick={() => setOpenQueues(!openQueues)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {openQueues ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <ListOrdered size={13} />
            <span>{tr('Queues')}</span>
          </button>
          <button
            className="btn-icon"
            title={tr('New queue…')}
            onClick={() => onOpenModal('scheduler', { newQueue: true })}
            style={{ padding: '2px' }}
          >
            <Plus size={13} />
          </button>
        </div>

        {openQueues && (
          <div style={{ paddingInlineStart: '10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {queues.map((q) => {
              const key = `queue:${q.id}`;
              return (
                <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <button
                    style={{ ...itemStyle(view === key), flex: 1 }}
                    onClick={() => setView(key)}
                    onContextMenu={(e) => openQueueMenu(e, q)}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background: q.running ? '#22c55e' : 'var(--text-muted)',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.name}</span>
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{q.count}</span>
                  </button>
                  <button
                    className="btn-icon"
                    title={q.running ? tr('Stop queue') : tr('Start queue')}
                    onClick={async () => {
                      if (q.running) await api.queueStop(q.id);
                      else await api.queueStart(q.id);
                      onRefreshState();
                    }}
                  >
                    {q.running ? <Square size={11} color="#ef4444" /> : <Play size={11} color="#22c55e" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Engine / Disk Status */}
      <div
        style={{
          marginTop: '10px',
          padding: '8px 10px',
          borderRadius: '6px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          fontSize: '0.71rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--text-primary)' }}>
          <HardDrive size={13} color="var(--accent-primary)" />
          <span>{tr('Free space')}: {diskFreeFmt || '---'}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', color: 'var(--text-muted)' }}>
          <span>yt-dlp: {toolsReady?.ytdlp ? '✔' : '…'}</span>
          <span>ffmpeg: {toolsReady?.ffmpeg ? '✔' : '…'}</span>
        </div>
      </div>

      {/* Sidebar Context Menu */}
      {ctxMenu && (
        <div
          className="menu-popup"
          style={{ left: Math.min(ctxMenu.x, window.innerWidth - 220), top: Math.min(ctxMenu.y, window.innerHeight - 200) }}
          onClick={(e) => e.stopPropagation()}
        >
          {ctxMenu.type === 'cat' && (
            <>
              <button className="menu-item" onClick={() => { setCtxMenu(null); onOpenModal('category', null); }}>
                {tr('Add category…')}
              </button>
              {ctxMenu.target && ctxMenu.target.name !== 'General' && (
                <>
                  <button className="menu-item" onClick={() => { const t = ctxMenu.target; setCtxMenu(null); onOpenModal('category', t); }}>
                    {tr('Properties…')}
                  </button>
                  {!ctxMenu.target.builtin && (
                    <button
                      className="menu-item"
                      onClick={async () => {
                        const name = ctxMenu.target.name;
                        setCtxMenu(null);
                        await api.categoryDelete(name);
                        onRefreshState();
                      }}
                    >
                      {tr('Delete category')}
                    </button>
                  )}
                </>
              )}
            </>
          )}
          {ctxMenu.type === 'queue' && ctxMenu.target && (
            <>
              <button className="menu-item" onClick={async () => { const q = ctxMenu.target; setCtxMenu(null); await api.queueStart(q.id); onRefreshState(); }}>
                {tr('Start queue')}
              </button>
              <button className="menu-item" onClick={async () => { const q = ctxMenu.target; setCtxMenu(null); await api.queueStop(q.id); onRefreshState(); }}>
                {tr('Stop queue')}
              </button>
              <div className="menu-sep" />
              <button className="menu-item" onClick={() => { const q = ctxMenu.target; setCtxMenu(null); onOpenModal('scheduler', { queueId: q.id }); }}>
                {tr('Edit queue / schedule…')}
              </button>
              <button className="menu-item" onClick={() => { setCtxMenu(null); onOpenModal('scheduler', { newQueue: true }); }}>
                {tr('New queue…')}
              </button>
              {ctxMenu.target.id !== 1 && (
                <button
                  className="menu-item"
                  onClick={async () => {
                    const q = ctxMenu.target;
                    setCtxMenu(null);
                    await api.queueDelete(q.id);
                    onRefreshState();
                  }}
                >
                  {tr('Delete queue')}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
