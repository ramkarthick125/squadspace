import { create } from 'zustand';
import { Message, MessageAttachment, UserProfile } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { notificationService } from '../lib/notificationService';

interface ChatState {
  messagesByChannel: Record<string, Message[]>;
  replyingTo: Message | null;
  typingUsersByChannel: Record<string, string[]>;
  setReplyingTo: (message: Message | null) => void;
  fetchChannelMessages: (channelId: string) => Promise<void>;
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

const STORAGE_KEY = 'squadspace_messages_v2';

function getInitialMessages(): Record<string, Message[]> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (err) {
    console.warn('Failed to parse saved messages:', err);
  }
  return {};
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

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

const chatBroadcast = typeof window !== 'undefined' ? new BroadcastChannel('squadspace_chat_sync') : null;

export const useChatStore = create<ChatState>((set, get) => {
  if (chatBroadcast) {
    chatBroadcast.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      const { messagesByChannel } = get();

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

          notificationService.notify({
            title: `#${channelId} — ${message.sender?.displayName || 'New message'}`,
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

    fetchChannelMessages: async (channelId: string) => {
      if (!channelId) return;

      if (isSupabaseConfigured && supabase) {
        try {
          const { data: dbMessages } = await supabase
            .from('messages')
            .select(`
              id,
              channel_id,
              sender_id,
              content,
              attachments,
              reply_to_id,
              is_pinned,
              is_edited,
              created_at,
              profiles:sender_id (id, username, display_name, avatar_url, is_admin)
            `)
            .eq('channel_id', channelId)
            .order('created_at', { ascending: true });

          if (dbMessages) {
            const msgIds = dbMessages.map((m: any) => m.id);
            const { data: dbReactions } = await supabase
              .from('message_reactions')
              .select('*')
              .in('message_id', msgIds);

            const reactionsByMsg: Record<string, { emoji: string; users: string[]; count: number }[]> = {};
            (dbReactions || []).forEach((r: any) => {
              if (!reactionsByMsg[r.message_id]) reactionsByMsg[r.message_id] = [];
              const existing = reactionsByMsg[r.message_id].find((x) => x.emoji === r.emoji);
              if (existing) {
                existing.users.push(r.user_id);
                existing.count++;
              } else {
                reactionsByMsg[r.message_id].push({ emoji: r.emoji, users: [r.user_id], count: 1 });
              }
            });

            const parsed: Message[] = dbMessages.map((m: any) => {
              const profile = m.profiles || {};
              return {
                id: m.id,
                channelId: m.channel_id,
                senderId: m.sender_id,
                sender: {
                  id: profile.id || m.sender_id,
                  username: profile.username || 'user',
                  displayName: profile.display_name || profile.username || 'User',
                  avatarUrl: profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username || 'user'}`,
                  status: 'online',
                  isAdmin: Boolean(profile.is_admin),
                },
                content: m.content,
                attachments: m.attachments,
                replyTo: m.reply_to_id ? { id: m.reply_to_id, senderUsername: '', content: '' } : undefined,
                reactions: reactionsByMsg[m.id] || [],
                isPinned: Boolean(m.is_pinned),
                isEdited: Boolean(m.is_edited),
                createdAt: m.created_at,
              };
            });

            set((state) => ({
              messagesByChannel: {
                ...state.messagesByChannel,
                [channelId]: parsed,
              },
            }));
          }
        } catch (err) {
          console.warn('Failed to load messages from Supabase:', err);
        }
      }
    },

    sendMessage: async (channelId, content, currentUser, attachments) => {
      const { messagesByChannel, replyingTo } = get();
      const channelMsgs = messagesByChannel[channelId] || [];
      const newId = generateId();

      const newMessage: Message = {
        id: newId,
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

      if (chatBroadcast) {
        chatBroadcast.postMessage({
          type: 'new_message',
          channelId,
          message: newMessage,
        });
      }

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('messages').insert({
            id: newId,
            channel_id: channelId,
            sender_id: currentUser.id,
            content,
            attachments: attachments || [],
            reply_to_id: replyingTo?.id || null,
          });
        } catch (err) {
          console.error('Supabase message insert error:', err);
        }
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
        try {
          await supabase.from('messages').update({ content: newContent, is_edited: true }).eq('id', messageId);
        } catch (err) {
          console.error('Supabase message update error:', err);
        }
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
        try {
          await supabase.from('messages').delete().eq('id', messageId);
        } catch (err) {
          console.error('Supabase message delete error:', err);
        }
      }
    },

    toggleReaction: async (channelId, messageId, emoji, userId) => {
      const { messagesByChannel } = get();
      const channelMsgs = messagesByChannel[channelId] || [];

      let hasReacted = false;

      const updated = {
        ...messagesByChannel,
        [channelId]: channelMsgs.map((m) => {
          if (m.id !== messageId) return m;

          const existingReaction = m.reactions.find((r) => r.emoji === emoji);
          let newReactions;

          if (existingReaction) {
            hasReacted = existingReaction.users.includes(userId);
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
              newReactions = m.reactions.map((r) =>
                r.emoji === emoji
                  ? { ...r, users: [...r.users, userId], count: r.count + 1 }
                  : r
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

      if (isSupabaseConfigured && supabase) {
        try {
          if (hasReacted) {
            await supabase
              .from('message_reactions')
              .delete()
              .eq('message_id', messageId)
              .eq('user_id', userId)
              .eq('emoji', emoji);
          } else {
            await supabase.from('message_reactions').insert({
              message_id: messageId,
              user_id: userId,
              emoji,
            });
          }
        } catch (err) {
          console.error('Supabase reaction sync error:', err);
        }
      }
    },

    togglePin: async (channelId, messageId) => {
      const { messagesByChannel } = get();
      const channelMsgs = messagesByChannel[channelId] || [];

      let newPinState = false;
      const updated = {
        ...messagesByChannel,
        [channelId]: channelMsgs.map((m) => {
          if (m.id === messageId) {
            newPinState = !m.isPinned;
            return { ...m, isPinned: newPinState };
          }
          return m;
        }),
      };

      set({ messagesByChannel: updated });
      persistMessages(updated);

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('messages').update({ is_pinned: newPinState }).eq('id', messageId);
        } catch (err) {
          console.error('Supabase pin sync error:', err);
        }
      }
    },

    setTyping: (channelId, username, isTyping) => {
      const { typingUsersByChannel } = get();
      const currentTyping = typingUsersByChannel[channelId] || [];

      let updated;
      if (isTyping) {
        if (!currentTyping.includes(username)) {
          updated = [...currentTyping, username];
        } else {
          updated = currentTyping;
        }
      } else {
        updated = currentTyping.filter((u) => u !== username);
      }

      set({
        typingUsersByChannel: {
          ...typingUsersByChannel,
          [channelId]: updated,
        },
      });
    },
  };
});
