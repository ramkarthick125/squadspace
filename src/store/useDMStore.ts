import { create } from 'zustand';
import { Conversation, Message, UserProfile } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { notificationService } from '../lib/notificationService';

interface DMState {
  conversations: Conversation[];
  activeConversationId: string | null;
  dmMessages: Record<string, Message[]>;
  friends: UserProfile[];

  setActiveConversation: (conversationId: string | null) => void;
  startOrOpenDM: (friend: UserProfile, currentUser: UserProfile) => string;
  sendDM: (conversationId: string, content: string, currentUser: UserProfile) => void;
  removeFriend: (userId: string) => void;
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

const dmBroadcast = typeof window !== 'undefined' ? new BroadcastChannel('squadspace_dm_sync') : null;

export const useDMStore = create<DMState>((set, get) => {
  if (dmBroadcast) {
    dmBroadcast.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'new_dm') {
        const { conversationId, message } = data;
        const currentMsgs = get().dmMessages[conversationId] || [];
        if (!currentMsgs.some((m) => m.id === message.id)) {
          const updated = {
            ...get().dmMessages,
            [conversationId]: [...currentMsgs, message],
          };
          set({
            dmMessages: updated,
            conversations: get().conversations.map((c) =>
              c.id === conversationId ? { ...c, lastMessage: message } : c
            ),
          });
          persistDMs(updated);

          notificationService.notify({
            title: `@${message.sender?.displayName || 'Direct Message'}`,
            body: message.content || 'Sent a message',
          });
        }
      }
    };
  }

  return {
    conversations: [],
    activeConversationId: null,
    dmMessages: getInitialDMMessages(),
    friends: [],

    setActiveConversation: (conversationId) => set({ activeConversationId: conversationId }),

    startOrOpenDM: (friend, currentUser) => {
      const { conversations } = get();
      const existing = conversations.find((c) =>
        c.members.some((m) => m.id === friend.id) && c.members.some((m) => m.id === currentUser.id)
      );

      if (existing) {
        set({ activeConversationId: existing.id });
        return existing.id;
      }

      const newConvoId = `dm-${friend.username}-${Date.now()}`;
      const newConvo: Conversation = {
        id: newConvoId,
        isGroup: false,
        name: friend.displayName,
        members: [currentUser, friend],
        unreadCount: 0,
      };

      set({
        conversations: [newConvo, ...conversations],
        activeConversationId: newConvoId,
      });

      return newConvoId;
    },

    sendDM: (conversationId, content, currentUser) => {
      const currentMsgs = get().dmMessages[conversationId] || [];
      const newMsg: Message = {
        id: `dm-msg-${Date.now()}`,
        conversationId,
        senderId: currentUser.id,
        sender: currentUser,
        content,
        reactions: [],
        createdAt: new Date().toISOString(),
      };

      const updated = {
        ...get().dmMessages,
        [conversationId]: [...currentMsgs, newMsg],
      };

      set({
        dmMessages: updated,
        conversations: get().conversations.map((c) =>
          c.id === conversationId ? { ...c, lastMessage: newMsg } : c
        ),
      });

      persistDMs(updated);

      if (dmBroadcast) {
        dmBroadcast.postMessage({
          type: 'new_dm',
          conversationId,
          message: newMsg,
        });
      }

      if (isSupabaseConfigured && supabase) {
        supabase
          .from('direct_messages')
          .insert({
            conversation_id: conversationId.startsWith('dm-') ? undefined : conversationId,
            sender_id: currentUser.id,
            content,
          })
          .then(({ error }) => {
            if (error) console.warn('Supabase DM sync note:', error.message);
          });
      }
    },

    removeFriend: (userId) => {
      set((state) => ({
        friends: state.friends.filter((f) => f.id !== userId),
      }));
    },

    addFriendByUsername: async (username, currentUser) => {
      const clean = username.toLowerCase().replace(/^@/, '').trim();
      if (!clean) return { success: false, error: 'Please enter a username.' };

      if (currentUser && currentUser.username.toLowerCase() === clean) {
        return { success: false, error: 'You cannot add yourself as a friend.' };
      }

      if (isSupabaseConfigured && supabase) {
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('username', clean)
            .maybeSingle();

          if (error || !profile) {
            return {
              success: false,
              error: `User @${clean} not found. Make sure your friend has registered their account first!`,
            };
          }

          const friend: UserProfile = {
            id: profile.id,
            username: profile.username,
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username}`,
            status: profile.status || 'offline',
            customStatus: profile.custom_status,
            aboutMe: profile.about_me,
            isAdmin: Boolean(profile.is_admin),
          };

          const existingFriends = get().friends;
          if (!existingFriends.some((f) => f.id === friend.id)) {
            set({ friends: [...existingFriends, friend] });
          }

          if (currentUser) {
            get().startOrOpenDM(friend, currentUser);
          }

          return { success: true, friend };
        } catch (err: any) {
          return { success: false, error: err.message || 'Failed to search for user.' };
        }
      }

      return { success: false, error: 'Database not connected.' };
    },
  };
});
