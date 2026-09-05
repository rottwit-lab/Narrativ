import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SentenceCue } from '../types';
import { parseSentenceCues, findActiveSentenceIndex } from '../utils/readAlong';
import {
  BookOpen,
  Volume2,
  Sparkles,
  Maximize2,
  Minimize2,
  Type,
  ArrowDown,
  Play,
  Pause,
} from 'lucide-react';

interface ReadAlongTeleprompterProps {
  text: string;
  chapterTitle?: string;
  duration?: number;
  currentTime: number;
  isPlaying?: boolean;
  onSeek?: (seconds: number) => void;
  onTogglePlay?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const ReadAlongTeleprompter: React.FC<ReadAlongTeleprompterProps> = ({
  text,
  chapterTitle = 'Chapter',
  duration = 60,
  currentTime,
  isPlaying = false,
  onSeek,
  onTogglePlay,
  isExpanded = false,
  onToggleExpand,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSentenceRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'huge'>('large');

  // Parse sentence cues with timestamps
  const cues = useMemo(() => {
    return parseSentenceCues(text, duration);
  }, [text, duration]);

  // Find currently active sentence index
  const activeIndex = useMemo(() => {
    return findActiveSentenceIndex(cues, currentTime);
  }, [cues, currentTime]);

  // Auto-scroll to keep active sentence centered
  useEffect(() => {
    if (autoScroll && activeSentenceRef.current && containerRef.current) {
      activeSentenceRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, autoScroll]);

  const fontSizeClass =
    fontSize === 'huge'
      ? 'text-xl leading-relaxed'
      : fontSize === 'large'
      ? 'text-base leading-relaxed'
      : 'text-sm leading-relaxed';

  return (
    <div
      className={`bg-neutral-900/95 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
        isExpanded ? 'fixed inset-4 z-50 max-w-5xl mx-auto' : 'relative w-full'
      }`}
    >
      {/* Teleprompter Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-neutral-950/70">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-lime-500/10 border border-lime-500/30 rounded-xl text-lime-400">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold font-['Space_Grotesk'] text-white">
                Karaoke Read-Along Teleprompter
              </span>
              <span className="px-2 py-0.5 rounded-full bg-lime-500/15 border border-lime-500/30 text-[10px] font-mono text-lime-300">
                LIVE SYNC
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 truncate max-w-md">
              {chapterTitle} — Click any sentence to jump playback
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2 text-xs">
          {/* Play/Pause toggle */}
          {onTogglePlay && (
            <button
              type="button"
              onClick={onTogglePlay}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          )}

          {/* Font size toggler */}
          <button
            type="button"
            onClick={() => {
              setFontSize((prev) => (prev === 'normal' ? 'large' : prev === 'large' ? 'huge' : 'normal'));
            }}
            className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-medium flex items-center space-x-1 transition-colors"
            title="Toggle Text Size"
          >
            <Type className="w-3.5 h-3.5" />
            <span className="capitalize">{fontSize}</span>
          </button>

          {/* Auto-scroll toggle */}
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 rounded-lg border text-[11px] font-medium transition-all ${
              autoScroll
                ? 'bg-lime-500/15 border-lime-500/40 text-lime-300'
                : 'bg-neutral-800 border-neutral-700 text-neutral-400'
            }`}
            title="Toggle Auto-Scroll Follow"
          >
            Auto-Follow
          </button>

          {/* Expand/Collapse */}
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand Fullscreen'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Sentence Script Container */}
      <div
        ref={containerRef}
        className={`p-6 overflow-y-auto space-y-3 font-['Plus_Jakarta_Sans'] ${
          isExpanded ? 'flex-1' : 'max-h-80'
        }`}
      >
        {cues.length === 0 ? (
          <div className="py-12 text-center text-neutral-500 text-sm">
            No script available for this chapter. Synthesize or generate narration to start read-along.
          </div>
        ) : (
          cues.map((cue, idx) => {
            const isActive = activeIndex === idx;
            const isDialogue = cue.speaker === 'Dialogue' || (cue.speaker && cue.speaker !== 'Narrator');

            return (
              <div
                key={cue.id}
                ref={isActive ? activeSentenceRef : null}
                onClick={() => onSeek?.(cue.startTime)}
                className={`group cursor-pointer rounded-xl p-3.5 transition-all duration-200 border ${
                  isActive
                    ? 'bg-lime-500/15 border-lime-500/50 shadow-lg shadow-lime-950/50 -translate-x-0.5'
                    : 'bg-neutral-950/30 border-transparent hover:bg-neutral-800/40 hover:border-neutral-800 text-neutral-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    {/* Speaker Badge */}
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          isDialogue
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-neutral-800 text-neutral-400'
                        }`}
                      >
                        {cue.speaker || 'Narrator'}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-500">
                        {Math.floor(cue.startTime / 60)}:
                        {String(Math.floor(cue.startTime % 60)).padStart(2, '0')}
                      </span>
                    </div>

                    {/* Sentence Text with Karaoke Active Accent */}
                    <p
                      className={`${fontSizeClass} font-medium ${
                        isActive
                          ? 'text-white font-semibold'
                          : 'text-neutral-300 group-hover:text-white'
                      }`}
                    >
                      {cue.text}
                    </p>
                  </div>

                  {/* Seek Icon on Hover */}
                  <div
                    className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-neutral-400 hover:text-lime-400 transition-opacity ${
                      isActive ? 'opacity-100 text-lime-400' : ''
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Timestamp Indicator */}
      <div className="px-5 py-2.5 bg-neutral-950/80 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
        <span>
          Sentence {activeIndex >= 0 ? activeIndex + 1 : 0} of {cues.length}
        </span>
        <span className="font-mono text-neutral-500">
          {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')} /{' '}
          {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
};
