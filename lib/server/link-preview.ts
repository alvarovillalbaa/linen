import 'server-only';
import { safeHref } from '../model';
import { ApiError } from './protocol';

type Preview = { url: string; title: string; description: string; image: string; provider: 'github' | 'youtube' | 'vimeo' | 'spotify' | 'manual'; manual: boolean };
const cache = new Map<string, { expires: number; value: Preview }>();
const text = (value: unknown, maximum: number) => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, maximum) : '';
function image(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && ['avatars.githubusercontent.com', 'i.ytimg.com', 'img.youtube.com', 'i.vimeocdn.com', 'i.scdn.co', 'image-cdn-ak.spotifycdn.com'].includes(url.hostname) ? url.href : '';
  } catch { return ''; }
}
function endpoint(url: URL): { url: URL; provider: Preview['provider'] } | null {
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return null;
  if (['github.com', 'www.github.com'].includes(url.hostname)) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 1 || parts.length > 2 || !/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(parts[0])) return null;
    if (parts.length === 2 && (!/^[a-z\d_.-]{1,100}$/i.test(parts[1]) || ['.', '..'].includes(parts[1]))) return null;
    return { provider: 'github', url: new URL(parts.length === 2 ? `https://api.github.com/repos/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}` : `https://api.github.com/users/${encodeURIComponent(parts[0])}`) };
  }
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname)) {
    const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(?:shorts|embed)\/([\w-]{11})\/?$/.exec(url.pathname)?.[1];
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    const target = new URL('https://www.youtube.com/oembed'); target.searchParams.set('url', `https://www.youtube.com/watch?v=${id}`); target.searchParams.set('format', 'json');
    return { provider: 'youtube', url: target };
  }
  if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(url.hostname)) {
    const id = /^\/(?:video\/)?(\d{1,12})\/?$/.exec(url.pathname)?.[1]; if (!id) return null;
    const target = new URL('https://vimeo.com/api/oembed.json'); target.searchParams.set('url', `https://vimeo.com/${id}`);
    return { provider: 'vimeo', url: target };
  }
  if (url.hostname === 'open.spotify.com') {
    const match = /^\/(?:intl-[a-z]{2}\/)?(track|album|playlist|artist|episode|show)\/([a-z\d]{22})\/?$/i.exec(url.pathname); if (!match) return null;
    const target = new URL('https://open.spotify.com/oembed'); target.searchParams.set('url', `https://open.spotify.com/${match[1].toLowerCase()}/${match[2]}`);
    return { provider: 'spotify', url: target };
  }
  return null;
}
async function metadata(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok || !response.headers.get('content-type')?.toLowerCase().includes('json')) throw new Error();
  const reader = response.body?.getReader(); if (!reader) throw new Error();
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const item = await reader.read(); if (item.done) break;
    size += item.value.length;
    if (size > 256 * 1024) { await reader.cancel(); throw new Error(); }
    chunks.push(item.value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
  return value as Record<string, unknown>;
}
export async function linkPreview(input: string): Promise<Preview> {
  if (input.length > 2048) throw new ApiError('invalid_input');
  const href = safeHref(input); if (!href) throw new ApiError('invalid_input');
  const fallback: Preview = { url: href, title: '', description: '', image: '', provider: 'manual', manual: true };
  let url: URL;
  try { url = new URL(href); } catch { return fallback; }
  const source = endpoint(url);
  fallback.provider = source?.provider ?? 'manual';
  if (!source) return fallback;
  const saved = cache.get(source.url.href); if (saved && saved.expires > Date.now()) return { ...saved.value, url: href };
  try {
    const response = await fetch(source.url, { headers: { Accept: 'application/json', 'User-Agent': 'Linen-Link-Preview' }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(5_000) });
    const data = await metadata(response), owner = data.owner as Record<string, unknown> | undefined;
    const value: Preview = { url: href, title: text(source.provider === 'github' ? data.full_name ?? data.name ?? data.login : data.title, 200), description: text(data.description ?? data.bio ?? data.author_name, 2000), image: image(data.thumbnail_url ?? data.avatar_url ?? owner?.avatar_url), provider: source.provider, manual: false };
    value.manual = !value.title;
    if (cache.size >= 40) cache.delete(cache.keys().next().value!);
    cache.set(source.url.href, { value, expires: Date.now() + 30 * 60 * 1000 });
    return value;
  } catch { return fallback; }
}
