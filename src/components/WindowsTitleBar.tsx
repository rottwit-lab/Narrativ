import React, { useState, useEffect } from 'react';
import { 
  Minus, 
  Square, 
  X, 
  Laptop, 
  Cpu, 
  Wifi, 
  WifiOff, 
  Sparkles,
  Download,
  Info,
  ShieldCheck,
  Shield
} from 'lucide-react';
import { LocalLLMConfig } from '../types';

interface WindowsTitleBarProps {
  localConfig: LocalLLMConfig;
  onOpenLocalSettings: () => void;
  onOpenModelInstaller?: () => void;
  onOpenWindowsGuide: () => void;
  activeView: 'create' | 'library';
  setActiveView: (view: 'create' | 'library') => void;
  audiobookCount: number;
}

export const WindowsTitleBar: React.FC<WindowsTitleBarProps> = ({
  localConfig,
  onOpenLocalSettings,
  onOpenModelInstaller,
  onOpenWindowsGuide,
  activeView,
  setActiveView,
  audiobookCount,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if running as standalone PWA
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsPWAInstalled(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsPWAInstalled(true);
      }
      setDeferredInstallPrompt(null);
    } else {
      onOpenWindowsGuide();
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsMaximized(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsMaximized(false);
    }
  };

  return (
    <header 
      id="windows-title-bar"
      className="select-none h-11 bg-neutral-950 border-b border-neutral-800/80 flex items-center justify-between px-3 text-xs text-neutral-400 z-50 sticky top-0 backdrop-blur-md"
    >
      {/* App Branding & Window Title */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <img 
            src="/narrativ-logo.jpg" 
            alt="Narrativ" 
            className="w-5 h-5 rounded-md object-cover border border-neutral-700/60 shadow-sm"
          />
          <div className="flex items-center space-x-1.5 font-semibold text-neutral-200">
            <span className="font-['Space_Grotesk'] text-sm tracking-tight text-white flex items-center">
              Narrativ
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-lime-400 ml-0.5 animate-pulse" />
            </span>
            <span className="text-neutral-500 font-normal">|</span>
            <span className="text-[11px] text-neutral-300 font-normal hidden sm:inline flex items-center space-x-1">
              <span>Privacy-First Local AI Studio</span>
            </span>
          </div>
        </div>

        {/* View Switcher Tabs (Windows Segmented Style) */}
        <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 ml-2">
          <button
            id="tab-creator"
            onClick={() => setActiveView('create')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeView === 'create'
                ? 'bg-neutral-800 text-white shadow-xs font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
            }`}
          >
            Create Studio
          </button>
          <button
            id="tab-library"
            onClick={() => setActiveView('library')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center space-x-1.5 ${
              activeView === 'library'
                ? 'bg-neutral-800 text-white shadow-xs font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
            }`}
          >
            <span>Offline Library</span>
            {audiobookCount > 0 && (
              <span className="bg-lime-500/20 text-lime-400 border border-lime-500/30 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {audiobookCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Middle & Right System Diagnostics & Windows Controls */}
      <div className="flex items-center space-x-2">
        {/* Local Models & GPU Hub Button */}
        {onOpenModelInstaller && (
          <button
            id="btn-local-model-hub"
            onClick={onOpenModelInstaller}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-lime-500/30 text-lime-400 text-[11px] font-medium transition-colors"
            title="Local AI Models (Chatterbox, Orpheus, Moss, Fish Audio) & GPU Auto-Tuning"
          >
            <Cpu className="w-3.5 h-3.5 text-lime-400" />
            <span className="hidden xl:inline font-mono">
              {localConfig.detectedGpu ? `${localConfig.detectedGpu.renderer.split(' ')[0]} • ` : ''}
              {localConfig.activeTtsEngine ? localConfig.activeTtsEngine.replace('_', ' ') : 'Local TTS'}
            </span>
            <span className="xl:hidden">Model Hub</span>
          </button>
        )}

        {/* Privacy Shield & Local LLM Indicator */}
        <button
          id="btn-local-llm-status"
          onClick={onOpenLocalSettings}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md border text-[11px] transition-colors ${
            localConfig.privacyMode === 'strict_local'
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
              : localConfig.isConnected
                ? 'bg-lime-950/40 border-lime-500/40 text-lime-400 hover:bg-lime-900/40'
                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white'
          }`}
          title="Privacy Engine Settings: Local LLM (Ollama / LM Studio) & Local Voices"
        >
          {localConfig.privacyMode === 'strict_local' ? (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Shield className="w-3.5 h-3.5 text-lime-400" />
          )}
          <span className="hidden md:inline">
            {localConfig.privacyMode === 'strict_local'
              ? 'Privacy: 100% Air-Gapped'
              : localConfig.isConnected
                ? `Privacy: Local (${localConfig.selectedModel || 'Ollama'})`
                : 'Privacy: Local First (Cloud Fallback Ready)'}
          </span>
          <span className={`w-1.5 h-1.5 rounded-full ${
            localConfig.isConnected ? 'bg-lime-400' : 'bg-lime-500/50'
          }`} />
        </button>

        {/* Network & Cloud Fallback Status */}
        <div 
          className="flex items-center space-x-1 px-2 py-1 bg-neutral-900 border border-neutral-800 rounded-md text-[11px]"
          title={isOnline ? 'Online - Cloud hosted TTS & AI ready as fallback' : 'Offline Mode - 100% Local Processing Active'}
        >
          {isOnline ? (
            <>
              <Wifi className="w-3 h-3 text-lime-400" />
              <span className="text-neutral-300 hidden lg:inline">Cloud Fallback Ready</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-amber-400" />
              <span className="text-amber-400 font-medium hidden lg:inline">Air-Gapped Offline</span>
            </>
          )}
        </div>

        {/* Install as Windows Desktop App Button */}
        <button
          id="btn-install-windows"
          onClick={handleInstallClick}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 text-neutral-200 text-[11px] font-medium transition-all shadow-xs"
          title="Install as Windows Desktop Application"
        >
          <Laptop className="w-3.5 h-3.5 text-lime-400" />
          <span className="hidden sm:inline">
            {isPWAInstalled ? 'Windows App Active' : 'Install Windows App'}
          </span>
        </button>

        {/* Windows Guide Button */}
        <button
          id="btn-windows-info"
          onClick={onOpenWindowsGuide}
          className="p-1 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-white"
          title="Windows Desktop App Guide & Shortcuts"
        >
          <Info className="w-4 h-4" />
        </button>

        {/* Classic Windows Titlebar Controls (Minimize, Maximize, Close) */}
        <div className="flex items-center ml-2 border-l border-neutral-800 pl-2">
          <button 
            id="win-btn-minimize"
            onClick={() => alert('Windows Shortcut Tip: Press Windows + Down Arrow to minimize, or use your Windows taskbar.')}
            className="w-8 h-7 flex items-center justify-center hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button 
            id="win-btn-maximize"
            onClick={toggleFullscreen}
            className="w-8 h-7 flex items-center justify-center hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
            title={isMaximized ? "Restore Down" : "Maximize (Fullscreen)"}
          >
            <Square className="w-3 h-3" />
          </button>
          <button 
            id="win-btn-close"
            onClick={() => alert('Windows Tip: You can close or pin Narrativ in your Windows Taskbar, or press Alt + F4.')}
            className="w-8 h-7 flex items-center justify-center hover:bg-red-600 text-neutral-400 hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
