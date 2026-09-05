// IndexedDB offline storage for Narrativ audiobooks and audio blobs

const DB_NAME = 'NarrativWindowsDB';
const DB_VERSION = 2;
const STORE_PROJECTS = 'audiobooks';
const STORE_AUDIO = 'audio_blobs';
const STORE_DRAFTS = 'drafts';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_AUDIO)) {
        db.createObjectStore(STORE_AUDIO);
      }
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        db.createObjectStore(STORE_DRAFTS);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// Manuscript draft autosave — protects in-progress work from refresh/close.
// ---------------------------------------------------------------------------

export interface CreatorDraft {
  savedAt: number;
  bookTitle: string;
  authorName: string;
  rawText: string;
  selectedVoice: string;
  voiceProvider: string;
  emotion: string;
  pitch: number;
  rate: number;
  scriptMode: string;
  pronunciations: Array<{ id: string; word: string; pronunciation: string }>;
  project: any | null; // project snapshot without audio blobs
}

const DRAFT_KEY = 'creator_draft';

export async function saveDraftOffline(draft: CreatorDraft): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFTS, 'readwrite');
    tx.objectStore(STORE_DRAFTS).put(draft, DRAFT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDraftOffline(): Promise<CreatorDraft | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFTS, 'readonly');
    const req = tx.objectStore(STORE_DRAFTS).get(DRAFT_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearDraftOffline(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DRAFTS, 'readwrite');
    tx.objectStore(STORE_DRAFTS).delete(DRAFT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// Project export / import as JSON (portable backup: text + settings, no audio)
// ---------------------------------------------------------------------------

export function exportProjectToJson(project: any): void {
  const serializable = {
    format: 'narrativ-project',
    version: 2,
    exportedAt: new Date().toISOString(),
    project: {
      ...project,
      pronunciations: project.pronunciations || [],
      chapters: (project.chapters || []).map((ch: any) => {
        const { audioBlob, audioBlobUrl, ...rest } = ch;
        return { ...rest, status: 'idle' as const };
      }),
      currentChapterIndex: 0,
      updatedAt: Date.now(),
    },
  };

  const blob = new Blob([JSON.stringify(serializable, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(project.title || 'audiobook').replace(/[^a-z0-9]+/gi, '_')}.narrativ.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importProjectFromJson(file: File): Promise<any> {
  const text = await file.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Not a valid JSON file.');
  }

  const project = parsed?.project && parsed.format === 'narrativ-project' ? parsed.project : parsed;
  if (!project || !Array.isArray(project.chapters)) {
    throw new Error('Not a Narrativ project export (missing chapters).');
  }

  const imported = {
    ...project,
    id: `proj_${Date.now()}`,
    createdAt: project.createdAt || Date.now(),
    updatedAt: Date.now(),
    pronunciations: project.pronunciations || [],
    currentChapterIndex: 0,
    chapters: project.chapters.map((ch: any, i: number) => ({
      ...ch,
      id: ch.id || `ch_${Date.now()}_${i + 1}`,
      audioBlob: undefined,
      audioBlobUrl: undefined,
      status: 'idle' as const,
    })),
  };

  await saveProjectOffline(imported);
  return imported;
}

export async function saveProjectOffline(project: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    // Clone project without non-cloneable objects
    const cleanProject = {
      ...project,
      chapters: project.chapters.map((ch: any) => {
        const { audioBlob, audioBlobUrl, ...rest } = ch;
        return rest;
      }),
    };

    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.put(cleanProject);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function saveAudioBlobOffline(chapterId: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIO, 'readwrite');
    const store = tx.objectStore(STORE_AUDIO);
    const req = store.put(blob, chapterId);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAudioBlobOffline(chapterId: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIO, 'readonly');
    const store = tx.objectStore(STORE_AUDIO);
    const req = store.get(chapterId);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllProjectsOffline(): Promise<any[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readonly');
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteProjectOffline(projectId: string, chapterIds: string[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PROJECTS, STORE_AUDIO], 'readwrite');
    const projectStore = tx.objectStore(STORE_PROJECTS);
    const audioStore = tx.objectStore(STORE_AUDIO);

    projectStore.delete(projectId);
    chapterIds.forEach((id) => audioStore.delete(id));

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
