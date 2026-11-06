import React, { useState } from 'react';
import { Mic, MicOff, Headphones, Settings, Circle, Radio } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useVoiceStore } from '../../store/useVoiceStore';
import { useSettingsStore, formatKeyDisplay } from '../../store/useSettingsStore';
import { UserStatus } from '../../types';

interface UserBottomBarProps {
  onOpenSettings: () => void;
}

export const UserBottomBar: React.FC<UserBottomBarProps> = ({ onOpenSettings }) => {
  const { currentUser, updateStatus } = useAuthStore();
  const { isMuted, isDeafened, toggleMute, toggleDeafen, activeVoiceChannelId } = useVoiceStore();
  const { inputMode, keybinds, isPttPressed } = useSettingsStore();
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  if (!currentUser) return null;

  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case 'online':
        return 'text-discord-green fill-discord-green';
      case 'idle':
        return 'text-discord-yellow fill-discord-yellow';
      case 'dnd':
        return 'text-discord-red fill-discord-red';
      default:
        return 'text-discord-gray-500 fill-discord-gray-500';
    }
  };

  const getStatusLabel = (status: UserStatus) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'idle':
        return 'Idle';
      case 'dnd':
        return 'Do Not Disturb';
      default:
        return 'Invisible';
    }
  };

  return (
    <div className="relative bg-[#232428] px-2 py-1.5 flex items-center justify-between border-t border-discord-darkest select-none">
      {/* Profile summary & status trigger */}
      <div
        onClick={() => setShowStatusMenu(!showStatusMenu)}
        className="flex items-center gap-2 p-1 -ml-1 rounded-md hover:bg-discord-hover cursor-pointer max-w-[140px] transition-colors"
        title="Click to change online status"
      >
        <div className="relative">
          <img
            src={currentUser.avatarUrl}
            alt={currentUser.displayName}
            className="w-8 h-8 rounded-full object-cover"
          />
          <span className="absolute -bottom-0.5 -right-0.5 bg-[#232428] rounded-full p-0.5">
            <Circle className={`w-2.5 h-2.5 ${getStatusColor(currentUser.status)}`} />
          </span>
        </div>
        <div className="flex flex-col min-w-0 leading-tight">
          <span className="text-sm font-semibold text-discord-gray-100 truncate">
            {currentUser.displayName}
          </span>
          <span className="text-xs text-discord-gray-400 truncate">
            {currentUser.customStatus || currentUser.gamingActivity?.game || `@${currentUser.username}`}
          </span>
        </div>
      </div>

      {/* Audio & Settings Buttons */}
      <div className="flex items-center text-discord-gray-300">
        <button
          onClick={toggleMute}
          title={
            isMuted
              ? 'Unmute'
              : inputMode === 'push_to_talk'
              ? `Push-to-Talk (${formatKeyDisplay(keybinds.pushToTalk)})`
              : 'Mute'
          }
          className={`relative p-1.5 rounded hover:bg-discord-hover transition-colors ${
            isMuted
              ? 'text-discord-red hover:text-discord-red'
              : inputMode === 'push_to_talk' && isPttPressed
              ? 'text-discord-green bg-discord-green/20 font-bold'
              : 'hover:text-discord-gray-100'
          }`}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          {inputMode === 'push_to_talk' && !isMuted && (
            <span className="absolute -bottom-1 -right-0.5 text-[8px] font-bold px-1 rounded bg-black/80 text-discord-blurple-light scale-90 border border-white/10">
              PTT
            </span>
          )}
        </button>

        <button
          onClick={toggleDeafen}
          title={isDeafened ? 'Undeafen' : 'Deafen'}
          className={`p-1.5 rounded hover:bg-discord-hover transition-colors ${
            isDeafened ? 'text-discord-red hover:text-discord-red' : 'hover:text-discord-gray-100'
          }`}
        >
          <Headphones className="w-5 h-5" />
        </button>

        <button
          onClick={onOpenSettings}
          title="User Settings"
          className="p-1.5 rounded hover:bg-discord-hover hover:text-discord-gray-100 transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Status Selection Popup */}
      {showStatusMenu && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setShowStatusMenu(false)}
          />
          <div className="absolute bottom-14 left-2 w-48 bg-[#111214] border border-[#2b2d31] rounded-lg shadow-2xl p-1.5 z-40 text-sm">
            <div className="text-xs font-bold text-discord-gray-400 uppercase px-2 py-1">
              Set Status
            </div>
            {(['online', 'idle', 'dnd', 'offline'] as UserStatus[]).map((st) => (
              <button
                key={st}
                onClick={() => {
                  updateStatus(st);
                  setShowStatusMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-discord-blurple hover:text-white text-discord-gray-200 transition-colors"
              >
                <Circle className={`w-3 h-3 ${getStatusColor(st)}`} />
                <span>{getStatusLabel(st)}</span>
              </button>
            ))}
            <div className="my-1 border-t border-discord-divider" />
            <button
              onClick={() => {
                setShowStatusMenu(false);
                onOpenSettings();
              }}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-discord-hover text-discord-gray-300 text-xs"
            >
              Edit Custom Status & Activity...
            </button>
          </div>
        </>
      )}
    </div>
  );
};
