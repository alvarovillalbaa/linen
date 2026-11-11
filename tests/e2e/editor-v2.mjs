// Real production editor controls and actual downloaded exports. No raw storage or app injection.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, readlink } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { createServer } from 'node:http';
import { createServer as reservePort, createConnection } from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT = process.env.LN_EDITOR2_ROOT, PROOF = process.env.LN_EDITOR2_PROOF;
assert.equal(process.version, 'v24.22.2');
assert.match(process.env.SOURCE_COMMIT ?? '', /^[a-f0-9]{40}$/);
for (const p of [ROOT, PROOF]) {
  assert.ok(p && path.isAbsolute(p));
  assert.equal(await readFile(path.join(p, '.owner'), 'utf8'), process.env.LN_EDITOR2_NONCE);
}
const require = createRequire(path.join(ROOT, 'tools/package.json'));
const { chromium, expect } = require('playwright/test');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const APP = path.join(ROOT, 'app');
const report = { schemaVersion: 'linen.local-editor-browser.v2', sourceCommit: process.env.SOURCE_COMMIT,
  passed: false, cases: [], errors: [], runtime: {}, uniqueResponses: {},
  proofLimits: ['Local production build, not a hosted service or backend ownership qualification.',
    'Narrow Chromium uses emulated touch and keyboard; no physical device, Safari or assistive-technology proof.',
    'Fresh contexts; state observed only through UI, actual reload and actual downloaded archives.',
    'Unbound publishing; no real owner credential or cloud capability isolation is exercised.',
    'Static export is served separately from its actual downloaded bytes; it does not replace durable public profiles.'] };
let browser, next, nextClosed, origin, interrupted = false, stopping;
const contexts = new Set(), staticServers = new Set();
const compiled = new Map();
await mkdir(path.join(PROOF, 'responses'), { recursive: true });
await mkdir(path.join(PROOF, 'samples'), { recursive: true });

function crc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function png() {
  const chunk = (kind, bytes) => {
    const name = Buffer.from(kind), size = Buffer.alloc(4), checksum = Buffer.alloc(4);
    size.writeUInt32BE(bytes.length); checksum.writeUInt32BE(crc(Buffer.concat([name, bytes])));
    return Buffer.concat([size, name, bytes, checksum]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(2); header.writeUInt32BE(2, 4); header[8] = 8; header[9] = 6;
  const pixels = Buffer.from([0,255,0,0,255,0,255,0,255,0,0,0,255,255,255,255,0,255]);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
const sample = png(), samplePath = path.join(PROOF, 'samples/authored-swatch.png');
await writeFile(samplePath, sample, { flag: 'wx' });
const badImage = path.join(PROOF, 'samples/invalid.png'), badZip = path.join(PROOF, 'samples/invalid.zip');
await writeFile(badImage, 'authored invalid image', { flag: 'wx' });
await writeFile(badZip, 'authored invalid archive', { flag: 'wx' });
report.authoredImage = { width: 2, height: 2, bytes: sample.length, sha256: hash(sample) };

// Independent bounded read of actual uncompressed ZIP downloads; never import app helpers.
function unzip(bytes) {
  assert.ok(bytes.length >= 22 && bytes.length < 1024 * 1024);
  const end = bytes.length - 22; assert.equal(bytes.readUInt32LE(end), 0x06054b50);
  const count = bytes.readUInt16LE(end + 10), start = bytes.readUInt32LE(end + 16);
  assert.ok(count > 0 && count <= 8); assert.equal(start + bytes.readUInt32LE(end + 12), end);
  let offset = start; const entries = new Map();
  for (let i = 0; i < count; i++) {
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50); assert.equal(bytes.readUInt16LE(offset + 10), 0);
    const size = bytes.readUInt32LE(offset + 24), length = bytes.readUInt16LE(offset + 28);
    const extra = bytes.readUInt16LE(offset + 30), comment = bytes.readUInt16LE(offset + 32);
    const local = bytes.readUInt32LE(offset + 42), name = bytes.subarray(offset + 46, offset + 46 + length).toString('utf8');
    assert.match(name, /^(?:project\.json|index\.html|media\/[a-f0-9-]+\.png)$/);
    assert.ok(!entries.has(name)); assert.equal(bytes.readUInt32LE(local), 0x04034b50);
    const dataStart = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    assert.ok(dataStart + size <= start); const body = bytes.subarray(dataStart, dataStart + size);
    assert.equal(body.length, size); assert.equal(crc(body), bytes.readUInt32LE(offset + 16));
    entries.set(name, body); offset += 46 + length + extra + comment;
  }
  assert.equal(offset, end); return entries;
}
async function loadAssets(directory, prefix) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name), key = `${prefix}/${item.name}`;
    if (item.isDirectory()) await loadAssets(file, key);
    else { assert.ok(item.isFile()); const bytes = await readFile(file); assert.ok(bytes.length <= 2 * 1024 * 1024); compiled.set(key, bytes); }
  }
}
await loadAssets(path.join(APP, '.next/static'), '/_next/static');
compiled.set('/favicon.svg', await readFile(path.join(APP, 'public/favicon.svg')));
report.runtime.buildId = (await readFile(path.join(APP, '.next/BUILD_ID'), 'utf8')).trim();
report.runtime.compiledAssets = [...compiled].map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: hash(bytes) }));

async function portIsClosed(port) {
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); resolve(false); });
    socket.once('error', error => { socket.destroy(); resolve(error.code === 'ECONNREFUSED'); });
    socket.setTimeout(2000, () => { socket.destroy(); resolve(false); });
  });
}
async function startNext() {
  const reservation = reservePort(); await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  assert.equal(await portIsClosed(port), true); origin = `http://127.0.0.1:${port}`;
  const row = report.runtime.server = { port, origin, streams: {}, ready: false, closed: false, forced: false };
  next = spawn(process.execPath, [path.join(APP, 'node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)],
    { cwd: APP, env: { ...process.env, NODE_ENV: 'production' }, stdio: ['ignore', 'pipe', 'pipe'] });
  row.pid = next.pid; assert.ok(next.pid);
  for (const [name, stream] of [['stdout', next.stdout], ['stderr', next.stderr]]) {
    const state = { chunks: [], bytes: 0, eof: false }; row.streams[name] = state;
    stream.on('data', bytes => { state.bytes += bytes.length; if (state.bytes <= 1024 * 1024) state.chunks.push(bytes); });
    stream.on('end', () => { state.eof = true; });
  }
  nextClosed = new Promise(resolve => next.once('close', (code, signal) => { row.closed = true; row.exitCode = code; row.signal = signal; resolve(); }));
  next.once('error', error => { row.error = error.message; });
  const deadline = Date.now() + 25000;
  while (!Buffer.concat(row.streams.stdout.chunks).toString().includes('Ready in')) {
    assert.ok(!row.closed && !row.error && Date.now() < deadline, 'next_readiness_failed'); await pause(50);
  }
  const tcp = (await readFile('/proc/net/tcp', 'utf8')).split('\n').map(x => x.trim().split(/\s+/));
  const inodes = tcp.filter(x => x[1]?.endsWith(`:${port.toString(16).toUpperCase().padStart(4, '0')}`) && x[3] === '0A').map(x => x[9]);
  const fds = await readdir(`/proc/${next.pid}/fd`); const sockets = [];
  for (const fd of fds) { try { sockets.push(await readlink(`/proc/${next.pid}/fd/${fd}`)); } catch {} }
  assert.ok(inodes.some(inode => sockets.includes(`socket:[${inode}]`)), 'next_port_not_owned');
  row.listenerOwnedBySpawnedPid = true; row.ready = true;
  const response = await fetch(`${origin}/api/config`, { redirect: 'error', signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200); const bytes = Buffer.from(await response.arrayBuffer());
  assert.deepEqual(JSON.parse(bytes.toString()), { publishing: false });
  report.runtime.config = { status: response.status, bytes: bytes.length, sha256: hash(bytes), publishing: false };
  await writeFile(path.join(PROOF, 'config-original.json'), bytes, { flag: 'wx' });
}
async function stopNext() {
  if (stopping) return stopping;
  stopping = (async () => {
    if (!next) return;
    const row = report.runtime.server;
    if (!row.closed) next.kill('SIGTERM');
    let timer; const closed = await Promise.race([nextClosed.then(() => true), new Promise(resolve => { timer = setTimeout(() => resolve(false), 8000); })]); clearTimeout(timer);
    if (!closed) { row.forced = true; next.kill('SIGKILL'); await nextClosed; }
    for (const [name, state] of Object.entries(row.streams)) {
      const bytes = Buffer.concat(state.chunks); delete state.chunks;
      const filename = `next-server.${name}.log`; await writeFile(path.join(PROOF, filename), bytes, { flag: 'wx' });
      Object.assign(state, { original: filename, sha256: hash(bytes), capturedBytes: bytes.length, complete: state.eof && state.bytes === bytes.length });
    }
    row.portClosed = await portIsClosed(row.port);
    assert.ok(row.closed && !row.forced && row.portClosed && Object.values(row.streams).every(x => x.complete), 'next_shutdown_incomplete');
  })(); return stopping;
}
async function serveExport(state, entries) {
  const server = createServer((request, response) => {
    const name = new URL(request.url, 'http://127.0.0.1').pathname.slice(1) || 'index.html';
    const bytes = entries.get(name);
    if (!bytes || !['GET', 'HEAD'].includes(request.method)) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'Content-Type': name.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': bytes.length });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port; const site = { server, port, origin: `http://127.0.0.1:${port}`, entries };
  staticServers.add(site); state.site = site; return site;
}
async function closeSite(site) {
  if (!site || !staticServers.has(site)) return;
  site.server.closeAllConnections(); await new Promise(resolve => site.server.close(resolve));
  assert.equal(await portIsClosed(site.port), true); staticServers.delete(site);
}
function allowed(state, request) {
  const u = new URL(request.url());
  if (u.protocol === 'blob:') return u.origin === origin && request.method() === 'GET';
  if (!['GET', 'HEAD'].includes(request.method()) || u.username || u.password || u.hash || u.search) return false;
  if (u.origin === origin) return ['/', '/api/config'].includes(u.pathname) || compiled.has(u.pathname);
  return state.site && u.origin === state.site.origin && state.site.entries.has(u.pathname.slice(1) || 'index.html');
}
async function settle(state) {
  for (let i = 0; i < 5 && state.jobs.size; i++) await Promise.allSettled([...state.jobs]);
  await expect.poll(() => [...state.requests.values()].filter(x => !x.finished && !x.failed).length).toBe(0);
  assert.equal(state.jobs.size, 0);
}
async function fresh(result, narrow) {
  const context = await browser.newContext({ viewport: narrow ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    hasTouch: narrow, isMobile: narrow, reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: true });
  contexts.add(context); result.profile = narrow ? '390x844_emulated_touch_keyboard' : '1440x1000_mouse_keyboard';
  result.boundary = { requests: [], violations: [], pageErrors: [], consoleErrors: [], dialogs: [], fileChoosers: [], websockets: 0 };
  result.downloads = []; result.observations = []; result.cleanup = { pagesClosed: false, contextClosed: false, networkDrained: false, staticServerClosed: false };
  const state = { result, context, narrow, jobs: new Set(), requests: new Map(), pages: [], pendingDialog: null, site: null };
  context.on('page', page => {
    state.pages.push(page); if (state.pages.length > 2) result.boundary.violations.push('page_count_bound');
    page.setDefaultTimeout(12000); page.on('pageerror', e => result.boundary.pageErrors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') result.boundary.consoleErrors.push(m.text()); });
    page.on('websocket', () => { result.boundary.websockets++; });
    page.on('dialog', async dialog => {
      const pending = state.pendingDialog; state.pendingDialog = null;
      result.boundary.dialogs.push({ type: dialog.type(), message: dialog.message(), expected: Boolean(pending), accept: pending?.accept });
      try {
        assert.ok(pending); assert.equal(dialog.type(), 'confirm'); assert.match(dialog.message(), /Replace the local draft with this backup/);
        if (pending.accept) await dialog.accept(); else await dialog.dismiss(); pending.resolve();
      } catch (error) { result.boundary.violations.push('unexpected_native_dialog'); await dialog.dismiss().catch(() => {}); pending?.reject(error); }
    });
    page.on('filechooser', chooser => result.boundary.fileChoosers.push({ multiple: chooser.isMultiple(), observed: true }));
  });
  await context.route('**/*', async route => { if (allowed(state, route.request())) await route.continue(); else { result.boundary.violations.push(route.request().url()); await route.abort(); } });
  await context.routeWebSocket('**/*', socket => { result.boundary.violations.push('websocket_forbidden'); void socket.close(); });
  context.on('request', request => {
    if (new URL(request.url()).protocol === 'blob:') return;
    assert.ok(state.requests.size < 200);
    const row = { method: request.method(), url: request.url(), finished: false, failed: false, bodyBound: false };
    state.requests.set(request, row); result.boundary.requests.push(row);
    if (!allowed(state, request)) result.boundary.violations.push('unexpected_request');
  });
  context.on('requestfinished', request => { const row = state.requests.get(request); if (row) row.finished = true; });
  context.on('requestfailed', request => { const row = state.requests.get(request); if (row) row.failed = true; result.boundary.violations.push('request_failed'); });
  context.on('response', response => {
    if (new URL(response.url()).protocol === 'blob:') return;
    const job = (async () => {
      const row = state.requests.get(response.request()); assert.ok(row); row.status = response.status(); assert.equal(row.status, 200);
      let timer; try { assert.equal(await Promise.race([response.finished(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('response_timeout')), 12000); })]), null); } finally { clearTimeout(timer); }
      const bytes = await response.body(); assert.ok(bytes.length <= 2 * 1024 * 1024); row.bytes = bytes.length; row.sha256 = hash(bytes);
      const u = new URL(response.url()); let expected;
      if (u.origin === origin && compiled.has(u.pathname)) expected = compiled.get(u.pathname);
      else if (state.site && u.origin === state.site.origin) expected = state.site.entries.get(u.pathname.slice(1) || 'index.html');
      else if (u.pathname === '/api/config') assert.deepEqual(JSON.parse(bytes.toString()), { publishing: false });
      else { assert.equal(u.pathname, '/'); assert.match(bytes.toString(), /Linen — a little space/); }
      if (expected) assert.equal(hash(bytes), hash(expected));
      const filename = `responses/${row.sha256}.bin`; if (!report.uniqueResponses[row.sha256]) { report.uniqueResponses[row.sha256] = { original: filename, bytes: bytes.length }; await writeFile(path.join(PROOF, filename), bytes, { flag: 'wx' }); }
      row.original = filename; row.bodyBound = true;
    })();
    state.jobs.add(job); void job.catch(error => result.boundary.violations.push(`response:${error.message}`)).finally(() => state.jobs.delete(job));
  });
  state.page = await context.newPage(); await state.page.goto(origin, { waitUntil: 'load' });
  await expect(state.page.getByRole('textbox', { name: 'Your name', exact: true })).toBeVisible();
  await saved(state); await settle(state); return state;
}
const activate = (state, locator) => state.narrow ? locator.tap() : locator.click();
async function saved(state) { await expect(state.page.locator('.save-status')).toHaveText('Saved on this device'); }
async function closeSettings(state) { if (state.narrow) { const dialog = state.page.getByRole('dialog'); if (await dialog.isVisible()) { const title = await dialog.getAttribute('aria-label'); await activate(state, dialog.getByRole('button', { name: `Close ${title}`, exact: true })); await expect(dialog).not.toBeVisible(); } } }
async function settings(state, id) {
  const article = state.page.locator(`[data-card-id="${id}"]`);
  await activate(state, article.getByRole('button', { name: /^Edit / }));
  return state.page.getByRole('complementary', { name: 'Card settings' });
}
async function add(state, kind) {
  await activate(state, state.page.getByRole('button', { name: 'Add a card', exact: true }));
  const dialog = state.page.getByRole('dialog', { name: 'A little bit of you.' });
  await expect(dialog).toBeVisible(); await activate(state, dialog.getByRole('button', { name: new RegExp(`^${kind} `) }));
  await expect(state.page.getByRole('complementary', { name: 'Card settings' })).toBeVisible();
  return state.page.locator('.ln-card.selected').getAttribute('data-card-id');
}
const ids = state => state.page.locator('.ln-grid > article').evaluateAll(elements => elements.map(e => e.dataset.cardId));
async function layout(state, label) {
  const value = await state.page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth,
    cards: [...document.querySelectorAll('.ln-grid > article')].map(e => { const r = e.getBoundingClientRect(), css = getComputedStyle(e); return { id: e.dataset.cardId, x: r.x, y: r.y, width: r.width, height: r.height, column: css.gridColumn, row: css.gridRow }; }) }));
  assert.ok(value.scrollWidth <= value.innerWidth + 1, 'horizontal_overflow');
  for (const [i, a] of value.cards.entries()) {
    assert.ok([a.x, a.y, a.width, a.height].every(Number.isFinite) && a.width > 0 && a.height > 0);
    for (const b of value.cards.slice(0, i)) assert.ok(a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1 || a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1, 'card_overlap');
  }
  state.result.observations.push({ label, layout: value });
}
async function files(state) {
  await activate(state, state.page.getByRole('button', { name: 'Your files ↗', exact: true }));
  const dialog = state.page.getByRole('dialog', { name: 'Yours to keep.' }); await expect(dialog).toBeVisible(); return dialog;
}
async function closeFiles(state) { await activate(state, state.page.getByRole('dialog', { name: 'Yours to keep.' }).getByRole('button', { name: 'Close Yours to keep.', exact: true })); }
async function download(state, dialog, site, label) {
  const pending = state.page.waitForEvent('download');
  await activate(state, dialog.getByRole('button', { name: site ? /^Export static website/ : /^Download page backup/ }));
  const item = await pending, name = `${state.result.id}-${label}.zip`, file = path.join(PROOF, 'downloads', name);
  await item.saveAs(file); assert.equal(await item.failure(), null); const bytes = await readFile(file); const entries = unzip(bytes);
  state.result.downloads.push({ original: `downloads/${name}`, suggested: item.suggestedFilename(), bytes: bytes.length, sha256: hash(bytes),
    members: [...entries].map(([name, body]) => ({ path: name, bytes: body.length, sha256: hash(body) })) });
  return { file, bytes, entries };
}
async function choose(state, locator, file) {
  const pending = state.page.waitForEvent('filechooser'); await activate(state, locator); const chooser = await pending;
  assert.equal(chooser.isMultiple(), false); await chooser.setFiles(file);
}
async function importWithConfirmation(state, dialog, file, accept) {
  const response = new Promise((resolve, reject) => { state.pendingDialog = { accept, resolve, reject }; });
  await choose(state, dialog.getByRole('button', { name: /^Import a page backup/ }), file); await response;
  if (accept) await expect(state.page.getByText('Backup restored locally. Nothing was published.', { exact: true })).toBeVisible();
  else await expect(dialog.getByRole('button', { name: /^Download page backup/ })).toBeEnabled();
}
async function imageDecoded(locator) {
  await expect(locator).toBeVisible(); await expect.poll(() => locator.evaluate(image => ({ complete: image.complete, width: image.naturalWidth, height: image.naturalHeight }))).toEqual({ complete: true, width: 2, height: 2 });
}
async function publishingOff(state) {
  await activate(state, state.page.getByRole('button', { name: 'Publish', exact: true }));
  const dialog = state.page.getByRole('dialog', { name: 'Give your page a home.' });
  await expect(dialog.getByText(/Publishing is not configured/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Publish page/ })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Save cloud draft', exact: true })).toBeDisabled();
  await state.page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
  await expect(state.page.getByRole('button', { name: 'Publish', exact: true })).toBeFocused();
}
async function authoring(state) {
  const p = state.page;
  await p.getByRole('textbox', { name: 'Your name', exact: true }).fill('Mara <Studio>'); await p.keyboard.press('Enter');
  await p.getByRole('textbox', { name: 'About you', exact: true }).fill('Authored corner.\nSecond line.');
  await activate(state, p.getByRole('button', { name: 'Edit profile and appearance', exact: true }));
  const profile = p.getByRole('complementary', { name: 'Profile settings' });
  await profile.getByLabel('Public handle', { exact: true }).fill('mara-studio');
  await profile.getByLabel('Location', { exact: true }).fill('Madrid'); await activate(state, profile.getByRole('button', { name: 'Oat', exact: true }));
  await activate(state, profile.getByRole('button', { name: 'Serif', exact: true })); await closeSettings(state);
  const note = await add(state, 'Note'); let panel = p.getByRole('complementary', { name: 'Card settings' });
  await panel.getByLabel('Title (optional)', { exact: true }).fill('Notebook'); await panel.getByLabel('Text', { exact: true }).fill('First authored note.'); await closeSettings(state);
  await p.getByRole('textbox', { name: 'Note text', exact: true }).fill('A direct edit <kept as text>.');
  const link = await add(state, 'Link'); panel = p.getByRole('complementary', { name: 'Card settings' });
  await panel.getByLabel('Title', { exact: true }).fill('Portfolio'); await panel.getByLabel('Destination', { exact: true }).fill('https://example.test/work');
  await activate(state, panel.getByRole('button', { name: 'Large · 2 × 2', exact: true })); await closeSettings(state);
  await expect(p.locator(`[data-card-id="${link}"]`)).toHaveCSS('grid-row-end', 'span 2');
  await activate(state, p.getByRole('button', { name: 'Undo', exact: true })); await expect(p.locator(`[data-card-id="${link}"]`)).toHaveCSS('grid-row-end', 'span 1');
  await activate(state, p.getByRole('button', { name: 'Redo', exact: true })); await expect(p.locator(`[data-card-id="${link}"]`)).toHaveCSS('grid-row-end', 'span 2');
  if (state.narrow) { panel = await settings(state, link); await activate(state, panel.getByRole('button', { name: 'Move earlier', exact: true })); await closeSettings(state); }
  else { const grip = p.locator(`[data-card-id="${link}"]`).getByRole('button', { name: /^Move .*Use arrow keys/ }); await grip.focus(); await grip.press('ArrowLeft'); }
  await expect.poll(() => ids(state)).toEqual([link, note]);
  await activate(state, p.getByRole('button', { name: 'Undo', exact: true })); await expect.poll(() => ids(state)).toEqual([note, link]);
  await activate(state, p.getByRole('button', { name: 'Redo', exact: true })); await expect.poll(() => ids(state)).toEqual([link, note]);
  if (!state.narrow) {
    const grip = p.locator(`[data-card-id="${link}"]`).getByRole('button', { name: /^Move .*Use arrow keys/ });
    await grip.scrollIntoViewIfNeeded(); const from = await grip.boundingBox(), to = await p.locator(`[data-card-id="${note}"]`).boundingBox();
    assert.ok(from && to); await p.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await p.mouse.down();
    await p.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 }); await p.mouse.up();
    await expect.poll(() => ids(state)).toEqual([note, link]);
    state.result.observations.push({ label: 'native-pointer-reorder', from, to, order: [note, link] });
    await activate(state, p.getByRole('button', { name: 'Undo', exact: true })); await expect.poll(() => ids(state)).toEqual([link, note]);
  }
  panel = await settings(state, note); await activate(state, panel.getByRole('button', { name: 'Duplicate card', exact: true }));
  await expect(p.locator('.ln-grid > article')).toHaveCount(3); await activate(state, panel.getByRole('button', { name: 'Delete card', exact: true })); await closeSettings(state);
  await expect.poll(() => ids(state)).toEqual([link, note]); await layout(state, 'edited');
  await activate(state, p.getByRole('button', { name: 'Preview page', exact: true }));
  await expect(p.locator('.ln-name')).toHaveText('Mara <Studio>'); await expect(p.getByRole('link', { name: /Portfolio/ })).toHaveAttribute('href', 'https://example.test/work');
  await expect(p.locator('.card-controls')).toHaveCount(0); await activate(state, p.getByRole('button', { name: 'Back to editing', exact: true }));
  await publishingOff(state); await saved(state); await settle(state); await p.reload({ waitUntil: 'load' }); await saved(state);
  await expect(p.locator('.ln-name')).toHaveText('Mara <Studio>'); await expect(p.getByRole('textbox', { name: 'Note text', exact: true })).toHaveText('A direct edit <kept as text>.');
  await expect.poll(() => ids(state)).toEqual([link, note]); await expect(p.locator('.linen-page')).toHaveAttribute('data-theme', 'oat');
  await expect(p.locator('.linen-page')).toHaveAttribute('data-font', 'serif'); await layout(state, 'reloaded');
  const dialog = await files(state), backup = await download(state, dialog, false, 'authoring');
  const manifest = JSON.parse(backup.entries.get('project.json').toString());
  assert.equal(manifest.page.name, 'Mara <Studio>'); assert.deepEqual(manifest.page.cards.map(x => x.id), [link, note]);
  assert.equal(manifest.page.cards[0].size, 'large'); assert.equal(manifest.page.cards[1].text, 'A direct edit <kept as text>.');
  await closeFiles(state); await p.screenshot({ path: path.join(PROOF, `${state.result.id}.png`), fullPage: true });
}
async function portability(state) {
  const p = state.page; await p.getByRole('textbox', { name: 'Your name', exact: true }).fill('Mara <Linen>');
  await p.getByRole('textbox', { name: 'About you', exact: true }).fill('An authored portable page.');
  await choose(state, p.getByRole('button', { name: 'Change profile photo', exact: true }), samplePath);
  await expect(p.getByText('File added to this device.', { exact: true })).toBeVisible(); await imageDecoded(p.locator('.ln-avatar img'));
  const note = await add(state, 'Note'); let panel = p.getByRole('complementary', { name: 'Card settings' });
  await panel.getByLabel('Title (optional)', { exact: true }).fill('A note'); await panel.getByLabel('Text', { exact: true }).fill('Portable <literal> text.'); await closeSettings(state);
  const image = await add(state, 'Image'); panel = p.getByRole('complementary', { name: 'Card settings' });
  await panel.getByLabel(/^Image description/).fill('Authored two-by-two swatch');
  await choose(state, panel.getByRole('button', { name: 'Choose image', exact: true }), samplePath);
  await expect(p.getByText('File added to this device.', { exact: true })).toBeVisible(); await closeSettings(state);
  await imageDecoded(p.locator(`[data-card-id="${image}"] img`)); await saved(state);
  let dialog = await files(state); const original = await download(state, dialog, false, 'original');
  const manifest = JSON.parse(original.entries.get('project.json').toString());
  assert.equal(manifest.format, 'linen.project'); assert.equal(manifest.version, 1); assert.equal(manifest.media.length, 2);
  assert.deepEqual(Object.keys(manifest).sort(), ['format', 'media', 'page', 'version']);
  assert.ok(!/"(?:ownerKey|previewKey|remote)"\s*:/.test(original.entries.get('project.json').toString()));
  for (const media of manifest.media) { assert.equal(hash(original.entries.get(media.path)), hash(sample)); assert.equal(media.type, 'image/png'); }
  await choose(state, dialog.getByRole('button', { name: /^Import a page backup/ }), badZip);
  await expect(dialog.getByRole('status')).toContainText(/ZIP/); const afterInvalid = await download(state, dialog, false, 'invalid-preserved');
  assert.equal(hash(afterInvalid.bytes), hash(original.bytes)); await closeFiles(state);
  await choose(state, p.getByRole('button', { name: 'Change profile photo', exact: true }), badImage);
  await saved(state); await expect(p.getByRole('status').filter({ hasText: /file|image|PNG|signature|supported/i }).last()).toBeVisible(); await imageDecoded(p.locator('.ln-avatar img'));
  await p.getByRole('textbox', { name: 'Your name', exact: true }).fill('Changed local draft'); await saved(state);
  await expect(p.locator('.ln-name')).toHaveText('Changed local draft');
  dialog = await files(state); const changed = await download(state, dialog, false, 'changed');
  const changedManifest = JSON.parse(changed.entries.get('project.json').toString());
  assert.notEqual(hash(changed.bytes), hash(original.bytes));
  assert.deepEqual(changedManifest.page, { ...manifest.page, name: 'Changed local draft' });
  assert.deepEqual(changedManifest.media, manifest.media);
  for (const media of manifest.media) assert.equal(hash(changed.entries.get(media.path)), hash(original.entries.get(media.path)));
  state.result.observations.push({ label: 'malformed-image-preserved-and-name-edited', name: changedManifest.page.name, allOtherPageAndReferencedMediaBytesUnchanged: true });
  await importWithConfirmation(state, dialog, original.file, false);
  const cancelled = await download(state, dialog, false, 'cancelled'); assert.equal(hash(cancelled.bytes), hash(changed.bytes));
  await importWithConfirmation(state, dialog, original.file, true); await saved(state);
  await expect(p.locator('.ln-name')).toHaveText('Mara <Linen>'); await expect.poll(() => ids(state)).toEqual([note, image]);
  await imageDecoded(p.locator('.ln-avatar img')); await imageDecoded(p.locator(`[data-card-id="${image}"] img`));
  await settle(state); await p.reload({ waitUntil: 'load' }); await saved(state); await imageDecoded(p.locator('.ln-avatar img'));
  await imageDecoded(p.locator(`[data-card-id="${image}"] img`)); dialog = await files(state);
  const restored = await download(state, dialog, false, 'restored'); assert.equal(hash(restored.bytes), hash(original.bytes));
  const siteZip = await download(state, dialog, true, 'site'); assert.ok(siteZip.entries.has('index.html'));
  for (const media of manifest.media) assert.equal(hash(siteZip.entries.get(media.path)), hash(sample));
  await closeFiles(state); await layout(state, 'restored'); await publishingOff(state);
  await p.screenshot({ path: path.join(PROOF, `${state.result.id}.png`), fullPage: true });
  const site = await serveExport(state, siteZip.entries), reader = await state.context.newPage();
  await reader.goto(site.origin, { waitUntil: 'load' }); await expect(reader.getByRole('heading', { name: 'Mara <Linen>', exact: true })).toBeVisible();
  await expect(reader.getByText('Portable <literal> text.', { exact: true })).toBeVisible();
  await expect(reader.locator('[contenteditable="true"], .editor-header, .card-controls')).toHaveCount(0);
  for (const img of await reader.locator('img').all()) await imageDecoded(img);
  assert.equal(await reader.locator('img').count(), 2); await reader.screenshot({ path: path.join(PROOF, `${state.result.id}-export.png`), fullPage: true });
  state.result.observations.push({ label: 'separate-static-origin', origin: site.origin, imagesDecoded: 2, authorStorageUsed: false,
    backupIdentityAndMediaRestoredExactly: true, staticBytesFromActualDownload: true });
}
async function runCase(id, narrow, work) {
  const result = { id, passed: false }; report.cases.push(result); let state;
  try { state = await fresh(result, narrow); await work(state); await settle(state);
    assert.deepEqual(result.boundary.violations, []); assert.deepEqual(result.boundary.pageErrors, []); assert.deepEqual(result.boundary.consoleErrors, []);
    assert.equal(result.boundary.websockets, 0); assert.ok(result.boundary.requests.every(x => x.finished && !x.failed && x.bodyBound)); result.passed = true;
  } catch (error) { result.error = { name: error.name, message: error.message, stack: error.stack }; if (state) await state.page.screenshot({ path: path.join(PROOF, `${id}-failure.png`), fullPage: true }).catch(() => {}); }
  finally {
    if (state) {
      try { await settle(state); result.cleanup.networkDrained = true; } catch (error) { result.passed = false; result.cleanup.error = error.message; }
      for (const page of state.pages) await page.close().catch(() => {}); result.cleanup.pagesClosed = state.pages.every(x => x.isClosed());
      await state.context.close(); contexts.delete(state.context); result.cleanup.contextClosed = true;
      await closeSite(state.site); result.cleanup.staticServerClosed = !state.site || !staticServers.has(state.site);
      result.passed &&= Object.values(result.cleanup).every(x => x === true);
    }
  }
}
for (const event of ['SIGTERM', 'SIGINT']) process.once(event, () => { interrupted = true; void browser?.close(); void stopNext(); });
try {
  await startNext(); browser = await chromium.launch({ headless: true }); report.browserVersion = browser.version();
  for (const [id, narrow, work] of [['L02', true, authoring], ['L03', false, portability], ['L04', true, portability]]) {
    if (interrupted) break; await runCase(id, narrow, work);
  }
} catch (error) { report.errors.push({ message: error.message, stack: error.stack }); }
finally {
  for (const context of contexts) await context.close().catch(() => {}); contexts.clear();
  for (const site of [...staticServers]) await closeSite(site).catch(error => report.errors.push({ message: error.message }));
  await browser?.close().catch(error => report.errors.push({ message: error.message }));
  await stopNext().catch(error => report.errors.push({ message: error.message }));
}
report.passed = !interrupted && report.errors.length === 0 && report.cases.length === 3 && report.cases.every(x => x.passed);
await writeFile(path.join(PROOF, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ passed: report.passed, cases: report.cases.map(x => ({ id: x.id, passed: x.passed, error: x.error?.message })), errors: report.errors }) + '\n');
process.exitCode = report.passed ? 0 : 1;
