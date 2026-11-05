export interface LiveKitConnectionDetails {
  serverUrl: string;
  roomName: string;
  participantToken: string;
  participantName: string;
}

export type VoiceEngineMode = 'p2p' | 'livekit';

export type ScreenSharePreset =
  | 'bandwidth-saver'
  | 'balanced'
  | 'high-quality'
  | '2k-crisp'
  | '2k-gaming';

export const SCREEN_SHARE_PRESETS: Record<
  ScreenSharePreset,
  {
    name: string;
    resolution: { width: number; height: number };
    frameRate: number;
    maxBitrate: number;
    description: string;
    tag: string;
  }
> = {
  'bandwidth-saver': {
    name: 'Bandwidth Saver (720p @ 15fps)',
    resolution: { width: 1280, height: 720 },
    frameRate: 15,
    maxBitrate: 800_000,
    description: 'Perfect for reading code or documents. Uses only ~360 MB/hr.',
    tag: 'Low Data',
  },
  balanced: {
    name: 'Balanced (720p @ 30fps)',
    resolution: { width: 1280, height: 720 },
    frameRate: 30,
    maxBitrate: 1_500_000,
    description: 'Great for casual gaming and video clips. Smooth & reliable.',
    tag: 'Recommended',
  },
  'high-quality': {
    name: 'Full HD (1080p @ 30fps)',
    resolution: { width: 1920, height: 1080 },
    frameRate: 30,
    maxBitrate: 3_000_000,
    description: 'Crisp 1080p stream for desktop and detailed gaming.',
    tag: '1080p',
  },
  '2k-crisp': {
    name: 'Ultra 2K (1440p @ 30fps)',
    resolution: { width: 2560, height: 1440 },
    frameRate: 30,
    maxBitrate: 5_000_000,
    description: 'High-definition 2K resolution (2560x1440). Direct P2P recommended.',
    tag: '2K QHD',
  },
  '2k-gaming': {
    name: 'Ultra 2K Pro (1440p @ 60fps)',
    resolution: { width: 2560, height: 1440 },
    frameRate: 60,
    maxBitrate: 8_500_000,
    description: 'Ultimate 2K 60fps stream for competitive gaming. Requires fast home upload.',
    tag: '2K 60FPS',
  },
};

const livekitServerUrl = import.meta.env.VITE_LIVEKIT_URL || '';

export const isLiveKitConfigured = Boolean(livekitServerUrl);

/**
 * Request access token from Supabase Edge Function or backend endpoint.
 * This ensures the LiveKit API Secret is NEVER exposed to client browsers.
 */
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
