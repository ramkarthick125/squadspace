import { Channel, ChannelCategory, CustomEmoji, Message, UserProfile } from '../types';

export const CURRENT_USER: UserProfile = {
  id: 'usr-admin-1',
  username: 'alex',
  displayName: 'Alex (Commander)',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  status: 'online',
  customStatus: '🚀 Coding SquadSpace',
  gamingActivity: {
    game: 'VS Code & WebRTC',
    details: 'Building private friend hangouts',
    startedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  aboutMe: 'Founder of SquadSpace. Always down for late night gaming sessions or coding jams.',
  isAdmin: true,
};

export const MOCK_USERS: UserProfile[] = [
  CURRENT_USER,
  {
    id: 'usr-2',
    username: 'marcus_gg',
    displayName: 'Marcus',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    status: 'online',
    customStatus: 'Ranked grind today!',
    gamingActivity: {
      game: 'Valorant',
      details: 'Competitive - Ascendant 2',
      startedAt: new Date(Date.now() - 5400000).toISOString(),
    },
    aboutMe: 'Duelist main. Hit me up for 5-stack.',
  },
  {
    id: 'usr-3',
    username: 'elena_sky',
    displayName: 'Elena',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    status: 'online',
    gamingActivity: {
      game: 'Minecraft',
      details: 'Building modern city base',
      startedAt: new Date(Date.now() - 1800000).toISOString(),
    },
    aboutMe: 'Cozy gamer and architect.',
  },
  {
    id: 'usr-4',
    username: 'kaito',
    displayName: 'Kaito',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    status: 'idle',
    customStatus: 'AFK eating ramen 🍜',
    aboutMe: 'Anime & Synthwave enthusiast.',
  },
  {
    id: 'usr-5',
    username: 'sophia_code',
    displayName: 'Sophia',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
    status: 'dnd',
    customStatus: 'Deep focus / exams 📚',
    aboutMe: 'CS undergrad & UI designer.',
  },
  {
    id: 'usr-6',
    username: 'david_r',
    displayName: 'David',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    status: 'offline',
    aboutMe: 'Back around 8 PM.',
  },
];

export const MOCK_CATEGORIES: ChannelCategory[] = [
  { id: 'cat-text', serverId: 'srv-1', name: 'TEXT CHANNELS', position: 0 },
  { id: 'cat-voice', serverId: 'srv-1', name: 'VOICE CHANNELS', position: 1 },
];

export const MOCK_CHANNELS: Channel[] = [
  { id: 'ch-announcements', serverId: 'srv-1', categoryId: 'cat-text', name: 'announcements', type: 'text', topic: 'Important server notices and updates', position: 0 },
  { id: 'ch-general', serverId: 'srv-1', categoryId: 'cat-text', name: 'general', type: 'text', topic: 'Squad headquarters and general chat', position: 1 },
  { id: 'ch-gaming', serverId: 'srv-1', categoryId: 'cat-text', name: 'gaming', type: 'text', topic: 'Game clips, stats, squad up invites', position: 2 },
  { id: 'ch-memes', serverId: 'srv-1', categoryId: 'cat-text', name: 'memes', type: 'text', topic: 'Top tier memes only please', position: 3 },
  { id: 'ch-random', serverId: 'srv-1', categoryId: 'cat-text', name: 'random', type: 'text', topic: 'Off-topic thoughts and shower musings', position: 4 },
  { id: 'ch-media', serverId: 'srv-1', categoryId: 'cat-text', name: 'media', type: 'text', topic: 'Photos, setups, music links', position: 5 },

  // Voice channels
  { id: 'vc-general', serverId: 'srv-1', categoryId: 'cat-voice', name: 'General VC', type: 'voice', position: 0 },
  { id: 'vc-gaming', serverId: 'srv-1', categoryId: 'cat-voice', name: 'Gaming VC', type: 'voice', position: 1 },
  { id: 'vc-study', serverId: 'srv-1', categoryId: 'cat-voice', name: 'Study VC', type: 'voice', position: 2 },
  { id: 'vc-latenight', serverId: 'srv-1', categoryId: 'cat-voice', name: 'Late Night VC', type: 'voice', position: 3 },
  { id: 'vc-private', serverId: 'srv-1', categoryId: 'cat-voice', name: 'Private VC', type: 'voice', position: 4, isPrivate: true },
];

export const MOCK_CUSTOM_EMOJIS: CustomEmoji[] = [
  { id: 'emo-1', name: 'pepe_comfy', imageUrl: 'https://cdn3.emoji.gg/emojis/8724-pepe-comfy.png', creatorId: 'usr-admin-1', createdAt: new Date().toISOString() },
  { id: 'emo-2', name: 'cat_vibing', imageUrl: 'https://cdn3.emoji.gg/emojis/4346-catvibing.gif', creatorId: 'usr-admin-1', createdAt: new Date().toISOString() },
  { id: 'emo-3', name: 'poggers', imageUrl: 'https://cdn3.emoji.gg/emojis/8488_poggers.png', creatorId: 'usr-admin-1', createdAt: new Date().toISOString() },
  { id: 'emo-4', name: 'hype_fire', imageUrl: 'https://cdn3.emoji.gg/emojis/9672_fire.png', creatorId: 'usr-admin-1', createdAt: new Date().toISOString() },
];

export const MOCK_MESSAGES: Record<string, Message[]> = {
  'ch-general': [
    {
      id: 'msg-1',
      channelId: 'ch-general',
      senderId: 'usr-admin-1',
      sender: CURRENT_USER,
      content: 'Welcome everyone to SquadSpace! 🎉 Built this private server for our gang so we have our own clean voice & chat hangout with zero ads or tracking.',
      reactions: [
        { emoji: '🔥', users: ['usr-2', 'usr-3', 'usr-4'], count: 3 },
        { emoji: '🚀', users: ['usr-2'], count: 1 },
      ],
      isPinned: true,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'msg-2',
      channelId: 'ch-general',
      senderId: 'usr-2',
      sender: MOCK_USERS[1],
      content: 'Yo this looks sick! The dark theme feels just like Discord but snappier. Are voice channels live?',
      reactions: [{ emoji: '👀', users: ['usr-admin-1', 'usr-3'], count: 2 }],
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
    {
      id: 'msg-3',
      channelId: 'ch-general',
      senderId: 'usr-3',
      sender: MOCK_USERS[2],
      content: 'Love that we can install it directly as a desktop PWA too! Already pinned it to my taskbar ✨',
      replyTo: {
        id: 'msg-2',
        senderUsername: 'marcus_gg',
        content: 'Yo this looks sick! The dark theme feels just like Discord but snappier. Are voice channels live?',
      },
      reactions: [{ emoji: '❤️', users: ['usr-admin-1'], count: 1 }],
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'msg-4',
      channelId: 'ch-general',
      senderId: 'usr-admin-1',
      sender: CURRENT_USER,
      content: 'Hop into General VC or Gaming VC anytime! Full WebRTC multi-user audio with speaking indicators and screen sharing is ready to rock.',
      reactions: [{ emoji: '🎧', users: ['usr-2', 'usr-3'], count: 2 }],
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
  ],
  'ch-gaming': [
    {
      id: 'msg-g1',
      channelId: 'ch-gaming',
      senderId: 'usr-2',
      sender: MOCK_USERS[1],
      content: 'Need +2 for Valorant comp right now! Hop in Gaming VC if you are down 🎮',
      reactions: [{ emoji: '🔫', users: ['usr-3'], count: 1 }],
      createdAt: new Date(Date.now() - 2400000).toISOString(),
    },
  ],
  'ch-memes': [
    {
      id: 'msg-m1',
      channelId: 'ch-memes',
      senderId: 'usr-4',
      sender: MOCK_USERS[3],
      content: 'When the code compiles on the first try:',
      attachments: [
        {
          id: 'att-1',
          url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
          type: 'image',
          name: 'pure_magic.jpg',
        },
      ],
      reactions: [{ emoji: '😂', users: ['usr-admin-1', 'usr-2', 'usr-3'], count: 3 }],
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
  ],
};
