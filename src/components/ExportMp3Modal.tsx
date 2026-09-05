import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Music, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  Sliders, 
  Layers, 
  Clock, 
  FileAudio,
  Check
} from 'lucide-react';
import { AudiobookProject } from '../types';
import { concatenateChaptersToMp3, triggerDownload } from '../utils/audioExport';
import { formatTime } from '../utils/textParser';

interface ExportMp3ModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: AudiobookProject | null;
}

export const ExportMp3Modal: React.FC<ExportMp3ModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const [silenceGap, setSilenceGap] = useState(1.5);
  const [bitrate, setBitrate] = useState(128);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStep, setExportStep] = useState('');
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedResult, setExportedResult] = useState<{
    blob: Blob;
    duration: number;
    filename: string;
    sizeMb: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !project) return null;

  const readyChapters = project.chapters.filter(
    (c) => (c.audioBlob && c.audioBlob.size > 0) || !!c.audioBlobUrl
  );

  const totalAudioDuration = readyChapters.reduce(
    (acc, c) => acc + (c.duration || 0),
    0
  );

  const handleStartExport = async () => {
    if (readyChapters.length === 0) {
      setErrorMessage('No synthesized audio chapters found. Please synthesize at least one chapter before exporting.');
      return;
    }

    setIsExporting(true);
    setErrorMessage(null);
    setExportedResult(null);
    setExportProgress(5);
    setExportStep('Preparing audio chapters...');

    try {
      const sanitizedTitle = (project.title || 'Audiobook')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase();
      const filename = `${sanitizedTitle}_narrativ_audiobook.mp3`;

      const result = await concatenateChaptersToMp3(
        readyChapters,
        project.title,
        project.author,
        silenceGap,
        (step, progress) => {
          setExportStep(step);
          setExportProgress(progress);
        }
      );

      const sizeInMb = (result.blob.size / (1024 * 1024)).toFixed(2);

      const exportData = {
        blob: result.blob,
        duration: result.totalDuration,
        filename,
        sizeMb: `${sizeInMb} MB`,
      };

      setExportedResult(exportData);

      // Auto trigger download for ease of use
      triggerDownload(result.blob, filename);
    } catch (err: any) {
      console.error('MP3 export failed:', err);
      setErrorMessage(err.message || 'Failed to concatenate and export MP3.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadAgain = () => {
    if (exportedResult) {
      triggerDownload(exportedResult.blob, exportedResult.filename);
    }
  };

  return (
    <div
      id="export-mp3-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-lime-500/10 border border-lime-500/20 flex items-center justify-center text-lime-400">
              <FileAudio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
                <span>Export Audiobook as MP3</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/30 font-mono">
                  Concatenated Master
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Merges all chapters into a single high-compatibility MP3 file for external devices
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto text-xs">
          {/* Project Summary Card */}
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">{project.title}</h3>
                <div className="text-neutral-400 text-xs">{project.author}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-lime-400 font-semibold">
                  {readyChapters.length} / {project.chapters.length} Chapters Ready
                </div>
                <div className="text-[10px] text-neutral-500">
                  Est. Duration: ~{formatTime(totalAudioDuration)}
                </div>
              </div>
            </div>

            {/* Chapters list preview */}
            <div className="max-h-32 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
              {project.chapters.map((ch, idx) => {
                const hasAudio = (ch.audioBlob && ch.audioBlob.size > 0) || !!ch.audioBlobUrl;
                return (
                  <div
                    key={ch.id}
                    className={`flex items-center justify-between p-2 rounded-lg text-[11px] ${
                      hasAudio
                        ? 'bg-neutral-900 border border-neutral-800/80 text-neutral-200'
                        : 'bg-neutral-900/40 border border-neutral-800/40 text-neutral-500'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className="font-mono text-neutral-400">#{idx + 1}</span>
                      <span className="truncate">{ch.title}</span>
                    </div>
                    <div>
                      {hasAudio ? (
                        <span className="text-[10px] text-lime-400 flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>Ready ({formatTime(ch.duration || 0)})</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-neutral-600">Draft (Not synthesized)</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {readyChapters.length < project.chapters.length && (
              <div className="text-[11px] text-amber-400 bg-amber-950/20 border border-amber-500/20 p-2.5 rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  Only chapters with synthesized audio ({readyChapters.length}) will be included in the exported MP3.
                </span>
              </div>
            )}
          </div>

          {/* Export Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Silence Gap */}
            <div className="space-y-1.5 p-3.5 bg-neutral-950/60 border border-neutral-800 rounded-xl">
              <label className="text-neutral-300 font-medium block">Silence Between Chapters</label>
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {[
                  { sec: 1.0, label: '1.0s' },
                  { sec: 1.5, label: '1.5s' },
                  { sec: 2.5, label: '2.5s' },
                ].map((opt) => (
                  <button
                    key={opt.sec}
                    type="button"
                    onClick={() => setSilenceGap(opt.sec)}
                    className={`py-1 rounded-lg text-xs font-medium border transition-all ${
                      silenceGap === opt.sec
                        ? 'border-lime-500/50 bg-lime-950/30 text-lime-300'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-neutral-500 mt-1">
                Natural pause added between chapter transitions.
              </p>
            </div>

            {/* MP3 Bitrate */}
            <div className="space-y-1.5 p-3.5 bg-neutral-950/60 border border-neutral-800 rounded-xl">
              <label className="text-neutral-300 font-medium block">Audio Bitrate</label>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {[
                  { kb: 128, label: '128 kbps (Standard)' },
                  { kb: 192, label: '192 kbps (High)' },
                ].map((opt) => (
                  <button
                    key={opt.kb}
                    type="button"
                    onClick={() => setBitrate(opt.kb)}
                    className={`py-1 rounded-lg text-[11px] font-medium border transition-all ${
                      bitrate === opt.kb
                        ? 'border-lime-500/50 bg-lime-950/30 text-lime-300'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-neutral-500 mt-1">
                128 kbps is the universal audiobook standard for car stereos and phones.
              </p>
            </div>
          </div>

          {/* Export Progress & Status */}
          {isExporting && (
            <div className="p-4 bg-neutral-950 border border-lime-500/30 rounded-xl space-y-3 animate-fade-in">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 text-lime-400 font-semibold">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{exportStep}</span>
                </div>
                <span className="font-mono text-neutral-400">{exportProgress}%</span>
              </div>
              <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-lime-400 h-2 transition-all duration-300 rounded-full"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-neutral-500">
                Processing audio buffers with Web Audio API and LAME MP3 encoding...
              </p>
            </div>
          )}

          {/* Error notification */}
          {errorMessage && (
            <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          {/* Success Result Card */}
          {exportedResult && !isExporting && (
            <div className="p-4 bg-lime-950/20 border border-lime-500/40 rounded-xl space-y-3 animate-fade-in">
              <div className="flex items-center space-x-2 text-lime-400 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Audiobook MP3 Master Generated!</span>
              </div>
              <div className="grid grid-cols-3 gap-2 p-2.5 bg-neutral-900 rounded-lg text-center text-xs">
                <div>
                  <div className="text-[10px] text-neutral-500">File Size</div>
                  <div className="font-mono font-semibold text-white">{exportedResult.sizeMb}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500">Total Duration</div>
                  <div className="font-mono font-semibold text-lime-300">
                    {formatTime(exportedResult.duration)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500">Format</div>
                  <div className="font-semibold text-white">MP3 (128 kbps)</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-neutral-400">
                  Downloaded to your Windows Downloads folder
                </span>
                <button
                  onClick={handleDownloadAgain}
                  className="px-3 py-1.5 bg-lime-400 hover:bg-lime-300 text-neutral-950 font-bold rounded-lg text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-lime-400/20"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Again</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-neutral-800 bg-neutral-950/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleStartExport}
            disabled={isExporting || readyChapters.length === 0}
            className="px-5 py-2 bg-lime-400 hover:bg-lime-300 text-neutral-950 font-bold rounded-xl transition-all shadow-lg shadow-lime-400/20 flex items-center space-x-2 disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Exporting MP3...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Export Concatenated MP3</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
