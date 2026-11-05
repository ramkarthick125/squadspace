import { create } from 'zustand';
import { Channel, ChannelCategory, CustomEmoji, Server, ServerInvite, UserProfile } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';
import { realtimeService } from '../lib/realtimeService';

interface ServerState {
  userServers: Server[];
  activeServerId: string;
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

  setActiveServer: (serverId: string) => Promise<void>;
  createServer: (name: string, icon?: string, ownerId?: string) => Promise<Server>;
  setActiveChannel: (channelId: string) => void;
  setActiveView: (view: 'server' | 'dm' | 'settings') => void;
  fetchServerData: (targetServerId?: string) => Promise<void>;
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

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const useServerStore = create<ServerState>((set, get) => ({
  userServers: [],
  activeServerId: '',
  serverName: 'My Server',
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

  setActiveServer: async (serverId: string) => {
    const server = get().userServers.find((s) => s.id === serverId);
    if (server) {
      set({
        activeServerId: serverId,
        serverName: server.name,
        serverIcon: server.icon || '🚀',
        activeView: 'server',
      });
      await get().fetchServerData(serverId);
    }
  },

  createServer: async (name: string, icon = '🚀', ownerId?: string) => {
    const currentUser = useAuthStore.getState().currentUser;
    const creatorId = ownerId || currentUser?.id || 'anon-owner';
    const serverId = generateUUID();

    const newServer: Server = {
      id: serverId,
      name,
      icon,
      ownerId: creatorId,
      createdAt: new Date().toISOString(),
    };

    // 1. Starter channels for the new server
    const generalChannel: Channel = {
      id: generateUUID(),
      serverId: serverId,
      name: 'general',
      type: 'text',
      topic: `Welcome to ${name}!`,
      position: 0,
      isPrivate: false,
    };

    const voiceChannel: Channel = {
      id: generateUUID(),
      serverId: serverId,
      name: 'General VC',
      type: 'voice',
      topic: 'Voice and video hangout',
      position: 1,
      isPrivate: false,
    };

    const starterChannels = [generalChannel, voiceChannel];

    // 2. Initial invite code
    const initialInvite: ServerInvite = {
      code: 'sqd-' + Math.random().toString(36).substring(2, 8),
      serverId: serverId,
      creatorId: creatorId,
      uses: 0,
      maxUses: 50,
      createdAt: new Date().toISOString(),
    };

    // 3. Save to LocalStorage immediately
    const updatedServers = [...get().userServers, newServer];
    try {
      localStorage.setItem(`squadspace_user_servers_${creatorId}`, JSON.stringify(updatedServers));
      localStorage.setItem(`squadspace_channels_${serverId}`, JSON.stringify(starterChannels));
      localStorage.setItem(`squadspace_invites_${serverId}`, JSON.stringify([initialInvite]));
    } catch {}

    set({
      userServers: updatedServers,
      activeServerId: serverId,
      serverName: name,
      serverIcon: icon,
      channels: starterChannels,
      categories: [],
      invites: [initialInvite],
      activeChannelId: generalChannel.id,
      activeView: 'server',
    });

    // 4. Persist to Supabase in background
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('servers').insert({
          id: serverId,
          name: newServer.name,
          owner_id: creatorId.length === 36 ? creatorId : null,
        });

        if (creatorId.length === 36) {
          await supabase.from('server_members').insert({
            server_id: serverId,
            user_id: creatorId,
            role: 'owner',
          });
        }

        await supabase.from('channels').insert([
          {
            id: generalChannel.id,
            server_id: serverId,
            name: generalChannel.name,
            type: generalChannel.type,
            topic: generalChannel.topic,
            position: 0,
          },
          {
            id: voiceChannel.id,
            server_id: serverId,
            name: voiceChannel.name,
            type: voiceChannel.type,
            topic: voiceChannel.topic,
            position: 1,
          },
        ]);

        await supabase.from('invitations').insert({
          code: initialInvite.code,
          server_id: serverId,
          creator_id: creatorId.length === 36 ? creatorId : null,
          max_uses: 50,
          uses: 0,
        });
      } catch (err) {
        console.warn('Supabase createServer note:', err);
      }
    }

    return newServer;
  },

  fetchServerData: async (targetServerId?: string) => {
    set({ isLoadingServer: true });
    const currentUser = useAuthStore.getState().currentUser;
    const userId = currentUser?.id;

    let servers: Server[] = [];

    // Step 1: Load User's Servers
    if (isSupabaseConfigured && supabase && userId && userId.length === 36) {
      try {
        // Query servers where user is a member or owner
        const { data: memberRows } = await supabase
          .from('server_members')
          .select('server_id, servers(id, name, owner_id, created_at)')
          .eq('user_id', userId);

        if (memberRows && memberRows.length > 0) {
          servers = memberRows
            .filter((m: any) => m.servers)
            .map((m: any) => ({
              id: m.servers.id,
              name: m.servers.name,
              icon: '🚀',
              ownerId: m.servers.owner_id,
              createdAt: m.servers.created_at,
            }));
        }

        // Also check servers owned by user
        const { data: ownedServers } = await supabase
          .from('servers')
          .select('id, name, owner_id, created_at')
          .eq('owner_id', userId);

        if (ownedServers && ownedServers.length > 0) {
          for (const os of ownedServers) {
            if (!servers.some((s) => s.id === os.id)) {
              servers.push({
                id: os.id,
                name: os.name,
                icon: '🚀',
                ownerId: os.owner_id,
                createdAt: os.created_at,
              });
            }
          }
        }
      } catch (err) {
        console.warn('Supabase servers fetch note:', err);
      }
    }

    // Check LocalStorage fallback for servers
    if (servers.length === 0 && userId) {
      try {
        const local = localStorage.getItem(`squadspace_user_servers_${userId}`);
        if (local) {
          servers = JSON.parse(local);
        }
      } catch {}
    }

    // If still zero servers, auto-create the user's first personal server
    if (servers.length === 0 && currentUser) {
      const initialServerId = generateUUID();
      const initialServer: Server = {
        id: initialServerId,
        name: `${currentUser.displayName}'s Server`,
        icon: '🚀',
        ownerId: currentUser.id,
        createdAt: new Date().toISOString(),
      };
      servers = [initialServer];

      try {
        localStorage.setItem(`squadspace_user_servers_${currentUser.id}`, JSON.stringify(servers));
      } catch {}

      if (isSupabaseConfigured && supabase && currentUser.id.length === 36) {
        Promise.resolve(
          supabase.from('servers').insert({
            id: initialServerId,
            name: initialServer.name,
            owner_id: currentUser.id,
          })
        )
          .then(() => {
            Promise.resolve(
              supabase.from('server_members').insert({
                server_id: initialServerId,
                user_id: currentUser.id,
                role: 'owner',
              })
            ).catch(() => {});
          })
          .catch(() => {});
      }
    }

    // Step 2: Determine Active Server
    const activeServerId =
      targetServerId ||
      get().activeServerId ||
      (servers.length > 0 ? servers[0].id : generateUUID());

    const activeServer = servers.find((s) => s.id === activeServerId) || servers[0];
    const serverName = activeServer?.name || 'My Squad Server';
    const serverIcon = activeServer?.icon || '🚀';

    // Step 3: Load Channels for Active Server
    let channels: Channel[] = [];
    try {
      const savedCh = localStorage.getItem(`squadspace_channels_${activeServerId}`);
      if (savedCh) {
        channels = JSON.parse(savedCh);
      }
    } catch {}

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: dbChannels } = await supabase
          .from('channels')
          .select('*')
          .eq('server_id', activeServerId)
          .order('position', { ascending: true });

        if (dbChannels && dbChannels.length > 0) {
          channels = dbChannels.map((c: any) => ({
            id: c.id,
            serverId: c.server_id || activeServerId,
            categoryId: c.category_id || undefined,
            name: c.name,
            type: c.type,
            topic: c.topic || '',
            position: c.position ?? 0,
            isPrivate: Boolean(c.is_private),
          }));
          try {
            localStorage.setItem(`squadspace_channels_${activeServerId}`, JSON.stringify(channels));
          } catch {}
        }
      } catch (err) {
        console.warn('Supabase channels fetch note:', err);
      }
    }

    // If zero channels exist for this server, create starter channels
    if (channels.length === 0) {
      const genCh: Channel = {
        id: generateUUID(),
        serverId: activeServerId,
        name: 'general',
        type: 'text',
        topic: 'General conversation',
        position: 0,
        isPrivate: false,
      };
      const vcCh: Channel = {
        id: generateUUID(),
        serverId: activeServerId,
        name: 'General VC',
        type: 'voice',
        topic: 'Voice & streaming hangout',
        position: 1,
        isPrivate: false,
      };
      channels = [genCh, vcCh];

      try {
        localStorage.setItem(`squadspace_channels_${activeServerId}`, JSON.stringify(channels));
      } catch {}

      if (isSupabaseConfigured && supabase) {
        Promise.resolve(
          supabase.from('channels').insert([
            { id: genCh.id, server_id: activeServerId, name: genCh.name, type: genCh.type, position: 0 },
            { id: vcCh.id, server_id: activeServerId, name: vcCh.name, type: vcCh.type, position: 1 },
          ])
        ).catch(() => {});
      }
    }

    // Step 4: Load Categories for Active Server
    let categories: ChannelCategory[] = [];
    try {
      const savedCat = localStorage.getItem(`squadspace_categories_${activeServerId}`);
      if (savedCat) categories = JSON.parse(savedCat);
    } catch {}

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: dbCat } = await supabase
          .from('channel_categories')
          .select('*')
          .eq('server_id', activeServerId)
          .order('position', { ascending: true });

        if (dbCat && dbCat.length > 0) {
          categories = dbCat.map((c: any) => ({
            id: c.id,
            serverId: c.server_id || activeServerId,
            name: c.name,
            position: c.position ?? 0,
          }));
          try {
            localStorage.setItem(`squadspace_categories_${activeServerId}`, JSON.stringify(categories));
          } catch {}
        }
      } catch {}
    }

    // Step 5: Load Server Members for Active Server
    let members: UserProfile[] = currentUser ? [currentUser] : [];

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: memberRows } = await supabase
          .from('server_members')
          .select('user_id, role, profiles(*)')
          .eq('server_id', activeServerId);

        if (memberRows && memberRows.length > 0) {
          const fetchedMembers = memberRows
            .filter((m: any) => m.profiles)
            .map((m: any) => ({
              id: m.profiles.id,
              username: m.profiles.username,
              displayName: m.profiles.display_name,
              avatarUrl: m.profiles.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.profiles.username}`,
              status: m.profiles.status || 'offline',
              customStatus: m.profiles.custom_status,
              aboutMe: m.profiles.about_me,
              isAdmin: m.role === 'owner' || m.role === 'admin' || Boolean(m.profiles.is_admin),
            }));

          if (fetchedMembers.length > 0) {
            members = fetchedMembers;
          }
        }
      } catch {}
    }

    // Step 6: Load Invites for Active Server
    let invites: ServerInvite[] = [];
    try {
      const savedInv = localStorage.getItem(`squadspace_invites_${activeServerId}`);
      if (savedInv) invites = JSON.parse(savedInv);
    } catch {}

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: dbInv } = await supabase
          .from('invitations')
          .select('*')
          .eq('server_id', activeServerId);

        if (dbInv && dbInv.length > 0) {
          invites = dbInv.map((inv: any) => ({
            code: inv.code,
            serverId: inv.server_id || activeServerId,
            creatorId: inv.creator_id,
            uses: inv.uses || 0,
            maxUses: inv.max_uses,
            expiresAt: inv.expires_at,
            createdAt: inv.created_at,
          }));
        }
      } catch {}
    }

    // If zero invites, generate one
    if (invites.length === 0) {
      const newInvCode = 'sqd-' + Math.random().toString(36).substring(2, 8);
      const generatedInv: ServerInvite = {
        code: newInvCode,
        serverId: activeServerId,
        creatorId: currentUser?.id || 'admin',
        uses: 0,
        maxUses: 50,
        createdAt: new Date().toISOString(),
      };
      invites = [generatedInv];
      try {
        localStorage.setItem(`squadspace_invites_${activeServerId}`, JSON.stringify(invites));
      } catch {}

      if (isSupabaseConfigured && supabase && currentUser?.id?.length === 36) {
        Promise.resolve(
          supabase.from('invitations').insert({
            code: newInvCode,
            server_id: activeServerId,
            creator_id: currentUser.id,
            max_uses: 50,
            uses: 0,
          })
        ).catch(() => {});
      }
    }

    // Determine Active Channel
    const currentActiveChannelId = get().activeChannelId;
    let newActiveChannelId = currentActiveChannelId;
    if (!channels.some((c) => c.id === currentActiveChannelId)) {
      newActiveChannelId = channels.length > 0 ? channels[0].id : '';
    }

    set({
      userServers: servers,
      activeServerId,
      serverName,
      serverIcon,
      channels,
      categories,
      members,
      invites,
      activeChannelId: newActiveChannelId,
      isLoadingServer: false,
    });
  },

  addChannel: async (channelData) => {
    const { channels, activeServerId } = get();
    const newId = generateUUID();

    const newChannel: Channel = {
      id: newId,
      serverId: activeServerId,
      name: channelData.name.toLowerCase().replace(/\s+/g, '-'),
      type: channelData.type,
      categoryId: channelData.categoryId,
      topic: channelData.topic || '',
      position: channels.length,
      isPrivate: channelData.isPrivate || false,
    };

    const updated = [...channels, newChannel];
    set({ channels: updated, activeChannelId: newId });

    // Broadcast in real-time to all other devices & tabs
    const currentUserId = useAuthStore.getState().currentUser?.id || 'admin';
    realtimeService.broadcastChannelEvent('created', newChannel, activeServerId, currentUserId);

    // 1. ALWAYS save to localStorage first (prevents vanishing on refresh!)
    try {
      localStorage.setItem(`squadspace_channels_${activeServerId}`, JSON.stringify(updated));
    } catch {}

    // 2. Persist to Supabase with valid UUID
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('channels').insert({
          id: newId,
          server_id: activeServerId,
          name: newChannel.name,
          type: newChannel.type,
          category_id: newChannel.categoryId || null,
          topic: newChannel.topic,
          position: newChannel.position,
          is_private: newChannel.isPrivate,
        });
      } catch (err) {
        console.warn('Channel Supabase sync warning:', err);
      }
    }

    return newChannel;
  },

  deleteChannel: async (id) => {
    const { activeServerId, channels } = get();
    const remaining = channels.filter((c) => c.id !== id);
    const fallback = remaining.find((c) => c.type === 'text')?.id || remaining[0]?.id || '';

    set({ channels: remaining, activeChannelId: fallback });

    const currentUserId = useAuthStore.getState().currentUser?.id || 'admin';
    realtimeService.broadcastChannelEvent('deleted', { id }, activeServerId, currentUserId);

    try {
      localStorage.setItem(`squadspace_channels_${activeServerId}`, JSON.stringify(remaining));
    } catch {}

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('channels').delete().eq('id', id);
      } catch (err) {
        console.warn('Delete channel warning:', err);
      }
    }
  },

  renameChannel: async (id, name, topic) => {
    const { activeServerId, channels } = get();
    const updated = channels.map((c) =>
      c.id === id ? { ...c, name: name.toLowerCase().replace(/\s+/g, '-'), topic: topic ?? c.topic } : c
    );

    set({ channels: updated });

    const currentUserId = useAuthStore.getState().currentUser?.id || 'admin';
    realtimeService.broadcastChannelEvent('renamed', { id, name, topic }, activeServerId, currentUserId);

    try {
      localStorage.setItem(`squadspace_channels_${activeServerId}`, JSON.stringify(updated));
    } catch {}

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('channels').update({
          name: name.toLowerCase().replace(/\s+/g, '-'),
          topic,
        }).eq('id', id);
      } catch (err) {
        console.warn('Rename channel warning:', err);
      }
    }
  },

  addCategory: async (name) => {
    const { categories, activeServerId } = get();
    const newId = generateUUID();

    const newCategory: ChannelCategory = {
      id: newId,
      serverId: activeServerId,
      name,
      position: categories.length,
    };

    const updated = [...categories, newCategory];
    set({ categories: updated });

    try {
      localStorage.setItem(`squadspace_categories_${activeServerId}`, JSON.stringify(updated));
    } catch {}

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('channel_categories').insert({
          id: newId,
          server_id: activeServerId,
          name: newCategory.name,
          position: newCategory.position,
        });
      } catch (err) {
        console.warn('Add category warning:', err);
      }
    }

    return newCategory;
  },

  deleteCategory: async (id) => {
    const { activeServerId, categories, channels } = get();
    const remainingCategories = categories.filter((c) => c.id !== id);
    const unhookedChannels = channels.map((c) => (c.categoryId === id ? { ...c, categoryId: undefined } : c));

    set({ categories: remainingCategories, channels: unhookedChannels });

    try {
      localStorage.setItem(`squadspace_categories_${activeServerId}`, JSON.stringify(remainingCategories));
      localStorage.setItem(`squadspace_channels_${activeServerId}`, JSON.stringify(unhookedChannels));
    } catch {}

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('channel_categories').delete().eq('id', id);
      } catch (err) {
        console.warn('Delete category warning:', err);
      }
    }
  },

  addCustomEmoji: async (name, imageUrl, creatorId) => {
    const newEmoji: CustomEmoji = {
      id: generateUUID(),
      name,
      imageUrl,
      creatorId,
      createdAt: new Date().toISOString(),
    };

    const updated = [...get().customEmojis, newEmoji];
    set({ customEmojis: updated });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('custom_emojis').insert({
          id: newEmoji.id,
          name: newEmoji.name,
          image_url: newEmoji.imageUrl,
          creator_id: creatorId.length === 36 ? creatorId : null,
        });
      } catch (err) {
        console.warn('Add custom emoji warning:', err);
      }
    }
  },

  deleteCustomEmoji: async (id) => {
    const remaining = get().customEmojis.filter((e) => e.id !== id);
    set({ customEmojis: remaining });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('custom_emojis').delete().eq('id', id);
      } catch (err) {
        console.warn('Delete emoji warning:', err);
      }
    }
  },

  createInvite: async (creatorId) => {
    const { activeServerId } = get();
    const newCode = 'sqd-' + Math.random().toString(36).substring(2, 8);

    const newInvite: ServerInvite = {
      code: newCode,
      serverId: activeServerId,
      creatorId,
      uses: 0,
      maxUses: 50,
      createdAt: new Date().toISOString(),
    };

    const updated = [newInvite, ...get().invites];
    set({ invites: updated });

    try {
      localStorage.setItem(`squadspace_invites_${activeServerId}`, JSON.stringify(updated));
    } catch {}

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('invitations').insert({
          code: newCode,
          server_id: activeServerId,
          creator_id: creatorId.length === 36 ? creatorId : null,
          max_uses: 50,
          uses: 0,
        });
      } catch (err) {
        console.warn('Create invite warning:', err);
      }
    }

    return newInvite;
  },

  updateMember: (memberId, updates) => {
    set((state) => ({
      members: state.members.map((m) => (m.id === memberId ? { ...m, ...updates } : m)),
    }));
  },
}));
