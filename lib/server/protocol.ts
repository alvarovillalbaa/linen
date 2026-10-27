import type { ProfilePage } from '../types';

export const ERRORS = {
  unavailable: [503, 'Publishing is unavailable. Your local work is unchanged.'],
  invalid_input: [400, 'The request contains invalid or unsupported data.'],
  publication_invalid: [400, 'Complete required content and upload referenced media before publishing.'],
  unauthorized: [401, 'A valid owner credential is required.'],
  not_found: [404, 'This profile, preview or media is unavailable.'],
  conflict: [409, 'The draft changed. Keep your edits and reload the saved revision before retrying.'],
  handle_taken: [409, 'That handle is already reserved. Choose another handle.'],
  immutable_profile: [409, 'A claimed profile keeps its original page ID and handle.'],
  asset_id_conflict: [409, 'That media ID already belongs to different content. Import or choose a new media ID.'],
  media_referenced: [409, 'Remove this media from the draft and published page before deleting it.'],
  profile_deleting: [409, 'Deletion is pending. Retry deleting this profile.'],
  too_large: [413, 'This request or file exceeds the supported limit.'],
  quota: [429, 'The configured publishing allowance is full. Your local work is unchanged.'],
} as const;
export type ErrorCode = keyof typeof ERRORS;
export class ApiError extends Error {
  constructor(public code: ErrorCode) { super(ERRORS[code][1]); }
}
/** Explicit transport projection keeps private/unknown properties out of stored pages. */
export function pageRecord(page: ProfilePage): ProfilePage {
  return {
    version: page.version, id: page.id, handle: page.handle, name: page.name, bio: page.bio,
    location: page.location, avatarId: page.avatarId, theme: page.theme, font: page.font, accent: page.accent,
    cards: page.cards.map(card => ({ id: card.id, kind: card.kind, size: card.size, title: card.title, text: card.text, url: card.url, coverUrl: card.coverUrl, mediaId: card.mediaId, alt: card.alt, lat: card.lat, lng: card.lng })),
  };
}
export const noStore = { 'Cache-Control': 'private, no-store, max-age=0', Pragma: 'no-cache', Vary: 'Authorization', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
export function errorResponse(error: unknown): Response {
  const candidate = error instanceof ApiError ? error.code : (error as { data?: { code?: unknown } } | null)?.data?.code;
  const code: ErrorCode = typeof candidate === 'string' && Object.hasOwn(ERRORS, candidate) ? candidate as ErrorCode : 'unavailable';
  return Response.json({ error: { code, message: ERRORS[code][1] } }, { status: ERRORS[code][0], headers: noStore });
}
export function uuid(value: unknown): value is string { return typeof value === 'string' && /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(value); }
export function handle(value: unknown): value is string { return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(value); }
export function hash(value: unknown): value is string { return typeof value === 'string' && /^[\da-f]{64}$/.test(value); }
export function capability(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[\w-]{43}$/.test(value)) return false;
  try { const bytes = atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='); return bytes.length === 32 && btoa(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '') === value; } catch { return false; }
}
export async function digest(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function credentialHash(kind: 'owner' | 'preview', key: string): Promise<string> {
  if (!capability(key)) throw new ApiError('unauthorized');
  return digest(`linen:${kind}:v1:${key}`);
}
export async function limitedJson(request: Request, maximum = 140 * 1024): Promise<Record<string, unknown>> {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > maximum)) throw new ApiError('too_large');
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) throw new ApiError('invalid_input');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError('invalid_input');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const item = await reader.read(); if (item.done) break;
      size += item.value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new ApiError('too_large'); }
      chunks.push(item.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError('invalid_input');
    return value as Record<string, unknown>;
  } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError('invalid_input'); }
}
