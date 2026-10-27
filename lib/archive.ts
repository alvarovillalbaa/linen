import { assetIds, LIMITS, validatePage } from './model';
import { mediaExtension, validMediaId, validateMediaFile } from './media';
import type { MediaFile, ProfilePage } from './types';

type Entry = { path: string; bytes: Uint8Array };
type Metadata = { id: string; name: string; type: string; size: number; createdAt: number; path: string };
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const MAX_ENTRIES = LIMITS.cards + 4;
const MAX_JSON = LIMITS.pageBytes + 65536;
const MAX_ARCHIVE = LIMITS.mediaBytes + 2 * 1024 * 1024;
const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index++) {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[index] = value >>> 0;
}
function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
function safePath(path: string): boolean {
  return path.length > 0 && path.length <= 160 && !/[\\\u0000-\u001f\u007f]/.test(path)
    && !path.startsWith('/') && !path.includes(':') && path.split('/').every(part => part && part !== '.' && part !== '..');
}
function zip(entries: Entry[]): Blob {
  if (!entries.length || entries.length > MAX_ENTRIES || new Set(entries.map(entry => entry.path.toLowerCase())).size !== entries.length) throw new Error('Invalid archive entry count or duplicate portable path.');
  let localSize = 0, centralSize = 0;
  const prepared = entries.map(entry => {
    if (!safePath(entry.path)) throw new Error('Unsafe archive path.');
    const name = encoder.encode(entry.path), checksum = crc32(entry.bytes);
    const result = { ...entry, name, checksum, offset: localSize };
    localSize += 30 + name.length + entry.bytes.length;
    centralSize += 46 + name.length;
    return result;
  });
  const total = localSize + centralSize + 22;
  if (total > MAX_ARCHIVE) throw new Error('This archive exceeds the supported size.');
  const bytes = new Uint8Array(total), view = new DataView(bytes.buffer);
  let position = 0;
  for (const entry of prepared) {
    view.setUint32(position, 0x04034b50, true); view.setUint16(position + 4, 20, true);
    view.setUint16(position + 6, 0x0800, true); view.setUint16(position + 12, 33, true);
    view.setUint32(position + 14, entry.checksum, true);
    view.setUint32(position + 18, entry.bytes.length, true); view.setUint32(position + 22, entry.bytes.length, true);
    view.setUint16(position + 26, entry.name.length, true);
    bytes.set(entry.name, position + 30); bytes.set(entry.bytes, position + 30 + entry.name.length);
    position += 30 + entry.name.length + entry.bytes.length;
  }
  for (const entry of prepared) {
    view.setUint32(position, 0x02014b50, true); view.setUint16(position + 4, 20, true); view.setUint16(position + 6, 20, true);
    view.setUint16(position + 8, 0x0800, true); view.setUint16(position + 14, 33, true);
    view.setUint32(position + 16, entry.checksum, true);
    view.setUint32(position + 20, entry.bytes.length, true); view.setUint32(position + 24, entry.bytes.length, true);
    view.setUint16(position + 28, entry.name.length, true); view.setUint32(position + 42, entry.offset, true);
    bytes.set(entry.name, position + 46); position += 46 + entry.name.length;
  }
  view.setUint32(position, 0x06054b50, true);
  view.setUint16(position + 8, entries.length, true); view.setUint16(position + 10, entries.length, true);
  view.setUint32(position + 12, centralSize, true); view.setUint32(position + 16, localSize, true);
  return new Blob([bytes.buffer], { type: 'application/zip' });
}

async function unzip(blob: Blob): Promise<Map<string, Uint8Array>> {
  if (!(blob instanceof Blob) || blob.size < 22 || blob.size > MAX_ARCHIVE) throw new Error('This ZIP is empty or exceeds the supported size.');
  const bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer);
  let end = -1;
  for (let position = bytes.length - 22; position >= Math.max(0, bytes.length - 65557); position--) {
    if (view.getUint32(position, true) === 0x06054b50 && position + 22 + view.getUint16(position + 20, true) === bytes.length) { end = position; break; }
  }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw new Error('Malformed or multi-part ZIP archives are not supported.');
  const count = view.getUint16(end + 10, true), centralSize = view.getUint32(end + 12, true), centralStart = view.getUint32(end + 16, true);
  if (!count || count > MAX_ENTRIES || count !== view.getUint16(end + 8, true) || centralStart + centralSize !== end) throw new Error('Invalid ZIP directory bounds.');
  const entries = new Map<string, Uint8Array>(), portablePaths = new Set<string>(), intervals: { start: number; end: number }[] = [];
  let position = centralStart, expanded = 0;
  for (let index = 0; index < count; index++) {
    if (position + 46 > end || view.getUint32(position, true) !== 0x02014b50) throw new Error('Invalid ZIP directory entry.');
    const version = view.getUint16(position + 6, true), flags = view.getUint16(position + 8, true), method = view.getUint16(position + 10, true);
    const checksum = view.getUint32(position + 16, true), compressed = view.getUint32(position + 20, true), size = view.getUint32(position + 24, true);
    const nameLength = view.getUint16(position + 28, true), extraLength = view.getUint16(position + 30, true), commentLength = view.getUint16(position + 32, true);
    const local = view.getUint32(position + 42, true), entryEnd = position + 46 + nameLength + extraLength + commentLength;
    if (version > 20 || (flags & ~0x0800) || method !== 0 || compressed !== size || extraLength || commentLength || view.getUint16(position + 34, true)) throw new Error('Only unencrypted, uncompressed Linen ZIP entries are supported.');
    if (!nameLength || nameLength > 160 || entryEnd > end || local + 30 > centralStart) throw new Error('Invalid ZIP entry bounds.');
    const nameBytes = bytes.subarray(position + 46, position + 46 + nameLength), path = decoder.decode(nameBytes);
    if (!safePath(path) || portablePaths.has(path.toLowerCase())) throw new Error('Unsafe or duplicate ZIP path.');
    if (size > Math.max(LIMITS.videoBytes, MAX_JSON) || expanded + size > MAX_ARCHIVE) throw new Error('ZIP contents exceed the supported limits.');
    if (view.getUint32(local, true) !== 0x04034b50 || view.getUint16(local + 4, true) !== version
      || view.getUint16(local + 6, true) !== flags || view.getUint16(local + 8, true) !== method
      || view.getUint32(local + 14, true) !== checksum || view.getUint32(local + 18, true) !== size
      || view.getUint32(local + 22, true) !== size || view.getUint16(local + 26, true) !== nameLength || view.getUint16(local + 28, true) !== 0) throw new Error('ZIP local and directory headers disagree.');
    const dataStart = local + 30 + nameLength, dataEnd = dataStart + size;
    if (dataEnd > centralStart || !nameBytes.every((byte, offset) => byte === bytes[local + 30 + offset])) throw new Error('Invalid ZIP file bounds or name.');
    const data = bytes.subarray(dataStart, dataEnd);
    if (crc32(data) !== checksum) throw new Error('A ZIP file failed its CRC check.');
    entries.set(path, data); portablePaths.add(path.toLowerCase()); intervals.push({ start: local, end: dataEnd }); expanded += size; position = entryEnd;
  }
  if (position !== end) throw new Error('Unexpected ZIP directory data.');
  intervals.sort((a, b) => a.start - b.start);
  let previousEnd = 0;
  for (const interval of intervals) {
    if (interval.start !== previousEnd) throw new Error('ZIP entries overlap or contain unsupported extra data.');
    previousEnd = interval.end;
  }
  if (previousEnd !== centralStart) throw new Error('Unexpected ZIP data before its directory.');
  return entries;
}

async function prepare(page: ProfilePage, media: MediaFile[]): Promise<{ page: ProfilePage; files: MediaFile[]; manifest: Uint8Array; entries: Entry[]; urls: Record<string, string> }> {
  const checked = validatePage(page), references = assetIds(checked), files: MediaFile[] = [], urls: Record<string, string> = {};
  if (new Set(references.map(id => id.toLowerCase())).size !== references.length) throw new Error('Duplicate media identities cannot share a portable path.');
  if (!Array.isArray(media)) throw new Error('Invalid media collection.');
  const wanted = new Set(references), selected = new Map<string, MediaFile>();
  for (const value of media) {
    if (!value || !wanted.has(value.id)) continue;
    if (selected.has(value.id)) throw new Error('Duplicate media identity.');
    selected.set(value.id, value);
  }
  let total = 0;
  const metadata: Metadata[] = [], entries: Entry[] = [];
  for (const id of references) {
    const value = selected.get(id);
    if (!value) throw new Error('Some referenced media is missing. Keep the draft and retry.');
    const file = await validateMediaFile(value);
    total += file.size;
    if (total > LIMITS.mediaBytes) throw new Error('This page exceeds its 64 MiB media limit.');
    const path = `media/${file.id}.${mediaExtension(file.type)}`;
    files.push(file); urls[id] = path;
    metadata.push({ id: file.id, name: file.name, type: file.type, size: file.size, createdAt: file.createdAt, path });
  }
  for (const file of files) entries.push({ path: urls[file.id], bytes: new Uint8Array(await file.blob.arrayBuffer()) });
  const manifest = encoder.encode(JSON.stringify({ format: 'linen.project', version: 1, page: checked, media: metadata }));
  if (manifest.length > MAX_JSON) throw new Error('This project description exceeds the archive limit.');
  return { page: checked, files, manifest, entries, urls };
}

/** Portable project data deliberately excludes the private Workspace.remote binding. */
export async function exportBackup(page: ProfilePage, media: MediaFile[]): Promise<Blob> {
  const prepared = await prepare(page, media);
  return zip([{ path: 'project.json', bytes: prepared.manifest }, ...prepared.entries]);
}

export async function importBackup(blob: Blob): Promise<{ page: ProfilePage; media: MediaFile[] }> {
  const entries = await unzip(blob), project = entries.get('project.json');
  if (!project || project.length > MAX_JSON) throw new Error('This is not a supported Linen project backup.');
  let raw: unknown;
  try { raw = JSON.parse(decoder.decode(project)); } catch { throw new Error('The project JSON is invalid.'); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('The project manifest is invalid.');
  const manifest = raw as Record<string, unknown>;
  if (Object.keys(manifest).some(key => !['format', 'version', 'page', 'media'].includes(key))
    || manifest.format !== 'linen.project' || manifest.version !== 1 || !Array.isArray(manifest.media)
    || manifest.media.length > LIMITS.cards + 1) throw new Error('Unsupported Linen backup format or version.');
  const page = validatePage(manifest.page), references = new Set(assetIds(page)), ids = new Set<string>(), paths = new Set(['project.json']), media: MediaFile[] = [];
  let total = 0;
  for (const value of manifest.media) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid archive media metadata.');
    const item = value as Record<string, unknown>;
    if (Object.keys(item).some(key => !['id', 'name', 'type', 'size', 'createdAt', 'path'].includes(key))
      || !validMediaId(item.id) || ids.has(item.id) || !references.has(item.id) || typeof item.type !== 'string'
      || item.path !== `media/${item.id}.${mediaExtension(item.type)}` || paths.has(item.path as string)) throw new Error('Invalid or unreferenced archive media.');
    const data = entries.get(item.path as string);
    if (!data || typeof item.size !== 'number' || item.size !== data.length) throw new Error('Archive media is missing or has the wrong size.');
    const file = await validateMediaFile({ id: item.id, name: item.name, type: item.type, size: item.size, createdAt: item.createdAt, blob: new Blob([data.slice().buffer], { type: item.type }) });
    total += file.size;
    if (total > LIMITS.mediaBytes) throw new Error('The archive exceeds the page’s 64 MiB media limit.');
    ids.add(file.id); paths.add(item.path as string); media.push(file);
  }
  if (ids.size !== references.size || [...references].some(id => !ids.has(id)) || entries.size !== paths.size || [...entries.keys()].some(path => !paths.has(path))) throw new Error('Archive files do not match the page’s media references.');
  return { page, media };
}

/** Static hosting export; importing HTML is intentionally not a project-restore path. */
export async function exportSite(page: ProfilePage, media: MediaFile[]): Promise<Blob> {
  const prepared = await prepare(page, media);
  const { renderDocument } = await import('./render');
  const html = encoder.encode(renderDocument(prepared.page, prepared.urls, {}));
  if (html.length > 1024 * 1024) throw new Error('This exported page exceeds the static HTML limit.');
  return zip([{ path: 'index.html', bytes: html }, ...prepared.entries]);
}
