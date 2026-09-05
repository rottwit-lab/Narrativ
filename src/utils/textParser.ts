// Text parsing and chapter splitting utility for Narrativ

export interface ParsedChapter {
  id: string;
  title: string;
  originalText: string;
}

export function parseTextIntoChapters(rawText: string, defaultTitle = 'Untitled Book'): ParsedChapter[] {
  const clean = rawText.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];

  // Regex to detect standard chapter headings
  const chapterRegex = /(?:\n\s*|^)(?:chapter|section|part|book|act|prologue|epilogue)\s+([0-9ivxlcdm]+|[a-z]+)?[^\n]*/gi;

  const matches = [...clean.matchAll(chapterRegex)];

  if (matches.length > 1) {
    const chapters: ParsedChapter[] = [];
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const start = match.index ?? 0;
      const end = i < matches.length - 1 ? (matches[i + 1].index ?? clean.length) : clean.length;
      const headerLine = match[0].trim();
      const content = clean.substring(start + match[0].length, end).trim();

      chapters.push({
        id: `ch_${Date.now()}_${i + 1}`,
        title: headerLine.length > 40 ? headerLine.substring(0, 40) + '...' : headerLine,
        originalText: content || headerLine,
      });
    }
    return chapters;
  }

  // Check for Markdown headings # Chapter 1 etc
  const mdHeadingRegex = /(?:\n\s*|^)#{1,3}\s+([^\n]+)/g;
  const mdMatches = [...clean.matchAll(mdHeadingRegex)];
  if (mdMatches.length > 1) {
    const chapters: ParsedChapter[] = [];
    for (let i = 0; i < mdMatches.length; i++) {
      const match = mdMatches[i];
      const start = match.index ?? 0;
      const end = i < mdMatches.length - 1 ? (mdMatches[i + 1].index ?? clean.length) : clean.length;
      const heading = match[1].trim();
      const content = clean.substring(start + match[0].length, end).trim();

      chapters.push({
        id: `ch_${Date.now()}_${i + 1}`,
        title: heading,
        originalText: content || heading,
      });
    }
    return chapters;
  }

  // If no chapter markers, split into logical parts (~1,500 words each) or single chapter
  const words = clean.split(/\s+/);
  if (words.length <= 1200) {
    return [
      {
        id: `ch_${Date.now()}_1`,
        title: defaultTitle || 'Chapter 1',
        originalText: clean,
      },
    ];
  }

  // Split into chunks of ~1200 words at sentence boundaries
  const chapters: ParsedChapter[] = [];
  const chunkSize = 1200;
  let currentWords: string[] = [];
  let partNum = 1;

  for (let i = 0; i < words.length; i++) {
    currentWords.push(words[i]);
    if (currentWords.length >= chunkSize && (words[i].endsWith('.') || words[i].endsWith('!') || words[i].endsWith('?'))) {
      chapters.push({
        id: `ch_${Date.now()}_${partNum}`,
        title: `Part ${partNum}`,
        originalText: currentWords.join(' '),
      });
      currentWords = [];
      partNum++;
    }
  }

  if (currentWords.length > 0) {
    chapters.push({
      id: `ch_${Date.now()}_${partNum}`,
      title: `Part ${partNum}`,
      originalText: currentWords.join(' '),
    });
  }

  return chapters;
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) {
    const remMins = mins % 60;
    return `${hrs}:${remMins < 10 ? '0' : ''}${remMins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function getEmotionGuidance(emotion: string): { desc: string; color: string; pitchMultiplier: number; rateMultiplier: number } {
  switch (emotion) {
    case 'dramatic':
      return { desc: 'Bold, cinematic emphasis with resonant gravitas', color: 'text-amber-400 border-amber-500/30 bg-amber-950/20', pitchMultiplier: 0.95, rateMultiplier: 0.9 };
    case 'warm':
      return { desc: 'Intimate, soothing, fireside bedtime tone', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20', pitchMultiplier: 0.98, rateMultiplier: 0.92 };
    case 'suspenseful':
      return { desc: 'Low, breathy tension with pregnant pauses', color: 'text-purple-400 border-purple-500/30 bg-purple-950/20', pitchMultiplier: 0.9, rateMultiplier: 0.88 };
    case 'whisper':
      return { desc: 'Hushed, confidential, mysterious delivery', color: 'text-teal-400 border-teal-500/30 bg-teal-950/20', pitchMultiplier: 1.05, rateMultiplier: 0.85 };
    case 'energetic':
      return { desc: 'High-octane, dynamic, adventurous pacing', color: 'text-lime-400 border-lime-500/30 bg-lime-950/20', pitchMultiplier: 1.1, rateMultiplier: 1.15 };
    case 'melancholic':
      return { desc: 'Reflective, gentle, poetic sorrow', color: 'text-blue-400 border-blue-500/30 bg-blue-950/20', pitchMultiplier: 0.92, rateMultiplier: 0.85 };
    case 'fantasy':
      return { desc: 'Grand, mystical, lore-keeper persona', color: 'text-yellow-400 border-yellow-500/30 bg-yellow-950/20', pitchMultiplier: 0.95, rateMultiplier: 0.94 };
    case 'narrative':
    default:
      return { desc: 'Balanced, engaging, natural audiobook delivery', color: 'text-lime-400 border-lime-500/30 bg-lime-950/20', pitchMultiplier: 1.0, rateMultiplier: 1.0 };
  }
}
