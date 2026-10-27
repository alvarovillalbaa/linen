import 'server-only';
import { validatePage } from '../model';
import type { AssetManifest, OwnerSnapshot, PublicSnapshot } from '../types';
import { ApiError, capability, credentialHash, ERRORS, errorResponse, handle as validHandle, limitedJson, noStore, pageRecord, uuid } from './protocol';

function origin(value: string | undefined, convex = false): string | null {
  try {
    const url = new URL(value ?? '');
    const local = !convex && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    if (convex && (!/^[a-z0-9-]+\.convex\.site$/.test(url.hostname) || url.port)) return null;
    return url.origin;
  } catch { return null; }
}
function bindings() {
  const site = origin(process.env.LINEN_CONVEX_SITE_URL, true), publicSite = origin(process.env.LINEN_SITE_URL), secret = process.env.LINEN_RELAY_SECRET;
  return process.env.LINEN_PUBLISHING_ENABLED === 'true' && site && publicSite && capability(secret) ? { site, publicSite, secret } : null;
}
export function publishingConfigured(): boolean { return bindings() !== null; }
export function checkedHandle(value: string): string { if (!validHandle(value)) throw new ApiError('not_found'); return value; }
export function ownerKey(request: Request, required = true): string | null {
  const header = request.headers.get('authorization');
  if (!header && !required) return null;
  const key = header?.match(/^Bearer ([\w-]{43})$/i)?.[1];
  if (!capability(key)) throw new ApiError('unauthorized');
  return key;
}
export async function ownerProof(request: Request) { return credentialHash('owner', ownerKey(request)!); }
export async function api(operation: () => Promise<Response>): Promise<Response> { try { return await operation(); } catch (error) { return errorResponse(error); } }
export function json(value: unknown, status = 200): Response { return Response.json(value, { status, headers: noStore }); }
export { limitedJson };

async function boundedResponse(response: Response, maximum = 256 * 1024): Promise<unknown> {
  const reader = response.body?.getReader(); if (!reader) throw new ApiError('unavailable');
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const item = await reader.read(); if (item.done) break;
    size += item.value.byteLength;
    if (size > maximum) { await reader.cancel(); throw new ApiError('unavailable'); }
    chunks.push(item.value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new ApiError('unavailable'); }
}
export async function rpc(op: string, data: Record<string, unknown>): Promise<any> {
  const config = bindings(); if (!config) throw new ApiError('unavailable');
  let response: Response;
  try {
    response = await fetch(`${config.site}/linen/rpc`, { method: 'POST', headers: { authorization: `Bearer ${config.secret}`, 'content-type': 'application/json' }, body: JSON.stringify({ op, data }), redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(25_000) });
  } catch { throw new ApiError('unavailable'); }
  const value = await boundedResponse(response) as any;
  if (!response.ok) {
    const code = value?.error?.code;
    // Convert only known codes; never echo an upstream body or configuration.
    throw new ApiError(typeof code === 'string' && Object.hasOwn(ERRORS, code) ? code as keyof typeof ERRORS : 'unavailable');
  }
  return value;
}
function assets(value: unknown, name: string, previewKey?: string): AssetManifest[] {
  if (!Array.isArray(value) || value.length > 64) throw new ApiError('unavailable');
  return value.map(item => {
    if (!item || !uuid(item.id) || typeof item.name !== 'string' || item.name.length > 255 || !['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'].includes(item.type) || !Number.isSafeInteger(item.size) || item.size < 1 || item.size > 32 * 1024 * 1024) throw new ApiError('unavailable');
    const url = `/api/media/${encodeURIComponent(name)}/${encodeURIComponent(item.id)}${previewKey ? `?preview=${encodeURIComponent(previewKey)}` : ''}`;
    return { id: item.id, name: item.name, type: item.type, size: item.size, url };
  });
}
export function ownerSnapshot(value: any, name?: string): OwnerSnapshot {
  if (!value || !Number.isSafeInteger(value.revision) || value.revision < 1 || (value.publishedRevision !== null && (!Number.isSafeInteger(value.publishedRevision) || value.publishedRevision < 1 || value.publishedRevision > value.revision))) throw new ApiError('unavailable');
  const page = pageRecord(validatePage(value.page)); if (!validHandle(page.handle) || (name && page.handle !== name)) throw new ApiError('unavailable');
  return { page, revision: value.revision, publishedRevision: value.publishedRevision, assets: assets(value.assets, page.handle) };
}
function publicSnapshot(value: any, name: string, key?: string): PublicSnapshot | null {
  if (value === null) return null;
  if (!value || !Number.isSafeInteger(value.revision) || value.revision < 1) throw new ApiError('unavailable');
  const page = pageRecord(validatePage(value.page)); if (page.handle !== name) throw new ApiError('unavailable');
  return { page, revision: value.revision, assets: assets(value.assets, name, key) };
}
export async function getPublicProfile(name: string): Promise<PublicSnapshot | null> {
  if (!validHandle(name) || !publishingConfigured()) return null;
  return publicSnapshot(await rpc('public', { handle: name }), name);
}
export async function getPreviewProfile(name: string, key: string): Promise<PublicSnapshot | null> {
  if (!validHandle(name) || !capability(key) || !publishingConfigured()) return null;
  return publicSnapshot(await rpc('preview', { handle: name, previewHash: await credentialHash('preview', key) }), name, key);
}
export async function reserveMedia(name: string, proof: string, body: Record<string, unknown>) {
  const result = await rpc('reserve', { ...body, handle: name, ownerHash: proof });
  if (result?.uploaded === true) return { uploaded: true };
  const config = bindings()!;
  try {
    const url = new URL(result?.uploadUrl);
    if (url.protocol !== 'https:' || url.origin !== config.site.replace(/\.site$/, '.cloud') || url.pathname !== '/api/storage/upload' || url.username || url.password || url.hash) throw new Error();
    return { uploadUrl: url.href };
  } catch { throw new ApiError('unavailable'); }
}
export async function createPreview(name: string, proof: string) {
  const config = bindings(); if (!config) throw new ApiError('unavailable');
  const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  await rpc('previewToken', { handle: name, ownerHash: proof, previewHash: await credentialHash('preview', key) });
  return { url: `${config.publicSite}/preview/${name}?key=${key}` };
}
export async function remoteMedia(request: Request, name: string, id: string): Promise<Response> {
  checkedHandle(name); if (!uuid(id)) throw new ApiError('not_found');
  const config = bindings(); if (!config) throw new ApiError('unavailable');
  const url = new URL(`${config.site}/linen/media`); url.searchParams.set('handle', name); url.searchParams.set('id', id);
  const headers = new Headers({ authorization: `Bearer ${config.secret}` });
  const key = ownerKey(request, false), preview = new URL(request.url).searchParams.get('preview');
  if (key) headers.set('x-linen-owner', await credentialHash('owner', key));
  if (preview) { if (!capability(preview)) throw new ApiError('not_found'); headers.set('x-linen-preview', await credentialHash('preview', preview)); }
  const range = request.headers.get('range'); if (range) { if (range.length > 100) throw new ApiError('invalid_input'); headers.set('range', range); }
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15_000);
  const cancel = () => controller.abort(); request.signal.addEventListener('abort', cancel, { once: true });
  try {
    const response = await fetch(url, { headers, cache: 'no-store', redirect: 'error', signal: controller.signal });
    clearTimeout(timer);
    if (![200, 206, 416].includes(response.status)) { await response.body?.cancel(); throw new ApiError(response.status === 404 ? 'not_found' : 'unavailable'); }
    const output = new Headers(noStore);
    for (const field of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'content-disposition']) { const value = response.headers.get(field); if (value) output.set(field, value); }
    return new Response(response.body, { status: response.status, headers: output });
  } catch (error) { clearTimeout(timer); if (error instanceof ApiError) throw error; throw new ApiError('unavailable'); }
}
