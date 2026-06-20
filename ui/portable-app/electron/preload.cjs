const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  restartBackend: () => ipcRenderer.invoke('restart-backend'),
  reloadWindow: () => ipcRenderer.invoke('reload-window')
});
