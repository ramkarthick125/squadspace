import React from 'react';
import { MessageSquare, Plus, Key, Shield } from 'lucide-react';
import { useServerStore } from '../../store/useServerStore';

interface ServerRailProps {
  onOpenServerSettings: () => void;
  onOpenCreateChannel: () => void;
  onOpenJoinServer: () => void;
}

export const ServerRail: React.FC<ServerRailProps> = ({
  onOpenServerSettings,
  onOpenCreateChannel,
  onOpenJoinServer,
}) => {
  const { activeView, setActiveView, serverName, serverIcon } = useServerStore();

  return (
    <nav className="w-[72px] bg-discord-darkest flex flex-col items-center py-3 select-none flex-shrink-0 z-20">
      {/* Direct Messages Button */}
      <div className="relative group flex items-center justify-center w-full mb-2">
        <span
          className={`absolute left-0 w-1 bg-white rounded-r transition-all duration-200 ${
            activeView === 'dm' ? 'h-10' : 'h-0 group-hover:h-5'
          }`}
        />

        <button
          onClick={() => setActiveView('dm')}
          title="Direct Messages"
          className={`w-12 h-12 rounded-[24px] group-hover:rounded-[16px] flex items-center justify-center transition-all duration-200 cursor-pointer ${
            activeView === 'dm'
              ? 'bg-discord-blurple text-white rounded-[16px]'
              : 'bg-discord-sidebar text-discord-gray-300 hover:bg-discord-blurple hover:text-white'
          }`}
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      </div>

      {/* Divider */}
      <div className="w-8 h-[2px] bg-discord-divider rounded mb-2" />

      {/* SquadSpace Server Icon */}
      <div className="relative group flex items-center justify-center w-full mb-2">
        <span
          className={`absolute left-0 w-1 bg-white rounded-r transition-all duration-200 ${
            activeView === 'server' ? 'h-10' : 'h-0 group-hover:h-5'
          }`}
        />

        <button
          onClick={() => setActiveView('server')}
          title={serverName}
          className={`w-12 h-12 rounded-[24px] group-hover:rounded-[16px] flex items-center justify-center font-bold text-lg transition-all duration-200 cursor-pointer ${
            activeView === 'server'
              ? 'bg-discord-blurple text-white rounded-[16px]'
              : 'bg-discord-sidebar text-discord-gray-200 hover:bg-discord-blurple hover:text-white'
          }`}
        >
          {serverIcon}
        </button>
      </div>

      {/* Create Channel Button */}
      <div className="relative group flex items-center justify-center w-full mb-2">
        <span className="absolute left-0 w-1 bg-white rounded-r transition-all duration-200 h-0 group-hover:h-5" />
        <button
          onClick={onOpenCreateChannel}
          title="Create Channel"
          className="w-12 h-12 rounded-[24px] group-hover:rounded-[16px] bg-discord-sidebar text-discord-green hover:bg-discord-green hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Join Server / Enter Invite Code Button */}
      <div className="relative group flex items-center justify-center w-full mb-2">
        <span className="absolute left-0 w-1 bg-white rounded-r transition-all duration-200 h-0 group-hover:h-5" />
        <button
          onClick={onOpenJoinServer}
          title="Join Server with Invite Code"
          className="w-12 h-12 rounded-[24px] group-hover:rounded-[16px] bg-discord-sidebar text-discord-gray-300 hover:bg-discord-green hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer"
        >
          <Key className="w-5 h-5" />
        </button>
      </div>

      {/* Server Admin & Settings shortcut */}
      <div className="relative group flex items-center justify-center w-full mt-auto mb-2">
        <span className="absolute left-0 w-1 bg-white rounded-r transition-all duration-200 h-0 group-hover:h-5" />
        <button
          onClick={onOpenServerSettings}
          title="Server Settings & Administration"
          className="w-12 h-12 rounded-[24px] group-hover:rounded-[16px] bg-discord-sidebar text-discord-gray-400 hover:bg-discord-hover hover:text-discord-gray-100 flex items-center justify-center transition-all duration-200 cursor-pointer"
        >
          <Shield className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
};
