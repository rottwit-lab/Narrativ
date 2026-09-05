import React, { useState } from 'react';
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
  Cloud,
  Lock
} from 'lucide-react';
import { LocalLLMConfig } from '../types';

interface LocalLLMModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: LocalLLMConfig;
  onSaveConfig: (updated: LocalLLMConfig) => void;
  onOpenModelInstaller?: () => void;
}

export const LocalLLMModal: React.FC<LocalLLMModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onOpenModelInstaller,
}) => {
  const [enabled, setEnabled] = useState(config.enabled ?? true);
  const [endpoint, setEndpoint] = useState(config.endpoint || 'http://localhost:11434');
  const [provider, setProvider] = useState<'ollama' | 'openai_compatible'>(config.provider || 'ollama');
  const [selectedModel, setSelectedModel] = useState(config.selectedModel || 'llama3.2');
  const [availableModels, setAvailableModels] = useState<string[]>(config.availableModels || []);
  const [privacyMode, setPrivacyMode] = useState<'smart_fallback' | 'strict_local'>(config.privacyMode || 'smart_fallback');
  const [allowCloudFallback, setAllowCloudFallback] = useState(config.allowCloudFallback ?? true);
  
  // Local TTS state
  const [localTtsEndpoint, setLocalTtsEndpoint] = useState(config.localTtsEndpoint || 'http://localhost:8880');
  const [localTtsModel, setLocalTtsModel] = useState(config.localTtsModel || 'kokoro');
  const [isTestingTts, setIsTestingTts] = useState(false);
  const [ttsTestResult, setTtsTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/local-llm/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, provider }),
      });

      const data = await response.json();

      if (data.online) {
        setAvailableModels(data.models || []);
        if (data.models && data.models.length > 0 && (!selectedModel || !data.models.includes(selectedModel))) {
          setSelectedModel(data.models[0]);
        }
        setTestResult({
          success: true,
          message: data.message || `Successfully connected! Found ${data.models?.length || 0} local model(s). Zero data leaves your computer.`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Connection failed. Check if local LLM server is active.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network error while contacting local server.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestTtsConnection = async () => {
    setIsTestingTts(true);
    setTtsTestResult(null);

    try {
      const response = await fetch('/api/local-tts/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: localTtsEndpoint }),
      });

      const data = await response.json();
      if (data.online) {
        setTtsTestResult({
          success: true,
          message: data.message || 'Local TTS server responding! Ready for offline synthesis.',
        });
      } else {
        setTtsTestResult({
          success: false,
          message: data.error || 'Local TTS server not responding at this port.',
        });
      }
    } catch (err: any) {
      setTtsTestResult({
        success: false,
        message: err.message || 'Failed to contact local TTS server.',
      });
    } finally {
      setIsTestingTts(false);
    }
  };

  const handleApply = () => {
    onSaveConfig({
      enabled,
      endpoint,
      provider,
      selectedModel,
      availableModels,
      isTesting: false,
      isConnected: testResult?.success ?? config.isConnected,
      privacyMode,
      allowCloudFallback,
      localTtsEndpoint,
      localTtsModel,
      localTtsConnected: ttsTestResult?.success ?? config.localTtsConnected,
    });
    onClose();
  };

  return (
    <div 
      id="local-llm-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with Privacy & Local AI emphasis */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/80">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-lime-500/10 border border-lime-500/30 flex items-center justify-center text-lime-400 shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Privacy & Local AI Engine</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/20 font-mono">
                  Zero Cloud Tracking
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Run scripts and voice synthesis privately on your hardware with seamless cloud fallbacks
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

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs">
          {/* Privacy Mode Selector Card */}
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-3">
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4 text-lime-400" />
              <span className="font-semibold text-white">Privacy Strategy</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Smart Local-First (Default & Recommended) */}
              <div 
                onClick={() => {
                  setPrivacyMode('smart_fallback');
                  setAllowCloudFallback(true);
                }}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                  privacyMode === 'smart_fallback'
                    ? 'border-lime-500/60 bg-lime-950/20 text-white shadow-sm'
                    : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-neutral-100 flex items-center space-x-1.5">
                    <span>Local-First + Cloud Fallback</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-lime-500/20 text-lime-300 font-medium">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Processes scripts and audio on your machine first. If local models are inactive, smoothly uses Cloud Gemini TTS so generation never halts.
                </p>
              </div>

              {/* Option 2: Strict Air-Gapped (100% Local Only) */}
              <div 
                onClick={() => {
                  setPrivacyMode('strict_local');
                  setAllowCloudFallback(false);
                }}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                  privacyMode === 'strict_local'
                    ? 'border-emerald-500/60 bg-emerald-950/20 text-white shadow-sm'
                    : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-neutral-100 flex items-center space-x-1.5">
                    <span>Strict Air-Gapped</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                    100% Local Only
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Strictly forbids any outbound cloud requests. All scripts and audio rely purely on Ollama/LM Studio and local speech engines.
                </p>
              </div>
            </div>
          </div>

          {/* Section 1: Local LLM Configuration (Script Writing & Emotion Cues) */}
          <div className="space-y-3 p-4 bg-neutral-950 border border-neutral-800 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-lime-400" />
                <span className="font-semibold text-white">Local LLM (Script Adaptation & Directing)</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-lime-500"></div>
              </label>
            </div>

            {/* Provider Switcher */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setProvider('ollama');
                  if (endpoint.includes('1234')) setEndpoint('http://localhost:11434');
                }}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  provider === 'ollama'
                    ? 'border-lime-500/50 bg-lime-950/20 text-white'
                    : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="font-semibold text-xs text-neutral-200">Ollama (Default)</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">Port 11434 • LLaMA 3.2, Mistral, Gemma</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setProvider('openai_compatible');
                  if (endpoint.includes('11434')) setEndpoint('http://localhost:1234');
                }}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  provider === 'openai_compatible'
                    ? 'border-lime-500/50 bg-lime-950/20 text-white'
                    : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="font-semibold text-xs text-neutral-200">LM Studio / vLLM</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">Port 1234 • OpenAI-compatible local server</div>
              </button>
            </div>

            {/* Endpoint & Test */}
            <div className="space-y-1.5 pt-1">
              <label className="text-neutral-400 text-[11px] font-medium block">Local Server Endpoint</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-1.5 text-neutral-200 text-xs font-mono focus:outline-none focus:border-lime-500/50"
                />
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 font-medium rounded-xl flex items-center space-x-1.5 transition-colors text-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Checking...' : 'Test & Fetch Models'}</span>
                </button>
              </div>
            </div>

            {/* LLM Test Status Banner */}
            {testResult && (
              <div
                className={`p-2.5 rounded-xl border flex items-start space-x-2 text-xs ${
                  testResult.success
                    ? 'bg-lime-950/30 border-lime-500/30 text-lime-300'
                    : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-lime-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                )}
                <div>{testResult.message}</div>
              </div>
            )}

            {/* Active Model */}
            <div className="space-y-1.5 pt-1">
              <label className="text-neutral-400 text-[11px] font-medium block">
                Target Model {availableModels.length > 0 && `(${availableModels.length} detected locally)`}
              </label>
              {availableModels.length > 0 ? (
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-1.5 text-neutral-200 text-xs focus:outline-none focus:border-lime-500/50"
                >
                  {availableModels.map((mod) => (
                    <option key={mod} value={mod}>
                      {mod}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  placeholder="e.g. llama3.2, mistral, or gemma2"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-1.5 text-neutral-200 text-xs font-mono focus:outline-none focus:border-lime-500/50"
                />
              )}
            </div>
          </div>

          {/* Section 2: Local & Offline Speech Engine (TTS) */}
          <div className="space-y-3 p-4 bg-neutral-950 border border-neutral-800 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-lime-400" />
                <span className="font-semibold text-white">Local Speech Engines (TTS)</span>
              </div>
              <span className="text-[11px] text-neutral-400">Offline & On-Device</span>
            </div>

            {/* GPU & Local Model Hub Banner */}
            {onOpenModelInstaller && (
              <div className="p-3 bg-gradient-to-r from-lime-950/40 via-neutral-900/60 to-emerald-950/30 border border-lime-500/30 rounded-xl flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-lime-400" />
                    <span className="font-bold text-xs text-white">Local Model Hub & GPU Auto-Tuner</span>
                  </div>
                  <p className="text-[11px] text-neutral-300">
                    Auto-detect your GPU and install <span className="text-lime-300 font-medium">Chatterbox</span>, <span className="text-lime-300 font-medium">Orpheus</span>, <span className="text-lime-300 font-medium">Moss</span>, or <span className="text-lime-300 font-medium">Fish Audio</span> with 1-click launchers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenModelInstaller}
                  className="px-3 py-1.5 bg-lime-400 hover:bg-lime-300 text-neutral-950 font-semibold rounded-lg text-xs flex-shrink-0 flex items-center space-x-1.5 transition-all shadow-sm"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Open Hub</span>
                </button>
              </div>
            )}

            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Narrativ comes built-in with Windows Offline Speech Synthesis (Web Speech SAPI). You can also connect to an optional local neural TTS server (such as Kokoro, Piper, or AllTalk):
            </p>

            <div className="space-y-1.5 pt-1">
              <label className="text-neutral-400 text-[11px] font-medium block">Local TTS HTTP Endpoint (Optional)</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={localTtsEndpoint}
                  onChange={(e) => setLocalTtsEndpoint(e.target.value)}
                  placeholder="http://localhost:8880"
                  className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-1.5 text-neutral-200 text-xs font-mono focus:outline-none focus:border-lime-500/50"
                />
                <button
                  type="button"
                  onClick={handleTestTtsConnection}
                  disabled={isTestingTts}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 font-medium rounded-xl flex items-center space-x-1.5 transition-colors text-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingTts ? 'animate-spin' : ''}`} />
                  <span>{isTestingTts ? 'Testing...' : 'Test TTS'}</span>
                </button>
              </div>
            </div>

            {ttsTestResult && (
              <div
                className={`p-2.5 rounded-xl border flex items-start space-x-2 text-xs ${
                  ttsTestResult.success
                    ? 'bg-lime-950/30 border-lime-500/30 text-lime-300'
                    : 'bg-neutral-800/80 border-neutral-700 text-neutral-300'
                }`}
              >
                {ttsTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-lime-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" />
                )}
                <div>{ttsTestResult.message}</div>
              </div>
            )}
          </div>

          {/* Section 3: Cloud & Hosted Fallback Info */}
          <div className="p-4 bg-neutral-950 border border-neutral-800/90 rounded-2xl space-y-2.5">
            <div className="flex items-center space-x-2">
              <Cloud className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-white">Hosted Cloud Fallback (Gemini TTS & Flash)</span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              When no local models are installed or reachable on your ports, Narrativ can seamlessly route chapter scriptwriting and high-fidelity vocal synthesis to hosted Gemini models (<code className="text-neutral-300 font-mono">gemini-3.1-flash-tts-preview</code> and <code className="text-neutral-300 font-mono">gemini-3.8-flash</code>).
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-neutral-300">Enable Cloud Fallback when local is offline:</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowCloudFallback && privacyMode !== 'strict_local'}
                  disabled={privacyMode === 'strict_local'}
                  onChange={(e) => setAllowCloudFallback(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-lime-500 peer-disabled:opacity-40"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-neutral-800 bg-neutral-950/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2 bg-lime-400 hover:bg-lime-300 text-neutral-950 font-semibold rounded-xl transition-all shadow-lg shadow-lime-400/20"
          >
            Save Privacy Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
