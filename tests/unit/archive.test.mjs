import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Resolve the same extensionless local TypeScript imports that Next resolves.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL?.startsWith(new URL('../../lib/', import.meta.url).href) && /^\.\/(model|media|types|render)$/.test(specifier)) {
    return nextResolve(new URL(`${specifier}.ts`, context.parentURL).href, context);
  }
  return nextResolve(specifier, context);
} });
const { blankPage, createCard, LIMITS } = await import('../../lib/model.ts');
const { inspectMedia, validateMediaFile } = await import('../../lib/media.ts');
const { exportBackup, importBackup, exportSite } = await import('../../lib/archive.ts');
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const utf8 = new TextEncoder();
const decode = new TextDecoder();

// Authored file-header fixtures identify formats; these tests do not prove decoding/playback.
function png() {
  const bytes = new Uint8Array(33), view = new DataView(bytes.buffer);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]); view.setUint32(8, 13); bytes.set(utf8.encode('IHDR'), 12);
  view.setUint32(16, 1); view.setUint32(20, 1); bytes[24] = 8; bytes[25] = 6;
  return bytes;
}
function webp() {
  const bytes = new Uint8Array(26), view = new DataView(bytes.buffer);
  bytes.set(utf8.encode('RIFF')); view.setUint32(4, 18, true); bytes.set(utf8.encode('WEBPVP8L'), 8);
  view.setUint32(16, 5, true); bytes[20] = 0x2f;
  return bytes;
}
function mp4() {
  const bytes = new Uint8Array(16); new DataView(bytes.buffer).setUint32(0, 16);
  bytes.set(utf8.encode('ftypisom'), 4); return bytes;
}
const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 2]);
const gif = () => new Uint8Array([...utf8.encode('GIF89a'), 1, 0, 1, 0, 0, 0, 0]);
const webm = () => new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x87, 0x42, 0x82, 0x84, ...utf8.encode('webm')]);
function media(number = 1, bytes = png(), type = 'image/png') {
  const blob = new Blob([bytes], { type });
  return { id: id(number), name: `Authored-${number}.${type.startsWith('video/') ? 'mp4' : 'png'}`, type, size: blob.size, blob, createdAt: 1793050000000 };
}
function pageWith(...files) {
  const page = blankPage(); page.id = id(100); page.name = 'Authored archive fixture'; page.bio = '<script>plain text</script>';
  page.cards = files.map((file, index) => ({ ...createCard(file.type.startsWith('video/') ? 'video' : 'image'), id: id(200 + index), mediaId: file.id, alt: `Fixture ${index}` }));
  return page;
}
function checksum(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let index = 0; index < 8; index++) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  }
  return (value ^ 0xffffffff) >>> 0;
}
// Independent small stored-ZIP fixture writer, including deliberately unsupported entries.
function fixtureZip(files, { flags = 0x800, method = 0 } = {}) {
  const local = [], directory = [];
  let offset = 0;
  for (const [name, value] of files) {
    const path = utf8.encode(name), data = typeof value === 'string' ? utf8.encode(value) : value;
    const header = new Uint8Array(30 + path.length), h = new DataView(header.buffer), crc = checksum(data);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, flags, true); h.setUint16(8, method, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, path.length, true); header.set(path, 30);
    const central = new Uint8Array(46 + path.length), c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, flags, true); c.setUint16(10, method, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, path.length, true); c.setUint32(42, offset, true); central.set(path, 46);
    local.push(header, data); directory.push(central); offset += header.length + data.length;
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, directory.reduce((sum, bytes) => sum + bytes.length, 0), true); e.setUint32(16, offset, true);
  return new Blob([...local, ...directory, end], { type: 'application/zip' });
}
async function entries(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer), found = new Map();
  const end = bytes.length - 22;
  let position = view.getUint32(end + 16, true);
  for (let index = 0; index < view.getUint16(end + 10, true); index++) {
    const length = view.getUint16(position + 28, true), name = decode.decode(bytes.subarray(position + 46, position + 46 + length));
    const local = view.getUint32(position + 42, true), start = local + 30 + view.getUint16(local + 26, true), size = view.getUint32(position + 24, true);
    found.set(name, bytes.slice(start, start + size)); position += 46 + length;
  }
  return found;
}
async function repack(blob, change) {
  const files = await entries(blob); change(files);
  return fixtureZip([...files]);
}

test('supported signatures identify six formats without trusting a MIME declaration', async () => {
  for (const [type, bytes] of [['image/png', png()], ['image/jpeg', jpeg()], ['image/webp', webp()], ['image/gif', gif()], ['video/mp4', mp4()], ['video/webm', webm()]]) {
    const checked = await inspectMedia(new Blob([bytes]));
    assert.equal(checked.type, type); assert.equal(checked.size, bytes.length);
    assert.equal(checked.kind, type.startsWith('image/') ? 'image' : 'video');
  }
  await assert.rejects(inspectMedia(new Blob([png()], { type: 'image/jpeg' })), /signature/);
  await assert.rejects(inspectMedia(new Blob([png()]), 'image/png', 1), /size/);
  await assert.rejects(inspectMedia(new Blob([png()]), 'text/html'), /supported/);
});

test('empty, truncated, false RIFF and non-WebM/MP4 containers are rejected', async () => {
  const notMp4 = mp4(); notMp4.set(utf8.encode('avif'), 8);
  const notWebM = webm(); notWebM[8] = 0x78;
  const notWebp = webp(); new DataView(notWebp.buffer).setUint32(4, 900, true);
  for (const bytes of [new Uint8Array(), png().slice(0, 8), new Uint8Array([0xff, 0xd8]), notMp4, notWebM, notWebp, utf8.encode('<svg><script/></svg>')]) {
    await assert.rejects(inspectMedia(new Blob([bytes])));
  }
});

test('declared and actual file limits apply even when the MIME is omitted', async () => {
  const oversizedImage = new Blob([png(), new Uint8Array(LIMITS.imageBytes)]);
  await assert.rejects(inspectMedia(oversizedImage), /8 MiB/);
  await assert.rejects(inspectMedia(oversizedImage, 'image/png'), /8 MiB/);
  const oversizedVideo = new Blob([mp4(), new Uint8Array(LIMITS.videoBytes)]);
  await assert.rejects(inspectMedia(oversizedVideo, 'video/mp4'), /32 MiB/);
});

test('exact per-file image and video size boundaries remain accepted', async () => {
  const image = new Blob([png(), new Uint8Array(LIMITS.imageBytes - png().length)], { type: 'image/png' });
  assert.equal((await inspectMedia(image)).size, LIMITS.imageBytes);
  const video = new Blob([mp4(), new Uint8Array(LIMITS.videoBytes - mp4().length)], { type: 'video/mp4' });
  assert.equal((await inspectMedia(video)).size, LIMITS.videoBytes);
});

test('metadata requires UUID identity, exact Blob size and a safe basename', async () => {
  const valid = media();
  assert.equal((await validateMediaFile(valid)).id, valid.id);
  for (const change of [{ id: '../wrong' }, { name: '../secret.png' }, { size: 1 }, { createdAt: -1 }, { ownerKey: 'private' }]) {
    await assert.rejects(validateMediaFile({ ...valid, ...change }));
  }
});

test('backup round trip preserves page UUIDs, layouts, media UUIDs and bytes', async () => {
  const image = media(), video = media(2, mp4(), 'video/mp4'), page = pageWith(image, video);
  page.avatarId = image.id; page.cards[0].size = 'large'; page.cards[1].size = 'tall';
  const before = structuredClone(page), restored = await importBackup(await exportBackup(page, [video, image]));
  assert.deepEqual(restored.page, before); assert.deepEqual(page, before);
  assert.deepEqual(restored.media.map(file => file.id), [image.id, video.id]);
  assert.deepEqual(new Uint8Array(await restored.media[0].blob.arrayBuffer()), png());
  assert.equal(restored.media[0].createdAt, image.createdAt);
});

test('only referenced media is exported and no private workspace binding is serialized', async () => {
  const image = media(), unused = media(9), page = pageWith(image), files = await entries(await exportBackup(page, [unused, image]));
  assert.deepEqual([...files.keys()], ['project.json', `media/${image.id}.png`]);
  const manifest = JSON.parse(decode.decode(files.get('project.json')));
  assert.deepEqual(Object.keys(manifest), ['format', 'version', 'page', 'media']);
  assert.equal(manifest.version, 1); assert.equal(manifest.format, 'linen.project');
  assert.equal(JSON.stringify(manifest).includes('ownerKey'), false);
  await assert.rejects(exportBackup({ ...page, remote: { ownerKey: 'private' } }, [image]));
});

test('a draft without media remains portable without becoming a published profile', async () => {
  const page = blankPage(); page.name = ''; page.handle = '';
  const restored = await importBackup(await exportBackup(page, []));
  assert.deepEqual(restored.page, page); assert.deepEqual(restored.media, []);
});

test('missing and duplicate referenced media are rejected before export', async () => {
  const image = media(), page = pageWith(image);
  await assert.rejects(exportBackup(page, []), /missing/);
  await assert.rejects(exportBackup(page, [image, image]), /Duplicate/);
});

test('combined referenced media cannot exceed the 64 MiB page quota', async () => {
  const blob = new Blob([mp4(), new Uint8Array(LIMITS.videoBytes - mp4().length)], { type: 'video/mp4' });
  const first = { ...media(1, mp4(), 'video/mp4'), blob, size: blob.size };
  const second = { ...first, id: id(2) }, third = media(3, mp4(), 'video/mp4');
  await assert.rejects(exportBackup(pageWith(first, second, third), [first, second, third]), /64 MiB/);
});

test('import preserves the exact original UUID spelling rather than generating replacements', async () => {
  const image = { ...media(), id: 'A0000000-0000-4000-8000-000000000001' };
  const page = pageWith(image); page.avatarId = image.id;
  const restored = await importBackup(await exportBackup(page, [image]));
  assert.equal(restored.media[0].id, image.id);
  assert.equal(restored.page.avatarId, image.id);
  assert.equal(restored.page.cards[0].mediaId, image.id);
});

test('case-folding media paths cannot overwrite each other on a portable filesystem', async () => {
  const lower = { ...media(), id: 'a0000000-0000-4000-8000-000000000001' }, upper = { ...media(), id: lower.id.toUpperCase() };
  const page = pageWith(lower, upper);
  await assert.rejects(exportBackup(page, [lower, upper]), /Duplicate/);
  const manifest = { format: 'linen.project', version: 1, page, media: [lower, upper].map(({ blob, ...file }) => ({ ...file, path: `media/${file.id}.png` })) };
  await assert.rejects(importBackup(fixtureZip([['project.json', JSON.stringify(manifest)], [`media/${lower.id}.png`, png()], [`media/${upper.id}.png`, png()]])), /duplicate/);
});

test('corrupted file contents fail CRC before a project can be returned', async () => {
  const image = media(), archive = await exportBackup(pageWith(image), [image]), bytes = new Uint8Array(await archive.arrayBuffer());
  bytes[30 + 'project.json'.length + 1] ^= 1;
  await assert.rejects(importBackup(new Blob([bytes])), /CRC/);
});

test('correct CRC cannot disguise a mismatched file signature or size', async () => {
  const image = media(), archive = await exportBackup(pageWith(image), [image]);
  await assert.rejects(importBackup(await repack(archive, files => files.set(`media/${image.id}.png`, jpeg()))), /size|signature/);
  await assert.rejects(importBackup(await repack(archive, files => {
    const value = JSON.parse(decode.decode(files.get('project.json'))); value.media[0].type = 'image/jpeg'; value.media[0].path = `media/${image.id}.jpg`;
    files.delete(`media/${image.id}.png`); files.set(`media/${image.id}.jpg`, png()); files.set('project.json', utf8.encode(JSON.stringify(value)));
  })), /signature/);
});

test('unsafe, duplicate and unlisted ZIP paths cannot enter a backup', async () => {
  const manifest = JSON.stringify({ format: 'linen.project', version: 1, page: blankPage(), media: [] });
  for (const name of ['../owner.txt', '/absolute.txt', 'media\\wrong.png', 'media/../wrong.png', 'C:/owner.txt']) {
    await assert.rejects(importBackup(fixtureZip([['project.json', manifest], [name, 'unsafe']])), /path/);
  }
  await assert.rejects(importBackup(fixtureZip([['project.json', manifest], ['project.json', manifest]])), /duplicate/);
  await assert.rejects(importBackup(fixtureZip([['project.json', manifest], ['owner.txt', 'not imported']])), /match/);
});

test('encrypted, compressed and excessive-entry ZIP archives fail explicitly', async () => {
  const files = [['project.json', '{}']];
  await assert.rejects(importBackup(fixtureZip(files, { flags: 1 })), /unencrypted/);
  await assert.rejects(importBackup(fixtureZip(files, { method: 8 })), /uncompressed/);
  await assert.rejects(importBackup(fixtureZip(Array.from({ length: 40 }, (_, index) => [`file-${index}`, '']))), /bounds/);
});

test('local/directory disagreement, overlapping offsets and truncated ZIPs are rejected', async () => {
  const image = media(), archive = await exportBackup(pageWith(image), [image]);
  const bytes = new Uint8Array(await archive.arrayBuffer()), view = new DataView(bytes.buffer), end = bytes.length - 22, central = view.getUint32(end + 16, true);
  const wrongLocal = bytes.slice(); wrongLocal[14] ^= 1;
  await assert.rejects(importBackup(new Blob([wrongLocal])), /headers/);
  const overlap = bytes.slice(), overlapView = new DataView(overlap.buffer), second = central + 46 + 'project.json'.length;
  overlapView.setUint32(second + 42, 0, true);
  await assert.rejects(importBackup(new Blob([overlap])), /headers|name|overlap/);
  await assert.rejects(importBackup(archive.slice(0, archive.size - 1)), /Malformed/);
});

test('unknown manifest versions, invalid pages, missing references and owner metadata are rejected', async () => {
  const image = media(), archive = await exportBackup(pageWith(image), [image]);
  for (const change of [value => { value.version = 2; }, value => { value.page.id = 'bad'; }, value => { value.remote = { ownerKey: 'secret' }; }, value => { value.media = []; }]) {
    await assert.rejects(importBackup(await repack(archive, files => { const value = JSON.parse(decode.decode(files.get('project.json'))); change(value); files.set('project.json', utf8.encode(JSON.stringify(value))); })));
  }
});

test('site export uses canonical escaped rendering and only packaged referenced media', async () => {
  const image = media(), page = pageWith(image), files = await entries(await exportSite(page, [image, media(8)]));
  assert.deepEqual([...files.keys()], ['index.html', `media/${image.id}.png`]);
  const html = decode.decode(files.get('index.html'));
  assert.match(html, new RegExp(`media/${image.id}\\.png`));
  assert.equal(html.includes('<script>plain text</script>'), false);
  assert.equal(html.includes('ownerKey'), false);
  assert.match(html, /Authored archive fixture/);
  await assert.rejects(importBackup(await exportSite(page, [image])), /project backup/);
});

test('missing IndexedDB rejects honestly rather than using a fake successful fallback', async () => {
  assert.equal(typeof globalThis.indexedDB, 'undefined');
  const { loadWorkspace, saveWorkspace } = await import('../../lib/local.ts');
  await assert.rejects(loadWorkspace(), /storage is unavailable/);
  await assert.rejects(saveWorkspace({ version: 1, page: blankPage(), remote: null, updatedAt: 1 }), /storage is unavailable/);
});
