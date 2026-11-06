import { create } from 'zustand';
import { Conversation, Message, MessageAttachment, UserProfile } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { notificationService } from '../lib/notificationService';
import { sounds } from '../lib/soundEffects';
import { realtimeService } from '../lib/realtimeService';
import { useServerStore } from './useServerStore';

export function getDeterministicDMId(userId1: string, userId2: string): string {
  const sorted = [userId1, userId2].sort();
  return `dm_${sorted[0]}_${sorted[1]}`;
}

interface DMState {
  conversations: Conversation[];
  activeConversationId: string | null;
  dmMessages: Record<string, Message[]>;
  friends: UserProfile[];

  initDMStore: (currentUser: UserProfile) => void;
  setActiveConversation: (conversationId: string | null) => void;
  startOrOpenDM: (friend: UserProfile, currentUser: UserProfile) => string;
  sendDM: (
    conversationId: string,
    content: string,
    currentUser: UserProfile,
    attachments?: MessageAttachment[],
    recipientId?: string
  ) => void;
  receiveIncomingDM: (
    message: Message,
    conversationId: string,
    senderProfile: UserProfile
  ) => void;
  receiveFriendRequest: (senderProfile: UserProfile) => void;
  sendServerInviteDM: (
    friend: UserProfile,
    inviteCode: string,
    currentUser: UserProfile,
    serverName?: string
  ) => string;
  sendFriendRequestDM: (
    friend: UserProfile,
    currentUser: UserProfile
  ) => string;
  editDM: (conversationId: string, messageId: string, content: string, currentUserId: string, recipientId?: string) => void;
  deleteDM: (conversationId: string, messageId: string, currentUserId: string, recipientId?: string) => void;
  toggleDMReaction: (conversationId: string, messageId: string, emoji: string, userId: string, recipientId?: string) => void;
  receiveDMEdit: (conversationId: string, messageId: string, content: string) => void;
  receiveDMDelete: (conversationId: string, messageId: string) => void;
  receiveDMReaction: (conversationId: string, messageId: string, emoji: string, userId: string) => void;
  removeFriend: (userId: string, currentUserId?: string) => void;
  addFriendByUsername: (
    username: string,
    currentUser?: UserProfile | null
  ) => Promise<{ success: boolean; error?: string; friend?: UserProfile }>;
}

const DM_STORAGE_KEY = 'squadspace_dm_v2';

function getInitialDMMessages(): Record<string, Message[]> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(DM_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (err) {
    console.warn('Failed to parse saved DMs:', err);
  }
  return {};
}

function persistDMs(msgs: Record<string, Message[]>) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(DM_STORAGE_KEY, JSON.stringify(msgs));
    } catch {}
  }
}

export const useDMStore = create<DMState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  dmMessages: getInitialDMMessages(),
  friends: [],

  initDMStore: (currentUser: UserProfile) => {
    if (!currentUser || typeof window === 'undefined') return;

    // Load saved conversations for this user
    try {
      const savedConvos = localStorage.getItem(`squadspace_conversations_${currentUser.id}`);
      if (savedConvos) {
        set({ conversations: JSON.parse(savedConvos) });
      }
    } catch {}

    // Load saved friends for this user
    try {
      const savedFriends = localStorage.getItem(`squadspace_friends_${currentUser.id}`);
      if (savedFriends) {
        set({ friends: JSON.parse(savedFriends) });
      }
    } catch {}
  },

  setActiveConversation: (conversationId) => set({ activeConversationId: conversationId }),

  startOrOpenDM: (friend, currentUser) => {
    const convoId = getDeterministicDMId(currentUser.id, friend.id);
    const { conversations } = get();
    const existing = conversations.find((c) => c.id === convoId);

    // Ensure friend is in friends list
    const currentFriends = get().friends;
    if (!currentFriends.some((f) => f.id === friend.id)) {
      const updatedFriends = [...currentFriends, friend];
      set({ friends: updatedFriends });
      try {
        localStorage.setItem(`squadspace_friends_${currentUser.id}`, JSON.stringify(updatedFriends));
      } catch {}
    }

    if (existing) {
      set({ activeConversationId: convoId });
      return convoId;
    }

    const newConvo: Conversation = {
      id: convoId,
      isGroup: false,
      name: friend.displayName || friend.username,
      members: [friend, currentUser],
      unreadCount: 0,
    };

    const updatedConvos = [newConvo, ...conversations.filter((c) => c.id !== convoId)];
    set({
      conversations: updatedConvos,
      activeConversationId: convoId,
    });

    try {
      localStorage.setItem(`squadspace_conversations_${currentUser.id}`, JSON.stringify(updatedConvos));
    } catch {}

    return convoId;
  },

  sendDM: (conversationId, content, currentUser, attachments, recipientId) => {
    const currentMsgs = get().dmMessages[conversationId] || [];
    const newMsg: Message = {
      id: `dm-msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      conversationId,
      senderId: currentUser.id,
      sender: currentUser,
      content,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
      reactions: [],
      createdAt: new Date().toISOString(),
    };

    const updatedMsgs = {
      ...get().dmMessages,
      [conversationId]: [...currentMsgs, newMsg],
    };

    const updatedConvos = get().conversations.map((c) =>
      c.id === conversationId ? { ...c, lastMessage: newMsg } : c
    );

    set({
      dmMessages: updatedMsgs,
      conversations: updatedConvos,
    });

    persistDMs(updatedMsgs);
    try {
      localStorage.setItem(`squadspace_conversations_${currentUser.id}`, JSON.stringify(updatedConvos));
    } catch {}

    // Find recipient ID if not explicitly provided
    let targetRecipientId = recipientId;
    if (!targetRecipientId) {
      const convo = get().conversations.find((c) => c.id === conversationId);
      const otherMember = convo?.members.find((m) => m.id !== currentUser.id);
      if (otherMember) {
        targetRecipientId = otherMember.id;
      } else if (conversationId.startsWith('dm_')) {
        const parts = conversationId.replace('dm_', '').split('_');
        targetRecipientId = parts.find((id) => id !== currentUser.id);
      }
    }

    // Play instant sound
    sounds.playMessagePop();

    // 1. Broadcast in real time across the internet & tabs
    realtimeService.broadcastDM(newMsg, conversationId, targetRecipientId || '', currentUser);

    // 2. Also save to Supabase direct_messages if possible
    if (isSupabaseConfigured && supabase) {
      Promise.resolve(
        supabase.from('direct_messages').insert({
          conversation_id: null,
          sender_id: currentUser.id,
          content,
          attachments: attachments || [],
        })
      ).catch(() => {});
    }
  },

  receiveIncomingDM: (message, conversationId, senderProfile) => {
    const currentMsgs = get().dmMessages[conversationId] || [];
    if (currentMsgs.some((m) => m.id === message.id)) return;

    const currentUser = useServerStore.getState().members.find(
      (m) => m.id !== senderProfile.id
    ) || { id: 'me', username: 'me', displayName: 'Me', avatarUrl: '', status: 'online' };

    const updatedMsgs = {
      ...get().dmMessages,
      [conversationId]: [...currentMsgs, message],
    };

    // Ensure conversation exists in conversations list
    const currentConvos = get().conversations;
    let updatedConvos = currentConvos;
    const existingIndex = currentConvos.findIndex((c) => c.id === conversationId);

    if (existingIndex >= 0) {
      updatedConvos = currentConvos.map((c, i) =>
        i === existingIndex ? { ...c, lastMessage: message, unreadCount: (c.unreadCount || 0) + 1 } : c
      );
    } else {
      const newConvo: Conversation = {
        id: conversationId,
        isGroup: false,
        name: senderProfile.displayName || senderProfile.username,
        members: [senderProfile, currentUser],
        unreadCount: 1,
        lastMessage: message,
      };
      updatedConvos = [newConvo, ...currentConvos];
    }

    // If attachment is a friend invite, automatically ensure sender is in friends list
    const isFriendInvite = message.attachments?.some((a) => a.type === 'friend_invite');
    let updatedFriends = get().friends;
    if (isFriendInvite && !updatedFriends.some((f) => f.id === senderProfile.id)) {
      updatedFriends = [...updatedFriends, senderProfile];
    }

    set({
      dmMessages: updatedMsgs,
      conversations: updatedConvos,
      friends: updatedFriends,
    });

    persistDMs(updatedMsgs);
    try {
      localStorage.setItem(`squadspace_conversations_${currentUser.id}`, JSON.stringify(updatedConvos));
      localStorage.setItem(`squadspace_friends_${currentUser.id}`, JSON.stringify(updatedFriends));
    } catch {}

    // Audio chime notification
    sounds.playNotificationChime();

    // Desktop notification
    notificationService.notify({
      title: `@${senderProfile.displayName || 'Direct Message'}`,
      body: message.content || 'Sent an attachment',
    });
  },

  editDM: (conversationId, messageId, content, currentUserId, recipientId) => {
    const currentMsgs = get().dmMessages[conversationId] || [];
    const updated = {
      ...get().dmMessages,
      [conversationId]: currentMsgs.map((m) =>
        m.id === messageId ? { ...m, content, isEdited: true } : m
      ),
    };

    set({ dmMessages: updated });
    persistDMs(updated);

    realtimeService.broadcastDMEdit(conversationId, messageId, content, currentUserId, recipientId);
  },

  deleteDM: (conversationId, messageId, currentUserId, recipientId) => {
    const currentMsgs = get().dmMessages[conversationId] || [];
    const updated = {
      ...get().dmMessages,
      [conversationId]: currentMsgs.filter((m) => m.id !== messageId),
    };

    set({ dmMessages: updated });
    persistDMs(updated);

    realtimeService.broadcastDMDelete(conversationId, messageId, currentUserId, recipientId);
  },

  toggleDMReaction: (conversationId, messageId, emoji, userId, recipientId) => {
    const currentMsgs = get().dmMessages[conversationId] || [];
    const updated = {
      ...get().dmMessages,
      [conversationId]: currentMsgs.map((m) => {
        if (m.id !== messageId) return m;

        const reactions = m.reactions || [];
        const existing = reactions.find((r) => r.emoji === emoji);
        let newReactions;

        if (existing) {
          const hasReacted = existing.users.includes(userId);
          if (hasReacted) {
            const remaining = existing.users.filter((id) => id !== userId);
            if (remaining.length === 0) {
              newReactions = reactions.filter((r) => r.emoji !== emoji);
            } else {
              newReactions = reactions.map((r) =>
                r.emoji === emoji ? { ...r, users: remaining, count: remaining.length } : r
              );
            }
          } else {
            newReactions = reactions.map((r) =>
              r.emoji === emoji
                ? { ...r, users: [...r.users, userId], count: r.count + 1 }
                : r
            );
          }
        } else {
          newReactions = [...reactions, { emoji, users: [userId], count: 1 }];
        }

        return { ...m, reactions: newReactions };
      }),
    };

    set({ dmMessages: updated });
    persistDMs(updated);

    realtimeService.broadcastDMReaction(conversationId, messageId, emoji, userId, recipientId);
  },

  receiveDMEdit: (conversationId, messageId, content) => {
    const currentMsgs = get().dmMessages[conversationId] || [];
    const updated = {
      ...get().dmMessages,
      [conversationId]: currentMsgs.map((m) =>
        m.id === messageId ? { ...m, content, isEdited: true } : m
      ),
    };
    set({ dmMessages: updated });
    persistDMs(updated);
  },

  receiveDMDelete: (conversationId, messageId) => {
    const currentMsgs = get().dmMessages[conversationId] || [];
    const updated = {
      ...get().dmMessages,
      [conversationId]: currentMsgs.filter((m) => m.id !== messageId),
    };
    set({ dmMessages: updated });
    persistDMs(updated);
  },

  receiveDMReaction: (conversationId, messageId, emoji, userId) => {
    const currentMsgs = get().dmMessages[conversationId] || [];
    const updated = {
      ...get().dmMessages,
      [conversationId]: currentMsgs.map((m) => {
        if (m.id !== messageId) return m;

        const reactions = m.reactions || [];
        const existing = reactions.find((r) => r.emoji === emoji);
        let newReactions;

        if (existing) {
          const hasReacted = existing.users.includes(userId);
          if (hasReacted) {
            const remaining = existing.users.filter((id) => id !== userId);
            if (remaining.length === 0) {
              newReactions = reactions.filter((r) => r.emoji !== emoji);
            } else {
              newReactions = reactions.map((r) =>
                r.emoji === emoji ? { ...r, users: remaining, count: remaining.length } : r
              );
            }
          } else {
            newReactions = reactions.map((r) =>
              r.emoji === emoji
                ? { ...r, users: [...r.users, userId], count: r.count + 1 }
                : r
            );
          }
        } else {
          newReactions = [...reactions, { emoji, users: [userId], count: 1 }];
        }

        return { ...m, reactions: newReactions };
      }),
    };
    set({ dmMessages: updated });
    persistDMs(updated);
  },

  receiveFriendRequest: (senderProfile) => {
    const currentFriends = get().friends;
    if (currentFriends.some((f) => f.id === senderProfile.id)) return;

    const updated = [...currentFriends, senderProfile];
    set({ friends: updated });

    try {
      const currentUserId = useServerStore.getState().members[0]?.id;
      if (currentUserId) {
        localStorage.setItem(`squadspace_friends_${currentUserId}`, JSON.stringify(updated));
      }
    } catch {}

    sounds.playNotificationChime();
    notificationService.notify({
      title: 'New Friend Request',
      body: `👋 @${senderProfile.displayName || senderProfile.username} connected with you as a friend!`,
    });
  },

  sendServerInviteDM: (friend, inviteCode, currentUser, serverName = 'SquadSpace Hangout') => {
    const convoId = get().startOrOpenDM(friend, currentUser);
    const attachment: MessageAttachment = {
      id: `att-invite-${Date.now()}`,
      url: inviteCode,
      type: 'server_invite',
      name: serverName,
    };

    get().sendDM(
      convoId,
      `Hey! You've been invited to join **${serverName}**! Click below to join.`,
      currentUser,
      [attachment],
      friend.id
    );

    return convoId;
  },

  sendFriendRequestDM: (friend, currentUser) => {
    const convoId = get().startOrOpenDM(friend, currentUser);
    const attachment: MessageAttachment = {
      id: `att-frnd-${Date.now()}`,
      url: currentUser.username,
      type: 'friend_invite',
      name: 'Friend Request',
    };

    get().sendDM(
      convoId,
      `👋 Hey ${friend.displayName}! I added you as a friend on SquadSpace.`,
      currentUser,
      [attachment],
      friend.id
    );

    // Broadcast direct friend request event
    realtimeService.broadcastFriendRequest(currentUser, friend.id);

    return convoId;
  },

  removeFriend: (userId, currentUserId) => {
    const updated = get().friends.filter((f) => f.id !== userId);
    set({ friends: updated });
    if (currentUserId) {
      try {
        localStorage.setItem(`squadspace_friends_${currentUserId}`, JSON.stringify(updated));
      } catch {}
    }
  },

  addFriendByUsername: async (username, currentUser) => {
    const clean = username.toLowerCase().replace(/^@/, '').trim();
    if (!clean) return { success: false, error: 'Please enter a username.' };

    if (currentUser && currentUser.username.toLowerCase() === clean) {
      return { success: false, error: 'You cannot add yourself as a friend.' };
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .ilike('username', clean)
          .maybeSingle();

        let friend: UserProfile | null = null;

        if (profile) {
          friend = {
            id: profile.id,
            username: profile.username,
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username}`,
            status: profile.status || 'online',
            customStatus: profile.custom_status,
            aboutMe: profile.about_me,
            isAdmin: Boolean(profile.is_admin),
          };
        } else {
          // Check members in current server
          const { members } = useServerStore.getState();
          const serverMember = members.find(
            (m) =>
              m.username?.toLowerCase() === clean ||
              m.displayName?.toLowerCase() === clean
          );
          if (serverMember) {
            friend = serverMember;
          }
        }

        if (!friend) {
          return {
            success: false,
            error: `User @${clean} not found. Make sure your friend has registered their account first!`,
          };
        }

        const existingFriends = get().friends;
        if (!existingFriends.some((f) => f.id === friend!.id)) {
          const updated = [...existingFriends, friend];
          set({ friends: updated });
          if (currentUser) {
            try {
              localStorage.setItem(`squadspace_friends_${currentUser.id}`, JSON.stringify(updated));
            } catch {}
          }
        }

        if (currentUser) {
          get().sendFriendRequestDM(friend, currentUser);
        }

        return { success: true, friend };
      } catch (err: any) {
        return { success: false, error: err.message || 'Failed to search for user.' };
      }
    }

    return { success: false, error: 'Database not connected.' };
  },
}));
