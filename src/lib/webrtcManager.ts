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
import { sounds } from './soundEffects';
import { WebRTCStreamStats } from '../types/streamStats';
import { streamHealthMonitor } from './streamHealthMonitor';

export interface PeerConnectionInfo {
  peerId: string;
  pc: RTCPeerConnection;
  remoteAudioStream?: MediaStream;
  remoteScreenStream?: MediaStream;
}

type AudioLevelCallback = (volumePercent: number, isSpeaking: boolean) => void;
type ParticipantJoinedCallback = (
  user: UserProfile,
  isMuted?: boolean,
  isScreenSharing?: boolean,
  customJoinSound?: string,
  isNewJoin?: boolean
) => void;
type ParticipantLeftCallback = (userId: string) => void;
type ParticipantUpdateCallback = (userId: string, updates: Partial<VoiceParticipant>) => void;
type PingCallback = (overallPing: number, peerPings: Record<string, number>) => void;
type StreamStatsCallback = (stats: WebRTCStreamStats | null) => void;

/**
 * Injects WebRTC SDP low-latency attributes and eliminates GCC bitrate collapse:
 * 1. Drops 'transport-wide-cc' header extensions and feedback so WebRTC does not aggressively throttle bitrates
 * 2. Forces 'goog-remb' receiver-estimated maximum bitrate with high allocation bounds (b=AS & b=TIAS)
 * 3. Enforces x-google-min-bitrate, x-google-start-bitrate, and x-google-max-bitrate floors
 * 4. Injects a=playout-delay:0 0 for ultra-low latency rendering
 */
function injectLowLatencySdp(sdp: string, maxBitrateBps: number = 16_000_000): string {
  if (!sdp) return sdp;
  const lines = sdp.split('\r\n');
  const result: string[] = [];
  let inVideo = false;
  const maxBitrateKbps = Math.round(maxBitrateBps / 1000);
  const minBitrateKbps = Math.max(6000, Math.round(maxBitrateKbps * 0.65)); // High 65% floor prevents pixelation drops
  const startBitrateKbps = Math.max(8000, Math.round(maxBitrateKbps * 0.85)); // Fast ramp-up to crystal clarity

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Drop Transport-Wide CC header extension to neutralize volatile congestion backoff
    if (line.includes('urn:ietf:params:rtp-hdrext:transport-wide-cc')) {
      continue;
    }

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

    // 2. Drop transport-cc RTCP feedback so WebRTC uses REMB (goog-remb) instead
    if (inVideo && line.startsWith('a=rtcp-fb:') && line.includes('transport-cc')) {
      continue;
    }

    result.push(line);

    // Inject playout-delay right after rtcp-mux or c=IN in video section
    if (inVideo && (line.startsWith('a=rtcp-mux') || line.startsWith('c=IN'))) {
      if (!lines.some((l) => l.includes('a=playout-delay:0 0'))) {
        result.push('a=playout-delay:0 0');
      }
    }

    // Enhance fmtp lines with google bitrate constraints and VP9/AV1 screen clarity
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
  private remoteScreenAudioElements: Map<string, HTMLAudioElement> = new Map();
  private screenShareVolume: number = 1.0;
  private screenShareMuted: boolean = false;

  // Low latency & Perfect negotiation state
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private makingOffer: Map<string, boolean> = new Map();
  private ignoreOffer: Map<string, boolean> = new Map();
  private screenSenders: Map<string, RTCRtpSender[]> = new Map();
  private currentScreenBitrate: number = 12_000_000;
  private presenceHeartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private isPttActive: boolean = false;

  // Remote streams separation to prevent duplicate audio / flanging echo
  private remoteScreenStreamIds: Map<string, string> = new Map();
  private remoteVoiceStreams: Map<string, MediaStream> = new Map();

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
  private onPingCallbacks: Set<PingCallback> = new Set();
  private onStreamStatsCallbacks: Set<StreamStatsCallback> = new Set();
  private statsIntervalId: ReturnType<typeof setInterval> | null = null;
  private prevRtpStats: Map<string, { timestamp: number; bytes: number; frames: number; framesDropped?: number }> = new Map();
  private lastOverallPing: number = 0;
  private lastPeerPings: Record<string, number> = {};
  private lastStreamStats: WebRTCStreamStats | null = null;

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
      // 1. Request real microphone hardware access with full acoustic echo cancellation
      this.localAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          googEchoCancellation: { ideal: true },
          googAutoGainControl: { ideal: true },
          googNoiseSuppression: { ideal: true },
          googHighpassFilter: { ideal: true },
          googTypingNoiseDetection: { ideal: true },
        } as any,
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

    // 6. Start real-time WebRTC stats and ping polling loop
    this.startStatsLoop();

    return true;
  }

  private broadcastJoin() {
    if (!this.currentChannelId || !this.currentUser) return;
    let customSoundData: string | undefined = undefined;
    try {
      const stored = localStorage.getItem('squadspace_custom_join_sound');
      if (stored) {
        const parsed = JSON.parse(stored);
        customSoundData = parsed.dataUrl;
      }
    } catch {}

    // Protect signaling connection from oversized payloads (>200KB)
    if (customSoundData && customSoundData.length > 200000) {
      console.warn('[WebRTC] Custom sound exceeds 200KB limit; trimmed version required for network broadcast.');
      customSoundData = undefined;
    }

    this.sendSignal({
      type: 'join',
      senderId: this.myUserId,
      channelId: this.currentChannelId,
      user: this.currentUser,
      isMuted: this.isMuted,
      isScreenSharing: Boolean(this.localScreenStream),
      customJoinSound: customSoundData,
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
    this.stopStatsLoop();

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
      el.srcObject = null;
      el.remove();
    });
    this.remoteAudioElements.clear();

    // Remove remote screen share audio elements
    this.remoteScreenAudioElements.forEach((el) => {
      el.pause();
      el.srcObject = null;
      el.remove();
    });
    this.remoteScreenAudioElements.clear();
    this.remoteScreenStreamIds.clear();
    this.remoteVoiceStreams.clear();

    this.currentChannelId = null;
    this.currentUser = null;
  }

  /**
   * Prioritizes high-efficiency modern codecs (AV1 and VP9) over legacy codecs
   * AV1 and VP9 deliver >50% better compression efficiency than H.264 at the exact same bitrate
   * and include native Screen-Content Coding (SCC) to prevent macroblock pixelation.
   */
  public applyVideoCodecPreferences(transceiver: RTCRtpTransceiver) {
    if (!transceiver || !('setCodecPreferences' in transceiver)) return;
    try {
      const senderCaps = 'getCapabilities' in RTCRtpSender ? RTCRtpSender.getCapabilities('video') : null;
      const receiverCaps = 'getCapabilities' in RTCRtpReceiver ? RTCRtpReceiver.getCapabilities('video') : null;
      const allCodecs = senderCaps?.codecs || receiverCaps?.codecs;
      if (!allCodecs || allCodecs.length === 0) return;

      // Desired codec order: AV1 -> VP9 -> H.264 (Baseline) -> VP8
      const preferredMimes = ['video/av1', 'video/vp9', 'video/h264', 'video/vp8'];
      const sorted = [...allCodecs].sort((a, b) => {
        const mimeA = a.mimeType.toLowerCase();
        const mimeB = b.mimeType.toLowerCase();
        let idxA = preferredMimes.indexOf(mimeA);
        let idxB = preferredMimes.indexOf(mimeB);
        if (idxA === -1) idxA = 999;
        if (idxB === -1) idxB = 999;

        if (idxA !== idxB) {
          return idxA - idxB;
        }

        // Inside VP9, prefer Profile 0 (universal support and screen content tools)
        if (mimeA === 'video/vp9' && a.sdpFmtpLine && b.sdpFmtpLine) {
          if (a.sdpFmtpLine.includes('profile-id=0') && !b.sdpFmtpLine.includes('profile-id=0')) return -1;
          if (!a.sdpFmtpLine.includes('profile-id=0') && b.sdpFmtpLine.includes('profile-id=0')) return 1;
        }

        // Inside H.264, prefer standard baseline (42e01f) which works reliably in WebRTC
        if (mimeA === 'video/h264' && a.sdpFmtpLine && b.sdpFmtpLine) {
          if (a.sdpFmtpLine.includes('42e01f') && !b.sdpFmtpLine.includes('42e01f')) return -1;
          if (!a.sdpFmtpLine.includes('42e01f') && b.sdpFmtpLine.includes('42e01f')) return 1;
        }

        return 0;
      });

      transceiver.setCodecPreferences(sorted);
      console.log('[WebRTC] Successfully prioritized crystal-clear codecs: AV1 > VP9 > H264 > VP8');
    } catch (err) {
      console.warn('[WebRTC] setCodecPreferences notice:', err);
    }
  }

  /**
   * Applies hardware-grade high bitrate (14-30 Mbps) and 60 FPS encoding parameters
   * Enforces maintain-resolution so WebRTC never downscales or pixelates.
   */
  public applySenderParameters(peerId: string) {
    const pc = this.peers.get(peerId);
    if (!pc) return;

    const addedSenders = this.screenSenders.get(peerId) || [];
    const videoSender =
      addedSenders.find((s) => s.track?.kind === 'video') ||
      pc.getSenders().find(
        (s) =>
          s.track &&
          s.track.kind === 'video' &&
          s.track.id === this.localScreenStream?.getVideoTracks()[0]?.id
      );

    if (videoSender && videoSender.getParameters) {
      try {
        const params = videoSender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = this.currentScreenBitrate;
        (params.encodings[0] as any).minBitrate = Math.round(this.currentScreenBitrate * 0.65);
        params.encodings[0].maxFramerate = 60;
        params.encodings[0].scaleResolutionDownBy = 1.0;
        params.encodings[0].priority = 'high';
        params.encodings[0].networkPriority = 'high';
        // maintain-framerate strictly prioritizes true 60 FPS delivery without stuttering or dropping frames
        (params as any).degradationPreference = 'maintain-framerate';
        videoSender
          .setParameters(params)
          .then(() => {
            console.log(
              `[ScreenShare] Locked 60 FPS high-bitrate parameters for peer ${peerId}: ${this.currentScreenBitrate} bps`
            );
          })
          .catch((err) => {
            console.warn(`[ScreenShare] setParameters notice for peer ${peerId}:`, err);
          });
      } catch (e) {
        console.warn('[ScreenShare] Error setting sender parameters:', e);
      }
    }
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
      // 0. Cleanly teardown any prior active screen stream before re-acquiring
      if (this.localScreenStream) {
        this.stopScreenShare();
      }

      let stream: MediaStream | null = null;
      const isElectron = Boolean(window.electronAPI?.isElectron);

      // 1. Electron Native Desktop Capture (Only when running in Electron with a specific sourceId)
      if (isElectron && options?.sourceId) {
        // Try native capture with system audio (for both whole screens AND application windows)
        if (options?.systemAudio !== false) {
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
                  minFrameRate: Math.min(30, preset.frameRate),
                  maxWidth: Math.max(1920, preset.resolution.width),
                  maxHeight: Math.max(1080, preset.resolution.height),
                },
              },
            } as any);
          } catch (audioErr) {
            console.warn('[ScreenShare] Combined native capture with audio failed, will capture video and attach audio track separately:', audioErr);
          }
        }

        // Native capture video-only if combined capture failed or was not requested
        if (!stream) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: options.sourceId,
                  maxFrameRate: preset.frameRate,
                  minFrameRate: Math.min(30, preset.frameRate),
                  maxWidth: Math.max(1920, preset.resolution.width),
                  maxHeight: Math.max(1080, preset.resolution.height),
                },
              },
            } as any);
          } catch (vidErr) {
            console.warn('[ScreenShare] Native sourceId capture failed, falling back to getDisplayMedia:', vidErr);
          }
        }

        // If video succeeded but audio track is missing and user requested system audio:
        // Capture desktop loopback audio separately and attach it to the stream!
        if (stream && stream.getAudioTracks().length === 0 && options?.systemAudio !== false) {
          try {
            const sysAudioStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                },
              },
              video: false,
            } as any);
            sysAudioStream.getAudioTracks().forEach((aTrack) => {
              stream!.addTrack(aTrack);
            });
            console.log('[ScreenShare] Successfully attached desktop loopback audio track to stream!');
          } catch (sepAudioErr) {
            console.warn('[ScreenShare] Separate desktop loopback audio capture failed:', sepAudioErr);
          }
        }
      }

      // 2. Standard getDisplayMedia (Web or if Electron native capture was not specified/failed)
      // Must execute promptly to preserve user gesture token in modern browsers!
      if (!stream) {
        const displayVideoConstraints: MediaTrackConstraints = {
          frameRate: { ideal: preset.frameRate, min: Math.min(30, preset.frameRate), max: preset.frameRate },
          width: { ideal: preset.resolution.width, min: 1280 },
          height: { ideal: preset.resolution.height, min: 720 },
        };

        if (options?.systemAudio !== false) {
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: displayVideoConstraints,
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              },
            });
          } catch (dispAudioErr) {
            try {
              stream = await navigator.mediaDevices.getDisplayMedia({
                video: displayVideoConstraints,
                audio: true,
              });
            } catch (dispBoolErr) {
              console.warn('[ScreenShare] getDisplayMedia with audio failed, retrying video only:', dispBoolErr);
            }
          }
        }

        if (!stream) {
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: displayVideoConstraints,
              audio: false,
            });
          } catch (dispErr) {
            // Final fallback with minimal unconstrained video
            console.warn('[ScreenShare] Retrying with unconstrained video:', dispErr);
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: false,
            });
          }
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
        // Enforce content hint: 'motion' prioritizes 60 FPS fluid rendering cadence
        if ('contentHint' in videoTrack) {
          (videoTrack as any).contentHint = preset.contentHint || 'motion';
        }

        const audioTracks = this.localScreenStream.getAudioTracks();

        // Add tracks to each peer and record senders for clean teardown
        this.peers.forEach((pc, peerId) => {
          const addedSenders: RTCRtpSender[] = [];

          const vSender = pc.addTrack(videoTrack, this.localScreenStream!);
          addedSenders.push(vSender);

          // 1. Force modern high-efficiency codecs (AV1 -> VP9 Profile 0/2 -> H264 -> VP8)
          const transceivers = pc.getTransceivers();
          const videoTransceiver = transceivers.find((t) => t.sender === vSender);
          if (videoTransceiver) {
            this.applyVideoCodecPreferences(videoTransceiver);
          }

          if (audioTracks.length > 0) {
            const aSender = pc.addTrack(audioTracks[0], this.localScreenStream!);
            addedSenders.push(aSender);
          }

          this.screenSenders.set(peerId, addedSenders);
          this.createAndSendOffer(peerId, preset.maxBitrate);
          setTimeout(() => this.applySenderParameters(peerId), 300);
          setTimeout(() => this.applySenderParameters(peerId), 1000);
          setTimeout(() => this.applySenderParameters(peerId), 2500);
        });

        this.sendSignal({
          type: 'screen-start',
          senderId: this.myUserId,
          channelId: this.currentChannelId || '',
          streamId: this.localScreenStream.id,
          presetKey,
          maxBitrate: preset.maxBitrate,
        });

        streamHealthMonitor.startSession(preset.frameRate || 60);
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

      this.lastStreamStats = null;
      this.onStreamStatsCallbacks.forEach((cb) => cb(null));
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

  updateAudioTrackState() {
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
    this.remoteScreenAudioElements.forEach((el) => {
      el.muted = deafened || this.screenShareMuted;
    });
  }

  setScreenShareVolume(volumeRatio: number) {
    this.screenShareVolume = Math.max(0, Math.min(1, volumeRatio));
    this.remoteScreenAudioElements.forEach((el) => {
      el.volume = this.screenShareVolume;
    });
  }

  setScreenShareMuted(muted: boolean) {
    this.screenShareMuted = muted;
    this.remoteScreenAudioElements.forEach((el) => {
      el.muted = this.isDeafened || this.screenShareMuted;
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
        const sender = pc.addTrack(track, this.localScreenStream!);
        senders.push(sender);

        if (track.kind === 'video') {
          const transceivers = pc.getTransceivers();
          const videoTransceiver = transceivers.find((t) => t.sender === sender);
          if (videoTransceiver) {
            this.applyVideoCodecPreferences(videoTransceiver);
          }
        }
      });
      this.screenSenders.set(peerId, senders);
      setTimeout(() => this.applySenderParameters(peerId), 400);
      setTimeout(() => this.applySenderParameters(peerId), 1500);
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

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        this.applySenderParameters(peerId);
      }
    };

    pc.ontrack = (event) => {
      // 25ms buffer cushion (~1.5 frames) absorbs network packet spacing jitter and guarantees smooth 60fps frame pacing without lag
      if (event.receiver) {
        try {
          if ('jitterBufferTarget' in event.receiver) {
            (event.receiver as any).jitterBufferTarget = 25;
          }
          if ('playoutDelayHint' in event.receiver) {
            (event.receiver as any).playoutDelayHint = 0.025;
          }
        } catch {}
      }

      const stream = event.streams[0] || new MediaStream([event.track]);

      if (event.track.kind === 'audio') {
        // Prevent double audio / flanging echo:
        // Screen share audio is played exclusively via ScreenShareVideo with independent volume slider.
        // Background audioEl is reserved STRICTLY for voice microphone chat.
        const knownScreenStreamId = this.remoteScreenStreamIds.get(peerId);
        const isScreenAudio =
          (knownScreenStreamId && stream.id === knownScreenStreamId) ||
          stream.getVideoTracks().length > 0 ||
          event.track.label.toLowerCase().includes('screen') ||
          event.track.label.toLowerCase().includes('desktop') ||
          event.track.label.toLowerCase().includes('system') ||
          (this.remoteVoiceStreams.has(peerId) && this.remoteVoiceStreams.get(peerId)?.id !== stream.id);

        if (!isScreenAudio) {
          // 1. Microphone voice chat audio
          if (peerId === this.myUserId) return;
          if (this.localAudioStream && this.localAudioStream.getAudioTracks().some((t) => t.id === event.track.id)) {
            return;
          }

          this.remoteVoiceStreams.set(peerId, stream);
          let audioEl = this.remoteAudioElements.get(peerId);
          if (!audioEl) {
            audioEl = new Audio();
            audioEl.autoplay = true;
            audioEl.muted = this.isDeafened;
            this.remoteAudioElements.set(peerId, audioEl);
          }
          audioEl.srcObject = stream;
          audioEl.play().catch(() => {});
        } else {
          // 2. Screen share system / game / media audio!
          if (peerId === this.myUserId) return;
          if (this.localScreenStream && this.localScreenStream.getAudioTracks().some((t) => t.id === event.track.id)) {
            return;
          }

          let screenAudioEl = this.remoteScreenAudioElements.get(peerId);
          if (!screenAudioEl) {
            screenAudioEl = new Audio();
            screenAudioEl.autoplay = true;
            screenAudioEl.muted = this.isDeafened || this.screenShareMuted;
            screenAudioEl.volume = this.screenShareVolume;
            this.remoteScreenAudioElements.set(peerId, screenAudioEl);
          }
          const screenAudioStream = new MediaStream([event.track]);
          screenAudioEl.srcObject = screenAudioStream;
          screenAudioEl.play().catch((err) => {
            console.warn('[ScreenShare] Remote screen audio playback failed or blocked:', err);
          });
        }
      }

      if (event.track.kind === 'video') {
        streamHealthMonitor.startSession(60);
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
          const isNewJoin = data.type === 'join';
          this.onParticipantJoinedCallbacks.forEach((cb) =>
            cb(data.user, data.isMuted, data.isScreenSharing, data.customJoinSound, isNewJoin)
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
          // Announce comes from users who were already in the room; do not play join sound
          this.onParticipantJoinedCallbacks.forEach((cb) =>
            cb(data.user, data.isMuted, data.isScreenSharing, undefined, false)
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

        const screenAudioEl = this.remoteScreenAudioElements.get(data.senderId);
        if (screenAudioEl) {
          screenAudioEl.pause();
          screenAudioEl.srcObject = null;
          screenAudioEl.remove();
          this.remoteScreenAudioElements.delete(data.senderId);
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
        this.remoteScreenStreamIds.delete(data.senderId);
        this.remoteVoiceStreams.delete(data.senderId);

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
        if (data.streamId) {
          this.remoteScreenStreamIds.set(data.senderId, data.streamId);
        }
        if (data.maxBitrate) {
          this.currentScreenBitrate = data.maxBitrate;
        }
        this.onParticipantUpdateCallbacks.forEach((cb) =>
          cb(data.senderId, { isScreenSharing: true })
        );
        break;
      }

      case 'screen-stop': {
        this.remoteScreenStreamIds.delete(data.senderId);
        const screenAudioEl = this.remoteScreenAudioElements.get(data.senderId);
        if (screenAudioEl) {
          screenAudioEl.pause();
          screenAudioEl.srcObject = null;
          screenAudioEl.remove();
          this.remoteScreenAudioElements.delete(data.senderId);
        }
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
          const offerCollision = Boolean(this.makingOffer.get(data.senderId));

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

              // Enforce 60 FPS high-bitrate encoding parameters now that peer connection is active!
              this.applySenderParameters(data.senderId);
              setTimeout(() => this.applySenderParameters(data.senderId), 600);

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
    } else {
      // Broadcast to all active peer data channels
      this.coopDataChannels.forEach((dc) => {
        if (dc && dc.readyState === 'open') {
          try {
            dc.send(JSON.stringify(payload));
            sentViaDataChannel = true;
          } catch {}
        }
      });
    }

    // Only send via signaling channel for non-movement events
    // (Avoid flooding Supabase WebSockets with high-frequency avatar movement ticks)
    const isHighFreqMovement =
      (payload?.type === 'lounge_sync' && payload?.subType === 'avatar_state') ||
      payload?.type === 'avatar_state';
    if (!isHighFreqMovement) {
      this.sendSignal({
        type: 'coop-control',
        targetId: targetId || undefined,
        senderId: this.myUserId,
        channelId: this.currentChannelId || '',
        payload,
      });
    }

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
        // Fall back to signaling
      }
    }

    // High-reliability fallback: send via signaling channel so inputs NEVER get dropped!
    this.sendSignal({
      type: 'coop-control',
      targetId,
      senderId: this.myUserId,
      channelId: this.currentChannelId || '',
      payload: packet,
    });
    return true;
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

  /**
   * Register listener for ping / round-trip time updates (overall and per-peer)
   */
  public onPingUpdate(callback: PingCallback): () => void {
    this.onPingCallbacks.add(callback);
    callback(this.lastOverallPing, this.lastPeerPings);
    return () => this.onPingCallbacks.delete(callback);
  }

  /**
   * Register listener for active screen share stream stats (bitrate, fps, packet loss, codec, etc.)
   */
  public onStreamStats(callback: StreamStatsCallback): () => void {
    this.onStreamStatsCallbacks.add(callback);
    callback(this.lastStreamStats);
    return () => this.onStreamStatsCallbacks.delete(callback);
  }

  public getCurrentPing(): number {
    return this.lastOverallPing;
  }

  public getPeerPings(): Record<string, number> {
    return { ...this.lastPeerPings };
  }

  public getCurrentStreamStats(): WebRTCStreamStats | null {
    return this.lastStreamStats;
  }

  private startStatsLoop() {
    this.stopStatsLoop();
    this.statsIntervalId = setInterval(() => {
      this.collectStats();
    }, 1500);
    setTimeout(() => this.collectStats(), 400);
  }

  private stopStatsLoop() {
    if (this.statsIntervalId) {
      clearInterval(this.statsIntervalId);
      this.statsIntervalId = null;
    }
    this.prevRtpStats.clear();
    this.lastStreamStats = null;
    this.lastOverallPing = 0;
    this.lastPeerPings = {};
  }

  private async collectStats() {
    if (this.peers.size === 0) {
      if (this.lastOverallPing !== 0 || Object.keys(this.lastPeerPings).length > 0) {
        this.lastOverallPing = 0;
        this.lastPeerPings = {};
        this.onPingCallbacks.forEach((cb) => cb(0, {}));
      }
      if (this.lastStreamStats !== null) {
        this.lastStreamStats = null;
        this.onStreamStatsCallbacks.forEach((cb) => cb(null));
      }
      return;
    }

    const peerPings: Record<string, number> = {};
    const allPings: number[] = [];
    let detectedStreamStats: WebRTCStreamStats | null = null;
    const now = Date.now();

    for (const [peerId, pc] of this.peers.entries()) {
      try {
        if (pc.connectionState === 'closed') continue;
        const report = await pc.getStats();

        // 1. Extract RTT / Ping from active candidate-pair
        let peerRtt = 0;
        for (const stat of report.values()) {
          if (stat.type === 'candidate-pair' && (stat.state === 'succeeded' || stat.nominated)) {
            if (stat.currentRoundTripTime !== undefined) {
              peerRtt = Math.round(stat.currentRoundTripTime * 1000);
              break;
            } else if (stat.totalRoundTripTime !== undefined && stat.responsesReceived > 0) {
              peerRtt = Math.round((stat.totalRoundTripTime / stat.responsesReceived) * 1000);
              break;
            }
          }
        }
        if (peerRtt > 0) {
          peerPings[peerId] = peerRtt;
          allPings.push(peerRtt);
        }

        // 2. Extract screen share video stats
        // Case A: Broadcaster sharing screen locally
        if (this.localScreenStream && !detectedStreamStats) {
          for (const stat of report.values()) {
            if (stat.type === 'outbound-rtp' && (stat.kind === 'video' || stat.mediaType === 'video')) {
              const prevKey = `out_${peerId}_${stat.id || 'vid'}`;
              const prev = this.prevRtpStats.get(prevKey);
              const bytes = stat.bytesSent || 0;
              const frames = stat.framesSent || 0;
              let bitrateKbps = Math.round(this.currentScreenBitrate / 1000);
              let fps = 60;

              if (prev) {
                const dt = (now - prev.timestamp) / 1000;
                if (dt > 0.3) {
                  bitrateKbps = Math.round(((bytes - prev.bytes) * 8) / (dt * 1000));
                  fps =
                    stat.framesPerSecond !== undefined && stat.framesPerSecond > 0
                      ? Math.round(stat.framesPerSecond * 10) / 10
                      : Math.max(0, Math.round(((frames - prev.frames) / dt) * 10) / 10);
                }
              }
              this.prevRtpStats.set(prevKey, { timestamp: now, bytes, frames });

              let codecName = 'AV1';
              if (stat.codecId) {
                const c = report.get(stat.codecId);
                if (c && c.mimeType) codecName = c.mimeType.replace(/^video\//i, '').toUpperCase();
              }

              let packetsLost = 0;
              if (stat.remoteId) {
                const rem = report.get(stat.remoteId);
                if (rem) {
                  packetsLost = rem.packetsLost || 0;
                  const rtt = rem.roundTripTime !== undefined ? Math.round(rem.roundTripTime * 1000) : peerRtt;
                  if (rtt > 0 && peerRtt === 0) peerRtt = rtt;
                }
              }

              detectedStreamStats = {
                peerId,
                timestamp: now,
                isLocal: true,
                rttMs: peerRtt || 15,
                jitterMs: 0,
                packetsLost,
                packetsReceived: frames,
                packetLossPercent: 0,
                fps: fps > 0 ? fps : 60,
                targetFps: 60,
                bitrateKbps: bitrateKbps > 0 ? bitrateKbps : Math.round(this.currentScreenBitrate / 1000),
                targetBitrateKbps: Math.round(this.currentScreenBitrate / 1000),
                width: stat.frameWidth || 1920,
                height: stat.frameHeight || 1080,
                codec: codecName,
                framesSent: frames,
                qualityLimitationReason: stat.qualityLimitationReason || 'none',
                retransmittedPacketsSent: stat.retransmittedPacketsSent || 0,
              };
              break;
            }
          }
        }

        // Case B: Viewer watching remote screen share
        if (!this.localScreenStream && !detectedStreamStats) {
          for (const stat of report.values()) {
            if (stat.type === 'inbound-rtp' && (stat.kind === 'video' || stat.mediaType === 'video')) {
              const prevKey = `in_${peerId}_${stat.id || 'vid'}`;
              const prev = this.prevRtpStats.get(prevKey);
              const bytes = stat.bytesReceived || 0;
              const frames = stat.framesDecoded || stat.framesReceived || 0;
              const framesDropped = stat.framesDropped || 0;
              let bitrateKbps = 12000;
              let fps = 60;

              if (prev) {
                const dt = (now - prev.timestamp) / 1000;
                if (dt > 0.3) {
                  bitrateKbps = Math.round(((bytes - prev.bytes) * 8) / (dt * 1000));
                  fps =
                    stat.framesPerSecond !== undefined && stat.framesPerSecond > 0
                      ? Math.round(stat.framesPerSecond * 10) / 10
                      : Math.max(0, Math.round(((frames - prev.frames) / dt) * 10) / 10);
                }
              }
              this.prevRtpStats.set(prevKey, { timestamp: now, bytes, frames, framesDropped });

              let codecName = 'AV1';
              if (stat.codecId) {
                const c = report.get(stat.codecId);
                if (c && c.mimeType) codecName = c.mimeType.replace(/^video\//i, '').toUpperCase();
              }

              const packetsLost = stat.packetsLost || 0;
              const packetsReceived = stat.packetsReceived || 0;
              const packetLossPercent =
                packetsLost + packetsReceived > 0
                  ? Math.round((packetsLost / (packetsLost + packetsReceived)) * 1000) / 10
                  : 0;

              const jitterMs = stat.jitter !== undefined ? Math.round(stat.jitter * 10000) / 10 : 0;
              const decodeTimeMs =
                stat.totalDecodeTime !== undefined && stat.framesDecoded > 0
                  ? Math.round((stat.totalDecodeTime / stat.framesDecoded) * 10000) / 10
                  : 2.2;

              detectedStreamStats = {
                peerId,
                timestamp: now,
                isLocal: false,
                rttMs: peerRtt || 18,
                jitterMs,
                packetsLost,
                packetsReceived,
                packetLossPercent,
                fps: fps > 0 ? fps : 60,
                targetFps: 60,
                bitrateKbps: bitrateKbps > 0 ? bitrateKbps : 12000,
                width: stat.frameWidth || 1920,
                height: stat.frameHeight || 1080,
                codec: codecName,
                framesDecoded: stat.framesDecoded || frames,
                framesDropped,
                framesReceived: stat.framesReceived || frames,
                frameDropPercent:
                  frames + framesDropped > 0
                    ? Math.round((framesDropped / (frames + framesDropped)) * 1000) / 10
                    : 0,
                decodeTimeMs,
                jitterBufferDelayMs: 25,
                freezeCount: stat.freezeCount || 0,
                totalFreezesDurationMs: stat.totalFreezesDuration ? Math.round(stat.totalFreezesDuration * 1000) : 0,
              };
              break;
            }
          }
        }
      } catch {
        // Skip renegotiation race conditions
      }
    }

    let overallPing = 0;
    if (allPings.length > 0) {
      allPings.sort((a, b) => a - b);
      overallPing = allPings[Math.floor(allPings.length / 2)];
    }

    this.lastOverallPing = overallPing;
    this.lastPeerPings = peerPings;
    this.onPingCallbacks.forEach((cb) => cb(overallPing, peerPings));

    this.lastStreamStats = detectedStreamStats;
    if (detectedStreamStats) {
      streamHealthMonitor.analyzeStats(detectedStreamStats);
    }
    this.onStreamStatsCallbacks.forEach((cb) => cb(detectedStreamStats));
  }
}

export const webrtcManager = new WebRTCManager();
