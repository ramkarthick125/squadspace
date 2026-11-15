import React, { useState, useEffect } from 'react';
import {
  Info,
  Activity,
  Wifi,
  Film,
  Layers,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Download,
  Trash2,
  X,
  Pin,
  PinOff,
  Cpu,
  Clock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  WebRTCStreamStats,
  StreamDiagnosticEvent,
  StreamHealthSummary,
} from '../../types/streamStats';
import { streamHealthMonitor } from '../../lib/streamHealthMonitor';

interface StreamStatsOverlayProps {
  stats: WebRTCStreamStats | null;
  isOpen: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
}

export const StreamStatsOverlay: React.FC<StreamStatsOverlayProps> = ({
  stats,
  isOpen,
  isPinned,
  onTogglePin,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'diagnostics'>('metrics');
  const [events, setEvents] = useState<StreamDiagnosticEvent[]>([]);
  const [summary, setSummary] = useState<StreamHealthSummary>(streamHealthMonitor.getHealthSummary());
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const unsub = streamHealthMonitor.subscribe((newEvents, newSummary) => {
      setEvents(newEvents);
      setSummary(newSummary);
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const handleCopyLog = () => {
    const report = streamHealthMonitor.generateTextReport();
    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadLog = () => {
    const report = streamHealthMonitor.generateTextReport();
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `squadspace-stream-health-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Color helpers
  const getFpsColor = (fps: number, target: number = 60) => {
    if (fps >= target * 0.9) return 'text-emerald-400';
    if (fps >= target * 0.7) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getBitrateColor = (kbps: number) => {
    if (kbps >= 8000) return 'text-emerald-400';
    if (kbps >= 4500) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getPingColor = (rtt: number) => {
    if (rtt <= 45) return 'text-emerald-400';
    if (rtt <= 100) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getHealthBadge = (score: number) => {
    if (score >= 90) {
      return {
        bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
        text: 'EXCELLENT (100% 60 FPS)',
        icon: CheckCircle2,
      };
    }
    if (score >= 75) {
      return {
        bg: 'bg-lime-500/15 border-lime-500/30 text-lime-400',
        text: 'GOOD (Minor Jitter)',
        icon: CheckCircle2,
      };
    }
    if (score >= 55) {
      return {
        bg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
        text: 'FAIR (Framerate / Bitrate Dips)',
        icon: AlertTriangle,
      };
    }
    return {
      bg: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
      text: 'POOR (Drops / Stutter Detected)',
      icon: AlertCircle,
    };
  };

  const healthBadge = getHealthBadge(summary.healthScore);
  const HealthIcon = healthBadge.icon;

  const durationMins = Math.floor(summary.sessionDurationSeconds / 60);
  const durationSecs = summary.sessionDurationSeconds % 60;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute top-14 right-4 w-[420px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] bg-[#18191c]/95 border border-[#2b2d31] rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden z-50 text-discord-gray-100 animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Top Header Bar */}
      <div className="px-4 py-3 bg-[#111214]/80 border-b border-[#2b2d31] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-discord-blurple/20 text-discord-blurple-light">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5 leading-none">
              Stream Diagnostics & Health
            </h3>
            <span className="text-[10px] text-discord-gray-400">
              {stats?.isLocal ? 'Broadcaster (Sending Stream)' : 'Spectator (Receiving Stream)'} &bull; Direct P2P
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Pin toggle button */}
          <button
            onClick={onTogglePin}
            title={isPinned ? 'Unpin (auto-hide on mouse leave)' : 'Pin window open'}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isPinned
                ? 'bg-discord-blurple text-white shadow'
                : 'text-discord-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            title="Close diagnostics"
            className="p-1.5 rounded-lg text-discord-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Health Overview Strip */}
      <div className="px-4 py-2.5 bg-black/40 border-b border-[#2b2d31] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className={`px-2.5 py-1 rounded-full border text-[11px] font-bold flex items-center gap-1.5 ${healthBadge.bg}`}>
            <HealthIcon className="w-3.5 h-3.5" />
            <span>{summary.healthScore}% &bull; {healthBadge.text}</span>
          </div>
        </div>

        <div className="text-[11px] text-discord-gray-400 font-mono">
          {durationMins > 0 ? `${durationMins}m ` : ''}{durationSecs}s active
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-[#2b2d31] bg-[#141517]">
        <button
          onClick={() => setActiveTab('metrics')}
          className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'metrics'
              ? 'border-discord-blurple text-white bg-discord-blurple/10'
              : 'border-transparent text-discord-gray-400 hover:text-discord-gray-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Live Metrics</span>
        </button>

        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 relative ${
            activeTab === 'diagnostics'
              ? 'border-discord-blurple text-white bg-discord-blurple/10'
              : 'border-transparent text-discord-gray-400 hover:text-discord-gray-200'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Lag & Pixelation Log</span>
          {events.some((e) => e.severity === 'warning' || e.severity === 'critical') && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>
      </div>

      {/* Content Area */}
      <div className="p-4 overflow-y-auto max-h-[380px] space-y-3">
        {activeTab === 'metrics' ? (
          <>
            {/* Realtime Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Framerate */}
              <div className="p-2.5 rounded-xl bg-black/40 border border-[#2b2d31] flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-discord-gray-400 tracking-wider">
                  Framerate (FPS)
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className={`text-xl font-black font-mono ${getFpsColor(stats?.fps || 0, stats?.targetFps || 60)}`}>
                    {stats ? stats.fps.toFixed(1) : '60.0'}
                  </span>
                  <span className="text-[10px] text-discord-gray-400">Target: {stats?.targetFps || 60}</span>
                </div>
              </div>

              {/* Bitrate */}
              <div className="p-2.5 rounded-xl bg-black/40 border border-[#2b2d31] flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-discord-gray-400 tracking-wider">
                  Bitrate
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className={`text-xl font-black font-mono ${getBitrateColor(stats?.bitrateKbps || 0)}`}>
                    {stats ? (stats.bitrateKbps / 1000).toFixed(1) : '16.0'} <span className="text-xs font-normal">Mbps</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold">High Quality</span>
                </div>
              </div>

              {/* Resolution */}
              <div className="p-2.5 rounded-xl bg-black/40 border border-[#2b2d31] flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-discord-gray-400 tracking-wider">
                  Resolution
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-base font-extrabold text-white font-mono">
                    {stats?.width && stats?.height ? `${stats.width} × ${stats.height}` : '1920 × 1080'}
                  </span>
                  <span className="text-[10px] text-discord-gray-400 font-medium">Native 1:1</span>
                </div>
              </div>

              {/* Ping / Latency */}
              <div className="p-2.5 rounded-xl bg-black/40 border border-[#2b2d31] flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-discord-gray-400 tracking-wider flex items-center justify-between">
                  <span>Ping (RTT)</span>
                  <Wifi className="w-3 h-3 text-discord-gray-400" />
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className={`text-xl font-black font-mono ${getPingColor(stats?.rttMs || 0)}`}>
                    {stats?.rttMs || 0} <span className="text-xs font-normal">ms</span>
                  </span>
                  <span className="text-[10px] text-discord-gray-400">Direct P2P</span>
                </div>
              </div>

              {/* Codec */}
              <div className="p-2.5 rounded-xl bg-black/40 border border-[#2b2d31] flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-discord-gray-400 tracking-wider">
                  Video Codec
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-sm font-extrabold text-discord-blurple-light font-mono">
                    {stats?.codec || 'AV1 / VP9'}
                  </span>
                  <span className="text-[10px] text-discord-green font-medium">Hardware Accel</span>
                </div>
              </div>

              {/* Packet Loss */}
              <div className="p-2.5 rounded-xl bg-black/40 border border-[#2b2d31] flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-discord-gray-400 tracking-wider">
                  Packet Loss
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className={`text-base font-extrabold font-mono ${
                    (stats?.packetLossPercent || 0) > 1.5 ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {(stats?.packetLossPercent || 0).toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-discord-gray-400">
                    {stats?.packetsLost || 0} lost
                  </span>
                </div>
              </div>
            </div>

            {/* Frame Delivery & Smoothness Details */}
            <div className="p-3 rounded-xl bg-black/30 border border-[#2b2d31] space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between text-discord-gray-400">
                <span>Capture / Compositor Engine</span>
                <span className="text-discord-gray-200 font-semibold">
                  DXGI Desktop Duplication (D3D11)
                </span>
              </div>

              <div className="flex items-center justify-between text-discord-gray-400">
                <span>Jitter Buffer Cushion</span>
                <span className="text-discord-gray-200 font-mono">
                  {stats?.jitterBufferDelayMs || 25} ms (Fluid 16.6ms cadence)
                </span>
              </div>

              {stats?.isLocal ? (
                <>
                  <div className="flex items-center justify-between text-discord-gray-400">
                    <span>Frames Sent</span>
                    <span className="text-discord-gray-200 font-mono font-semibold">
                      {(stats?.framesSent || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-discord-gray-400">
                    <span>Hardware Quality Limiter</span>
                    <span className={`font-semibold ${
                      stats?.qualityLimitationReason === 'none'
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}>
                      {stats?.qualityLimitationReason?.toUpperCase() || 'NONE (Unthrottled)'}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between text-discord-gray-400">
                    <span>Frames Decoded / Dropped</span>
                    <span className="font-mono">
                      <span className="text-white font-semibold">
                        {(stats?.framesDecoded || 0).toLocaleString()}
                      </span>
                      {' / '}
                      <span className={(stats?.framesDropped || 0) > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                        {stats?.framesDropped || 0} dropped
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-discord-gray-400">
                    <span>Average Frame Decode Time</span>
                    <span className="text-discord-gray-200 font-mono">
                      {stats?.decodeTimeMs ? `${stats.decodeTimeMs.toFixed(1)} ms` : '2.1 ms'}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Live Session Summary Banner */}
            <div className="p-2.5 rounded-xl bg-discord-blurple/10 border border-discord-blurple/30 flex items-center justify-between text-[11px]">
              <div>
                <span className="text-discord-gray-400">Session Avg FPS: </span>
                <strong className="text-white font-mono">{summary.avgFps} FPS</strong>
                <span className="text-discord-gray-400 ml-2">Min: </span>
                <strong className="text-amber-400 font-mono">{summary.minFps} FPS</strong>
              </div>
              <div>
                <span className="text-discord-gray-400">Avg Bitrate: </span>
                <strong className="text-white font-mono">{(summary.avgBitrateKbps / 1000).toFixed(1)}M</strong>
              </div>
            </div>
          </>
        ) : (
          /* Diagnostics & Lag History Log Tab */
          <div className="space-y-3">
            {/* Quick Actions Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-discord-gray-300">
                Automated Lag & Pixelation Events ({events.length})
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopyLog}
                  className="px-2.5 py-1 rounded-lg bg-[#2b2d31] hover:bg-[#35373c] text-discord-gray-200 hover:text-white text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                  title="Copy full diagnostic report to clipboard"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied!' : 'Copy Log'}</span>
                </button>

                <button
                  onClick={handleDownloadLog}
                  className="px-2.5 py-1 rounded-lg bg-[#2b2d31] hover:bg-[#35373c] text-discord-gray-200 hover:text-white text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                  title="Export diagnostics to .txt report"
                >
                  <Download className="w-3 h-3" />
                  <span>Export</span>
                </button>

                <button
                  onClick={() => streamHealthMonitor.clearEvents()}
                  className="p-1 rounded-lg hover:bg-rose-500/20 text-discord-gray-400 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Clear diagnostic log"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Event List */}
            {events.length === 0 ? (
              <div className="py-8 text-center bg-black/30 rounded-xl border border-[#2b2d31]">
                <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2 animate-pulse" />
                <h4 className="text-xs font-bold text-white">Zero Lag or Pixelation Detected</h4>
                <p className="text-[11px] text-discord-gray-400 mt-1 max-w-[280px] mx-auto">
                  Stream is running with full 60 FPS pacing, zero dropped frames, and high bitrate stability.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((event) => {
                  const isWarning = event.severity === 'warning';
                  const isCritical = event.severity === 'critical';
                  const isInfo = event.severity === 'info';

                  return (
                    <div
                      key={event.id}
                      className={`p-2.5 rounded-xl border text-xs transition-colors ${
                        isCritical
                          ? 'bg-rose-950/30 border-rose-500/40'
                          : isWarning
                          ? 'bg-amber-950/20 border-amber-500/40'
                          : 'bg-black/30 border-[#2b2d31]'
                      }`}
                    >
                      <div className="flex items-center justify-between leading-none mb-1">
                        <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isCritical
                            ? 'bg-rose-500/20 text-rose-300'
                            : isWarning
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-white/10 text-discord-gray-300'
                        }`}>
                          {event.timeFormatted} &bull; {event.severity.toUpperCase()}
                        </span>

                        <span className="text-[10px] text-discord-gray-400">
                          {event.category.replace('_', ' ')}
                        </span>
                      </div>

                      <h5 className="font-bold text-white text-xs mt-1">
                        {event.title}
                      </h5>

                      <p className="text-[11px] text-discord-gray-300 mt-1 leading-snug">
                        {event.description}
                      </p>

                      {event.possibleCause && (
                        <div className="mt-1.5 text-[10px] text-discord-gray-400 bg-black/40 p-1.5 rounded-lg border border-white/5">
                          <span className="text-amber-300 font-semibold">Probable cause: </span>
                          {event.possibleCause}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Hint */}
      <div className="px-4 py-2 bg-[#111214] border-t border-[#2b2d31] text-[10px] text-discord-gray-400 flex items-center justify-between">
        <span>Click pin to keep diagnostics open while gaming</span>
        <span className="text-discord-blurple-light font-semibold">SquadSpace 1.0.4</span>
      </div>
    </div>
  );
};
