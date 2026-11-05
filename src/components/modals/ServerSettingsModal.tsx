import React, { useState } from 'react';
import {
  X,
  Shield,
  Smile,
  Hash,
  Users,
  Key,
  Trash2,
  Plus,
  Upload,
  Copy,
  Check,
} from 'lucide-react';
import { useServerStore } from '../../store/useServerStore';
import { useAuthStore } from '../../store/useAuthStore';

interface ServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    serverName,
    serverIcon,
    channels,
    deleteChannel,
    members,
    customEmojis,
    addCustomEmoji,
    deleteCustomEmoji,
    invites,
    createInvite,
  } = useServerStore();
  const { currentUser } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'channels' | 'emojis' | 'members' | 'invites'>('overview');
  const [emojiName, setEmojiName] = useState('');
  const [emojiUrl, setEmojiUrl] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddEmoji = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !emojiName.trim() || !emojiUrl.trim()) return;

    addCustomEmoji(emojiName.trim(), emojiUrl.trim(), currentUser.id);
    setEmojiName('');
    setEmojiUrl('');
  };

  const handleCopyInvite = (code: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://squadspace.app';
    navigator.clipboard.writeText(`${origin}/?invite=${code}`);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm select-none p-4">
      <div className="w-full max-w-3xl bg-discord-chat rounded-xl border border-discord-darkest shadow-2xl flex overflow-hidden max-h-[85vh]">
        {/* Left Sidebar */}
        <div className="w-52 bg-discord-sidebar p-4 border-r border-discord-darkest/60 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-bold text-discord-gray-400 uppercase tracking-wider px-2 mb-2">
              Server Settings
            </div>

            <div className="space-y-1">
              <button
                onClick={() => setActiveTab('overview')}
                className={`w-full text-left px-2.5 py-1.5 rounded text-sm font-semibold flex items-center gap-2 transition-colors ${
                  activeTab === 'overview'
                    ? 'bg-discord-active text-white'
                    : 'text-discord-gray-300 hover:bg-discord-hover'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Overview</span>
              </button>

              <button
                onClick={() => setActiveTab('channels')}
                className={`w-full text-left px-2.5 py-1.5 rounded text-sm font-semibold flex items-center gap-2 transition-colors ${
                  activeTab === 'channels'
                    ? 'bg-discord-active text-white'
                    : 'text-discord-gray-300 hover:bg-discord-hover'
                }`}
              >
                <Hash className="w-4 h-4" />
                <span>Channels</span>
              </button>

              <button
                onClick={() => setActiveTab('emojis')}
                className={`w-full text-left px-2.5 py-1.5 rounded text-sm font-semibold flex items-center gap-2 transition-colors ${
                  activeTab === 'emojis'
                    ? 'bg-discord-active text-white'
                    : 'text-discord-gray-300 hover:bg-discord-hover'
                }`}
              >
                <Smile className="w-4 h-4" />
                <span>Custom Emojis</span>
              </button>

              <button
                onClick={() => setActiveTab('members')}
                className={`w-full text-left px-2.5 py-1.5 rounded text-sm font-semibold flex items-center gap-2 transition-colors ${
                  activeTab === 'members'
                    ? 'bg-discord-active text-white'
                    : 'text-discord-gray-300 hover:bg-discord-hover'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Members ({members.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('invites')}
                className={`w-full text-left px-2.5 py-1.5 rounded text-sm font-semibold flex items-center gap-2 transition-colors ${
                  activeTab === 'invites'
                    ? 'bg-discord-active text-white'
                    : 'text-discord-gray-300 hover:bg-discord-hover'
                }`}
              >
                <Key className="w-4 h-4" />
                <span>Invites</span>
              </button>
            </div>
          </div>

          <div className="text-[10px] text-discord-gray-500 px-2">
            Administrator Mode
          </div>
        </div>

        {/* Right Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-discord-chat">
          <div className="h-12 px-6 flex items-center justify-between border-b border-discord-darkest/60">
            <h2 className="font-bold text-discord-gray-100 text-base uppercase">
              {activeTab}
            </h2>
            <button
              onClick={onClose}
              className="text-discord-gray-400 hover:text-discord-gray-100 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-discord-blurple flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                    {serverIcon}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">{serverName}</h3>
                    <p className="text-xs text-discord-gray-400">
                      Private server configured for your 10–20 friend squad.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-discord-sidebar rounded-lg border border-discord-darkest text-xs space-y-2">
                  <span className="font-bold text-discord-gray-200 block text-sm">
                    Free Infrastructure Status
                  </span>
                  <div className="flex justify-between py-1 border-b border-discord-darkest">
                    <span className="text-discord-gray-400">Hosting:</span>
                    <span className="text-discord-green font-semibold">Vercel (Free Hobby Tier)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-discord-darkest">
                    <span className="text-discord-gray-400">Database & Realtime:</span>
                    <span className="text-discord-green font-semibold">Supabase (Free Tier)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-discord-darkest">
                    <span className="text-discord-gray-400">Voice & Video:</span>
                    <span className="text-discord-green font-semibold">LiveKit Cloud (Build Plan - 5,000 mins/mo)</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'channels' && (
              <div className="space-y-2">
                <p className="text-xs text-discord-gray-400 mb-3">
                  Manage the text and voice channels inside SquadSpace.
                </p>
                {channels.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2.5 bg-discord-sidebar rounded-lg border border-discord-darkest text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {c.type === 'text' ? (
                        <Hash className="w-4 h-4 text-discord-gray-400" />
                      ) : (
                        <Shield className="w-4 h-4 text-discord-green" />
                      )}
                      <span className="font-medium text-white">{c.name}</span>
                      <span className="text-xs text-discord-gray-500 uppercase">
                        ({c.type})
                      </span>
                    </div>

                    <button
                      onClick={() => deleteChannel(c.id)}
                      className="p-1 rounded text-discord-gray-400 hover:text-discord-red transition-colors"
                      title="Delete Channel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'emojis' && (
              <div className="space-y-4">
                <p className="text-xs text-discord-gray-400">
                  Upload custom emojis that your squad can use in chat messages and reactions!
                </p>

                {/* Upload Form */}
                <form
                  onSubmit={handleAddEmoji}
                  className="bg-discord-sidebar p-3.5 rounded-lg border border-discord-darkest space-y-3"
                >
                  <span className="text-xs font-bold text-discord-gray-300 uppercase block">
                    Add New Emoji
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Emoji code (e.g. pepe_hype)"
                      value={emojiName}
                      onChange={(e) => setEmojiName(e.target.value)}
                      className="bg-discord-input text-xs text-discord-gray-100 rounded p-2 focus:outline-none"
                    />
                    <input
                      type="url"
                      placeholder="Image URL (PNG, GIF)"
                      value={emojiUrl}
                      onChange={(e) => setEmojiUrl(e.target.value)}
                      className="bg-discord-input text-xs text-discord-gray-100 rounded p-2 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!emojiName.trim() || !emojiUrl.trim()}
                    className="px-4 py-1.5 rounded bg-discord-blurple hover:bg-discord-blurple-hover disabled:opacity-50 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Emoji</span>
                  </button>
                </form>

                {/* Emoji Grid */}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 pt-2">
                  {customEmojis.map((emoji) => (
                    <div
                      key={emoji.id}
                      className="relative group bg-discord-sidebar p-2 rounded-lg border border-discord-darkest flex flex-col items-center gap-1 hover:border-discord-blurple transition-colors"
                    >
                      <img src={emoji.imageUrl} alt={emoji.name} className="w-8 h-8 object-contain" />
                      <span className="text-[10px] text-discord-gray-400 truncate max-w-full">
                        :{emoji.name}:
                      </span>
                      <button
                        onClick={() => deleteCustomEmoji(emoji.id)}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-discord-red p-0.5 rounded bg-black/60 transition-opacity"
                        title="Delete Emoji"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'members' && (
              <div className="space-y-2">
                <p className="text-xs text-discord-gray-400 mb-3">
                  Members registered in your private squad server.
                </p>
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2.5 bg-discord-sidebar rounded-lg border border-discord-darkest text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={member.avatarUrl}
                        alt={member.displayName}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div>
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <span>{member.displayName}</span>
                          {member.isAdmin && (
                            <span className="bg-discord-blurple text-[9px] text-white font-bold px-1 py-0.5 rounded">
                              ADMIN
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-discord-gray-400">
                          @{member.username} • {member.status}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'invites' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-discord-gray-400">
                    Active invite links for your friends to join SquadSpace.
                  </p>
                  <button
                    onClick={() => createInvite(currentUser.id)}
                    className="px-3 py-1.5 bg-discord-green hover:bg-discord-green-hover text-white text-xs font-semibold rounded transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Invite</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {invites.map((invite) => (
                    <div
                      key={invite.code}
                      className="flex items-center justify-between p-3 bg-discord-sidebar rounded-lg border border-discord-darkest text-xs"
                    >
                      <div>
                        <span className="font-mono text-sm text-discord-blurple-light font-bold block">
                          https://squadspace.app/invite/{invite.code}
                        </span>
                        <span className="text-discord-gray-400 text-[11px]">
                          Uses: {invite.uses} / {invite.maxUses || 'Unlimited'}
                        </span>
                      </div>

                      <button
                        onClick={() => handleCopyInvite(invite.code)}
                        className="px-3 py-1.5 bg-discord-blurple hover:bg-discord-blurple-hover text-white font-semibold rounded flex items-center gap-1.5 transition-colors"
                      >
                        {copiedCode === invite.code ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-discord-green" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
