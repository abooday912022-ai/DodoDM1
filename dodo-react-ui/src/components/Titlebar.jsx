import React, { useState } from 'react';
import { Minus, Square, X, Palette, Globe } from 'lucide-react';
import { THEMES } from '../themes';
import { LANGUAGES } from '../translations';
import { api } from '../api';

export default function Titlebar({ tr, themeId, onSelectTheme, language, onSelectLanguage, onOpenModal }) {
  const [menuOpen, setMenuOpen] = useState(null); // 'theme' | 'lang' | null

  const isElectron = typeof window !== 'undefined' && Boolean(window.dodoElectron);
  const winAct = (a) => {
    api.windowAction(a).catch(() => {});
  };

  return (
    <div
      onMouseDown={(e) => {
        if (!isElectron && e.button === 0 && !e.target.closest('button') && !e.target.closest('.title-pop')) {
          winAct('drag');
        }
      }}
      onDoubleClick={(e) => {
        if (!e.target.closest('button')) winAct('maximize');
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '36px',
        background: 'linear-gradient(180deg, var(--header-top), var(--header-bot))',
        borderBottom: '1px solid var(--border-color)',
        padding: '0 8px',
        position: 'relative',
        WebkitAppRegion: isElectron ? 'drag' : undefined,
      }}
    >
      {/* Brand & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'none' }}>
        <img src="./logo.png" alt="DODO DM1" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
        <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
          DODO DM1
        </span>
      </div>

      {/* Quick pickers & Window controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative', WebkitAppRegion: 'no-drag' }}>
        {/* Language selector */}
        <button
          onClick={() => setMenuOpen(menuOpen === 'lang' ? null : 'lang')}
          className="btn-icon"
          title={tr('Language')}
          style={{ fontSize: '0.75rem', fontWeight: 700, gap: '4px', padding: '4px 7px' }}
        >
          <Globe size={14} />
          <span>{LANGUAGES.find((l) => l.code === language)?.name || 'English'}</span>
        </button>

        {/* 13 Themes selector */}
        <button
          onClick={() => setMenuOpen(menuOpen === 'theme' ? null : 'theme')}
          className="btn-icon"
          title={tr('Theme')}
          style={{ fontSize: '0.75rem', fontWeight: 700, gap: '4px', padding: '4px 7px' }}
        >
          <Palette size={14} color="var(--accent-primary)" />
          <span>{language === 'ar' ? (THEMES[themeId]?.ar || 'السمة') : (THEMES[themeId]?.label || 'Theme')}</span>
        </button>

        {menuOpen === 'lang' && (
          <div
            className="menu-popup title-pop"
            style={{ top: '34px', insetInlineEnd: '95px', position: 'absolute', minWidth: '150px' }}
            onMouseLeave={() => setMenuOpen(null)}
          >
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                className="menu-item"
                onClick={() => {
                  onSelectLanguage(l.code);
                  setMenuOpen(null);
                }}
              >
                <span>{language === l.code ? '● ' : '○ '}{l.name}</span>
              </button>
            ))}
          </div>
        )}

        {menuOpen === 'theme' && (
          <div
            className="menu-popup title-pop"
            style={{ top: '34px', insetInlineEnd: '85px', position: 'absolute', minWidth: '185px', maxHeight: '380px', overflowY: 'auto' }}
            onMouseLeave={() => setMenuOpen(null)}
          >
            {THEMES.map((th) => (
              <button
                key={th.id}
                className="menu-item"
                onClick={() => {
                  onSelectTheme(th.id);
                  setMenuOpen(null);
                }}
              >
                <span>{themeId === th.id ? '● ' : '○ '}{language === 'ar' ? th.ar : tr(th.label)}</span>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: th.accent, border: '1px solid var(--border-color)' }} />
              </button>
            ))}
            <div className="menu-sep" />
            <button
              className="menu-item"
              onClick={() => {
                setMenuOpen(null);
                onOpenModal('settings', 9);
              }}
            >
              <span>{tr('Appearance…')}</span>
            </button>
          </div>
        )}

        <div style={{ width: '1px', height: '16px', background: 'var(--border-color)', margin: '0 4px' }} />

        <button onClick={() => winAct('minimize')} className="btn-icon" title="Minimize" style={{ width: '28px', height: '26px' }}>
          <Minus size={14} />
        </button>
        <button onClick={() => winAct('maximize')} className="btn-icon" title="Maximize" style={{ width: '28px', height: '26px' }}>
          <Square size={12} />
        </button>
        <button
          onClick={() => winAct('close')}
          className="btn-icon"
          title={tr('Close')}
          style={{ width: '28px', height: '26px' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#ef4444';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
