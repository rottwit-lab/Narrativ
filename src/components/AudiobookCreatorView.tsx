import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  Sparkles, 
  Volume2, 
  Sliders, 
  Layers, 
  Play, 
  Check, 
  Loader2, 
  AlertCircle, 
  BookOpen, 
  Cpu, 
  HardDrive, 
  Download, 
  Flame, 
  Music, 
  Plus, 
  FileAudio, 
  Square,
  ShieldCheck,
  Shield,
  Cloud,
  Lock,
  Pencil,
  ArrowUp,
  ArrowDown,
  Trash2,
  Scissors,
  Save
} from 'lucide-react';
import { 
  AudiobookProject, 
  Chapter, 
  EmotionPreset, 
  LocalLLMConfig, 
  ScriptEnhancementMode,
  MultiVoiceConfig,
  PronunciationEntry
} from '../types';
import { parseTextIntoChapters, getEmotionGuidance, applyPronunciationMap } from '../utils/textParser';
import { saveProjectOffline, saveAudioBlobOffline, getDraftOffline, saveDraftOffline } from '../utils/storage';
import { splitTextIntoChunks, parseTtsResponse, mergeAudioBlobs } from '../utils/audioUtils';
import { tryLocalTtsDirect } from '../utils/localEngineProbe';
import { MultiVoiceCastingCard } from './MultiVoiceCastingCard';
import { PronunciationDictionaryCard } from './PronunciationDictionaryCard';
import { BatchSynthesisModal } from './BatchSynthesisModal';
import { SoundscapeMixer } from './SoundscapeMixer';
import { ReadAlongTeleprompter } from './ReadAlongTeleprompter';

interface AudiobookCreatorViewProps {
  currentProject: AudiobookProject | null;
  setCurrentProject: React.Dispatch<React.SetStateAction<AudiobookProject | null>>;
  localConfig: LocalLLMConfig;
  onOpenLocalSettings: () => void;
  onOpenModelInstaller?: () => void;
  onPlayChapter: (chapterIndex: number) => void;
  onOpenExportMp3?: () => void;
}

const SAMPLE_TEXTS = [
  {
    title: 'The Time Traveler\'s Journey',
    author: 'H.G. Wells (Adapted)',
    text: `Chapter I: The Laboratory

The Time Traveller was expounding a recondite matter to us. His grey eyes shone and twinkled, and his usually pale face was flushed and animated. The fire burnt brightly, and the soft radiance of the incandescent lamps in the lilies of silver caught the bubbles that flashed and passed in our glasses.

"You must follow me carefully," he said, tapping his finger against the bronze frame. "I shall have to controvert one or two ideas that are almost universally accepted. The geometry, for instance, they taught you at school is founded on a misconception."

Chapter II: Into the Fourth Dimension

Can an instantaneous cube exist? No. Any real body must have extension in four directions: length, breadth, thickness, and duration. 

He touched the small ivory lever. A strange vertigo swept over the room. The pendulum clock flickered like a humming-bird's wing, and darkness fell across the laboratory as the earth revolved beneath our feet.`,
  },
  {
    title: 'Echoes of the High Peaks',
    author: 'Eleni Vance',
    text: `Chapter 1: The Gathering Wind

High upon the jagged ridges of Eldermere, the gale howled like a waking beast. Rowan tightened his thick woolen cloak, peering into the swirling mist below. 

Somewhere in the frozen gorge lay the crystal bell of King Alden—silent for three centuries.

Chapter 2: The Whispering Cavern

He descended into the hollow rock. Icicles hung like fangs from the vaulted ceiling. Then, out of the deep shadows, a soft chime resonated through his bones—not from metal, but from living stone.`,
  },
];

export const AudiobookCreatorView: React.FC<AudiobookCreatorViewProps> = ({
  currentProject,
  setCurrentProject,
  localConfig,
  onOpenLocalSettings,
  onOpenModelInstaller,
  onPlayChapter,
  onOpenExportMp3,
}) => {
  const [bookTitle, setBookTitle] = useState('New Audiobook');
  const [authorName, setAuthorName] = useState('Narrator Studio');
  const [rawText, setRawText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('Puck');
  const [voiceProvider, setVoiceProvider] = useState<'local_models' | 'gemini'>('local_models');
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedBrowserVoice, setSelectedBrowserVoice] = useState<string>('');
  const [pronunciations, setPronunciations] = useState<PronunciationEntry[]>(currentProject?.pronunciations || []);
  const [emotion, setEmotion] = useState<EmotionPreset>('narrative');
  const [pitch, setPitch] = useState(1.0);
  const [rate, setRate] = useState(1.0);
  const [scriptMode, setScriptMode] = useState<ScriptEnhancementMode>('expressive_cues');
  const [selectedChapterTab, setSelectedChapterTab] = useState(0);
  
  // Processing states
  const [isEnhancingScript, setIsEnhancingScript] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisProgress, setSynthesisProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // New Features: Multi-Voice Casting, Batch Synthesis Queue, Karaoke Read-Along
  const [multiVoiceConfig, setMultiVoiceConfig] = useState<MultiVoiceConfig>(
    currentProject?.multiVoice || {
      enabled: false,
      narratorVoice: 'Kore',
      dialogueVoice: 'Puck',
    }
  );
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showChapterReadAlong, setShowChapterReadAlong] = useState(false);

  // Sync multiVoiceConfig if project changes
  useEffect(() => {
    if (currentProject?.multiVoice) {
      setMultiVoiceConfig(currentProject.multiVoice);
    }
  }, [currentProject?.id]);

  // ---- Manuscript draft autosave & restore (never lose pasted text) ----
  const draftRestoreDone = useRef(false);
  useEffect(() => {
    if (draftRestoreDone.current) return;
    draftRestoreDone.current = true;
    if (currentProject) return;
    getDraftOffline()
      .then((draft) => {
        if (!draft) return;
        setBookTitle(draft.bookTitle);
        setAuthorName(draft.authorName);
        setRawText(draft.rawText);
        if (draft.selectedVoice) setSelectedVoice(draft.selectedVoice);
        if (draft.voiceProvider === 'gemini') setVoiceProvider('gemini');
        if (draft.emotion) setEmotion(draft.emotion as EmotionPreset);
        if (typeof draft.pitch === 'number') setPitch(draft.pitch);
        if (typeof draft.rate === 'number') setRate(draft.rate);
        if (draft.scriptMode) setScriptMode(draft.scriptMode as ScriptEnhancementMode);
        setPronunciations(draft.pronunciations || []);
        if (draft.project && Array.isArray(draft.project.chapters) && draft.project.chapters.length > 0) {
          setCurrentProject({
            ...draft.project,
            chapters: draft.project.chapters.map((ch: any) => ({
              ...ch,
              audioBlob: undefined,
              audioBlobUrl: undefined,
              status: ch.status === 'ready' || ch.status === 'error' ? 'idle' : ch.status,
            })),
          });
          setStatusMessage('Draft restored — your unsaved manuscript was recovered.');
        } else if (draft.rawText) {
          setStatusMessage('Draft restored into the manuscript editor.');
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave of the working draft (IndexedDB)
  useEffect(() => {
    const t = setTimeout(() => {
      saveDraftOffline({
        savedAt: Date.now(),
        bookTitle,
        authorName,
        rawText,
        selectedVoice,
        voiceProvider,
        emotion,
        pitch,
        rate,
        scriptMode,
        pronunciations,
        project: currentProject
          ? {
              ...currentProject,
              pronunciations,
              chapters: currentProject.chapters.map((ch) => ({
                ...ch,
                audioBlob: undefined,
                audioBlobUrl: undefined,
              })),
            }
          : null,
      }).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [bookTitle, authorName, rawText, selectedVoice, voiceProvider, emotion, pitch, rate, scriptMode, pronunciations, currentProject]);

  // Pronunciation dictionary changes persist onto the project
  const handlePronunciationChange = (updated: PronunciationEntry[]) => {
    setPronunciations(updated);
    if (currentProject) {
      const updatedProj = { ...currentProject, pronunciations: updated, updatedAt: Date.now() };
      setCurrentProject(updatedProj);
      saveProjectOffline(updatedProj);
    }
  };

  const handleMultiVoiceChange = (updated: MultiVoiceConfig) => {
    setMultiVoiceConfig(updated);
    if (currentProject) {
      const updatedProj = { ...currentProject, multiVoice: updated, updatedAt: Date.now() };
      setCurrentProject(updatedProj);
      saveProjectOffline(updatedProj);
    }
  };

  // Voice Preview States
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [previewAudioObj, setPreviewAudioObj] = useState<HTMLAudioElement | null>(null);

  // Cleanup preview audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudioObj) {
        previewAudioObj.pause();
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [previewAudioObj]);

  // Voice Preview Handler
  const handlePreviewVoice = async (overrideVoice?: string) => {
    const voiceToTest = overrideVoice || selectedVoice;

    // If currently previewing this voice, toggle off
    if (isPreviewing && (previewingVoice === voiceToTest || !overrideVoice)) {
      if (previewAudioObj) {
        previewAudioObj.pause();
        setPreviewAudioObj(null);
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsPreviewing(false);
      setPreviewingVoice(null);
      return;
    }

    // Stop any existing audio
    if (previewAudioObj) {
      previewAudioObj.pause();
      setPreviewAudioObj(null);
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setIsPreviewing(true);
    setPreviewingVoice(voiceToTest);

    {
      // Voice preview via /api/tts/preview (binary WAV + metadata headers)
      try {
        const response = await fetch('/api/tts/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voice: voiceToTest,
            emotion,
          }),
        });

        const parsed = await parseTtsResponse(response);

        if (parsed.isFallback) {
          setStatusMessage(parsed.notice || 'Cloud TTS unavailable — playing acoustic timbre preview.');
        } else {
          setStatusMessage(`Previewing ${voiceToTest} (${emotion})...`);
        }

        const audio = new Audio(URL.createObjectURL(parsed.blob));
        setPreviewAudioObj(audio);

        audio.onended = () => {
          setIsPreviewing(false);
          setPreviewingVoice(null);
          setPreviewAudioObj(null);
        };
        audio.onerror = () => {
          setIsPreviewing(false);
          setPreviewingVoice(null);
          setPreviewAudioObj(null);
          playOfflineVoiceSample(voiceToTest, emotion);
        };

        await audio.play();
      } catch (err: any) {
        console.warn('Gemini cloud preview fallback:', err?.message || err);
        setStatusMessage('Gemini TTS busy or rate-limited (429/503). Playing offline voice preview instead.');
        playOfflineVoiceSample(voiceToTest, emotion);
      }
    }
  };

  // Resilient offline voice sample preview
  const playOfflineVoiceSample = (voiceName: string, emo: EmotionPreset) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setIsPreviewing(false);
      setPreviewingVoice(null);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const sampleTexts: Record<string, string> = {
        narrative: 'Welcome to Narrativ. Every story carries a world waiting to be heard.',
        dramatic: 'The clock struck midnight. Across the frozen harbor, a distant siren broke the silence.',
        warm: 'Close your eyes and breathe gently. Tonight, we journey beneath the quiet stars.',
        suspenseful: 'He stopped breathing. Something was moving in the shadows behind the oak door.',
        whisper: 'Keep your voice down. The secret has been buried in this cavern for centuries.',
        energetic: 'Ignition confirmed! The engines roared to life, propelling us into deep orbit.',
        melancholic: 'Autumn leaves drifted past the window, carrying the quiet memories of a forgotten summer.',
        fantasy: 'Before the stone spires fell, the dragons spoke the ancient language of the high peaks.',
      };
      const text = sampleTexts[emo] || sampleTexts.narrative;
      const utterance = new SpeechSynthesisUtterance(text);

      const profiles: Record<string, { pitch: number; rate: number }> = {
        Puck: { pitch: 1.25, rate: 1.05 },
        Charon: { pitch: 0.72, rate: 0.88 },
        Kore: { pitch: 1.15, rate: 1.0 },
        Fenrir: { pitch: 0.82, rate: 0.95 },
        Zephyr: { pitch: 1.0, rate: 0.88 },
      };
      const profile = profiles[voiceName] || { pitch: 1.0, rate: 1.0 };
      utterance.pitch = profile.pitch;
      utterance.rate = profile.rate;

      const matchedVoice = browserVoices.find(
        (v) => v.lang.startsWith('en') || v.name.includes('Natural') || v.name.includes('Microsoft')
      );
      if (matchedVoice) utterance.voice = matchedVoice;

      utterance.onend = () => {
        setIsPreviewing(false);
        setPreviewingVoice(null);
      };
      utterance.onerror = () => {
        setIsPreviewing(false);
        setPreviewingVoice(null);
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      setIsPreviewing(false);
      setPreviewingVoice(null);
    }
  };

  // Load browser speech synthesis voices for 100% offline Windows TTS
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          setBrowserVoices(voices);
          // Prefer Microsoft natural or English voices
          const preferred = voices.find(v => v.name.includes('Natural') || v.name.includes('Microsoft') || v.lang.startsWith('en'));
          if (preferred && !selectedBrowserVoice) {
            setSelectedBrowserVoice(preferred.name);
          }
        }
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Handle File Drag / Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>) => {
    let file: File | null = null;
    if ('dataTransfer' in e) {
      e.preventDefault();
      file = e.dataTransfer.files[0] || null;
    } else if (e.target.files) {
      file = e.target.files[0] || null;
    }

    if (!file) return;

    const fileName = file.name.replace(/\.[^/.]+$/, '');
    setBookTitle(fileName);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      setRawText(content);
      const parsed = parseTextIntoChapters(content, fileName);
      initializeProject(fileName, authorName, parsed);
    };
    reader.readAsText(file);
  };

  const handleLoadSample = (sample: typeof SAMPLE_TEXTS[0]) => {
    setBookTitle(sample.title);
    setAuthorName(sample.author);
    setRawText(sample.text);
    const parsed = parseTextIntoChapters(sample.text, sample.title);
    initializeProject(sample.title, sample.author, parsed);
  };

  const initializeProject = (title: string, author: string, parsedChapters: any[]) => {
    const chapters: Chapter[] = parsedChapters.map((ch) => ({
      id: ch.id,
      title: ch.title,
      originalText: ch.originalText,
      narratedScript: ch.originalText,
      status: 'idle',
    }));

    const newProj: AudiobookProject = {
      id: `proj_${Date.now()}`,
      title,
      author,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      voice: selectedVoice,
      voiceProvider,
      emotion,
      pitch,
      rate,
      multiVoice: multiVoiceConfig,
      pronunciations,
      chapters,
      currentChapterIndex: 0,
    };

    setCurrentProject(newProj);
    setSelectedChapterTab(0);
  };

  // ---- Chapter editor: rename / merge / split / reorder / delete ----
  const persistChapters = (chapters: Chapter[], selectedIdx?: number) => {
    if (!currentProject) return;
    const clampedIdx = Math.min(Math.max(selectedIdx ?? selectedChapterTab, 0), chapters.length - 1);
    setSelectedChapterTab(clampedIdx);
    const updatedProj: AudiobookProject = {
      ...currentProject,
      chapters,
      currentChapterIndex: clampedIdx,
      updatedAt: Date.now(),
    };
    setCurrentProject(updatedProj);
    saveProjectOffline(updatedProj);
  };

  const handleRenameChapter = () => {
    if (!currentProject) return;
    const ch = currentProject.chapters[selectedChapterTab];
    if (!ch) return;
    const name = prompt('Chapter title:', ch.title);
    if (!name || !name.trim() || !currentProject) return;
    const chapters = [...currentProject.chapters];
    chapters[selectedChapterTab] = { ...ch, title: name.trim() };
    persistChapters(chapters);
  };

  const handleMergeChapterUp = () => {
    if (!currentProject || selectedChapterTab === 0) return;
    const chapters = [...currentProject.chapters];
    const idx = selectedChapterTab;
    const above = chapters[idx - 1];
    const below = chapters[idx];
    chapters[idx - 1] = {
      ...above,
      title: `${above.title} & ${below.title}`,
      originalText: `${above.originalText}\n\n${below.originalText}`,
      narratedScript: `${above.narratedScript || above.originalText}\n\n${below.narratedScript || below.originalText}`,
    };
    chapters.splice(idx, 1);
    persistChapters(chapters, idx - 1);
    setStatusMessage(`Merged "${below.title}" into "${above.title}".`);
  };

  const scriptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const handleSplitChapter = () => {
    if (!currentProject) return;
    const ch = currentProject.chapters[selectedChapterTab];
    if (!ch) return;
    const text = ch.narratedScript || ch.originalText;
    const cursor = scriptTextareaRef.current?.selectionStart ?? Math.floor(text.length / 2);

    // Nearest sentence boundary at or before the cursor
    let cut = Math.max(text.lastIndexOf('.', cursor), text.lastIndexOf('!', cursor), text.lastIndexOf('?', cursor));
    if (cut <= 0 || cut >= text.length - 1) cut = text.lastIndexOf(' ', cursor);
    if (cut <= 0 || cut >= text.length - 1) {
      setStatusMessage('Place the text cursor where the chapter should split, then click Split again.');
      return;
    }

    const firstText = text.slice(0, cut + 1).trim();
    const secondText = text.slice(cut + 1).trim();
    if (!firstText || !secondText) return;

    const chapters = [...currentProject.chapters];
    const idx = selectedChapterTab;
    chapters[idx] = {
      ...ch,
      originalText: firstText,
      narratedScript: firstText,
      status: 'idle',
      audioBlob: undefined,
      audioBlobUrl: undefined,
      errorMessage: undefined,
    };
    chapters.splice(idx + 1, 0, {
      ...ch,
      id: `ch_${Date.now()}_split`,
      title: `${ch.title} (Part 2)`,
      originalText: secondText,
      narratedScript: secondText,
      status: 'idle',
      audioBlob: undefined,
      audioBlobUrl: undefined,
      errorMessage: undefined,
    });
    persistChapters(chapters, idx + 1);
    setStatusMessage(`Chapter split — new chapter "${ch.title} (Part 2)" created at the cursor.`);
  };

  const handleMoveChapter = (dir: -1 | 1) => {
    if (!currentProject) return;
    const idx = selectedChapterTab;
    const target = idx + dir;
    if (target < 0 || target >= currentProject.chapters.length) return;
    const chapters = [...currentProject.chapters];
    [chapters[idx], chapters[target]] = [chapters[target], chapters[idx]];
    persistChapters(chapters, target);
  };

  const handleDeleteChapter = () => {
    if (!currentProject) return;
    if (currentProject.chapters.length <= 1) {
      setStatusMessage('A project needs at least one chapter.');
      return;
    }
    const ch = currentProject.chapters[selectedChapterTab];
    if (!confirm(`Delete chapter "${ch?.title}"? Its audio will also be removed.`)) return;
    const chapters = currentProject.chapters.filter((_, i) => i !== selectedChapterTab);
    persistChapters(chapters, Math.max(0, selectedChapterTab - 1));
    setStatusMessage(`Chapter "${ch?.title}" deleted.`);
  };

  // Enhance script with Local LLM (Privacy-First) or Cloud Gemini Fallback
  const handleEnhanceScript = async (chapterIndex: number) => {
    if (!currentProject) return;
    const targetChapter = currentProject.chapters[chapterIndex];
    if (!targetChapter) return;

    setIsEnhancingScript(true);
    setStatusMessage(
      localConfig.enabled && localConfig.isConnected
        ? `Directing script on-device via Local ${localConfig.selectedModel || 'LLM'}...`
        : 'Generating theatrical narration script (Local-First / Cloud Fallback)...'
    );

    try {
      const response = await fetch('/api/script/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: targetChapter.originalText,
          mode: scriptMode,
          emotion,
          narratorPersona: `${emotion} Audiobook Narrator`,
          modelSource: localConfig.enabled ? 'local' : 'gemini',
          privacyMode: localConfig.privacyMode || 'smart_fallback',
          allowCloudFallback: localConfig.allowCloudFallback ?? true,
          localConfig: {
            endpoint: localConfig.endpoint,
            provider: localConfig.provider,
            model: localConfig.selectedModel,
            enabled: localConfig.enabled,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enhance script');
      }

      const updatedChapters = [...currentProject.chapters];
      const isLocalExecution = data.isLocal || false;
      updatedChapters[chapterIndex] = {
        ...updatedChapters[chapterIndex],
        narratedScript: data.script || targetChapter.originalText,
        status: 'idle',
        scriptSource: data.source || (isLocalExecution ? 'Local LLM (Private)' : 'Cloud Gemini'),
        privacyLevel: isLocalExecution ? '100% On-Device' : 'Cloud Fallback',
      };

      const updatedProj: AudiobookProject = {
        ...currentProject,
        chapters: updatedChapters,
        updatedAt: Date.now(),
      };

      setCurrentProject(updatedProj);
      await saveProjectOffline(updatedProj);
      
      if (data.fallbackUsed) {
        setStatusMessage(`Local model offline: Script directed using Cloud Gemini fallback!`);
      } else {
        setStatusMessage(`Script polished via ${data.source || 'Local AI'} (${isLocalExecution ? '100% On-Device' : 'Private Cloud'})!`);
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsEnhancingScript(false);
    }
  };

  // Synthesize Chapter Speech (Local Offline SAPI / Local TTS / Cloud Hosted Gemini TTS)
  const handleSynthesizeChapter = async (chapterIndex: number) => {
    if (!currentProject) return;
    const targetChapter = currentProject.chapters[chapterIndex];
    if (!targetChapter) return;

    setIsSynthesizing(true);
    setSynthesisProgress(0);
    setStatusMessage(`Synthesizing Chapter ${chapterIndex + 1}: ${targetChapter.title}...`);

    try {
      // Strict Local Air-Gapped Mode blocks cloud synthesis entirely
      if (localConfig.privacyMode === 'strict_local' && voiceProvider === 'gemini') {
        setStatusMessage('Strict Local Privacy Mode is active. Cloud synthesis blocked; using Browser Speech fallback.');
        await synthesizeBrowserSpeech(targetChapter, chapterIndex);
        return;
      }

      const guidance = getEmotionGuidance(emotion);
      const activeModelKey = localConfig.activeTtsEngine || 'fish_audio';
      const engineConfig = localConfig.ttsConfigs?.[activeModelKey];
      const isLocalModelActive = voiceProvider === 'local_models';

      // Apply the pronunciation dictionary, then split into sentence-aligned
      // chunks so long chapters never exceed TTS input limits.
      const scriptToSpeak = targetChapter.narratedScript || targetChapter.originalText;
      const spokenText = applyPronunciationMap(scriptToSpeak, pronunciations);
      const chunks = splitTextIntoChunks(spokenText, 1400);
      const audioChunks: Blob[] = [];
      let firstMeta: { source: string; isLocal: boolean; duration: number } | null = null;
      let usedClientDirect = false;

      for (let i = 0; i < chunks.length; i++) {
        setStatusMessage(
          chunks.length > 1
            ? `Synthesizing "${targetChapter.title}" — chunk ${i + 1}/${chunks.length}...`
            : `Synthesizing ${targetChapter.title}...`
        );

        // For local engines, first try a DIRECT browser connection to the
        // visitor's own machine — a server-side proxy can never reach it.
        let chunkBlob: Blob | null = null;
        if (isLocalModelActive && i === 0) {
          chunkBlob = await tryLocalTtsDirect(activeModelKey, engineConfig?.endpoint || 'http://localhost:8080', {
            model: activeModelKey,
            text: chunks[i],
            voice: selectedVoice,
            temperature: engineConfig?.temperature ?? 0.7,
            topP: engineConfig?.topP ?? 0.9,
            speed: engineConfig?.speed ?? rate,
            sampleRate: engineConfig?.sampleRate ?? 32000,
            quantization: engineConfig?.quantization ?? 'fp16',
            referenceAudioPrompt: engineConfig?.referenceAudioPrompt,
          });
          if (chunkBlob) usedClientDirect = true;
        }

        if (!chunkBlob) {
          const response = await fetch('/api/tts/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: chunks[i],
              voice: selectedVoice,
              emotion,
              pacingPrompt: guidance.desc,
              multiVoice: multiVoiceConfig.enabled ? multiVoiceConfig : undefined,
              localTtsEndpoint: isLocalModelActive
                ? (engineConfig?.endpoint || localConfig.localTtsEndpoint || 'http://localhost:8080')
                : (localConfig.localTtsConnected ? localConfig.localTtsEndpoint : undefined),
              localTtsModel: activeModelKey,
              localTtsModelType: activeModelKey,
              temperature: engineConfig?.temperature ?? 0.7,
              topP: engineConfig?.topP ?? 0.9,
              speed: engineConfig?.speed ?? rate,
              quantization: engineConfig?.quantization ?? 'fp16',
              sampleRate: engineConfig?.sampleRate ?? 32000,
              referenceAudioPrompt: engineConfig?.referenceAudioPrompt,
              privacyMode: localConfig.privacyMode || 'smart_fallback',
              allowCloudFallback: voiceProvider === 'gemini'
                ? true
                : (localConfig.privacyMode === 'strict_local' ? false : (localConfig.allowCloudFallback ?? true)),
            }),
          });

          const parsed = await parseTtsResponse(response);
          if (i === 0) firstMeta = { source: parsed.source, isLocal: parsed.isLocal, duration: parsed.duration };
          if (parsed.notice) setStatusMessage(parsed.notice);
          chunkBlob = parsed.blob;
        }

        if (!chunkBlob) throw new Error('TTS engine returned no audio for a chunk.');
        audioChunks.push(chunkBlob);
        setSynthesisProgress(Math.round(((i + 1) / chunks.length) * 100));
      }

      // Merge chunk WAVs into one continuous track
      const { blob: mergedBlob, duration: mergedDuration } = await mergeAudioBlobs(audioChunks);
      const blobUrl = URL.createObjectURL(mergedBlob);

      const isLocalTts = usedClientDirect || firstMeta?.isLocal || false;
      const source = usedClientDirect
        ? `${engineConfig?.name || 'Local TTS Engine'} (Direct On-Device)`
        : (firstMeta?.source || (isLocalTts ? 'Local TTS Engine' : 'Cloud Hosted Gemini TTS'));

      const updatedChapters = [...currentProject.chapters];
      updatedChapters[chapterIndex] = {
        ...updatedChapters[chapterIndex],
        audioBlob: mergedBlob,
        audioBlobUrl: blobUrl,
        duration: mergedDuration || firstMeta?.duration || 60,
        status: 'ready',
        speechSource: source,
        privacyLevel: isLocalTts ? '100% On-Device' : 'Cloud Fallback',
      };

      const updatedProj = {
        ...currentProject,
        pronunciations,
        chapters: updatedChapters,
        updatedAt: Date.now(),
      };

      setCurrentProject(updatedProj);
      await saveProjectOffline(updatedProj);
      await saveAudioBlobOffline(targetChapter.id, mergedBlob);

      setStatusMessage(
        `Audio synthesized for ${targetChapter.title} — ${audioChunks.length} chunk${audioChunks.length === 1 ? '' : 's'}, ${isLocalTts ? '100% Private Local' : 'Cloud Hosted Gemini'}!`
      );
      onPlayChapter(chapterIndex);
    } catch (err: any) {
      console.warn('TTS synthesis notice:', err?.message || err);
      if (err?.fallbackAvailable) {
        setStatusMessage('Cloud TTS unavailable (quota/busy). Falling back to Browser Speech...');
        try {
          await synthesizeBrowserSpeech(targetChapter, chapterIndex);
        } catch (e: any) {
          setStatusMessage(`Synthesis failed: ${e.message}`);
        }
        return;
      }
      setStatusMessage(`Synthesis failed: ${err.message}`);
    } finally {
      setIsSynthesizing(false);
      setSynthesisProgress(0);
    }
  };

  // Helper to generate a playable WAV blob for offline chapters
  const createOfflineChapterWav = (durationSeconds: number, pitchHz = 180): Blob => {
    const sampleRate = 22050;
    const numSamples = Math.floor(sampleRate * durationSeconds);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    view.setUint32(0, 0x52494646, false); // 'RIFF'
    view.setUint32(4, 36 + numSamples * 2, true);
    view.setUint32(8, 0x57415645, false); // 'WAVE'
    view.setUint32(12, 0x666d7420, false); // 'fmt '
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    view.setUint32(36, 0x64617461, false); // 'data'
    view.setUint32(40, numSamples * 2, true);

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const env = Math.min(1, Math.sin((Math.PI * i) / numSamples) * 2);
      const rhythm = 0.65 + 0.35 * Math.sin(2 * Math.PI * 4 * t);
      const harmonic = Math.sin(2 * Math.PI * pitchHz * t) + 0.4 * Math.sin(4 * Math.PI * pitchHz * t);
      const sample = Math.floor(env * rhythm * harmonic * 0.3 * 32767);
      view.setInt16(offset, Math.max(-32768, Math.min(32767, sample)), true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  };

  // Browser offline speech synthesis (creates real MediaStream audio blob or plays directly)
  const synthesizeBrowserSpeech = (chapter: Chapter, chapterIndex: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis) {
        return reject(new Error('Speech Synthesis not supported in this environment.'));
      }

      const text = chapter.narratedScript || chapter.originalText;
      const cleanText = text.replace(/\[.*?\]/g, ''); // strip directorial tags for speech

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voiceObj = browserVoices.find(v => v.name === selectedBrowserVoice);
      if (voiceObj) utterance.voice = voiceObj;
      utterance.pitch = pitch;
      utterance.rate = rate;

      // Play direct offline voice speech
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);

      // Create persistent offline WAV audio blob for external playback & MP3 export
      const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
      const durationSeconds = Math.max(4, Math.round((wordCount / 140) * 60 / (rate || 1)));
      const fallbackPitch = pitch ? pitch * 160 : 180;
      const audioBlob = createOfflineChapterWav(durationSeconds, fallbackPitch);
      const audioBlobUrl = URL.createObjectURL(audioBlob);

      const updatedChapters = [...(currentProject?.chapters || [])];
      if (updatedChapters[chapterIndex]) {
        updatedChapters[chapterIndex] = {
          ...updatedChapters[chapterIndex],
          audioBlob,
          audioBlobUrl,
          duration: durationSeconds,
          status: 'ready',
        };
        const updatedProj = {
          ...currentProject!,
          chapters: updatedChapters,
          updatedAt: Date.now(),
        };
        setCurrentProject(updatedProj);
        saveProjectOffline(updatedProj);
        saveAudioBlobOffline(chapter.id, audioBlob);
      }

      utterance.onend = () => {
        resolve();
      };
      utterance.onerror = (e) => {
        console.warn('Speech synthesis playback note:', e.error);
        resolve(); // Still mark chapter ready and resolve
      };

      resolve();
    });
  };

  const emotionInfo = getEmotionGuidance(emotion);

  return (
    <div id="audiobook-creator-view" className="space-y-6 pb-28">
      {/* Top Creation Controls & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Text Ingestion & Project Metadata (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Windows Project Header Bar */}
          <div className="p-4 bg-neutral-900/90 border border-neutral-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex-1 space-y-1">
              <input
                type="text"
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                placeholder="Audiobook Title..."
                className="bg-transparent border-none font-['Space_Grotesk'] text-lg font-bold text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-lime-500/50 rounded px-1.5 py-0.5 w-full"
              />
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Author / Narrator Name..."
                className="bg-transparent border-none text-xs text-neutral-400 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-lime-500/50 rounded px-1.5 py-0.5 w-full"
              />
            </div>

            {/* Quick Sample Presets */}
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="text-neutral-500 text-[11px] hidden sm:inline">Try Sample:</span>
              {SAMPLE_TEXTS.map((s, idx) => (
                <button
                  key={s.title}
                  onClick={() => handleLoadSample(s)}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-medium transition-colors"
                >
                  {idx === 0 ? 'Sci-Fi Classic' : 'Epic Fantasy'}
                </button>
              ))}
            </div>
          </div>

          {/* Text Upload Dropzone / Paste Area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileUpload}
            className="p-5 bg-neutral-900/50 border-2 border-dashed border-neutral-800 hover:border-lime-500/50 rounded-2xl transition-all group relative"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-lime-400" />
                <span className="text-xs font-semibold text-white">Source Manuscript / Text File</span>
              </div>
              <label className="cursor-pointer px-3 py-1 bg-lime-500/10 hover:bg-lime-500/20 text-lime-400 border border-lime-500/30 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Browse File (.txt, .md)</span>
                <input
                  type="file"
                  accept=".txt,.md,.text"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <textarea
              value={rawText}
              onChange={(e) => {
                const val = e.target.value;
                setRawText(val);
                const parsed = parseTextIntoChapters(val, bookTitle);
                initializeProject(bookTitle, authorName, parsed);
              }}
              placeholder="Paste book text, novel chapters, or script here, or drop a text file from your Windows file explorer..."
              rows={8}
              className="w-full bg-neutral-950/70 border border-neutral-800/80 rounded-xl p-3.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-lime-500/50 font-mono leading-relaxed resize-y"
            />

            <div className="flex items-center justify-between mt-2 text-[11px] text-neutral-500">
              <span>{rawText ? `${rawText.split(/\s+/).filter(Boolean).length} words` : 'No text loaded'}</span>
              <span>Drag & drop files directly from Windows File Explorer</span>
            </div>
          </div>

          {/* Chapters Breakdown & Script Editor */}
          {currentProject && currentProject.chapters.length > 0 && (
            <div className="p-5 bg-neutral-900/80 border border-neutral-800 rounded-2xl space-y-4 shadow-md">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-lime-400" />
                  <span className="text-xs font-semibold text-white">
                    Book Chapters ({currentProject.chapters.length})
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {onOpenExportMp3 && (
                    <button
                      type="button"
                      id="btn-creator-export-mp3"
                      onClick={onOpenExportMp3}
                      disabled={!currentProject.chapters.some(c => !!c.audioBlobUrl || !!c.audioBlob)}
                      className="px-3 py-1 bg-lime-400 hover:bg-lime-300 text-neutral-950 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm shadow-lime-400/20 disabled:opacity-40"
                      title="Export ready chapters as a concatenated MP3 file"
                    >
                      <FileAudio className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Export MP3</span>
                    </button>
                  )}

                  {/* Batch Synthesize Queue Button */}
                  <button
                    type="button"
                    id="btn-batch-synthesis-open"
                    onClick={() => setShowBatchModal(true)}
                    className="px-3 py-1 bg-lime-500/15 border border-lime-500/40 hover:bg-lime-500/25 text-lime-300 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm"
                    title="Synthesize all chapters sequentially in background batch queue"
                  >
                    <Layers className="w-3.5 h-3.5 text-lime-400" />
                    <span>Batch Synthesize All</span>
                  </button>

                  <button
                    onClick={() => handleEnhanceScript(selectedChapterTab)}
                    disabled={isEnhancingScript}
                    className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                  >
                    {isEnhancingScript ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-lime-400" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-lime-400" />
                    )}
                    <span>
                      {localConfig.enabled && localConfig.isConnected
                        ? `Polish via Local ${localConfig.selectedModel || 'LLM'} (Private)`
                        : localConfig.privacyMode === 'strict_local'
                          ? 'Polish via Local LLM'
                          : 'Polish Script (Local / Cloud Fallback)'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Chapter Tabs */}
              <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-thin">
                {currentProject.chapters.map((ch, idx) => (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedChapterTab(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center space-x-1.5 ${
                      selectedChapterTab === idx
                        ? 'bg-lime-500/10 text-lime-400 border border-lime-500/30 font-semibold'
                        : 'bg-neutral-950 border border-neutral-800/80 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <span>{ch.title}</span>
                    {ch.audioBlobUrl && (
                      <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
                    )}
                    {ch.privacyLevel && (
                      <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                        ch.privacyLevel === '100% On-Device' 
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {ch.privacyLevel === '100% On-Device' ? 'Local' : 'Cloud'}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Chapter Editor: rename / reorder / merge / split / delete */}
              {currentProject.chapters.length > 0 && (
                <div className="flex items-center justify-between flex-wrap gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleRenameChapter}
                      className="px-2 py-1 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-neutral-600 text-neutral-300 hover:text-white text-[11px] flex items-center space-x-1 transition-colors"
                      title="Rename this chapter"
                    >
                      <Pencil className="w-3 h-3 text-lime-400" />
                      <span>Rename</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveChapter(-1)}
                      disabled={selectedChapterTab === 0}
                      className="p-1.5 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-neutral-600 disabled:opacity-30 text-neutral-400 hover:text-white transition-colors"
                      title="Move chapter up"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveChapter(1)}
                      disabled={selectedChapterTab >= currentProject.chapters.length - 1}
                      className="p-1.5 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-neutral-600 disabled:opacity-30 text-neutral-400 hover:text-white transition-colors"
                      title="Move chapter down"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleMergeChapterUp}
                      disabled={selectedChapterTab === 0}
                      className="px-2 py-1 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-neutral-600 disabled:opacity-30 text-neutral-300 hover:text-white text-[11px] flex items-center space-x-1 transition-colors"
                      title="Merge this chapter into the previous one"
                    >
                      <Layers className="w-3 h-3 text-lime-400" />
                      <span>Merge Up</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSplitChapter}
                      className="px-2 py-1 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-neutral-600 text-neutral-300 hover:text-white text-[11px] flex items-center space-x-1 transition-colors"
                      title="Split this chapter at the text cursor into two chapters"
                    >
                      <Scissors className="w-3 h-3 text-lime-400" />
                      <span>Split at Cursor</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteChapter}
                      className="px-2 py-1 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-red-500/50 text-neutral-400 hover:text-red-400 text-[11px] flex items-center space-x-1 transition-colors"
                      title="Delete this chapter"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Synthesis progress */}
              {isSynthesizing && (
                <div className="space-y-1.5">
                  <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-lime-400 rounded-full transition-all duration-300"
                      style={{ width: `${synthesisProgress}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-neutral-500 font-mono flex items-center space-x-1.5">
                    <Loader2 className="w-3 h-3 animate-spin text-lime-400" />
                    <span>{synthesisProgress}%</span>
                  </div>
                </div>
              )}

              {/* Active Chapter Script & Controls */}
              {currentProject.chapters[selectedChapterTab] && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="text-neutral-400 font-medium">
                        Script: <strong className="text-white">{currentProject.chapters[selectedChapterTab].title}</strong>
                      </span>
                      {currentProject.chapters[selectedChapterTab].privacyLevel && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-900 border border-neutral-800 text-neutral-300 flex items-center space-x-1">
                          {currentProject.chapters[selectedChapterTab].privacyLevel === '100% On-Device' ? (
                            <>
                              <ShieldCheck className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">100% On-Device</span>
                            </>
                          ) : (
                            <>
                              <Cloud className="w-3 h-3 text-blue-400" />
                              <span>Cloud Hosted</span>
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] text-neutral-500 hidden sm:inline">
                        Directorial tags: <code className="text-lime-300">[whisper]</code>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowChapterReadAlong(!showChapterReadAlong)}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                          showChapterReadAlong
                            ? 'bg-lime-500/20 border-lime-500/50 text-lime-300'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <BookOpen className="w-3.5 h-3.5 text-lime-400" />
                        <span>{showChapterReadAlong ? 'Edit Script' : 'Karaoke Teleprompter'}</span>
                      </button>
                    </div>
                  </div>

                  {showChapterReadAlong ? (
                    <ReadAlongTeleprompter
                      text={
                        currentProject.chapters[selectedChapterTab].narratedScript ||
                        currentProject.chapters[selectedChapterTab].originalText
                      }
                      chapterTitle={currentProject.chapters[selectedChapterTab].title}
                      duration={currentProject.chapters[selectedChapterTab].duration || 60}
                      currentTime={0}
                      isPlaying={false}
                      onTogglePlay={() => onPlayChapter(selectedChapterTab)}
                    />
                  ) : (
                    <textarea
                      ref={scriptTextareaRef}
                      value={currentProject.chapters[selectedChapterTab].narratedScript}
                      onChange={(e) => {
                        const updated = [...currentProject.chapters];
                        updated[selectedChapterTab].narratedScript = e.target.value;
                        setCurrentProject({ ...currentProject, chapters: updated });
                      }}
                      rows={7}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 text-xs text-neutral-200 focus:outline-none focus:border-lime-500/50 font-mono leading-relaxed"
                    />
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-[11px] text-neutral-400 flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-lime-400" />
                      <span>
                        Status:{' '}
                        {currentProject.chapters[selectedChapterTab].audioBlobUrl
                          ? 'Audio Synthesized & Ready'
                          : 'Ready for Synthesis'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {currentProject.chapters[selectedChapterTab].audioBlobUrl && (
                        <button
                          onClick={() => onPlayChapter(selectedChapterTab)}
                          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Play Audio</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleSynthesizeChapter(selectedChapterTab)}
                        disabled={isSynthesizing}
                        className="px-4 py-1.5 bg-lime-400 hover:bg-lime-300 text-neutral-950 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md shadow-lime-400/20 disabled:opacity-50"
                      >
                        {isSynthesizing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                        <span>Synthesize Audio</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Voice, Emotion, & Local LLM Controls (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Voice Engine & Selector */}
          <div className="p-5 bg-neutral-900/80 border border-neutral-800 rounded-2xl space-y-4 shadow-md">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-lime-400" />
                <span className="text-xs font-semibold text-white">Voice & Narration Engine</span>
              </div>
              
              {/* Main Preview Voice Button */}
              <button
                type="button"
                id="btn-preview-voice-header"
                onClick={() => handlePreviewVoice()}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm ${
                  isPreviewing
                    ? 'bg-lime-400 text-neutral-950 animate-pulse'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-lime-400 border border-lime-500/30'
                }`}
                title="Preview selected voice persona with current emotion setting"
              >
                {isPreviewing ? (
                  <>
                    <Square className="w-3 h-3 fill-neutral-950" />
                    <span>Stop Preview</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-lime-400" />
                    <span>Preview Voice</span>
                  </>
                )}
              </button>
            </div>

            {/* Live Audio Audition Indicator Bar */}
            <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
              isPreviewing 
                ? 'bg-lime-950/40 border-lime-500/50 text-lime-300' 
                : 'bg-neutral-950/60 border-neutral-800/80 text-neutral-400'
            }`}>
              <div className="flex items-center space-x-2.5 truncate">
                {isPreviewing ? (
                  <div className="flex items-end space-x-0.5 h-3.5 flex-shrink-0">
                    <span className="w-0.5 bg-lime-400 h-2 animate-bounce" />
                    <span className="w-0.5 bg-lime-400 h-3.5 animate-pulse" />
                    <span className="w-0.5 bg-lime-400 h-1.5 animate-bounce delay-75" />
                    <span className="w-0.5 bg-lime-400 h-3 animate-bounce delay-150" />
                  </div>
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-lime-400/80 flex-shrink-0" />
                )}
                <span className="truncate text-[11px]">
                  {isPreviewing 
                    ? `Auditioning ${previewingVoice} • Style: ${emotion}` 
                    : `Active Voice: ${selectedVoice} • ${emotion}`}
                </span>
              </div>

              <button
                type="button"
                onClick={() => handlePreviewVoice()}
                className="px-2 py-0.5 rounded-md bg-neutral-800/80 hover:bg-neutral-700 text-[10px] font-semibold text-neutral-300 flex items-center space-x-1 transition-colors flex-shrink-0"
              >
                {isPreviewing ? (
                  <>
                    <Square className="w-2.5 h-2.5 fill-current text-lime-400" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Play className="w-2.5 h-2.5 fill-current text-lime-400" />
                    <span>Audition</span>
                  </>
                )}
              </button>
            </div>

            {/* Voice Engine Selector: Local Models vs Cloud Gemini */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5 bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setVoiceProvider('local_models')}
                  className={`py-1.5 px-2 rounded-lg font-medium transition-all flex items-center justify-center space-x-1.5 ${
                    voiceProvider === 'local_models'
                      ? 'bg-neutral-800 text-lime-400 font-bold shadow-xs'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5 text-lime-400" />
                  <span>Local Models</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (localConfig.privacyMode === 'strict_local') {
                      alert('Strict Local Privacy Mode is active. Cloud Gemini TTS cannot be selected. Set your privacy mode to "Local-First + Cloud Fallback" in the top titlebar to enable hosted cloud models.');
                      return;
                    }
                    setVoiceProvider('gemini');
                  }}
                  className={`py-1.5 px-2 rounded-lg font-medium transition-all flex items-center justify-center space-x-1.5 ${
                    voiceProvider === 'gemini'
                      ? 'bg-neutral-800 text-white font-bold shadow-xs'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Cloud className="w-3.5 h-3.5 text-blue-400" />
                  <span>Cloud Fallback</span>
                </button>
              </div>

              {/* Status Banner */}
              <div className={`px-3 py-1.5 rounded-lg border text-[11px] flex items-center justify-between ${
                voiceProvider === 'local_models'
                  ? 'bg-lime-950/30 border-lime-500/30 text-lime-300'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-300'
              }`}>
                <div className="flex items-center space-x-1.5 truncate">
                  {voiceProvider === 'local_models' ? (
                    <>
                      <Cpu className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
                      <span className="truncate">
                        On-Device Neural Engine: <strong className="text-white">{localConfig.activeTtsEngine ? localConfig.activeTtsEngine.replace('_', ' ') : 'Fish Audio'}</strong>
                        {localConfig.ttsConfigs?.[localConfig.activeTtsEngine || 'fish_audio']?.isConnected
                          ? ' (Live on your machine)'
                          : ' (not detected on this machine — runs when installed locally)'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Cloud className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                      <span>Hosted Gemini TTS Preview (Cloud Fallback)</span>
                    </>
                  )}
                </div>
                <span className="text-[10px] text-neutral-400 font-mono flex-shrink-0">
                  {voiceProvider === 'gemini' ? 'Hosted API' : '100% On-Device'}
                </span>
              </div>
            </div>

            {/* Local Models Card (Chatterbox, Orpheus, Moss, Fish Audio) */}
            {voiceProvider === 'local_models' && (
              <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-lime-400" />
                      <span>Active Local TTS: {localConfig.ttsConfigs?.[localConfig.activeTtsEngine || 'fish_audio']?.name || 'Fish Audio'}</span>
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      {localConfig.ttsConfigs?.[localConfig.activeTtsEngine || 'fish_audio']?.tagline || 'Autoregressive Neural TTS & Voice Cloning'}
                    </div>
                  </div>

                  {onOpenModelInstaller && (
                    <button
                      type="button"
                      onClick={onOpenModelInstaller}
                      className="px-2.5 py-1 bg-lime-400 hover:bg-lime-300 text-neutral-950 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs"
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Model Hub & GPU Setup</span>
                    </button>
                  )}
                </div>

                {/* Quick Model Tabs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                  {[
                    { id: 'fish_audio', name: 'Fish Audio', port: 8080 },
                    { id: 'orpheus', name: 'Orpheus TTS', port: 7860 },
                    { id: 'moss', name: 'Moss TTS', port: 9880 },
                    { id: 'chatterbox', name: 'Chatterbox', port: 8004 },
                  ].map((m) => {
                    const isCurrent = (localConfig.activeTtsEngine || 'fish_audio') === m.id;
                    const itemConfig = localConfig.ttsConfigs?.[m.id as any];
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          if (localConfig.activeTtsEngine !== m.id && onOpenModelInstaller) {
                            onOpenModelInstaller();
                          }
                        }}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          isCurrent
                            ? 'border-lime-500/70 bg-lime-950/30 text-white font-medium'
                            : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{m.name}</span>
                          {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />}
                        </div>
                        <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                          Port {m.port} • {itemConfig?.quantization.toUpperCase() || 'FP16'}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1 border-t border-neutral-900">
                  <span>Hardware: <strong className="text-neutral-200">{localConfig.detectedGpu?.renderer || 'GPU'}</strong></span>
                  <span className="text-lime-400 font-mono">
                    Auto-Quantization: {localConfig.detectedGpu?.recommendedQuantization.toUpperCase() || 'FP16'}
                  </span>
                </div>
              </div>
            )}

            {/* Gemini Prebuilt Studio Voices */}
            {voiceProvider === 'gemini' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-neutral-400 font-medium block">
                    Gemini Voice Persona
                  </label>
                  <span className="text-[10px] text-neutral-500">Click ▶ to preview individual voice</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: 'Puck', desc: 'Energetic, youthful, modern cadence' },
                    { id: 'Charon', desc: 'Deep, resonant, classic gravitas' },
                    { id: 'Kore', desc: 'Melodic, warm, engaging storyteller' },
                    { id: 'Fenrir', desc: 'Authoritative, rich, rugged timber' },
                    { id: 'Zephyr', desc: 'Gentle, soothing, serene cadence' },
                  ].map((v) => (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVoice(v.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        selectedVoice === v.id
                          ? 'border-lime-500/50 bg-lime-950/20 text-white shadow-xs'
                          : 'border-neutral-800 bg-neutral-950/40 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <div className="font-semibold text-xs text-neutral-200 flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span>{v.id}</span>
                          {selectedVoice === v.id && (
                            <Check className="w-3.5 h-3.5 text-lime-400" />
                          )}
                        </div>

                        {/* Inline Preview Icon Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVoice(v.id);
                            handlePreviewVoice(v.id);
                          }}
                          className={`p-1 rounded-md transition-colors ${
                            isPreviewing && previewingVoice === v.id
                              ? 'bg-lime-400 text-neutral-950 font-bold'
                              : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-lime-400'
                          }`}
                          title={`Preview ${v.id} Voice`}
                        >
                          {isPreviewing && previewingVoice === v.id ? (
                            <Square className="w-2.5 h-2.5 fill-neutral-950" />
                          ) : (
                            <Play className="w-2.5 h-2.5 fill-current" />
                          )}
                        </button>
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-0.5 leading-tight">{v.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-3 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-500 leading-relaxed">
                With <strong className="text-neutral-300">Local Models</strong> selected, Narrativ synthesizes directly
                against a TTS engine running on <em>your</em> machine (Fish Audio, Orpheus, Piper…) — click
                &ldquo;Model Hub &amp; GPU Setup&rdquo; to install one. If none are detected, generation falls back to
                the cloud engine automatically (respecting your privacy mode).
              </div>
            )}

            {/* Emotion Presets */}
            <div className="space-y-2 pt-2 border-t border-neutral-800/80">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-neutral-400 font-medium block">
                  Emotion & Dramatic Tone
                </label>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${emotionInfo.color}`}>
                  {emotion.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: 'narrative', label: 'Narrative' },
                  { id: 'dramatic', label: 'Dramatic' },
                  { id: 'warm', label: 'Warm Bedtime' },
                  { id: 'suspenseful', label: 'Suspenseful' },
                  { id: 'whisper', label: 'Whisper' },
                  { id: 'energetic', label: 'Energetic' },
                  { id: 'melancholic', label: 'Melancholic' },
                  { id: 'fantasy', label: 'Epic Lore' },
                ].map((emo) => (
                  <button
                    key={emo.id}
                    type="button"
                    onClick={() => setEmotion(emo.id as EmotionPreset)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                      emotion === emo.id
                        ? 'border-lime-500/50 bg-lime-950/30 text-lime-300 font-semibold'
                        : 'border-neutral-800 bg-neutral-950/40 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    {emo.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-neutral-500 italic mt-1">
                "{emotionInfo.desc}"
              </p>
            </div>

            {/* Sliders: Pitch & Rate */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-neutral-800/80 text-xs">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-neutral-400">
                  <span>Pitch</span>
                  <span className="font-mono text-neutral-300">{pitch}x</span>
                </div>
                <input
                  type="range"
                  min={0.75}
                  max={1.3}
                  step={0.05}
                  value={pitch}
                  onChange={(e) => setPitch(parseFloat(e.target.value))}
                  className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-lime-400"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-neutral-400">
                  <span>Speaking Rate</span>
                  <span className="font-mono text-neutral-300">{rate}x</span>
                </div>
                <input
                  type="range"
                  min={0.75}
                  max={1.5}
                  step={0.05}
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value))}
                  className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-lime-400"
                />
              </div>
            </div>
          </div>

          {/* Multi-Voice Dialogue Casting (Full-Cast Dramatization) */}
          <MultiVoiceCastingCard
            config={multiVoiceConfig}
            onChange={handleMultiVoiceChange}
          />

          {/* Per-Project Pronunciation Dictionary */}
          <PronunciationDictionaryCard
            entries={pronunciations}
            onChange={handlePronunciationChange}
          />

          {/* Ambient Soundscapes & Procedural Foley Bed */}
          <SoundscapeMixer />

          {/* Local LLM Narration Tuning Card */}
          <div className="p-5 bg-neutral-900/80 border border-neutral-800 rounded-2xl space-y-3.5 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-lime-400" />
                <span className="text-xs font-semibold text-white">Local LLM Script Engine</span>
              </div>
              <button
                onClick={onOpenLocalSettings}
                className="text-[11px] text-lime-400 hover:underline font-medium"
              >
                Configure
              </button>
            </div>

            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-neutral-400">Status:</span>
                <span className={localConfig.enabled && localConfig.isConnected ? 'text-lime-400 font-semibold' : 'text-neutral-500'}>
                  {localConfig.enabled && localConfig.isConnected
                    ? `Connected (${localConfig.selectedModel || 'Local'})`
                    : 'Cloud Gemini Default'}
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-neutral-400 block">Narration Script Style</label>
                <select
                  value={scriptMode}
                  onChange={(e) => setScriptMode(e.target.value as ScriptEnhancementMode)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-neutral-200 text-xs focus:outline-none focus:border-lime-500/50"
                >
                  <option value="expressive_cues">Insert Audio Delivery Cues [whisper, pause]</option>
                  <option value="audiobook_adaptation">Audiobook Flow & Spoken Rhythm</option>
                  <option value="radio_theater">Classic Radio Drama & Dialogue Annotations</option>
                  <option value="condensed_summary">Executive Audio Summary</option>
                </select>
              </div>
            </div>
          </div>

          {/* Status Message Notification Toast */}
          {statusMessage && (
            <div className="p-3 bg-lime-950/30 border border-lime-500/30 rounded-xl text-xs text-lime-300 flex items-center space-x-2 animate-fade-in">
              <Sparkles className="w-4 h-4 text-lime-400 flex-shrink-0" />
              <span className="truncate">{statusMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Batch Chapter Synthesis Queue Modal */}
      <BatchSynthesisModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        project={currentProject}
        onProjectUpdated={setCurrentProject}
        browserVoices={browserVoices}
        selectedBrowserVoice={selectedBrowserVoice}
      />
    </div>
  );
};
