import React, { useState, useEffect } from 'react';
import {
  X,
  ScreenShare,
  Tv,
  Gamepad2,
  FileCode,
  Zap,
  Volume2,
  ShieldCheck,
  Sparkles,
  Monitor,
  AppWindow,
  RefreshCw,
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

  // Tabs: 'sources' (Applications & Screens) | 'quality' (Resolution & FPS)
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

  const handleSelectPreset = (key: ScreenSharePreset) => {
    setSelectedPreset(key);
    if (key.includes('720p')) setSelectedResolution('720p');
    else if (key.includes('1440p') || key.includes('2k')) setSelectedResolution('1440p');
    else if (key.includes('source')) setSelectedResolution('source');
    else setSelectedResolution('1080p');

    if (key.includes('60')) setSelectedFps(60);
    else if (key.includes('15')) setSelectedFps(15);
    else setSelectedFps(30);
  };

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

  const handleGoLive = () => {
    onStartStream(selectedPreset, {
      systemAudio: shareSystemAudio,
      sourceId: selectedSourceId || undefined,
    });
    onClose();
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
                  ? 'Select an application window or screen to stream with native GPU acceleration.'
                  : 'Choose stream quality and resolution before going live.'}
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

        {/* Tab Navigation */}
        <div className="px-6 pt-4 flex items-center justify-between border-b border-[#232428] pb-3 flex-shrink-0">
          <div className="flex gap-2">
            {isElectron && (
              <>
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
              <Zap className="w-4 h-4" />
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
          {/* Alt-Tab & Co-op Pro Tip */}
          {isElectron && (
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-2.5 text-xs text-indigo-200">
              <span className="text-base leading-none mt-0.5">🎮</span>
              <div>
                <p>
                  <strong>Pro Tip for Gaming & Alt-Tabbing:</strong> Select <strong>&quot;Screens&quot; (Entire Screen)</strong> so your game never freezes or stutters when you Alt-Tab away!
                </p>
                <p className="text-[11px] text-indigo-300/80 mt-1">
                  Once live, friends in this voice channel can play along with you using Virtual Xbox Controllers or Keyboard via <strong>Co-op Remote Play</strong>!
                </p>
              </div>
            </div>
          )}

          {/* TAB 1: Applications (Electron Only) */}
          {activeTab === 'apps' && isElectron && (
            <div className="space-y-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
                <span className="text-sm mt-0.5">⚠️</span>
                <div>
                  <strong>Black screen on YouTube or games?</strong> Browsers and protected apps use GPU overlays that show as black boxes when sharing a window. Switch to the <strong>&quot;Screens&quot;</strong> tab to share your entire display cleanly, or disable hardware acceleration in Chrome/Edge settings.
                </div>
              </div>

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
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <AppWindow className="w-8 h-8 text-discord-gray-500" />
                          )}
                          {source.appIcon && (
                            <img
                              src={source.appIcon}
                              alt="icon"
                              className="w-5 h-5 absolute bottom-2 left-2 rounded shadow"
                            />
                          )}
                        </div>

                        {/* Title */}
                        <div className="p-2.5 text-left">
                          <div className="text-xs font-semibold text-white truncate group-hover:text-discord-blurple-light transition-colors">
                            {source.name}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Screens (Electron Only) */}
          {activeTab === 'screens' && isElectron && (
            <div className="space-y-3">
              <div className="text-[11px] font-bold text-discord-gray-400 uppercase tracking-wider">
                Select Entire Screen
              </div>

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
                      {/* Desktop Thumbnail Preview */}
                      <div className="aspect-video w-full bg-black/60 overflow-hidden flex items-center justify-center">
                        {source.thumbnail ? (
                          <img
                            src={source.thumbnail}
                            alt={source.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Monitor className="w-10 h-10 text-discord-gray-500" />
                        )}
                      </div>

                      {/* Title */}
                      <div className="p-3 text-left">
                        <div className="text-xs font-semibold text-white truncate">
                          {source.name}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Quality Profiles & Custom Settings */}
          {activeTab === 'quality' && (
            <div className="space-y-4">
              <div className="text-[11px] font-bold text-discord-gray-400 uppercase tracking-wider">
                Stream Quality Profiles
              </div>

              {/* Profiles Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. Gaming Pro */}
                <div
                  onClick={() => handleSelectPreset('1080p-60')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                    selectedPreset === '1080p-60'
                      ? 'bg-discord-blurple/15 border-discord-blurple text-white shadow-md'
                      : 'bg-[#2b2d31] border-transparent hover:bg-[#35373c] text-discord-gray-300'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-discord-blurple/20 text-discord-blurple-light mt-0.5">
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-white">Gaming Pro</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-discord-blurple text-white shadow">
                        1080p 60FPS
                      </span>
                    </div>
                    <p className="text-[11px] text-discord-gray-300 leading-snug">
                      Ultra-smooth 60 FPS motion. Zero tearing for fast games.
                    </p>
                  </div>
                </div>

                {/* 2. Crisp Code */}
                <div
                  onClick={() => handleSelectPreset('1440p-30')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                    selectedPreset === '1440p-30'
                      ? 'bg-discord-blurple/15 border-discord-blurple text-white shadow-md'
                      : 'bg-[#2b2d31] border-transparent hover:bg-[#35373c] text-discord-gray-300'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 mt-0.5">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-white">Crisp Code & Text</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/30 text-amber-300 border border-amber-500/40">
                        2K QHD
                      </span>
                    </div>
                    <p className="text-[11px] text-discord-gray-300 leading-snug">
                      High sub-pixel font sharpness. Crystal clear for code & docs.
                    </p>
                  </div>
                </div>

                {/* 3. Ultra 2K 60FPS */}
                <div
                  onClick={() => handleSelectPreset('1440p-60')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                    selectedPreset === '1440p-60'
                      ? 'bg-discord-blurple/15 border-discord-blurple text-white shadow-md'
                      : 'bg-[#2b2d31] border-transparent hover:bg-[#35373c] text-discord-gray-300'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 mt-0.5">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-white">Ultra 2K Pro</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/30 text-purple-300 border border-purple-500/40">
                        1440p 60FPS
                      </span>
                    </div>
                    <p className="text-[11px] text-discord-gray-300 leading-snug">
                      Supreme 2K clarity at 60 FPS. 18 Mbps high-bitrate stream.
                    </p>
                  </div>
                </div>

                {/* 4. Full HD Standard */}
                <div
                  onClick={() => handleSelectPreset('1080p-30')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                    selectedPreset === '1080p-30'
                      ? 'bg-discord-blurple/15 border-discord-blurple text-white shadow-md'
                      : 'bg-[#2b2d31] border-transparent hover:bg-[#35373c] text-discord-gray-300'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 mt-0.5">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-white">Full HD Balanced</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                        1080p 30FPS
                      </span>
                    </div>
                    <p className="text-[11px] text-discord-gray-300 leading-snug">
                      Balanced stream for YouTube videos and browsing.
                    </p>
                  </div>
                </div>
              </div>

              {/* Resolution & FPS Pills */}
              <div className="pt-2 border-t border-[#2b2d31] space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-discord-gray-400 uppercase tracking-wider mb-2">
                    Custom Resolution
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: '720p', label: '720p', sub: 'HD' },
                      { id: '1080p', label: '1080p', sub: 'Full HD' },
                      { id: '1440p', label: '1440p', sub: '2K QHD' },
                      { id: 'source', label: 'Source', sub: '4K Native' },
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
                        className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                          selectedResolution === item.id
                            ? 'bg-discord-blurple border-discord-blurple text-white shadow'
                            : 'bg-[#2b2d31] border-transparent hover:bg-[#35373c] text-discord-gray-300'
                        }`}
                      >
                        <div className="font-bold text-xs">{item.label}</div>
                        <div className="text-[10px] opacity-75">{item.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-discord-gray-400 uppercase tracking-wider mb-2">
                    Custom Frame Rate
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { fps: 15, label: '15 FPS', sub: 'Slides / Reading' },
                      { fps: 30, label: '30 FPS', sub: 'Standard Video' },
                      { fps: 60, label: '60 FPS', sub: 'Smooth Gaming' },
                    ].map((item) => (
                      <button
                        key={item.fps}
                        type="button"
                        onClick={() =>
                          handleCustomSelect(selectedResolution, item.fps as 15 | 30 | 60)
                        }
                        className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                          selectedFps === item.fps
                            ? 'bg-discord-blurple border-discord-blurple text-white shadow'
                            : 'bg-[#2b2d31] border-transparent hover:bg-[#35373c] text-discord-gray-300'
                        }`}
                      >
                        <div className="font-bold text-xs">{item.label}</div>
                        <div className="text-[10px] opacity-75">{item.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
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

          {/* Direct P2P Info Banner */}
          <div className="p-3 bg-discord-blurple/10 border border-discord-blurple/25 rounded-xl flex items-center gap-2.5 text-xs text-discord-blurple-light">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span>
              Direct P2P WebRTC: <strong>{currentConfig.name}</strong> at{' '}
              {Math.round(currentConfig.maxBitrate / 1_000_000)} Mbps. No server bandwidth limits!
            </span>
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
              className="px-4 py-2 text-xs font-semibold text-discord-gray-300 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGoLive}
              className="px-6 py-2 rounded-lg bg-discord-blurple hover:bg-discord-blurple-hover text-white text-xs font-bold shadow-lg shadow-discord-blurple/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <ScreenShare className="w-4 h-4" />
              <span>Go Live</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
