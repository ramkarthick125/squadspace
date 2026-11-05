import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import { useServerStore } from '../../store/useServerStore';

interface EmojiPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}

const STANDARD_EMOJIS = [
  '😀', '😂', '🤣', '😍', '😎', '🥳', '🤔', '😴',
  '🔥', '🎉', '🚀', '❤️', '👍', '👎', '👀', '✨',
  '🎮', '👾', '🎧', '🕹️', '🏆', '💯', '💀', '💩',
  '🍕', '🍔', '🍟', '🍜', '☕', '🍻', '🍿', '🧁',
  '⚡', '🌟', '🌙', '🌈', '💪', '🙏', '👏', '🤝',
];

export const EmojiPickerModal: React.FC<EmojiPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
}) => {
  const { customEmojis } = useServerStore();
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm select-none p-4">
      <div className="w-full max-w-sm bg-discord-chat rounded-xl border border-discord-darkest shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
        {/* Header */}
        <div className="h-12 px-3 border-b border-discord-darkest/60 flex items-center justify-between">
          <span className="text-sm font-bold text-discord-gray-200">Emoji Picker</span>
          <button
            onClick={onClose}
            className="text-discord-gray-400 hover:text-discord-gray-100 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {/* Custom Server Emojis Section */}
          {customEmojis.length > 0 && (
            <div>
              <span className="text-xs font-bold text-discord-gray-400 uppercase tracking-wider block mb-2">
                Server Custom Emojis
              </span>
              <div className="grid grid-cols-6 gap-2">
                {customEmojis.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => {
                      onSelectEmoji(`:${e.name}:`);
                      onClose();
                    }}
                    title={`:${e.name}:`}
                    className="p-1.5 rounded hover:bg-discord-hover flex items-center justify-center transition-colors"
                  >
                    <img src={e.imageUrl} alt={e.name} className="w-6 h-6 object-contain" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Standard Emojis */}
          <div>
            <span className="text-xs font-bold text-discord-gray-400 uppercase tracking-wider block mb-2">
              Standard Emojis
            </span>
            <div className="grid grid-cols-6 gap-1 text-2xl">
              {STANDARD_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onSelectEmoji(emoji);
                    onClose();
                  }}
                  className="p-1.5 rounded hover:bg-discord-hover flex items-center justify-center hover:scale-110 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
