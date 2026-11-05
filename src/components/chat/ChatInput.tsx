import React, { useState, useRef } from 'react';
import { PlusCircle, Image, Gift, Smile, Send, X, CornerDownRight } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useChatStore } from '../../store/useChatStore';
import { Channel, MessageAttachment } from '../../types';

interface ChatInputProps {
  channel: Channel;
  onOpenEmojiPicker: () => void;
  onOpenGifPicker: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  channel,
  onOpenEmojiPicker,
  onOpenGifPicker,
}) => {
  const { currentUser } = useAuthStore();
  const { sendMessage, replyingTo, setReplyingTo, setTyping } = useChatStore();

  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!text.trim() && attachments.length === 0) return;

    sendMessage(channel.id, text.trim(), currentUser, attachments);
    setText('');
    setAttachments([]);
    setTyping(channel.id, currentUser.username, false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const url = uploadEvent.target?.result as string;
      const newAttachment: MessageAttachment = {
        id: `att-${Date.now()}`,
        url,
        type: file.type.startsWith('image/') ? 'image' : 'file',
        name: file.name,
        size: file.size,
      };
      setAttachments((prev) => [...prev, newAttachment]);
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="p-4 pt-1 select-none">
      <div className="bg-discord-input rounded-lg border border-transparent focus-within:border-discord-blurple/50 shadow-inner">
        {/* Reply Preview Header */}
        {replyingTo && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#2b2d31] border-b border-discord-darkest/60 text-xs text-discord-gray-300 rounded-t-lg">
            <div className="flex items-center gap-2 truncate">
              <CornerDownRight className="w-3.5 h-3.5 text-discord-blurple" />
              <span>
                Replying to <strong className="text-discord-blurple-light">@{replyingTo.sender.username}</strong>
              </span>
              <span className="truncate text-discord-gray-400 max-w-md italic">
                "{replyingTo.content}"
              </span>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-discord-gray-400 hover:text-discord-gray-100 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="p-2 flex flex-wrap gap-2 border-b border-discord-darkest/60">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="relative bg-discord-sidebar p-1.5 rounded-lg border border-discord-darkest group"
              >
                <img src={att.url} alt={att.name} className="w-16 h-16 object-cover rounded" />
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="absolute -top-1.5 -right-1.5 bg-discord-red text-white rounded-full p-0.5 shadow hover:scale-110 transition-transform"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Main Input Row */}
        <div className="flex items-center px-3 py-2 gap-2">
          {/* File Upload Trigger */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload Image or File"
            className="text-discord-gray-400 hover:text-discord-gray-200 transition-colors p-1 rounded-full hover:bg-discord-hover"
          >
            <PlusCircle className="w-5 h-5" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*,video/*"
            className="hidden"
          />

          {/* Text Input */}
          <input
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setTyping(channel.id, currentUser.username, e.target.value.length > 0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channel.name}`}
            className="flex-1 bg-transparent text-sm text-discord-gray-100 placeholder-discord-gray-500 focus:outline-none"
          />

          {/* GIF Picker Trigger */}
          <button
            onClick={onOpenGifPicker}
            title="Search and Send GIF"
            className="text-xs font-bold px-1.5 py-0.5 bg-discord-sidebar hover:bg-discord-hover text-discord-gray-300 rounded transition-colors"
          >
            GIF
          </button>

          {/* Emoji Picker Trigger */}
          <button
            onClick={onOpenEmojiPicker}
            title="Open Emoji Picker"
            className="text-discord-gray-400 hover:text-discord-yellow transition-colors p-1 rounded-full hover:bg-discord-hover"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Send Button */}
          {(text.trim() || attachments.length > 0) && (
            <button
              onClick={handleSend}
              title="Send Message"
              className="text-discord-blurple hover:text-discord-blurple-light transition-colors p-1"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
