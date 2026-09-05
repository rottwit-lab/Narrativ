import React, { useState } from 'react';
import { 
  BookOpen, 
  Play, 
  Download, 
  Trash2, 
  Clock, 
  HardDrive, 
  Sparkles, 
  ChevronRight,
  Layers,
  Search,
  Plus,
  FileAudio
} from 'lucide-react';
import { AudiobookProject } from '../types';
import { formatTime } from '../utils/textParser';
import { deleteProjectOffline } from '../utils/storage';

interface OfflineLibraryViewProps {
  projects: AudiobookProject[];
  onSelectProject: (project: AudiobookProject, chapterIndex?: number) => void;
  onNewProject: () => void;
  onRefreshLibrary: () => void;
  onOpenExportMp3?: (project: AudiobookProject) => void;
}

export const OfflineLibraryView: React.FC<OfflineLibraryViewProps> = ({
  projects,
  onSelectProject,
  onNewProject,
  onRefreshLibrary,
  onOpenExportMp3,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProjects = projects.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (e: React.MouseEvent, project: AudiobookProject) => {
    e.stopPropagation();
    if (confirm(`Remove "${project.title}" from offline library?`)) {
      await deleteProjectOffline(project.id, project.chapters.map(c => c.id));
      onRefreshLibrary();
    }
  };

  return (
    <div id="offline-library-view" className="space-y-6 pb-28">
      {/* Library Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-neutral-900/80 border border-neutral-800 rounded-2xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-lime-500/10 border border-lime-500/20 flex items-center justify-center text-lime-400">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white flex items-center space-x-2">
              <span>Windows Offline Audiobook Library</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-lime-500/15 text-lime-400 border border-lime-500/30 font-mono">
                {projects.length} {projects.length === 1 ? 'Book' : 'Books'}
              </span>
            </h1>
            <p className="text-xs text-neutral-400">
              Audiobooks cached locally in your persistent Windows storage for instant offline listening
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search library..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-lime-500/50"
            />
          </div>

          <button
            onClick={onNewProject}
            className="px-3.5 py-1.5 bg-lime-400 hover:bg-lime-300 text-neutral-950 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-all shadow-md shadow-lime-400/20 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New</span>
          </button>
        </div>
      </div>

      {/* Books Grid */}
      {filteredProjects.length === 0 ? (
        <div className="p-12 text-center bg-neutral-900/40 border border-neutral-800 rounded-2xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-neutral-800/80 border border-neutral-700 mx-auto flex items-center justify-center text-neutral-500">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-white">No Audiobooks Saved Yet</div>
            <div className="text-xs text-neutral-400 max-w-sm mx-auto">
              Synthesize a chapter or import a book in the Create Studio to save it for offline listening on your Windows device.
            </div>
          </div>
          <button
            onClick={onNewProject}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium rounded-xl transition-colors inline-flex items-center space-x-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-lime-400" />
            <span>Create Your First Audiobook</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredProjects.map((project) => {
            const readyChapters = project.chapters.filter(c => !!c.audioBlobUrl).length;
            const totalDuration = project.chapters.reduce((acc, c) => acc + (c.duration || 0), 0);

            return (
              <div
                key={project.id}
                onClick={() => onSelectProject(project)}
                className="p-5 bg-neutral-900/80 hover:bg-neutral-900 border border-neutral-800 hover:border-lime-500/40 rounded-2xl space-y-4 cursor-pointer transition-all group shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-xl bg-neutral-950 border border-neutral-800 overflow-hidden flex-shrink-0 relative">
                      <img 
                        src="/narrativ-logo.jpg" 
                        alt="Book Art" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="font-semibold text-sm text-white group-hover:text-lime-300 transition-colors line-clamp-1">
                        {project.title}
                      </h3>
                      <div className="text-xs text-neutral-400">
                        {project.author}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    {onOpenExportMp3 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenExportMp3(project);
                        }}
                        disabled={!project.chapters.some(c => !!c.audioBlobUrl || !!c.audioBlob)}
                        className="p-1.5 text-neutral-400 hover:text-lime-400 hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-30"
                        title="Export Concatenated MP3"
                      >
                        <FileAudio className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={(e) => handleDelete(e, project)}
                      className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors"
                      title="Delete Audiobook"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Metadata badges */}
                <div className="grid grid-cols-3 gap-2 text-center text-neutral-400 text-xs py-2 border-y border-neutral-800/80 bg-neutral-950/40 rounded-xl">
                  <div>
                    <div className="text-[10px] text-neutral-500 uppercase">Chapters</div>
                    <div className="font-mono font-semibold text-neutral-200">{project.chapters.length}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-500 uppercase">Voice</div>
                    <div className="font-semibold text-neutral-200 truncate px-1">{project.voice}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-500 uppercase">Tone</div>
                    <div className="font-semibold text-lime-400 capitalize">{project.emotion}</div>
                  </div>
                </div>

                {/* Chapter List Preview */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium text-neutral-500 flex items-center justify-between">
                    <span>Chapters Ready: {readyChapters} / {project.chapters.length}</span>
                    {totalDuration > 0 && <span>~{formatTime(totalDuration)}</span>}
                  </div>
                  <div className="space-y-1">
                    {project.chapters.slice(0, 3).map((ch, idx) => (
                      <div
                        key={ch.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-neutral-950/60 text-xs hover:bg-neutral-950 text-neutral-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProject(project, idx);
                        }}
                      >
                        <span className="truncate max-w-[200px]">{ch.title}</span>
                        {ch.audioBlobUrl ? (
                          <Play className="w-3 h-3 text-lime-400 fill-lime-400 flex-shrink-0" />
                        ) : (
                          <span className="text-[10px] text-neutral-600">Draft</span>
                        )}
                      </div>
                    ))}
                    {project.chapters.length > 3 && (
                      <div className="text-[10px] text-neutral-500 text-center">
                        +{project.chapters.length - 3} more chapters
                      </div>
                    )}
                  </div>
                </div>

                {/* Action button */}
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-[10px] text-neutral-500">
                    Saved {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                  <div className="flex items-center space-x-1 text-xs font-semibold text-lime-400 group-hover:translate-x-0.5 transition-transform">
                    <span>Open in Studio</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
