import React, { useState } from 'react';
import { X, Sparkles, ArrowRight, Compass } from 'lucide-react';
import { useServerStore } from '../../store/useServerStore';
import { useAuthStore } from '../../store/useAuthStore';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToJoin: () => void;
}

const EMOJI_OPTIONS = ['🚀', '🎮', '⚡', '🎧', '🍕', '👾', '🔥', '🏆', '💎', '🛡️', '🎯', '🌟'];

export const CreateServerModal: React.FC<CreateServerModalProps> = ({
  isOpen,
  onClose,
  onSwitchToJoin,
}) => {
  const { currentUser } = useAuthStore();
  const { createServer } = useServerStore();

  const [serverName, setServerName] = useState(
    currentUser ? `${currentUser.displayName}'s Server` : 'My Squad Server'
  );
  const [selectedEmoji, setSelectedEmoji] = useState('🚀');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverName.trim()) return;

    setError(null);
    setLoading(true);

    try {
      await createServer(serverName.trim(), selectedEmoji, currentUser?.id);
      setLoading(false);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create server');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm select-none p-4">
      <div className="w-full max-w-md bg-discord-chat rounded-xl border border-discord-darkest shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-discord-blurple-light" />
            <h2 className="font-bold text-discord-gray-100 text-lg">
              Create Your Server
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-discord-gray-400 hover:text-discord-gray-100 p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleCreate} className="p-6 space-y-5">
          <p className="text-xs text-discord-gray-300 leading-relaxed">
            Your server is where you and your friends hang out. Make yours and start talking in private voice & text channels.
          </p>

          {error && (
            <div className="p-3 bg-discord-red/10 border border-discord-red/30 rounded text-discord-red text-xs">
              {error}
            </div>
          )}

          {/* Emoji / Icon Selector */}
          <div>
            <label className="block text-[11px] font-bold text-discord-gray-400 uppercase tracking-wider mb-2">
              Server Icon
            </label>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-discord-blurple flex items-center justify-center text-2xl shadow-lg border border-discord-blurple-hover flex-shrink-0">
                {selectedEmoji}
              </div>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition ${
                      selectedEmoji === emoji
                        ? 'bg-discord-active border border-discord-blurple shadow'
                        : 'bg-discord-sidebar hover:bg-discord-hover'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Server Name */}
          <div>
            <label className="block text-[11px] font-bold text-discord-gray-400 uppercase tracking-wider mb-1.5">
              Server Name <span className="text-discord-red">*</span>
            </label>
            <input
              type="text"
              required
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="e.g. Squad Hangout, Gaming Crew"
              className="w-full bg-discord-input rounded-lg text-sm text-discord-gray-100 px-3 py-2.5 border border-discord-darkest focus:outline-none focus:border-discord-blurple"
            />
            <span className="text-[10px] text-discord-gray-500 mt-1 block">
              By creating a server, you agree to SquadSpace Community Guidelines.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchToJoin();
              }}
              className="text-xs text-discord-blurple-light hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Have an invite? Join a server</span>
            </button>

            <button
              type="submit"
              disabled={loading || !serverName.trim()}
              className="px-5 py-2.5 rounded-lg bg-discord-blurple hover:bg-discord-blurple-hover disabled:opacity-50 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>{loading ? 'Creating...' : 'Create Server'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
