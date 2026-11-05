/**
 * WebRTC P2P Direct Mesh & Audio Manager for SquadSpace
 * 
 * Provides:
 * 1. 100% Direct P2P WebRTC audio & screen streaming (0 server bandwidth, unlimited minutes)
 * 2. 2K (1440p) @ 30fps and 60fps screen sharing via hardware GPU acceleration
 * 3. Dual Signaling: Local BroadcastChannel (inter-tab) + Supabase Realtime Broadcast (inter-device/internet)
 * 4. Real hardware microphone capture with Web Audio API Voice Activity Detection (VAD)
 * 5. Free global Google STUN servers (stun.l.google.com:19302)
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SCREEN_SHARE_PRESETS, ScreenSharePreset } from './livekit';
import { UserProfile, VoiceParticipant } from '../types';

export interface PeerConnectionInfo {
  peerId: string;
  pc: RTCPeerConnection;
  remoteAudioStream?: MediaStream;
  remoteScreenStream?: MediaStream;
}

type AudioLevelCallback = (volumePercent: number, isSpeaking: boolean) => void;
type ParticipantJoinedCallback = (user: UserProfile, isMuted?: boolean, isScreenSharing?: boolean) => void;
type ParticipantLeftCallback = (userId: string) => void;
type ParticipantUpdateCallback = (userId: string, updates: Partial<VoiceParticipant>) => void;

class WebRTCManager {
  private localAudioStream: MediaStream | null = null;
  private localScreenStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphoneSource: MediaStreamAudioSourceNode | null = null;
  private animationFrameId: number | null = null;

  private localSignalingChannel: BroadcastChannel | null = null;
  private supabaseSignalingChannel: RealtimeChannel | null = null;
  private peers: Map<string, RTCPeerConnection> = new Map();
  private remoteAudioElements: Map<string, HTMLAudioElement> = new Map();

  private currentUser: UserProfile | null = null;
  private myUserId: string = '';
  private currentChannelId: string | null = null;
  private isMuted: boolean = false;
  private isDeafened: boolean = false;

  private onAudioLevelCallbacks: Set<AudioLevelCallback> = new Set();
  private onRemoteTrackCallbacks: Set<(peerId: string, track: MediaStreamTrack, stream: MediaStream) => void> = new Set();
  private onSpeakingChangeCallbacks: Set<(userId: string, isSpeaking: boolean) => void> = new Set();
  private onParticipantJoinedCallbacks: Set<ParticipantJoinedCallback> = new Set();
  private onParticipantLeftCallbacks: Set<ParticipantLeftCallback> = new Set();
  private onParticipantUpdateCallbacks: Set<ParticipantUpdateCallback> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.localSignalingChannel = new BroadcastChannel('squadspace_webrtc_signaling_v2');
        this.localSignalingChannel.onmessage = this.handleSignalingMessage.bind(this);
      } catch {}
    }
  }

  /**
   * Initialize local audio and join voice channel
   */
  async joinVoiceChannel(channelId: string, user: UserProfile): Promise<boolean> {
    this.currentUser = user;
    this.myUserId = user.id;
    this.currentChannelId = channelId;

    try {
      // 1. Request real microphone hardware access
      this.localAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // 2. Set up Web Audio API volume analysis & speaking detection
      this.initAudioAnalysis();
    } catch (err) {
      console.warn('Microphone permission note: Operating in listen-only mode.');
      this.localAudioStream = null;
    }

    // 3. Connect Supabase Realtime broadcast for inter-device internet signaling
    if (isSupabaseConfigured && supabase) {
      try {
        if (this.supabaseSignalingChannel) {
          supabase.removeChannel(this.supabaseSignalingChannel);
        }

        this.supabaseSignalingChannel = supabase.channel(`voice_signaling_${channelId}`, {
          config: { broadcast: { self: false } },
        });

        this.supabaseSignalingChannel
          .on('broadcast', { event: 'signal' }, (payload) => {
            this.handleSignalingPayload(payload.payload);
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              this.broadcastJoin();
            }
          });
      } catch (err) {
        console.warn('Signaling channel setup note:', err);
      }
    }

    // 4. Send join signal immediately on local broadcast channel (for multi-tab testing)
    this.broadcastJoin();

    // Repeat join burst after 800ms and 1800ms to guarantee handshakes
    setTimeout(() => this.broadcastJoin(), 800);
    setTimeout(() => this.broadcastJoin(), 1800);

    return true;
  }

  private broadcastJoin() {
    if (!this.currentChannelId || !this.currentUser) return;
    this.sendSignal({
      type: 'join',
      senderId: this.myUserId,
      channelId: this.currentChannelId,
      user: this.currentUser,
      isMuted: this.isMuted,
      isScreenSharing: Boolean(this.localScreenStream),
    });
  }

  /**
   * Leave voice channel and clean up all media hardware tracks
   */
  leaveVoiceChannel() {
    if (this.currentChannelId) {
      this.sendSignal({
        type: 'leave',
        senderId: this.myUserId,
        channelId: this.currentChannelId,
      });
    }

    // Stop local microphone tracks
    if (this.localAudioStream) {
      this.localAudioStream.getTracks().forEach((track) => track.stop());
      this.localAudioStream = null;
    }

    // Stop screen share if active
    this.stopScreenShare();

    // Close AudioContext
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    // Unsubscribe from Supabase signaling channel
    if (this.supabaseSignalingChannel && supabase) {
      supabase.removeChannel(this.supabaseSignalingChannel);
      this.supabaseSignalingChannel = null;
    }

    // Close all peer connections
    this.peers.forEach((pc) => pc.close());
    this.peers.clear();

    // Remove remote audio elements
    this.remoteAudioElements.forEach((el) => {
      el.pause();
      el.remove();
    });
    this.remoteAudioElements.clear();

    this.currentChannelId = null;
    this.currentUser = null;
  }

  /**
   * Start real screen sharing with resolution preset (Supports 2K / 1440p)
   */
  async startScreenShare(presetKey: ScreenSharePreset = 'balanced'): Promise<MediaStream | null> {
    const preset = SCREEN_SHARE_PRESETS[presetKey] || SCREEN_SHARE_PRESETS.balanced;

    try {
      this.localScreenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          frameRate: { ideal: preset.frameRate, max: preset.frameRate },
          width: { ideal: preset.resolution.width, max: preset.resolution.width },
          height: { ideal: preset.resolution.height, max: preset.resolution.height },
        },
        audio: true,
      });

      this.localScreenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare();
      };

      const videoTrack = this.localScreenStream.getVideoTracks()[0];
      if (videoTrack) {
        this.peers.forEach((pc) => {
          const sender = pc.addTrack(videoTrack, this.localScreenStream!);
          if (sender && sender.getParameters) {
            try {
              const params = sender.getParameters();
              if (!params.encodings || params.encodings.length === 0) {
                params.encodings = [{}];
              }
              params.encodings[0].maxBitrate = preset.maxBitrate;
              sender.setParameters(params).catch(() => {});
            } catch {}
          }
        });

        this.peers.forEach((_, peerId) => {
          this.createAndSendOffer(peerId);
        });

        this.sendSignal({
          type: 'screen-start',
          senderId: this.myUserId,
          channelId: this.currentChannelId || '',
        });
      }

      return this.localScreenStream;
    } catch (err) {
      console.warn('Screen share cancelled or denied:', err);
      return null;
    }
  }

  /**
   * Stop real screen sharing
   */
  stopScreenShare() {
    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((track) => track.stop());
      this.localScreenStream = null;

      this.sendSignal({
        type: 'screen-stop',
        senderId: this.myUserId,
        channelId: this.currentChannelId || '',
      });
    }
  }

  getLocalScreenStream(): MediaStream | null {
    return this.localScreenStream;
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.localAudioStream) {
      this.localAudioStream.getAudioTracks().forEach((t) => {
        t.enabled = !muted;
      });
    }
    this.sendSignal({
      type: 'mute-change',
      senderId: this.myUserId,
      channelId: this.currentChannelId || '',
      isMuted: muted,
    });
  }

  setDeafened(deafened: boolean) {
    this.isDeafened = deafened;
    if (deafened) {
      this.setMuted(true);
    }
    this.remoteAudioElements.forEach((el) => {
      el.muted = deafened;
    });
  }

  onAudioLevel(callback: AudioLevelCallback): () => void {
    this.onAudioLevelCallbacks.add(callback);
    return () => this.onAudioLevelCallbacks.delete(callback);
  }

  onRemoteTrack(callback: (peerId: string, track: MediaStreamTrack, stream: MediaStream) => void): () => void {
    this.onRemoteTrackCallbacks.add(callback);
    return () => this.onRemoteTrackCallbacks.delete(callback);
  }

  onSpeakingChange(callback: (userId: string, isSpeaking: boolean) => void): () => void {
    this.onSpeakingChangeCallbacks.add(callback);
    return () => this.onSpeakingChangeCallbacks.delete(callback);
  }

  onParticipantJoined(callback: ParticipantJoinedCallback): () => void {
    this.onParticipantJoinedCallbacks.add(callback);
    return () => this.onParticipantJoinedCallbacks.delete(callback);
  }

  onParticipantLeft(callback: ParticipantLeftCallback): () => void {
    this.onParticipantLeftCallbacks.add(callback);
    return () => this.onParticipantLeftCallbacks.delete(callback);
  }

  onParticipantUpdate(callback: ParticipantUpdateCallback): () => void {
    this.onParticipantUpdateCallbacks.add(callback);
    return () => this.onParticipantUpdateCallbacks.delete(callback);
  }

  // --------------------------------------------------------------------------
  // Web Audio API VAD (Voice Activity Detection)
  // --------------------------------------------------------------------------

  private initAudioAnalysis() {
    if (!this.localAudioStream) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.3;

      this.microphoneSource = this.audioContext.createMediaStreamSource(this.localAudioStream);
      this.microphoneSource.connect(this.analyser);

      const buffer = new Uint8Array(this.analyser.frequencyBinCount);
      let wasSpeaking = false;

      const checkAudioLevel = () => {
        if (!this.analyser) return;

        if (this.isMuted) {
          this.onAudioLevelCallbacks.forEach((cb) => cb(0, false));
          if (wasSpeaking) {
            wasSpeaking = false;
            this.onSpeakingChangeCallbacks.forEach((cb) => cb(this.myUserId, false));
          }
          this.animationFrameId = requestAnimationFrame(checkAudioLevel);
          return;
        }

        this.analyser.getByteFrequencyData(buffer);

        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const average = sum / buffer.length;
        const volumePercent = Math.min(100, Math.round((average / 128) * 100));
        const isSpeaking = volumePercent > 12;

        this.onAudioLevelCallbacks.forEach((cb) => cb(volumePercent, isSpeaking));

        if (isSpeaking !== wasSpeaking) {
          wasSpeaking = isSpeaking;
          this.onSpeakingChangeCallbacks.forEach((cb) => cb(this.myUserId, isSpeaking));
        }

        this.animationFrameId = requestAnimationFrame(checkAudioLevel);
      };

      this.animationFrameId = requestAnimationFrame(checkAudioLevel);
    } catch (err) {
      console.warn('AudioContext setup note:', err);
    }
  }

  // --------------------------------------------------------------------------
  // PeerConnection & Signaling
  // --------------------------------------------------------------------------

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
      ],
      iceCandidatePoolSize: 10,
    });

    if (this.localAudioStream) {
      this.localAudioStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, this.localAudioStream!);
      });
    }

    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localScreenStream!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type: 'candidate',
          candidate: event.candidate,
          targetId: peerId,
          senderId: this.myUserId,
          channelId: this.currentChannelId || '',
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);

      if (event.track.kind === 'audio') {
        let audioEl = this.remoteAudioElements.get(peerId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          audioEl.muted = this.isDeafened;
          this.remoteAudioElements.set(peerId, audioEl);
        }
        audioEl.srcObject = stream;
        audioEl.play().catch(() => {});
      }

      this.onRemoteTrackCallbacks.forEach((cb) => cb(peerId, event.track, stream));
    };

    this.peers.set(peerId, pc);
    return pc;
  }

  private async createAndSendOffer(peerId: string) {
    const pc = this.peers.get(peerId) || this.createPeerConnection(peerId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendSignal({
        type: 'offer',
        sdp: offer,
        targetId: peerId,
        senderId: this.myUserId,
        channelId: this.currentChannelId || '',
      });
    } catch (err) {
      console.error('Error creating offer:', err);
    }
  }

  private handleSignalingMessage(event: MessageEvent) {
    this.handleSignalingPayload(event.data);
  }

  private async handleSignalingPayload(data: any) {
    if (!data || data.senderId === this.myUserId) return;
    if (data.channelId !== this.currentChannelId) return;

    switch (data.type) {
      case 'join': {
        // A new peer joined the voice channel!
        if (data.user) {
          this.onParticipantJoinedCallbacks.forEach((cb) =>
            cb(data.user, data.isMuted, data.isScreenSharing)
          );
        }

        // Announce ourselves back so the joining user knows we are here
        if (this.currentUser) {
          this.sendSignal({
            type: 'announce',
            targetId: data.senderId,
            senderId: this.myUserId,
            channelId: this.currentChannelId,
            user: this.currentUser,
            isMuted: this.isMuted,
            isScreenSharing: Boolean(this.localScreenStream),
          });
        }

        // Send WebRTC offer
        await this.createAndSendOffer(data.senderId);
        break;
      }

      case 'announce': {
        // An existing peer announced themselves in response to our join signal
        if (data.targetId === this.myUserId && data.user) {
          this.onParticipantJoinedCallbacks.forEach((cb) =>
            cb(data.user, data.isMuted, data.isScreenSharing)
          );
        }
        break;
      }

      case 'leave': {
        const pc = this.peers.get(data.senderId);
        if (pc) {
          pc.close();
          this.peers.delete(data.senderId);
        }
        const audioEl = this.remoteAudioElements.get(data.senderId);
        if (audioEl) {
          audioEl.pause();
          audioEl.remove();
          this.remoteAudioElements.delete(data.senderId);
        }

        this.onParticipantLeftCallbacks.forEach((cb) => cb(data.senderId));
        break;
      }

      case 'mute-change': {
        this.onParticipantUpdateCallbacks.forEach((cb) =>
          cb(data.senderId, { isMuted: data.isMuted })
        );
        break;
      }

      case 'screen-start': {
        this.onParticipantUpdateCallbacks.forEach((cb) =>
          cb(data.senderId, { isScreenSharing: true })
        );
        break;
      }

      case 'screen-stop': {
        this.onParticipantUpdateCallbacks.forEach((cb) =>
          cb(data.senderId, { isScreenSharing: false })
        );
        break;
      }

      case 'offer': {
        if (data.targetId === this.myUserId) {
          let pc = this.peers.get(data.senderId);
          if (!pc) pc = this.createPeerConnection(data.senderId);

          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          this.sendSignal({
            type: 'answer',
            sdp: answer,
            targetId: data.senderId,
            senderId: this.myUserId,
            channelId: this.currentChannelId || '',
          });
        }
        break;
      }

      case 'answer': {
        if (data.targetId === this.myUserId) {
          const pc = this.peers.get(data.senderId);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          }
        }
        break;
      }

      case 'candidate': {
        if (data.targetId === this.myUserId) {
          const pc = this.peers.get(data.senderId);
          if (pc && data.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (err) {
              console.warn('ICE candidate error:', err);
            }
          }
        }
        break;
      }
    }
  }

  private sendSignal(payload: any) {
    // 1. Broadcast locally for multi-tab
    if (this.localSignalingChannel) {
      try {
        this.localSignalingChannel.postMessage(payload);
      } catch {}
    }
    // 2. Broadcast via Supabase Realtime for internet devices
    if (this.supabaseSignalingChannel) {
      try {
        this.supabaseSignalingChannel.send({
          type: 'broadcast',
          event: 'signal',
          payload,
        });
      } catch {}
    }
  }
}

export const webrtcManager = new WebRTCManager();
