import React, { useState } from 'react';
import { Hash, Volume2, Pin, Users, Search, Download, Bell, BellOff, PhoneOff } from 'lucide-react';
import { Channel } from '../../types';
import { notificationService } from '../../lib/notificationService';
import { useVoiceStore } from '../../store/useVoiceStore';
import { useAuthStore } from '../../store/useAuthStore';

interface AppHeaderProps {
  channel?: Channel;
  showMemberList: boolean;
  onToggleMemberList: () => void;
  onTogglePins?: () => void;
  onInstallPWA?: () => void;
  canInstallPWA?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  channel,
  showMemberList,
  onToggleMemberList,
  onTogglePins,
  onInstallPWA,
  canInstallPWA,
}) => {
  const { currentUser } = useAuthStore();
  const { activeVoiceChannelId, joinVoiceChannel, leaveVoiceChannel } = useVoiceStore();

  const [notificationsEnabled, setNotificationsEnabled] = useState(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );

  const handleToggleNotifications = async () => {
    const granted = await notificationService.requestPermission();
    setNotificationsEnabled(granted);
    if (granted) {
      notificationService.playNotificationChime();
    }
  };

  if (!channel) {
    return (
      <header className="h-12 bg-discord-chat border-b border-discord-darkest/70 px-4 flex items-center justify-between select-none z-10 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Hash className="w-6 h-6 text-discord-gray-400 flex-shrink-0" />
          <h1 className="font-bold text-discord-gray-100 text-base truncate">
            SquadSpace Hangout
          </h1>
        </div>
      </header>
    );
  }

  const isText = channel.type === 'text';
  const isVoiceConnected = activeVoiceChannelId === channel.id;

  return (
    <header className="h-12 bg-discord-chat border-b border-discord-darkest/70 px-4 flex items-center justify-between select-none z-10 shadow-sm">
      {/* Left: Channel Info */}
      <div className="flex items-center gap-2 min-w-0">
        {isText ? (
          <Hash className="w-6 h-6 text-discord-gray-400 flex-shrink-0" />
        ) : (
          <Volume2 className="w-6 h-6 text-discord-green flex-shrink-0" />
        )}
        <h1 className="font-bold text-discord-gray-100 text-base truncate">
          {channel.name}
        </h1>

        {channel.topic && (
          <>
            <span className="text-discord-gray-600 text-sm">|</span>
            <span className="text-xs text-discord-gray-400 truncate hidden md:inline max-w-md">
              {channel.topic}
            </span>
          </>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2.5 text-discord-gray-300">
        {/* Prominent Voice Join / Leave Button in Header when in a voice channel */}
        {!isText && currentUser && (
          <button
            onClick={() => {
              if (isVoiceConnected) {
                leaveVoiceChannel(currentUser);
              } else {
                joinVoiceChannel(channel.id, currentUser);
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
              isVoiceConnected
                ? 'bg-discord-red/20 hover:bg-discord-red text-discord-red hover:text-white border border-discord-red/40'
                : 'bg-discord-green hover:bg-discord-green-hover text-white'
            }`}
          >
            {isVoiceConnected ? (
              <>
                <PhoneOff className="w-3.5 h-3.5" />
                <span>Disconnect Voice</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>Join Voice Channel</span>
              </>
            )}
          </button>
        )}

        {/* Notifications Toggle */}
        <button
          onClick={handleToggleNotifications}
          title={notificationsEnabled ? 'Desktop Notifications Enabled' : 'Enable Desktop Notifications'}
          className={`p-1.5 rounded transition-colors ${
            notificationsEnabled
              ? 'text-discord-blurple-light hover:bg-discord-hover'
              : 'text-discord-gray-400 hover:bg-discord-hover hover:text-discord-gray-200'
          }`}
        >
          {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
        </button>

        {/* PWA Install Button */}
        {canInstallPWA && (
          <button
            onClick={onInstallPWA}
            title="Install Desktop App"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-discord-blurple hover:bg-discord-blurple-hover text-white rounded transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install App</span>
          </button>
        )}

        {/* Pinned Messages Button */}
        {isText && (
          <button
            onClick={onTogglePins}
            title="Pinned Messages"
            className="p-1.5 rounded hover:bg-discord-hover hover:text-discord-gray-100 transition-colors"
          >
            <Pin className="w-5 h-5" />
          </button>
        )}

        {/* Member List Toggle Button */}
        <button
          onClick={onToggleMemberList}
          title={showMemberList ? 'Hide Member List' : 'Show Member List'}
          className={`p-1.5 rounded transition-colors ${
            showMemberList
              ? 'text-discord-gray-100 bg-discord-active'
              : 'hover:bg-discord-hover hover:text-discord-gray-100'
          }`}
        >
          <Users className="w-5 h-5" />
        </button>

        {/* Search Input */}
        <div className="relative hidden lg:flex items-center">
          <input
            type="text"
            placeholder="Search"
            className="w-36 focus:w-56 transition-all duration-200 bg-discord-darkest text-xs text-discord-gray-200 placeholder-discord-gray-500 rounded px-2 py-1 pr-6 focus:outline-none focus:ring-1 focus:ring-discord-blurple"
          />
          <Search className="w-3.5 h-3.5 text-discord-gray-400 absolute right-2 pointer-events-none" />
        </div>
      </div>
    </header>
  );
};
