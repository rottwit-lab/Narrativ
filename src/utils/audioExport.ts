import { Mp3Encoder } from '@breezystack/lamejs';
import { Chapter } from '../types';

export interface ExportProgressCallback {
  (step: string, progress: number): void;
}

/**
 * Converts a Float32Array of audio samples (-1.0 to 1.0) into an Int16Array (-32768 to 32767)
 */
function floatToInt16(floatSamples: Float32Array): Int16Array {
  const int16 = new Int16Array(floatSamples.length);
  for (let i = 0; i < floatSamples.length; i++) {
    const s = Math.max(-1, Math.min(1, floatSamples[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

/**
 * Decodes a Blob (WAV/Audio) into an AudioBuffer using the Web Audio API
 */
async function decodeAudioBlob(blob: Blob, audioCtx: AudioContext): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  // decodeAudioData handles WAV, MP3, OGG, etc. reliably
  return await audioCtx.decodeAudioData(arrayBuffer.slice(0));
}

/**
 * Encodes an Int16Array of mono audio samples into an MP3 Blob
 */
export function encodeMonoPcmToMp3(
  samples: Int16Array,
  sampleRate: number,
  kbps: number = 128,
  onProgress?: (percent: number) => void
): Blob {
  const mp3encoder = new Mp3Encoder(1, sampleRate, kbps);
  const mp3Data: Uint8Array[] = [];
  const chunkSize = 1152; // LAME standard frame size

  for (let i = 0; i < samples.length; i += chunkSize) {
    const chunk = samples.subarray(i, i + chunkSize);
    const mp3buf = mp3encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }
    if (onProgress && i % (chunkSize * 50) === 0) {
      onProgress(Math.round((i / samples.length) * 100));
    }
  }

  const flush = mp3encoder.flush();
  if (flush.length > 0) {
    mp3Data.push(new Uint8Array(flush));
  }

  return new Blob(mp3Data, { type: 'audio/mp3' });
}

/**
 * Concatenates multiple chapters into a single MP3 audiobook file
 * Adds a configurable silence interval (default 1.5s) between chapters.
 */
export async function concatenateChaptersToMp3(
  chapters: Chapter[],
  bookTitle: string,
  authorName: string,
  silenceSeconds: number = 1.5,
  onProgress?: ExportProgressCallback
): Promise<{ blob: Blob; totalDuration: number; chapterTimestamps: { title: string; startTime: number }[] }> {
  // Filter chapters with valid audio
  const audioChapters = chapters.filter(
    (c) => (c.audioBlob && c.audioBlob.size > 0) || !!c.audioBlobUrl
  );

  if (audioChapters.length === 0) {
    throw new Error('No synthesized audio chapters found to export.');
  }

  onProgress?.('Initializing Audio Pipeline...', 5);

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();

  const decodedBuffers: AudioBuffer[] = [];
  const chapterTimestamps: { title: string; startTime: number }[] = [];

  // Step 1: Decode all chapters
  for (let i = 0; i < audioChapters.length; i++) {
    const ch = audioChapters[i];
    onProgress?.(`Decoding Chapter ${i + 1} of ${audioChapters.length}: ${ch.title}...`, 10 + Math.round((i / audioChapters.length) * 40));

    let blob = ch.audioBlob;
    if (!blob && ch.audioBlobUrl) {
      const response = await fetch(ch.audioBlobUrl);
      blob = await response.blob();
    }

    if (!blob) {
      throw new Error(`Missing audio blob for chapter: ${ch.title}`);
    }

    const audioBuffer = await decodeAudioBlob(blob, audioCtx);
    decodedBuffers.push(audioBuffer);
  }

  // Use the sample rate of the first buffer (typically 24000Hz from Gemini TTS)
  const targetSampleRate = decodedBuffers[0].sampleRate;
  const silenceSamplesCount = Math.round(silenceSeconds * targetSampleRate);

  // Step 2: Calculate total length and track chapter timestamps
  let totalLength = 0;
  let currentTime = 0;

  for (let i = 0; i < decodedBuffers.length; i++) {
    const buf = decodedBuffers[i];
    chapterTimestamps.push({
      title: audioChapters[i].title,
      startTime: currentTime,
    });

    totalLength += buf.length;
    currentTime += buf.duration;

    // Add silence after each chapter except the last
    if (i < decodedBuffers.length - 1) {
      totalLength += silenceSamplesCount;
      currentTime += silenceSeconds;
    }
  }

  onProgress?.('Concatenating Audio Tracks...', 55);

  // Step 3: Combine into a single continuous Float32 channel
  const combinedChannel = new Float32Array(totalLength);
  let offset = 0;

  for (let i = 0; i < decodedBuffers.length; i++) {
    const buf = decodedBuffers[i];
    const channelData = buf.getChannelData(0); // Take mono or left channel

    combinedChannel.set(channelData, offset);
    offset += buf.length;

    // Insert natural silence gap
    if (i < decodedBuffers.length - 1) {
      // Silence is naturally 0.0 in Float32Array
      offset += silenceSamplesCount;
    }
  }

  onProgress?.('Converting to 16-bit Master PCM...', 65);
  const int16Samples = floatToInt16(combinedChannel);

  // Step 4: Encode to MP3 (128 kbps stereo/mono standard for speech)
  onProgress?.('Encoding Audiobook to MP3 (128 kbps)...', 75);

  const mp3Blob = encodeMonoPcmToMp3(
    int16Samples,
    targetSampleRate,
    128,
    (percent) => {
      onProgress?.(`Encoding MP3: ${percent}%...`, 75 + Math.round(percent * 0.23));
    }
  );

  onProgress?.('Audiobook MP3 Master Ready!', 100);

  // Close context to free system resources
  if (audioCtx.state !== 'closed') {
    audioCtx.close();
  }

  return {
    blob: mp3Blob,
    totalDuration: currentTime,
    chapterTimestamps,
  };
}

/**
 * Triggers a native browser file download for a generated Blob
 */
export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}
