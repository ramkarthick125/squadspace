import { create } from 'zustand';
import { Channel, ChannelCategory, CustomEmoji, ServerInvite, UserProfile } from '../types';
import { MOCK_CATEGORIES, MOCK_CHANNELS, MOCK_CUSTOM_EMOJIS, MOCK_USERS } from '../mock/initialData';

interface ServerState {
  serverName: string;
  serverIcon: string;
  categories: ChannelCategory[];
  channels: Channel[];
  members: UserProfile[];
  customEmojis: CustomEmoji[];
  invites: ServerInvite[];
  activeChannelId: string;
  activeView: 'server' | 'dm' | 'settings';
  
  setActiveChannel: (channelId: string) => void;
  setActiveView: (view: 'server' | 'dm' | 'settings') => void;
  addChannel: (channel: Omit<Channel, 'id' | 'serverId' | 'position'>) => Channel;
  deleteChannel: (id: string) => void;
  renameChannel: (id: string, name: string, topic?: string) => void;
  addCategory: (name: string) => ChannelCategory;
  deleteCategory: (id: string) => void;
  addCustomEmoji: (name: string, imageUrl: string, creatorId: string) => void;
  deleteCustomEmoji: (id: string) => void;
  createInvite: (creatorId: string) => ServerInvite;
  updateMember: (memberId: string, updates: Partial<UserProfile>) => void;
}

const CHANNELS_STORAGE_KEY = 'squadspace_channels_store_v1';
const EMOJIS_STORAGE_KEY = 'squadspace_emojis_store_v1';

function getInitialChannels(): Channel[] {
  if (typeof window === 'undefined') return MOCK_CHANNELS;
  try {
    const saved = localStorage.getItem(CHANNELS_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return MOCK_CHANNELS;
}

function getInitialEmojis(): CustomEmoji[] {
  if (typeof window === 'undefined') return MOCK_CUSTOM_EMOJIS;
  try {
    const saved = localStorage.getItem(EMOJIS_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return MOCK_CUSTOM_EMOJIS;
}

function persistChannels(channels: Channel[]) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CHANNELS_STORAGE_KEY, JSON.stringify(channels));
    } catch {}
  }
}

function persistEmojis(emojis: CustomEmoji[]) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(EMOJIS_STORAGE_KEY, JSON.stringify(emojis));
    } catch {}
  }
}

export const useServerStore = create<ServerState>((set, get) => ({
  serverName: 'SquadSpace Hangout',
  serverIcon: '🚀',
  categories: MOCK_CATEGORIES,
  channels: getInitialChannels(),
  members: MOCK_USERS,
  customEmojis: getInitialEmojis(),
  invites: [
    {
      code: 'squad-private-2026',
      serverId: 'srv-1',
      creatorId: 'usr-admin-1',
      uses: 4,
      maxUses: 20,
      createdAt: new Date().toISOString(),
    },
  ],
  activeChannelId: 'ch-general',
  activeView: 'server',

  setActiveChannel: (activeChannelId) => set({ activeChannelId, activeView: 'server' }),
  setActiveView: (activeView) => set({ activeView }),

  addChannel: (channelData) => {
    const { channels } = get();
    const newChannel: Channel = {
      id: `ch-${Date.now()}`,
      serverId: 'srv-1',
      name: channelData.name.toLowerCase().replace(/\s+/g, '-'),
      type: channelData.type,
      categoryId: channelData.categoryId,
      topic: channelData.topic || '',
      position: channels.length,
      isPrivate: channelData.isPrivate || false,
    };
    const updated = [...channels, newChannel];
    set({ channels: updated });
    persistChannels(updated);
    return newChannel;
  },

  deleteChannel: (id) =>
    set((state) => {
      const remaining = state.channels.filter((c) => c.id !== id);
      const fallback = remaining.find((c) => c.type === 'text')?.id || 'ch-general';
      persistChannels(remaining);
      return {
        channels: remaining,
        activeChannelId: state.activeChannelId === id ? fallback : state.activeChannelId,
      };
    }),

  renameChannel: (id, name, topic) =>
    set((state) => {
      const updated = state.channels.map((c) =>
        c.id === id ? { ...c, name: name.toLowerCase().replace(/\s+/g, '-'), ...(topic !== undefined ? { topic } : {}) } : c
      );
      persistChannels(updated);
      return { channels: updated };
    }),

  addCategory: (name) => {
    const { categories } = get();
    const newCategory: ChannelCategory = {
      id: `cat-${Date.now()}`,
      serverId: 'srv-1',
      name: name.toUpperCase(),
      position: categories.length,
    };
    set({ categories: [...categories, newCategory] });
    return newCategory;
  },

  deleteCategory: (id) =>
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
      channels: state.channels.map((c) => (c.categoryId === id ? { ...c, categoryId: undefined } : c)),
    })),

  addCustomEmoji: (name, imageUrl, creatorId) =>
    set((state) => {
      const updated = [
        ...state.customEmojis,
        {
          id: `emo-${Date.now()}`,
          name: name.toLowerCase().replace(/[^a-z0-9_]/g, ''),
          imageUrl,
          creatorId,
          createdAt: new Date().toISOString(),
        },
      ];
      persistEmojis(updated);
      return { customEmojis: updated };
    }),

  deleteCustomEmoji: (id) =>
    set((state) => {
      const updated = state.customEmojis.filter((e) => e.id !== id);
      persistEmojis(updated);
      return { customEmojis: updated };
    }),

  createInvite: (creatorId) => {
    const code = 'sqd-' + Math.random().toString(36).substring(2, 8);
    const newInvite: ServerInvite = {
      code,
      serverId: 'srv-1',
      creatorId,
      uses: 0,
      maxUses: 10,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ invites: [newInvite, ...state.invites] }));
    return newInvite;
  },

  updateMember: (memberId, updates) =>
    set((state) => ({
      members: state.members.map((m) => (m.id === memberId ? { ...m, ...updates } : m)),
    })),
}));
