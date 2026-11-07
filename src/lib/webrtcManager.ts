/**
 * WebRTC P2P Direct Mesh & Audio Manager for SquadSpace
 * 
 * Provides:
 * 1. 100% Direct P2P WebRTC audio & screen streaming (0 server bandwidth, unlimited minutes)
 * 2. Ultra-Low Latency 60 FPS screen sharing via hardware GPU acceleration & SDP playout delay 0
 * 3. Perfect Negotiation (W3C standard polite/impolite glare handling)
 * 4. ICE candidate queuing (eliminating dropped candidate race conditions)
 * 5. Clean track teardown on screen share stop (eliminating frozen frames)
 * 6. Dual Signaling: Local BroadcastChannel (inter-tab) + Supabase Realtime Broadcast (inter-device/internet)
 * 7. Real hardware microphone capture with Web Audio API Voice Activity Detection (VAD) & Push-to-Talk (PTT)
 * 8. Free global Google STUN servers (stun.l.google.com:19302)
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SCREEN_SHARE_PRESETS, ScreenSharePreset } from './livekit';
import { UserProfile, VoiceParticipant } from '../types';
import { useSettingsStore } from '../store/useSettingsStore';

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

/**
 * Injects WebRTC SDP low-latency attributes:
 * 1. a=playout-delay:0 0 (Chromium low-latency playout extension, eliminates receiver jitter delay)
 * 2. Optimized fmtp bitrate bounds (x-google-min-bitrate & x-google-max-bitrate)
 */
function injectLowLatencySdp(sdp: string, maxBitrateBps: number = 12_000_000): string {
  if (!sdp) return sdp;
  const lines = sdp.split('\r\n');
  const result: string[] = [];
  let inVideo = false;
  const maxBitrateKbps = Math.round(maxBitrateBps / 1000);
  const minBitrateKbps = Math.round(maxBitrateKbps * 0.45);
  const startBitrateKbps = Math.round(maxBitrateKbps * 0.75);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('m=video')) {
      inVideo = true;
      result.push(line);
      // Explicitly inject WebRTC bandwidth allocation bounds (b=AS & b=TIAS) into video block
      result.push(`b=AS:${maxBitrateKbps}`);
      result.push(`b=TIAS:${maxBitrateBps}`);
      continue;
    } else if (line.startsWith('m=audio') || line.startsWith('m=application')) {
      inVideo = false;
    }

    // Skip any existing b=AS or b=TIAS lines inside video block to avoid duplicate overrides
    if (inVideo && (line.startsWith('b=AS:') || line.startsWith('b=TIAS:'))) {
      continue;
    }

    result.push(line);

    // Inject playout-delay right after rtcp-mux or c=IN in video section
    if (inVideo && (line.startsWith('a=rtcp-mux') || line.startsWith('c=IN'))) {
      if (!lines.some((l) => l.includes('a=playout-delay:0 0'))) {
        result.push('a=playout-delay:0 0');
      }
    }

    // Enhance fmtp lines with google bitrate constraints
    if (inVideo && line.startsWith('a=fmtp:')) {
      if (!line.includes('x-google-max-bitrate')) {
        result[result.length - 1] = `${line};x-google-min-bitrate=${minBitrateKbps};x-google-max-bitrate=${maxBitrateKbps};x-google-start-bitrate=${startBitrateKbps}`;
      }
    }
  }

  return result.join('\r\n');
}

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

  // Low latency & Perfect negotiation state
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private makingOffer: Map<string, boolean> = new Map();
  private ignoreOffer: Map<string, boolean> = new Map();
  private screenSenders: Map<string, RTCRtpSender[]> = new Map();
  private currentScreenBitrate: number = 12_000_000;
  private presenceHeartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private isPttActive: boolean = false;

  // Co-op Remote Play Ultra-Low Latency DataChannels
  private coopDataChannels: Map<string, RTCDataChannel> = new Map();
  private onCoopMessageCallbacks: Set<(peerId: string, packet: any) => void> = new Set();

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

      // Initialize audio track state (PTT vs Open Mic)
      this.updateAudioTrackState();

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

    // 4. Send join signal immediately on local broadcast channel
    this.broadcastJoin();
    setTimeout(() => this.broadcastJoin(), 600);
    setTimeout(() => this.broadcastJoin(), 1500);

    // 5. Periodic presence heartbeat (every 4 seconds) to guarantee sync across users
    if (this.presenceHeartbeatInterval) {
      clearInterval(this.presenceHeartbeatInterval);
    }
    this.presenceHeartbeatInterval = setInterval(() => {
      this.broadcastPresence();
    }, 4000);

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

  private broadcastPresence() {
    if (!this.currentChannelId || !this.currentUser) return;
    this.sendSignal({
      type: 'presence',
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
    if (this.presenceHeartbeatInterval) {
      clearInterval(this.presenceHeartbeatInterval);
      this.presenceHeartbeatInterval = null;
    }

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
    this.pendingCandidates.clear();
    this.makingOffer.clear();
    this.ignoreOffer.clear();
    this.screenSenders.clear();

    // Close Co-op data channels
    this.coopDataChannels.forEach((dc) => {
      try {
        dc.close();
      } catch {}
    });
    this.coopDataChannels.clear();

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
   * Start real screen sharing with advanced resolution and framerate settings
   * Supports both Electron Native desktopCapturer (sourceId) and Web getDisplayMedia
   */
  async startScreenShare(
    presetKey: ScreenSharePreset = '1080p-60',
    options?: { systemAudio?: boolean; sourceId?: string }
  ): Promise<MediaStream | null> {
    const preset =
      SCREEN_SHARE_PRESETS[presetKey] ||
      SCREEN_SHARE_PRESETS['1080p-60'] ||
      SCREEN_SHARE_PRESETS.balanced;

    this.currentScreenBitrate = preset.maxBitrate;

    try {
      let stream: MediaStream | null = null;

      if (options?.sourceId) {
        const isScreenSource = options.sourceId.startsWith('screen:');

        // 1. Try native capture with system audio (only on whole screens, Windows limitation for window loopback)
        if (options?.systemAudio !== false && isScreenSource) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                },
              },
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: options.sourceId,
                  maxFrameRate: preset.frameRate,
                  maxWidth: preset.resolution.width,
                  maxHeight: preset.resolution.height,
                },
              },
            } as any);
          } catch (audioErr) {
            console.warn('[ScreenShare] Capture with audio failed, falling back to video-only:', audioErr);
          }
        }

        // 2. Try native capture video-only if audio failed or was not requested
        if (!stream) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: options.sourceId,
                  maxFrameRate: preset.frameRate,
                  maxWidth: preset.resolution.width,
                  maxHeight: preset.resolution.height,
                },
              },
            } as any);
          } catch (vidErr) {
            console.warn('[ScreenShare] Native sourceId capture failed, falling back to getDisplayMedia:', vidErr);
          }
        }
      }

      // 3. Fallback to standard getDisplayMedia (Web or if native source capture failed)
      if (!stream) {
        if (options?.systemAudio !== false) {
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: {
                frameRate: { ideal: preset.frameRate, max: preset.frameRate },
                width: { ideal: preset.resolution.width, max: preset.resolution.width },
                height: { ideal: preset.resolution.height, max: preset.resolution.height },
              },
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              },
            });
          } catch (dispAudioErr) {
            console.warn('[ScreenShare] getDisplayMedia with audio failed, retrying video only:', dispAudioErr);
          }
        }

        if (!stream) {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              frameRate: { ideal: preset.frameRate, max: preset.frameRate },
              width: { ideal: preset.resolution.width, max: preset.resolution.width },
              height: { ideal: preset.resolution.height, max: preset.resolution.height },
            },
            audio: false,
          });
        }
      }

      if (!stream || stream.getVideoTracks().length === 0) {
        throw new Error('No video track obtained from screen capture');
      }

      this.localScreenStream = stream;

      this.localScreenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare();
      };

      const videoTrack = this.localScreenStream.getVideoTracks()[0];
      if (videoTrack) {
        // Enforce content hint so browser encoder prioritizes motion for 60fps
        if ('contentHint' in videoTrack) {
          (videoTrack as any).contentHint =
            preset.contentHint || (preset.frameRate >= 60 ? 'motion' : 'detail');
        }

        const audioTracks = this.localScreenStream.getAudioTracks();

        // Add tracks to each peer and record senders for clean teardown
        this.peers.forEach((pc, peerId) => {
          const addedSenders: RTCRtpSender[] = [];

          const vSender = pc.addTrack(videoTrack, this.localScreenStream!);
          addedSenders.push(vSender);

          // 1. Force hardware GPU H.264 High Profile / VP9 codec preferences on the new video transceiver
          try {
            const transceivers = pc.getTransceivers();
            const videoTransceiver = transceivers.find((t) => t.sender === vSender);
            if (videoTransceiver && 'setCodecPreferences' in videoTransceiver && 'getCapabilities' in RTCRtpSender) {
              const capabilities = RTCRtpSender.getCapabilities('video');
              if (capabilities && capabilities.codecs) {
                // Prioritize H.264 High Profile (NVENC / QuickSync / AMF GPU hardware acceleration)
                const h264High = capabilities.codecs.filter((c) =>
                  c.mimeType.toLowerCase() === 'video/h264' &&
                  c.sdpFmtpLine?.includes('profile-level-id=6400')
                );
                const h264Other = capabilities.codecs.filter((c) =>
                  c.mimeType.toLowerCase() === 'video/h264' &&
                  !c.sdpFmtpLine?.includes('profile-level-id=6400')
                );
                const vp9 = capabilities.codecs.filter((c) => c.mimeType.toLowerCase() === 'video/vp9');
                const rest = capabilities.codecs.filter((c) =>
                  c.mimeType.toLowerCase() !== 'video/h264' && c.mimeType.toLowerCase() !== 'video/vp9'
                );
                videoTransceiver.setCodecPreferences([...h264High, ...h264Other, ...vp9, ...rest]);
              }
            }
          } catch (codecErr) {
            console.warn('Could not set transceiver codec preferences:', codecErr);
          }

          // 2. Configure RTCRtpEncodingParameters with high bitrate and maintain-resolution
          if (vSender && vSender.getParameters) {
            try {
              const params = vSender.getParameters();
              if (!params.encodings || params.encodings.length === 0) {
                params.encodings = [{}];
              }
              params.encodings[0].maxBitrate = preset.maxBitrate;
              (params.encodings[0] as any).minBitrate = Math.round(preset.maxBitrate * 0.45);
              params.encodings[0].maxFramerate = preset.frameRate;
              params.encodings[0].scaleResolutionDownBy = 1.0;
              params.encodings[0].priority = 'high';
              params.encodings[0].networkPriority = 'high';
              // CRITICAL: maintain-resolution guarantees the encoder NEVER drops resolution (prevents 1080p -> 360p downscaling)
              (params as any).degradationPreference = 'maintain-resolution';
              vSender.setParameters(params).catch(() => {});
            } catch {}
          }

          if (audioTracks.length > 0) {
            const aSender = pc.addTrack(audioTracks[0], this.localScreenStream!);
            addedSenders.push(aSender);
          }

          this.screenSenders.set(peerId, addedSenders);
          this.createAndSendOffer(peerId, preset.maxBitrate);
        });

        this.sendSignal({
          type: 'screen-start',
          senderId: this.myUserId,
          channelId: this.currentChannelId || '',
          presetKey,
          maxBitrate: preset.maxBitrate,
        });
      }

      return this.localScreenStream;
    } catch (err) {
      console.warn('Screen share cancelled or denied:', err);
      return null;
    }
  }

  /**
   * Stop real screen sharing and cleanly remove tracks from all peer connections
   */
  stopScreenShare() {
    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((track) => track.stop());
      this.localScreenStream = null;

      // Cleanly remove screen senders from peer connections to avoid frozen last frames
      this.peers.forEach((pc, peerId) => {
        const senders = this.screenSenders.get(peerId);
        if (senders) {
          senders.forEach((s) => {
            try {
              pc.removeTrack(s);
            } catch {}
          });
          this.screenSenders.delete(peerId);
        }
        // Renegotiate clean state
        this.createAndSendOffer(peerId);
      });

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

  /**
   * Push-to-Talk state change
   */
  setPttActive(active: boolean) {
    this.isPttActive = active;
    this.updateAudioTrackState();
  }

  private updateAudioTrackState() {
    if (!this.localAudioStream) return;
    const settings = useSettingsStore.getState();
    let enabled = true;

    if (this.isMuted) {
      enabled = false;
    } else if (settings.inputMode === 'push_to_talk') {
      enabled = this.isPttActive;
    }

    this.localAudioStream.getAudioTracks().forEach((t) => {
      t.enabled = enabled;
    });
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    this.updateAudioTrackState();
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

        const settings = useSettingsStore.getState();
        const effectiveMuted =
          this.isMuted || (settings.inputMode === 'push_to_talk' && !this.isPttActive);

        if (effectiveMuted) {
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
  // PeerConnection & Perfect Negotiation Signaling
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

    // Add microphone audio track
    if (this.localAudioStream) {
      this.localAudioStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, this.localAudioStream!);
      });
    }

    // Add local screen share tracks if already active
    if (this.localScreenStream) {
      const senders: RTCRtpSender[] = [];
      this.localScreenStream.getTracks().forEach((track) => {
        senders.push(pc.addTrack(track, this.localScreenStream!));
      });
      this.screenSenders.set(peerId, senders);
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
      // Eliminate receiver jitter buffer delay for ultra-low latency streaming
      if (event.receiver && 'jitterBufferTarget' in event.receiver) {
        try {
          (event.receiver as any).jitterBufferTarget = 0;
        } catch {}
      }

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

    // Prioritize hardware H264 / VP9 video codecs for hardware GPU decoding
    try {
      if ('getCapabilities' in RTCRtpSender) {
        const capabilities = RTCRtpSender.getCapabilities('video');
        if (capabilities && capabilities.codecs) {
          const h264Codecs = capabilities.codecs.filter((c) =>
            c.mimeType.toLowerCase().includes('h264')
          );
          const otherCodecs = capabilities.codecs.filter(
            (c) => !c.mimeType.toLowerCase().includes('h264')
          );
          const transceivers = pc.getTransceivers();
          transceivers.forEach((t) => {
            if (t.sender.track?.kind === 'video' && 'setCodecPreferences' in t) {
              try {
                (t as any).setCodecPreferences([...h264Codecs, ...otherCodecs]);
              } catch {}
            }
          });
        }
      }
    } catch {}

    // Setup Co-op low-latency DataChannel (unreliable & unordered for UDP gaming input speed)
    if (this.myUserId < peerId) {
      try {
        const dc = pc.createDataChannel('squadspace-coop-input', {
          ordered: false,
          maxRetransmits: 0,
        });
        this.setupCoopDataChannel(peerId, dc);
      } catch (err) {
        console.warn('Failed to create coop data channel:', err);
      }
    }

    pc.ondatachannel = (event) => {
      if (event.channel && event.channel.label === 'squadspace-coop-input') {
        this.setupCoopDataChannel(peerId, event.channel);
      }
    };

    this.peers.set(peerId, pc);
    return pc;
  }

  private setupCoopDataChannel(peerId: string, dc: RTCDataChannel) {
    dc.binaryType = 'arraybuffer';
    dc.onopen = () => {
      console.log(`[WebRTC] Co-op DataChannel open with peer: ${peerId}`);
      this.coopDataChannels.set(peerId, dc);
    };
    dc.onclose = () => {
      console.log(`[WebRTC] Co-op DataChannel closed with peer: ${peerId}`);
      this.coopDataChannels.delete(peerId);
    };
    dc.onerror = (err) => {
      console.warn(`[WebRTC] Co-op DataChannel error with peer ${peerId}:`, err);
    };
    dc.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        this.onCoopMessageCallbacks.forEach((cb) => cb(peerId, packet));
      } catch {}
    };
  }

  private async createAndSendOffer(peerId: string, maxBitrate?: number) {
    const pc = this.peers.get(peerId) || this.createPeerConnection(peerId);
    try {
      this.makingOffer.set(peerId, true);
      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') return;

      const optimizedSdp = injectLowLatencySdp(offer.sdp || '', maxBitrate || this.currentScreenBitrate);
      await pc.setLocalDescription({ type: offer.type, sdp: optimizedSdp });

      this.sendSignal({
        type: 'offer',
        sdp: { type: offer.type, sdp: optimizedSdp },
        targetId: peerId,
        senderId: this.myUserId,
        channelId: this.currentChannelId || '',
      });
    } catch (err) {
      console.warn('Error creating offer:', err);
    } finally {
      this.makingOffer.set(peerId, false);
    }
  }

  private handleSignalingMessage(event: MessageEvent) {
    this.handleSignalingPayload(event.data);
  }

  private async handleSignalingPayload(data: any) {
    if (!data || data.senderId === this.myUserId) return;
    if (data.channelId !== this.currentChannelId) return;

    switch (data.type) {
      case 'join':
      case 'presence': {
        // A peer joined or is present in our voice channel
        if (data.user) {
          this.onParticipantJoinedCallbacks.forEach((cb) =>
            cb(data.user, data.isMuted, data.isScreenSharing)
          );
        }

        // Announce ourselves back if joining
        if (data.type === 'join' && this.currentUser) {
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

        // Perfect negotiation rule: peer with smaller id creates the offer
        if (!this.peers.has(data.senderId) && this.myUserId < data.senderId) {
          await this.createAndSendOffer(data.senderId);
        }
        break;
      }

      case 'announce': {
        if (data.targetId === this.myUserId && data.user) {
          this.onParticipantJoinedCallbacks.forEach((cb) =>
            cb(data.user, data.isMuted, data.isScreenSharing)
          );
          if (!this.peers.has(data.senderId) && this.myUserId < data.senderId) {
            await this.createAndSendOffer(data.senderId);
          }
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

        const coopDc = this.coopDataChannels.get(data.senderId);
        if (coopDc) {
          try {
            coopDc.close();
          } catch {}
          this.coopDataChannels.delete(data.senderId);
        }

        this.pendingCandidates.delete(data.senderId);
        this.makingOffer.delete(data.senderId);
        this.ignoreOffer.delete(data.senderId);
        this.screenSenders.delete(data.senderId);

        this.onParticipantLeftCallbacks.forEach((cb) => cb(data.senderId));
        break;
      }

      case 'coop-control': {
        if (!data.targetId || data.targetId === this.myUserId) {
          this.onCoopMessageCallbacks.forEach((cb) => cb(data.senderId, data.payload));
        }
        break;
      }

      case 'mute-change': {
        this.onParticipantUpdateCallbacks.forEach((cb) =>
          cb(data.senderId, { isMuted: data.isMuted })
        );
        break;
      }

      case 'screen-start': {
        if (data.maxBitrate) {
          this.currentScreenBitrate = data.maxBitrate;
        }
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

          const isPolite = this.myUserId < data.senderId;
          const offerCollision =
            this.makingOffer.get(data.senderId) || pc.signalingState !== 'stable';

          this.ignoreOffer.set(data.senderId, !isPolite && offerCollision);

          if (this.ignoreOffer.get(data.senderId)) {
            return;
          }

          if (offerCollision && isPolite) {
            try {
              await pc.setLocalDescription({ type: 'rollback' });
            } catch {}
          }

          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

            // Flush pending ICE candidates
            const queued = this.pendingCandidates.get(data.senderId) || [];
            this.pendingCandidates.delete(data.senderId);
            for (const cand of queued) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch {}
            }

            const answer = await pc.createAnswer();
            const optimizedAnswerSdp = injectLowLatencySdp(answer.sdp || '', this.currentScreenBitrate);
            await pc.setLocalDescription({ type: answer.type, sdp: optimizedAnswerSdp });

            this.sendSignal({
              type: 'answer',
              sdp: { type: answer.type, sdp: optimizedAnswerSdp },
              targetId: data.senderId,
              senderId: this.myUserId,
              channelId: this.currentChannelId || '',
            });
          } catch (err) {
            console.warn('Error handling offer:', err);
          }
        }
        break;
      }

      case 'answer': {
        if (data.targetId === this.myUserId) {
          const pc = this.peers.get(data.senderId);
          if (pc && pc.signalingState === 'have-local-offer') {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

              // Flush pending ICE candidates
              const queued = this.pendingCandidates.get(data.senderId) || [];
              this.pendingCandidates.delete(data.senderId);
              for (const cand of queued) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch {}
              }
            } catch (err) {
              console.warn('Error setting remote answer:', err);
            }
          }
        }
        break;
      }

      case 'candidate': {
        if (data.targetId === this.myUserId && data.candidate) {
          const pc = this.peers.get(data.senderId);
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (err) {
              console.warn('ICE candidate error:', err);
            }
          } else {
            // Queue candidate until remote description is applied
            const list = this.pendingCandidates.get(data.senderId) || [];
            list.push(data.candidate);
            this.pendingCandidates.set(data.senderId, list);
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

  // --------------------------------------------------------------------------
  // Co-op Remote Play API
  // --------------------------------------------------------------------------

  /**
   * Send Co-op Control message (Join request, approval, player sync, pause, kick)
   */
  public sendCoopControl(targetId: string | null, payload: any): boolean {
    let sentViaDataChannel = false;
    if (targetId) {
      const dc = this.coopDataChannels.get(targetId);
      if (dc && dc.readyState === 'open') {
        try {
          dc.send(JSON.stringify(payload));
          sentViaDataChannel = true;
        } catch {}
      }
    }

    // Also send via signaling channel for guaranteed delivery
    this.sendSignal({
      type: 'coop-control',
      targetId: targetId || undefined,
      senderId: this.myUserId,
      channelId: this.currentChannelId || '',
      payload,
    });

    return sentViaDataChannel;
  }

  /**
   * Send high-frequency Co-op Input packet (Gamepad axes/buttons or Keyboard/Mouse)
   * Directly through WebRTC DataChannel (zero server latency)
   */
  public sendCoopInput(targetId: string, packet: any): boolean {
    const dc = this.coopDataChannels.get(targetId);
    if (dc && dc.readyState === 'open') {
      try {
        dc.send(JSON.stringify(packet));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Register listener for incoming Co-op messages and inputs
   */
  public onCoopMessage(callback: (peerId: string, packet: any) => void): () => void {
    this.onCoopMessageCallbacks.add(callback);
    return () => this.onCoopMessageCallbacks.delete(callback);
  }

  /**
   * Check if Co-op DataChannel is ready with a peer
   */
  public isCoopChannelReady(peerId: string): boolean {
    const dc = this.coopDataChannels.get(peerId);
    return Boolean(dc && dc.readyState === 'open');
  }
}

export const webrtcManager = new WebRTCManager();
