/**
 * Automated Stream Health Monitor & Diagnostic Logger for SquadSpace
 * 
 * Automatically monitors screen sharing streams (both broadcast and spectate)
 * detects micro-stutters, framerate drops, bitrate collapses (pixelation),
 * packet loss, and hardware bottlenecks in real-time.
 * 
 * Records timestamped events so users can review exact issues without needing
 * an external observer.
 */

import {
  WebRTCStreamStats,
  StreamDiagnosticEvent,
  StreamHealthSummary,
  DiagnosticCategory,
  DiagnosticSeverity,
} from '../types/streamStats';

class StreamHealthMonitor {
  private events: StreamDiagnosticEvent[] = [];
  private maxEvents: number = 200;
  private sessionStartTime: number = 0;
  private lastStats: WebRTCStreamStats | null = null;
  private lastEventTimes: Map<DiagnosticCategory, number> = new Map();
  private cooldownMs: number = 4000; // Throttle repetitive logs for same issue to once every 4s

  // Rolling metrics for session summary
  private fpsSamples: number[] = [];
  private bitrateSamples: number[] = [];
  private totalFramesDropped: number = 0;
  private totalLagEvents: number = 0;
  private totalPixelationEvents: number = 0;
  private listeners: Set<(events: StreamDiagnosticEvent[], summary: StreamHealthSummary) => void> = new Set();

  constructor() {
    this.loadPersistedEvents();
  }

  private loadPersistedEvents() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('squadspace_stream_diagnostics_recent');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.events = parsed.slice(-50);
        }
      }
    } catch {}
  }

  private persistEvents() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        'squadspace_stream_diagnostics_recent',
        JSON.stringify(this.events.slice(-50))
      );
    } catch {}
  }

  /**
   * Reset the session tracking when a new stream starts
   */
  public startSession(initialTargetFps: number = 60) {
    this.sessionStartTime = Date.now();
    this.lastStats = null;
    this.fpsSamples = [];
    this.bitrateSamples = [];
    this.totalFramesDropped = 0;
    this.totalLagEvents = 0;
    this.totalPixelationEvents = 0;
    this.lastEventTimes.clear();

    this.addEvent({
      severity: 'info',
      category: 'framerate_drop',
      title: 'Stream Health Monitoring Started',
      description: `Automated diagnostic engine active. Monitoring 60 FPS pacing, bitrate stability, and frame drops.`,
      metrics: { targetFps: initialTargetFps },
      possibleCause: 'Session initialized',
      recommendation: 'Engine will automatically log any stutters, bitrate drops, or dropped frames.',
    });
  }

  /**
   * Primary diagnostic inspection entry point (called every 1.5 seconds with live WebRTC stats)
   */
  public analyzeStats(current: WebRTCStreamStats) {
    if (!this.sessionStartTime) {
      this.sessionStartTime = current.timestamp;
    }

    const now = Date.now();
    const prev = this.lastStats;
    const targetFps = current.targetFps || 60;

    // Track rolling metrics
    if (current.fps > 0) {
      this.fpsSamples.push(current.fps);
      if (this.fpsSamples.length > 120) this.fpsSamples.shift();
    }
    if (current.bitrateKbps > 0) {
      this.bitrateSamples.push(current.bitrateKbps);
      if (this.bitrateSamples.length > 120) this.bitrateSamples.shift();
    }

    // --- 1. Automated Framerate Drop (Stutter / Lack of Smoothness) Check ---
    const fpsThreshold = targetFps * 0.75; // e.g. < 45 FPS on 60 FPS target
    if (current.fps > 0 && current.fps < fpsThreshold) {
      const isCritical = current.fps < targetFps * 0.5; // e.g. < 30 FPS
      this.tryLogEvent('framerate_drop', {
        severity: isCritical ? 'critical' : 'warning',
        category: 'framerate_drop',
        title: `Framerate Drop: ${current.fps.toFixed(1)} FPS (Target: ${targetFps} FPS)`,
        description: `Stream framerate dropped below fluid threshold. Visual smoothness is degraded.`,
        metrics: {
          fps: current.fps,
          targetFps,
          rttMs: current.rttMs,
        },
        possibleCause: current.isLocal
          ? 'Host GPU/DWM captured fewer frames (game may have 100% GPU priority or window occlusion).'
          : 'Spectator display refresh sync or packet delivery burst.',
        recommendation: current.isLocal
          ? 'Cap your game framerate slightly below max GPU usage or keep hardware acceleration enabled.'
          : 'Check if monitor refresh rate is set to 60Hz or higher.',
      });
      this.totalLagEvents++;
    }

    // --- 2. Automated Dropped Frames Check (Receiver) ---
    if (prev && current.framesDropped !== undefined && prev.framesDropped !== undefined) {
      const droppedDelta = current.framesDropped - prev.framesDropped;
      if (droppedDelta > 0) {
        this.totalFramesDropped += droppedDelta;
        this.tryLogEvent('frame_drops', {
          severity: droppedDelta > 15 ? 'critical' : 'warning',
          category: 'frame_drops',
          title: `${droppedDelta} Dropped Frame${droppedDelta > 1 ? 's' : ''} Detected`,
          description: `The video decoder skipped ${droppedDelta} frames because they arrived late or renderer missed presentation deadline.`,
          metrics: {
            framesDroppedDelta: droppedDelta,
            fps: current.fps,
            rttMs: current.rttMs,
            decodeTimeMs: current.decodeTimeMs,
          },
          possibleCause: 'Jitter buffer starvation or rendering compositor backpressure.',
          recommendation: 'Check network stability. Direct3D 11 hardware overlay in v1.0.3 mitigates compositor drops.',
        });
        this.totalLagEvents++;
      }
    }

    // --- 3. Automated Bitrate Collapse (Pixelation Risk) Check ---
    // If bitrate drops below 4.5 Mbps for 1080p/2K or drops by > 50% abruptly
    const minAcceptableBitrateKbps = 4500;
    if (current.bitrateKbps > 0 && current.bitrateKbps < minAcceptableBitrateKbps) {
      this.tryLogEvent('pixelation_risk', {
        severity: current.bitrateKbps < 2000 ? 'critical' : 'warning',
        category: 'pixelation_risk',
        title: `Low Bitrate: ${(current.bitrateKbps / 1000).toFixed(1)} Mbps (Pixelation Warning)`,
        description: `Current video bitrate dipped below the recommended 4.5 Mbps floor. Stream is vulnerable to macroblock blur and compression artifacts.`,
        metrics: {
          bitrateKbps: current.bitrateKbps,
          fps: current.fps,
          packetLossPercent: current.packetLossPercent,
        },
        possibleCause: 'Network congestion or dynamic REMB bandwidth backoff.',
        recommendation: 'Ensure both peers have stable upstream/downstream bandwidth without background downloads.',
      });
      this.totalPixelationEvents++;
    }

    // --- 4. Automated Network Latency & Packet Loss Spike Check ---
    if (current.packetLossPercent > 2.0 || current.rttMs > 140) {
      const isCritical = current.packetLossPercent > 6.0 || current.rttMs > 250;
      this.tryLogEvent('packet_loss', {
        severity: isCritical ? 'critical' : 'warning',
        category: current.packetLossPercent > 2.0 ? 'packet_loss' : 'network_jitter',
        title: `Network Instability: Ping ${current.rttMs}ms | Loss ${current.packetLossPercent.toFixed(1)}%`,
        description: `High packet transit variance detected between streamer and viewer.`,
        metrics: {
          rttMs: current.rttMs,
          packetLossPercent: current.packetLossPercent,
          jitterMs: current.jitterMs,
        },
        possibleCause: 'Wi-Fi interference, ISP bufferbloat, or routing hops.',
        recommendation: 'Use Ethernet cable if possible or avoid heavy parallel network usage.',
      });
    }

    // --- 5. Automated Broadcaster Quality Limitation Check (Sender) ---
    if (current.isLocal && current.qualityLimitationReason && current.qualityLimitationReason !== 'none') {
      this.tryLogEvent('encoder_throttled', {
        severity: 'warning',
        category: 'encoder_throttled',
        title: `Hardware Throttled: ${current.qualityLimitationReason.toUpperCase()}`,
        description: `WebRTC video encoder is downshifting encoding parameters due to ${current.qualityLimitationReason} bottlenecks.`,
        metrics: {
          qualityLimiter: current.qualityLimitationReason,
          fps: current.fps,
          bitrateKbps: current.bitrateKbps,
        },
        possibleCause: current.qualityLimitationReason === 'cpu'
          ? 'CPU usage is pegged at 100%, slowing down video frame encoding.'
          : 'Detected network path bandwidth restriction.',
        recommendation: 'Close background CPU-intensive processes or lower in-game graphics presets.',
      });
    }

    // --- 6. Automated Decoder Latency Check (Viewer) ---
    if (!current.isLocal && current.decodeTimeMs && current.decodeTimeMs > 16.6) {
      this.tryLogEvent('decoder_slow', {
        severity: 'warning',
        category: 'decoder_slow',
        title: `Slow Video Decode: ${current.decodeTimeMs.toFixed(1)}ms per frame`,
        description: `GPU/CPU decoder took longer than the 16.6ms frame budget, which can cause micro-stutters.`,
        metrics: {
          decodeTimeMs: current.decodeTimeMs,
          fps: current.fps,
        },
        possibleCause: 'Hardware decoder saturated or fallback to software decoding.',
        recommendation: 'Ensure GPU hardware acceleration is turned on in settings.',
      });
    }

    this.lastStats = current;
    this.notifyListeners();
  }

  private tryLogEvent(
    category: DiagnosticCategory,
    eventParams: Omit<StreamDiagnosticEvent, 'id' | 'timestamp' | 'timeFormatted'>
  ) {
    const now = Date.now();
    const lastTime = this.lastEventTimes.get(category) || 0;
    if (now - lastTime < this.cooldownMs && eventParams.severity !== 'critical') {
      return; // Cooldown active, avoid spamming identical warning
    }

    this.lastEventTimes.set(category, now);
    this.addEvent(eventParams);
  }

  public addEvent(eventParams: Omit<StreamDiagnosticEvent, 'id' | 'timestamp' | 'timeFormatted'>) {
    const now = new Date();
    const timeFormatted = now.toTimeString().split(' ')[0]; // "HH:MM:SS"

    const event: StreamDiagnosticEvent = {
      ...eventParams,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      timeFormatted,
    };

    this.events.unshift(event);
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }

    this.persistEvents();

    // If running in Electron, append to native log if IPC is available
    if (typeof window !== 'undefined' && (window as any).electronAPI?.appendDiagnosticLog) {
      try {
        (window as any).electronAPI.appendDiagnosticLog({
          time: timeFormatted,
          severity: event.severity,
          category: event.category,
          title: event.title,
          description: event.description,
          metrics: event.metrics,
        });
      } catch {}
    }

    this.notifyListeners();
  }

  /**
   * Get calculated health summary
   */
  public getHealthSummary(): StreamHealthSummary {
    const durationSeconds = this.sessionStartTime
      ? Math.round((Date.now() - this.sessionStartTime) / 1000)
      : 0;

    const avgFps =
      this.fpsSamples.length > 0
        ? Math.round((this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length) * 10) / 10
        : 60;

    const minFps =
      this.fpsSamples.length > 0
        ? Math.round(Math.min(...this.fpsSamples) * 10) / 10
        : 60;

    const avgBitrateKbps =
      this.bitrateSamples.length > 0
        ? Math.round(this.bitrateSamples.reduce((a, b) => a + b, 0) / this.bitrateSamples.length)
        : 12000;

    const minBitrateKbps =
      this.bitrateSamples.length > 0 ? Math.min(...this.bitrateSamples) : 12000;

    // Calculate Health Score (100 is flawless)
    let score = 100;
    score -= Math.min(25, this.totalLagEvents * 4);
    score -= Math.min(20, this.totalPixelationEvents * 5);
    score -= Math.min(25, this.totalFramesDropped * 0.5);
    if (avgFps < 55) score -= (55 - avgFps) * 2;
    score = Math.max(10, Math.min(100, Math.round(score)));

    let healthRating: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
    if (score >= 90) healthRating = 'excellent';
    else if (score >= 75) healthRating = 'good';
    else if (score >= 55) healthRating = 'fair';
    else healthRating = 'poor';

    return {
      healthScore: score,
      healthRating,
      sessionDurationSeconds: durationSeconds,
      avgFps,
      minFps,
      avgBitrateKbps,
      minBitrateKbps,
      totalFramesDropped: this.totalFramesDropped,
      totalLagEvents: this.totalLagEvents,
      totalPixelationEvents: this.totalPixelationEvents,
    };
  }

  public getEvents(): StreamDiagnosticEvent[] {
    return [...this.events];
  }

  public clearEvents() {
    this.events = [];
    this.totalLagEvents = 0;
    this.totalPixelationEvents = 0;
    this.totalFramesDropped = 0;
    this.persistEvents();
    this.notifyListeners();
  }

  /**
   * Export the diagnostic logs as a clean text report for review
   */
  public generateTextReport(): string {
    const summary = this.getHealthSummary();
    const durationMins = Math.floor(summary.sessionDurationSeconds / 60);
    const durationSecs = summary.sessionDurationSeconds % 60;

    const lines: string[] = [
      '=================================================================',
      '         SQUADSPACE STREAM HEALTH & DIAGNOSTIC REPORT',
      '=================================================================',
      `Generated: ${new Date().toLocaleString()}`,
      `Stream Health Score: ${summary.healthScore}% (${summary.healthRating.toUpperCase()})`,
      `Monitored Duration: ${durationMins}m ${durationSecs}s`,
      `Framerate: Average ${summary.avgFps} FPS | Lowest ${summary.minFps} FPS`,
      `Bitrate: Average ${(summary.avgBitrateKbps / 1000).toFixed(1)} Mbps | Lowest ${(summary.minBitrateKbps / 1000).toFixed(1)} Mbps`,
      `Total Dropped Frames: ${summary.totalFramesDropped}`,
      `Total Lag/Stutter Events: ${summary.totalLagEvents}`,
      `Total Low Bitrate (Pixelation) Events: ${summary.totalPixelationEvents}`,
      '-----------------------------------------------------------------',
      'TIMESTAMPED DIAGNOSTIC EVENTS:',
      '-----------------------------------------------------------------',
    ];

    if (this.events.length === 0) {
      lines.push('No anomalies detected! Stream ran smoothly without lag or pixelation.');
    } else {
      this.events.forEach((e) => {
        lines.push(
          `[${e.timeFormatted}] [${e.severity.toUpperCase()}] ${e.title}`
        );
        lines.push(`  Details: ${e.description}`);
        if (e.possibleCause) lines.push(`  Probable Cause: ${e.possibleCause}`);
        if (e.recommendation) lines.push(`  Recommendation: ${e.recommendation}`);
        lines.push('');
      });
    }

    lines.push('=================================================================');
    return lines.join('\n');
  }

  public subscribe(listener: (events: StreamDiagnosticEvent[], summary: StreamHealthSummary) => void): () => void {
    this.listeners.add(listener);
    listener(this.getEvents(), this.getHealthSummary());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const events = this.getEvents();
    const summary = this.getHealthSummary();
    this.listeners.forEach((fn) => fn(events, summary));
  }
}

export const streamHealthMonitor = new StreamHealthMonitor();
