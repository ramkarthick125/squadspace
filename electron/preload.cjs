const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Window Controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizeChange: (callback) => {
    const handler = (_event, isMax) => callback(isMax);
    ipcRenderer.on('window:maximized-change', handler);
    return () => ipcRenderer.removeListener('window:maximized-change', handler);
  },

  // Native Screen Capture (Applications & Screens with thumbnails)
  getScreenSources: () => ipcRenderer.invoke('screen:get-sources'),

  // Global Hotkey Listeners
  onToggleMute: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('hotkey:toggle-mute', handler);
    return () => ipcRenderer.removeListener('hotkey:toggle-mute', handler);
  },
  onToggleDeafen: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('hotkey:toggle-deafen', handler);
    return () => ipcRenderer.removeListener('hotkey:toggle-deafen', handler);
  },

  // Deep Linking (squadspace://invite/sqd-xxx)
  onDeepLink: (callback) => {
    const handler = (_event, url) => callback(url);
    ipcRenderer.on('deeplink:navigate', handler);
    return () => ipcRenderer.removeListener('deeplink:navigate', handler);
  },
});
