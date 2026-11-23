const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dodoElectron', {
  getBackendInfo: () => ipcRenderer.invoke('dodo-backend-info'),
  windowAction: (action) => ipcRenderer.invoke('dodo-window-action', action),
});
