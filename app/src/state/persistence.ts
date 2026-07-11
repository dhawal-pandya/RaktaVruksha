import type { FamilyDataV2 } from '../core/types';

// --- tiny IndexedDB key-value wrapper ---------------------------------------

const DB_NAME = 'raktavruksha';
const STORE = 'kv';

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const kvGet = async <T>(key: string): Promise<T | undefined> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
};

const kvSet = async (key: string, value: unknown): Promise<void> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const kvDel = async (key: string): Promise<void> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// --- working draft ------------------------------------------------------------

const DRAFT_KEY = 'draft-v2';

export const saveDraft = (raw: FamilyDataV2): Promise<void> => kvSet(DRAFT_KEY, raw);
export const loadDraft = (): Promise<FamilyDataV2 | undefined> => kvGet<FamilyDataV2>(DRAFT_KEY);
export const clearDraft = (): Promise<void> => kvDel(DRAFT_KEY);

// --- File System Access (save straight back to family-data.json) ---------------

const HANDLE_KEY = 'save-file-handle';

export const supportsFileSave = (): boolean => 'showSaveFilePicker' in window;

export const getSavedHandle = (): Promise<FileSystemFileHandle | undefined> =>
  kvGet<FileSystemFileHandle>(HANDLE_KEY);

export const pickSaveFile = async (): Promise<FileSystemFileHandle | null> => {
  try {
    const picker = (window as unknown as {
      showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle>;
    }).showSaveFilePicker;
    const handle = await picker({
      suggestedName: 'family-data.json',
      types: [{ description: 'Raktavruksha data', accept: { 'application/json': ['.json'] } }],
    });
    await kvSet(HANDLE_KEY, handle);
    return handle;
  } catch {
    return null; // user cancelled
  }
};

export const writeToHandle = async (
  handle: FileSystemFileHandle,
  text: string,
): Promise<boolean> => {
  try {
    const h = handle as unknown as {
      queryPermission?: (o: unknown) => Promise<string>;
      requestPermission?: (o: unknown) => Promise<string>;
      createWritable: () => Promise<{ write: (t: string) => Promise<void>; close: () => Promise<void> }>;
    };
    if (h.queryPermission && (await h.queryPermission({ mode: 'readwrite' })) !== 'granted') {
      if (!h.requestPermission || (await h.requestPermission({ mode: 'readwrite' })) !== 'granted') {
        return false;
      }
    }
    const writable = await h.createWritable();
    await writable.write(text);
    await writable.close();
    return true;
  } catch {
    return false;
  }
};

export const forgetSavedHandle = (): Promise<void> => kvDel(HANDLE_KEY);

export const downloadFile = (name: string, text: string): void => {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};
