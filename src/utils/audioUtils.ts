// Audio + text chunking utilities for long-form synthesis.
// Long chapters are split into sentence-aligned chunks (staying within TTS
// input limits), synthesized separately, then the WAV results are merged into
// a single track — with real per-chunk progress.

/** Split text into sentence-aligned chunks of at most `maxChars`. */
export function splitTextIntoChunks(text: string, maxChars = 1400): string[] {
  const clean = (text || '').trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const sentences = clean.match(/[^.!?\n]+[.!?]*[\s]*/g) || [clean];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    // A single sentence longer than the limit gets hard-split at word boundaries.
    if (sentence.length > maxChars) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = '';
      }
      const words = sentence.split(/(\s+)/);
      let hard = '';
      for (const w of words) {
        if ((hard + w).length > maxChars && hard.trim()) {
          chunks.push(hard.trim());
          hard = '';
        }
        hard += w;
      }
      if (hard.trim()) chunks.push(hard.trim());
      continue;
    }

    if ((current + sentence).length > maxChars && current.trim()) {
      chunks.push(current.trim());
      current = '';
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export interface TtsParsedResponse {
  blob: Blob;
  duration: number;
  source: string;
  isLocal: boolean;
  isFallback?: boolean;
  notice?: string;
}

/**
 * Parse a TTS API response. The server returns raw WAV audio (with metadata in
 * X-Narrativ-* headers) on success, or a JSON error envelope on failure.
 */
export async function parseTtsResponse(response: Response): Promise<TtsParsedResponse> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.startsWith('audio/')) {
    const blob = await response.blob();
    return {
      blob,
      duration: parseFloat(response.headers.get('X-Narrativ-Duration') || '0') || 0,
      source: response.headers.get('X-Narrativ-Source') || 'TTS Engine',
      isLocal: response.headers.get('X-Narrativ-Is-Local') === 'true',
      isFallback: response.headers.get('X-Narrativ-Fallback') === 'true',
      notice: response.headers.get('X-Narrativ-Notice') || undefined,
    };
  }

  let data: any = {};
  try {
    data = await response.json();
  } catch {
    if (!response.ok) throw new Error(`TTS request failed (HTTP ${response.status}).`);
    throw new Error('Unexpected response format from TTS server.');
  }
  if (!response.ok || data.success === false) {
    const err: any = new Error(data.error || `TTS request failed (HTTP ${response.status}).`);
    (err as any).quotaExceeded = data.quotaExceeded;
    (err as any).fallbackAvailable = data.fallbackAvailable;
    throw err;
  }
  throw new Error(data.error || 'TTS request failed.');
}

let sharedCtx: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!sharedCtx) {
    const Ctor = (window.AudioContext || (window as any).webkitAudioContext);
    sharedCtx = new Ctor();
  }
  return sharedCtx;
}

/** Encode an AudioBuffer as a 16-bit PCM WAV Blob. */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  const bytesPerSample = 2;
  const dataSize = numSamples * numChannels * bytesPerSample;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, (sampleRate * numChannels * bytesPerSample) / 8, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([out], { type: 'audio/wav' });
}

/**
 * Merge several decoded-capable audio blobs (WAV/MP3/etc.) into one WAV track.
 * All input is resampled to the first blob's sample rate via decodeAudioData.
 */
export async function mergeAudioBlobs(blobs: Blob[]): Promise<{ blob: Blob; duration: number }> {
  if (blobs.length === 0) throw new Error('No audio chunks to merge.');
  if (blobs.length === 1) {
    const blob = blobs[0];
    return { blob, duration: await estimateBlobDuration(blob) };
  }

  const ctx = getAudioContext();
  const buffers: AudioBuffer[] = [];
  for (const b of blobs) {
    const arr = await b.arrayBuffer();
    buffers.push(await ctx.decodeAudioData(arr));
  }
  if (buffers.length === 0) throw new Error('No decodable audio chunks.');

  const sampleRate = buffers[0].sampleRate;
  const numChannels = Math.max(...buffers.map((b) => b.numberOfChannels));
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);

  const combined = ctx.createBuffer(numChannels, totalLength, sampleRate);
  let offset = 0;
  for (const buf of buffers) {
    for (let c = 0; c < numChannels; c++) {
      const src = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1));
      combined.getChannelData(c).set(src, offset);
    }
    offset += buf.length;
  }

  return {
    blob: audioBufferToWavBlob(combined),
    duration: totalLength / sampleRate,
  };
}

/** Best-effort duration estimate for a single audio blob. */
export async function estimateBlobDuration(blob: Blob): Promise<number> {
  try {
    const ctx = getAudioContext();
    const arr = await blob.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr);
    return buf.duration;
  } catch {
    return 0;
  }
}
