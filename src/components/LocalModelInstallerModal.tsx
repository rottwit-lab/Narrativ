import React, { useState, useEffect } from 'react';
import {
  X,
  Cpu,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Terminal,
  ExternalLink,
  Sliders,
  Sparkles,
  Zap,
  ShieldCheck,
  Shield,
  Volume2,
  Play,
  Square,
  Download,
  Copy,
  Layers,
  HardDrive,
  Radio,
  FileCode,
  Info
} from 'lucide-react';
import { 
  LocalTtsModelId, 
  ModelQuantization, 
  GpuHardwareProfile, 
  LocalTtsConfigItem, 
  LocalLLMConfig 
} from '../types';
import { 
  detectGpuHardware, 
  DEFAULT_TTS_CONFIGS, 
  getRecommendedModelSettings, 
  generateInstallerScripts 
} from '../utils/hardwareDetector';

interface LocalModelInstallerModalProps {
  isOpen: boolean;
  onClose: () => void;
  localConfig: LocalLLMConfig;
  onSaveConfig: (updated: LocalLLMConfig) => void;
}

export const LocalModelInstallerModal: React.FC<LocalModelInstallerModalProps> = ({
  isOpen,
  onClose,
  localConfig,
  onSaveConfig,
}) => {
  // GPU Hardware state
  const [gpu, setGpu] = useState<GpuHardwareProfile>(() => {
    return localConfig.detectedGpu || detectGpuHardware();
  });

  // Active Model Tab
  const [selectedModelId, setSelectedModelId] = useState<LocalTtsModelId>(
    localConfig.activeTtsEngine || 'fish_audio'
  );

  // Model configs map
  const [configs, setConfigs] = useState<Record<LocalTtsModelId, LocalTtsConfigItem>>(() => {
    return {
      ...DEFAULT_TTS_CONFIGS,
      ...(localConfig.ttsConfigs || {}),
    };
  });

  // Script display mode
  const [scriptType, setScriptType] = useState<'ps1' | 'bat' | 'docker' | 'pip'>('ps1');
  const [copiedScript, setCopiedScript] = useState(false);

  // Connection and Test Speech state
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    online?: boolean;
    latencyMs?: number;
    message?: string;
    error?: string;
  } | null>(null);

  const [isGeneratingTestAudio, setIsGeneratingTestAudio] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [isPlayingTestAudio, setIsPlayingTestAudio] = useState(false);
  const [activeAudioElement, setActiveAudioElement] = useState<HTMLAudioElement | null>(null);

  // Probe all ports on load
  const [probedEngines, setProbedEngines] = useState<Array<{ id: string; name: string; port: number; online: boolean; latencyMs: number }>>([]);

  useEffect(() => {
    if (isOpen) {
      const freshGpu = detectGpuHardware();
      setGpu(freshGpu);
      probeAllEngines();
    }
  }, [isOpen]);

  const probeAllEngines = async () => {
    try {
      const res = await fetch('/api/local-tts/probe-all');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.engines)) {
          setProbedEngines(data.engines);
          // Update configs isConnected status
          setConfigs((prev) => {
            const next = { ...prev };
            data.engines.forEach((eng: any) => {
              const id = eng.id as LocalTtsModelId;
              if (next[id]) {
                next[id] = {
                  ...next[id],
                  isConnected: eng.online,
                  lastPingMs: eng.latencyMs,
                };
              }
            });
            return next;
          });
        }
      }
    } catch {}
  };

  if (!isOpen) return null;

  const currentConfig = configs[selectedModelId] || DEFAULT_TTS_CONFIGS[selectedModelId];
  const recSettings = getRecommendedModelSettings(selectedModelId, gpu);
  const scripts = generateInstallerScripts(selectedModelId, currentConfig, gpu);

  const updateCurrentConfig = (updates: Partial<LocalTtsConfigItem>) => {
    setConfigs((prev) => ({
      ...prev,
      [selectedModelId]: {
        ...prev[selectedModelId],
        ...updates,
      },
    }));
  };

  // Test current model port
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestStatus(null);
    try {
      const res = await fetch('/api/local-tts/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: currentConfig.endpoint,
          modelType: selectedModelId,
        }),
      });
      const data = await res.json();
      setTestStatus(data);

      if (data.online) {
        updateCurrentConfig({
          isConnected: true,
          lastPingMs: data.latencyMs,
        });
      } else {
        updateCurrentConfig({ isConnected: false });
      }
    } catch (err: any) {
      setTestStatus({
        online: false,
        error: err.message || 'Failed to reach local server.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Test synthesize 3-sec sample speech
  const handleSynthesizeTestAudio = async () => {
    setIsGeneratingTestAudio(true);
    if (activeAudioElement) {
      activeAudioElement.pause();
      setIsPlayingTestAudio(false);
    }

    try {
      const sampleText = `This is Narrativ local speech synthesis with ${currentConfig.name}, running privately on your ${gpu.renderer}.`;
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sampleText,
          localTtsEndpoint: currentConfig.endpoint,
          localTtsModelType: selectedModelId,
          temperature: currentConfig.temperature,
          topP: currentConfig.topP,
          speed: currentConfig.speed,
          quantization: currentConfig.quantization,
          sampleRate: currentConfig.sampleRate,
          referenceAudioPrompt: currentConfig.referenceAudioPrompt,
          privacyMode: 'strict_local',
          allowCloudFallback: false,
        }),
      });

      const data = await res.json();
      if (data.audioDataUrl) {
        setTestAudioUrl(data.audioDataUrl);
        const audio = new Audio(data.audioDataUrl);
        setActiveAudioElement(audio);
        audio.onended = () => setIsPlayingTestAudio(false);
        await audio.play();
        setIsPlayingTestAudio(true);
      } else {
        alert(data.error || 'Could not generate test audio from local server.');
      }
    } catch (err: any) {
      alert(`Test audio failed: ${err.message}. Ensure your local server script is running.`);
    } finally {
      setIsGeneratingTestAudio(false);
    }
  };

  const handleCopyScript = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  // Download .bat or .ps1 file directly
  const handleDownloadLauncher = () => {
    const filename = `start_${selectedModelId}_tts.bat`;
    const blob = new Blob([scripts.bat], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Apply & set as active
  const handleSaveAndSelect = (makeActive = true) => {
    const updated: LocalLLMConfig = {
      ...localConfig,
      detectedGpu: gpu,
      activeTtsEngine: makeActive ? selectedModelId : localConfig.activeTtsEngine,
      localTtsEndpoint: currentConfig.endpoint,
      localTtsModel: selectedModelId,
      localTtsConnected: currentConfig.isConnected,
      ttsConfigs: configs,
    };
    onSaveConfig(updated);
    onClose();
  };

  const modelTabs: Array<{ id: LocalTtsModelId; name: string; tag: string; defaultPort: number }> = [
    { id: 'fish_audio', name: 'Fish Audio', tag: 'Voice Cloning SOTA', defaultPort: 8080 },
    { id: 'orpheus', name: 'Orpheus TTS', tag: 'Theatrical Prosody', defaultPort: 7860 },
    { id: 'moss', name: 'Moss TTS', tag: 'Expressive Audio', defaultPort: 9880 },
    { id: 'chatterbox', name: 'Chatterbox', tag: 'Fast Audiobook', defaultPort: 8004 },
    { id: 'piper', name: 'Piper / Kokoro', tag: 'Low CPU / VRAM', defaultPort: 8880 },
  ];

  return (
    <div
      id="local-model-installer-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in"
    >
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-lime-500/10 border border-lime-500/30 flex items-center justify-center text-lime-400 shadow-sm">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white">Local AI & TTS Model Hub</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-lime-500/15 text-lime-400 border border-lime-500/30 font-mono font-semibold">
                  100% On-Device
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Install, configure, and calibrate Chatterbox, Orpheus, Moss, and Fish Audio with GPU auto-tuning
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto text-xs">
          {/* GPU Detection & Hardware Tier Banner */}
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-lime-400" />
                  <span className="font-bold text-neutral-200">Hardware Detection & GPU Profile</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase ${
                    gpu.vramTier === 'tier_s_ultra'
                      ? 'bg-purple-950/80 text-purple-300 border border-purple-500/40'
                      : gpu.vramTier === 'tier_a_high'
                      ? 'bg-blue-950/80 text-blue-300 border border-blue-500/40'
                      : gpu.vramTier === 'tier_b_medium'
                      ? 'bg-lime-950/80 text-lime-300 border border-lime-500/40'
                      : 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                  }`}>
                    {gpu.vramTier.replace('tier_', '').replace('_', ' ')}
                  </span>
                </div>
                <div className="text-sm font-semibold text-white font-mono flex items-center space-x-2">
                  <span>{gpu.renderer}</span>
                  <span className="text-xs text-neutral-400 font-normal">
                    (Estimated ~{gpu.estimatedVramGb}GB VRAM)
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed max-w-2xl">
                  {recSettings.vramAdvice}
                </p>
              </div>

              {/* Hardware Quick Switch / Override */}
              <div className="flex items-center space-x-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const fresh = detectGpuHardware();
                    setGpu(fresh);
                    probeAllEngines();
                  }}
                  className="px-3 py-1.5 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium flex items-center space-x-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-Detect GPU</span>
                </button>
              </div>
            </div>
          </div>

          {/* Model Selector Tabs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-neutral-300">
              <span className="font-semibold text-xs flex items-center space-x-1.5">
                <Radio className="w-3.5 h-3.5 text-lime-400" />
                <span>Select Target Local Model</span>
              </span>
              <span className="text-[11px] text-neutral-500">
                Click any model to customize parameters and generate installer script
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {modelTabs.map((tab) => {
                const isSelected = selectedModelId === tab.id;
                const configItem = configs[tab.id];
                const isOnline = configItem?.isConnected;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setSelectedModelId(tab.id);
                      setTestStatus(null);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      isSelected
                        ? 'border-lime-500/60 bg-lime-950/20 text-white shadow-xs'
                        : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{tab.name}</span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isOnline ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-neutral-700'
                        }`}
                        title={isOnline ? 'Online on local port' : 'Offline'}
                      />
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-1 truncate">{tab.tag}</div>
                    <div className="text-[10px] font-mono text-neutral-500 mt-0.5">Port {tab.defaultPort}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model Parameters & Tuning Studio */}
          <div className="p-4 sm:p-5 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800/80 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <span>{currentConfig.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-mono">
                    Endpoint: {currentConfig.endpoint}
                  </span>
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">{currentConfig.tagline}</p>
              </div>

              {/* Live Port Test & Synthesize Preview */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="px-3 py-1.5 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Pinging...' : 'Test Port'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSynthesizeTestAudio}
                  disabled={isGeneratingTestAudio}
                  className="px-3 py-1.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-neutral-950 text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm disabled:opacity-50"
                >
                  {isGeneratingTestAudio ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : isPlayingTestAudio ? (
                    <Square className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>{isGeneratingTestAudio ? 'Generating...' : 'Synthesize 3s Sample'}</span>
                </button>
              </div>
            </div>

            {/* Test Status Banner */}
            {testStatus && (
              <div
                className={`p-3 rounded-xl border flex items-center space-x-2 text-xs ${
                  testStatus.online
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : 'bg-neutral-800/80 border-neutral-700 text-neutral-300'
                }`}
              >
                {testStatus.online ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                )}
                <span className="flex-1">{testStatus.message || testStatus.error}</span>
                {testStatus.latencyMs !== undefined && testStatus.online && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-300">
                    {testStatus.latencyMs}ms
                  </span>
                )}
              </div>
            )}

            {/* Parameter Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {/* Option 1: Quantization & Precision */}
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between">
                  <label className="text-neutral-300 font-semibold text-[11px] flex items-center space-x-1">
                    <Layers className="w-3.5 h-3.5 text-lime-400" />
                    <span>Quantization / Precision</span>
                  </label>
                  <span className="text-[10px] text-lime-400 font-mono font-medium">
                    {gpu.recommendedQuantization === currentConfig.quantization ? '★ Optimal for GPU' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['fp16', 'bf16', 'int8', 'int4'] as ModelQuantization[]).map((q) => {
                    const isOptimal = gpu.recommendedQuantization === q;
                    const isSelected = currentConfig.quantization === q;

                    return (
                      <button
                        key={q}
                        type="button"
                        onClick={() => updateCurrentConfig({ quantization: q })}
                        className={`p-2 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-lime-500 bg-lime-950/30 text-white font-medium shadow-xs'
                            : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs uppercase font-mono font-bold">{q}</span>
                          {isOptimal && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-lime-500/20 text-lime-300">
                              Best
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">
                          {q === 'fp16' && 'Zero quality loss'}
                          {q === 'bf16' && 'Ampere/Ada GPU'}
                          {q === 'int8' && '~50% VRAM saved'}
                          {q === 'int4' && 'Low VRAM / CPU'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Option 2: Inference Temperature (Prosody & Expressiveness) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-neutral-300 font-semibold text-[11px] flex items-center space-x-1">
                    <Sliders className="w-3.5 h-3.5 text-lime-400" />
                    <span>Inference Temperature</span>
                  </label>
                  <span className="text-[11px] font-mono text-lime-400 font-bold">
                    {currentConfig.temperature.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.1"
                  step="0.05"
                  value={currentConfig.temperature}
                  onChange={(e) => updateCurrentConfig({ temperature: parseFloat(e.target.value) })}
                  className="w-full accent-lime-400 bg-neutral-800 h-1.5 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-500">
                  <span>0.3 (Steady / Formal)</span>
                  <span>0.7 (Theatrical)</span>
                  <span>1.0 (Wild Drama)</span>
                </div>

                {/* Speed Slider */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-neutral-300 font-medium text-[11px]">Speech Rate / Pacing</label>
                    <span className="text-[11px] font-mono text-lime-400 font-bold">{currentConfig.speed}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.75"
                    max="1.35"
                    step="0.05"
                    value={currentConfig.speed}
                    onChange={(e) => updateCurrentConfig({ speed: parseFloat(e.target.value) })}
                    className="w-full accent-lime-400 bg-neutral-800 h-1.5 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Option 3: Audio Sample Rate & Port */}
              <div className="space-y-2">
                <div>
                  <label className="text-neutral-300 font-semibold text-[11px] block mb-1">
                    Master Sample Rate
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[24000, 32000, 44100, 48000].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => updateCurrentConfig({ sampleRate: rate as any })}
                        className={`py-1.5 px-2 rounded-lg border text-center text-[11px] font-mono transition-all ${
                          currentConfig.sampleRate === rate
                            ? 'border-lime-500/80 bg-lime-950/30 text-lime-300 font-bold'
                            : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700'
                        }`}
                      >
                        {rate / 1000} kHz
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-neutral-300 font-medium text-[11px] block mb-1">
                    Server HTTP Endpoint
                  </label>
                  <input
                    type="text"
                    value={currentConfig.endpoint}
                    onChange={(e) => updateCurrentConfig({ endpoint: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-neutral-200 text-xs font-mono focus:outline-none focus:border-lime-500"
                  />
                </div>
              </div>
            </div>

            {/* Optional Voice Cloning Reference Audio (For Fish Audio and Moss TTS) */}
            {(selectedModelId === 'fish_audio' || selectedModelId === 'moss') && (
              <div className="p-3 bg-neutral-900/50 border border-neutral-800/80 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-200 text-xs flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-lime-400" />
                    <span>Zero-Shot Voice Cloning Reference (Optional)</span>
                  </span>
                  <span className="text-[10px] text-neutral-500">Audio path or speaker prompt tag</span>
                </div>
                <input
                  type="text"
                  value={currentConfig.referenceAudioPrompt || ''}
                  onChange={(e) => updateCurrentConfig({ referenceAudioPrompt: e.target.value })}
                  placeholder="e.g. references/dramatic_narrator.wav or 'Warm baritone audiobook reader with crisp sibilance'"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-neutral-200 text-xs font-mono focus:outline-none focus:border-lime-500"
                />
              </div>
            )}
          </div>

          {/* Installer Code & Launcher Generator */}
          <div className="p-4 sm:p-5 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-lime-400" />
                <span className="font-bold text-white">1-Click Installation Script & Launcher</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleDownloadLauncher}
                  className="px-3 py-1.5 rounded-xl border border-lime-500/40 bg-lime-950/30 hover:bg-lime-900/40 text-lime-300 font-medium text-xs flex items-center space-x-1.5 transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .bat Launcher</span>
                </button>
              </div>
            </div>

            {/* Script Tab Switcher */}
            <div className="flex space-x-2 border-b border-neutral-800 pb-2">
              {[
                { id: 'ps1', label: 'Windows PowerShell (.ps1)' },
                { id: 'bat', label: 'Windows Batch (.bat)' },
                { id: 'docker', label: 'Docker Container' },
                { id: 'pip', label: 'Pip / Terminal' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setScriptType(tab.id as any)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    scriptType === tab.id
                      ? 'bg-neutral-800 text-lime-400 font-semibold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Code Box */}
            <div className="relative rounded-xl bg-neutral-900/90 border border-neutral-800 p-3.5 font-mono text-xs text-neutral-300 overflow-x-auto max-h-56">
              <button
                type="button"
                onClick={() => handleCopyScript(scripts[scriptType])}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors flex items-center space-x-1 text-[11px]"
              >
                {copiedScript ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-lime-400" />
                    <span className="text-lime-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
              <pre className="whitespace-pre">{scripts[scriptType]}</pre>
            </div>
            <p className="text-[11px] text-neutral-500">
              Run this script once in your Windows Terminal to download weights and start the server at{' '}
              <code className="text-neutral-300 font-mono">http://localhost:{currentConfig.defaultPort}</code>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800 bg-neutral-950/90">
          <div className="text-xs text-neutral-400 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Zero cloud inference — runs 100% on your local GPU.</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSaveAndSelect(true)}
              className="px-5 py-2 bg-lime-400 hover:bg-lime-300 text-neutral-950 font-semibold rounded-xl transition-all shadow-lg shadow-lime-400/20 text-xs flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Use {currentConfig.name} for Audiobook</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
