import { create } from 'zustand';
import { Channel, ChannelCategory, CustomEmoji, ServerInvite, UserProfile } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
  isLoadingServer: boolean;
  
  setActiveChannel: (channelId: string) => void;
  setActiveView: (view: 'server' | 'dm' | 'settings') => void;
  fetchServerData: () => Promise<void>;
  addChannel: (channel: Omit<Channel, 'id' | 'serverId' | 'position'>) => Promise<Channel>;
  deleteChannel: (id: string) => Promise<void>;
  renameChannel: (id: string, name: string, topic?: string) => Promise<void>;
  addCategory: (name: string) => Promise<ChannelCategory>;
  deleteCategory: (id: string) => Promise<void>;
  addCustomEmoji: (name: string, imageUrl: string, creatorId: string) => Promise<void>;
  deleteCustomEmoji: (id: string) => Promise<void>;
  createInvite: (creatorId: string) => Promise<ServerInvite>;
  updateMember: (memberId: string, updates: Partial<UserProfile>) => void;
}

const CHANNELS_STORAGE_KEY = 'squadspace_channels_v2';
const CATEGORIES_STORAGE_KEY = 'squadspace_categories_v2';
const EMOJIS_STORAGE_KEY = 'squadspace_emojis_v2';

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

export const useServerStore = create<ServerState>((set, get) => ({
  serverName: 'SquadSpace Hangout',
  serverIcon: '🚀',
  categories: [],
  channels: [],
  members: [],
  customEmojis: [],
  invites: [],
  activeChannelId: '',
  activeView: 'server',
  isLoadingServer: false,

  setActiveChannel: (activeChannelId) => set({ activeChannelId, activeView: 'server' }),
  setActiveView: (activeView) => set({ activeView }),

  fetchServerData: async () => {
    set({ isLoadingServer: true });

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Fetch categories
        const { data: dbCategories } = await supabase
          .from('channel_categories')
          .select('*')
          .order('position', { ascending: true });

        // 2. Fetch channels
        const { data: dbChannels } = await supabase
          .from('channels')
          .select('*')
          .order('position', { ascending: true });

        // 3. Fetch server members (profiles)
        const { data: dbProfiles } = await supabase
          .from('profiles')
          .select('*');

        // 4. Fetch custom emojis
        const { data: dbEmojis } = await supabase
          .from('custom_emojis')
          .select('*');

        // 5. Fetch invitations
        const { data: dbInvites } = await supabase
          .from('invitations')
          .select('*');

        const categories: ChannelCategory[] = (dbCategories || []).map((c: any) => ({
          id: c.id,
          serverId: c.server_id || 'srv-1',
          name: c.name,
          position: c.position ?? 0,
        }));

        const channels: Channel[] = (dbChannels || []).map((c: any) => ({
          id: c.id,
          serverId: c.server_id || 'srv-1',
          categoryId: c.category_id || undefined,
          name: c.name,
          type: c.type,
          topic: c.topic || '',
          position: c.position ?? 0,
          isPrivate: Boolean(c.is_private),
        }));

        const members: UserProfile[] = (dbProfiles || []).map((p: any) => ({
          id: p.id,
          username: p.username,
          displayName: p.display_name,
          avatarUrl: p.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.username}`,
          status: p.status || 'offline',
          customStatus: p.custom_status,
          aboutMe: p.about_me,
          isAdmin: Boolean(p.is_admin),
        }));

        const customEmojis: CustomEmoji[] = (dbEmojis || []).map((e: any) => ({
          id: e.id,
          name: e.name,
          imageUrl: e.image_url,
          creatorId: e.creator_id,
          createdAt: e.created_at,
        }));

        const invites: ServerInvite[] = (dbInvites || []).map((inv: any) => ({
          code: inv.code,
          serverId: inv.server_id || 'srv-1',
          creatorId: inv.creator_id,
          uses: inv.uses || 0,
          maxUses: inv.max_uses,
          expiresAt: inv.expires_at,
          createdAt: inv.created_at,
        }));

        const currentActiveId = get().activeChannelId;
        let newActiveId = currentActiveId;
        if (!channels.some((c) => c.id === currentActiveId)) {
          newActiveId = channels.length > 0 ? channels[0].id : '';
        }

        set({
          categories,
          channels,
          members,
          customEmojis,
          invites,
          activeChannelId: newActiveId,
          isLoadingServer: false,
        });
        return;
      } catch (err) {
        console.warn('Supabase fetch server data warning:', err);
      }
    }

    // LocalStorage Fallback (Only real saved user data, 0 fake data)
    try {
      const savedChannels = localStorage.getItem(CHANNELS_STORAGE_KEY);
      const savedCategories = localStorage.getItem(CATEGORIES_STORAGE_KEY);
      const savedEmojis = localStorage.getItem(EMOJIS_STORAGE_KEY);

      const channels: Channel[] = savedChannels ? JSON.parse(savedChannels) : [];
      const categories: ChannelCategory[] = savedCategories ? JSON.parse(savedCategories) : [];
      const customEmojis: CustomEmoji[] = savedEmojis ? JSON.parse(savedEmojis) : [];

      set({
        channels,
        categories,
        customEmojis,
        activeChannelId: channels.length > 0 ? channels[0].id : '',
        isLoadingServer: false,
      });
    } catch {
      set({ isLoadingServer: false });
    }
  },

  addChannel: async (channelData) => {
    const { channels } = get();
    const newId = generateId();

    const newChannel: Channel = {
      id: newId,
      serverId: 'srv-1',
      name: channelData.name.toLowerCase().replace(/\s+/g, '-'),
      type: channelData.type,
      categoryId: channelData.categoryId,
      topic: channelData.topic || '',
      position: channels.length,
      isPrivate: channelData.isPrivate || false,
    };

    const updated = [...channels, newChannel];
    set({ channels: updated, activeChannelId: newId });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('channels').insert({
          id: newId,
          name: newChannel.name,
          type: newChannel.type,
          category_id: newChannel.categoryId || null,
          topic: newChannel.topic,
          position: newChannel.position,
          is_private: newChannel.isPrivate,
        });
      } catch (err) {
        console.error('Failed to create channel in Supabase:', err);
      }
    } else {
      localStorage.setItem(CHANNELS_STORAGE_KEY, JSON.stringify(updated));
    }

    return newChannel;
  },

  deleteChannel: async (id) => {
    const remaining = get().channels.filter((c) => c.id !== id);
    const fallback = remaining.find((c) => c.type === 'text')?.id || remaining[0]?.id || '';
    
    set({
      channels: remaining,
      activeChannelId: get().activeChannelId === id ? fallback : get().activeChannelId,
    });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('channels').delete().eq('id', id);
      } catch (err) {
        console.error('Failed to delete channel from Supabase:', err);
      }
    } else {
      localStorage.setItem(CHANNELS_STORAGE_KEY, JSON.stringify(remaining));
    }
  },

  renameChannel: async (id, name, topic) => {
    const cleanName = name.toLowerCase().replace(/\s+/g, '-');
    const updated = get().channels.map((c) =>
      c.id === id ? { ...c, name: cleanName, ...(topic !== undefined ? { topic } : {}) } : c
    );
    set({ channels: updated });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('channels').update({
          name: cleanName,
          ...(topic !== undefined ? { topic } : {}),
        }).eq('id', id);
      } catch (err) {
        console.error('Failed to rename channel in Supabase:', err);
      }
    } else {
      localStorage.setItem(CHANNELS_STORAGE_KEY, JSON.stringify(updated));
    }
  },

  addCategory: async (name) => {
    const { categories } = get();
    const newId = generateId();
    const newCategory: ChannelCategory = {
      id: newId,
      serverId: 'srv-1',
      name: name.toUpperCase(),
      position: categories.length,
    };

    const updated = [...categories, newCategory];
    set({ categories: updated });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('channel_categories').insert({
          id: newId,
          name: newCategory.name,
          position: newCategory.position,
        });
      } catch (err) {
        console.error('Failed to add category to Supabase:', err);
      }
    } else {
      localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(updated));
    }

    return newCategory;
  },

  deleteCategory: async (id) => {
    const remainingCats = get().categories.filter((c) => c.id !== id);
    const updatedChannels = get().channels.map((c) => (c.categoryId === id ? { ...c, categoryId: undefined } : c));

    set({ categories: remainingCats, channels: updatedChannels });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('channel_categories').delete().eq('id', id);
      } catch (err) {
        console.error('Failed to delete category from Supabase:', err);
      }
    } else {
      localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(remainingCats));
      localStorage.setItem(CHANNELS_STORAGE_KEY, JSON.stringify(updatedChannels));
    }
  },

  addCustomEmoji: async (name, imageUrl, creatorId) => {
    const newId = generateId();
    const cleanName = name.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const newEmoji: CustomEmoji = {
      id: newId,
      name: cleanName,
      imageUrl,
      creatorId,
      createdAt: new Date().toISOString(),
    };

    const updated = [...get().customEmojis, newEmoji];
    set({ customEmojis: updated });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('custom_emojis').insert({
          id: newId,
          name: cleanName,
          image_url: imageUrl,
          creator_id: creatorId,
        });
      } catch (err) {
        console.error('Failed to add emoji to Supabase:', err);
      }
    } else {
      localStorage.setItem(EMOJIS_STORAGE_KEY, JSON.stringify(updated));
    }
  },

  deleteCustomEmoji: async (id) => {
    const updated = get().customEmojis.filter((e) => e.id !== id);
    set({ customEmojis: updated });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('custom_emojis').delete().eq('id', id);
      } catch (err) {
        console.error('Failed to delete emoji from Supabase:', err);
      }
    } else {
      localStorage.setItem(EMOJIS_STORAGE_KEY, JSON.stringify(updated));
    }
  },

  createInvite: async (creatorId) => {
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

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('invitations').insert({
          code,
          creator_id: creatorId,
          max_uses: 10,
          uses: 0,
        });
      } catch (err) {
        console.error('Failed to save invite to Supabase:', err);
      }
    }

    return newInvite;
  },

  updateMember: (memberId, updates) =>
    set((state) => ({
      members: state.members.map((m) => (m.id === memberId ? { ...m, ...updates } : m)),
    })),
}));
