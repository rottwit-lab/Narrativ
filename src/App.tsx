import React, { useState, useEffect } from 'react';
import { WindowsTitleBar } from './components/WindowsTitleBar';
import { AudiobookCreatorView } from './components/AudiobookCreatorView';
import { OfflineLibraryView } from './components/OfflineLibraryView';
import { AudiobookPlayer } from './components/AudiobookPlayer';
import { LocalLLMModal } from './components/LocalLLMModal';
import { LocalModelInstallerModal } from './components/LocalModelInstallerModal';
import { WindowsAppGuideModal } from './components/WindowsAppGuideModal';
import { ExportMp3Modal } from './components/ExportMp3Modal';
import { AudiobookProject, LocalLLMConfig } from './types';
import { getAllProjectsOffline, getAudioBlobOffline, saveProjectOffline } from './utils/storage';
import { DEFAULT_TTS_CONFIGS, detectGpuHardware } from './utils/hardwareDetector';

export default function App() {
  const [activeView, setActiveView] = useState<'create' | 'library'>('create');
  const [currentProject, setCurrentProject] = useState<AudiobookProject | null>(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [savedProjects, setSavedProjects] = useState<AudiobookProject[]>([]);
  
  // Modals
  const [isLocalLLMModalOpen, setIsLocalLLMModalOpen] = useState(false);
  const [isModelInstallerOpen, setIsModelInstallerOpen] = useState(false);
  const [isWindowsGuideOpen, setIsWindowsGuideOpen] = useState(false);
  const [isExportMp3Open, setIsExportMp3Open] = useState(false);
  const [projectToExport, setProjectToExport] = useState<AudiobookProject | null>(null);

  // Local LLM & Privacy Engine Config (persisted in localStorage)
  const [localLLMConfig, setLocalLLMConfig] = useState<LocalLLMConfig>(() => {
    try {
      const saved = localStorage.getItem('narrativ_local_llm_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          activeTtsEngine: parsed.activeTtsEngine || 'fish_audio',
          ttsConfigs: { ...DEFAULT_TTS_CONFIGS, ...(parsed.ttsConfigs || {}) },
          detectedGpu: parsed.detectedGpu || detectGpuHardware(),
        };
      }
    } catch (e) {}
    return {
      enabled: true, // Privacy-First by default!
      endpoint: 'http://localhost:11434',
      provider: 'ollama',
      selectedModel: 'llama3.2',
      availableModels: [],
      isTesting: false,
      isConnected: false,
      privacyMode: 'smart_fallback',
      allowCloudFallback: true,
      localTtsEndpoint: 'http://localhost:8080',
      localTtsModel: 'fish_audio',
      localTtsConnected: false,
      activeTtsEngine: 'fish_audio',
      detectedGpu: detectGpuHardware(),
      ttsConfigs: DEFAULT_TTS_CONFIGS,
    };
  });

  // Check local engine status on startup (Ollama / LM Studio)
  const checkLocalEngines = async () => {
    try {
      const res = await fetch('/api/privacy-status');
      if (res.ok) {
        const data = await res.json();
        if (data.hasLocalLLM) {
          // Probe tags to populate models
          const testRes = await fetch('/api/local-llm/test-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: data.ollamaOnline ? 'http://localhost:11434' : 'http://localhost:1234',
              provider: data.ollamaOnline ? 'ollama' : 'openai_compatible',
            }),
          });
          const testData = await testRes.json();
          if (testData.online) {
            setLocalLLMConfig((prev) => ({
              ...prev,
              isConnected: true,
              provider: testData.provider,
              endpoint: data.ollamaOnline ? 'http://localhost:11434' : 'http://localhost:1234',
              availableModels: testData.models || [],
              selectedModel: testData.models?.[0] || prev.selectedModel,
            }));
          }
        }
      }
    } catch (e) {
      console.warn('Auto-discovery of local LLM skipped:', e);
    }
  };

  // Load offline audiobooks from IndexedDB on start
  const refreshLibrary = async () => {
    try {
      const offlineProjects = await getAllProjectsOffline();
      // Rehydrate audio blob URLs if any
      const rehydrated = await Promise.all(
        offlineProjects.map(async (proj) => {
          const chaptersWithAudio = await Promise.all(
            proj.chapters.map(async (ch: any) => {
              const blob = await getAudioBlobOffline(ch.id);
              if (blob) {
                return {
                  ...ch,
                  audioBlob: blob,
                  audioBlobUrl: URL.createObjectURL(blob),
                };
              }
              return ch;
            })
          );
          return {
            ...proj,
            chapters: chaptersWithAudio,
          };
        })
      );
      setSavedProjects(rehydrated);
    } catch (e) {
      console.warn('Failed to load offline storage:', e);
    }
  };

  useEffect(() => {
    refreshLibrary();
    checkLocalEngines();
  }, []);

  // Save local LLM config to localStorage
  const handleSaveLocalConfig = (updated: LocalLLMConfig) => {
    setLocalLLMConfig(updated);
    try {
      localStorage.setItem('narrativ_local_llm_config', JSON.stringify(updated));
    } catch (e) {}
  };

  // Switch to specific project & chapter from library
  const handleSelectProject = (proj: AudiobookProject, chapterIndex = 0) => {
    setCurrentProject(proj);
    setCurrentChapterIndex(chapterIndex);
    setActiveView('create');
  };

  const handleNewProject = () => {
    setCurrentProject(null);
    setCurrentChapterIndex(0);
    setActiveView('create');
  };

  const handleChapterChange = (index: number) => {
    if (!currentProject) return;
    if (index >= 0 && index < currentProject.chapters.length) {
      setCurrentChapterIndex(index);
    }
  };

  const handleOpenExportMp3 = (proj?: AudiobookProject) => {
    const target = proj || currentProject;
    if (target) {
      setProjectToExport(target);
    }
    setIsExportMp3Open(true);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-['Plus_Jakarta_Sans'] select-none">
      {/* Windows 11 Fluent Titlebar */}
      <WindowsTitleBar
        localConfig={localLLMConfig}
        onOpenLocalSettings={() => setIsLocalLLMModalOpen(true)}
        onOpenModelInstaller={() => setIsModelInstallerOpen(true)}
        onOpenWindowsGuide={() => setIsWindowsGuideOpen(true)}
        activeView={activeView}
        setActiveView={setActiveView}
        audiobookCount={savedProjects.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 select-text pb-28">
        {activeView === 'create' ? (
          <AudiobookCreatorView
            currentProject={currentProject}
            setCurrentProject={setCurrentProject}
            localConfig={localLLMConfig}
            onOpenLocalSettings={() => setIsLocalLLMModalOpen(true)}
            onOpenModelInstaller={() => setIsModelInstallerOpen(true)}
            onPlayChapter={(idx) => {
              setCurrentChapterIndex(idx);
            }}
            onOpenExportMp3={() => handleOpenExportMp3(currentProject || undefined)}
          />
        ) : (
          <OfflineLibraryView
            projects={savedProjects}
            onSelectProject={handleSelectProject}
            onNewProject={handleNewProject}
            onRefreshLibrary={refreshLibrary}
            onOpenExportMp3={(proj) => handleOpenExportMp3(proj)}
          />
        )}
      </main>

      {/* Persistent Windows Audio Player Deck */}
      <AudiobookPlayer
        currentProject={currentProject}
        currentChapterIndex={currentChapterIndex}
        onChapterChange={handleChapterChange}
        onOpenExportMp3={() => handleOpenExportMp3(currentProject || undefined)}
        onSaveToOffline={async () => {
          if (currentProject) {
            await saveProjectOffline(currentProject);
            refreshLibrary();
          }
        }}
      />

      {/* Local AI & Privacy Engine Modal (Ollama / LM Studio) */}
      <LocalLLMModal
        isOpen={isLocalLLMModalOpen}
        onClose={() => setIsLocalLLMModalOpen(false)}
        config={localLLMConfig}
        onSaveConfig={handleSaveLocalConfig}
        onOpenModelInstaller={() => {
          setIsLocalLLMModalOpen(false);
          setIsModelInstallerOpen(true);
        }}
      />

      {/* Local Model Hub & GPU Auto-Tuning Installer (Chatterbox, Orpheus, Moss, Fish Audio) */}
      <LocalModelInstallerModal
        isOpen={isModelInstallerOpen}
        onClose={() => setIsModelInstallerOpen(false)}
        localConfig={localLLMConfig}
        onSaveConfig={handleSaveLocalConfig}
      />

      {/* Windows Native App Guide Modal */}
      <WindowsAppGuideModal
        isOpen={isWindowsGuideOpen}
        onClose={() => setIsWindowsGuideOpen(false)}
      />

      {/* Export Audiobook as Concatenated MP3 Modal */}
      <ExportMp3Modal
        isOpen={isExportMp3Open}
        onClose={() => {
          setIsExportMp3Open(false);
          setProjectToExport(null);
        }}
        project={projectToExport || currentProject}
      />
    </div>
  );
}
