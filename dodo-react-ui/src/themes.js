// All 13 original DODO DM1 themes matching crates/app/ui/common.slint
export const THEMES = [
  { id: 0, key: 'light', label: 'Light', ar: 'فاتح', dark: false, depth: false,
    window: '#f0f0f0', panel: '#ffffff', toolbarTop: '#fdfdfd', toolbarBot: '#e7ebf0', toolbarText: '#1b1f24',
    line: '#d9dde3', grid: '#eef0f3', headerTop: '#ffffff', headerBot: '#eef1f5', text: '#1b1f24', muted: '#5f6b78',
    accent: '#1f6feb', select: '#cce8ff', selectLine: '#99d1ff', hover: '#e5f3ff', barBg: '#e6e6e6', inputBg: '#ffffff' },
  { id: 1, key: 'dark', label: 'Dark', ar: 'داكن', dark: true, depth: false,
    window: '#1e1f22', panel: '#26282c', toolbarTop: '#2e3136', toolbarBot: '#24262a', toolbarText: '#e8eaed',
    line: '#3a3d42', grid: '#2f3237', headerTop: '#2e3136', headerBot: '#282a2e', text: '#e8eaed', muted: '#9aa0a6',
    accent: '#5b9dff', select: '#264f78', selectLine: '#3a6ea5', hover: '#2c3440', barBg: '#34373c', inputBg: '#2b2d31' },
  { id: 2, key: 'ocean', label: 'Ocean blue', ar: 'أزرق محيطي', dark: false, depth: false,
    window: '#e8f1fb', panel: '#ffffff', toolbarTop: '#2f80ed', toolbarBot: '#1b5fc4', toolbarText: '#ffffff',
    line: '#c6d8ef', grid: '#eaf2fc', headerTop: '#f7fbff', headerBot: '#e3eefb', text: '#13243a', muted: '#557090',
    accent: '#1565c0', select: '#cfe4ff', selectLine: '#8dbcf5', hover: '#e3efff', barBg: '#dbe9fa', inputBg: '#ffffff' },
  { id: 3, key: 'midnight', label: 'Midnight purple', ar: 'بنفسجي ليلي', dark: true, depth: false,
    window: '#15131d', panel: '#1d1a29', toolbarTop: '#2b2545', toolbarBot: '#1e1a33', toolbarText: '#ece9f6',
    line: '#352f4d', grid: '#26223a', headerTop: '#26223a', headerBot: '#201c31', text: '#ece9f6', muted: '#a59fc0',
    accent: '#a78bfa', select: '#3d3366', selectLine: '#5b4a99', hover: '#2a2541', barBg: '#2b2640', inputBg: '#252136' },
  { id: 4, key: 'forest', label: 'Forest green', ar: 'أخضر غابي', dark: false, depth: false,
    window: '#eef5ef', panel: '#ffffff', toolbarTop: '#2f9e5b', toolbarBot: '#1f7a43', toolbarText: '#ffffff',
    line: '#c9dfcf', grid: '#eaf4ec', headerTop: '#f8fcf9', headerBot: '#e2f0e6', text: '#15281b', muted: '#557a61',
    accent: '#1f8a4c', select: '#cdebd7', selectLine: '#8ccaa2', hover: '#e2f3e7', barBg: '#dbeee0', inputBg: '#ffffff' },
  { id: 5, key: 'black', label: 'Black', ar: 'أسود خالص', dark: true, depth: false,
    window: '#000000', panel: '#0b0b0b', toolbarTop: '#121212', toolbarBot: '#050505', toolbarText: '#f2f2f2',
    line: '#262626', grid: '#141414', headerTop: '#161616', headerBot: '#0e0e0e', text: '#f2f2f2', muted: '#9a9a9a',
    accent: '#4ea1ff', select: '#1f3550', selectLine: '#2f5a8a', hover: '#1a1a1a', barBg: '#1f1f1f', inputBg: '#121212' },
  { id: 6, key: 'sunset', label: 'Sunset', ar: 'غروب', dark: false, depth: false,
    window: '#fbf1ea', panel: '#ffffff', toolbarTop: '#f07b3f', toolbarBot: '#d4513a', toolbarText: '#ffffff',
    line: '#efd2c2', grid: '#fbeee6', headerTop: '#fffaf6', headerBot: '#f8e5d9', text: '#2e1a12', muted: '#8a6352',
    accent: '#d4513a', select: '#fbd9c8', selectLine: '#eea98a', hover: '#fdeadf', barBg: '#f6dfd1', inputBg: '#ffffff' },
  { id: 7, key: 'teal', label: 'Teal night', ar: 'تركواز ليلي', dark: true, depth: false,
    window: '#0f1c1e', panel: '#142527', toolbarTop: '#1b3a3d', toolbarBot: '#132b2e', toolbarText: '#e3f4f3',
    line: '#24403f', grid: '#1a2e30', headerTop: '#1b3133', headerBot: '#16292b', text: '#e3f4f3', muted: '#8fb3b0',
    accent: '#2ec4b6', select: '#1d4b4b', selectLine: '#2b7470', hover: '#1b3436', barBg: '#1d3638', inputBg: '#182c2e' },
  { id: 8, key: 'rose', label: 'Rose', ar: 'وردي', dark: false, depth: false,
    window: '#fbf0f4', panel: '#ffffff', toolbarTop: '#e05a8a', toolbarBot: '#c23d6e', toolbarText: '#ffffff',
    line: '#efcdda', grid: '#fbedf2', headerTop: '#fffafc', headerBot: '#f8e3eb', text: '#2e1420', muted: '#8a5a6c',
    accent: '#c23d6e', select: '#f8d3e1', selectLine: '#eaa0bb', hover: '#fde6ee', barBg: '#f4dbe5', inputBg: '#ffffff' },
  { id: 9, key: '3d', label: '3D', ar: 'ثلاثي الأبعاد', dark: true, depth: true,
    window: '#17162c', panel: '#211f3b', toolbarTop: '#1d1c36', toolbarBot: '#1a1931', toolbarText: '#eceaff',
    line: '#34325a', grid: '#29274a', headerTop: '#211f3b', headerBot: '#1e1c37', text: '#ecebf8', muted: '#a09dc6',
    accent: '#7466ff', select: '#4a41b8', selectLine: '#7466ff', hover: '#2d2b52', barBg: '#12112a', inputBg: '#252343',
    cardTop: '#2c2a4f', cardBot: '#252343', radius: '10px' },
  { id: 10, key: 'aurora', label: 'Aurora glass', ar: 'زجاج الشفق', dark: true, depth: true,
    window: '#0b0d24', panel: 'rgba(25, 28, 64, 0.78)', toolbarTop: 'rgba(255,255,255,0.05)', toolbarBot: 'rgba(255,255,255,0.02)', toolbarText: '#eef0ff',
    line: 'rgba(255,255,255,0.14)', grid: 'rgba(255,255,255,0.06)', headerTop: 'rgba(255,255,255,0.06)', headerBot: 'rgba(255,255,255,0.03)', text: '#eef0ff', muted: '#9aa3c7',
    accent: '#a78bfa', select: 'rgba(124,92,255,0.42)', selectLine: '#a78bfa', hover: 'rgba(255,255,255,0.09)', barBg: 'rgba(255,255,255,0.1)', inputBg: '#181b3d',
    cardTop: 'rgba(255,255,255,0.09)', cardBot: 'rgba(255,255,255,0.04)', radius: '14px' },
  { id: 11, key: 'clay', label: 'Soft clay', ar: 'صلصال ناعم', dark: false, depth: true,
    window: '#e9edf6', panel: '#eef1f8', toolbarTop: '#eef1f8', toolbarBot: '#e9edf6', toolbarText: '#2b3150',
    line: '#d5dbe8', grid: '#e4e8f2', headerTop: '#eef1f8', headerBot: '#e8ecf5', text: '#2b3150', muted: '#7b83a3',
    accent: '#6d5dfc', select: '#e4e0ff', selectLine: '#b9b0f0', hover: '#e6e9f4', barBg: '#dde2ee', inputBg: '#ffffff',
    cardTop: '#f5f7fc', cardBot: '#eceff6', radius: '16px' },
  { id: 12, key: 'cyber', label: 'Cyber neon', ar: 'سايبر نيون', dark: true, depth: true,
    window: '#05060c', panel: '#0a0d18', toolbarTop: '#0c0f1c', toolbarBot: '#080a14', toolbarText: '#e7f6ff',
    line: '#1e2747', grid: '#10162a', headerTop: '#0e1222', headerBot: '#0a0d18', text: '#e7f6ff', muted: '#7f8fb5',
    accent: '#00d1ff', select: '#1a1438', selectLine: '#b84dff', hover: '#111628', barBg: '#161c33', inputBg: '#0c101e',
    cardTop: '#121729', cardBot: '#0c101e', radius: '8px' },
];

export function applyThemeToDom(themeId, fontScale = 100, fontFamily = '') {
  const th = THEMES[themeId] || THEMES[0];
  const root = document.documentElement;
  root.setAttribute('data-theme', th.dark ? 'dark' : 'light');
  root.setAttribute('data-depth', th.depth ? '1' : '0');
  root.style.setProperty('--bg-primary', th.window);
  root.style.setProperty('--bg-secondary', th.panel);
  root.style.setProperty('--bg-tertiary', th.grid);
  root.style.setProperty('--bg-hover', th.hover);
  root.style.setProperty('--toolbar-top', th.toolbarTop);
  root.style.setProperty('--toolbar-bot', th.toolbarBot);
  root.style.setProperty('--toolbar-text', th.toolbarText);
  root.style.setProperty('--header-top', th.headerTop);
  root.style.setProperty('--header-bot', th.headerBot);
  root.style.setProperty('--border-color', th.line);
  root.style.setProperty('--text-primary', th.text);
  root.style.setProperty('--text-secondary', th.muted);
  root.style.setProperty('--text-muted', th.muted);
  root.style.setProperty('--accent-primary', th.accent);
  root.style.setProperty('--select-bg', th.select);
  root.style.setProperty('--select-line', th.selectLine);
  root.style.setProperty('--bar-bg', th.barBg);
  root.style.setProperty('--input-bg', th.inputBg);
  root.style.setProperty('--card-top', th.cardTop || th.panel);
  root.style.setProperty('--card-bot', th.cardBot || th.window);
  root.style.setProperty('--card-radius', th.radius || '6px');
  root.style.setProperty('--accent-success', th.dark ? '#3fcf7a' : '#1f9d55');
  root.style.setProperty('--accent-warning', '#e08a00');
  root.style.setProperty('--accent-danger', th.dark ? '#ff6b62' : '#d23b32');
  const scale = Math.max(80, Math.min(150, fontScale || 100)) / 100;
  root.style.fontSize = `${14 * scale}px`;
  if (fontFamily && fontFamily.trim()) {
    root.style.setProperty('--font-family', `"${fontFamily.trim()}", 'Cairo', 'Inter', 'Segoe UI', sans-serif`);
  } else {
    root.style.setProperty('--font-family', `'Cairo', 'Inter', 'Segoe UI', Tahoma, sans-serif`);
  }
}
