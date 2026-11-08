export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface GamingActivity {
  game: string;
  details?: string;
  startedAt?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  status: UserStatus;
  customStatus?: string;
  gamingActivity?: GamingActivity;
  aboutMe?: string;
  isAdmin?: boolean;
  createdAt?: string;
}

export interface Server {
  id: string;
  name: string;
  icon?: string;
  iconUrl?: string;
  ownerId: string;
  createdAt?: string;
}

export type ChannelType = 'text' | 'voice';

export interface ChannelCategory {
  id: string;
  serverId: string;
  name: string;
  position: number;
}

export interface Channel {
  id: string;
  serverId: string;
  categoryId?: string;
  name: string;
  type: ChannelType;
  topic?: string;
  position: number;
  isPrivate?: boolean;
}

export interface MessageAttachment {
  id: string;
  url: string;
  type: 'image' | 'video' | 'file' | 'server_invite' | 'friend_invite';
  name: string;
  size?: number;
}

export interface MessageReaction {
  emoji: string;
  users: string[]; // array of user IDs
  count: number;
}

export interface ReplyReference {
  id: string;
  senderUsername: string;
  content: string;
}

export interface Message {
  id: string;
  channelId?: string;
  conversationId?: string;
  senderId: string;
  sender: UserProfile;
  content: string;
  attachments?: MessageAttachment[];
  replyTo?: ReplyReference;
  reactions: MessageReaction[];
  isPinned?: boolean;
  isEdited?: boolean;
  createdAt: string;
}

export interface VoiceParticipant {
  userId: string;
  user: UserProfile;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  isScreenSharing: boolean;
  joinedAt: string;
}

export interface Conversation {
  id: string;
  isGroup: boolean;
  name?: string;
  members: UserProfile[];
  lastMessage?: Message;
  unreadCount?: number;
}

export interface CustomEmoji {
  id: string;
  name: string;
  imageUrl: string;
  creatorId: string;
  createdAt: string;
}

export interface ServerInvite {
  code: string;
  serverId: string;
  creatorId: string;
  uses: number;
  maxUses?: number;
  createdAt: string;
  expiresAt?: string;
}

export interface DesktopCaptureSource {
  id: string;
  name: string;
  thumbnail: string | null;
  appIcon: string | null;
  display_id?: string;
  isScreen: boolean;
}

export interface ElectronAPI {
  isElectron: boolean;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizeChange: (callback: (isMax: boolean) => void) => () => void;
  getScreenSources: () => Promise<DesktopCaptureSource[]>;
  onToggleMute: (callback: () => void) => () => void;
  onToggleDeafen: (callback: () => void) => () => void;
  onAppCommandMouse?: (callback: (button: 'Mouse4' | 'Mouse5') => void) => () => void;
  onDeepLink: (callback: (url: string) => void) => () => void;

  // Co-op Remote Play
  coopGetDriverStatus?: () => Promise<{ vigemAvailable: boolean; vigemInitError: string | null; user32Available: boolean }>;
  coopSlotConnect?: (slot: number, inputMode: string) => Promise<{ success: boolean; error?: string }>;
  coopSlotDisconnect?: (slot: number) => Promise<boolean>;
  coopSetPause?: (slot: number, isPaused: boolean) => Promise<boolean>;
  coopSetMode?: (slot: number, inputMode: string) => Promise<boolean>;
  coopInjectGamepad?: (slot: number, data: any) => void;
  coopInjectKeyboard?: (slot: number, data: any) => void;
  coopInjectMouse?: (slot: number, data: any) => void;
  coopPanicDisconnectAll?: () => Promise<boolean>;
  onCoopPanic?: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
