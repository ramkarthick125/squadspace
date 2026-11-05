import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  ScreenShare,
  PhoneOff,
  MessageSquare,
  Users,
  Settings,
  Sparkles,
  Maximize2,
  Minimize2,
  Sliders,
} from 'lucide-react';
import { Channel, UserProfile } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { useVoiceStore } from '../../store/useVoiceStore';
import { SCREEN_SHARE_PRESETS, ScreenSharePreset } from '../../lib/livekit';
import { ScreenShareVideo } from './ScreenShareVideo';
import { ChatArea } from '../chat/ChatArea';

interface VoiceRoomProps {
  channel: Channel;
  onOpenEmojiPicker: () => void;
  onOpenGifPicker: () => void;
  onOpenEmojiPickerForMessage?: (messageId: string) => void;
}

export const VoiceRoom: React.FC<VoiceRoomProps> = ({
  channel,
  onOpenEmojiPicker,
  onOpenGifPicker,
  onOpenEmojiPickerForMessage,
}) => {
  const { currentUser } = useAuthStore();
  const {
    activeVoiceChannelId,
    participantsByChannel,
    isMuted,
    isDeafened,
    isScreenSharing,
    screenShareStream,
    micVolumeLevel,
    engineMode,
    setEngineMode,
    streamQuality,
    setStreamQuality,
    toggleMute,
    toggleDeafen,
    toggleScreenShare,
    leaveVoiceChannel,
    joinVoiceChannel,
  } = useVoiceStore();

  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<ScreenSharePreset>(streamQuality);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const isConnected = activeVoiceChannelId === channel.id;
  const participants = participantsByChannel[channel.id] || [];

  return (
    <div className="flex-1 flex bg-[#111214] min-w-0 h-full overflow-hidden select-none">
      {/* Center Stage: Video / Voice Grid */}
      <div className="flex-1 flex flex-col min-w-0 h-full justify-between">
        {/* Voice Room Header */}
        <div className="h-12 bg-discord-chat/60 border-b border-discord-darkest/70 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="font-bold text-discord-gray-100 text-base">{channel.name}</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-discord-green/20 text-discord-green font-medium">
              {participants.length} connected
            </span>

            {/* Hybrid Engine Mode Selector Pill */}
            <div className="hidden sm:flex items-center bg-discord-sidebar rounded-full p-0.5 border border-discord-darkest text-[11px]">
              <button
                onClick={() => setEngineMode('p2p')}
                title="P2P Direct Mesh: Unlimited free minutes & zero server bandwidth"
                className={`px-2.5 py-0.5 rounded-full font-semibold transition-colors ${
                  engineMode === 'p2p'
                    ? 'bg-discord-green text-white shadow'
                    : 'text-discord-gray-400 hover:text-white'
                }`}
              >
                P2P (Unlimited)
              </button>
              <button
                onClick={() => setEngineMode('livekit')}
                title="LiveKit Cloud SFU: Central cloud server"
                className={`px-2.5 py-0.5 rounded-full font-semibold transition-colors ${
                  engineMode === 'livekit'
                    ? 'bg-discord-blurple text-white shadow'
                    : 'text-discord-gray-400 hover:text-white'
                }`}
              >
                LiveKit Cloud
              </button>
            </div>
          </div>

          {/* Toggle Voice Channel Chat Drawer (Just like Discord!) */}
          <button
            onClick={() => setShowVoiceChat(!showVoiceChat)}
            title={showVoiceChat ? 'Hide Voice Channel Chat' : 'Open Voice Channel Chat'}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-colors ${
              showVoiceChat
                ? 'bg-discord-active text-white'
                : 'bg-discord-sidebar text-discord-gray-300 hover:bg-discord-hover hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Voice Chat</span>
          </button>
        </div>

        {/* Viewing Voice Channel Banner */}
        {!isConnected && (
          <div className="bg-discord-green/15 border-b border-discord-green/30 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 text-xs text-discord-gray-200">
              <span className="w-2 h-2 rounded-full bg-discord-green animate-pulse" />
              <span>You are viewing <strong>#{channel.name}</strong>. Connect your audio to speak and listen!</span>
            </div>
            <button
              onClick={() => currentUser && joinVoiceChannel(channel.id, currentUser)}
              className="px-4 py-1.5 rounded-lg bg-discord-green hover:bg-discord-green-hover text-white text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>Join Voice Channel</span>
            </button>
          </div>
        )}

        {/* Participants Stage */}
        <div className="flex-1 p-6 overflow-y-auto flex items-center justify-center">
          {participants.length === 0 ? (
            <div className="text-center space-y-4 max-w-sm">
              <div className="w-20 h-20 mx-auto rounded-full bg-discord-sidebar flex items-center justify-center">
                <Users className="w-10 h-10 text-discord-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-discord-gray-100">No one is here yet</h3>
              <p className="text-xs text-discord-gray-400">
                Join the voice channel to start talking with high quality audio and screen sharing.
              </p>
              {!isConnected && (
                <button
                  onClick={() => joinVoiceChannel(channel.id, currentUser)}
                  className="px-5 py-2 rounded-md bg-discord-green hover:bg-discord-green-hover text-white text-sm font-semibold transition-colors"
                >
                  Connect Voice
                </button>
              )}
            </div>
          ) : (
            <div
              className={`w-full h-full max-w-5xl grid gap-4 items-center justify-center ${
                participants.length === 1
                  ? 'grid-cols-1 max-w-md'
                  : participants.length === 2
                  ? 'grid-cols-2'
                  : 'grid-cols-2 md:grid-cols-3'
              }`}
            >
              {participants.map((p) => {
                const isMe = p.userId === currentUser.id;

                return (
                  <div
                    key={p.userId}
                    className="relative bg-discord-sidebar rounded-xl border border-discord-darkest/80 flex flex-col items-center justify-center p-6 aspect-video shadow-lg group"
                  >
                    {/* Real Screen Sharing Live Stream or Avatar */}
                    {p.isScreenSharing ? (
                      <ScreenShareVideo
                        stream={screenShareStream}
                        sharerName={p.user.displayName}
                      />
                    ) : (
                      /* Avatar with speaking halo */
                      <div className="relative">
                        <img
                          src={p.user.avatarUrl}
                          alt={p.user.displayName}
                          className={`w-24 h-24 rounded-full object-cover transition-all ${
                            p.isSpeaking ? 'speaking-indicator' : ''
                          }`}
                        />
                      </div>
                    )}

                    {/* Participant Name Badge */}
                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded text-xs font-semibold text-white flex items-center gap-2">
                      <span>{p.user.displayName} {isMe && '(You)'}</span>
                      {p.isMuted && <MicOff className="w-3.5 h-3.5 text-discord-red" />}
                    </div>

                    {/* Active Activity if playing a game */}
                    {p.user.gamingActivity && (
                      <div className="absolute top-3 right-3 bg-black/60 px-2 py-0.5 rounded text-[10px] text-discord-gray-300">
                        🎮 {p.user.gamingActivity.game}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Voice Controls Bar */}
        <div className="h-20 bg-discord-darkest/90 border-t border-discord-darkest/60 px-6 flex items-center justify-center gap-4">
          {isConnected ? (
            <>
              {/* Live Mic Level Visualizer */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-discord-sidebar/80 rounded-full border border-discord-darkest text-xs mr-2">
                <span className="text-[11px] font-semibold text-discord-gray-300">Input</span>
                <div className="w-20 h-2 bg-discord-darkest rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-75 ${
                      isMuted ? 'bg-discord-red' : 'bg-discord-green'
                    }`}
                    style={{ width: `${isMuted ? 0 : micVolumeLevel}%` }}
                  />
                </div>
              </div>

              {/* Mic Toggle */}
              <button
                onClick={toggleMute}
                title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  isMuted
                    ? 'bg-discord-red text-white hover:bg-discord-red-hover'
                    : 'bg-discord-sidebar text-discord-gray-200 hover:bg-discord-hover hover:text-white'
                }`}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Deafen Toggle */}
              <button
                onClick={toggleDeafen}
                title={isDeafened ? 'Undeafen' : 'Deafen'}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  isDeafened
                    ? 'bg-discord-red text-white hover:bg-discord-red-hover'
                    : 'bg-discord-sidebar text-discord-gray-200 hover:bg-discord-hover hover:text-white'
                }`}
              >
                <Headphones className="w-5 h-5" />
              </button>

              {/* Screen Share Toggle & Preset Quality Settings */}
              <div className="relative flex items-center">
                <button
                  onClick={() => toggleScreenShare(currentUser, selectedQuality)}
                  title={isScreenSharing ? 'Stop Screen Share' : `Share Screen (${selectedQuality})`}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    isScreenSharing
                      ? 'bg-discord-green text-white hover:bg-discord-green-hover'
                      : 'bg-discord-sidebar text-discord-gray-200 hover:bg-discord-hover hover:text-white'
                  }`}
                >
                  <ScreenShare className="w-5 h-5" />
                </button>

                <button
                  onClick={() => setShowQualityMenu(!showQualityMenu)}
                  title="Stream Quality Settings (720p, 1080p, 2K)"
                  className="ml-1 p-1.5 rounded-full hover:bg-discord-hover text-discord-gray-400 hover:text-discord-gray-100"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>

                {/* Quality Preset Menu (Including 2K) */}
                {showQualityMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowQualityMenu(false)} />
                    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-80 bg-[#111214] border border-[#2b2d31] rounded-xl shadow-2xl p-3 z-40 text-xs select-none">
                      <div className="font-bold text-discord-gray-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>Stream Resolution</span>
                        <span className="text-[10px] text-discord-green font-mono">P2P 0 Server Cost</span>
                      </div>

                      <div className="space-y-1.5 max-h-72 overflow-y-auto">
                        {(Object.keys(SCREEN_SHARE_PRESETS) as ScreenSharePreset[]).map((key) => {
                          const preset = SCREEN_SHARE_PRESETS[key];
                          const isSelected = selectedQuality === key;
                          return (
                            <div
                              key={key}
                              onClick={() => {
                                setSelectedQuality(key);
                                setStreamQuality(key);
                                setShowQualityMenu(false);
                              }}
                              className={`p-2.5 rounded-lg cursor-pointer transition-colors border ${
                                isSelected
                                  ? 'bg-discord-blurple/20 border-discord-blurple text-white'
                                  : 'bg-discord-sidebar/60 border-transparent hover:bg-discord-sidebar text-discord-gray-300'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="font-semibold text-xs text-discord-gray-100">
                                  {preset.name}
                                </span>
                                <span className="bg-discord-darkest px-1.5 py-0.5 rounded text-[9px] font-bold text-discord-blurple-light">
                                  {preset.tag}
                                </span>
                              </div>
                              <div className="text-[10px] text-discord-gray-400">
                                {preset.description}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Disconnect Voice */}
              <button
                onClick={() => leaveVoiceChannel(currentUser)}
                title="Disconnect Call"
                className="w-12 h-12 rounded-full bg-discord-red text-white hover:bg-discord-red-hover flex items-center justify-center shadow-lg transition-transform hover:scale-105"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => joinVoiceChannel(channel.id, currentUser)}
              className="px-6 py-2.5 rounded-full bg-discord-green hover:bg-discord-green-hover text-white font-bold flex items-center gap-2 shadow-lg transition-all"
            >
              <span>Join Voice Channel</span>
            </button>
          )}
        </div>
      </div>

      {/* Voice Channel Chat Side Panel (Separate text chat inside voice channels like Discord!) */}
      {showVoiceChat && (
        <div className="w-80 md:w-96 border-l border-discord-darkest/70 flex flex-col h-full bg-discord-chat">
          <ChatArea
            channel={{
              ...channel,
              name: `${channel.name} Chat`,
              topic: `Text chat for ${channel.name}`,
            }}
            onOpenEmojiPicker={onOpenEmojiPicker}
            onOpenGifPicker={onOpenGifPicker}
            onOpenEmojiPickerForMessage={onOpenEmojiPickerForMessage}
          />
        </div>
      )}
    </div>
  );
};
