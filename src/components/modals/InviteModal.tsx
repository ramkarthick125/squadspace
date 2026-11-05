import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Users, Sparkles, Send, UserCheck, MessageSquare } from 'lucide-react';
import { useServerStore } from '../../store/useServerStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useDMStore } from '../../store/useDMStore';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose }) => {
  const { invites, serverName, createInvite, members } = useServerStore();
  const { currentUser } = useAuthStore();
  const { friends, sendServerInviteDM, addFriendByUsername } = useDMStore();

  const [copied, setCopied] = useState(false);
  const [activeCode, setActiveCode] = useState<string>('');
  const [sentToUserIds, setSentToUserIds] = useState<Record<string, boolean>>({});
  const [directUsername, setDirectUsername] = useState('');
  const [sendingDirect, setSendingDirect] = useState(false);
  const [directMessageStatus, setDirectMessageStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (invites.length > 0) {
        setActiveCode(invites[0].code);
      } else if (currentUser) {
        createInvite(currentUser.id).then((inv) => setActiveCode(inv.code));
      }
    }
  }, [isOpen, invites.length, currentUser]);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://squadspace.app';
  const inviteUrl = `${currentOrigin}/?invite=${activeCode || 'squad'}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateNew = async () => {
    if (!currentUser) return;
    const newInv = await createInvite(currentUser.id);
    setActiveCode(newInv.code);
  };

  const handleSendDMToFriend = (friend: any) => {
    if (!currentUser || !activeCode) return;
    sendServerInviteDM(friend, activeCode, currentUser, serverName);
    setSentToUserIds((prev) => ({ ...prev, [friend.id]: true }));
  };

  const handleSendDirectToUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directUsername.trim() || !currentUser || !activeCode) return;
    setSendingDirect(true);
    setDirectMessageStatus(null);

    const res = await addFriendByUsername(directUsername.trim(), currentUser);
    setSendingDirect(false);

    if (res.success && res.friend) {
      sendServerInviteDM(res.friend, activeCode, currentUser, serverName);
      setSentToUserIds((prev) => ({ ...prev, [res.friend!.id]: true }));
      setDirectMessageStatus(`Sent invite DM to @${res.friend.username}!`);
      setDirectUsername('');
    } else {
      setDirectMessageStatus(res.error || 'User not found. Ask them to register first or share the link above.');
    }
  };

  // Friends or contacts available to DM
  const dmContacts = [
    ...friends,
    ...members.filter((m) => m.id !== currentUser?.id && !friends.some((f) => f.id === m.id)),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm select-none p-4">
      <div className="w-full max-w-lg bg-discord-chat rounded-xl border border-discord-darkest shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 pb-2 flex items-center justify-between border-b border-discord-darkest/40 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-discord-blurple-light" />
            <h2 className="font-bold text-discord-gray-100 text-base">
              Invite Friends to {serverName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-discord-gray-400 hover:text-discord-gray-100 p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <p className="text-xs text-discord-gray-300 leading-relaxed">
            Send an invite code or link to your friends. Because SquadSpace is a private squad platform, new members use this code to join your server.
          </p>

          {/* Copy Invite Link */}
          <div>
            <label className="block text-[11px] font-bold text-discord-gray-400 uppercase tracking-wider mb-2">
              Server Invite Link
            </label>
            <div className="flex items-center bg-discord-input rounded-lg p-1.5 border border-discord-darkest">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 bg-transparent text-xs text-discord-gray-200 px-2 font-mono focus:outline-none truncate"
              />
              <button
                onClick={handleCopy}
                className="px-4 py-1.5 rounded bg-discord-blurple hover:bg-discord-blurple-hover text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? (
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
          </div>

          {/* Invite Code Box */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-discord-sidebar/60 border border-discord-darkest text-xs">
            <div>
              <span className="text-discord-gray-400 block text-[11px]">Invite Code</span>
              <strong className="font-mono text-discord-blurple-light text-base tracking-wider">{activeCode || 'Loading...'}</strong>
            </div>

            <button
              onClick={handleCreateNew}
              className="text-xs text-discord-gray-300 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded bg-discord-hover transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-discord-yellow" />
              Generate New Code
            </button>
          </div>

          {/* Section: Send Direct Message (DM) to Friends */}
          <div className="pt-2 border-t border-discord-darkest/50">
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-[11px] font-bold text-discord-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-discord-green" />
                <span>Send Server Invite in Direct Message (DM)</span>
              </label>
              <span className="text-[10px] text-discord-gray-500">Instant in-chat card</span>
            </div>

            {/* Quick DM Form by Username */}
            <form onSubmit={handleSendDirectToUsername} className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Enter friend's username (e.g. alex)"
                value={directUsername}
                onChange={(e) => setDirectUsername(e.target.value)}
                className="flex-1 bg-discord-input text-xs text-discord-gray-100 placeholder-discord-gray-500 rounded-lg px-3 py-2 border border-discord-darkest focus:outline-none focus:border-discord-blurple"
              />
              <button
                type="submit"
                disabled={sendingDirect || !directUsername.trim()}
                className="px-3.5 py-2 rounded-lg bg-discord-blurple hover:bg-discord-blurple-hover disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sendingDirect ? 'Sending...' : 'Send DM'}</span>
              </button>
            </form>

            {directMessageStatus && (
              <p className={`text-xs mb-3 ${directMessageStatus.includes('Sent') ? 'text-discord-green' : 'text-discord-yellow'}`}>
                {directMessageStatus}
              </p>
            )}

            {/* Friends / Contacts List */}
            {dmContacts.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {dmContacts.map((contact) => {
                  const isSent = Boolean(sentToUserIds[contact.id]);

                  return (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-discord-sidebar/40 hover:bg-discord-sidebar/80 border border-discord-darkest/60 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={contact.avatarUrl}
                          alt={contact.displayName}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-white truncate">
                            {contact.displayName}
                          </div>
                          <div className="text-[10px] text-discord-gray-400 truncate">
                            @{contact.username}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleSendDMToFriend(contact)}
                        disabled={isSent}
                        className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                          isSent
                            ? 'bg-discord-green/20 text-discord-green border border-discord-green/30 cursor-default'
                            : 'bg-discord-blurple hover:bg-discord-blurple-hover text-white'
                        }`}
                      >
                        {isSent ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Sent in DM</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Send Invite</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-3 bg-discord-sidebar/20 rounded-lg border border-discord-darkest/40">
                <p className="text-xs text-discord-gray-400">
                  No friends added yet. Type a username above or share the link to get your squad connected!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
