import React, { useState } from 'react';
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
} from 'lucide-react';
import { ScreenSharePreset, SCREEN_SHARE_PRESETS } from '../../lib/livekit';

interface ScreenShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartStream: (presetKey: ScreenSharePreset, options: { systemAudio: boolean }) => void;
  defaultPreset?: ScreenSharePreset;
}

export const ScreenShareModal: React.FC<ScreenShareModalProps> = ({
  isOpen,
  onClose,
  onStartStream,
  defaultPreset = '1080p-60',
}) => {
  const [selectedPreset, setSelectedPreset] = useState<ScreenSharePreset>(defaultPreset);
  const [selectedResolution, setSelectedResolution] = useState<'720p' | '1080p' | '1440p' | 'source'>('1080p');
  const [selectedFps, setSelectedFps] = useState<15 | 30 | 60>(60);
  const [shareSystemAudio, setShareSystemAudio] = useState(true);
  const [mode, setMode] = useState<'presets' | 'custom'>('presets');

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
    onStartStream(selectedPreset, { systemAudio: shareSystemAudio });
    onClose();
  };

  const currentConfig = SCREEN_SHARE_PRESETS[selectedPreset] || SCREEN_SHARE_PRESETS['1080p-60'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm select-none p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#313338] border border-[#1e1f22] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-[#232428] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-discord-blurple/20 border border-discord-blurple/40 flex items-center justify-center text-discord-blurple-light">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Screen Share Quality
                <span className="text-[10px] font-bold uppercase tracking-wider bg-discord-green/20 text-discord-green px-2 py-0.5 rounded-full border border-discord-green/30">
                  Ultra HD
                </span>
              </h2>
              <p className="text-xs text-discord-gray-300">
                Choose your resolution and framerate before going live.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-discord-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-[#35373c] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-6 pt-4 flex gap-2">
          <button
            onClick={() => setMode('presets')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'presets'
                ? 'bg-discord-blurple text-white shadow-sm'
                : 'bg-[#2b2d31] text-discord-gray-300 hover:text-white hover:bg-[#35373c]'
            }`}
          >
            Stream Profiles
          </button>
          <button
            onClick={() => setMode('custom')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'custom'
                ? 'bg-discord-blurple text-white shadow-sm'
                : 'bg-[#2b2d31] text-discord-gray-300 hover:text-white hover:bg-[#35373c]'
            }`}
          >
            Custom Resolution & FPS
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {mode === 'presets' ? (
            /* Presets Grid */
            <div className="space-y-2.5">
              <div className="text-[11px] font-bold text-discord-gray-400 uppercase tracking-wider">
                Select Stream Profile
              </div>

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
                    <span className="font-bold text-sm text-white">Gaming & Esports Pro</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-discord-blurple text-white shadow">
                      1080p @ 60 FPS
                    </span>
                  </div>
                  <p className="text-xs text-discord-gray-300 leading-relaxed">
                    Ultra-smooth 60 FPS with hardware motion optimization. Zero screen tear or lag for games.
                  </p>
                </div>
              </div>

              {/* 2. Crisp Code & Text */}
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
                    <span className="font-bold text-sm text-white">Crisp Code & Sharp Text</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/30 text-amber-300 border border-amber-500/40">
                      2K QHD (1440p)
                    </span>
                  </div>
                  <p className="text-xs text-discord-gray-300 leading-relaxed">
                    Prioritizes sub-pixel font clarity. Crystal clear for VS Code, terminal, and documentation.
                  </p>
                </div>
              </div>

              {/* 3. Ultra 2K 60FPS Pro */}
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
                    <span className="font-bold text-sm text-white">Ultra 2K Pro (Max Quality)</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/30 text-purple-300 border border-purple-500/40">
                      1440p @ 60 FPS
                    </span>
                  </div>
                  <p className="text-xs text-discord-gray-300 leading-relaxed">
                    Top-tier 1440p resolution at 60 FPS. 18 Mbps high-bitrate direct peer-to-peer stream.
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
                    <span className="font-bold text-sm text-white">Full HD Balanced</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                      1080p @ 30 FPS
                    </span>
                  </div>
                  <p className="text-xs text-discord-gray-300 leading-relaxed">
                    Balanced stream for YouTube videos and browsing. Reliable on standard connections.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Custom Controls */
            <div className="space-y-4">
              {/* Resolution Selection */}
              <div>
                <label className="block text-[11px] font-bold text-discord-gray-400 uppercase tracking-wider mb-2">
                  Resolution
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
                      className={`p-2.5 rounded-xl border text-center transition-all ${
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

              {/* Frame Rate Selection */}
              <div>
                <label className="block text-[11px] font-bold text-discord-gray-400 uppercase tracking-wider mb-2">
                  Frame Rate
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { fps: 15, label: '15 FPS', sub: 'Documents / Slides' },
                    { fps: 30, label: '30 FPS', sub: 'Standard Video' },
                    { fps: 60, label: '60 FPS', sub: 'Smooth Gaming' },
                  ].map((item) => (
                    <button
                      key={item.fps}
                      type="button"
                      onClick={() =>
                        handleCustomSelect(selectedResolution, item.fps as 15 | 30 | 60)
                      }
                      className={`p-2.5 rounded-xl border text-center transition-all ${
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
          )}

          {/* Audio Sharing Toggle */}
          <div className="pt-2 border-t border-[#2b2d31]">
            <label className="flex items-center justify-between p-3 rounded-xl bg-[#2b2d31] hover:bg-[#35373c] cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-discord-green" />
                <div>
                  <div className="text-xs font-bold text-white">Share System Audio</div>
                  <div className="text-[11px] text-discord-gray-300">
                    Stream game sounds, music, and browser audio directly to voice chat.
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
        <div className="p-4 bg-[#2b2d31] border-t border-[#1e1f22] flex items-center justify-between">
          <div className="text-xs text-discord-gray-400">
            Selected: <strong className="text-white">{currentConfig.tag}</strong>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-discord-gray-300 hover:text-white transition-colors"
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
