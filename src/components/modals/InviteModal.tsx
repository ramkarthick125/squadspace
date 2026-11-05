import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Users, Sparkles } from 'lucide-react';
import { useServerStore } from '../../store/useServerStore';
import { useAuthStore } from '../../store/useAuthStore';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose }) => {
  const { invites, serverName, createInvite } = useServerStore();
  const { currentUser } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [activeCode, setActiveCode] = useState<string>('');

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm select-none p-4">
      <div className="w-full max-w-md bg-discord-chat rounded-xl border border-discord-darkest shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-discord-blurple-light" />
            <h2 className="font-bold text-discord-gray-100 text-base">
              Invite friends to {serverName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-discord-gray-400 hover:text-discord-gray-100 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-discord-gray-300">
            Send this invite code or link to your friends. Because SquadSpace is private, new users require a valid invite code to register.
          </p>

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
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-discord-sidebar/60 border border-discord-darkest text-xs">
            <div>
              <span className="text-discord-gray-400 block text-[11px]">Invite Code</span>
              <strong className="font-mono text-discord-blurple-light text-sm">{activeCode || 'Loading...'}</strong>
            </div>

            <button
              onClick={handleCreateNew}
              className="text-xs text-discord-gray-300 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded bg-discord-hover transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-discord-yellow" />
              Generate New
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
