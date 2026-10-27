import type { Card, CardKind, CardSize, Placement, ProfilePage } from './types';

export const LIMITS = Object.freeze({ cards: 32, pageBytes: 128 * 1024, imageBytes: 8 * 1024 * 1024, videoBytes: 32 * 1024 * 1024, mediaBytes: 64 * 1024 * 1024 });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HANDLE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const KINDS: CardKind[] = ['link', 'text', 'image', 'video', 'embed', 'map', 'section'];
const SIZES: CardSize[] = ['small', 'wide', 'tall', 'large'];
const PAGE_FIELDS = ['version', 'id', 'handle', 'name', 'bio', 'location', 'avatarId', 'theme', 'font', 'accent', 'cards'];
const CARD_FIELDS = ['id', 'kind', 'size', 'title', 'text', 'url', 'coverUrl', 'mediaId', 'alt', 'lat', 'lng'];
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

function record(value: unknown, fields: string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`${label} must be a plain object.`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== fields.length || keys.some(key => typeof key !== 'string' || !fields.includes(key))) throw new Error(`${label} has missing or unknown fields.`);
  const result: Record<string, unknown> = {};
  for (const key of fields) {
    const descriptor = descriptors[key];
    if (!descriptor || !('value' in descriptor)) throw new Error(`${label}.${key} must be a data field.`);
    result[key] = descriptor.value;
  }
  return result;
}
function string(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label} must be text of at most ${max} characters.`);
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error(`${label} contains an incomplete Unicode character.`);
    } else if (code >= 0xdc00 && code <= 0xdfff) throw new Error(`${label} contains an incomplete Unicode character.`);
  }
  return value;
}
function identifier(value: unknown, label: string, optional = false): string {
  if (typeof value !== 'string' || !(optional && value === '') && !UUID.test(value)) throw new Error(`${label} must be a UUID${optional ? ' or empty' : ''}.`);
  return value;
}
function choice<T extends string>(value: unknown, choices: readonly T[], label: string): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new Error(`${label} is not supported.`);
  return value as T;
}
function coordinate(value: unknown, limit: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > limit) throw new Error(`${label} must be between ${-limit} and ${limit}.`);
  return value;
}

export function createCard(kind: CardKind): Card {
  if (!KINDS.includes(kind)) throw new Error('This card type is not supported.');
  return { id: crypto.randomUUID(), kind, size: kind === 'image' || kind === 'video' || kind === 'embed' ? 'large' : 'wide', title: '', text: '', url: '', coverUrl: '', mediaId: '', alt: '', lat: 0, lng: 0 };
}
export function blankPage(): ProfilePage {
  return { version: 1, id: crypto.randomUUID(), handle: '', name: '', bio: '', location: '', avatarId: '', theme: 'paper', font: 'sans', accent: '#C66D4A', cards: [] };
}

/** Validate bounded editable data without trimming or discarding unfinished text. */
export function validatePage(value: unknown): ProfilePage {
  const source = record(value, PAGE_FIELDS, 'Page');
  if (source.version !== 1) throw new Error('This page version is not supported.');
  if (!Array.isArray(source.cards) || Object.getPrototypeOf(source.cards) !== Array.prototype || source.cards.length > LIMITS.cards) throw new Error(`A page supports at most ${LIMITS.cards} cards.`);
  const arrayFields = Object.getOwnPropertyDescriptors(source.cards);
  if (Reflect.ownKeys(arrayFields).length !== source.cards.length + 1) throw new Error('Cards must be a plain dense array.');
  const cards: Card[] = [], ids = new Set<string>();
  for (let index = 0; index < source.cards.length; index++) {
    const descriptor = arrayFields[String(index)];
    if (!descriptor || !('value' in descriptor)) throw new Error('Cards must contain data items without gaps.');
    const label = `Card ${index + 1}`, card = record(descriptor.value, CARD_FIELDS, label);
    const id = identifier(card.id, `${label} ID`);
    if (ids.has(id.toLowerCase())) throw new Error('Every card must have a unique ID.');
    ids.add(id.toLowerCase());
    cards.push({ id, kind: choice(card.kind, KINDS, `${label} type`), size: choice(card.size, SIZES, `${label} size`),
      title: string(card.title, 200, `${label} title`), text: string(card.text, 6000, `${label} text`),
      url: string(card.url, 2048, `${label} URL`), coverUrl: string(card.coverUrl, 2048, `${label} cover image URL`), mediaId: identifier(card.mediaId, `${label} media ID`, true),
      alt: string(card.alt, 500, `${label} alt text`), lat: coordinate(card.lat, 90, `${label} latitude`), lng: coordinate(card.lng, 180, `${label} longitude`) });
  }
  const page: ProfilePage = { version: 1, id: identifier(source.id, 'Page ID'), handle: string(source.handle, 30, 'Handle'),
    name: string(source.name, 120, 'Name'), bio: string(source.bio, 2000, 'Biography'), location: string(source.location, 160, 'Location'),
    avatarId: identifier(source.avatarId, 'Avatar ID', true), theme: choice(source.theme, ['paper', 'oat', 'night', 'rose'], 'Theme'),
    font: choice(source.font, ['sans', 'serif'], 'Font'), accent: string(source.accent, 32, 'Accent'), cards };
  if (new TextEncoder().encode(JSON.stringify(page)).byteLength > LIMITS.pageBytes) throw new Error('The page exceeds the 128 KiB data limit.');
  return page;
}

export function normalizeHandle(value: string): string {
  return typeof value === 'string' ? value.trim().replace(/^@/, '').toLowerCase() : '';
}
function parsedUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || value.length > 2048 || CONTROL.test(value) || value.includes('\\')) return null;
  try {
    const url = new URL(value.trim());
    return url.username || url.password ? null : url;
  } catch { return null; }
}
export function safeHref(value: string): string | null {
  const url = parsedUrl(value);
  if (!url) return null;
  if ((url.protocol === 'https:' || url.protocol === 'http:') && /^https?:\/\//i.test(value.trim()) && url.hostname) return url.href;
  if (url.protocol === 'mailto:' && !url.hash) {
    try {
      const address = decodeURIComponent(url.pathname);
      if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(address)) return null;
      for (const [key, entry] of url.searchParams) if (!['subject', 'body'].includes(key) || key === 'subject' && CONTROL.test(entry)) return null;
      return url.href;
    } catch { return null; }
  }
  if (url.protocol === 'tel:' && !url.search && !url.hash) {
    try {
      const phone = decodeURIComponent(url.pathname);
      if (!/^\+?[0-9(). -]+(?:;ext=[0-9]{1,8})?$/.test(phone)) return null;
      const [number, extension] = phone.split(';ext=');
      if (number.replace(/\D/g, '').length < 3 || number.replace(/\D/g, '').length > 18) return null;
      return `tel:${number.replace(/[(). -]/g, '')}${extension ? `;ext=${extension}` : ''}`;
    } catch { return null; }
  }
  return null;
}
function httpsUrl(value: string): string | null {
  const result = safeHref(value);
  return result && result.startsWith('https://') ? result : null;
}
export function safeImageUrl(value: string): string | null {
  const remote = httpsUrl(value);
  if (remote) return remote;
  if (typeof value !== 'string' || !value || value.length > 4096 || CONTROL.test(value) || value.includes('\\')) return null;
  const input = value.trim();
  if (/^blob:(?:https?:\/\/[^/]+|null)\/[0-9a-f-]{36}$/i.test(input)) {
    const inner = input.slice(5);
    return inner.startsWith('null/') || parsedUrl(inner) ? input : null;
  }
  if (input.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(input)) return null;
  try {
    const path = decodeURIComponent(input.split(/[?#]/, 1)[0]);
    if (!path || path.includes('\\') || CONTROL.test(path) || path.startsWith('//') || /(?:^|\/)\.\.(?:\/|$)/.test(path) || path.includes(':')) return null;
    const base = new URL(input, 'https://linen.invalid/');
    return base.origin === 'https://linen.invalid' ? input : null;
  } catch { return null; }
}

type Embed = { src: string; title: string; provider: 'youtube' | 'vimeo' | 'spotify' | 'soundcloud' };
export function embedFor(value: string): Embed | null {
  const safe = httpsUrl(value);
  if (!safe) return null;
  const url = new URL(safe), host = url.hostname.toLowerCase();
  if (url.port) return null;
  const path = url.pathname.split('/').filter(Boolean);
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be'].includes(host)) {
    const id = host === 'youtu.be' && path.length === 1 ? path[0] : path[0] === 'watch' ? url.searchParams.get('v') : ['embed', 'shorts', 'live'].includes(path[0]) && path.length === 2 ? path[1] : null;
    if (id && !(path[0] === 'embed' && id === 'videoseries') && /^[a-z0-9_-]{11}$/i.test(id)) {
      const src = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
      const start = url.searchParams.get('start');
      if (start && /^\d{1,5}$/.test(start)) src.searchParams.set('start', String(Number(start)));
      return { src: src.href, title: 'YouTube video', provider: 'youtube' };
    }
    const list = url.searchParams.get('list');
    if ((path[0] === 'playlist' || path.join('/') === 'embed/videoseries') && list && /^[a-z0-9_-]{10,128}$/i.test(list)) return { src: `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(list)}`, title: 'YouTube playlist', provider: 'youtube' };
  }
  if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
    let id: string | undefined, hash = url.searchParams.get('h') || '';
    if (host === 'player.vimeo.com' && path.length === 2 && path[0] === 'video') id = path[1];
    else if (host !== 'player.vimeo.com' && path.length <= 2) { id = path[0]; hash ||= path[1] || ''; }
    else if (path[0] === 'channels' && path.length === 3 || path[0] === 'groups' && path.length === 4 && path[2] === 'videos') id = path.at(-1);
    if (id && /^[1-9]\d{0,11}$/.test(id) && (!hash || /^[a-z0-9]{6,64}$/i.test(hash))) return { src: `https://player.vimeo.com/video/${id}${hash ? `?h=${encodeURIComponent(hash)}` : ''}`, title: 'Vimeo video', provider: 'vimeo' };
  }
  if (host === 'open.spotify.com') {
    if (/^intl-[a-z-]{2,10}$/i.test(path[0])) path.shift();
    if (path[0] === 'embed') path.shift();
    if (path.length === 2 && ['track', 'album', 'playlist', 'artist', 'episode', 'show'].includes(path[0]) && /^[a-z0-9]{22}$/i.test(path[1])) return { src: `https://open.spotify.com/embed/${path[0]}/${path[1]}`, title: 'Spotify player', provider: 'spotify' };
  }
  if (host === 'w.soundcloud.com' && path.length === 1 && path[0] === 'player') {
    const target = url.searchParams.get('url') || '', inner = parsedUrl(target);
    if (!inner || !['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com', 'api.soundcloud.com'].includes(inner.hostname)) return null;
    return embedFor(target);
  }
  if (['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com', 'api.soundcloud.com'].includes(host)) {
    const api = host === 'api.soundcloud.com' && path.length === 2 && ['tracks', 'playlists'].includes(path[0]) && /^\d+$/.test(path[1]);
    const permalink = host !== 'api.soundcloud.com' && (path.length === 2 || path.length === 3 && path[1] === 'sets') && path.every(part => /^[a-z0-9_-]{1,200}$/i.test(part)) && !['search', 'discover', 'charts', 'you', 'upload', 'settings', 'stations', 'pages'].includes(path[0]);
    if (api || permalink) {
      const target = `https://${api ? 'api.soundcloud.com' : 'soundcloud.com'}/${path.join('/')}`;
      return { src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(target)}&auto_play=false&show_user=true`, title: 'SoundCloud player', provider: 'soundcloud' };
    }
  }
  return null;
}

export function assetIds(page: ProfilePage): string[] {
  const result: string[] = [], seen = new Set<string>();
  for (const value of [page.avatarId, ...page.cards.map(card => card.mediaId)]) {
    identifier(value, 'Media ID', true);
    if (value && !seen.has(value)) { seen.add(value); result.push(value); }
  }
  return result;
}
export function publicationIssues(value: ProfilePage, mediaIds?: Iterable<string>): string[] {
  let page: ProfilePage;
  try { page = validatePage(value); } catch (error) { return [error instanceof Error ? error.message : 'The page is invalid.']; }
  const issues: string[] = [];
  if (!HANDLE.test(page.handle)) issues.push('Choose a lower-case handle of 3–30 letters, digits or hyphens, beginning and ending with a letter or digit.');
  if (!page.name.trim()) issues.push('Add your name before publishing.');
  if (!/^#[0-9a-f]{6}$/i.test(page.accent)) issues.push('Choose a complete six-digit accent color.');
  if (!page.cards.some(card => card.kind !== 'section')) issues.push('Add at least one content card before publishing.');
  for (const [index, card] of page.cards.entries()) {
    const label = `Card ${index + 1}`;
    if (card.coverUrl && !httpsUrl(card.coverUrl)) issues.push(`${label}: use a valid HTTPS cover image URL or leave it empty.`);
    if (card.kind === 'link') {
      if (!safeHref(card.url)) issues.push(`${label}: add a valid web, email or telephone link.`);
      if (!card.title.trim()) issues.push(`${label}: add a link title.`);
    } else if (card.kind === 'image' || card.kind === 'video') {
      if (!card.mediaId && !httpsUrl(card.url)) issues.push(`${label}: upload ${card.kind === 'image' ? 'an image' : 'a video'} or add a valid HTTPS media URL.`);
      if (card.mediaId && card.url.trim() && !safeHref(card.url)) issues.push(`${label}: correct or remove the optional destination link.`);
      if (card.kind === 'image' && !card.alt.trim() && !card.title.trim()) issues.push(`${label}: add alt text or a title describing the image.`);
      if (card.kind === 'video' && !card.title.trim()) issues.push(`${label}: add a video title.`);
    } else if (card.kind === 'embed') {
      if (!httpsUrl(card.url)) issues.push(`${label}: add a valid HTTPS link for the embed or its outbound fallback.`);
    } else if (card.kind === 'map') {
      if (!card.title.trim()) issues.push(`${label}: add a location label.`);
      if (card.url.trim() && !safeHref(card.url)) issues.push(`${label}: correct or remove the optional location link.`);
    } else if (card.kind === 'text' && !card.title.trim() && !card.text.trim()) issues.push(`${label}: add some text.`);
    else if (card.kind === 'section' && !card.title.trim()) issues.push(`${label}: add a section heading.`);
  }
  if (mediaIds !== undefined) {
    const available = new Set(mediaIds);
    for (const id of assetIds(page)) if (!available.has(id)) issues.push(`Referenced media ${id} is missing. Upload or restore it before publishing.`);
  }
  return issues;
}

export function packCards(cards: readonly Card[], columns: number): Placement[] {
  if (columns !== 2 && columns !== 4) throw new Error('Layouts support two or four columns.');
  if (cards.length > LIMITS.cards) throw new Error(`A page supports at most ${LIMITS.cards} cards.`);
  const occupied = new Set<number>(), placements: Placement[] = [];
  let cursor = 0;
  for (const card of cards) {
    if (!SIZES.includes(card.size)) throw new Error('This card size is not supported.');
    const width = Math.min(columns, card.size === 'small' || card.size === 'tall' ? 1 : 2);
    const height = card.size === 'tall' || card.size === 'large' ? 2 : 1;
    let position = cursor;
    for (; position < LIMITS.cards * 2 * columns; position++) {
      const column = position % columns;
      if (column + width > columns) continue;
      let free = true;
      for (let row = 0; row < height; row++) for (let x = 0; x < width; x++) if (occupied.has(position + row * columns + x)) free = false;
      if (free) break;
    }
    if (position >= LIMITS.cards * 2 * columns) throw new Error('The layout exceeds its row limit.');
    for (let row = 0; row < height; row++) for (let x = 0; x < width; x++) occupied.add(position + row * columns + x);
    placements.push({ id: card.id, column: position % columns + 1, row: Math.floor(position / columns) + 1, columns: width, rows: height });
    // Never backfill an earlier gap with a later card: visual reading order
    // must agree with the source, keyboard and portable-export order.
    cursor = position + width;
  }
  return placements;
}
export function moveCard(page: ProfilePage, id: string, toIndex: number): ProfilePage {
  const from = page.cards.findIndex(card => card.id === id);
  if (from < 0 || !Number.isFinite(toIndex)) return page;
  const target = Math.max(0, Math.min(page.cards.length - 1, Math.trunc(toIndex)));
  if (target === from) return page;
  const cards = [...page.cards], [card] = cards.splice(from, 1);
  cards.splice(target, 0, card);
  return { ...page, cards };
}
export function resizeCard(page: ProfilePage, id: string, size: CardSize): ProfilePage {
  if (!SIZES.includes(size)) throw new Error('This card size is not supported.');
  const index = page.cards.findIndex(card => card.id === id);
  if (index < 0 || page.cards[index].size === size) return page;
  return { ...page, cards: page.cards.map((card, position) => position === index ? { ...card, size } : card) };
}
