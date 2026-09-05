export interface Chapter {
  id: string;
  title: string;
  originalText: string;
  narratedScript: string;
  audioBlobUrl?: string;
  audioBlob?: Blob;
  duration?: number;
  status: 'idle' | 'generating_script' | 'synthesizing' | 'ready' | 'error';
  errorMessage?: string;
  privacyLevel?: 'local' | 'cloud_fallback' | '100% On-Device' | 'Cloud Fallback';
  scriptSource?: string;
  speechSource?: string;
}

export interface VoiceCastRole {
  id: string;
  roleName: string; // e.g. "Narrator", "Protagonist", "Antagonist", "Secondary"
  speakerVoice: string; // Puck, Charon, Kore, Fenrir, Zephyr
  genderHint?: string;
  color: string;
}

export interface MultiVoiceConfig {
  enabled: boolean;
  narratorVoice: string;
  dialogueVoice: string;
  characterRoles?: VoiceCastRole[];
}

export type SoundscapeType =
  | 'none'
  | 'rain'
  | 'fireplace'
  | 'cosmic_drone'
  | 'forest_wind'
  | 'victorian_library'
  | 'starship_hum';

export type FoleyEffectType =
  | 'page_turn'
  | 'chime'
  | 'distant_thunder'
  | 'footsteps'
  | 'magic_shimmer';

export interface SoundscapeConfig {
  enabled: boolean;
  type: SoundscapeType;
  volume: number; // 0 to 1
}

export interface SentenceCue {
  id: string;
  text: string;
  speaker?: string;
  startTime: number;
  endTime: number;
}

export interface AudiobookProject {
  id: string;
  title: string;
  author: string;
  coverImage?: string;
  createdAt: number;
  updatedAt: number;
  voice: string;
  voiceProvider: 'browser_neural' | 'gemini' | 'local_http';
  emotion: EmotionPreset;
  pitch: number;
  rate: number;
  multiVoice?: MultiVoiceConfig;
  soundscape?: SoundscapeConfig;
  chapters: Chapter[];
  currentChapterIndex: number;
}

export type EmotionPreset = 
  | 'narrative'
  | 'dramatic'
  | 'warm'
  | 'suspenseful'
  | 'whisper'
  | 'energetic'
  | 'melancholic'
  | 'fantasy';

export type LocalTtsModelId = 
  | 'chatterbox' 
  | 'orpheus' 
  | 'moss' 
  | 'fish_audio' 
  | 'piper' 
  | 'custom';

export type ModelQuantization = 
  | 'fp16' 
  | 'bf16' 
  | 'int8' 
  | 'int4' 
  | 'cpu_onnx';

export type GpuHardwareTier = 
  | 'tier_s_ultra'   // 16GB - 24GB+ VRAM (RTX 4090, 3090, M2/M3/M4 Max/Ultra)
  | 'tier_a_high'    // 10GB - 12GB VRAM (RTX 4070, 3080, 3060 12GB, Apple Pro)
  | 'tier_b_medium'  // 6GB - 8GB VRAM (RTX 4060, 3070, 2060, Apple Base)
  | 'tier_c_budget'; // < 4GB VRAM / CPU / Integrated (Iris, GTX 1650, CPU)

export interface GpuHardwareProfile {
  renderer: string;
  vendor: string;
  vramTier: GpuHardwareTier;
  estimatedVramGb: number;
  recommendedQuantization: ModelQuantization;
  isNvidiaCuda: boolean;
  isAppleSilicon: boolean;
  isAmdRocm: boolean;
  summary: string;
  architectureHint?: string;
}

export interface LocalTtsConfigItem {
  id: LocalTtsModelId;
  name: string;
  tagline: string;
  defaultPort: number;
  endpoint: string;
  quantization: ModelQuantization;
  temperature: number;
  topP: number;
  speed: number;
  repetitionPenalty: number;
  sampleRate: 24000 | 32000 | 44100 | 48000;
  referenceAudioPrompt?: string;
  streaming: boolean;
  isConnected: boolean;
  lastPingMs?: number;
}

export interface LocalLLMConfig {
  enabled: boolean;
  endpoint: string;
  provider: 'ollama' | 'openai_compatible';
  selectedModel: string;
  availableModels: string[];
  isTesting: boolean;
  isConnected: boolean;
  lastError?: string;
  // Privacy-first settings
  privacyMode: 'smart_fallback' | 'strict_local';
  allowCloudFallback: boolean;
  localTtsEndpoint?: string;
  localTtsModel?: string;
  localTtsConnected?: boolean;
  // Cutting-Edge Local TTS Models (Chatterbox, Orpheus, Moss, Fish Audio)
  activeTtsEngine: LocalTtsModelId;
  detectedGpu?: GpuHardwareProfile;
  ttsConfigs: Record<LocalTtsModelId, LocalTtsConfigItem>;
}

export type ScriptEnhancementMode = 
  | 'audiobook_adaptation'
  | 'expressive_cues'
  | 'radio_theater'
  | 'condensed_summary';
