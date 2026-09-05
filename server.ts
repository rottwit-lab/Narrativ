import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Modality } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper to convert 16-bit PCM buffer to standard WAV
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  const buffer = Buffer.alloc(totalSize);

  // RIFF chunk descriptor
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(totalSize - 8, 4);
  buffer.write('WAVE', 8);

  // "fmt " sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // "data" sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Copy PCM data
  pcmBuffer.copy(buffer, 44);

  return buffer;
}

// Lazy Gemini client getter
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Narrativ',
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
  });
});

// Test connection to Local LLM (e.g. Ollama or LM Studio)
app.post('/api/local-llm/test-connection', async (req, res) => {
  const { endpoint = 'http://localhost:11434', provider = 'ollama' } = req.body;
  try {
    const trimmedEndpoint = endpoint.replace(/\/+$/, '');
    
    if (provider === 'ollama') {
      const response = await fetch(`${trimmedEndpoint}/api/tags`, {
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) {
        throw new Error(`Ollama returned status ${response.status}`);
      }
      const data = await response.json();
      const models = Array.isArray(data.models)
        ? data.models.map((m: any) => m.name || m.model)
        : [];
      return res.json({
        online: true,
        provider: 'ollama',
        models,
        message: `Connected to local Ollama. Found ${models.length} model(s). Zero data leaves your machine.`,
      });
    } else {
      // OpenAI-compatible (LM Studio, vLLM, LocalAI, etc.)
      const modelsUrl = trimmedEndpoint.endsWith('/v1')
        ? `${trimmedEndpoint}/models`
        : `${trimmedEndpoint}/v1/models`;
      const response = await fetch(modelsUrl, {
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) {
        throw new Error(`Local endpoint returned status ${response.status}`);
      }
      const data = await response.json();
      const models = Array.isArray(data.data)
        ? data.data.map((m: any) => m.id || m.name)
        : [];
      return res.json({
        online: true,
        provider: 'openai_compatible',
        models,
        message: `Connected to local LM Studio / OpenAI-compatible server. Found ${models.length} model(s).`,
      });
    }
  } catch (error: any) {
    return res.json({
      online: false,
      models: [],
      provider,
      error: error.message || 'Connection failed. Ensure local LLM server is running.',
    });
  }
});

// Test connection to Local TTS server (Chatterbox, Orpheus, Moss, Fish Audio, Piper, or OpenAI-compatible)
app.post('/api/local-tts/test-connection', async (req, res) => {
  const { endpoint = 'http://localhost:8080', modelType = 'fish_audio' } = req.body;
  const startTime = Date.now();
  try {
    const trimmed = endpoint.replace(/\/+$/, '');
    
    // Test multiple common paths based on model convention
    const pathsToTry = [
      trimmed.endsWith('/v1') ? `${trimmed}/models` : `${trimmed}/v1/models`,
      `${trimmed}/v1/health`,
      `${trimmed}/docs`,
      `${trimmed}/health`,
      trimmed,
    ];

    let online = false;
    let serverType = modelType;
    let models: string[] = [];

    for (const testUrl of pathsToTry) {
      try {
        const response = await fetch(testUrl, { signal: AbortSignal.timeout(2500) });
        if (response.ok || response.status === 404 || response.status === 405) {
          // If server responded (even 404 on docs or 405 method not allowed), the port is listening!
          online = true;
          if (response.ok) {
            const data = await response.json().catch(() => ({}));
            if (Array.isArray(data?.data)) {
              models = data.data.map((m: any) => m.id || m.name);
            }
          }
          break;
        }
      } catch {}
    }

    const latencyMs = Date.now() - startTime;

    if (online) {
      return res.json({
        online: true,
        latencyMs,
        models,
        modelType,
        message: `Local ${modelType.toUpperCase()} server detected and responsive (${latencyMs}ms). 100% on-device processing ready.`,
      });
    } else {
      return res.json({
        online: false,
        latencyMs,
        error: `Could not reach ${modelType} at ${trimmed}. Ensure your local server script or container is active.`,
      });
    }
  } catch (err: any) {
    return res.json({
      online: false,
      latencyMs: Date.now() - startTime,
      error: err.message || 'Local TTS server not reachable.',
    });
  }
});

// Concurrent probe of common local model ports (Chatterbox 8004, Orpheus 7860, Moss 9880, Fish Audio 8080, Kokoro 8880)
app.get('/api/local-tts/probe-all', async (req, res) => {
  const targets = [
    { id: 'fish_audio', name: 'Fish Audio', port: 8080, url: 'http://localhost:8080' },
    { id: 'orpheus', name: 'Orpheus TTS', port: 7860, url: 'http://localhost:7860' },
    { id: 'moss', name: 'Moss TTS', port: 9880, url: 'http://localhost:9880' },
    { id: 'chatterbox', name: 'Chatterbox TTS', port: 8004, url: 'http://localhost:8004' },
    { id: 'piper', name: 'Piper / Kokoro', port: 8880, url: 'http://localhost:8880' },
  ];

  const results = await Promise.all(
    targets.map(async (t) => {
      try {
        const start = Date.now();
        const r = await fetch(t.url, { signal: AbortSignal.timeout(1200) });
        return {
          id: t.id,
          name: t.name,
          port: t.port,
          online: r.ok || r.status === 404 || r.status === 405,
          latencyMs: Date.now() - start,
        };
      } catch {
        return { id: t.id, name: t.name, port: t.port, online: false, latencyMs: 0 };
      }
    })
  );

  res.json({ engines: results });
});

// Privacy Engine Status: Quick diagnostic check for local LLM, local TTS, and cloud fallback
app.get('/api/privacy-status', async (req, res) => {
  let ollamaOnline = false;
  let lmStudioOnline = false;

  try {
    const r = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(1200) });
    ollamaOnline = r.ok;
  } catch {}

  try {
    const r = await fetch('http://localhost:1234/v1/models', { signal: AbortSignal.timeout(1200) });
    lmStudioOnline = r.ok;
  } catch {}

  const hasLocalLLM = ollamaOnline || lmStudioOnline;
  const hasCloudFallback = !!process.env.GEMINI_API_KEY;

  res.json({
    hasLocalLLM,
    ollamaOnline,
    lmStudioOnline,
    hasCloudFallback,
    recommendedMode: hasLocalLLM ? 'local' : 'cloud_fallback',
  });
});

// Generate Narration Script using either Gemini or Local LLM (Privacy-First)
app.post('/api/script/enhance', async (req, res) => {
  const {
    text,
    mode = 'audiobook_adaptation',
    emotion = 'narrative',
    narratorPersona = 'Master Storyteller',
    modelSource = 'local',
    privacyMode = 'smart_fallback',
    allowCloudFallback = true,
    localConfig = {},
  } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required for script enhancement.' });
  }

  // System instruction based on mode
  let systemGoal = '';
  switch (mode) {
    case 'audiobook_adaptation':
      systemGoal = `You are a world-class audiobook director and scriptwriter. 
Transform the following raw text into a compelling, immersive audiobook narration script.
- Ensure vivid auditory flow, natural sentence rhythm, and evocative descriptive cadences.
- Preserve all original story events, character quotes, and core ideas faithfully.
- Introduce natural phrasing suited for human speech, eliminating awkward parentheticals or visual-only citations.`;
      break;
    case 'expressive_cues':
      systemGoal = `You are an expert voice actor coach and audio dramatist.
Enhance the following text by embedding audio delivery cues and pacing marks directly into the script.
- Insert bracketed performance directions before key dialogue or dramatic turns, e.g.: [whisper], [intense pause], [softly, with longing], [building excitement], [deliberate slow cadence].
- Format pauses naturally using ellipses (...) or explicit [pause: 1s] tags.
- Keep the actual spoken words identical or smoothly polished for speech.`;
      break;
    case 'radio_theater':
      systemGoal = `You are a classic radio drama producer.
Convert the text into an engaging, episodic audio drama narration script.
- Include a cinematic opening narration hook and closing reflective thought.
- Clearly annotate character dialogue with [SPEAKER: Character Name] and [SFX: Sound Effect Cue] where appropriate to inspire the listener's imagination.`;
      break;
    case 'condensed_summary':
      systemGoal = `You are an executive audiobook summary narrator.
Synthesize and distill the provided text into a high-impact, captivating audio summary.
- Focus on key concepts, narrative arcs, and memorable takeaways.
- Write in a direct, engaging spoken voice that flows effortlessly.`;
      break;
    default:
      systemGoal = `Polish and format the following text for natural audiobook narration with engaging emotional depth.`;
  }

  const prompt = `System Guidance:
${systemGoal}
Narrator Persona: ${narratorPersona}
Target Emotional Cadence: ${emotion}

Original Text:
"""
${text.slice(0, 15000)}
"""

Provide the completed narration script now. Do not include markdown code block backticks or conversational preamble. Return only the script.`;

  // 1. Try Local LLM first if requested or if local endpoint is configured
  const shouldTryLocal = (modelSource === 'local' || localConfig.enabled) && localConfig.endpoint;
  let localFailedError: string | null = null;

  if (shouldTryLocal) {
    try {
      const endpoint = (localConfig.endpoint || 'http://localhost:11434').replace(/\/+$/, '');
      const provider = localConfig.provider || 'ollama';
      const model = localConfig.model || 'llama3.2';

      if (provider === 'ollama') {
        const localRes = await fetch(`${endpoint}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt,
            stream: false,
          }),
          signal: AbortSignal.timeout(45000),
        });

        if (!localRes.ok) {
          throw new Error(`Local Ollama returned HTTP ${localRes.status}`);
        }
        const data = await localRes.json();
        return res.json({
          script: data.response || '',
          source: `Local Ollama (${model})`,
          isLocal: true,
          privacyLevel: '100% On-Device',
        });
      } else {
        // OpenAI compatible (LM Studio / vLLM)
        const chatUrl = endpoint.endsWith('/v1')
          ? `${endpoint}/chat/completions`
          : `${endpoint}/v1/chat/completions`;
        const localRes = await fetch(chatUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemGoal },
              { role: 'user', content: prompt },
            ],
            temperature: 0.7,
          }),
          signal: AbortSignal.timeout(45000),
        });

        if (!localRes.ok) {
          throw new Error(`Local server returned HTTP ${localRes.status}`);
        }
        const data = await localRes.json();
        const script = data.choices?.[0]?.message?.content || '';
        return res.json({
          script,
          source: `Local LM Studio (${model})`,
          isLocal: true,
          privacyLevel: '100% On-Device',
        });
      }
    } catch (localErr: any) {
      localFailedError = localErr.message || 'Local LLM offline';
      console.warn('Local LLM call failed:', localFailedError);
      
      // If Strict Local privacy mode is active, do not contact cloud!
      if (privacyMode === 'strict_local' || allowCloudFallback === false) {
        return res.status(503).json({
          error: `Strict Local Privacy Mode is active. Local LLM request failed: ${localFailedError}. No cloud fallback will be attempted to guarantee privacy.`,
          isLocal: true,
        });
      }
    }
  }

  // 2. Cloud Fallback via Gemini (when no local model is available or when local failed)
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(500).json({
      error: localFailedError
        ? `Local LLM failed (${localFailedError}) and no GEMINI_API_KEY is configured for cloud fallback.`
        : 'GEMINI_API_KEY is not configured and no local LLM is running.',
      fallbackAvailable: false,
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    const script = response.text?.trim() || '';
    return res.json({
      script,
      source: localFailedError ? 'Cloud Gemini Flash (Local LLM Offline Fallback)' : 'Cloud Gemini 2.5 Flash',
      isLocal: false,
      fallbackUsed: !!localFailedError,
      fallbackReason: localFailedError ? `Local model at ${localConfig.endpoint || 'localhost'} unreachable. Used Cloud Fallback.` : undefined,
    });
  } catch (error: any) {
    console.error('Gemini script generation error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate narration script via Cloud Gemini.',
    });
  }
});

// Text-to-Speech: Privacy-First with Cloud Gemini TTS Fallback
app.post('/api/tts/generate', async (req, res) => {
  const {
    text,
    voice = 'Puck',
    emotion = 'narrative',
    pacingPrompt = '',
    multiVoice,
    localTtsEndpoint,
    localTtsModel,
    localTtsModelType = 'fish_audio',
    temperature = 0.7,
    topP = 0.9,
    speed = 1.0,
    quantization = 'fp16',
    sampleRate = 32000,
    referenceAudioPrompt,
    privacyMode = 'smart_fallback',
    allowCloudFallback = true,
  } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required for TTS synthesis.' });
  }

  // 1. Try Local TTS Endpoint if configured (Chatterbox, Orpheus, Moss, Fish Audio, Piper)
  if (localTtsEndpoint) {
    try {
      const endpoint = localTtsEndpoint.replace(/\/+$/, '');
      const possibleEndpoints = [
        endpoint.endsWith('/v1') ? `${endpoint}/audio/speech` : `${endpoint}/v1/audio/speech`,
        `${endpoint}/v1/tts`,
        `${endpoint}/api/tts`,
        `${endpoint}/synthesize`,
        `${endpoint}/tts`,
      ];

      let localTtsRes: Response | null = null;

      for (const speechUrl of possibleEndpoints) {
        try {
          const res = await fetch(speechUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: localTtsModel || localTtsModelType || 'tts-1',
              input: text,
              text,
              voice: voice || 'alloy',
              response_format: 'wav',
              format: 'wav',
              temperature,
              top_p: topP,
              speed,
              sample_rate: sampleRate,
              reference_prompt: referenceAudioPrompt,
              quantization,
            }),
            signal: AbortSignal.timeout(35000),
          });

          if (res.ok) {
            localTtsRes = res;
            break;
          }
        } catch {
          // Try next endpoint pattern
        }
      }

      if (localTtsRes && localTtsRes.ok) {
        const contentType = localTtsRes.headers.get('content-type') || '';
        let audioBuffer: Buffer;
        let mime = 'audio/wav';

        if (contentType.includes('application/json')) {
          const json = await localTtsRes.json();
          let b64: string | undefined;
          let jsonMime: string | undefined;
          if (json.audioDataUrl) {
            b64 = json.audioDataUrl.split(',')[1];
            jsonMime = json.audioDataUrl.match(/^data:([^;]+)/)?.[1];
          } else if (json.audio_base64 || json.audio) {
            b64 = json.audio_base64 || json.audio;
          }
          if (!b64) {
            throw new Error('Unexpected JSON format from local TTS server');
          }
          audioBuffer = Buffer.from(b64, 'base64');
          mime = jsonMime || 'audio/wav';
        } else {
          const arrayBuf = await localTtsRes.arrayBuffer();
          audioBuffer = Buffer.from(arrayBuf);
          mime = contentType || 'audio/wav';
        }

        const modelDisplayNames: Record<string, string> = {
          chatterbox: 'Chatterbox TTS (Local)',
          orpheus: 'Orpheus Theatrical TTS (Local)',
          moss: 'Moss-Audio TTS (Local)',
          fish_audio: 'Fish Audio SOTA (Local)',
          piper: 'Piper / Kokoro TTS (Local)',
          custom: 'Custom Local TTS',
        };

        return sendAudio(res, audioBuffer, {
          mime,
          duration: Math.max(3, Math.round(text.split(/\s+/).length / (2.5 * speed))),
          source: `${modelDisplayNames[localTtsModelType] || 'Local TTS Engine'} [${quantization.toUpperCase()}]`,
          isLocal: true,
        });
      }
    } catch (locErr: any) {
      console.warn('Local TTS failed, assessing cloud fallback:', locErr.message);
      if (privacyMode === 'strict_local' || allowCloudFallback === false) {
        return res.status(503).json({
          success: false,
          error: `Strict Local Mode: Local TTS (${localTtsModelType}) at ${localTtsEndpoint} failed (${locErr.message}). Cloud fallback blocked to preserve privacy.`,
          fallbackAvailable: true, // can use browser offline SAPI
        });
      }
    }
  }

  // 2. Cloud / Hosted TTS fallback using Gemini (gemini-3.1-flash-tts-preview)
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(500).json({
      success: false,
      error: 'GEMINI_API_KEY is missing. You can switch to browser offline speech synthesis or configure your key in Secrets.',
      fallbackAvailable: true,
    });
  }

  try {
    // Construct emotional direction prompt for TTS model
    let directive = `Say in a natural, expressive ${emotion} audiobook narration style`;
    if (pacingPrompt) {
      directive += ` with ${pacingPrompt}`;
    }
    directive += `: ${text}`;

    const validVoice = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].includes(voice)
      ? voice
      : 'Puck';

    let speechConfigObj: any = {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: validVoice },
      },
    };

    if (multiVoice?.enabled) {
      const nVoice = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].includes(multiVoice.narratorVoice)
        ? multiVoice.narratorVoice
        : 'Kore';
      const dVoice = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].includes(multiVoice.dialogueVoice)
        ? multiVoice.dialogueVoice
        : 'Puck';

      // Format dialogues into speaker roles
      const formattedText = text.replace(/“([^”]+)”|"([^"]+)"/g, '\nDialogue: "$1$2"\nNarrator: ');
      directive = `Perform a full-cast dual-voice dramatic reading between Narrator and Dialogue characters with expressive emotional inflections:\nNarrator: ${formattedText}`;

      speechConfigObj = {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            { speaker: 'Narrator', voiceConfig: { prebuiltVoiceConfig: { voiceName: nVoice } } },
            { speaker: 'Dialogue', voiceConfig: { prebuiltVoiceConfig: { voiceName: dVoice } } },
          ],
        },
      };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [{ parts: [{ text: directive }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: speechConfigObj,
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new Error('No audio returned by speech synthesis model.');
    }

    // Convert PCM (24000Hz, 16bit mono) to standard WAV format
    const pcmBuffer = Buffer.from(base64Audio, 'base64');
    const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);

    // Calculate approximate duration in seconds (dataSize / byteRate)
    const durationSeconds = pcmBuffer.length / (24000 * 2);

    return sendAudio(res, wavBuffer, {
      mime: 'audio/wav',
      duration: durationSeconds,
      source: 'Cloud Hosted Gemini TTS',
      isLocal: false,
    });
  } catch (err: any) {
    console.warn('Gemini TTS error handled:', err?.message || err);
    const errStr = String(err?.message || err || '');
    const isQuotaOrDemand =
      err?.status === 429 ||
      err?.status === 503 ||
      errStr.includes('429') ||
      errStr.includes('503') ||
      errStr.includes('quota') ||
      errStr.includes('RESOURCE_EXHAUSTED') ||
      errStr.includes('demand');

    return res.json({
      success: false,
      quotaExceeded: isQuotaOrDemand,
      isHighDemand: err?.status === 503 || errStr.includes('503') || errStr.includes('demand'),
      error: isQuotaOrDemand
        ? 'Gemini Cloud TTS model is experiencing high demand (503) or rate limits (429). Falling back to Windows Offline Speech Engine.'
        : errStr || 'Error synthesizing audio via Cloud TTS.',
      fallbackAvailable: true,
    });
  }
});

// Acoustic Timbre Preview Generator (used as zero-latency resilient fallback when Gemini is busy or rate-limited)
function generateTimbrePreviewWav(voice: string, emotion: string): string {
  const sampleRate = 24000;
  const duration = 2.4;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = Buffer.alloc(numSamples * 2);

  const pitches: Record<string, number> = {
    Puck: 220,    // Tenor / lively
    Charon: 105,  // Deep baritone
    Kore: 195,    // Melodic alto
    Fenrir: 130,  // Rugged baritone
    Zephyr: 165,  // Soft resonant
  };
  const baseFreq = pitches[voice] || 180;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Smooth window envelope
    const env = Math.sin((Math.PI * i) / numSamples);
    // Formant harmonics
    const f0 = Math.sin(2 * Math.PI * baseFreq * t);
    const f1 = 0.45 * Math.sin(2 * Math.PI * (baseFreq * 2) * t);
    const f2 = 0.2 * Math.sin(2 * Math.PI * (baseFreq * 3) * t);
    // Syllabic speech-like modulation (~4.5 Hz)
    const rhythm = 0.7 + 0.3 * Math.sin(2 * Math.PI * 4.5 * t);

    const sample = Math.floor(env * rhythm * (f0 + f1 + f2) * 0.4 * 32767);
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), i * 2);
  }

  // Standard 44-byte WAV header
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + buffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // Mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(buffer.length, 40);

  const fullWav = Buffer.concat([header, buffer]);
  return `data:audio/wav;base64,${fullWav.toString('base64')}`;
}

// Fast In-Memory Cache for Voice Previews (bounded — evicts oldest first)
const MAX_PREVIEW_CACHE_ENTRIES = 40;
const previewCache = new Map<string, { buffer: Buffer; mime: string; duration: number; meta: Record<string, string> }>();

function cachePreview(key: string, buffer: Buffer, mime: string, duration: number, meta: Record<string, string> = {}) {
  previewCache.set(key, { buffer, mime, duration, meta });
  while (previewCache.size > MAX_PREVIEW_CACHE_ENTRIES) {
    const oldest = previewCache.keys().next().value;
    if (oldest === undefined) break;
    previewCache.delete(oldest);
  }
}

// Send raw audio bytes with metadata in X-Narrativ-* headers (avoids base64
// data URLs, which roughly double payload size and break on long audio).
function sendAudio(res: any, buffer: Buffer, meta: { mime: string; duration: number; source: string; isLocal: boolean; isFallback?: boolean; notice?: string }) {
  return res
    .set('Content-Type', meta.mime)
    .set('Content-Length', String(buffer.length))
    .set('X-Narrativ-Is-Local', String(meta.isLocal))
    .set('X-Narrativ-Fallback', String(!!meta.isFallback))
    .set('X-Narrativ-Source', meta.source)
    .set('X-Narrativ-Duration', String(meta.duration))
    .set('X-Narrativ-Notice', meta.notice || '')
    .send(buffer);
}

// Voice Preview endpoint
app.post('/api/tts/preview', async (req, res) => {
  const { voice = 'Puck', emotion = 'narrative' } = req.body;
  const validVoice = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].includes(voice)
    ? voice
    : 'Puck';

  const cacheKey = `${validVoice}_${emotion}`;
  if (previewCache.has(cacheKey)) {
    const cached = previewCache.get(cacheKey)!;
    return sendAudio(res, cached.buffer, {
      mime: cached.mime,
      duration: cached.duration,
      source: `Cached Gemini Preview (${validVoice})`,
      isLocal: false,
      isFallback: cached.meta.isFallback === 'true',
      notice: cached.meta.notice,
    });
  }

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

  const sampleText = sampleTexts[emotion] || sampleTexts.narrative;
  const directive = `Say in a natural, expressive ${emotion} audiobook narration style: ${sampleText}`;

  const ai = getGeminiClient();
  if (!ai) {
    const fallbackWav = generateTimbrePreviewWav(validVoice, emotion);
    const buffer = Buffer.from(fallbackWav.split(',')[1] || '', 'base64');
    const mime = (fallbackWav.match(/^data:([^;]+)/)?.[1]) || 'audio/wav';
    cachePreview(cacheKey, buffer, mime, 2.4, { isFallback: 'true', notice: 'API key not configured; played acoustic timbre preview.' });
    return sendAudio(res, buffer, {
      mime,
      duration: 2.4,
      source: 'Acoustic Timbre Preview (No API Key)',
      isLocal: true,
      isFallback: true,
      notice: 'API key not configured; played acoustic timbre preview.',
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [{ parts: [{ text: directive }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: validVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('No audio returned by speech synthesis preview.');
    }

    const pcmBuffer = Buffer.from(base64Audio, 'base64');
    const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);
    const durationSeconds = pcmBuffer.length / (24000 * 2);

    cachePreview(cacheKey, wavBuffer, 'audio/wav', durationSeconds, {});

    return sendAudio(res, wavBuffer, {
      mime: 'audio/wav',
      duration: durationSeconds,
      source: `Gemini TTS Preview (${validVoice})`,
      isLocal: false,
    });
  } catch (err: any) {
    console.warn('Gemini preview error, serving resilient fallback timbre:', err?.message || err);
    const errStr = String(err?.message || err || '');
    const isQuotaOrDemand =
      err?.status === 429 ||
      err?.status === 503 ||
      errStr.includes('429') ||
      errStr.includes('503') ||
      errStr.includes('quota') ||
      errStr.includes('RESOURCE_EXHAUSTED') ||
      errStr.includes('demand');

    // Never fail: return generated acoustic vocal timbre preview
    const fallbackWav = generateTimbrePreviewWav(validVoice, emotion);
    const buffer = Buffer.from(fallbackWav.split(',')[1] || '', 'base64');
    const mime = (fallbackWav.match(/^data:([^;]+)/)?.[1]) || 'audio/wav';
    const notice = isQuotaOrDemand
      ? 'Gemini TTS model is currently experiencing high demand (503) or free-tier rate limits (429). Local acoustic timbre preview served.'
      : 'Local acoustic preview served.';
    cachePreview(cacheKey, buffer, mime, 2.4, { isFallback: 'true', notice });

    return sendAudio(res, buffer, {
      mime,
      duration: 2.4,
      source: 'Acoustic Timbre Preview (Fallback)',
      isLocal: true,
      isFallback: true,
      notice,
    });
  }
});

// Setup Vite middleware for local development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Narrativ server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
