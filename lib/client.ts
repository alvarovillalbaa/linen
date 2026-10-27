import type { OwnerSnapshot, ProfilePage, RemoteBinding, Workspace } from './types';
import { assetIds, validatePage } from './model';
import { getMedia, saveWorkspace } from './local';

export class RequestError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); }
}
export async function request<T>(path: string, method = 'GET', data?: unknown, ownerKey?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (data !== undefined) headers['Content-Type'] = 'application/json';
  if (ownerKey) headers.Authorization = `Bearer ${ownerKey}`;
  let response: Response;
  try { response = await fetch(path, { method, headers, body: data === undefined ? undefined : JSON.stringify(data), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(35_000) }); }
  catch { throw new RequestError('The connection did not finish. Your local draft is still here.', 0, 'connection'); }
  const value = await response.json().catch(() => null);
  if (!response.ok) throw new RequestError(typeof value?.error?.message === 'string' ? value.error.message : 'This request could not finish.', response.status, value?.error?.code || 'unavailable');
  return value as T;
}
export function newOwnerKey(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export async function syncPage(workspace: Workspace, progress: (text: string) => void, bindingChanged: (remote: RemoteBinding) => void): Promise<RemoteBinding> {
  const page: ProfilePage = validatePage(workspace.page);
  let remote: RemoteBinding = workspace.remote || { handle: page.handle, ownerKey: newOwnerKey(), revision: 0, publishedRevision: null };
  if (!workspace.remote) {
    // Retain the idempotent claim's private key before making a network request.
    await saveWorkspace({ ...workspace, remote, updatedAt: Date.now() }); bindingChanged(remote);
  }
  if (remote.revision === 0) {
    progress('Claiming your address…');
    const created = await request<OwnerSnapshot>('/api/profiles', 'POST', { page }, remote.ownerKey);
    if (created.page.id !== page.id || created.page.handle !== remote.handle) throw new Error('The saved page identity differs from this draft. Recover the existing page before continuing.');
    if (created.revision > 1 && JSON.stringify(validatePage(created.page)) !== JSON.stringify(page)) throw new RequestError('The cloud page has newer edits. Export this draft and recover the cloud version before saving.', 409, 'conflict');
    remote = { ...remote, revision: created.revision, publishedRevision: created.publishedRevision }; bindingChanged(remote);
    await saveWorkspace({ ...workspace, remote, updatedAt: Date.now() });
  }
  const base = `/api/profiles/${encodeURIComponent(remote.handle)}`;
  for (const id of assetIds(page)) {
    const media = await getMedia(id);
    if (!media) throw new Error('A file is missing from this device. Restore your backup before publishing.');
    progress(`Saving ${media.name}…`);
    const bytes = await media.blob.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const reserved = await request<{ uploadUrl?: string; uploaded?: boolean }>(`${base}/media`, 'POST', { id, name: media.name, type: media.type, size: media.size, sha256 }, remote.ownerKey);
    if (reserved.uploaded) continue;
    if (!reserved.uploadUrl) throw new Error('The upload could not start. Your local file is still here.');
    const target = new URL(reserved.uploadUrl);
    if (target.protocol !== 'https:' || !/^[a-z0-9-]+\.convex\.cloud$/.test(target.hostname) || target.pathname !== '/api/storage/upload' || target.username || target.password || target.port || target.hash) throw new Error('The upload destination could not be verified.');
    const upload = await fetch(target.href, { method: 'POST', headers: { 'Content-Type': media.type }, body: media.blob, redirect: 'error', signal: AbortSignal.timeout(120_000) });
    const receipt = await upload.json().catch(() => null);
    if (!upload.ok || typeof receipt?.storageId !== 'string') throw new Error('The upload did not finish. Retry to keep saving your page.');
    await request(`${base}/media`, 'PUT', { id, storageId: receipt.storageId }, remote.ownerKey);
  }
  progress('Saving your draft…');
  const saved = await request<OwnerSnapshot>(base, 'PUT', { page, revision: remote.revision }, remote.ownerKey);
  remote = { ...remote, revision: saved.revision, publishedRevision: saved.publishedRevision }; bindingChanged(remote);
  await saveWorkspace({ ...workspace, remote, updatedAt: Date.now() });
  return remote;
}
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
