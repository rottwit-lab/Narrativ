import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  VolumeX, 
  Clock, 
  Download, 
  ChevronRight, 
  ChevronLeft,
  Sliders,
  HardDriveDownload,
  Sparkles,
  FileAudio,
  BookOpen,
  CloudRain,
  X
} from 'lucide-react';
import { formatTime } from '../utils/textParser';
import { AudiobookProject } from '../types';
import { ReadAlongTeleprompter } from './ReadAlongTeleprompter';
import { SoundscapeMixer } from './SoundscapeMixer';

interface AudiobookPlayerProps {
  currentProject: AudiobookProject | null;
  currentChapterIndex: number;
  onChapterChange: (index: number) => void;
  onSaveToOffline: () => void;
  onOpenExportMp3?: () => void;
}

export const AudiobookPlayer: React.FC<AudiobookPlayerProps> = ({
  currentProject,
  currentChapterIndex,
  onChapterChange,
  onSaveToOffline,
  onOpenExportMp3,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | 'end' | null>(null);
  const [sleepTimeRemaining, setSleepTimeRemaining] = useState<number | null>(null);
  const [showTeleprompter, setShowTeleprompter] = useState(false);
  const [showSoundscapeMixer, setShowSoundscapeMixer] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const currentChapter = currentProject?.chapters[currentChapterIndex];

  // Initialize or change audio source
  useEffect(() => {
    if (audioRef.current && currentChapter?.audioBlobUrl) {
      audioRef.current.src = currentChapter.audioBlobUrl;
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.volume = isMuted ? 0 : volume;
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, [currentChapter?.audioBlobUrl]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.warn('Playback error:', e);
      });
    }
  };

  // Keyboard controls for Windows media (Spacebar, Arrows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in a textarea/input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSeekRelative(-10);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSeekRelative(10);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        setIsMuted((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, volume, isMuted]);

  // Volume update
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Playback rate update
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Time update listener
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || currentChapter?.duration || 0);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    // If sleep timer set to end of chapter, stop
    if (sleepTimerMinutes === 'end') {
      setSleepTimerMinutes(null);
      setSleepTimeRemaining(null);
      return;
    }

    // Auto advance to next chapter if available
    if (currentProject && currentChapterIndex < currentProject.chapters.length - 1) {
      onChapterChange(currentChapterIndex + 1);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleSeekRelative = (seconds: number) => {
    if (!audioRef.current) return;
    const newTime = Math.min(Math.max(audioRef.current.currentTime + seconds, 0), duration);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Sleep Timer countdown
  useEffect(() => {
    if (!sleepTimerMinutes || sleepTimerMinutes === 'end') {
      setSleepTimeRemaining(null);
      return;
    }

    setSleepTimeRemaining(sleepTimerMinutes * 60);

    const interval = setInterval(() => {
      setSleepTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
          }
          setSleepTimerMinutes(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerMinutes]);

  const handleDownloadWav = () => {
    if (!currentChapter?.audioBlobUrl) return;
    const a = document.createElement('a');
    a.href = currentChapter.audioBlobUrl;
    a.download = `${currentProject?.title || 'Audiobook'}-${currentChapter.title || 'Chapter'}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!currentProject || !currentChapter) {
    return (
      <div 
        id="audiobook-player-empty"
        className="fixed bottom-0 left-0 right-0 h-20 bg-neutral-950/95 border-t border-neutral-800/80 backdrop-blur-lg flex items-center justify-between px-6 z-40 text-neutral-500 text-xs"
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-600">
            <Play className="w-4 h-4" />
          </div>
          <div>
            <div className="font-medium text-neutral-400">Narrativ Media Deck</div>
            <div className="text-[11px] text-neutral-600">Select or generate a chapter above to begin playback</div>
          </div>
        </div>
        <div className="text-[11px] text-neutral-600 hidden sm:block">
          Press <kbd className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-neutral-400 font-mono text-[10px]">Space</kbd> to play/pause
        </div>
      </div>
    );
  }

  const hasAudio = !!currentChapter.audioBlobUrl;

  return (
    <div 
      id="windows-audio-player"
      className="fixed bottom-0 left-0 right-0 h-22 bg-neutral-950/95 border-t border-neutral-800/90 backdrop-blur-xl px-4 sm:px-6 flex flex-col justify-center z-40 select-none shadow-2xl"
    >
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Scrubber Bar across top of player */}
      <div className="w-full flex items-center space-x-3 mb-1.5 -mt-1">
        <span className="text-[10px] font-mono text-neutral-500 w-10 text-right">
          {formatTime(currentTime)}
        </span>
        <div className="relative flex-1 flex items-center group">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            disabled={!hasAudio}
            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-lime-400 hover:h-2 transition-all disabled:opacity-40"
          />
        </div>
        <span className="text-[10px] font-mono text-neutral-500 w-10">
          {formatTime(duration)}
        </span>
      </div>

      {/* Main Player Row */}
      <div className="flex items-center justify-between">
        {/* Track / Chapter Info */}
        <div className="flex items-center space-x-3 min-w-[200px] max-w-[320px]">
          <div className="w-11 h-11 rounded-lg bg-neutral-900 border border-neutral-800 flex-shrink-0 overflow-hidden relative group">
            <img 
              src="/narrativ-logo.jpg" 
              alt="Cover" 
              className="w-full h-full object-cover"
            />
            {isPlaying && (
              <div className="absolute inset-0 bg-neutral-950/60 flex items-center justify-center">
                <div className="flex items-end space-x-0.5 h-4">
                  <span className="w-0.5 bg-lime-400 h-2 animate-bounce" />
                  <span className="w-0.5 bg-lime-400 h-4 animate-pulse" />
                  <span className="w-0.5 bg-lime-400 h-3 animate-bounce delay-75" />
                </div>
              </div>
            )}
          </div>

          <div className="truncate">
            <div className="text-xs font-semibold text-white truncate flex items-center space-x-1.5">
              <span>{currentChapter.title}</span>
              {hasAudio ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-lime-500/10 text-lime-400 border border-lime-500/20 font-mono">
                  WAV
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                  Needs Audio
                </span>
              )}
            </div>
            <div className="text-[11px] text-neutral-400 truncate">
              {currentProject.title} • {currentProject.voice}
            </div>
          </div>
        </div>

        {/* Center Controls (Prev, Skip 10, Play/Pause, Skip 10, Next) */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Previous Chapter */}
          <button
            id="btn-prev-chapter"
            onClick={() => onChapterChange(Math.max(0, currentChapterIndex - 1))}
            disabled={currentChapterIndex === 0}
            className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
            title="Previous Chapter"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Skip -10s */}
          <button
            id="btn-skip-backward"
            onClick={() => handleSeekRelative(-10)}
            disabled={!hasAudio}
            className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors relative"
            title="Rewind 10 seconds"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="absolute text-[8px] font-bold bottom-1 right-1">10</span>
          </button>

          {/* Big Play / Pause Button */}
          <button
            id="btn-main-play-pause"
            onClick={togglePlay}
            disabled={!hasAudio}
            className="w-10 h-10 rounded-full bg-lime-400 hover:bg-lime-300 active:scale-95 text-neutral-950 flex items-center justify-center shadow-lg shadow-lime-400/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-neutral-950" />
            ) : (
              <Play className="w-5 h-5 fill-neutral-950 ml-0.5" />
            )}
          </button>

          {/* Skip +10s */}
          <button
            id="btn-skip-forward"
            onClick={() => handleSeekRelative(10)}
            disabled={!hasAudio}
            className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors relative"
            title="Fast Forward 10 seconds"
          >
            <RotateCw className="w-4 h-4" />
            <span className="absolute text-[8px] font-bold bottom-1 right-1">10</span>
          </button>

          {/* Next Chapter */}
          <button
            id="btn-next-chapter"
            onClick={() => onChapterChange(Math.min(currentProject.chapters.length - 1, currentChapterIndex + 1))}
            disabled={currentChapterIndex >= currentProject.chapters.length - 1}
            className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
            title="Next Chapter"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right Controls: Speed, Sleep Timer, Volume, Download */}
        <div className="flex items-center space-x-3">
          {/* Playback Rate Selector */}
          <div className="relative group">
            <button 
              id="btn-playback-rate"
              className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-md text-[11px] font-mono text-neutral-300 transition-colors"
              title="Change playback speed"
            >
              {playbackRate}x
            </button>
            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:flex flex-col bg-neutral-900 border border-neutral-800 rounded-lg p-1 shadow-xl text-xs z-50">
              {[0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((rate) => (
                <button
                  key={rate}
                  onClick={() => setPlaybackRate(rate)}
                  className={`px-3 py-1 text-left rounded text-[11px] hover:bg-neutral-800 ${
                    playbackRate === rate ? 'text-lime-400 font-bold bg-neutral-800/60' : 'text-neutral-400'
                  }`}
                >
                  {rate}x Speed
                </button>
              ))}
            </div>
          </div>

          {/* Sleep Timer */}
          <div className="relative group">
            <button 
              id="btn-sleep-timer"
              className={`p-1.5 rounded-md border text-[11px] transition-colors flex items-center space-x-1 ${
                sleepTimerMinutes
                  ? 'bg-lime-950/40 border-lime-500/40 text-lime-400'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
              title="Sleep Timer for bedtime listening"
            >
              <Clock className="w-3.5 h-3.5" />
              {sleepTimeRemaining !== null && (
                <span className="font-mono text-[10px]">{formatTime(sleepTimeRemaining)}</span>
              )}
            </button>
            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:flex flex-col bg-neutral-900 border border-neutral-800 rounded-lg p-1 shadow-xl text-xs z-50 w-36">
              <div className="px-2 py-1 text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">
                Sleep Timer
              </div>
              <button
                onClick={() => setSleepTimerMinutes(null)}
                className="px-2 py-1 text-left rounded text-[11px] hover:bg-neutral-800 text-neutral-400"
              >
                Off
              </button>
              <button
                onClick={() => setSleepTimerMinutes(15)}
                className="px-2 py-1 text-left rounded text-[11px] hover:bg-neutral-800 text-neutral-300"
              >
                15 minutes
              </button>
              <button
                onClick={() => setSleepTimerMinutes(30)}
                className="px-2 py-1 text-left rounded text-[11px] hover:bg-neutral-800 text-neutral-300"
              >
                30 minutes
              </button>
              <button
                onClick={() => setSleepTimerMinutes(45)}
                className="px-2 py-1 text-left rounded text-[11px] hover:bg-neutral-800 text-neutral-300"
              >
                45 minutes
              </button>
              <button
                onClick={() => setSleepTimerMinutes('end')}
                className="px-2 py-1 text-left rounded text-[11px] hover:bg-neutral-800 text-neutral-300"
              >
                End of Chapter
              </button>
            </div>
          </div>

          {/* Read-Along Teleprompter Button */}
          <button
            id="btn-toggle-teleprompter"
            onClick={() => {
              setShowTeleprompter(!showTeleprompter);
              if (showSoundscapeMixer) setShowSoundscapeMixer(false);
            }}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              showTeleprompter
                ? 'bg-lime-500/20 border-lime-500/50 text-lime-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
            title="Karaoke-Style Read-Along Teleprompter"
          >
            <BookOpen className="w-3.5 h-3.5 text-lime-400" />
            <span className="hidden lg:inline">Read-Along</span>
          </button>

          {/* Ambient Soundscapes & Foley Bed */}
          <button
            id="btn-toggle-soundscapes"
            onClick={() => {
              setShowSoundscapeMixer(!showSoundscapeMixer);
              if (showTeleprompter) setShowTeleprompter(false);
            }}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              showSoundscapeMixer
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
            title="Ambient Soundscapes & Foley Bed"
          >
            <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden lg:inline">Ambient Bed</span>
          </button>

          {/* Export Audiobook as Concatenated MP3 */}
          {onOpenExportMp3 && (
            <button
              id="btn-export-audiobook-mp3"
              onClick={onOpenExportMp3}
              disabled={!currentProject || !currentProject.chapters.some(c => !!c.audioBlobUrl || !!c.audioBlob)}
              className="px-2.5 py-1 bg-lime-400 hover:bg-lime-300 text-neutral-950 font-bold rounded-lg text-xs flex items-center space-x-1.5 transition-all shadow-sm shadow-lime-400/20 disabled:opacity-40"
              title="Export Audiobook as Concatenated MP3 file"
            >
              <FileAudio className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Export MP3</span>
            </button>
          )}

          {/* Download Current Chapter Audio (.wav) */}
          <button
            id="btn-download-audio"
            onClick={handleDownloadWav}
            disabled={!hasAudio}
            className="p-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-md text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
            title="Download Current Chapter (.wav)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Volume Slider & Mute */}
          <div className="hidden sm:flex items-center space-x-1.5 pl-1">
            <button
              id="btn-toggle-mute"
              onClick={() => setIsMuted(!isMuted)}
              className="text-neutral-400 hover:text-white"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              className="w-16 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-lime-400"
              title="Volume"
            />
          </div>
        </div>
      </div>

      {/* Floating Karaoke Read-Along Teleprompter */}
      {showTeleprompter && currentChapter && (
        <div className="fixed bottom-24 right-4 left-4 sm:left-auto sm:right-6 sm:w-[620px] z-50 shadow-2xl animate-in slide-in-from-bottom-3 duration-200">
          <ReadAlongTeleprompter
            text={currentChapter.narratedScript || currentChapter.originalText}
            chapterTitle={currentChapter.title}
            duration={duration || currentChapter.duration || 60}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onSeek={(secs) => {
              if (audioRef.current) {
                audioRef.current.currentTime = secs;
                setCurrentTime(secs);
              }
            }}
            onTogglePlay={togglePlay}
            onToggleExpand={() => setShowTeleprompter(false)}
          />
        </div>
      )}

      {/* Floating Ambient Soundscapes & Foley Bed */}
      {showSoundscapeMixer && (
        <div className="fixed bottom-24 right-4 left-4 sm:left-auto sm:right-6 sm:w-96 z-50 shadow-2xl animate-in slide-in-from-bottom-3 duration-200">
          <div className="relative">
            <button
              onClick={() => setShowSoundscapeMixer(false)}
              className="absolute top-3 right-3 p-1 rounded-md text-neutral-400 hover:text-white z-10"
              title="Close Mixer"
            >
              <X className="w-4 h-4" />
            </button>
            <SoundscapeMixer />
          </div>
        </div>
      )}
    </div>
  );
};
