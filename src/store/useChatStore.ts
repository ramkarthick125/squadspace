import { create } from 'zustand';
import { Message, MessageAttachment, UserProfile } from '../types';
import { MOCK_MESSAGES } from '../mock/initialData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { notificationService } from '../lib/notificationService';

interface ChatState {
  messagesByChannel: Record<string, Message[]>;
  replyingTo: Message | null;
  typingUsersByChannel: Record<string, string[]>;
  setReplyingTo: (message: Message | null) => void;
  sendMessage: (
    channelId: string,
    content: string,
    currentUser: UserProfile,
    attachments?: MessageAttachment[]
  ) => Promise<void>;
  editMessage: (channelId: string, messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (channelId: string, messageId: string) => Promise<void>;
  toggleReaction: (channelId: string, messageId: string, emoji: string, userId: string) => Promise<void>;
  togglePin: (channelId: string, messageId: string) => Promise<void>;
  setTyping: (channelId: string, username: string, isTyping: boolean) => void;
}

const STORAGE_KEY = 'squadspace_messages_store_v1';

// Load persisted messages or fallback to default channels
function getInitialMessages(): Record<string, Message[]> {
  if (typeof window === 'undefined') return MOCK_MESSAGES;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (err) {
    console.warn('Failed to parse saved messages:', err);
  }
  return MOCK_MESSAGES;
}

function persistMessages(messages: Record<string, Message[]>) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (err) {
      console.warn('Storage quota note:', err);
    }
  }
}

// Inter-tab / local network sync channel
const chatBroadcast = typeof window !== 'undefined' ? new BroadcastChannel('squadspace_chat_sync') : null;

export const useChatStore = create<ChatState>((set, get) => {
  // Listen for real-time messages from other tabs/windows
  if (chatBroadcast) {
    chatBroadcast.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      const { messagesByChannel, typingUsersByChannel } = get();

      if (data.type === 'new_message') {
        const { channelId, message } = data;
        const current = messagesByChannel[channelId] || [];
        if (!current.some((m) => m.id === message.id)) {
          const updated = {
            ...messagesByChannel,
            [channelId]: [...current, message],
          };
          set({ messagesByChannel: updated });
          persistMessages(updated);

          // Play notification chime and notify
          notificationService.notify({
            title: `#${channelId} — ${message.sender.displayName}`,
            body: message.content || 'Sent an attachment',
            channelId,
          });
        }
      } else if (data.type === 'edit_message') {
        const { channelId, messageId, newContent } = data;
        const current = messagesByChannel[channelId] || [];
        const updated = {
          ...messagesByChannel,
          [channelId]: current.map((m) =>
            m.id === messageId ? { ...m, content: newContent, isEdited: true } : m
          ),
        };
        set({ messagesByChannel: updated });
        persistMessages(updated);
      } else if (data.type === 'delete_message') {
        const { channelId, messageId } = data;
        const current = messagesByChannel[channelId] || [];
        const updated = {
          ...messagesByChannel,
          [channelId]: current.filter((m) => m.id !== messageId),
        };
        set({ messagesByChannel: updated });
        persistMessages(updated);
      } else if (data.type === 'toggle_reaction') {
        const { channelId, messageId, emoji, userId } = data;
        get().toggleReaction(channelId, messageId, emoji, userId);
      } else if (data.type === 'typing') {
        const { channelId, username, isTyping } = data;
        get().setTyping(channelId, username, isTyping);
      }
    };
  }

  return {
    messagesByChannel: getInitialMessages(),
    replyingTo: null,
    typingUsersByChannel: {},

    setReplyingTo: (replyingTo) => set({ replyingTo }),

    sendMessage: async (channelId, content, currentUser, attachments) => {
      const { messagesByChannel, replyingTo } = get();
      const channelMsgs = messagesByChannel[channelId] || [];

      const newMessage: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        channelId,
        senderId: currentUser.id,
        sender: currentUser,
        content,
        attachments: attachments && attachments.length > 0 ? attachments : undefined,
        replyTo: replyingTo
          ? {
              id: replyingTo.id,
              senderUsername: replyingTo.sender.username,
              content: replyingTo.content,
            }
          : undefined,
        reactions: [],
        createdAt: new Date().toISOString(),
      };

      const updated = {
        ...messagesByChannel,
        [channelId]: [...channelMsgs, newMessage],
      };

      set({
        messagesByChannel: updated,
        replyingTo: null,
      });

      persistMessages(updated);

      // Broadcast to other open browser tabs
      if (chatBroadcast) {
        chatBroadcast.postMessage({
          type: 'new_message',
          channelId,
          message: newMessage,
        });
      }

      // Sync to Supabase if configured
      if (isSupabaseConfigured && supabase) {
        supabase
          .from('messages')
          .insert({
            id: newMessage.id.startsWith('msg-') ? undefined : newMessage.id,
            channel_id: channelId,
            sender_id: currentUser.id,
            content,
            attachments: attachments || [],
            reply_to_id: replyingTo?.id,
          })
          .then(({ error }) => {
            if (error) console.warn('Supabase message sync note:', error.message);
          });
      }
    },

    editMessage: async (channelId, messageId, newContent) => {
      const { messagesByChannel } = get();
      const channelMsgs = messagesByChannel[channelId] || [];

      const updated = {
        ...messagesByChannel,
        [channelId]: channelMsgs.map((m) =>
          m.id === messageId ? { ...m, content: newContent, isEdited: true } : m
        ),
      };

      set({ messagesByChannel: updated });
      persistMessages(updated);

      if (chatBroadcast) {
        chatBroadcast.postMessage({
          type: 'edit_message',
          channelId,
          messageId,
          newContent,
        });
      }

      if (isSupabaseConfigured && supabase) {
        supabase.from('messages').update({ content: newContent, is_edited: true }).eq('id', messageId);
      }
    },

    deleteMessage: async (channelId, messageId) => {
      const { messagesByChannel } = get();
      const channelMsgs = messagesByChannel[channelId] || [];

      const updated = {
        ...messagesByChannel,
        [channelId]: channelMsgs.filter((m) => m.id !== messageId),
      };

      set({ messagesByChannel: updated });
      persistMessages(updated);

      if (chatBroadcast) {
        chatBroadcast.postMessage({
          type: 'delete_message',
          channelId,
          messageId,
        });
      }

      if (isSupabaseConfigured && supabase) {
        supabase.from('messages').delete().eq('id', messageId);
      }
    },

    toggleReaction: async (channelId, messageId, emoji, userId) => {
      const { messagesByChannel } = get();
      const channelMsgs = messagesByChannel[channelId] || [];

      const updated = {
        ...messagesByChannel,
        [channelId]: channelMsgs.map((m) => {
          if (m.id !== messageId) return m;

          const existingReaction = m.reactions.find((r) => r.emoji === emoji);
          let newReactions;

          if (existingReaction) {
            const hasReacted = existingReaction.users.includes(userId);
            if (hasReacted) {
              const updatedUsers = existingReaction.users.filter((id) => id !== userId);
              if (updatedUsers.length === 0) {
                newReactions = m.reactions.filter((r) => r.emoji !== emoji);
              } else {
                newReactions = m.reactions.map((r) =>
                  r.emoji === emoji ? { ...r, users: updatedUsers, count: updatedUsers.length } : r
                );
              }
            } else {
              const updatedUsers = [...existingReaction.users, userId];
              newReactions = m.reactions.map((r) =>
                r.emoji === emoji ? { ...r, users: updatedUsers, count: updatedUsers.length } : r
              );
            }
          } else {
            newReactions = [...m.reactions, { emoji, users: [userId], count: 1 }];
          }

          return { ...m, reactions: newReactions };
        }),
      };

      set({ messagesByChannel: updated });
      persistMessages(updated);
    },

    togglePin: async (channelId, messageId) => {
      const { messagesByChannel } = get();
      const channelMsgs = messagesByChannel[channelId] || [];

      const updated = {
        ...messagesByChannel,
        [channelId]: channelMsgs.map((m) =>
          m.id === messageId ? { ...m, isPinned: !m.isPinned } : m
        ),
      };

      set({ messagesByChannel: updated });
      persistMessages(updated);
    },

    setTyping: (channelId, username, isTyping) => {
      const { typingUsersByChannel } = get();
      const current = typingUsersByChannel[channelId] || [];

      let updated: string[];
      if (isTyping) {
        updated = current.includes(username) ? current : [...current, username];
      } else {
        updated = current.filter((u) => u !== username);
      }

      set({
        typingUsersByChannel: {
          ...typingUsersByChannel,
          [channelId]: updated,
        },
      });

      if (chatBroadcast && isTyping) {
        chatBroadcast.postMessage({
          type: 'typing',
          channelId,
          username,
          isTyping,
        });
      }
    },
  };
});
