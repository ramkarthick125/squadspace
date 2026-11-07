import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ScreenShare,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Tv,
  PictureInPicture,
  Sparkles,
  Gamepad2,
  Keyboard,
  Loader2,
  Users,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { useCoopStore } from '../../store/useCoopStore';
import { coopClient } from '../../lib/coopClient';
import { CoopHostPanel } from './CoopHostPanel';
import { CoopJoinModal } from './CoopJoinModal';
import { GamepadVisualizer } from './GamepadVisualizer';

interface ScreenShareVideoProps {
  stream: MediaStream | null;
  sharerName: string;
  sharerUserId?: string;
  currentUser?: UserProfile | null;
  isLocal?: boolean;
  presetTag?: string;
  onToggleTheater?: () => void;
  isTheater?: boolean;
  onOpenJoinModal?: () => void;
}

export const ScreenShareVideo: React.FC<ScreenShareVideoProps> = ({
  stream,
  sharerName,
  sharerUserId,
  currentUser,
  isLocal = false,
  presetTag = '1080p 60FPS',
  onToggleTheater,
  isTheater = false,
  onOpenJoinModal,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolume] = useState<number>(100);
  const [isMuted, setIsMuted] = useState<boolean>(isLocal);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [controlsTimeout, setControlsTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  const {
    isCoopHost,
    isCoopActive,
    players,
    pendingRequests,
    mySlot,
    myInputMode,
    isRequested,
    isPanelOpen,
    startHostCoop,
    setPanelOpen,
    cancelJoinRequest,
    init,
  } = useCoopStore();

  // Initialize Co-op listeners and driver detection
  useEffect(() => {
    init();
  }, [init]);

  // Attach stream to video element with ultra-low latency settings
  useEffect(() => {
    if (videoRef.current && stream) {
      const v = videoRef.current;
      v.srcObject = stream;
      v.playbackRate = 1.0;
      v.play().catch(() => {});
    }
  }, [stream]);

  // Sync volume with video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume / 100;
      videoRef.current.muted = isLocal ? true : isMuted;
    }
  }, [volume, isMuted, isLocal]);

  // Keyboard & Mouse capture for remote player in keyboard mode
  useEffect(() => {
    if (mySlot && myInputMode === 'keyboard_mouse' && containerRef.current && !isLocal) {
      coopClient.attachKeyboardMouse(containerRef.current);
      return () => {
        coopClient.detachKeyboardMouse();
      };
    }
  }, [mySlot, myInputMode, isLocal]);

  // Fullscreen change listener on document
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Controls auto-hide on inactivity (never hide if panel is open)
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout) clearTimeout(controlsTimeout);
    const timeout = setTimeout(() => {
      if (!isPanelOpen && !isJoinModalOpen) {
        setShowControls(false);
      }
    }, 4000);
    setControlsTimeout(timeout);
  }, [controlsTimeout, isPanelOpen, isJoinModalOpen]);

  // Toggle Fullscreen on Container
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Picture in Picture
  const handleTogglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP not available:', err);
    }
  };

  if (!stream) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black/90 rounded-2xl p-6 border border-discord-darkest select-none">
        <div className="w-16 h-16 rounded-2xl bg-discord-sidebar flex items-center justify-center mb-3">
          <ScreenShare className="w-8 h-8 text-discord-blurple animate-pulse" />
        </div>
        <span className="text-base font-bold text-white">{sharerName}'s Stream</span>
        <span className="text-xs text-discord-gray-400 mt-1">
          Waiting for video transmission...
        </span>
      </div>
    );
  }

  const myPlayer = players.find((p) => p.slot === mySlot);
  const isPlaying = mySlot !== null;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (!isPanelOpen && !isJoinModalOpen) {
          setShowControls(false);
        }
      }}
      tabIndex={0}
      className="relative w-full h-full bg-[#0e1013] rounded-2xl overflow-hidden group select-none flex items-center justify-center border border-[#1e1f22] shadow-2xl focus:outline-none"
    >
      {/* Video Element without native controls */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal ? true : isMuted}
        controls={false}
        disablePictureInPicture={false}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full object-contain pointer-events-none select-none bg-black"
      />

      {/* Top Header Overlay Bar */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between pointer-events-auto transition-opacity duration-300 z-30 ${
          showControls || isPanelOpen ? 'opacity-100' : 'opacity-90'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {/* Red LIVE Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#ed4245] text-white font-extrabold text-[11px] uppercase tracking-wider shadow-lg">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span>LIVE</span>
          </div>

          {/* Quality Tag */}
          <div className="px-2 py-0.5 rounded-md bg-black/60 border border-white/10 text-white font-bold text-[11px] backdrop-blur-md">
            {presetTag}
          </div>

          {/* Sharer Name */}
          <div className="text-xs font-bold text-discord-gray-100 hidden sm:flex items-center gap-1.5 drop-shadow">
            <span>{sharerName}&apos;s Screen</span>
            {isLocal && (
              <span className="text-[10px] text-discord-gray-400 font-normal">(You)</span>
            )}
          </div>
        </div>

        {/* Co-op Remote Play Center Action */}
        <div className="flex items-center gap-2">
          {isLocal ? (
            /* Host Controls */
            <button
              type="button"
              onClick={() => {
                if (!isCoopHost && currentUser) {
                  startHostCoop(currentUser.id);
                } else {
                  setPanelOpen(!isPanelOpen);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs shadow-lg transition cursor-pointer border ${
                isCoopHost
                  ? 'bg-indigo-600 border-indigo-400 text-white shadow-indigo-600/40'
                  : 'bg-indigo-600/30 hover:bg-indigo-600 border-indigo-500/40 text-indigo-200 hover:text-white'
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
              <span>
                {isCoopHost
                  ? `Co-op Active (${players.length} Players)`
                  : '🎮 Enable Co-op Play'}
              </span>
              {pendingRequests.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-400 text-black text-[10px] font-bold flex items-center justify-center animate-bounce">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          ) : (
            /* Viewer Controls */
            <div className="flex items-center gap-2">
              {isPlaying ? (
                <div className="flex items-center gap-2 bg-black/80 backdrop-blur-md border border-emerald-500/40 px-3 py-1 rounded-xl">
                  {myInputMode === 'gamepad' ? (
                    <GamepadVisualizer slot={mySlot!} isPaused={myPlayer?.isPaused} />
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                      <Keyboard className="w-4 h-4" />
                      <span>Keyboard Active (P{mySlot})</span>
                    </div>
                  )}
                  <button
                    onClick={() => (onOpenJoinModal ? onOpenJoinModal() : setIsJoinModalOpen(true))}
                    className="text-[11px] font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 rounded transition"
                  >
                    Manage
                  </button>
                </div>
              ) : isRequested ? (
                <button
                  type="button"
                  onClick={cancelJoinRequest}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-pointer animate-pulse"
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Request Sent (Cancel)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => (onOpenJoinModal ? onOpenJoinModal() : setIsJoinModalOpen(true))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition cursor-pointer border border-indigo-400/30"
                >
                  <Gamepad2 className="w-4 h-4" />
                  <span>🎮 Join Game (Co-op)</span>
                </button>
              )}
            </div>
          )}

          {/* P2P WebRTC Direct Tag */}
          <div className="text-[10px] font-semibold text-discord-green bg-discord-green/15 border border-discord-green/30 px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-md hidden sm:flex">
            <Sparkles className="w-3 h-3" />
            <span>Direct P2P</span>
          </div>
        </div>
      </div>

      {/* Bottom Floating Control Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/85 via-black/50 to-transparent flex items-center justify-between pointer-events-auto transition-opacity duration-300 z-20 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Left Controls: Audio / Volume (For Remote Viewers) */}
        <div className="flex items-center gap-3">
          {!isLocal && (
            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-white">
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                title={isMuted ? 'Unmute Stream' : 'Mute Stream'}
                className="hover:text-discord-green transition-colors cursor-pointer"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-discord-red" />
                ) : (
                  <Volume2 className="w-4 h-4 text-discord-green" />
                )}
              </button>

              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(Number(e.target.value));
                  if (isMuted) setIsMuted(false);
                }}
                className="w-20 h-1.5 accent-discord-blurple bg-white/20 rounded-lg cursor-pointer"
              />

              <span className="text-[10px] text-discord-gray-300 font-mono w-7 text-right">
                {isMuted ? '0%' : `${volume}%`}
              </span>
            </div>
          )}

          {isLocal && (
            <span className="text-[11px] text-discord-gray-300 bg-black/60 px-2.5 py-1 rounded-lg backdrop-blur-md border border-white/10">
              Broadcasting your screen
            </span>
          )}

          {/* Keyboard & Mouse Guide Hint for Player */}
          {isPlaying && myInputMode === 'keyboard_mouse' && !isLocal && (
            <span className="text-[11px] text-emerald-300 bg-emerald-950/80 border border-emerald-500/30 px-2.5 py-1 rounded-lg backdrop-blur-md animate-pulse">
              Click screen to send keyboard & mouse to game
            </span>
          )}
        </div>

        {/* Right Controls: Theater, PiP, Fullscreen */}
        <div className="flex items-center gap-2">
          {/* Theater / Focus Mode */}
          {onToggleTheater && (
            <button
              type="button"
              onClick={onToggleTheater}
              title={isTheater ? 'Exit Focus Mode' : 'Focus Mode (Theater)'}
              className={`p-2 rounded-xl backdrop-blur-md border transition-all cursor-pointer ${
                isTheater
                  ? 'bg-discord-blurple border-discord-blurple text-white shadow'
                  : 'bg-black/60 border-white/10 text-discord-gray-200 hover:text-white hover:bg-black/80'
              }`}
            >
              <Tv className="w-4 h-4" />
            </button>
          )}

          {/* Picture in Picture */}
          <button
            type="button"
            onClick={handleTogglePiP}
            title="Pop out video (Picture-in-Picture)"
            className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-discord-gray-200 hover:text-white backdrop-blur-md border border-white/10 transition-colors cursor-pointer"
          >
            <PictureInPicture className="w-4 h-4" />
          </button>

          {/* Fullscreen (On Container to avoid browser timeline scrub bar) */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-discord-gray-200 hover:text-white backdrop-blur-md border border-white/10 transition-colors cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
