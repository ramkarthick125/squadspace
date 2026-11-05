export interface LiveKitConnectionDetails {
  serverUrl: string;
  roomName: string;
  participantToken: string;
  participantName: string;
}

export type VoiceEngineMode = 'p2p' | 'livekit';

export type ScreenSharePreset =
  | '1080p-60'
  | '1080p-30'
  | '1440p-60'
  | '1440p-30'
  | '720p-60'
  | '720p-30'
  | 'source-60'
  | 'bandwidth-saver'
  | 'balanced'
  | 'high-quality'
  | '2k-crisp'
  | '2k-gaming';

export interface ScreenPresetConfig {
  name: string;
  resolution: { width: number; height: number };
  frameRate: number;
  maxBitrate: number;
  description: string;
  tag: string;
  contentHint: 'motion' | 'detail';
}

export const SCREEN_SHARE_PRESETS: Record<ScreenSharePreset, ScreenPresetConfig> = {
  '1080p-60': {
    name: 'Full HD (1080p @ 60fps)',
    resolution: { width: 1920, height: 1080 },
    frameRate: 60,
    maxBitrate: 10_000_000,
    description: 'Crisp 1080p at ultra smooth 60 FPS. Best for fast-paced gaming.',
    tag: '1080p 60FPS',
    contentHint: 'motion',
  },
  '1080p-30': {
    name: 'Full HD (1080p @ 30fps)',
    resolution: { width: 1920, height: 1080 },
    frameRate: 30,
    maxBitrate: 6_000_000,
    description: 'Crisp Full HD stream with balanced bandwidth consumption.',
    tag: '1080p 30FPS',
    contentHint: 'detail',
  },
  '1440p-60': {
    name: 'Ultra 2K Pro (1440p @ 60fps)',
    resolution: { width: 2560, height: 1440 },
    frameRate: 60,
    maxBitrate: 18_000_000,
    description: 'Supreme 2K QHD 60 FPS clarity for high-end monitors and esports.',
    tag: '2K 60FPS',
    contentHint: 'motion',
  },
  '1440p-30': {
    name: 'Ultra 2K (1440p @ 30fps)',
    resolution: { width: 2560, height: 1440 },
    frameRate: 30,
    maxBitrate: 12_000_000,
    description: 'Razor-sharp text and code for software development and spreadsheets.',
    tag: '2K Crisp',
    contentHint: 'detail',
  },
  'source-60': {
    name: 'Source Quality (4K @ 60fps)',
    resolution: { width: 3840, height: 2160 },
    frameRate: 60,
    maxBitrate: 25_000_000,
    description: 'Original native display stream without downsampling.',
    tag: '4K Source',
    contentHint: 'motion',
  },
  '720p-60': {
    name: 'Standard HD (720p @ 60fps)',
    resolution: { width: 1280, height: 720 },
    frameRate: 60,
    maxBitrate: 4_500_000,
    description: 'Smooth 60 FPS stream optimized for lower bandwidth.',
    tag: '720p 60FPS',
    contentHint: 'motion',
  },
  '720p-30': {
    name: 'Standard HD (720p @ 30fps)',
    resolution: { width: 1280, height: 720 },
    frameRate: 30,
    maxBitrate: 2_500_000,
    description: 'Lightweight stream for slower connections.',
    tag: '720p 30FPS',
    contentHint: 'detail',
  },

  // Backwards compatibility aliases
  '2k-gaming': {
    name: 'Ultra 2K Pro (1440p @ 60fps)',
    resolution: { width: 2560, height: 1440 },
    frameRate: 60,
    maxBitrate: 18_000_000,
    description: 'Supreme 2K QHD 60 FPS clarity.',
    tag: '2K 60FPS',
    contentHint: 'motion',
  },
  '2k-crisp': {
    name: 'Ultra 2K (1440p @ 30fps)',
    resolution: { width: 2560, height: 1440 },
    frameRate: 30,
    maxBitrate: 12_000_000,
    description: 'Razor-sharp text and code.',
    tag: '2K Crisp',
    contentHint: 'detail',
  },
  'high-quality': {
    name: 'Full HD (1080p @ 60fps)',
    resolution: { width: 1920, height: 1080 },
    frameRate: 60,
    maxBitrate: 10_000_000,
    description: 'Crisp 1080p 60fps.',
    tag: '1080p',
    contentHint: 'motion',
  },
  balanced: {
    name: 'Full HD (1080p @ 30fps)',
    resolution: { width: 1920, height: 1080 },
    frameRate: 30,
    maxBitrate: 6_000_000,
    description: 'Full HD balanced.',
    tag: 'Recommended',
    contentHint: 'detail',
  },
  'bandwidth-saver': {
    name: 'Standard HD (720p @ 30fps)',
    resolution: { width: 1280, height: 720 },
    frameRate: 30,
    maxBitrate: 2_500_000,
    description: 'Lightweight stream.',
    tag: 'Low Data',
    contentHint: 'detail',
  },
};

const livekitServerUrl = import.meta.env.VITE_LIVEKIT_URL || '';

export const isLiveKitConfigured = Boolean(livekitServerUrl);

export async function getLiveKitToken(
  roomName: string,
  participantName: string,
  userId: string
): Promise<string> {
  const tokenEndpoint = import.meta.env.VITE_LIVEKIT_TOKEN_ENDPOINT;

  if (tokenEndpoint) {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName, participantName, userId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to mint LiveKit token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.token;
  }

  return 'dev-token-placeholder';
}
