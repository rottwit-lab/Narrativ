// IndexedDB offline storage for Narrativ audiobooks and audio blobs

const DB_NAME = 'NarrativWindowsDB';
const DB_VERSION = 1;
const STORE_PROJECTS = 'audiobooks';
const STORE_AUDIO = 'audio_blobs';

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
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
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
