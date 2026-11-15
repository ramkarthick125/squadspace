export interface WebRTCStreamStats {
  peerId: string;
  timestamp: number;
  isLocal: boolean; // true = broadcaster (sending), false = spectator (receiving)
  rttMs: number; // Round-trip time (ping) in milliseconds
  jitterMs: number;
  packetsLost: number;
  packetsReceived: number;
  packetLossPercent: number;
  
  // Video metrics
  fps: number;
  targetFps: number;
  bitrateKbps: number;
  targetBitrateKbps?: number;
  width: number;
  height: number;
  codec: string; // e.g. 'AV1', 'VP9', 'H.264'

  // Spectator / Inbound specific
  framesDecoded?: number;
  framesDropped?: number;
  framesReceived?: number;
  frameDropPercent?: number;
  decodeTimeMs?: number; // Average decode time per frame
  jitterBufferDelayMs?: number;
  freezeCount?: number;
  totalFreezesDurationMs?: number;

  // Broadcaster / Outbound specific
  framesSent?: number;
  qualityLimitationReason?: 'none' | 'cpu' | 'bandwidth' | 'other';
  retransmittedPacketsSent?: number;
}

export type DiagnosticSeverity = 'info' | 'warning' | 'critical';

export type DiagnosticCategory =
  | 'framerate_drop'
  | 'frame_drops'
  | 'pixelation_risk'
  | 'network_jitter'
  | 'packet_loss'
  | 'encoder_throttled'
  | 'decoder_slow';

export interface StreamDiagnosticEvent {
  id: string;
  timestamp: number;
  timeFormatted: string; // "HH:MM:SS"
  severity: DiagnosticSeverity;
  category: DiagnosticCategory;
  title: string;
  description: string;
  metrics: {
    fps?: number;
    targetFps?: number;
    bitrateKbps?: number;
    framesDroppedDelta?: number;
    rttMs?: number;
    jitterMs?: number;
    packetLossPercent?: number;
    qualityLimiter?: string;
    decodeTimeMs?: number;
  };
  possibleCause: string;
  recommendation: string;
}

export interface StreamHealthSummary {
  healthScore: number; // 0 to 100
  healthRating: 'excellent' | 'good' | 'fair' | 'poor';
  sessionDurationSeconds: number;
  avgFps: number;
  minFps: number;
  avgBitrateKbps: number;
  minBitrateKbps: number;
  totalFramesDropped: number;
  totalLagEvents: number;
  totalPixelationEvents: number;
}
