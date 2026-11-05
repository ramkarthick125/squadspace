import React, { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, RemoteTrack, RemoteParticipant, LocalParticipant } from 'livekit-client';
import { useVoiceStore } from '../../store/useVoiceStore';
import { useAuthStore } from '../../store/useAuthStore';
import { isLiveKitConfigured, getLiveKitToken } from '../../lib/livekit';

export const LiveKitVoiceManager: React.FC = () => {
  const { currentUser } = useAuthStore();
  const {
    activeVoiceChannelId,
    isMuted,
    isDeafened,
    isScreenSharing,
    engineMode,
    setSpeaking,
  } = useVoiceStore();

  const roomRef = useRef<Room | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');

  useEffect(() => {
    if (!activeVoiceChannelId || engineMode !== 'livekit') {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      return;
    }

    if (!isLiveKitConfigured) {
      // Local development fallback
      return;
    }

    let isCancelled = false;

    async function connectToLiveKit() {
      try {
        const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
        const roomName = `squadspace-${activeVoiceChannelId}`;
        const token = await getLiveKitToken(roomName, currentUser.displayName, currentUser.id);

        if (isCancelled) return;

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: {
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        roomRef.current = room;

        room
          .on(RoomEvent.Connected, () => {
            setConnectionStatus('connected');
          })
          .on(RoomEvent.Disconnected, () => {
            setConnectionStatus('disconnected');
          })
          .on(RoomEvent.Reconnecting, () => {
            setConnectionStatus('reconnecting');
          })
          .on(RoomEvent.Reconnected, () => {
            setConnectionStatus('connected');
          })
          .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
            const activeIds = speakers.map((s) => s.identity);
            if (activeVoiceChannelId) {
              setSpeaking(activeVoiceChannelId, currentUser.id, activeIds.includes(currentUser.id));
            }
          })
          .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication, participant: RemoteParticipant) => {
            if (track.kind === Track.Kind.Audio) {
              const audioElement = track.attach();
              audioElement.muted = isDeafened;
            }
          });

        await room.connect(livekitUrl, token);

        // Publish local mic
        await room.localParticipant.setMicrophoneEnabled(!isMuted);
      } catch (err) {
        console.warn('LiveKit connection error (check token or LiveKit URL):', err);
      }
    }

    connectToLiveKit();

    return () => {
      isCancelled = true;
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, [activeVoiceChannelId]);

  // Sync mute state to LiveKit
  useEffect(() => {
    if (roomRef.current && roomRef.current.state === 'connected') {
      roomRef.current.localParticipant.setMicrophoneEnabled(!isMuted).catch(console.warn);
    }
  }, [isMuted]);

  // Sync screen share state to LiveKit
  useEffect(() => {
    if (roomRef.current && roomRef.current.state === 'connected') {
      if (isScreenSharing) {
        roomRef.current.localParticipant
          .setScreenShareEnabled(true, {
            audio: true, // share system audio alongside screen!
            resolution: { width: 1280, height: 720 },
          })
          .catch((err) => {
            console.warn('Screen share permission denied or cancelled:', err);
            useVoiceStore.setState({ isScreenSharing: false, screenShareParticipantId: null });
          });
      } else {
        roomRef.current.localParticipant.setScreenShareEnabled(false).catch(console.warn);
      }
    }
  }, [isScreenSharing]);

  return null;
};
