import { assetIds, LIMITS, validatePage } from './model';
import { inspectMedia, validMediaId, validateMediaFile } from './media';
import type { MediaFile, Workspace } from './types';

const DB = 'linen.v1';
const STORES = ['workspace', 'media'];
const OWNER_KEY = /^[A-Za-z0-9_-]{43}$/;

function validateWorkspace(value: Workspace): Workspace {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !['version', 'page', 'remote', 'updatedAt'].includes(key))
    || value.version !== 1 || !Number.isSafeInteger(value.updatedAt) || value.updatedAt < 0) throw new Error('Invalid local workspace.');
  const page = validatePage(value.page);
  let remote: Workspace['remote'] = null;
  if (value.remote !== null) {
    const binding = value.remote;
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)
      || Object.keys(binding).some(key => !['handle', 'ownerKey', 'revision', 'publishedRevision'].includes(key))
      || typeof binding.handle !== 'string' || typeof binding.ownerKey !== 'string'
      || !/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(binding.handle) || !OWNER_KEY.test(binding.ownerKey)
      || !Number.isSafeInteger(binding.revision) || binding.revision < 0
      || (binding.publishedRevision !== null && (!Number.isSafeInteger(binding.publishedRevision) || binding.publishedRevision < 0 || binding.publishedRevision > binding.revision))) throw new Error('Invalid private publishing binding.');
    remote = { ...binding };
  }
  return { version: 1, page, remote, updatedAt: value.updatedAt };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Browser storage is unavailable. Keep this draft open and export a backup.')); return; }
    let request: IDBOpenDBRequest, abandoned = false;
    try { request = indexedDB.open(DB, 1); } catch (error) { reject(error); return; }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('workspace')) db.createObjectStore('workspace');
      if (!db.objectStoreNames.contains('media')) db.createObjectStore('media', { keyPath: 'id' });
    };
    request.onerror = () => reject(request.error || new Error('Browser storage could not open.'));
    request.onblocked = () => { abandoned = true; reject(new Error('Another Linen tab is blocking browser storage. Close it and retry.')); };
    request.onsuccess = () => {
      const db = request.result;
      if (abandoned) { db.close(); return; }
      db.onversionchange = () => db.close(); resolve(db);
    };
  });
}

async function transaction<T>(names: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction, result: (value: T) => void, fail: (error: unknown) => void) => void): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction, result: T | undefined, failure: unknown;
    const fail = (error: unknown) => { failure = error; try { tx.abort(); } catch { db.close(); reject(error); } };
    try { tx = db.transaction(names, mode); } catch (error) { db.close(); reject(error); return; }
    tx.oncomplete = () => { db.close(); resolve(result as T); };
    tx.onabort = () => { db.close(); reject(failure || tx.error || new Error('Browser storage did not save.')); };
    tx.onerror = () => { failure ||= tx.error || new Error('Browser storage did not save.'); };
    try { work(tx, value => { result = value; }, fail); } catch (error) { fail(error); }
  });
}

export async function loadWorkspace(): Promise<Workspace | null> {
  const value = await transaction<Workspace | undefined>(['workspace'], 'readonly', (tx, result) => {
    const request = tx.objectStore('workspace').get('current'); request.onsuccess = () => result(request.result);
  });
  return value === undefined ? null : validateWorkspace(value);
}

export async function saveWorkspace(workspace: Workspace): Promise<void> {
  const value = validateWorkspace(workspace);
  await transaction<void>(['workspace'], 'readwrite', tx => { tx.objectStore('workspace').put(value, 'current'); });
}

export async function putMedia(file: File): Promise<MediaFile> {
  const inspected = await inspectMedia(file);
  const value = await validateMediaFile({ id: crypto.randomUUID(), name: file.name, type: inspected.type, size: inspected.size, blob: file, createdAt: Date.now() });
  await transaction<void>(['media'], 'readwrite', (tx, _result, fail) => {
    const store = tx.objectStore('media'), request = store.getAll();
    request.onsuccess = () => {
      try {
        const total = request.result.reduce((sum: number, item: MediaFile) => {
          if (!Number.isSafeInteger(item.size) || item.size <= 0 || !(item.blob instanceof Blob) || item.size !== item.blob.size) throw new Error('Stored media could not be validated.');
          return sum + item.size;
        }, value.size);
        if (total > LIMITS.mediaBytes) throw new Error('This page can store at most 64 MiB of media. Remove unused uploads and retry.');
        store.add(value);
      } catch (error) { fail(error); }
    };
  });
  return value;
}

export async function getMedia(id: string): Promise<MediaFile | null> {
  if (!validMediaId(id)) throw new Error('Invalid media identity.');
  const value = await transaction<MediaFile | undefined>(['media'], 'readonly', (tx, result) => {
    const request = tx.objectStore('media').get(id); request.onsuccess = () => result(request.result);
  });
  return value === undefined ? null : validateMediaFile(value);
}

export async function listMedia(): Promise<MediaFile[]> {
  const values = await transaction<MediaFile[]>(['media'], 'readonly', (tx, result) => {
    const request = tx.objectStore('media').getAll(); request.onsuccess = () => result(request.result);
  });
  const checked: MediaFile[] = [];
  let total = 0;
  for (const value of values) { const item = await validateMediaFile(value); total += item.size; checked.push(item); }
  if (total > LIMITS.mediaBytes) throw new Error('Stored media exceeds this page’s 64 MiB limit.');
  return checked;
}

export async function deleteMedia(id: string): Promise<void> {
  if (!validMediaId(id)) throw new Error('Invalid media identity.');
  await transaction<void>(['media'], 'readwrite', tx => { tx.objectStore('media').delete(id); });
}

export async function removeWorkspace(): Promise<void> {
  await transaction<void>(STORES, 'readwrite', tx => { for (const name of STORES) tx.objectStore(name).clear(); });
}

export async function replaceWorkspace(workspace: Workspace, media: MediaFile[]): Promise<void> {
  const value = validateWorkspace(workspace), checked: MediaFile[] = [], ids = new Set<string>();
  let total = 0;
  if (!Array.isArray(media) || media.length > LIMITS.cards + 1) throw new Error('Invalid imported media collection.');
  for (const item of media) {
    const file = await validateMediaFile(item);
    if ([...ids].some(id => id.toLowerCase() === file.id.toLowerCase())) throw new Error('Duplicate imported media identity.');
    ids.add(file.id); total += file.size; checked.push(file);
  }
  const references = assetIds(value.page);
  if (total > LIMITS.mediaBytes || references.length !== ids.size || references.some(id => !ids.has(id))) throw new Error('The imported media does not match this page.');
  await transaction<void>(STORES, 'readwrite', tx => {
    for (const name of STORES) tx.objectStore(name).clear();
    tx.objectStore('workspace').put(value, 'current');
    for (const file of checked) tx.objectStore('media').add(file);
  });
}
