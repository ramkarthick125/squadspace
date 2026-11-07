const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  Tray,
  Menu,
  globalShortcut,
  nativeImage,
  session,
  shell,
} = require('electron');
const path = require('path');
const coopHost = require('./coopHost.cjs');

// Live Hosted Deployment URL (Discord-style remote auto-updating shell)
const REMOTE_APP_URL = process.env.SQUADSPACE_REMOTE_URL || 'https://squadspace-flame.vercel.app';

// 1. Hardware Acceleration & Unthrottled Streaming GPU Flags
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('force-video-over-gpu');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('enable-features', 'WebRtcHideLocalIpsWithMdns');

// Register custom protocol for deep linking: squadspace://invite/sqd-xxx
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('squadspace', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('squadspace');
}

let mainWindow = null;
let tray = null;
let isQuitting = false;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 960,
    minHeight: 580,
    frame: false, // Frameless Discord window
    titleBarStyle: 'hidden',
    backgroundColor: '#1e1f22',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for desktopCapturer thumbnail access
      webSecurity: true,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Window state change notifications
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximized-change', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximized-change', false);
  });

  // Keyboard shortcuts: DevTools (F12 / Ctrl+Shift+I) & Instant App Reload (Ctrl+R / F5)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // DevTools
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
      return;
    }

    // Hard Reload (Ctrl+Shift+R) - Clears cache and gets latest Vercel build
    if (input.control && input.shift && input.key.toLowerCase() === 'r') {
      mainWindow.webContents.reloadIgnoringCache();
      event.preventDefault();
      return;
    }

    // Soft Reload (Ctrl+R or F5) - Refreshes current state
    if ((input.control && input.key.toLowerCase() === 'r') || input.key === 'F5') {
      mainWindow.webContents.reload();
      event.preventDefault();
      return;
    }
  });

  // Grant hardware microphone, audio, screen capture, and notification permissions automatically
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const autoApproved = [
      'media',
      'mediaKeySystem',
      'notifications',
      'fullscreen',
      'pointerLock',
      'display-capture',
      'screen',
      'window-placement',
      'background-sync',
    ];
    callback(autoApproved.includes(permission));
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    const autoApproved = [
      'media',
      'mediaKeySystem',
      'notifications',
      'fullscreen',
      'pointerLock',
      'display-capture',
      'screen',
      'window-placement',
      'background-sync',
    ];
    return autoApproved.includes(permission);
  });

  // Handle getDisplayMedia requests seamlessly in Electron
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      if (sources.length > 0) {
        callback({ video: sources[0], audio: 'loopback' });
      } else {
        callback({ video: null });
      }
    }).catch(() => {
      callback({ video: null });
    });
  });

  // Open external links in default browser instead of navigating inside SquadSpace
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost') && !url.startsWith(REMOTE_APP_URL) && !url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Fallback to local files if remote load fails (e.g. offline)
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (validatedURL && validatedURL.startsWith('http') && !validatedURL.includes('localhost')) {
      console.warn(`Remote load failed (${errorCode}: ${errorDescription}), falling back to local files.`);
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html')).catch(() => {});
    }
  });

  // Minimize to tray on close unless quitting
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  // Load URL: Dev Server -> Remote Live URL -> Local Fallback Bundle
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadURL(REMOTE_APP_URL).catch((err) => {
      console.warn('Failed to load remote URL, falling back to local bundle:', err);
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html')).catch(() => {});
    });
  }
}

function createTray() {
  // Simple 16x16 tray icon
  const icon = nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZElEQVQ4T2NkGGDAOMD/n4EYQx2jBpA0jBpA0jBpAJt6mH0MyT0jL15kGHAeBmM0cWwGoLpjhGvABbBFB6V+Jtcw7A5GFsf4A11qGP7/PwO6R1kZ8ANs5mH3H6m24w0u7HEGAEx9LzP6eM3OAAAAAElFTkSuQmCC',
      'base64'
    )
  );

  tray = new Tray(icon);
  tray.setToolTip('SquadSpace');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open SquadSpace',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Toggle Mute (Ctrl+Shift+M)',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('hotkey:toggle-mute');
        }
      },
    },
    {
      label: 'Toggle Deafen (Ctrl+Shift+D)',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('hotkey:toggle-deafen');
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit SquadSpace',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function registerGlobalShortcuts() {
  // Global Mute Toggle (Works while gaming full screen!)
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (mainWindow) {
      mainWindow.webContents.send('hotkey:toggle-mute');
    }
  });

  // Global Deafen Toggle
  globalShortcut.register('CommandOrControl+Shift+D', () => {
    if (mainWindow) {
      mainWindow.webContents.send('hotkey:toggle-deafen');
    }
  });

  // Global Co-op Remote Play Panic Disconnect (Instantly severs all remote inputs)
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    coopHost.panicDisconnectAll();
    if (mainWindow) {
      mainWindow.webContents.send('coop:panic-triggered');
    }
  });
}

// ----------------------------------------------------------------------------
// IPC Handlers
// ----------------------------------------------------------------------------

// 1. Window Controls
ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// 2. Native Screen Capture Sources (The core upgrade!)
ipcMain.handle('screen:get-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 640, height: 360 },
      fetchWindowIcons: true,
    });

    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail ? s.thumbnail.toDataURL() : null,
      appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
      display_id: s.display_id,
      isScreen: s.id.startsWith('screen:'),
    }));
  } catch (err) {
    console.error('Failed to get desktop capture sources:', err);
    return [];
  }
});

// 3. Co-Op Remote Play IPC Handlers (ViGEm Virtual Xbox 360 & Keyboard/Mouse)
ipcMain.handle('coop:get-driver-status', () => {
  return coopHost.getDriverStatus();
});

ipcMain.handle('coop:slot-connect', (_event, slot, inputMode) => {
  return coopHost.connectSlot(slot, inputMode);
});

ipcMain.handle('coop:slot-disconnect', (_event, slot) => {
  coopHost.slotDisconnect(slot);
  return true;
});

ipcMain.handle('coop:set-pause', (_event, slot, isPaused) => {
  coopHost.setSlotPause(slot, isPaused);
  return true;
});

ipcMain.handle('coop:set-mode', (_event, slot, inputMode) => {
  coopHost.setSlotMode(slot, inputMode);
  return true;
});

ipcMain.on('coop:inject-gamepad', (_event, slot, data) => {
  coopHost.injectGamepad(slot, data);
});

ipcMain.on('coop:inject-keyboard', (_event, slot, data) => {
  coopHost.injectKeyboard(slot, data);
});

ipcMain.on('coop:inject-mouse', (_event, slot, data) => {
  coopHost.injectMouse(slot, data);
});

ipcMain.handle('coop:panic-disconnect-all', () => {
  coopHost.panicDisconnectAll();
  return true;
});

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }

    // Handle deep links in second instance: squadspace://invite/sqd-xxxx
    const deepLinkUrl = commandLine.find((arg) => arg.startsWith('squadspace://'));
    if (deepLinkUrl && mainWindow) {
      mainWindow.webContents.send('deeplink:navigate', deepLinkUrl);
    }
  });

  app.whenReady().then(() => {
    createMainWindow();
    createTray();
    registerGlobalShortcuts();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

app.on('will-quit', () => {
  coopHost.panicDisconnectAll();
  globalShortcut.unregisterAll();
});
