import React, { useState } from 'react';
import {
  Smile,
  Reply,
  Pin,
  Pencil,
  Trash2,
  CornerDownRight,
  Shield,
  Check,
  X,
} from 'lucide-react';
import { Message, UserProfile } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { useChatStore } from '../../store/useChatStore';

interface ChatMessageItemProps {
  message: Message;
  channelId: string;
  onOpenEmojiPickerForMessage?: (messageId: string) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  channelId,
  onOpenEmojiPickerForMessage,
}) => {
  const { currentUser } = useAuthStore();
  const { editMessage, deleteMessage, toggleReaction, setReplyingTo, togglePin } = useChatStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const isAuthor = message.senderId === currentUser.id;
  const canDelete = isAuthor || currentUser.isAdmin;

  const handleSaveEdit = () => {
    if (editContent.trim()) {
      editMessage(channelId, message.id, editContent.trim());
      setIsEditing(false);
    }
  };

  const handleKeyDownEdit = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditContent(message.content);
    }
  };

  // Quick reactions shortcuts
  const quickReactions = ['👍', '❤️', '🔥', '😂'];

  return (
    <div className="relative group px-4 py-1.5 hover:bg-discord-hover/40 transition-colors flex gap-4 select-text">
      {/* Replying To Header Reference */}
      {message.replyTo && (
        <div className="absolute -top-3.5 left-10 flex items-center gap-1.5 text-xs text-discord-gray-400 select-none">
          <CornerDownRight className="w-3.5 h-3.5 text-discord-gray-500" />
          <span className="font-semibold text-discord-blurple-light">
            @{message.replyTo.senderUsername}
          </span>
          <span className="truncate max-w-sm text-discord-gray-400">
            {message.replyTo.content}
          </span>
        </div>
      )}

      {/* Sender Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        <img
          src={message.sender.avatarUrl}
          alt={message.sender.displayName}
          className="w-10 h-10 rounded-full object-cover"
        />
      </div>

      {/* Message Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 leading-none mb-1">
          <span className="font-semibold text-sm text-discord-gray-100 hover:underline cursor-pointer">
            {message.sender.displayName}
          </span>

          {message.sender.isAdmin && (
            <span className="bg-discord-blurple text-[10px] text-white font-bold px-1 py-0.2 rounded" title="Administrator">
              ADMIN
            </span>
          )}

          <span className="text-[11px] text-discord-gray-500 select-none">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>

          {message.isPinned && (
            <span className="text-discord-yellow flex items-center gap-0.5 text-[11px] font-medium" title="Pinned Message">
              <Pin className="w-3 h-3 fill-discord-yellow" />
            </span>
          )}
        </div>

        {/* Message Content or Edit Input */}
        {isEditing ? (
          <div className="mt-1 space-y-1">
            <input
              type="text"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDownEdit}
              className="w-full bg-discord-input text-sm text-discord-gray-100 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-discord-blurple"
              autoFocus
            />
            <div className="text-[11px] text-discord-gray-400 flex items-center gap-2">
              <span>escape to <strong className="text-discord-blurple cursor-pointer" onClick={() => setIsEditing(false)}>cancel</strong> • enter to <strong className="text-discord-green cursor-pointer" onClick={handleSaveEdit}>save</strong></span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-discord-gray-200 break-words leading-relaxed selectable-text">
            {message.content}
            {message.isEdited && (
              <span className="text-[10px] text-discord-gray-500 ml-1.5 select-none">
                (edited)
              </span>
            )}
          </p>
        )}

        {/* Image Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((att) => (
              <div key={att.id} className="relative rounded-lg overflow-hidden border border-discord-darkest max-w-md">
                <img
                  src={att.url}
                  alt={att.name}
                  className="max-h-72 object-contain rounded-lg"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}

        {/* Emoji Reactions List */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 select-none">
            {message.reactions.map((reaction) => {
              const hasReacted = reaction.users.includes(currentUser.id);
              return (
                <button
                  key={reaction.emoji}
                  onClick={() => toggleReaction(channelId, message.id, reaction.emoji, currentUser.id)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border transition-colors ${
                    hasReacted
                      ? 'bg-discord-blurple/20 border-discord-blurple text-discord-blurple-light'
                      : 'bg-discord-sidebar/60 border-transparent hover:bg-discord-sidebar text-discord-gray-300'
                  }`}
                >
                  <span>{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Hover Action Bar */}
      <div className="absolute right-4 -top-3 hidden group-hover:flex items-center bg-[#2b2d31] border border-[#232428] rounded-md shadow-md overflow-hidden z-10 select-none">
        {/* Quick Emojis */}
        {quickReactions.slice(0, 2).map((emoji) => (
          <button
            key={emoji}
            onClick={() => toggleReaction(channelId, message.id, emoji, currentUser.id)}
            className="p-1.5 hover:bg-discord-hover text-sm hover:text-white transition-colors"
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}

        <button
          onClick={() => onOpenEmojiPickerForMessage && onOpenEmojiPickerForMessage(message.id)}
          className="p-1.5 hover:bg-discord-hover text-discord-gray-300 hover:text-white transition-colors"
          title="Add Reaction"
        >
          <Smile className="w-4 h-4" />
        </button>

        <button
          onClick={() => setReplyingTo(message)}
          className="p-1.5 hover:bg-discord-hover text-discord-gray-300 hover:text-white transition-colors"
          title="Reply"
        >
          <Reply className="w-4 h-4" />
        </button>

        <button
          onClick={() => togglePin(channelId, message.id)}
          className={`p-1.5 hover:bg-discord-hover transition-colors ${
            message.isPinned ? 'text-discord-yellow' : 'text-discord-gray-300 hover:text-white'
          }`}
          title={message.isPinned ? 'Unpin Message' : 'Pin Message'}
        >
          <Pin className="w-4 h-4" />
        </button>

        {isAuthor && (
          <button
            onClick={() => setIsEditing(true)}
            className="p-1.5 hover:bg-discord-hover text-discord-gray-300 hover:text-white transition-colors"
            title="Edit Message"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}

        {canDelete && (
          <button
            onClick={() => deleteMessage(channelId, message.id)}
            className="p-1.5 hover:bg-discord-hover text-discord-red transition-colors"
            title="Delete Message"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
