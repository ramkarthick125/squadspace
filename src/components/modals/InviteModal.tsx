import React, { useState } from 'react';
import { X, Copy, Check, Users } from 'lucide-react';
import { useServerStore } from '../../store/useServerStore';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose }) => {
  const { invites, serverName } = useServerStore();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const activeInvite = invites[0] || { code: 'squad-private-2026' };
  const inviteUrl = `https://squadspace.app/invite/${activeInvite.code}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            Send this link to a friend to grant them access to this private server. SquadSpace registration is invite-only.
          </p>

          <div>
            <label className="block text-[11px] font-bold text-discord-gray-400 uppercase tracking-wider mb-2">
              Send a Server Invite Link
            </label>
            <div className="flex items-center bg-discord-input rounded-lg p-1.5 border border-discord-darkest">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 bg-transparent text-xs text-discord-gray-200 px-2 font-mono focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="px-4 py-1.5 rounded bg-discord-blurple hover:bg-discord-blurple-hover text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
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

          <div className="text-[11px] text-discord-gray-400 flex items-center justify-between">
            <span>Invite code: <strong className="font-mono text-discord-blurple-light">{activeInvite.code}</strong></span>
            <span>Never expires</span>
          </div>
        </div>
      </div>
    </div>
  );
};
