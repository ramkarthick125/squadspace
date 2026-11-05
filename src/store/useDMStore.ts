import { create } from 'zustand';
import { Conversation, Message, UserProfile } from '../types';
import { MOCK_USERS } from '../mock/initialData';
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
  addFriendByUsername: (username: string) => boolean;
}

const DM_STORAGE_KEY = 'squadspace_dm_store_v1';

function getInitialDMMessages(): Record<string, Message[]> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(DM_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (err) {
    console.warn('Failed to parse saved DMs:', err);
  }
  return {
    'dm-marcus': [
      {
        id: 'dm-msg-1',
        conversationId: 'dm-marcus',
        senderId: 'usr-2',
        sender: MOCK_USERS[1],
        content: 'Hey Alex, are we playing tonight?',
        reactions: [],
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: 'dm-msg-2',
        conversationId: 'dm-marcus',
        senderId: 'usr-admin-1',
        sender: MOCK_USERS[0],
        content: 'Yeah for sure! Just finishing up the voice channel updates for SquadSpace.',
        reactions: [{ emoji: '🔥', users: ['usr-2'], count: 1 }],
        createdAt: new Date(Date.now() - 5400000).toISOString(),
      },
      {
        id: 'dm-msg-3',
        conversationId: 'dm-marcus',
        senderId: 'usr-2',
        sender: MOCK_USERS[1],
        content: 'Hop on whenever you are free!',
        reactions: [],
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
    'dm-elena': [
      {
        id: 'dm-msg-e1',
        conversationId: 'dm-elena',
        senderId: 'usr-3',
        sender: MOCK_USERS[2],
        content: 'Sent you the new build screenshots!',
        reactions: [],
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
    ],
  };
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
            title: `DM from ${message.sender.displayName}`,
            body: message.content,
            isDM: true,
          });
        }
      }
    };
  }

  return {
    friends: MOCK_USERS.filter((u) => u.id !== 'usr-admin-1'),
    activeConversationId: 'dm-marcus',
    conversations: [
      {
        id: 'dm-marcus',
        isGroup: false,
        members: [MOCK_USERS[1]],
        unreadCount: 0,
        lastMessage: {
          id: 'dm-m-1',
          senderId: 'usr-2',
          sender: MOCK_USERS[1],
          content: 'Hop on whenever you are free!',
          reactions: [],
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
      },
      {
        id: 'dm-elena',
        isGroup: false,
        members: [MOCK_USERS[2]],
        unreadCount: 1,
        lastMessage: {
          id: 'dm-e-1',
          senderId: 'usr-3',
          sender: MOCK_USERS[2],
          content: 'Sent you the new build screenshots!',
          reactions: [],
          createdAt: new Date(Date.now() - 7200000).toISOString(),
        },
      },
    ],
    dmMessages: getInitialDMMessages(),

    setActiveConversation: (activeConversationId) => set({ activeConversationId }),

    startOrOpenDM: (friend, currentUser) => {
      const { conversations } = get();
      const existing = conversations.find(
        (c) => !c.isGroup && c.members.some((m) => m.id === friend.id)
      );

      if (existing) {
        set({ activeConversationId: existing.id });
        return existing.id;
      }

      const newId = `dm-${friend.id}-${Date.now()}`;
      const newConv: Conversation = {
        id: newId,
        isGroup: false,
        members: [friend],
        unreadCount: 0,
      };

      set({
        conversations: [newConv, ...conversations],
        activeConversationId: newId,
        dmMessages: {
          ...get().dmMessages,
          [newId]: [],
        },
      });

      return newId;
    },

    sendDM: (conversationId, content, currentUser) => {
      const { dmMessages, conversations } = get();
      const currentMsgs = dmMessages[conversationId] || [];

      const newMsg: Message = {
        id: `dm-m-${Date.now()}`,
        conversationId,
        senderId: currentUser.id,
        sender: currentUser,
        content,
        reactions: [],
        createdAt: new Date().toISOString(),
      };

      const updated = {
        ...dmMessages,
        [conversationId]: [...currentMsgs, newMsg],
      };

      set({
        dmMessages: updated,
        conversations: conversations.map((c) =>
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
    },

    removeFriend: (userId) =>
      set((state) => ({
        friends: state.friends.filter((f) => f.id !== userId),
      })),

    addFriendByUsername: (username: string) => {
      const { friends } = get();
      const clean = username.trim().toLowerCase().replace('@', '');
      const existing = friends.find((f) => f.username.toLowerCase() === clean);
      if (existing) return false;

      const newFriend: UserProfile = {
        id: `usr-${Date.now()}`,
        username: clean,
        displayName: clean,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${clean}`,
        status: 'online',
      };

      set({ friends: [...friends, newFriend] });
      return true;
    },
  };
});
