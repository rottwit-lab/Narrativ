import { GpuHardwareProfile, GpuHardwareTier, ModelQuantization, LocalTtsModelId, LocalTtsConfigItem } from '../types';

/**
 * Detect client GPU via WebGL & WebGPU, parse hardware specs, and determine optimal VRAM tier.
 */
export function detectGpuHardware(): GpuHardwareProfile {
  let renderer = 'Unknown Graphics Adapter';
  let vendor = 'Unknown Vendor';

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl && 'getExtension' in gl) {
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || renderer;
        vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || vendor;
      }
    }
  } catch (e) {
    console.warn('WebGL GPU detection error:', e);
  }

  const rLower = renderer.toLowerCase();
  const vLower = vendor.toLowerCase();

  const isNvidiaCuda = rLower.includes('nvidia') || rLower.includes('geforce') || rLower.includes('quadro') || rLower.includes('tesla') || rLower.includes('rtx') || rLower.includes('gtx');
  const isAppleSilicon = rLower.includes('apple') || vLower.includes('apple') || rLower.includes('metal') || (navigator.platform?.includes('Mac') && !rLower.includes('intel'));
  const isAmdRocm = rLower.includes('radeon') || rLower.includes('amd') || vLower.includes('amd');

  // Estimate VRAM Tier based on recognized GPU model numbers
  let vramTier: GpuHardwareTier = 'tier_b_medium';
  let estimatedVramGb = 8;
  let recommendedQuantization: ModelQuantization = 'int8';
  let architectureHint = 'Desktop GPU';

  // Tier S: 16GB - 24GB+ (Ultra VRAM)
  if (
    rLower.includes('4090') || 
    rLower.includes('3090') || 
    rLower.includes('4080') || 
    rLower.includes('7900') || 
    rLower.includes('a100') || 
    rLower.includes('h100') || 
    rLower.includes('a6000') ||
    rLower.includes('m2 max') ||
    rLower.includes('m3 max') ||
    rLower.includes('m4 max') ||
    rLower.includes('m1 ultra') ||
    rLower.includes('m2 ultra') ||
    rLower.includes('m3 ultra')
  ) {
    vramTier = 'tier_s_ultra';
    estimatedVramGb = rLower.includes('4090') || rLower.includes('3090') ? 24 : 16;
    recommendedQuantization = 'fp16';
    architectureHint = 'Flagship Enthusiast / Workstation GPU (16GB-24GB VRAM)';
  } 
  // Tier A: 10GB - 12GB (High VRAM)
  else if (
    rLower.includes('4070') || 
    rLower.includes('3080') || 
    (rLower.includes('3060') && !rLower.includes('laptop')) || // Desktop 3060 is famously 12GB
    rLower.includes('6800') || 
    rLower.includes('7800') || 
    rLower.includes('a770') ||
    rLower.includes('m1 pro') ||
    rLower.includes('m2 pro') ||
    rLower.includes('m3 pro') ||
    rLower.includes('m4 pro')
  ) {
    vramTier = 'tier_a_high';
    estimatedVramGb = 12;
    recommendedQuantization = 'fp16';
    architectureHint = 'High Performance GPU (10GB-12GB VRAM)';
  }
  // Tier C: < 4GB or Integrated / CPU
  else if (
    rLower.includes('iris') ||
    rLower.includes('uhd') ||
    rLower.includes('intel') ||
    rLower.includes('basic render') ||
    rLower.includes('swiftshader') ||
    rLower.includes('llvmpipe') ||
    rLower.includes('1650') ||
    rLower.includes('1050') ||
    rLower.includes('gt 1030') ||
    rLower.includes('radeon graphics') // Integrated AMD
  ) {
    vramTier = 'tier_c_budget';
    estimatedVramGb = 2;
    recommendedQuantization = 'int4';
    architectureHint = 'Integrated Graphics or Low VRAM (<4GB)';
  } 
  // Tier B: Standard 6GB - 8GB VRAM (Default for RTX 3070, 4060, 2060, 2070, 1070, 1080)
  else {
    vramTier = 'tier_b_medium';
    estimatedVramGb = 8;
    recommendedQuantization = 'int8';
    architectureHint = 'Standard Mid-Range GPU (6GB-8GB VRAM)';
  }

  // Clean up display summary
  let cleanName = renderer.replace(/ANGLE \(/i, '').replace(/\)/g, '').trim();
  if (cleanName.includes(',')) {
    cleanName = cleanName.split(',')[0].trim();
  }

  const summary = `${cleanName} (~${estimatedVramGb}GB VRAM)`;

  return {
    renderer: cleanName,
    vendor,
    vramTier,
    estimatedVramGb,
    recommendedQuantization,
    isNvidiaCuda,
    isAppleSilicon,
    isAmdRocm,
    summary,
    architectureHint,
  };
}

export const DEFAULT_TTS_CONFIGS: Record<LocalTtsModelId, LocalTtsConfigItem> = {
  chatterbox: {
    id: 'chatterbox',
    name: 'Chatterbox TTS',
    tagline: 'High-speed conversational & audiobook engine with natural cadence and low latency.',
    defaultPort: 8004,
    endpoint: 'http://localhost:8004',
    quantization: 'fp16',
    temperature: 0.65,
    topP: 0.85,
    speed: 1.0,
    repetitionPenalty: 1.1,
    sampleRate: 24000,
    streaming: true,
    isConnected: false,
  },
  orpheus: {
    id: 'orpheus',
    name: 'Orpheus TTS',
    tagline: 'Theatrical voice synthesis specialized for dramatic pacing, breath cues, and rich timbre.',
    defaultPort: 7860,
    endpoint: 'http://localhost:7860',
    quantization: 'fp16',
    temperature: 0.72,
    topP: 0.9,
    speed: 0.96,
    repetitionPenalty: 1.15,
    sampleRate: 32000,
    streaming: false,
    isConnected: false,
  },
  moss: {
    id: 'moss',
    name: 'Moss TTS (Moss-Audio)',
    tagline: 'Expressive multi-accent storytelling with deep emotional range and zero-shot voice matching.',
    defaultPort: 9880,
    endpoint: 'http://localhost:9880',
    quantization: 'fp16',
    temperature: 0.7,
    topP: 0.88,
    speed: 1.0,
    repetitionPenalty: 1.2,
    sampleRate: 32000,
    streaming: true,
    isConnected: false,
  },
  fish_audio: {
    id: 'fish_audio',
    name: 'Fish Audio (Fish Speech)',
    tagline: 'SOTA autoregressive neural TTS with VQ-GAN codec for studio-grade voice cloning.',
    defaultPort: 8080,
    endpoint: 'http://localhost:8080',
    quantization: 'fp16',
    temperature: 0.75,
    topP: 0.92,
    speed: 1.0,
    repetitionPenalty: 1.15,
    sampleRate: 44100,
    streaming: true,
    isConnected: false,
  },
  piper: {
    id: 'piper',
    name: 'Piper / Kokoro TTS',
    tagline: 'Lightweight, ultra-fast on-device neural synthesizer designed for low CPU/VRAM usage.',
    defaultPort: 8880,
    endpoint: 'http://localhost:8880',
    quantization: 'int8',
    temperature: 0.6,
    topP: 0.8,
    speed: 1.0,
    repetitionPenalty: 1.0,
    sampleRate: 24000,
    streaming: false,
    isConnected: false,
  },
  custom: {
    id: 'custom',
    name: 'Custom OpenAI-Compatible TTS',
    tagline: 'Any local server exposing /v1/audio/speech or standard HTTP audio endpoints.',
    defaultPort: 5000,
    endpoint: 'http://localhost:5000',
    quantization: 'fp16',
    temperature: 0.7,
    topP: 0.85,
    speed: 1.0,
    repetitionPenalty: 1.0,
    sampleRate: 24000,
    streaming: false,
    isConnected: false,
  },
};

/**
 * Returns model-specific parameter recommendations tuned for the user's specific GPU tier.
 */
export function getRecommendedModelSettings(
  modelId: LocalTtsModelId,
  gpu: GpuHardwareProfile
): {
  recommendedQuantization: ModelQuantization;
  batchSize: number;
  sampleRate: 24000 | 32000 | 44100 | 48000;
  vramAdvice: string;
  commandFlag: string;
} {
  switch (gpu.vramTier) {
    case 'tier_s_ultra': // 16GB-24GB VRAM
      return {
        recommendedQuantization: 'fp16',
        batchSize: 4,
        sampleRate: modelId === 'fish_audio' ? 44100 : 32000,
        vramAdvice: `High VRAM Detected (${gpu.estimatedVramGb}GB). Run unquantized FP16 with FlashAttention for studio master fidelity without stuttering.`,
        commandFlag: '--precision fp16 --cuda --flash-attn --batch-size 4',
      };
    case 'tier_a_high': // 10GB-12GB VRAM
      return {
        recommendedQuantization: 'fp16',
        batchSize: 2,
        sampleRate: 32000,
        vramAdvice: `Ample VRAM (${gpu.estimatedVramGb}GB). FP16 precision will run with high throughput. Perfect for multi-chapter audiobook generation.`,
        commandFlag: '--precision fp16 --cuda --batch-size 2',
      };
    case 'tier_b_medium': // 6GB-8GB VRAM
      return {
        recommendedQuantization: 'int8',
        batchSize: 1,
        sampleRate: 24000,
        vramAdvice: `Mid-tier VRAM (${gpu.estimatedVramGb}GB). 8-bit quantization (INT8) is recommended to prevent CUDA Out-of-Memory during dramatic chapters.`,
        commandFlag: '--quantization int8 --cuda --batch-size 1',
      };
    case 'tier_c_budget': // <4GB or CPU
    default:
      return {
        recommendedQuantization: 'int4',
        batchSize: 1,
        sampleRate: 24000,
        vramAdvice: `Limited VRAM (<4GB) or Integrated Graphics. Recommended: 4-bit quantized (AWQ/GGUF) or ONNX CPU acceleration mode.`,
        commandFlag: '--quantization int4 --device cpu --low-vram',
      };
  }
}

/**
 * Generate complete, copyable installation scripts (PowerShell, Batch, Docker, Conda/Pip)
 * tailored to the selected model, detected GPU, and parameter options.
 */
export function generateInstallerScripts(
  modelId: LocalTtsModelId,
  config: LocalTtsConfigItem,
  gpu: GpuHardwareProfile
) {
  const rec = getRecommendedModelSettings(modelId, gpu);
  const port = config.defaultPort;
  const quant = config.quantization;

  // 1. Chatterbox TTS
  if (modelId === 'chatterbox') {
    const ps1 = `# ========================================================
# Narrativ Studio - Chatterbox TTS Windows Installer
# Hardware Detected: ${gpu.renderer} (~${gpu.estimatedVramGb}GB VRAM)
# Quantization: ${quant.toUpperCase()} | Port: ${port}
# ========================================================
Write-Host "Installing Chatterbox TTS with GPU acceleration..." -ForegroundColor Cyan

# 1. Create directory and virtual environment
mkdir -p "$HOME\\narrativ_models\\chatterbox"
cd "$HOME\\narrativ_models\\chatterbox"
python -m venv venv
.\\venv\\Scripts\\Activate.ps1

# 2. Install PyTorch with CUDA support
${gpu.isNvidiaCuda ? 'pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121' : 'pip install torch torchvision torchaudio'}

# 3. Install Chatterbox TTS & Audio dependencies
pip install chatterbox-tts fastapi uvicorn soundfile numpy ${quant === 'int8' ? 'bitsandbytes' : ''}

# 4. Start Chatterbox API Server on port ${port}
Write-Host "Starting Chatterbox TTS server at http://localhost:${port} ..." -ForegroundColor Green
python -m chatterbox.server --port ${port} --host 0.0.0.0 ${rec.commandFlag}
`;

    const bat = `@echo off
REM ========================================================
REM Narrativ Studio - Chatterbox Launcher (.bat)
REM ========================================================
title Chatterbox TTS Server (Port ${port})
echo Starting Chatterbox TTS on port ${port}...
cd /d "%USERPROFILE%\\narrativ_models\\chatterbox"
call venv\\Scripts\\activate.bat
python -m chatterbox.server --port ${port} --host 0.0.0.0 ${rec.commandFlag}
pause
`;

    const docker = `docker run -d --name chatterbox-tts ${gpu.isNvidiaCuda ? '--gpus all' : ''} -p ${port}:${port} -e QUANTIZATION=${quant} chatterbox/tts:latest --port ${port}`;

    const pip = `pip install chatterbox-tts && python -m chatterbox.server --port ${port} ${rec.commandFlag}`;

    return { ps1, bat, docker, pip };
  }

  // 2. Orpheus TTS
  if (modelId === 'orpheus') {
    const ps1 = `# ========================================================
# Narrativ Studio - Orpheus TTS (Theatrical Prosody)
# Hardware Detected: ${gpu.renderer} (~${gpu.estimatedVramGb}GB VRAM)
# Quantization: ${quant.toUpperCase()} | Port: ${port}
# ========================================================
Write-Host "Setting up Orpheus Theatrical TTS for Narrativ..." -ForegroundColor Cyan

mkdir -p "$HOME\\narrativ_models\\orpheus-tts"
cd "$HOME\\narrativ_models\\orpheus-tts"
python -m venv venv
.\\venv\\Scripts\\Activate.ps1

${gpu.isNvidiaCuda ? 'pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121' : 'pip install torch torchaudio'}
pip install orpheus-tts transformers accelerate sentencepiece uvicorn fastapi soundfile
${quant === 'int8' || quant === 'int4' ? 'pip install bitsandbytes' : ''}

Write-Host "Launching Orpheus TTS Engine on port ${port}..." -ForegroundColor Green
python -m orpheus_tts.api --port ${port} --host 0.0.0.0 --precision ${quant} ${gpu.isNvidiaCuda ? '--device cuda:0' : '--device cpu'}
`;

    const bat = `@echo off
REM Orpheus TTS Launcher
title Orpheus Theatrical TTS (Port ${port})
cd /d "%USERPROFILE%\\narrativ_models\\orpheus-tts"
call venv\\Scripts\\activate.bat
python -m orpheus_tts.api --port ${port} --host 0.0.0.0 --precision ${quant}
pause
`;

    const docker = `docker run -d --name orpheus-tts ${gpu.isNvidiaCuda ? '--gpus all' : ''} -p ${port}:${port} orpheus/tts:latest --port ${port} --precision ${quant}`;

    const pip = `git clone https://github.com/orpheus-speech/orpheus-tts && cd orpheus-tts && pip install -r requirements.txt && python api.py --port ${port}`;

    return { ps1, bat, docker, pip };
  }

  // 3. Moss TTS (Moss-Audio)
  if (modelId === 'moss') {
    const ps1 = `# ========================================================
# Narrativ Studio - Moss TTS (Moss-Audio) Installer
# Hardware Detected: ${gpu.renderer} (~${gpu.estimatedVramGb}GB VRAM)
# Quantization: ${quant.toUpperCase()} | Port: ${port}
# ========================================================
Write-Host "Installing Moss-Audio / CosyVoice TTS..." -ForegroundColor Cyan

mkdir -p "$HOME\\narrativ_models\\moss-audio"
cd "$HOME\\narrativ_models\\moss-audio"
python -m venv venv
.\\venv\\Scripts\\Activate.ps1

${gpu.isNvidiaCuda ? 'pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121' : 'pip install torch torchaudio'}
pip install git+https://github.com/OpenMoss/Moss-Audio.git
pip install fastapi uvicorn soundfile sox gradio

Write-Host "Starting Moss Audio server on port ${port}..." -ForegroundColor Green
python -m moss_audio.api --port ${port} --host 0.0.0.0 ${rec.commandFlag}
`;

    const bat = `@echo off
title Moss Audio TTS (Port ${port})
cd /d "%USERPROFILE%\\narrativ_models\\moss-audio"
call venv\\Scripts\\activate.bat
python -m moss_audio.api --port ${port} --host 0.0.0.0 ${rec.commandFlag}
pause
`;

    const docker = `docker run -d --name moss-audio ${gpu.isNvidiaCuda ? '--gpus all' : ''} -p ${port}:${port} openmoss/audio:latest --port ${port}`;

    const pip = `pip install moss-audio && python -m moss_audio.api --port ${port} ${rec.commandFlag}`;

    return { ps1, bat, docker, pip };
  }

  // 4. Fish Audio (Fish Speech)
  if (modelId === 'fish_audio') {
    const ps1 = `# ========================================================
# Narrativ Studio - Fish Audio (Fish Speech) Installer
# Hardware Detected: ${gpu.renderer} (~${gpu.estimatedVramGb}GB VRAM)
# Quantization: ${quant.toUpperCase()} | Port: ${port}
# ========================================================
Write-Host "Installing Fish Speech SOTA Voice Cloning & TTS..." -ForegroundColor Cyan

mkdir -p "$HOME\\narrativ_models\\fish-speech"
cd "$HOME\\narrativ_models\\fish-speech"
git clone https://github.com/fishaudio/fish-speech.git .
python -m venv venv
.\\venv\\Scripts\\Activate.ps1

# Install PyTorch with CUDA acceleration
${gpu.isNvidiaCuda ? 'pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121' : 'pip install torch torchvision torchaudio'}

# Install Fish Speech requirements
pip install -e .
pip install huggingface_hub

Write-Host "Downloading Fish Speech v1.5 pretrained weights..." -ForegroundColor Yellow
huggingface-cli download fishaudio/fish-speech-1.5 --local-dir checkpoints/fish-speech-1.5

Write-Host "Starting Fish Audio HTTP API on http://localhost:${port}..." -ForegroundColor Green
python -m tools.api_server --listen 0.0.0.0:${port} --llama-checkpoint-path checkpoints/fish-speech-1.5 --decoder-checkpoint-path checkpoints/fish-speech-1.5/vqgan ${quant === 'int8' ? '--half' : ''}
`;

    const bat = `@echo off
title Fish Speech Audio Server (Port ${port})
echo Starting Fish Audio API on port ${port}...
cd /d "%USERPROFILE%\\narrativ_models\\fish-speech"
call venv\\Scripts\\activate.bat
python -m tools.api_server --listen 0.0.0.0:${port} --llama-checkpoint-path checkpoints/fish-speech-1.5
pause
`;

    const docker = `docker run -d --name fish-speech ${gpu.isNvidiaCuda ? '--gpus all' : ''} -p ${port}:${port} -v %USERPROFILE%/.cache/huggingface:/root/.cache/huggingface fishaudio/fish-speech:latest python -m tools.api_server --listen 0.0.0.0:${port}`;

    const pip = `git clone https://github.com/fishaudio/fish-speech && cd fish-speech && pip install -e . && python -m tools.api_server --listen 0.0.0.0:${port}`;

    return { ps1, bat, docker, pip };
  }

  // Fallback for Piper / Custom
  return {
    ps1: `# Launch custom TTS server on port ${port}\npython -m server --port ${port}`,
    bat: `@echo off\npython -m server --port ${port}\npause`,
    docker: `docker run -d -p ${port}:${port} my-local-tts:latest`,
    pip: `python -m server --port ${port}`,
  };
}

// ===========================================================================
// Full System Hardware Profile → Engine Requirements → Compatibility Score →
// Recommendation pipeline.
// Browsers expose limited hardware info (WebGL renderer string, CPU core
// count, approximate RAM). GPU VRAM is estimated from the detected model
// name since no web API can read true VRAM — the estimate feeds the scoring
// below as a documented approximation, not a measurement.
// ===========================================================================

export interface SystemHardwareProfile {
  gpu: GpuHardwareProfile;
  cpu: {
    cores: number;
    summary: string;
  };
  memory: {
    deviceMemoryGb: number | null; // navigator.deviceMemory (Chrome, approximate, capped at 8)
    summary: string;
  };
  platform: {
    os: string;
    isMobileLike: boolean;
    summary: string;
  };
  capturedAt: number;
}

/** Detect a full per-component hardware profile from the browser. */
export function detectSystemHardwareProfile(): SystemHardwareProfile {
  const gpu = detectGpuHardware();

  const cores = navigator.hardwareConcurrency || 4;
  const deviceMemoryGb = (navigator as any).deviceMemory ?? null;

  let os = 'Unknown OS';
  const ua = navigator.userAgent;
  if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
  else if (/Windows/.test(ua)) os = 'Windows (older)';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Linux/.test(ua)) os = 'Linux';

  const isMobileLike = /Android|iPhone|iPad|Mobile/i.test(ua);

  return {
    gpu,
    cpu: {
      cores,
      summary: `${cores} logical core${cores === 1 ? '' : 's'}`,
    },
    memory: {
      deviceMemoryGb,
      summary: deviceMemoryGb ? `~${deviceMemoryGb}GB (browser-reported, conservative)` : 'Not exposed by this browser',
    },
    platform: {
      os,
      isMobileLike,
      summary: `${os}${isMobileLike ? ' (mobile-class)' : ''}`,
    },
    capturedAt: Date.now(),
  };
}

/** What an engine needs to run acceptably on this machine. */
export interface EngineRequirement {
  engineId: LocalTtsModelId;
  minVramGb: number;        // below this: will not run
  recommendedVramGb: number; // at/above: comfortable, full precision
  minCpuCores: number;
  cudaRequired: boolean;    // NVIDIA CUDA strictly required
  appleSiliconOk: boolean;  // runs well on Apple Silicon unified memory
  cpuOnlyOk: boolean;       // has a usable CPU inference path
  notes: string;
}

export const ENGINE_REQUIREMENTS: Record<LocalTtsModelId, EngineRequirement> = {
  fish_audio: {
    engineId: 'fish_audio',
    minVramGb: 6,
    recommendedVramGb: 12,
    minCpuCores: 4,
    cudaRequired: false,
    appleSiliconOk: true,
    cpuOnlyOk: false,
    notes: 'VQ-GAN autoregressive codec; benefits greatly from VRAM headroom.',
  },
  orpheus: {
    engineId: 'orpheus',
    minVramGb: 8,
    recommendedVramGb: 16,
    minCpuCores: 4,
    cudaRequired: false,
    appleSiliconOk: true,
    cpuOnlyOk: false,
    notes: '3B-parameter theatrical prosody model; heavy footprint.',
  },
  moss: {
    engineId: 'moss',
    minVramGb: 10,
    recommendedVramGb: 16,
    minCpuCores: 6,
    cudaRequired: false,
    appleSiliconOk: true,
    cpuOnlyOk: false,
    notes: 'Expressive multi-acent model with zero-shot matching; largest demand.',
  },
  chatterbox: {
    engineId: 'chatterbox',
    minVramGb: 4,
    recommendedVramGb: 8,
    minCpuCores: 2,
    cudaRequired: false,
    appleSiliconOk: true,
    cpuOnlyOk: false,
    notes: 'Fast conversational engine; efficient, good mid-range choice.',
  },
  piper: {
    engineId: 'piper',
    minVramGb: 0,
    recommendedVramGb: 0,
    minCpuCores: 2,
    cudaRequired: false,
    appleSiliconOk: true,
    cpuOnlyOk: true,
    notes: 'Lightweight neural synthesizer built for CPU inference.',
  },
  custom: {
    engineId: 'custom',
    minVramGb: 4,
    recommendedVramGb: 8,
    minCpuCores: 2,
    cudaRequired: false,
    appleSiliconOk: true,
    cpuOnlyOk: false,
    notes: 'Depends entirely on the server you point Narrativ at.',
  },
};

export type EngineVerdict = 'ideal' | 'capable' | 'marginal' | 'insufficient';

export interface EngineCompatibility {
  engineId: LocalTtsModelId;
  score: number; // 0-100
  verdict: EngineVerdict;
  recommendedQuantization: ModelQuantization;
  reasons: string[]; // human-readable scoring breakdown
}

/** Score one engine against a full system hardware profile (0-100). */
export function scoreEngineCompatibility(
  profile: SystemHardwareProfile,
  req: EngineRequirement
): EngineCompatibility {
  const reasons: string[] = [];
  let score = 0;

  const vram = profile.gpu.estimatedVramGb;
  const isApple = profile.gpu.isAppleSilicon;
  const isCuda = profile.gpu.isNvidiaCuda;
  const isIntegrated = profile.gpu.vramTier === 'tier_c_budget';

  // 1. GPU / VRAM capacity (max 50)
  if (req.cpuOnlyOk) {
    score += 50;
    reasons.push('Runs entirely on CPU — no VRAM dependency (+50)');
  } else if (vram >= req.recommendedVramGb) {
    score += 50;
    reasons.push(`VRAM ${vram}GB ≥ recommended ${req.recommendedVramGb}GB — full precision comfortable (+50)`);
  } else if (vram >= req.minVramGb) {
    const ratio = (vram - req.minVramGb) / Math.max(1, req.recommendedVramGb - req.minVramGb);
    score += Math.round(25 + 20 * ratio);
    reasons.push(`VRAM ${vram}GB meets minimum ${req.minVramGb}GB but below recommended ${req.recommendedVramGb}GB (+${Math.round(25 + 20 * ratio)})`);
  } else if (isApple && req.appleSiliconOk) {
    // Apple unified memory can exceed the discrete-GPU estimate
    const unifiedBonus = profile.memory.deviceMemoryGb ? Math.min(20, profile.memory.deviceMemoryGb) : 15;
    score += Math.min(30, unifiedBonus);
    reasons.push(`Apple Silicon unified memory can substitute for low discrete VRAM estimate (+${Math.min(30, unifiedBonus)})`);
  } else {
    reasons.push(`Insufficient VRAM: ${vram}GB < minimum ${req.minVramGb}GB (+0)`);
  }

  // 2. Accelerator fit (max 25)
  if (isCuda) {
    score += 25;
    reasons.push('NVIDIA CUDA available — fastest inference path (+25)');
  } else if (isApple && req.appleSiliconOk) {
    score += 20;
    reasons.push('Apple Silicon MPS acceleration (+20)');
  } else if (req.cpuOnlyOk) {
    score += 18;
    reasons.push('No GPU needed for this engine (+18)');
  } else if (isIntegrated) {
    reasons.push('Integrated/low-end GPU — expect slow or unusable inference (+0)');
  } else {
    score += 8;
    reasons.push('Non-CUDA discrete GPU (ROCm/other) — partial support only (+8)');
  }

  // 3. CPU cores (max 15)
  const coreScore = Math.min(15, Math.round((profile.cpu.cores / Math.max(1, req.minCpuCores)) * 7.5));
  score += coreScore;
  if (profile.cpu.cores >= req.minCpuCores) {
    reasons.push(`${profile.cpu.cores} cores ≥ ${req.minCpuCores} required (+${coreScore})`);
  } else {
    reasons.push(`CPU may bottleneck: ${profile.cpu.cores} cores < ${req.minCpuCores} (+${coreScore})`);
  }

  // 4. System memory headroom (max 10)
  const memGb = profile.memory.deviceMemoryGb;
  if (memGb && memGb >= 8) {
    score += 10;
    reasons.push(`~${memGb}GB system RAM available (+10)`);
  } else if (memGb) {
    score += 5;
    reasons.push(`~${memGb}GB system RAM — tight for model loading (+5)`);
  } else {
    score += 5;
    reasons.push('System RAM not reported by browser (+5 assumed)');
  }

  if (profile.platform.isMobileLike) {
    score = Math.min(score, 15);
    reasons.push('Mobile-class device — local model hosting not practical (capped)');
  }

  // Quantization advice & verdict
  let recommendedQuantization: ModelQuantization = profile.gpu.recommendedQuantization;
  if (req.cpuOnlyOk) {
    recommendedQuantization = 'cpu_onnx';
  } else if (!req.cpuOnlyOk && vram >= req.recommendedVramGb) {
    recommendedQuantization = 'fp16';
  } else if (vram >= req.minVramGb) {
    recommendedQuantization = 'int8';
  } else {
    recommendedQuantization = 'int4';
  }

  let verdict: EngineVerdict;
  if (score >= 85) verdict = 'ideal';
  else if (score >= 65) verdict = 'capable';
  else if (score >= 45) verdict = 'marginal';
  else verdict = 'insufficient';

  return { engineId: req.engineId, score: Math.max(0, Math.min(100, score)), verdict, recommendedQuantization, reasons };
}

/** Rank all local engines by compatibility for this machine (best first). */
export function rankEngineRecommendations(profile: SystemHardwareProfile): EngineCompatibility[] {
  return (Object.keys(ENGINE_REQUIREMENTS) as LocalTtsModelId[])
    .map((id) => scoreEngineCompatibility(profile, ENGINE_REQUIREMENTS[id]))
    .sort((a, b) => b.score - a.score);
}
