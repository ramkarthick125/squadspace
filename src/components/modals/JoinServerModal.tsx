import React, { useState, useEffect } from 'react';
import { X, Key, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { authService } from '../../lib/authService';
import { useAuthStore } from '../../store/useAuthStore';
import { useServerStore } from '../../store/useServerStore';

interface JoinServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string;
}

export const JoinServerModal: React.FC<JoinServerModalProps> = ({ isOpen, onClose, initialCode }) => {
  const { currentUser } = useAuthStore();
  const { fetchServerData, setActiveView } = useServerStore();
  const [inviteCode, setInviteCode] = useState(initialCode || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (initialCode) {
      setInviteCode(initialCode);
    }
  }, [initialCode]);

  if (!isOpen) return null;

  const extractCode = (raw: string): string => {
    let clean = raw.trim();
    if (clean.includes('invite=')) {
      clean = clean.split('invite=')[1].split('&')[0];
    } else if (clean.includes('/')) {
      const parts = clean.split('/').filter(Boolean);
      clean = parts[parts.length - 1];
    }
    return clean;
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = extractCode(inviteCode);
    if (!code || !currentUser) return;

    setError(null);
    setLoading(true);

    const res = await authService.joinServerWithCode(code, currentUser.id);
    setLoading(false);

    if (res.success) {
      setSuccess(true);
      await fetchServerData(res.serverId);
      setActiveView('server');
      setTimeout(() => {
        setSuccess(false);
        setInviteCode('');
        onClose();
      }, 1000);
    } else {
      setError(res.error || 'Invalid or expired invite code.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm select-none p-4">
      <div className="w-full max-w-md bg-discord-chat rounded-xl border border-discord-darkest shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-discord-green" />
            <h2 className="font-bold text-discord-gray-100 text-base">
              Join a Server
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-discord-gray-400 hover:text-discord-gray-100 p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleJoin} className="p-6 space-y-4">
          <p className="text-xs text-discord-gray-300">
            Enter an invite code or paste an invite link below to join your friend's private SquadSpace server.
          </p>

          {error && (
            <div className="p-3 bg-discord-red/10 border border-discord-red/30 rounded text-discord-red text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-discord-green/10 border border-discord-green/30 rounded text-discord-green text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Successfully joined server! Loading channels...</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-discord-gray-400 uppercase tracking-wider mb-2">
              Invite Code or Link <span className="text-discord-red">*</span>
            </label>
            <div className="relative flex items-center bg-discord-input rounded-lg border border-transparent focus-within:border-discord-green">
              <input
                type="text"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="e.g. sqd-a1b2c3 or https://..."
                className="w-full bg-transparent text-sm text-discord-gray-100 px-3 py-2.5 font-mono uppercase focus:outline-none"
              />
            </div>
            <span className="text-[10px] text-discord-gray-500 mt-1 block">
              Invites look like <strong className="font-mono text-discord-gray-400">sqd-xxxxxx</strong> or full links.
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-discord-gray-300 hover:underline cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-discord-green hover:bg-discord-green/90 disabled:opacity-50 text-white font-bold text-xs shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>{loading ? 'Joining...' : 'Join Server'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
