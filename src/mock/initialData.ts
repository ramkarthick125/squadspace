import { Channel, ChannelCategory, CustomEmoji, Message, UserProfile } from '../types';

// Zero template / mock data. Everything is created live by real users in Supabase.
export const CURRENT_USER: UserProfile = {
  id: '',
  username: '',
  displayName: '',
  avatarUrl: '',
  status: 'offline',
  isAdmin: false,
};

export const MOCK_USERS: UserProfile[] = [];

export const MOCK_CATEGORIES: ChannelCategory[] = [];

export const MOCK_CHANNELS: Channel[] = [];

export const MOCK_CUSTOM_EMOJIS: CustomEmoji[] = [];

export const MOCK_MESSAGES: Record<string, Message[]> = {};
