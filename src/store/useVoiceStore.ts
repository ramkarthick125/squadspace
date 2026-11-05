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
    options?: { systemAudio?: boolean }
  ) => Promise<void>;
  setSpeaking: (channelId: string, userId: string, isSpeaking: boolean) => void;
}

let audioLevelUnsub: (() => void) | null = null;
let speakingUnsub: (() => void) | null = null;
let remoteTrackUnsub: (() => void) | null = null;
let participantJoinedUnsub: (() => void) | null = null;
let participantLeftUnsub: (() => void) | null = null;
let participantUpdateUnsub: (() => void) | null = null;

export const useVoiceStore = create<VoiceState>((set, get) => ({
  activeVoiceChannelId: null,
  connectionState: 'disconnected',
  engineMode: 'p2p', // 100% Free direct P2P mesh by default
  streamQuality: 'balanced',
  isMuted: false,
  isDeafened: false,
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
    participantJoinedUnsub = webrtcManager.onParticipantJoined((remoteUser, remoteMuted, remoteScreen) => {
      const { activeVoiceChannelId, participantsByChannel } = get();
      if (!activeVoiceChannelId) return;

      const currentList = participantsByChannel[activeVoiceChannelId] || [];
      if (!currentList.some((p) => p.userId === remoteUser.id)) {
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
        sounds.playJoinVoice();
      }
    });

    if (participantLeftUnsub) participantLeftUnsub();
    participantLeftUnsub = webrtcManager.onParticipantLeft((peerId) => {
      const { activeVoiceChannelId, participantsByChannel } = get();
      if (!activeVoiceChannelId) return;

      const currentList = participantsByChannel[activeVoiceChannelId] || [];
      set({
        participantsByChannel: {
          ...participantsByChannel,
          [activeVoiceChannelId]: currentList.filter((p) => p.userId !== peerId),
        },
      });
      sounds.playLeaveVoice();
    });

    if (participantUpdateUnsub) participantUpdateUnsub();
    participantUpdateUnsub = webrtcManager.onParticipantUpdate((peerId, updates) => {
      const { activeVoiceChannelId, participantsByChannel } = get();
      if (!activeVoiceChannelId) return;

      const currentList = participantsByChannel[activeVoiceChannelId] || [];
      set({
        participantsByChannel: {
          ...participantsByChannel,
          [activeVoiceChannelId]: currentList.map((p) =>
            p.userId === peerId ? { ...p, ...updates } : p
          ),
        },
      });
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

    sounds.playJoinVoice();
    realtimeService.broadcastVoiceState(channelId, currentUser, 'joined', isMuted);
    return true;
  },

  leaveVoiceChannel: (currentUser) => {
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
