import React from 'react';
import { MessageSquare, Plus, Compass, Shield } from 'lucide-react';
import { useServerStore } from '../../store/useServerStore';

interface ServerRailProps {
  onOpenServerSettings: () => void;
  onOpenCreateChannel: () => void;
  onOpenJoinServer: () => void;
  onOpenCreateServer: () => void;
}

export const ServerRail: React.FC<ServerRailProps> = ({
  onOpenServerSettings,
  onOpenCreateChannel,
  onOpenJoinServer,
  onOpenCreateServer,
}) => {
  const {
    activeView,
    setActiveView,
    userServers,
    activeServerId,
    setActiveServer,
  } = useServerStore();

  const getServerInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <nav className="w-[72px] bg-discord-darkest flex flex-col items-center py-3 select-none flex-shrink-0 z-20 overflow-y-auto no-scrollbar">
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

      {/* Dynamic List of Joined Servers */}
      <div className="flex flex-col items-center gap-2 w-full">
        {userServers.map((server) => {
          const isSelected = activeView === 'server' && activeServerId === server.id;

          return (
            <div key={server.id} className="relative group flex items-center justify-center w-full">
              {/* Discord-style active/hover indicator pill on the left */}
              <span
                className={`absolute left-0 w-1 bg-white rounded-r transition-all duration-200 ${
                  isSelected ? 'h-10' : 'h-0 group-hover:h-5'
                }`}
              />

              <button
                onClick={() => setActiveServer(server.id)}
                title={server.name}
                className={`w-12 h-12 rounded-[24px] group-hover:rounded-[16px] flex items-center justify-center font-bold text-base transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-discord-blurple text-white rounded-[16px] shadow-lg'
                    : 'bg-discord-sidebar text-discord-gray-200 hover:bg-discord-blurple hover:text-white'
                }`}
              >
                {server.icon && server.icon.length <= 2 ? (
                  <span>{server.icon}</span>
                ) : (
                  <span className="tracking-wider">{getServerInitials(server.name)}</span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Add / Create Server Button */}
      <div className="relative group flex items-center justify-center w-full mt-2 mb-2">
        <span className="absolute left-0 w-1 bg-white rounded-r transition-all duration-200 h-0 group-hover:h-5" />
        <button
          onClick={onOpenCreateServer}
          title="Create a Server"
          className="w-12 h-12 rounded-[24px] group-hover:rounded-[16px] bg-discord-sidebar text-discord-green hover:bg-discord-green hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Join Server with Invite Code Button */}
      <div className="relative group flex items-center justify-center w-full mb-2">
        <span className="absolute left-0 w-1 bg-white rounded-r transition-all duration-200 h-0 group-hover:h-5" />
        <button
          onClick={onOpenJoinServer}
          title="Explore / Join Server with Code"
          className="w-12 h-12 rounded-[24px] group-hover:rounded-[16px] bg-discord-sidebar text-discord-gray-300 hover:bg-discord-green hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer"
        >
          <Compass className="w-5 h-5" />
        </button>
      </div>

      {/* Server Admin & Settings shortcut */}
      <div className="relative group flex items-center justify-center w-full mt-auto mb-2">
        <span className="absolute left-0 w-1 bg-white rounded-r transition-all duration-200 h-0 group-hover:h-5" />
        <button
          onClick={onOpenServerSettings}
          title="Server Settings"
          className="w-12 h-12 rounded-[24px] group-hover:rounded-[16px] bg-discord-sidebar text-discord-gray-400 hover:bg-discord-hover hover:text-discord-gray-100 flex items-center justify-center transition-all duration-200 cursor-pointer"
        >
          <Shield className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
};
