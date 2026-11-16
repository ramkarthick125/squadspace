import React, { useEffect, useState } from 'react';
import { Minus, Square, Copy, X, Sparkles, Loader2 } from 'lucide-react';
import { useVoiceStore } from '../../store/useVoiceStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useServerStore } from '../../store/useServerStore';

export const DiscordTitleBar: React.FC = () => {
  const isElectron = Boolean(window.electronAPI?.isElectron);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [appVersion, setAppVersion] = useState<string>(() => {
    try {
      return (window as any).__APP_VERSION__ || '1.0.8';
    } catch {
      return '1.0.8';
    }
  });

  useEffect(() => {
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then((v) => {
        if (v) setAppVersion(v);
      });
    }
  }, []);
  const [updateStatus, setUpdateStatus] = useState<{
    status: 'checking' | 'available' | 'up-to-date' | 'downloading' | 'downloaded' | 'error';
    version?: string;
    percent?: number;
  } | null>(null);

  const { toggleMute, toggleDeafen } = useVoiceStore();
  const { currentUser } = useAuthStore();
  const { serverName, activeView } = useServerStore();

  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;

    // Check initial maximized state
    window.electronAPI.isMaximized().then(setIsMaximized);

    // Subscribe to maximize changes
    const unsubMax = window.electronAPI.onMaximizeChange(setIsMaximized);

    // Subscribe to global hotkeys (Work while gaming full screen!)
    const unsubMute = window.electronAPI.onToggleMute(() => {
      toggleMute();
    });

    const unsubDeafen = window.electronAPI.onToggleDeafen(() => {
      toggleDeafen();
    });

    // Subscribe to auto-updater notifications
    const unsubUpdater = window.electronAPI.onUpdateStatus?.((data) => {
      setUpdateStatus(data);
    });

    return () => {
      if (unsubMax) unsubMax();
      if (unsubMute) unsubMute();
      if (unsubDeafen) unsubDeafen();
      if (unsubUpdater) unsubUpdater();
    };
  }, [isElectron, toggleMute, toggleDeafen]);

  if (!isElectron) return null;

  return (
    <div
      className="h-7 w-full bg-[#1e1f22] border-b border-[#111214] flex items-center justify-between select-none z-[100] text-discord-gray-400 text-xs flex-shrink-0 relative"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* App Branding & Window Title */}
      <div className="flex items-center gap-2 px-3">
        <div className="w-3.5 h-3.5 rounded-full bg-discord-blurple flex items-center justify-center text-[9px] text-white font-bold">
          🚀
        </div>
        <span className="font-bold text-[11px] text-discord-gray-300 tracking-wide">
          SquadSpace
        </span>
        <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#111214] text-purple-300 font-mono font-semibold border border-purple-500/30" title={`SquadSpace v${appVersion}`}>
          v{appVersion}
        </span>
        <span className="text-[10px] text-discord-gray-500">
          — {!currentUser ? 'Log In' : activeView === 'dm' ? 'Direct Messages' : serverName || 'Hangout'}
        </span>
      </div>

      {/* Auto-Update Notification Banner */}
      {updateStatus && updateStatus.status === 'downloading' && (
        <div
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-900/60 border border-purple-500/30 text-purple-200 text-[10px] select-none"
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
          <span>Downloading update {updateStatus.percent ? `(${updateStatus.percent}%)` : ''}...</span>
        </div>
      )}

      {updateStatus && updateStatus.status === 'downloaded' && (
        <div style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            type="button"
            disabled={isRestarting}
            onClick={() => {
              setIsRestarting(true);
              window.electronAPI?.restartAndInstallUpdate?.();
            }}
            title="Click to restart and apply update now"
            className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-75 text-white font-medium text-[10px] shadow transition cursor-pointer"
          >
            {isRestarting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Updating & Restarting...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" />
                <span>Update ready — Restart</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Windows Controls (Minimize, Maximize, Close) */}
      <div
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {/* Minimize */}
        <button
          type="button"
          onClick={() => window.electronAPI?.minimize()}
          title="Minimize"
          className="h-full px-3.5 flex items-center justify-center hover:bg-[#35373c] hover:text-white transition-colors cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Maximize / Restore */}
        <button
          type="button"
          onClick={() => window.electronAPI?.maximize()}
          title={isMaximized ? 'Restore Down' : 'Maximize'}
          className="h-full px-3.5 flex items-center justify-center hover:bg-[#35373c] hover:text-white transition-colors cursor-pointer"
        >
          {isMaximized ? (
            <Copy className="w-3 h-3" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>

        {/* Close (Turns Red on hover like Discord & Windows native) */}
        <button
          type="button"
          onClick={() => window.electronAPI?.close()}
          title="Close to Tray"
          className="h-full px-4 flex items-center justify-center hover:bg-[#ed4245] hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
