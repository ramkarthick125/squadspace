import React, { useState, useEffect } from 'react';
import {
  X,
  ScreenShare,
  Tv,
  Volume2,
  Monitor,
  AppWindow,
  RefreshCw,
  Info,
  Loader2,
} from 'lucide-react';
import { ScreenSharePreset, SCREEN_SHARE_PRESETS } from '../../lib/livekit';
import { DesktopCaptureSource } from '../../types';

interface ScreenShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartStream: (
    presetKey: ScreenSharePreset,
    options: { systemAudio: boolean; sourceId?: string }
  ) => void;
  defaultPreset?: ScreenSharePreset;
}

export const ScreenShareModal: React.FC<ScreenShareModalProps> = ({
  isOpen,
  onClose,
  onStartStream,
  defaultPreset = '1080p-60',
}) => {
  const isElectron = Boolean(window.electronAPI?.isElectron);

  const [selectedPreset, setSelectedPreset] = useState<ScreenSharePreset>(defaultPreset);
  const [selectedResolution, setSelectedResolution] = useState<'720p' | '1080p' | '1440p' | 'source'>('1080p');
  const [selectedFps, setSelectedFps] = useState<15 | 30 | 60>(60);
  const [shareSystemAudio, setShareSystemAudio] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  // Tabs: 'screens' | 'apps' | 'quality'
  const [activeTab, setActiveTab] = useState<'apps' | 'screens' | 'quality'>(
    isElectron ? 'screens' : 'quality'
  );

  // Native Electron Sources
  const [sources, setSources] = useState<DesktopCaptureSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [isLoadingSources, setIsLoadingSources] = useState(false);

  // Load native screen capture sources if running in Electron
  const loadSources = async () => {
    if (!isElectron || !window.electronAPI?.getScreenSources) return;
    setIsLoadingSources(true);
    try {
      const list = await window.electronAPI.getScreenSources();
      setSources(list);
      if (list.length > 0 && !selectedSourceId) {
        const firstScreen = list.find((s) => s.isScreen);
        setSelectedSourceId(firstScreen ? firstScreen.id : list[0].id);
      }
    } catch (err) {
      console.warn('Failed to load screen sources:', err);
    } finally {
      setIsLoadingSources(false);
    }
  };

  useEffect(() => {
    if (isOpen && isElectron) {
      loadSources();
    }
  }, [isOpen, isElectron]);

  if (!isOpen) return null;

  const handleCustomSelect = (res: '720p' | '1080p' | '1440p' | 'source', fps: 15 | 30 | 60) => {
    setSelectedResolution(res);
    setSelectedFps(fps);

    if (res === 'source') {
      setSelectedPreset('source-60');
    } else if (res === '1440p') {
      setSelectedPreset(fps === 60 ? '1440p-60' : '1440p-30');
    } else if (res === '1080p') {
      setSelectedPreset(fps === 60 ? '1080p-60' : '1080p-30');
    } else {
      setSelectedPreset(fps === 60 ? '720p-60' : '720p-30');
    }
  };

  const handleGoLive = async () => {
    try {
      setIsStarting(true);
      await onStartStream(selectedPreset, {
        systemAudio: shareSystemAudio,
        sourceId: selectedSourceId || undefined,
      });
      onClose();
    } catch (err) {
      console.warn('Screen share failed:', err);
    } finally {
      setIsStarting(false);
    }
  };

  const currentConfig = SCREEN_SHARE_PRESETS[selectedPreset] || SCREEN_SHARE_PRESETS['1080p-60'];

  const appSources = sources.filter((s) => !s.isScreen);
  const screenSources = sources.filter((s) => s.isScreen);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm select-none p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#313338] border border-[#1e1f22] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-[#232428] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-discord-blurple/20 border border-discord-blurple/40 flex items-center justify-center text-discord-blurple-light">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Share Your Screen
                <span className="text-[10px] font-bold uppercase tracking-wider bg-discord-green/20 text-discord-green px-2 py-0.5 rounded-full border border-discord-green/30">
                  {isElectron ? 'Desktop Uncapped' : 'Ultra HD'}
                </span>
              </h2>
              <p className="text-xs text-discord-gray-300">
                {isElectron
                  ? 'Select a display or application window to stream.'
                  : 'Choose stream quality before broadcasting.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Professional Info Tooltip */}
            <div className="relative group">
              <div className="p-1.5 rounded-lg text-discord-gray-400 hover:text-white hover:bg-[#35373c] transition cursor-help flex items-center gap-1">
                <Info className="w-4 h-4" />
                <span className="text-[11px] font-medium hidden sm:inline">Tips</span>
              </div>
              <div className="absolute right-0 top-full mt-2 hidden group-hover:block w-72 p-3 rounded-xl bg-[#1e1f22] text-discord-gray-300 text-xs shadow-2xl border border-white/10 z-50 leading-relaxed pointer-events-none">
                <div className="font-bold text-white mb-1">Streaming Tips</div>
                <p className="text-[11px] text-discord-gray-300">
                  • Select the <strong>Screens</strong> tab to stream full displays without YouTube black screens.
                </p>
                <p className="text-[11px] text-discord-gray-300 mt-1">
                  • Full screen capture prevents stutter when Alt-Tabbing away from active games.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-discord-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-[#35373c] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-4 flex items-center justify-between border-b border-[#232428] pb-3 flex-shrink-0">
          <div className="flex gap-2">
            {isElectron && (
              <>
                <button
                  onClick={() => setActiveTab('screens')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'screens'
                      ? 'bg-discord-blurple text-white shadow-sm'
                      : 'bg-[#2b2d31] text-discord-gray-300 hover:text-white hover:bg-[#35373c]'
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  <span>Screens ({screenSources.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab('apps')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'apps'
                      ? 'bg-discord-blurple text-white shadow-sm'
                      : 'bg-[#2b2d31] text-discord-gray-300 hover:text-white hover:bg-[#35373c]'
                  }`}
                >
                  <AppWindow className="w-4 h-4" />
                  <span>Applications ({appSources.length})</span>
                </button>
              </>
            )}

            <button
              onClick={() => setActiveTab('quality')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'quality'
                  ? 'bg-discord-blurple text-white shadow-sm'
                  : 'bg-[#2b2d31] text-discord-gray-300 hover:text-white hover:bg-[#35373c]'
              }`}
            >
              <span>Stream Quality ({currentConfig.tag})</span>
            </button>
          </div>

          {isElectron && (
            <button
              onClick={loadSources}
              disabled={isLoadingSources}
              title="Refresh Sources"
              className="p-1.5 rounded-lg text-discord-gray-400 hover:text-white hover:bg-[#35373c] transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingSources ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* TAB 1: Screens (Electron Only) */}
          {activeTab === 'screens' && isElectron && (
            <div className="space-y-3">
              <div className="text-[11px] font-bold text-discord-gray-400 uppercase tracking-wider">
                Select a Display
              </div>

              {screenSources.length === 0 ? (
                <div className="p-8 text-center text-xs text-discord-gray-400 bg-[#2b2d31] rounded-xl">
                  No displays detected.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {screenSources.map((source) => {
                    const isSelected = selectedSourceId === source.id;
                    return (
                      <div
                        key={source.id}
                        onClick={() => setSelectedSourceId(source.id)}
                        className={`group relative rounded-xl overflow-hidden border cursor-pointer transition-all flex flex-col bg-[#2b2d31] ${
                          isSelected
                            ? 'border-discord-blurple ring-2 ring-discord-blurple shadow-lg'
                            : 'border-transparent hover:border-discord-gray-400/50 hover:bg-[#35373c]'
                        }`}
                      >
                        {/* Thumbnail Preview */}
                        <div className="aspect-video w-full bg-black/60 overflow-hidden flex items-center justify-center relative">
                          {source.thumbnail ? (
                            <img
                              src={source.thumbnail}
                              alt={source.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          ) : (
                            <Monitor className="w-10 h-10 text-discord-gray-500" />
                          )}
                          {isSelected && (
                            <div className="absolute inset-0 bg-discord-blurple/20 flex items-center justify-center">
                              <span className="w-3 h-3 rounded-full bg-discord-blurple ring-4 ring-white/20" />
                            </div>
                          )}
                        </div>

                        {/* Title Bar */}
                        <div className="p-3 flex items-center gap-2">
                          <Monitor className="w-4 h-4 text-discord-blurple flex-shrink-0" />
                          <span className="text-xs font-bold text-discord-gray-100 truncate">
                            {source.name}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Applications (Electron Only) */}
          {activeTab === 'apps' && isElectron && (
            <div className="space-y-3">
              <div className="text-[11px] font-bold text-discord-gray-400 uppercase tracking-wider">
                Select an Application Window
              </div>

              {appSources.length === 0 ? (
                <div className="p-8 text-center text-xs text-discord-gray-400 bg-[#2b2d31] rounded-xl">
                  No active application windows detected.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {appSources.map((source) => {
                    const isSelected = selectedSourceId === source.id;
                    return (
                      <div
                        key={source.id}
                        onClick={() => setSelectedSourceId(source.id)}
                        className={`group relative rounded-xl overflow-hidden border cursor-pointer transition-all flex flex-col bg-[#2b2d31] ${
                          isSelected
                            ? 'border-discord-blurple ring-2 ring-discord-blurple shadow-lg'
                            : 'border-transparent hover:border-discord-gray-400/50 hover:bg-[#35373c]'
                        }`}
                      >
                        {/* Thumbnail Preview */}
                        <div className="aspect-video w-full bg-black/60 overflow-hidden flex items-center justify-center relative">
                          {source.thumbnail ? (
                            <img
                              src={source.thumbnail}
                              alt={source.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          ) : (
                            <AppWindow className="w-8 h-8 text-discord-gray-500" />
                          )}
                          {isSelected && (
                            <div className="absolute inset-0 bg-discord-blurple/20 flex items-center justify-center">
                              <span className="w-3 h-3 rounded-full bg-discord-blurple ring-4 ring-white/20" />
                            </div>
                          )}
                        </div>

                        {/* Title Bar */}
                        <div className="p-2.5 flex items-center gap-2">
                          {source.appIcon ? (
                            <img src={source.appIcon} alt="" className="w-4 h-4 rounded" />
                          ) : (
                            <AppWindow className="w-4 h-4 text-discord-gray-400 flex-shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-discord-gray-200 truncate">
                            {source.name}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Professional Stream Quality */}
          {activeTab === 'quality' && (
            <div className="space-y-5 py-2">
              {/* Resolution Segmented Control */}
              <div>
                <label className="block text-[11px] font-bold text-discord-gray-400 uppercase tracking-wider mb-2">
                  Resolution
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: '720p', label: '720p', sub: 'HD' },
                    { id: '1080p', label: '1080p', sub: 'Full HD' },
                    { id: '1440p', label: '1440p', sub: '2K QHD' },
                    { id: 'source', label: 'Source', sub: 'Native' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        handleCustomSelect(
                          item.id as '720p' | '1080p' | '1440p' | 'source',
                          selectedFps
                        )
                      }
                      className={`py-2.5 px-3 rounded-lg border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                        selectedResolution === item.id
                          ? 'bg-discord-blurple border-discord-blurple text-white shadow-md'
                          : 'bg-[#2b2d31] border-[#383a40] hover:bg-[#35373c] text-discord-gray-300 hover:text-white'
                      }`}
                    >
                      <span className="font-bold text-xs">{item.label}</span>
                      <span className="text-[10px] opacity-75">{item.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Frame Rate Segmented Control */}
              <div>
                <label className="block text-[11px] font-bold text-discord-gray-400 uppercase tracking-wider mb-2">
                  Frame Rate
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { fps: 15, label: '15 FPS', sub: 'Text / Reading' },
                    { fps: 30, label: '30 FPS', sub: 'Standard' },
                    { fps: 60, label: '60 FPS', sub: 'Smooth Motion' },
                  ].map((item) => (
                    <button
                      key={item.fps}
                      type="button"
                      onClick={() =>
                        handleCustomSelect(selectedResolution, item.fps as 15 | 30 | 60)
                      }
                      className={`py-2.5 px-3 rounded-lg border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                        selectedFps === item.fps
                          ? 'bg-discord-blurple border-discord-blurple text-white shadow-md'
                          : 'bg-[#2b2d31] border-[#383a40] hover:bg-[#35373c] text-discord-gray-300 hover:text-white'
                      }`}
                    >
                      <span className="font-bold text-xs">{item.label}</span>
                      <span className="text-[10px] opacity-75">{item.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Current Configuration Summary */}
              <div className="p-3 bg-[#232428] rounded-xl border border-white/5 flex items-center justify-between text-xs text-discord-gray-300">
                <span>Output Stream Target:</span>
                <span className="font-mono font-bold text-discord-blurple-light">
                  {currentConfig.tag} • {Math.round(currentConfig.maxBitrate / 1_000_000)} Mbps
                </span>
              </div>
            </div>
          )}

          {/* Audio Sharing Toggle */}
          <div className="pt-2 border-t border-[#2b2d31]">
            <label className="flex items-center justify-between p-3 rounded-xl bg-[#2b2d31] hover:bg-[#35373c] cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-discord-green" />
                <div>
                  <div className="text-xs font-bold text-white">Share System / Game Audio</div>
                  <div className="text-[11px] text-discord-gray-300">
                    Stream game audio, music, and application sounds in high-fidelity stereo.
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={shareSystemAudio}
                onChange={(e) => setShareSystemAudio(e.target.checked)}
                className="w-4 h-4 accent-discord-blurple cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#2b2d31] border-t border-[#1e1f22] flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-discord-gray-400">
            Selected: <strong className="text-white">{currentConfig.tag}</strong>
            {selectedSourceId && isElectron && (
              <span className="ml-2 text-discord-gray-400">
                • Source: <strong className="text-discord-green truncate max-w-[120px] inline-block align-bottom">{sources.find(s => s.id === selectedSourceId)?.name || 'Window'}</strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isStarting}
              className="px-4 py-2 text-xs font-semibold text-discord-gray-300 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGoLive}
              disabled={isStarting}
              className="px-6 py-2 rounded-lg bg-discord-blurple hover:bg-discord-blurple-hover disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-discord-blurple/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <ScreenShare className="w-4 h-4" />
                  <span>Go Live</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
