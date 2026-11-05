import React, { useEffect, useRef } from 'react';
import { Hash, Sparkles } from 'lucide-react';
import { Channel } from '../../types';
import { useChatStore } from '../../store/useChatStore';
import { ChatMessageItem } from './ChatMessageItem';
import { ChatInput } from './ChatInput';

interface ChatAreaProps {
  channel: Channel;
  onOpenEmojiPicker: () => void;
  onOpenGifPicker: () => void;
  onOpenEmojiPickerForMessage?: (messageId: string) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  channel,
  onOpenEmojiPicker,
  onOpenGifPicker,
  onOpenEmojiPickerForMessage,
}) => {
  const { messagesByChannel, typingUsersByChannel } = useChatStore();
  const messages = messagesByChannel[channel.id] || [];
  const typingUsers = typingUsersByChannel[channel.id] || [];

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="flex-1 flex flex-col bg-discord-chat min-w-0 h-full overflow-hidden">
      {/* Scrollable Messages Area */}
      <div className="flex-1 overflow-y-auto px-1 py-4 space-y-4">
        {/* Welcome Channel Banner */}
        <div className="px-4 pt-6 pb-2 select-none">
          <div className="w-16 h-16 rounded-full bg-discord-sidebar flex items-center justify-center mb-3">
            <Hash className="w-10 h-10 text-discord-gray-300" />
          </div>
          <h2 className="text-2xl font-bold text-discord-gray-100">
            Welcome to #{channel.name}!
          </h2>
          <p className="text-sm text-discord-gray-400 mt-1">
            {channel.topic || `This is the start of the #${channel.name} channel.`}
          </p>
          <div className="mt-4 border-b border-discord-divider/60" />
        </div>

        {/* Message Items */}
        <div className="space-y-1">
          {messages.map((message) => (
            <ChatMessageItem
              key={message.id}
              message={message}
              channelId={channel.id}
              onOpenEmojiPickerForMessage={onOpenEmojiPickerForMessage}
            />
          ))}
        </div>

        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      <div className="h-5 px-4 text-xs text-discord-gray-400 italic flex items-center gap-1.5 select-none">
        {typingUsers.length > 0 && (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-discord-blurple animate-ping" />
            <span>
              <strong>{typingUsers.join(', ')}</strong> {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          </>
        )}
      </div>

      {/* Chat Input */}
      <ChatInput
        channel={channel}
        onOpenEmojiPicker={onOpenEmojiPicker}
        onOpenGifPicker={onOpenGifPicker}
      />
    </div>
  );
};
