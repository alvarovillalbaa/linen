import { LIMITS } from './model';
import type { MediaFile } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']);
const text = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
const matches = (bytes: Uint8Array, values: number[]) => values.every((value, index) => bytes[index] === value);

export function validMediaId(value: unknown): value is string { return typeof value === 'string' && UUID.test(value); }

function ebmlSize(bytes: Uint8Array, offset: number): { value: number; length: number } | null {
  let marker = 0x80, length = 1;
  while (length <= 8 && !(bytes[offset] & marker)) { marker >>= 1; length++; }
  if (length > 8 || offset + length > bytes.length) return null;
  let value = bytes[offset] & (marker - 1);
  for (let index = 1; index < length; index++) value = value * 256 + bytes[offset + index];
  if (!Number.isSafeInteger(value) || value === 2 ** (7 * length) - 1) return null;
  return { value, length };
}

function isWebM(bytes: Uint8Array): boolean {
  if (!matches(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return false;
  const size = ebmlSize(bytes, 4);
  if (!size || size.value > 4096 || 4 + size.length + size.value > bytes.length) return false;
  const end = 4 + size.length + size.value;
  let position = 4 + size.length, found = false;
  while (position < end) {
    let marker = 0x80, length = 1;
    while (length <= 4 && !(bytes[position] & marker)) { marker >>= 1; length++; }
    if (length > 4 || position + length > end) return false;
    let id = 0;
    for (let index = 0; index < length; index++) id = id * 256 + bytes[position + index];
    position += length;
    const field = ebmlSize(bytes, position);
    if (!field) return false;
    position += field.length;
    if (position + field.value > end) return false;
    if (id === 0x4282) {
      if (found || text(bytes, position, field.value) !== 'webm') return false;
      found = true;
    }
    position += field.value;
  }
  return found;
}

function signature(bytes: Uint8Array, size: number): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 33 && matches(bytes, [137, 80, 78, 71, 13, 10, 26, 10])
    && view.getUint32(8) === 13 && text(bytes, 12, 4) === 'IHDR' && view.getUint32(16) > 0 && view.getUint32(20) > 0) return 'image/png';
  if (bytes.length >= 4 && matches(bytes, [0xff, 0xd8, 0xff]) && bytes[3] >= 0xc0 && ![0xd8, 0xd9, 0xff].includes(bytes[3])) return 'image/jpeg';
  if (bytes.length >= 13 && ['GIF87a', 'GIF89a'].includes(text(bytes, 0, 6)) && view.getUint16(6, true) > 0 && view.getUint16(8, true) > 0) return 'image/gif';
  if (bytes.length >= 21 && text(bytes, 0, 4) === 'RIFF' && text(bytes, 8, 4) === 'WEBP') {
    const total = view.getUint32(4, true) + 8, chunk = view.getUint32(16, true), kind = text(bytes, 12, 4);
    const minimum = kind === 'VP8L' ? 5 : kind === 'VP8X' ? 10 : kind === 'VP8 ' ? 10 : Infinity;
    if (total === size && chunk >= minimum && 20 + chunk + (chunk % 2) <= total) return 'image/webp';
  }
  if (bytes.length >= 16 && text(bytes, 4, 4) === 'ftyp') {
    const length = view.getUint32(0), brand = text(bytes, 8, 4);
    if (length >= 16 && length <= size && length % 4 === 0
      && ['isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'dash', 'M4V ', 'MSNV'].includes(brand)) return 'video/mp4';
  }
  if (isWebM(bytes)) return 'video/webm';
  return null;
}

/** Checks supported file headers, not codec decodability or malware safety. */
export async function inspectMedia(blob: Blob, declaredType = blob.type, declaredSize = blob.size): Promise<{ type: string; size: number; kind: 'image' | 'video' }> {
  if (!(blob instanceof Blob) || !Number.isSafeInteger(blob.size) || blob.size <= 0) throw new Error('Choose a non-empty supported image or video.');
  if (!Number.isSafeInteger(declaredSize) || declaredSize !== blob.size) throw new Error('The media size does not match its file.');
  if (typeof declaredType !== 'string' || (declaredType && !TYPES.has(declaredType))) throw new Error('This media type is not supported.');
  const declaredLimit = declaredType.startsWith('image/') ? LIMITS.imageBytes : LIMITS.videoBytes;
  if (declaredSize > declaredLimit || blob.size > LIMITS.videoBytes) throw new Error('Images must be at most 8 MiB and videos at most 32 MiB.');
  const bytes = new Uint8Array(await blob.slice(0, 4110).arrayBuffer());
  const type = signature(bytes, blob.size);
  if (!type || (declaredType && declaredType !== type) || (blob.type && blob.type !== type)) throw new Error('The media signature does not match a supported file type.');
  const kind = type.startsWith('image/') ? 'image' : 'video';
  if (blob.size > (kind === 'image' ? LIMITS.imageBytes : LIMITS.videoBytes)) throw new Error('Images must be at most 8 MiB and videos at most 32 MiB.');
  return { type, size: blob.size, kind };
}

export async function validateMediaFile(value: unknown): Promise<MediaFile> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid media metadata.');
  const record = value as Record<string, unknown>;
  const keys = ['id', 'name', 'type', 'size', 'blob', 'createdAt'];
  if (Object.keys(record).some(key => !keys.includes(key)) || !keys.every(key => Object.hasOwn(record, key))
    || !validMediaId(record.id) || typeof record.name !== 'string' || !record.name.trim() || record.name.length > 255
    || /[\\/\u0000-\u001f\u007f]/.test(record.name) || ['.', '..'].includes(record.name)
    || typeof record.type !== 'string' || typeof record.size !== 'number'
    || !Number.isSafeInteger(record.createdAt) || (record.createdAt as number) < 0 || !(record.blob instanceof Blob)) throw new Error('Invalid media metadata.');
  const inspected = await inspectMedia(record.blob, record.type, record.size);
  return { id: record.id, name: record.name, type: inspected.type, size: inspected.size, blob: record.blob, createdAt: record.createdAt as number };
}

export function mediaExtension(type: string): string {
  const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm' } as Record<string, string>)[type];
  if (!extension) throw new Error('This media type is not supported.');
  return extension;
}
