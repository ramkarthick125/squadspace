import React from 'react';
import { Circle, Gamepad2, Volume2, Shield } from 'lucide-react';
import { UserProfile, UserStatus } from '../../types';
import { useServerStore } from '../../store/useServerStore';
import { useVoiceStore } from '../../store/useVoiceStore';
import { useDMStore } from '../../store/useDMStore';
import { useAuthStore } from '../../store/useAuthStore';

interface MemberSidebarProps {
  onSelectMember?: (member: UserProfile) => void;
}

export const MemberSidebar: React.FC<MemberSidebarProps> = ({ onSelectMember }) => {
  const { members } = useServerStore();
  const { currentUser } = useAuthStore();
  const { participantsByChannel } = useVoiceStore();
  const { startOrOpenDM, setActiveConversation } = useDMStore();
  const { setActiveView } = useServerStore();

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

  // Find if user is in any voice channel
  const getConnectedVoiceChannelName = (userId: string) => {
    for (const [channelId, participants] of Object.entries(participantsByChannel)) {
      if (participants.some((p) => p.userId === userId)) {
        return channelId.replace('vc-', '').toUpperCase() + ' VC';
      }
    }
    return null;
  };

  const isRealUser = (m: UserProfile) =>
    !m.username.startsWith('uuid_test') &&
    !m.username.startsWith('tokentest') &&
    !m.username.startsWith('testuser');

  const allMembers = (currentUser
    ? members.some((m) => m.id === currentUser.id)
      ? members
      : [currentUser, ...members]
    : members
  ).filter(isRealUser);

  const onlineMembers = allMembers.filter((m) => m.status !== 'offline');
  const offlineMembers = allMembers.filter((m) => m.status === 'offline');

  const handleMemberClick = (member: UserProfile) => {
    if (!currentUser || member.id === currentUser.id) return;
    if (onSelectMember) {
      onSelectMember(member);
    } else {
      startOrOpenDM(member, currentUser);
      setActiveView('dm');
    }
  };

  const renderMemberItem = (member: UserProfile) => {
    const voiceChannel = getConnectedVoiceChannelName(member.id);

    return (
      <div
        key={member.id}
        onClick={() => handleMemberClick(member)}
        className="group flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-discord-hover/60 cursor-pointer transition-colors"
      >
        {/* Avatar + Status Pill */}
        <div className="relative flex-shrink-0">
          <img
            src={member.avatarUrl}
            alt={member.displayName}
            className="w-8 h-8 rounded-full object-cover"
          />
          <span className="absolute -bottom-0.5 -right-0.5 bg-discord-sidebar rounded-full p-0.5">
            <Circle className={`w-2.5 h-2.5 ${getStatusColor(member.status)}`} />
          </span>
        </div>

        {/* Name & Activities */}
        <div className="flex flex-col min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-sm font-semibold truncate ${
                member.status === 'offline'
                  ? 'text-discord-gray-500'
                  : 'text-discord-gray-200 group-hover:text-white'
              }`}
            >
              {member.displayName}
            </span>

            {member.isAdmin && (
              <span title="Server Admin">
                <Shield className="w-3.5 h-3.5 text-discord-blurple" />
              </span>
            )}
          </div>

          {/* Activity / Status line */}
          {member.gamingActivity ? (
            <div className="flex items-center gap-1 text-[11px] text-discord-gray-400 truncate">
              <Gamepad2 className="w-3 h-3 text-discord-green flex-shrink-0" />
              <span className="truncate">
                Playing <strong className="font-semibold text-discord-gray-300">{member.gamingActivity.game}</strong>
              </span>
            </div>
          ) : voiceChannel ? (
            <div className="flex items-center gap-1 text-[11px] text-discord-green truncate">
              <Volume2 className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">In {voiceChannel}</span>
            </div>
          ) : member.customStatus ? (
            <span className="text-[11px] text-discord-gray-400 truncate">
              {member.customStatus}
            </span>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <aside className="w-60 bg-discord-sidebar flex flex-col flex-shrink-0 select-none border-l border-discord-darkest/40 overflow-y-auto px-2 py-4 space-y-4">
      {/* Online Group */}
      <div>
        <h3 className="text-xs font-bold text-discord-gray-400 uppercase tracking-wider px-2 mb-1">
          Online — {onlineMembers.length}
        </h3>
        <div className="space-y-0.5">
          {onlineMembers.map(renderMemberItem)}
        </div>
      </div>

      {/* Offline Group */}
      {offlineMembers.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-discord-gray-400 uppercase tracking-wider px-2 mb-1">
            Offline — {offlineMembers.length}
          </h3>
          <div className="space-y-0.5">
            {offlineMembers.map(renderMemberItem)}
          </div>
        </div>
      )}
    </aside>
  );
};
