import React, { useState } from 'react';
import {
  Users,
  MessageSquare,
  Search,
  UserPlus,
  Circle,
  Gamepad2,
  Trash2,
  Send,
  Sparkles,
  Key,
} from 'lucide-react';
import { useDMStore } from '../../store/useDMStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useServerStore } from '../../store/useServerStore';
import { authService } from '../../lib/authService';
import { UserProfile, UserStatus } from '../../types';
import { UserBottomBar } from '../layout/UserBottomBar';

interface DirectMessagesViewProps {
  onOpenSettings: () => void;
  onOpenEmojiPicker: () => void;
  onOpenGifPicker: () => void;
}

export const DirectMessagesView: React.FC<DirectMessagesViewProps> = ({
  onOpenSettings,
  onOpenEmojiPicker,
  onOpenGifPicker,
}) => {
  const { currentUser } = useAuthStore();
  const { members, invites, serverName, fetchServerData, setActiveView } = useServerStore();
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    dmMessages,
    sendDM,
    sendServerInviteDM,
    friends,
    startOrOpenDM,
    addFriendByUsername,
  } = useDMStore();

  const [activeTab, setActiveTab] = useState<'friends' | 'chat'>('friends');
  const [friendFilter, setFriendFilter] = useState<'online' | 'all' | 'add'>('online');
  const [inputText, setInputText] = useState('');
  const [friendSearch, setFriendSearch] = useState('');
  const [inviteInput, setInviteInput] = useState('');
  const [addFriendLoading, setAddFriendLoading] = useState(false);
  const [addFriendError, setAddFriendError] = useState<string | null>(null);
  const [addFriendSuccess, setAddFriendSuccess] = useState<string | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const activeRecipient = activeConversation?.members.find((m) => m.id !== currentUser?.id) || activeConversation?.members[0];
  const messages = activeConversationId ? dmMessages[activeConversationId] || [] : [];

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

  const handleSendDM = () => {
    if (!inputText.trim() || !activeConversationId || !currentUser) return;
    sendDM(activeConversationId, inputText.trim(), currentUser);
    setInputText('');
  };

  const handleAddFriendSubmit = async () => {
    if (!inviteInput.trim()) return;
    setAddFriendLoading(true);
    setAddFriendError(null);
    setAddFriendSuccess(null);

    const res = await addFriendByUsername(inviteInput.trim(), currentUser);
    setAddFriendLoading(false);

    if (res.success && res.friend) {
      setAddFriendSuccess(`Found and added @${res.friend.username} to your friends list!`);
      setInviteInput('');
      setActiveTab('chat');
    } else {
      setAddFriendError(res.error || 'Failed to add friend.');
    }
  };

  // Combine custom friends with server squad members
  const squadFriendsList = [
    ...friends,
    ...members.filter((m) => m.id !== currentUser?.id && !friends.some((f) => f.id === m.id)),
  ];

  const filteredFriends = squadFriendsList.filter((f) => {
    if (friendFilter === 'online') return f.status !== 'offline';
    return true;
  }).filter((f) =>
    f.displayName.toLowerCase().includes(friendSearch.toLowerCase()) ||
    f.username.toLowerCase().includes(friendSearch.toLowerCase())
  );

  return (
    <div className="flex-1 flex min-w-0 h-full overflow-hidden select-none">
      {/* DM Sidebar */}
      <aside className="w-60 bg-discord-sidebar flex flex-col flex-shrink-0 border-r border-discord-darkest/40">
        {/* DM Header Search */}
        <div className="h-12 px-3 border-b border-discord-darkest/60 flex items-center">
          <button
            onClick={() => {
              setActiveTab('friends');
              setActiveConversation(null);
            }}
            className="w-full py-1.5 px-2 bg-discord-darkest text-xs text-discord-gray-300 rounded flex items-center justify-between hover:text-white transition-colors"
          >
            <span>Find or start a conversation</span>
            <Search className="w-3.5 h-3.5 text-discord-gray-400" />
          </button>
        </div>

        {/* DM Navigation & Conversation List */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
          {/* Friends Tab Button */}
          <button
            onClick={() => {
              setActiveTab('friends');
              setActiveConversation(null);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
              activeTab === 'friends' && !activeConversationId
                ? 'bg-discord-active text-white'
                : 'text-discord-gray-400 hover:bg-discord-hover hover:text-discord-gray-200'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>Friends</span>
          </button>

          {/* Direct Messages List */}
          <div>
            <div className="text-[11px] font-bold text-discord-gray-400 uppercase tracking-wider px-2 mb-1.5 flex items-center justify-between">
              <span>Direct Messages</span>
            </div>

            <div className="space-y-0.5">
              {conversations.map((conv) => {
                const partner = conv.members[0];
                if (!partner) return null;
                const isActive = activeConversationId === conv.id;

                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setActiveConversation(conv.id);
                      setActiveTab('chat');
                    }}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors text-left group ${
                      isActive
                        ? 'bg-discord-active text-white'
                        : 'text-discord-gray-400 hover:bg-discord-hover hover:text-discord-gray-200'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={partner.avatarUrl}
                        alt={partner.displayName}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 bg-discord-sidebar rounded-full p-0.5">
                        <Circle className={`w-2 h-2 ${getStatusColor(partner.status)}`} />
                      </span>
                    </div>

                    <div className="flex flex-col min-w-0 flex-1 leading-tight">
                      <span className="font-medium truncate text-discord-gray-200 group-hover:text-white">
                        {partner.displayName}
                      </span>
                      {conv.lastMessage && (
                        <span className="text-[11px] text-discord-gray-500 truncate">
                          {conv.lastMessage.content}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* User Bottom Bar */}
        <UserBottomBar onOpenSettings={onOpenSettings} />
      </aside>

      {/* Main Content: Friends Home OR One-to-One Chat */}
      {activeConversationId && activeRecipient ? (
        /* One-to-One DM Chat View */
        <div className="flex-1 flex flex-col bg-discord-chat min-w-0 h-full">
          {/* Header */}
          <div className="h-12 px-4 border-b border-discord-darkest/60 flex items-center justify-between bg-discord-chat shadow-sm">
            <div className="flex items-center gap-2">
              <div className="relative">
                <img
                  src={activeRecipient.avatarUrl}
                  alt={activeRecipient.displayName}
                  className="w-7 h-7 rounded-full object-cover"
                />
                <span className="absolute -bottom-0.5 -right-0.5 bg-discord-chat rounded-full p-0.5">
                  <Circle className={`w-2 h-2 ${getStatusColor(activeRecipient.status)}`} />
                </span>
              </div>
              <h2 className="font-bold text-discord-gray-100 text-base">
                {activeRecipient.displayName}
              </h2>
              <span className="text-xs text-discord-gray-400 hidden sm:inline">
                @{activeRecipient.username}
              </span>
            </div>
          </div>

          {/* DM Message History */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* DM Welcome banner */}
            <div className="pt-8 pb-4">
              <img
                src={activeRecipient.avatarUrl}
                alt={activeRecipient.displayName}
                className="w-20 h-20 rounded-full object-cover mb-3"
              />
              <h2 className="text-2xl font-bold text-discord-gray-100">
                {activeRecipient.displayName}
              </h2>
              <p className="text-sm text-discord-gray-400">
                This is the beginning of your direct message history with <strong>{activeRecipient.displayName}</strong>.
              </p>
              {activeRecipient.aboutMe && (
                <div className="mt-3 p-3 bg-discord-sidebar rounded-lg max-w-md text-xs text-discord-gray-300">
                  <span className="font-bold text-discord-gray-400 uppercase text-[10px] block mb-1">About Me</span>
                  {activeRecipient.aboutMe}
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="flex gap-3 hover:bg-discord-hover/30 px-2 py-1 rounded">
                  <img
                    src={msg.sender.avatarUrl}
                    alt={msg.sender.displayName}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                  <div>
                    <div className="flex items-center gap-2 leading-none mb-1">
                      <span className="font-semibold text-sm text-discord-gray-100">
                        {msg.sender.displayName}
                      </span>
                      <span className="text-[10px] text-discord-gray-500">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-discord-gray-200 select-text leading-relaxed">
                      {msg.content}
                    </p>

                    {/* Rich Cards for Server Invites and Friend Requests */}
                    {msg.attachments?.map((att) => {
                      if (att.type === 'server_invite') {
                        return (
                          <div
                            key={att.id}
                            className="mt-2.5 bg-[#2b2d31] border border-[#1e1f22] rounded-xl p-3.5 max-w-sm shadow-xl"
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider text-discord-gray-400 block mb-2">
                              You've Been Invited to Join a Server
                            </span>
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-discord-blurple flex items-center justify-center text-xl font-bold text-white shadow">
                                  🚀
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-sm text-white truncate">
                                    {att.name || 'SquadSpace Hangout'}
                                  </div>
                                  <div className="text-[11px] text-discord-gray-400 font-mono">
                                    Code: {att.url}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={async () => {
                                  if (!currentUser) return;
                                  const res = await authService.joinServerWithCode(att.url, currentUser.id);
                                  if (res.success) {
                                    await fetchServerData();
                                    setActiveView('server');
                                  } else {
                                    alert(res.error || 'Failed to join server');
                                  }
                                }}
                                className="px-3.5 py-1.5 rounded-lg bg-discord-green hover:bg-discord-green/90 text-white font-bold text-xs shadow transition flex-shrink-0 cursor-pointer"
                              >
                                Join Server
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (att.type === 'friend_invite') {
                        return (
                          <div
                            key={att.id}
                            className="mt-2 bg-[#2b2d31] border border-[#1e1f22] rounded-xl p-3 max-w-sm shadow flex items-center gap-2.5"
                          >
                            <UserPlus className="w-5 h-5 text-discord-green flex-shrink-0" />
                            <div className="text-xs text-discord-gray-200">
                              <strong>{msg.sender.displayName}</strong> connected with you as a friend!
                            </div>
                          </div>
                        );
                      }

                      if (att.type === 'image') {
                        return (
                          <img
                            key={att.id}
                            src={att.url}
                            alt={att.name}
                            className="max-w-xs max-h-60 rounded-lg mt-2 object-cover border border-discord-darkest"
                          />
                        );
                      }

                      return null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DM Input */}
          <div className="p-4">
            <div className="bg-discord-input rounded-lg flex items-center px-4 py-2.5 gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendDM();
                  }
                }}
                placeholder={`Message @${activeRecipient.displayName}`}
                className="flex-1 bg-transparent text-sm text-discord-gray-100 placeholder-discord-gray-500 focus:outline-none"
              />

              {/* Quick Send Server Invite in DM */}
              <button
                type="button"
                onClick={() => {
                  if (currentUser && activeRecipient) {
                    const invCode = invites[0]?.code || 'sqd-squad';
                    sendServerInviteDM(activeRecipient, invCode, currentUser, serverName);
                  }
                }}
                title="Send Server Invite to this user"
                className="p-1.5 text-discord-gray-400 hover:text-discord-green rounded hover:bg-discord-hover transition"
              >
                <Key className="w-4 h-4" />
              </button>

              <button
                onClick={handleSendDM}
                className="text-discord-blurple hover:text-discord-blurple-light p-1 cursor-pointer"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Friends Dashboard */
        <div className="flex-1 flex flex-col bg-discord-chat min-w-0 h-full">
          {/* Friends Navigation Bar */}
          <div className="h-12 px-4 border-b border-discord-darkest/60 flex items-center gap-4 bg-discord-chat">
            <div className="flex items-center gap-2 pr-3 border-r border-discord-divider/60 text-discord-gray-200 font-bold text-sm">
              <Users className="w-5 h-5 text-discord-gray-400" />
              <span>Friends</span>
            </div>

            <div className="flex items-center gap-2 text-sm font-semibold">
              <button
                onClick={() => setFriendFilter('online')}
                className={`px-2 py-1 rounded transition-colors ${
                  friendFilter === 'online'
                    ? 'bg-discord-active text-white'
                    : 'text-discord-gray-400 hover:text-discord-gray-200'
                }`}
              >
                Online
              </button>

              <button
                onClick={() => setFriendFilter('all')}
                className={`px-2 py-1 rounded transition-colors ${
                  friendFilter === 'all'
                    ? 'bg-discord-active text-white'
                    : 'text-discord-gray-400 hover:text-discord-gray-200'
                }`}
              >
                All
              </button>

              <button
                onClick={() => setFriendFilter('add')}
                className={`px-2 py-1 rounded transition-colors ${
                  friendFilter === 'add'
                    ? 'bg-discord-green/20 text-discord-green font-bold'
                    : 'text-discord-green hover:bg-discord-green/10'
                }`}
              >
                Add Friend
              </button>
            </div>
          </div>

          {/* Friends List or Add Friend Tab */}
          <div className="flex-1 overflow-y-auto p-6">
            {friendFilter === 'add' ? (
              <div className="max-w-xl space-y-4">
                <h2 className="text-base font-bold uppercase text-white tracking-wide">
                  ADD FRIEND
                </h2>
                <p className="text-xs text-discord-gray-400">
                  You can invite a friend to SquadSpace using their username or share an invite link.
                </p>

                <div className="relative bg-discord-input rounded-lg flex items-center p-3 border border-discord-darkest focus-within:border-discord-blurple">
                  <input
                    type="text"
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    placeholder="Enter a Username#0000 or username"
                    className="flex-1 bg-transparent text-sm text-discord-gray-100 placeholder-discord-gray-500 focus:outline-none"
                  />
                  <button
                    onClick={handleAddFriendSubmit}
                    disabled={addFriendLoading}
                    className="px-4 py-1.5 rounded bg-discord-blurple hover:bg-discord-blurple-hover disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {addFriendLoading ? 'Searching...' : 'Send Friend Request'}
                  </button>
                </div>

                {addFriendError && (
                  <div className="p-3 bg-discord-red/10 border border-discord-red/30 rounded text-discord-red text-xs font-semibold">
                    {addFriendError}
                  </div>
                )}

                {addFriendSuccess && (
                  <div className="p-3 bg-discord-green/10 border border-discord-green/30 rounded text-discord-green text-xs font-semibold">
                    {addFriendSuccess}
                  </div>
                )}
              </div>
            ) : (
              <div className="max-w-4xl space-y-4">
                {/* Search Bar */}
                <div className="relative mb-4">
                  <input
                    type="text"
                    value={friendSearch}
                    onChange={(e) => setFriendSearch(e.target.value)}
                    placeholder="Search friends"
                    className="w-full bg-discord-darkest text-sm text-discord-gray-200 placeholder-discord-gray-500 rounded px-3 py-2 pr-8 focus:outline-none focus:ring-1 focus:ring-discord-blurple"
                  />
                  <Search className="w-4 h-4 text-discord-gray-400 absolute right-3 top-3 pointer-events-none" />
                </div>

                <div className="text-xs font-bold text-discord-gray-400 uppercase tracking-wider">
                  {friendFilter === 'online' ? `Online — ${filteredFriends.length}` : `All Friends — ${filteredFriends.length}`}
                </div>

                <div className="space-y-1">
                  {filteredFriends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-discord-hover/50 border-t border-discord-divider/20 group transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={friend.avatarUrl}
                            alt={friend.displayName}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <span className="absolute -bottom-0.5 -right-0.5 bg-discord-chat rounded-full p-0.5">
                            <Circle className={`w-2.5 h-2.5 ${getStatusColor(friend.status)}`} />
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm text-discord-gray-100">
                              {friend.displayName}
                            </span>
                            <span className="text-xs text-discord-gray-400">
                              @{friend.username}
                            </span>
                          </div>

                          {friend.gamingActivity ? (
                            <div className="flex items-center gap-1 text-xs text-discord-green">
                              <Gamepad2 className="w-3.5 h-3.5" />
                              <span>Playing {friend.gamingActivity.game}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-discord-gray-400">
                              {friend.customStatus || (friend.status === 'online' ? 'Active now' : 'Offline')}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          startOrOpenDM(friend, currentUser);
                          setActiveTab('chat');
                        }}
                        title="Message"
                        className="p-2 rounded-full bg-discord-sidebar hover:bg-discord-hover text-discord-gray-300 hover:text-white transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
