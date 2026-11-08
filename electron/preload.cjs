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
  onAppCommandMouse: (callback) => {
    const handler = (_event, mouseBtn) => callback(mouseBtn);
    ipcRenderer.on('hotkey:mouse-click', handler);
    return () => ipcRenderer.removeListener('hotkey:mouse-click', handler);
  },

  // Deep Linking (squadspace://invite/sqd-xxx)
  onDeepLink: (callback) => {
    const handler = (_event, url) => callback(url);
    ipcRenderer.on('deeplink:navigate', handler);
    return () => ipcRenderer.removeListener('deeplink:navigate', handler);
  },

  // Co-op Remote Play (Parsec-style Virtual Xbox 360 & Keyboard/Mouse injection)
  coopGetDriverStatus: () => ipcRenderer.invoke('coop:get-driver-status'),
  coopSlotConnect: (slot, inputMode) => ipcRenderer.invoke('coop:slot-connect', slot, inputMode),
  coopSlotDisconnect: (slot) => ipcRenderer.invoke('coop:slot-disconnect', slot),
  coopSetPause: (slot, isPaused) => ipcRenderer.invoke('coop:set-pause', slot, isPaused),
  coopSetMode: (slot, inputMode) => ipcRenderer.invoke('coop:set-mode', slot, inputMode),
  coopInjectGamepad: (slot, data) => ipcRenderer.send('coop:inject-gamepad', slot, data),
  coopInjectKeyboard: (slot, data) => ipcRenderer.send('coop:inject-keyboard', slot, data),
  coopInjectMouse: (slot, data) => ipcRenderer.send('coop:inject-mouse', slot, data),
  coopPanicDisconnectAll: () => ipcRenderer.invoke('coop:panic-disconnect-all'),
  onCoopPanic: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('coop:panic-triggered', handler);
    return () => ipcRenderer.removeListener('coop:panic-triggered', handler);
  },
});
