import React, { useState } from 'react';
import {
  ChevronDown,
  Hash,
  Volume2,
  Plus,
  Lock,
  UserPlus,
  Settings,
  MicOff,
  ScreenShare,
} from 'lucide-react';
import { useServerStore } from '../../store/useServerStore';
import { useVoiceStore } from '../../store/useVoiceStore';
import { useAuthStore } from '../../store/useAuthStore';
import { UserBottomBar } from './UserBottomBar';

interface ChannelSidebarProps {
  onOpenSettings: () => void;
  onOpenCreateChannel: (categoryId?: string, defaultType?: 'text' | 'voice') => void;
  onOpenServerSettings: () => void;
  onOpenInviteModal: () => void;
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  onOpenSettings,
  onOpenCreateChannel,
  onOpenServerSettings,
  onOpenInviteModal,
}) => {
  const { serverName, categories, channels, activeChannelId, setActiveChannel } = useServerStore();
  const { currentUser } = useAuthStore();
  const {
    activeVoiceChannelId,
    joinVoiceChannel,
    leaveVoiceChannel,
    participantsByChannel,
  } = useVoiceStore();

  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [showServerMenu, setShowServerMenu] = useState(false);

  const toggleCategory = (catId: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const handleVoiceChannelClick = (channelId: string) => {
    if (!currentUser) return;
    if (activeVoiceChannelId === channelId) {
      setActiveChannel(channelId);
      return;
    }
    joinVoiceChannel(channelId, currentUser);
    setActiveChannel(channelId);
  };

  // Channels not assigned to any existing category
  const uncategorizedChannels = channels.filter(
    (c) => !c.categoryId || !categories.some((cat) => cat.id === c.categoryId)
  );

  return (
    <aside className="w-60 bg-discord-sidebar flex flex-col flex-shrink-0 select-none border-r border-discord-darkest/40">
      {/* Server Header Dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowServerMenu(!showServerMenu)}
          className="w-full h-12 px-4 flex items-center justify-between font-bold text-discord-gray-100 border-b border-discord-darkest/60 shadow-sm hover:bg-discord-hover/60 transition-colors"
        >
          <span className="truncate text-base tracking-wide">{serverName}</span>
          <ChevronDown
            className={`w-4 h-4 text-discord-gray-300 transition-transform duration-200 ${
              showServerMenu ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Server Context Dropdown Menu */}
        {showServerMenu && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setShowServerMenu(false)}
            />
            <div className="absolute top-13 left-2 right-2 bg-[#111214] border border-[#232428] rounded-lg shadow-2xl p-1.5 z-40 text-sm">
              <button
                onClick={() => {
                  setShowServerMenu(false);
                  onOpenInviteModal();
                }}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded text-discord-blurple-light hover:bg-discord-blurple hover:text-white transition-colors"
              >
                <span>Invite People</span>
                <UserPlus className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setShowServerMenu(false);
                  onOpenServerSettings();
                }}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded text-discord-gray-200 hover:bg-discord-hover transition-colors"
              >
                <span>Server Settings</span>
                <Settings className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setShowServerMenu(false);
                  onOpenCreateChannel();
                }}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded text-discord-gray-200 hover:bg-discord-hover transition-colors"
              >
                <span>Create Channel</span>
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Channels List Area */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* Empty Server Notice */}
        {channels.length === 0 && (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-discord-gray-400 mb-3">No channels created yet</p>
            <button
              onClick={() => onOpenCreateChannel()}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-discord-blurple hover:bg-discord-blurple-hover text-white text-xs font-semibold rounded-md transition shadow"
            >
              <Plus className="w-4 h-4" />
              Create First Channel
            </button>
          </div>
        )}

        {/* Uncategorized Channels */}
        {uncategorizedChannels.length > 0 && (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between px-2 py-1 text-xs font-bold text-discord-gray-400 tracking-wider group hover:text-discord-gray-200">
              <span className="uppercase">CHANNELS</span>
              <button
                onClick={() => onOpenCreateChannel(undefined, 'text')}
                title="Create Channel"
                className="opacity-0 group-hover:opacity-100 hover:text-discord-gray-100 transition-opacity p-0.5"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-0.5 mt-0.5">
              {uncategorizedChannels.map((channel) => {
                const isText = channel.type === 'text';
                const isActive = activeChannelId === channel.id;
                const isVoiceConnected = activeVoiceChannelId === channel.id;
                const participants = participantsByChannel[channel.id] || [];

                return (
                  <div key={channel.id} className="space-y-0.5">
                    <button
                      onClick={() => {
                        if (isText) {
                          setActiveChannel(channel.id);
                        } else {
                          handleVoiceChannelClick(channel.id);
                        }
                      }}
                      className={`w-full group flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                        isActive
                          ? 'bg-discord-active text-white'
                          : 'text-discord-gray-400 hover:bg-discord-hover hover:text-discord-gray-200'
                      }`}
                    >
                      {isText ? (
                        <Hash className="w-4 h-4 text-discord-gray-400 flex-shrink-0" />
                      ) : (
                        <Volume2
                          className={`w-4 h-4 flex-shrink-0 ${
                            isVoiceConnected ? 'text-discord-green' : 'text-discord-gray-400'
                          }`}
                        />
                      )}

                      <span className="truncate font-medium flex-1 text-left">
                        {channel.name}
                      </span>

                      {channel.isPrivate && (
                        <Lock className="w-3 h-3 text-discord-gray-500" />
                      )}
                    </button>

                    {!isText && participants.length > 0 && (
                      <div className="pl-6 pr-2 py-1 space-y-1">
                        {participants.map((participant) => (
                          <div
                            key={participant.userId}
                            className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-discord-hover/50 text-xs text-discord-gray-300"
                          >
                            <img
                              src={participant.user?.avatarUrl}
                              alt={participant.user?.displayName || 'User'}
                              className={`w-5 h-5 rounded-full object-cover ${
                                participant.isSpeaking ? 'speaking-indicator' : ''
                              }`}
                            />
                            <span className="truncate flex-1 font-medium">
                              {participant.user?.displayName || 'User'}
                            </span>

                            {participant.isScreenSharing && (
                              <ScreenShare className="w-3 h-3 text-discord-green" />
                            )}
                            {participant.isMuted && (
                              <MicOff className="w-3 h-3 text-discord-red" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Categorized Channels */}
        {categories.map((category) => {
          const isCollapsed = collapsedCategories[category.id];
          const categoryChannels = channels.filter((c) => c.categoryId === category.id);

          return (
            <div key={category.id} className="space-y-0.5">
              <div className="flex items-center justify-between px-2 py-1 text-xs font-bold text-discord-gray-400 tracking-wider group hover:text-discord-gray-200 cursor-pointer">
                <div
                  onClick={() => toggleCategory(category.id)}
                  className="flex items-center gap-1 flex-1 uppercase"
                >
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${
                      isCollapsed ? '-rotate-90' : ''
                    }`}
                  />
                  <span>{category.name}</span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const defaultType = category.name.includes('VOICE') ? 'voice' : 'text';
                    onOpenCreateChannel(category.id, defaultType);
                  }}
                  title="Create Channel in Category"
                  className="opacity-0 group-hover:opacity-100 hover:text-discord-gray-100 transition-opacity p-0.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {!isCollapsed && (
                <div className="space-y-0.5 mt-0.5">
                  {categoryChannels.map((channel) => {
                    const isText = channel.type === 'text';
                    const isActive = activeChannelId === channel.id;
                    const isVoiceConnected = activeVoiceChannelId === channel.id;
                    const participants = participantsByChannel[channel.id] || [];

                    return (
                      <div key={channel.id} className="space-y-0.5">
                        <button
                          onClick={() => {
                            if (isText) {
                              setActiveChannel(channel.id);
                            } else {
                              handleVoiceChannelClick(channel.id);
                            }
                          }}
                          className={`w-full group flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                            isActive
                              ? 'bg-discord-active text-white'
                              : 'text-discord-gray-400 hover:bg-discord-hover hover:text-discord-gray-200'
                          }`}
                        >
                          {isText ? (
                            <Hash className="w-4 h-4 text-discord-gray-400 flex-shrink-0" />
                          ) : (
                            <Volume2
                              className={`w-4 h-4 flex-shrink-0 ${
                                isVoiceConnected ? 'text-discord-green' : 'text-discord-gray-400'
                              }`}
                            />
                          )}

                          <span className="truncate font-medium flex-1 text-left">
                            {channel.name}
                          </span>

                          {channel.isPrivate && (
                            <Lock className="w-3 h-3 text-discord-gray-500" />
                          )}
                        </button>

                        {!isText && participants.length > 0 && (
                          <div className="pl-6 pr-2 py-1 space-y-1">
                            {participants.map((participant) => (
                              <div
                                key={participant.userId}
                                className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-discord-hover/50 text-xs text-discord-gray-300"
                              >
                                <img
                                  src={participant.user?.avatarUrl}
                                  alt={participant.user?.displayName || 'User'}
                                  className={`w-5 h-5 rounded-full object-cover ${
                                    participant.isSpeaking ? 'speaking-indicator' : ''
                                  }`}
                                />
                                <span className="truncate flex-1 font-medium">
                                  {participant.user?.displayName || 'User'}
                                </span>

                                {participant.isScreenSharing && (
                                  <ScreenShare className="w-3 h-3 text-discord-green" />
                                )}
                                {participant.isMuted && (
                                  <MicOff className="w-3 h-3 text-discord-red" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Connected Voice Quick Card */}
      {activeVoiceChannelId && (
        <div className="bg-[#232428] border-t border-discord-darkest px-3 py-2 flex items-center justify-between text-xs">
          <div className="flex flex-col">
            <span className="text-discord-green font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-discord-green animate-pulse" />
              Voice Connected
            </span>
            <span className="text-discord-gray-400 text-[11px] truncate">
              {channels.find((c) => c.id === activeVoiceChannelId)?.name || 'Voice Room'}
            </span>
          </div>

          <button
            onClick={() => currentUser && leaveVoiceChannel(currentUser)}
            title="Disconnect Voice"
            className="p-1 rounded hover:bg-discord-hover text-discord-red hover:text-discord-red"
          >
            Disconnect
          </button>
        </div>
      )}

      {/* User Bottom Bar */}
      <UserBottomBar onOpenSettings={onOpenSettings} />
    </aside>
  );
};
