const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let backendProc = null;
let backendInfo = null; // { baseUrl, token, uiUrl }

function findBackendExe() {
  const candidates = [
    path.resolve(__dirname, '..', 'target', 'release', 'DodoDM1.exe'),
    path.resolve(__dirname, '..', 'DodoDM1.exe'),
    path.resolve(__dirname, '..', 'build-cache', 'stage', 'DodoDM1.exe'),
    path.resolve(__dirname, '..', 'target', 'debug', 'DodoDM1.exe'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const exe = findBackendExe();
    if (!exe) {
      reject(new Error('DodoDM1.exe was not found. Build it first with: cargo build --release'));
      return;
    }

    backendProc = spawn(exe, ['--backend'], {
      cwd: path.dirname(exe),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let settled = false;
    let buf = '';

    const onChunk = (chunk) => {
      buf += chunk.toString('utf8');
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() || '';
      for (const line of lines) {
        const idx = line.indexOf('DODO_UI_URL=');
        if (idx !== -1 && !settled) {
          const uiUrl = line.slice(idx + 'DODO_UI_URL='.length).trim();
          const parsed = new URL(uiUrl);
          const token = parsed.searchParams.get('t') || '';
          const baseUrl = `${parsed.protocol}//${parsed.host}`;
          backendInfo = { baseUrl, token, uiUrl };
          settled = true;
          resolve(backendInfo);
        }
      }
    };

    backendProc.stdout.on('data', onChunk);
    backendProc.stderr.on('data', (d) => {
      if (!settled) console.error('[backend]', d.toString('utf8'));
    });

    backendProc.on('exit', (code) => {
      if (!settled) {
        settled = true;
        reject(new Error(`DodoDM1.exe --backend exited with code ${code}`));
      }
    });

    setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Timed out waiting for DODO DM1 backend URL'));
      }
    }, 15000);
  });
}

function sendQuitToBackend() {
  if (!backendInfo) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      const u = new URL(`${backendInfo.baseUrl}/ui/window`);
      const body = JSON.stringify({ action: 'quit' });
      const req = http.request(
        {
          hostname: u.hostname,
          port: u.port,
          path: u.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'X-Dodo-Session': backendInfo.token,
          },
        },
        () => resolve()
      );
      req.on('error', () => resolve());
      req.setTimeout(1500, () => { req.destroy(); resolve(); });
      req.write(body);
      req.end();
    } catch {
      resolve();
    }
  });
}

function createWindow(uiUrl) {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 920,
    minHeight: 600,
    frame: false,
    backgroundColor: '#1e1f22',
    icon: path.join(__dirname, 'public', 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(uiUrl);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('dodo-backend-info', () => backendInfo);

ipcMain.handle('dodo-window-action', async (_evt, action) => {
  if (!mainWindow) return { ok: false };
  switch (action) {
    case 'minimize': mainWindow.minimize(); break;
    case 'maximize':
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
      break;
    case 'close':
    case 'quit':
      mainWindow.close();
      break;
    case 'hide':
      mainWindow.hide();
      break;
    case 'show':
      mainWindow.show();
      mainWindow.focus();
      break;
    default:
      break;
  }
  return { ok: true };
});

app.whenReady().then(async () => {
  try {
    const info = await startBackend();
    createWindow(info.uiUrl);
  } catch (err) {
    dialog.showErrorBox('DODO DM1', err.message || String(err));
    app.quit();
  }
});

app.on('window-all-closed', async () => {
  await sendQuitToBackend();
  if (backendProc && !backendProc.killed) {
    setTimeout(() => {
      try { backendProc.kill(); } catch {}
      app.quit();
    }, 300);
  } else {
    app.quit();
  }
});
