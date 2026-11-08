import { create } from 'zustand';
import { UserProfile, VoiceParticipant } from '../types';
import { webrtcManager } from '../lib/webrtcManager';
import { ScreenSharePreset, VoiceEngineMode } from '../lib/livekit';
import { sounds } from '../lib/soundEffects';
import { realtimeService } from '../lib/realtimeService';
import { useAuthStore } from './useAuthStore';

interface VoiceState {
  activeVoiceChannelId: string | null;
  connectionState: 'disconnected' | 'connecting' | 'connected';
  engineMode: VoiceEngineMode;
  streamQuality: ScreenSharePreset;
  isMuted: boolean;
  isDeafened: boolean;
  isScreenSharing: boolean;
  screenShareParticipantId: string | null;
  screenShareStream: MediaStream | null;
  micVolumeLevel: number;
  participantsByChannel: Record<string, VoiceParticipant[]>;

  setEngineMode: (mode: VoiceEngineMode) => void;
  setStreamQuality: (preset: ScreenSharePreset) => void;
  joinVoiceChannel: (channelId: string, currentUser: UserProfile) => Promise<boolean>;
  leaveVoiceChannel: (currentUser: UserProfile) => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleScreenShare: (
    currentUser: UserProfile,
    preset?: ScreenSharePreset,
    options?: { systemAudio?: boolean; sourceId?: string }
  ) => Promise<void>;
  setSpeaking: (channelId: string, userId: string, isSpeaking: boolean) => void;
}

let audioLevelUnsub: (() => void) | null = null;
let speakingUnsub: (() => void) | null = null;
let remoteTrackUnsub: (() => void) | null = null;
let participantJoinedUnsub: (() => void) | null = null;
let participantLeftUnsub: (() => void) | null = null;
let participantUpdateUnsub: (() => void) | null = null;
const playedJoinChimeUserIds = new Set<string>();

const getInitialMuted = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('squadspace_saved_muted') === 'true';
  } catch {
    return false;
  }
};

const getInitialDeafened = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('squadspace_saved_deafened') === 'true';
  } catch {
    return false;
  }
};

export const useVoiceStore = create<VoiceState>((set, get) => ({
  activeVoiceChannelId: null,
  connectionState: 'disconnected',
  engineMode: 'p2p', // 100% Free direct P2P mesh by default
  streamQuality: '1080p-60', // 1080p @ 60 FPS 12 Mbps default
  isMuted: getInitialMuted(),
  isDeafened: getInitialDeafened(),
  isScreenSharing: false,
  screenShareParticipantId: null,
  screenShareStream: null,
  micVolumeLevel: 0,
  participantsByChannel: {},

  setEngineMode: (engineMode) => set({ engineMode }),
  setStreamQuality: (streamQuality) => set({ streamQuality }),

  joinVoiceChannel: async (channelId, currentUser) => {
    const { activeVoiceChannelId, participantsByChannel, isMuted, isDeafened, engineMode } = get();

    set({ connectionState: 'connecting' });

    if (activeVoiceChannelId && activeVoiceChannelId !== channelId) {
      webrtcManager.leaveVoiceChannel();
    }

    if (engineMode === 'p2p') {
      const success = await webrtcManager.joinVoiceChannel(channelId, currentUser);
      if (!success) {
        console.warn('Microphone permission note: Joining in listen mode.');
      }
      webrtcManager.setMuted(isMuted);
      webrtcManager.setDeafened(isDeafened);
    }

    if (audioLevelUnsub) audioLevelUnsub();
    audioLevelUnsub = webrtcManager.onAudioLevel((volumePercent, isSpeaking) => {
      set({ micVolumeLevel: volumePercent });
      get().setSpeaking(channelId, currentUser.id, isSpeaking);
    });

    if (speakingUnsub) speakingUnsub();
    speakingUnsub = webrtcManager.onSpeakingChange((userId, isSpeaking) => {
      get().setSpeaking(channelId, userId, isSpeaking);
    });

    if (remoteTrackUnsub) remoteTrackUnsub();
    remoteTrackUnsub = webrtcManager.onRemoteTrack((peerId, track, stream) => {
      if (track.kind === 'video') {
        set({
          screenShareParticipantId: peerId,
          screenShareStream: stream,
        });
      }
    });

    if (participantJoinedUnsub) participantJoinedUnsub();
    participantJoinedUnsub = webrtcManager.onParticipantJoined(
      (remoteUser, remoteMuted, remoteScreen, customJoinSound, isNewJoin) => {
        const { activeVoiceChannelId, participantsByChannel } = get();
        if (!activeVoiceChannelId) return;

        const currentList = participantsByChannel[activeVoiceChannelId] || [];
        const isAlreadyInList = currentList.some((p) => p.userId === remoteUser.id);

        if (!isAlreadyInList) {
          const newRemoteP: VoiceParticipant = {
            userId: remoteUser.id,
            user: remoteUser,
            isMuted: Boolean(remoteMuted),
            isDeafened: false,
            isSpeaking: false,
            isScreenSharing: Boolean(remoteScreen),
            joinedAt: new Date().toISOString(),
          };

          set({
            participantsByChannel: {
              ...participantsByChannel,
              [activeVoiceChannelId]: [...currentList, newRemoteP],
            },
          });
        }

        // Only play join sound when a NEW user arrives (type === 'join'),
        // not for existing users announcing themselves on connect,
        // and only once per user session
        if (isNewJoin && !playedJoinChimeUserIds.has(remoteUser.id)) {
          playedJoinChimeUserIds.add(remoteUser.id);
          if (customJoinSound) {
            sounds.playCustomSound(customJoinSound);
          } else {
            sounds.playJoinVoice();
          }
        }
      }
    );

    if (participantLeftUnsub) participantLeftUnsub();
    participantLeftUnsub = webrtcManager.onParticipantLeft((peerId) => {
      playedJoinChimeUserIds.delete(peerId);
      const { activeVoiceChannelId, participantsByChannel, screenShareParticipantId } = get();
      if (!activeVoiceChannelId) return;

      const currentList = participantsByChannel[activeVoiceChannelId] || [];
      const newState: any = {
        participantsByChannel: {
          ...participantsByChannel,
          [activeVoiceChannelId]: currentList.filter((p) => p.userId !== peerId),
        },
      };
      if (screenShareParticipantId === peerId) {
        newState.screenShareParticipantId = null;
        newState.screenShareStream = null;
      }
      set(newState);
      sounds.playLeaveVoice();
    });

    if (participantUpdateUnsub) participantUpdateUnsub();
    participantUpdateUnsub = webrtcManager.onParticipantUpdate((peerId, updates) => {
      const { activeVoiceChannelId, participantsByChannel, screenShareParticipantId } = get();
      if (!activeVoiceChannelId) return;

      const currentList = participantsByChannel[activeVoiceChannelId] || [];
      const newState: any = {
        participantsByChannel: {
          ...participantsByChannel,
          [activeVoiceChannelId]: currentList.map((p) =>
            p.userId === peerId ? { ...p, ...updates } : p
          ),
        },
      };

      if (updates.isScreenSharing === false && screenShareParticipantId === peerId) {
        newState.screenShareParticipantId = null;
        newState.screenShareStream = null;
      }

      set(newState);
    });

    let updated = { ...participantsByChannel };
    if (activeVoiceChannelId && activeVoiceChannelId !== channelId) {
      updated[activeVoiceChannelId] = (updated[activeVoiceChannelId] || []).filter(
        (p) => p.userId !== currentUser.id
      );
    }

    const currentChannelParticipants = updated[channelId] || [];
    const withoutMe = currentChannelParticipants.filter((p) => p.userId !== currentUser.id);

    const meParticipant: VoiceParticipant = {
      userId: currentUser.id,
      user: currentUser,
      isMuted,
      isDeafened,
      isSpeaking: false,
      isScreenSharing: false,
      joinedAt: new Date().toISOString(),
    };

    updated[channelId] = [...withoutMe, meParticipant];

    set({
      activeVoiceChannelId: channelId,
      connectionState: 'connected',
      participantsByChannel: updated,
    });

    // Play local entrance sound once: custom chime if set, otherwise default Discord join blip
    try {
      const stored = localStorage.getItem('squadspace_custom_join_sound');
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed?.dataUrl) {
        sounds.playCustomSound(parsed.dataUrl);
      } else {
        sounds.playJoinVoice();
      }
    } catch {
      sounds.playJoinVoice();
    }

    realtimeService.broadcastVoiceState(channelId, currentUser, 'joined', isMuted);
    return true;
  },

  leaveVoiceChannel: (currentUser) => {
    playedJoinChimeUserIds.clear();
    const { activeVoiceChannelId, participantsByChannel } = get();
    if (!activeVoiceChannelId) return;

    realtimeService.broadcastVoiceState(activeVoiceChannelId, currentUser, 'left');
    webrtcManager.leaveVoiceChannel();
    if (audioLevelUnsub) {
      audioLevelUnsub();
      audioLevelUnsub = null;
    }
    if (speakingUnsub) {
      speakingUnsub();
      speakingUnsub = null;
    }
    if (remoteTrackUnsub) {
      remoteTrackUnsub();
      remoteTrackUnsub = null;
    }
    if (participantJoinedUnsub) {
      participantJoinedUnsub();
      participantJoinedUnsub = null;
    }
    if (participantLeftUnsub) {
      participantLeftUnsub();
      participantLeftUnsub = null;
    }
    if (participantUpdateUnsub) {
      participantUpdateUnsub();
      participantUpdateUnsub = null;
    }

    const updated = {
      ...participantsByChannel,
      [activeVoiceChannelId]: (participantsByChannel[activeVoiceChannelId] || []).filter(
        (p) => p.userId !== currentUser.id
      ),
    };

    set({
      activeVoiceChannelId: null,
      connectionState: 'disconnected',
      isScreenSharing: false,
      screenShareParticipantId: null,
      screenShareStream: null,
      micVolumeLevel: 0,
      participantsByChannel: updated,
    });

    sounds.playLeaveVoice();
  },

  toggleMute: () => {
    const { isMuted, activeVoiceChannelId, participantsByChannel } = get();
    const newMuted = !isMuted;

    try {
      localStorage.setItem('squadspace_saved_muted', String(newMuted));
    } catch {}

    webrtcManager.setMuted(newMuted);

    if (newMuted) {
      sounds.playMute();
    } else {
      sounds.playUnmute();
    }

    if (activeVoiceChannelId) {
      const currentUser = useAuthStore.getState().currentUser;
      if (currentUser) {
        realtimeService.broadcastVoiceState(activeVoiceChannelId, currentUser, 'muted', newMuted);
      }

      const channelParticipants = participantsByChannel[activeVoiceChannelId] || [];
      const updatedParticipants = channelParticipants.map((p) =>
        p.userId === currentUser?.id ? { ...p, isMuted: newMuted } : p
      );

      set({
        isMuted: newMuted,
        participantsByChannel: {
          ...participantsByChannel,
          [activeVoiceChannelId]: updatedParticipants,
        },
      });
    } else {
      set({ isMuted: newMuted });
    }
  },

  toggleDeafen: () => {
    const { isDeafened, activeVoiceChannelId, participantsByChannel } = get();
    const newDeafened = !isDeafened;

    try {
      localStorage.setItem('squadspace_saved_deafened', String(newDeafened));
      if (newDeafened) {
        localStorage.setItem('squadspace_saved_muted', 'true');
      }
    } catch {}

    webrtcManager.setDeafened(newDeafened);

    if (activeVoiceChannelId) {
      const channelParticipants = participantsByChannel[activeVoiceChannelId] || [];
      const updatedParticipants = channelParticipants.map((p) =>
        p.user.isAdmin ? { ...p, isDeafened: newDeafened, isMuted: newDeafened ? true : p.isMuted } : p
      );

      set({
        isDeafened: newDeafened,
        isMuted: newDeafened ? true : get().isMuted,
        participantsByChannel: {
          ...participantsByChannel,
          [activeVoiceChannelId]: updatedParticipants,
        },
      });
    } else {
      set({
        isDeafened: newDeafened,
        isMuted: newDeafened ? true : get().isMuted,
      });
    }
  },

  toggleScreenShare: async (currentUser, preset, options) => {
    const { isScreenSharing, activeVoiceChannelId, participantsByChannel, streamQuality } = get();
    if (!activeVoiceChannelId) return;

    if (!isScreenSharing) {
      const selectedPreset = preset || streamQuality;
      const stream = await webrtcManager.startScreenShare(selectedPreset, options);
      if (!stream) return;

      const channelParticipants = participantsByChannel[activeVoiceChannelId] || [];
      const updatedParticipants = channelParticipants.map((p) =>
        p.userId === currentUser.id ? { ...p, isScreenSharing: true } : p
      );

      set({
        isScreenSharing: true,
        screenShareParticipantId: currentUser.id,
        screenShareStream: stream,
        participantsByChannel: {
          ...participantsByChannel,
          [activeVoiceChannelId]: updatedParticipants,
        },
      });

      sounds.playScreenShareStart();
    } else {
      webrtcManager.stopScreenShare();

      const channelParticipants = participantsByChannel[activeVoiceChannelId] || [];
      const updatedParticipants = channelParticipants.map((p) =>
        p.userId === currentUser.id ? { ...p, isScreenSharing: false } : p
      );

      set({
        isScreenSharing: false,
        screenShareParticipantId: null,
        screenShareStream: null,
        participantsByChannel: {
          ...participantsByChannel,
          [activeVoiceChannelId]: updatedParticipants,
        },
      });

      sounds.playScreenShareStop();
    }
  },

  setSpeaking: (channelId, userId, isSpeaking) => {
    const { participantsByChannel } = get();
    const channelParticipants = participantsByChannel[channelId] || [];

    set({
      participantsByChannel: {
        ...participantsByChannel,
        [channelId]: channelParticipants.map((p) =>
          p.userId === userId ? { ...p, isSpeaking } : p
        ),
      },
    });
  },
}));
