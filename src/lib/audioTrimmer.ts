/**
 * Utility to decode, slice, and encode audio into lightweight 22kHz mono WAV data URLs.
 * Compact size (~20-40KB) ensures seamless transmission across WebRTC & Supabase Realtime signaling.
 */

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioContextClass();
  try {
    return await ctx.decodeAudioData(arrayBuffer);
  } finally {
    ctx.close().catch(() => {});
  }
}

export async function trimAndEncodeAudio(
  buffer: AudioBuffer,
  startSec: number,
  durationSec: number,
  targetSampleRate = 16000
): Promise<string> {
  const clampedStart = Math.max(0, Math.min(startSec, buffer.duration - 0.2));
  const clampedDuration = Math.max(0.3, Math.min(durationSec, buffer.duration - clampedStart, 2.5));
  const targetLength = Math.floor(clampedDuration * targetSampleRate);

  // Render slice downsampled to mono targetSampleRate
  const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineCtx.destination);
  source.start(0, clampedStart, clampedDuration);

  const renderedBuffer = await offlineCtx.startRendering();
  const pcmData = renderedBuffer.getChannelData(0);

  // Encode to 16-bit mono PCM WAV
  const wavBytes = encodeWavMono16Bit(pcmData, targetSampleRate);
  const blob = new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

function encodeWavMono16Bit(samples: Float32Array, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + samples.length * 2, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 = PCM)
  view.setUint16(20, 1, true);
  // channel count (1 = mono)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * 1 * 16 / 8)
  view.setUint32(28, sampleRate * 2, true);
  // block align (1 * 16 / 8)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, samples.length * 2, true);

  // Write 16-bit PCM samples with gentle fade in / fade out to eliminate clicks
  let offset = 44;
  const fadeLength = Math.min(256, Math.floor(samples.length / 10));

  for (let i = 0; i < samples.length; i++, offset += 2) {
    let s = samples[i];

    // Fade in
    if (i < fadeLength) {
      s *= i / fadeLength;
    }
    // Fade out
    else if (i > samples.length - fadeLength) {
      s *= (samples.length - i) / fadeLength;
    }

    // Clamp
    s = Math.max(-1, Math.min(1, s));
    // Scale to 16-bit integer
    const int16 = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, int16, true);
  }

  return new Uint8Array(buffer);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
