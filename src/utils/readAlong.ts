import { SentenceCue } from '../types';

/**
 * Parses script or text into sentence cues with estimated timestamps
 * mapped across the chapter's total audio duration.
 */
export function parseSentenceCues(text: string, totalDuration: number): SentenceCue[] {
  if (!text || !text.trim()) return [];

  // Match sentences ending in punctuation or quotes
  const sentenceRegex = /[^.!?\n]+(?:[.!?]+["'”’]?|\n+|$)/g;
  const rawMatches = text.match(sentenceRegex) || [text];
  const cleanedSentences = rawMatches
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (cleanedSentences.length === 0) return [];

  // Calculate weights based on character length & word count
  const weights = cleanedSentences.map(s => {
    const wordCount = s.split(/\s+/).filter(Boolean).length;
    return Math.max(1, wordCount + s.length * 0.1);
  });

  const totalWeight = weights.reduce((acc, w) => acc + w, 0);
  const duration = Math.max(1, totalDuration || cleanedSentences.length * 3.5);

  let currentCursor = 0;
  return cleanedSentences.map((sentence, idx) => {
    const sentenceDuration = (weights[idx] / totalWeight) * duration;
    const startTime = currentCursor;
    const endTime = currentCursor + sentenceDuration;
    currentCursor = endTime;

    // Detect if this sentence is dialogue (in quotes) or tagged
    let speaker: string | undefined;
    const speakerMatch = sentence.match(/^([A-Z][a-zA-Z\s]{1,16}):\s*(.*)/);
    if (speakerMatch) {
      speaker = speakerMatch[1].trim();
    } else if (sentence.startsWith('"') || sentence.startsWith('“') || sentence.includes('“') || sentence.includes('"')) {
      speaker = 'Dialogue';
    } else {
      speaker = 'Narrator';
    }

    return {
      id: `sentence-${idx}`,
      text: sentence,
      speaker,
      startTime,
      endTime,
    };
  });
}

/**
 * Finds which sentence index corresponds to the current audio playback time.
 */
export function findActiveSentenceIndex(cues: SentenceCue[], currentTime: number): number {
  if (!cues || cues.length === 0) return -1;
  const idx = cues.findIndex(cue => currentTime >= cue.startTime && currentTime < cue.endTime);
  if (idx !== -1) return idx;
  if (currentTime >= (cues[cues.length - 1]?.endTime || 0)) return cues.length - 1;
  return 0;
}
