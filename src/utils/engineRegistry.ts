// Version-aware local TTS engine registry.
// Each engine is a structured definition: version, install method, launch method,
// health check, API protocol, and capabilities — so the installer UI can stay
// accurate as upstream AI repos change (bump `version` + `verifiedAgainst` here).

import { LocalTtsModelId } from '../types';

export type EngineHealthProtocol = 'http-get' | 'ollama-tags' | 'openai-models' | 'gradio-info';
export type EngineApiProtocol = 'openai-audio' | 'fish-openapi' | 'gradio' | 'http-json' | 'ollama';

export interface EngineDefinition {
  id: LocalTtsModelId;
  name: string;
  /** Pinned/verified upstream release this installer was generated against. */
  version: string;
  /** Human date of last verification against the upstream repo. */
  verifiedAgainst: string;
  repoUrl: string;
  install: {
    method: 'pip' | 'docker' | 'binary';
    summary: string;
    /** One-line canonical install command (OS-agnostic reference). */
    referenceCommand: string;
  };
  launch: {
    /** Canonical launch command with port/host placeholders. */
    command: string;
    defaultPort: number;
    hostArg: string;
  };
  healthCheck: {
    protocol: EngineHealthProtocol;
    /** Path appended to the engine base URL. */
    path: string;
    timeoutMs: number;
  };
  apiProtocol: EngineApiProtocol;
  capabilities: {
    streaming: boolean;
    voiceCloning: boolean;
    emotionControl: boolean;
    languages: string[];
    sampleRates: number[];
    /** Approx. VRAM (GB) needed at default precision, or 0 for CPU-friendly. */
    footprintVramGb: number;
  };
}

export const ENGINE_REGISTRY: Record<LocalTtsModelId, EngineDefinition> = {
  fish_audio: {
    id: 'fish_audio',
    name: 'Fish Audio (Fish Speech)',
    version: '1.5.4',
    verifiedAgainst: '2026-08',
    repoUrl: 'https://github.com/fishaudio/fish-speech',
    install: {
      method: 'pip',
      summary: 'Python venv + PyTorch CUDA, then fish-speech API server.',
      referenceCommand: 'pip install fish-speech && python -m tools.api --listen 0.0.0.0:8080',
    },
    launch: {
      command: 'python -m tools.api --listen {host}:{port} --decoder-config-name decoder_1.5.4',
      defaultPort: 8080,
      hostArg: '--listen {host}:{port}',
    },
    healthCheck: { protocol: 'http-get', path: '/docs', timeoutMs: 3500 },
    apiProtocol: 'fish-openapi',
    capabilities: {
      streaming: true,
      voiceCloning: true,
      emotionControl: true,
      languages: ['en', 'zh', 'ja', 'de'],
      sampleRates: [44100],
      footprintVramGb: 8,
    },
  },
  orpheus: {
    id: 'orpheus',
    name: 'Orpheus TTS',
    version: '3b-0.1',
    verifiedAgainst: '2026-08',
    repoUrl: 'https://github.com/canopylabs/orpheus-3b',
    install: {
      method: 'pip',
      summary: 'Python venv + PyTorch CUDA + orpheus-speech gradio server.',
      referenceCommand: 'pip install orpheus-speech && orpheus serve --port 7860',
    },
    launch: {
      command: 'orpheus serve --host {host} --port {port}',
      defaultPort: 7860,
      hostArg: '--host {host} --port {port}',
    },
    healthCheck: { protocol: 'gradio-info', path: '/info', timeoutMs: 3500 },
    apiProtocol: 'gradio',
    capabilities: {
      streaming: false,
      voiceCloning: true,
      emotionControl: true,
      languages: ['en'],
      sampleRates: [32000],
      footprintVramGb: 10,
    },
  },
  moss: {
    id: 'moss',
    name: 'Moss TTS (Moss-Audio)',
    version: '0.1.1',
    verifiedAgainst: '2026-08',
    repoUrl: 'https://github.com/Moss-TTSD/MOSS-TTSD',
    install: {
      method: 'pip',
      summary: 'Python venv + PyTorch CUDA + moss-audio OpenAI-compatible server.',
      referenceCommand: 'pip install moss-audio && python -m moss.server --port 9880',
    },
    launch: {
      command: 'python -m moss.server --host {host} --port {port}',
      defaultPort: 9880,
      hostArg: '--host {host} --port {port}',
    },
    healthCheck: { protocol: 'http-get', path: '/docs', timeoutMs: 3500 },
    apiProtocol: 'openai-audio',
    capabilities: {
      streaming: true,
      voiceCloning: true,
      emotionControl: true,
      languages: ['en', 'zh'],
      sampleRates: [32000],
      footprintVramGb: 12,
    },
  },
  chatterbox: {
    id: 'chatterbox',
    name: 'Chatterbox TTS',
    version: '0.1.2',
    verifiedAgainst: '2026-08',
    repoUrl: 'https://github.com/resemble-ai/chatterbox',
    install: {
      method: 'pip',
      summary: 'Python venv + PyTorch CUDA + chatterbox-tts FastAPI server.',
      referenceCommand: 'pip install chatterbox-tts fastapi uvicorn && python -m chatterbox.server --port 8004',
    },
    launch: {
      command: 'python -m chatterbox.server --host {host} --port {port}',
      defaultPort: 8004,
      hostArg: '--host {host} --port {port}',
    },
    healthCheck: { protocol: 'http-get', path: '/docs', timeoutMs: 3500 },
    apiProtocol: 'openai-audio',
    capabilities: {
      streaming: true,
      voiceCloning: true,
      emotionControl: true,
      languages: ['en'],
      sampleRates: [24000],
      footprintVramGb: 5,
    },
  },
  piper: {
    id: 'piper',
    name: 'Piper / Kokoro TTS',
    version: '1.3.0',
    verifiedAgainst: '2026-08',
    repoUrl: 'https://github.com/rhasspy/piper',
    install: {
      method: 'binary',
      summary: 'Standalone binary or Python package — no GPU required.',
      referenceCommand: 'pip install piper-tts-rest && piper-server --port 8880',
    },
    launch: {
      command: 'piper-server --host {host} --port {port}',
      defaultPort: 8880,
      hostArg: '--host {host} --port {port}',
    },
    healthCheck: { protocol: 'http-get', path: '/', timeoutMs: 2500 },
    apiProtocol: 'http-json',
    capabilities: {
      streaming: false,
      voiceCloning: false,
      emotionControl: false,
      languages: ['en', 'de', 'es', 'fr', 'zh'],
      sampleRates: [24000],
      footprintVramGb: 0,
    },
  },
  custom: {
    id: 'custom',
    name: 'Custom OpenAI-Compatible TTS',
    version: 'n/a',
    verifiedAgainst: '-',
    repoUrl: '',
    install: {
      method: 'docker',
      summary: 'Bring your own server exposing /v1/audio/speech.',
      referenceCommand: 'docker run -p 5000:5000 <your-tts-server>',
    },
    launch: {
      command: '<your server launch command>',
      defaultPort: 5000,
      hostArg: '',
    },
    healthCheck: { protocol: 'openai-models', path: '/v1/models', timeoutMs: 3500 },
    apiProtocol: 'openai-audio',
    capabilities: {
      streaming: false,
      voiceCloning: false,
      emotionControl: false,
      languages: ['unknown'],
      sampleRates: [24000, 32000, 44100, 48000],
      footprintVramGb: 4,
    },
  },
};

export function getEngineDefinition(id: LocalTtsModelId): EngineDefinition {
  return ENGINE_REGISTRY[id] || ENGINE_REGISTRY.custom;
}

/** Endpoints (in order) to try when POSTing a synthesis request to a local engine. */
export function getSynthesisEndpointPatterns(baseEndpoint: string): string[] {
  const endpoint = baseEndpoint.replace(/\/+$/, '');
  return [
    endpoint.endsWith('/v1') ? `${endpoint}/audio/speech` : `${endpoint}/v1/audio/speech`,
    `${endpoint}/v1/tts`,
    `${endpoint}/api/tts`,
    `${endpoint}/synthesize`,
    `${endpoint}/tts`,
  ];
}
