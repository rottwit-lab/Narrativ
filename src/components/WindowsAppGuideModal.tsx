import React from 'react';
import { 
  X, 
  Laptop, 
  Download, 
  Sparkles, 
  Terminal, 
  Check, 
  Compass, 
  Layers, 
  HardDrive,
  Keyboard
} from 'lucide-react';

interface WindowsAppGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WindowsAppGuideModal: React.FC<WindowsAppGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      id="windows-guide-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-lime-500/10 border border-lime-500/20 flex items-center justify-center text-lime-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
                <span>Narrativ for Windows</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/30 font-mono">
                  Windows 10 / 11 Native
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Install as a native desktop application, pin to taskbar, and listen 100% offline
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
        <div className="p-6 space-y-6 overflow-y-auto text-xs">
          {/* Method 1: Instant PWA Install on Windows */}
          <div className="p-4 bg-neutral-950/70 border border-lime-500/30 rounded-xl space-y-3">
            <div className="flex items-center space-x-2 text-white font-semibold text-sm">
              <span className="w-5 h-5 rounded-full bg-lime-400 text-neutral-950 text-xs flex items-center justify-center font-bold">
                1
              </span>
              <span>1-Click Windows Desktop App Installation (PWA)</span>
            </div>
            <p className="text-neutral-300 leading-relaxed text-[11px]">
              Narrativ is fully configured as a Windows Progressive Web App with offline caching and native window controls.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg space-y-1">
                <div className="font-semibold text-white flex items-center space-x-1.5">
                  <span>In Microsoft Edge:</span>
                </div>
                <div className="text-neutral-400 text-[11px] leading-relaxed">
                  Click the <strong>App available</strong> icon in the address bar, or open <kbd className="bg-neutral-800 px-1 py-0.5 rounded text-[10px]">...</kbd> Menu &rarr; <em>Apps</em> &rarr; <em>Install Narrativ</em>.
                </div>
              </div>

              <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg space-y-1">
                <div className="font-semibold text-white flex items-center space-x-1.5">
                  <span>In Google Chrome:</span>
                </div>
                <div className="text-neutral-400 text-[11px] leading-relaxed">
                  Click the <strong>Install</strong> icon on the right side of the URL bar &rarr; click <em>Install</em>.
                </div>
              </div>
            </div>
            <div className="text-[11px] text-lime-400 flex items-center space-x-1.5 pt-1">
              <Check className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Creates a desktop shortcut, Start Menu entry, and integrates with the Windows Taskbar.</span>
            </div>
          </div>

          {/* Windows Desktop Keyboard Shortcuts */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-white font-semibold text-xs">
              <Keyboard className="w-4 h-4 text-lime-400" />
              <span>Windows Desktop Keyboard Shortcuts</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg flex items-center justify-between">
                <span className="text-neutral-400">Play / Pause</span>
                <kbd className="px-2 py-0.5 bg-neutral-800 rounded font-mono text-neutral-200 text-[10px]">Space</kbd>
              </div>
              <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg flex items-center justify-between">
                <span className="text-neutral-400">Rewind 10s</span>
                <kbd className="px-2 py-0.5 bg-neutral-800 rounded font-mono text-neutral-200 text-[10px]">&larr; Left</kbd>
              </div>
              <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg flex items-center justify-between">
                <span className="text-neutral-400">Forward 10s</span>
                <kbd className="px-2 py-0.5 bg-neutral-800 rounded font-mono text-neutral-200 text-[10px]">&rarr; Right</kbd>
              </div>
              <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg flex items-center justify-between">
                <span className="text-neutral-400">Mute Audio</span>
                <kbd className="px-2 py-0.5 bg-neutral-800 rounded font-mono text-neutral-200 text-[10px]">M</kbd>
              </div>
              <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg flex items-center justify-between">
                <span className="text-neutral-400">Fullscreen</span>
                <kbd className="px-2 py-0.5 bg-neutral-800 rounded font-mono text-neutral-200 text-[10px]">F11</kbd>
              </div>
              <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg flex items-center justify-between">
                <span className="text-neutral-400">Download Audio</span>
                <kbd className="px-2 py-0.5 bg-neutral-800 rounded font-mono text-neutral-200 text-[10px]">WAV Save</kbd>
              </div>
            </div>
          </div>

          {/* Offline Windows Storage */}
          <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl flex items-start space-x-3">
            <HardDrive className="w-4 h-4 text-lime-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-white">100% Offline Audiobook Playback</div>
              <div className="text-neutral-400 text-[11px] leading-relaxed">
                Audiobooks created with Narrativ are stored directly inside your browser's persistent IndexedDB storage. You can unplug your internet connection or go on airplane mode and your entire library remains playable.
              </div>
            </div>
          </div>

          {/* Standalone Windows Executable (.exe) Setup */}
          <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
            <div className="flex items-center space-x-1.5 font-medium text-neutral-300">
              <Terminal className="w-3.5 h-3.5 text-lime-400" />
              <span>Building a Standalone Windows .exe (Electron)</span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              The project includes <code className="text-neutral-200 font-mono">electron-main.cjs</code>. When exported to your Windows machine, you can run:
            </p>
            <div className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-lg font-mono text-[11px] text-lime-300">
              npx electron electron-main.cjs
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-neutral-800 bg-neutral-950/60">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-xl transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
