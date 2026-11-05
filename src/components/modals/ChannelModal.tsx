import React, { useState } from 'react';
import { X, Hash, Volume2, Lock } from 'lucide-react';
import { useServerStore } from '../../store/useServerStore';
import { ChannelType } from '../../types';

interface ChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategoryId?: string;
  defaultType?: ChannelType;
}

export const ChannelModal: React.FC<ChannelModalProps> = ({
  isOpen,
  onClose,
  defaultCategoryId,
  defaultType = 'text',
}) => {
  const { categories, addChannel, setActiveChannel } = useServerStore();

  const [type, setType] = useState<ChannelType>(defaultType);
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [categoryId, setCategoryId] = useState(defaultCategoryId || categories[0]?.id || '');
  const [isPrivate, setIsPrivate] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newChannel = await addChannel({
      name: name.trim(),
      type,
      categoryId: categoryId || undefined,
      topic: topic.trim(),
      isPrivate,
    });

    setActiveChannel(newChannel.id);
    setName('');
    setTopic('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm select-none p-4">
      <div className="w-full max-w-md bg-discord-chat rounded-xl border border-discord-darkest shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-14 px-6 flex items-center justify-between border-b border-discord-darkest/60">
          <h2 className="font-bold text-discord-gray-100 text-base">Create Channel</h2>
          <button
            onClick={onClose}
            className="text-discord-gray-400 hover:text-discord-gray-100 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Channel Type Selector */}
          <div>
            <label className="block text-xs font-bold text-discord-gray-300 uppercase tracking-wider mb-2">
              Channel Type
            </label>
            <div className="space-y-2">
              <div
                onClick={() => setType('text')}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  type === 'text'
                    ? 'bg-discord-active border-discord-blurple text-white'
                    : 'bg-discord-sidebar border-transparent hover:bg-discord-hover text-discord-gray-300'
                }`}
              >
                <Hash className="w-6 h-6 text-discord-gray-400 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">Text</div>
                  <div className="text-xs text-discord-gray-400">
                    Post images, GIFs, emojis, and game discussions
                  </div>
                </div>
                <input
                  type="radio"
                  name="channelType"
                  checked={type === 'text'}
                  onChange={() => setType('text')}
                  className="accent-discord-blurple"
                />
              </div>

              <div
                onClick={() => setType('voice')}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  type === 'voice'
                    ? 'bg-discord-active border-discord-blurple text-white'
                    : 'bg-discord-sidebar border-transparent hover:bg-discord-hover text-discord-gray-300'
                }`}
              >
                <Volume2 className="w-6 h-6 text-discord-gray-400 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">Voice</div>
                  <div className="text-xs text-discord-gray-400">
                    Hang out together with voice audio and screen share
                  </div>
                </div>
                <input
                  type="radio"
                  name="channelType"
                  checked={type === 'voice'}
                  onChange={() => setType('voice')}
                  className="accent-discord-blurple"
                />
              </div>
            </div>
          </div>

          {/* Channel Name */}
          <div>
            <label className="block text-xs font-bold text-discord-gray-300 uppercase tracking-wider mb-2">
              Channel Name
            </label>
            <div className="relative flex items-center bg-discord-input rounded">
              <span className="pl-3 text-discord-gray-400">
                {type === 'text' ? '#' : <Volume2 className="w-4 h-4" />}
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="new-channel"
                className="w-full bg-transparent text-discord-gray-100 p-2.5 text-sm focus:outline-none"
                autoFocus
              />
            </div>
          </div>

          {/* Category Select */}
          <div>
            <label className="block text-xs font-bold text-discord-gray-300 uppercase tracking-wider mb-2">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-discord-input text-discord-gray-100 rounded p-2.5 text-sm focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Channel Topic */}
          <div>
            <label className="block text-xs font-bold text-discord-gray-300 uppercase tracking-wider mb-2">
              Topic (Optional)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What is this channel about?"
              className="w-full bg-discord-input text-discord-gray-100 rounded p-2 text-sm focus:outline-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-discord-darkest/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-discord-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-5 py-2 rounded bg-discord-blurple hover:bg-discord-blurple-hover disabled:opacity-50 text-white text-xs font-semibold shadow transition-colors"
            >
              Create Channel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
