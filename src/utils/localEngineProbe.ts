// Client-side probing of the user's LOCAL engines.
// Runs in the browser so it tests the *visitor's own machine* — a server-side
// probe only ever reaches the hosting container, which is not where local
// models run. Browsers treat http://localhost as a trustworthy origin, so
// these requests are allowed from HTTPS pages (engines must send CORS headers
// and be launched with --host 0.0.0.0 or OLLAMA_ORIGINS=*, otherwise they
// will honestly report offline).

import { LocalTtsModelId } from '../types';
import { ENGINE_REGISTRY, getEngineDefinition, getSynthesisEndpointPatterns } from './engineRegistry';

export interface EngineProbeResult {
  id: string;
  name: string;
  port: number;
  online: boolean;
  latencyMs: number;
}

export interface LocalLLMProbeResult {
  online: boolean;
  models?: string[];
  latencyMs?: number;
  error?: string;
}

async function timedFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

/** Probe one local TTS engine using its registry health check definition. */
export async function probeLocalEngine(
  engineId: LocalTtsModelId,
  endpoint?: string
): Promise<EngineProbeResult> {
  const def = getEngineDefinition(engineId);
  const base = (endpoint || `http://localhost:${def.launch.defaultPort}`).replace(/\/+$/, '');
  const start = performance.now();
  let online = false;

  try {
    const res = await timedFetch(`${base}${def.healthCheck.path}`, { method: 'GET' }, def.healthCheck.timeoutMs);
    online = res.ok;
  } catch {
    online = false;
  }

  return {
    id: engineId,
    name: def.name,
    port: def.launch.defaultPort,
    online,
    latencyMs: online ? Math.round(performance.now() - start) : -1,
  };
}

/** Probe all registry-defined local TTS engines on the visitor's machine. */
export async function probeAllLocalEngines(endpoints?: Partial<Record<LocalTtsModelId, string>>): Promise<EngineProbeResult[]> {
  const ids = Object.keys(ENGINE_REGISTRY) as LocalTtsModelId[];
  return Promise.all(ids.map((id) => probeLocalEngine(id, endpoints?.[id])));
}

/** Probe a local LLM server (Ollama / OpenAI-compatible) from the browser. */
export async function probeLocalLLM(
  endpoint: string,
  provider: 'ollama' | 'openai_compatible'
): Promise<LocalLLMProbeResult> {
  const base = endpoint.replace(/\/+$/, '');
  const start = performance.now();

  try {
    if (provider === 'ollama') {
      const res = await timedFetch(`${base}/api/tags`, { method: 'GET' }, 4000);
      if (!res.ok) return { online: false, error: `Ollama responded with HTTP ${res.status}.` };
      const data = await res.json();
      const models = (data.models || []).map((m: any) => m.name || m.model).filter(Boolean);
      return { online: true, models, latencyMs: Math.round(performance.now() - start) };
    }
    const res = await timedFetch(`${base}/v1/models`, { method: 'GET' }, 4000);
    if (!res.ok) return { online: false, error: `Server responded with HTTP ${res.status}.` };
    const data = await res.json();
    const models = (data.data || []).map((m: any) => m.id).filter(Boolean);
    return { online: true, models, latencyMs: Math.round(performance.now() - start) };
  } catch (err: any) {
    const isCorsOrNetwork = err?.name === 'TypeError' || err?.name === 'AbortError';
    return {
      online: false,
      error: isCorsOrNetwork
        ? 'Could not reach the local server from the browser. Make sure it is running and launched with CORS/external access enabled (e.g. OLLAMA_ORIGINS=* or --host 0.0.0.0).'
        : err?.message || 'Connection failed.',
    };
  }
}

export interface DirectTtsPayload {
  model: string;
  text: string;
  voice: string;
  temperature: number;
  topP: number;
  speed: number;
  sampleRate: number;
  quantization: string;
  referenceAudioPrompt?: string;
}

/**
 * Attempt a synthesis DIRECTLY against the visitor's local engine (browser →
 * localhost). Returns the raw audio Blob, or null if the engine is unreachable
 * (caller should then fall back to the server route).
 */
export async function tryLocalTtsDirect(
  engineId: LocalTtsModelId,
  endpoint: string,
  payload: DirectTtsPayload
): Promise<Blob | null> {
  const urls = getSynthesisEndpointPatterns(endpoint);

  for (const url of urls) {
    try {
      const res = await timedFetch(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: payload.model,
            input: payload.text,
            text: payload.text,
            voice: payload.voice,
            response_format: 'wav',
            format: 'wav',
            temperature: payload.temperature,
            top_p: payload.topP,
            speed: payload.speed,
            sample_rate: payload.sampleRate,
            reference_prompt: payload.referenceAudioPrompt,
            quantization: payload.quantization,
          }),
        },
        30000
      );

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.startsWith('audio/')) {
          return await res.blob();
        }
        if (contentType.includes('application/json')) {
          const json = await res.json();
          if (json.audio_base64 || json.audio) {
            const b64 = json.audio_base64 || json.audio;
            const bin = atob(b64);
            const buf = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
            return new Blob([buf], { type: 'audio/wav' });
          }
        }
      }
    } catch {
      // try next endpoint pattern
    }
  }
  return null;
}
