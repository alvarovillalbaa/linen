import test from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, blankPage, createCard, validatePage, publicationIssues, assetIds, packCards, moveCard, resizeCard, safeHref, safeImageUrl, embedFor, normalizeHandle } from '../../lib/model.ts';

// Authored T2 data. No requests, providers, accounts or external fixtures.
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const card = (kind = 'text', number = 1, changes = {}) => ({ id: id(number), kind, size: 'wide', title: 'Studio notes', text: 'A small authored example.', url: '', coverUrl: '', mediaId: '', alt: '', lat: 0, lng: 0, ...changes });
const page = (cards = [card()], changes = {}) => ({ version: 1, id: id(999), handle: 'sample-studio', name: 'Sample studio', bio: '', location: '', avatarId: '', theme: 'paper', font: 'sans', accent: '#C66D4A', cards, ...changes });
function freeze(value) { for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child); return Object.freeze(value); }

test('new pages/cards are independent editable drafts with UUID identities and fixed limits', () => {
  const first = blankPage(), second = blankPage();
  assert.notEqual(first.id, second.id); assert.notEqual(first.cards, second.cards);
  assert.equal(first.name, ''); assert.equal(first.handle, ''); assert.equal(first.cards.length, 0);
  assert.deepEqual(validatePage(first), first);
  const image = createCard('image'), link = createCard('link');
  assert.notEqual(image.id, link.id); assert.equal(image.kind, 'image'); assert.equal(image.mediaId, '');
  assert.deepEqual(validatePage(page([image, link])).cards, [image, link]);
  assert.throws(() => createCard('html'), /not supported/);
  assert.deepEqual(LIMITS, { cards: 32, pageBytes: 131072, imageBytes: 8388608, videoBytes: 33554432, mediaBytes: 67108864 });
  assert.equal(Object.isFrozen(LIMITS), true);
});

test('draft validation preserves unfinished editable strings and clones every transport object', () => {
  const source = freeze(page([card('link', 1, { title: '  In progress ', text: '', url: 'https://', alt: ' unfinished ' })], { name: '', handle: '@', accent: '#C', bio: '  Draft\nline  ' }));
  const draft = validatePage(source);
  assert.deepEqual(draft, source); assert.notEqual(draft, source); assert.notEqual(draft.cards, source.cards); assert.notEqual(draft.cards[0], source.cards[0]);
  draft.cards[0].title = 'Edited'; assert.equal(source.cards[0].title, '  In progress ');
  assert.ok(publicationIssues(source).length >= 3);
});

test('unknown credentials and prototype/accessor tricks cannot enter persisted page data', () => {
  for (const key of ['ownerKey', 'previewKey', '__proto__', 'constructor']) {
    const source = page(); Object.defineProperty(source, key, { value: 'private-example', enumerable: true });
    assert.throws(() => validatePage(source), /unknown fields/);
  }
  assert.throws(() => validatePage(page([{ ...card(), ownerKey: 'private-example' }])), /unknown fields/);
  assert.throws(() => validatePage(Object.assign(Object.create({ secret: true }), page())), /plain object/);
  let reads = 0; const source = page(); Object.defineProperty(source, 'name', { enumerable: true, get() { reads++; return 'Injected'; } });
  assert.throws(() => validatePage(source), /data field/); assert.equal(reads, 0);
  const symbolic = page(); symbolic[Symbol('private')] = true;
  assert.throws(() => validatePage(symbolic), /unknown fields/);
  const nullPrototype = Object.assign(Object.create(null), page());
  assert.equal(Object.getPrototypeOf(validatePage(nullPrototype)), Object.prototype);
});

test('malformed arrays, scalar IDs and duplicate identities fail before a draft can save', () => {
  const sparse = [card(), , card('text', 3)];
  assert.throws(() => validatePage(page(sparse)), /dense array|without gaps/);
  const extra = [card()]; extra.ownerKey = 'private-example';
  assert.throws(() => validatePage(page(extra)), /plain dense array/);
  const accessors = [card()]; Object.defineProperty(accessors, 0, { get() { throw new Error('Must not execute'); } });
  assert.throws(() => validatePage(page(accessors)), /data items/);
  assert.throws(() => validatePage(page([card(), card()])), /unique ID/);
  for (const value of [null, {}, 123, '', 'raw-storage-id', '00000000-0000-0000-0000-000000000000']) assert.throws(() => validatePage(page([], { id: value })), /UUID/);
  assert.throws(() => validatePage(page([], { avatarId: { id: id(10) } })), /UUID/);
  assert.throws(() => validatePage(page([card('image', 1, { mediaId: 'storage-unsafe' })])), /UUID/);
});

test('draft bounds use actual UTF-8 page bytes and reject unsupported versions/types/coordinates', () => {
  assert.throws(() => validatePage(page(Array.from({ length: 33 }, (_, n) => card('text', n + 1)))), /at most 32/);
  assert.throws(() => validatePage(page([], { version: 2 })), /version/);
  assert.throws(() => validatePage(page([], { name: 'a'.repeat(121) })), /at most 120/);
  assert.throws(() => validatePage(page([card('text', 1, { text: 'a'.repeat(6001) })])), /at most 6000/);
  assert.throws(() => validatePage(page([], { theme: 'custom' })), /Theme/);
  for (const lat of [NaN, Infinity, 91, '10']) assert.throws(() => validatePage(page([card('map', 1, { lat })])), /latitude/);
  assert.throws(() => validatePage(page([card('map', 1, { lng: -181 })])), /longitude/);
  const unicode = page(Array.from({ length: 16 }, (_, n) => card('text', n + 1, { text: '界'.repeat(3000) })));
  assert.ok(JSON.stringify(unicode).length < LIMITS.pageBytes);
  assert.throws(() => validatePage(unicode), /128 KiB/);
});

test('well-formed international text survives while unpaired surrogates get a readable error', () => {
  const source = page([card('text', 1, { text: 'Café · 東京 · 🧵' })], { name: 'Studio 🪡' });
  assert.deepEqual(validatePage(source), source);
  for (const broken of ['\ud800', '\udc00', 'hello\ud800world']) assert.throws(() => validatePage(page([], { bio: broken })), /incomplete Unicode/);
});

test('publication reports meaningful field issues without mutating or discarding drafts', () => {
  const source = page([card('link', 1, { title: '', url: 'javascript:alert(1)' }), card('image', 2, { title: '', alt: '' }), card('video', 3, { title: '' }), card('text', 4, { title: ' ', text: ' ' }), card('section', 5, { title: '' }), card('map', 6, { title: '' })], { name: ' ', handle: '-ab', accent: '#x' });
  const before = structuredClone(source), issues = publicationIssues(source);
  assert.deepEqual(source, before);
  for (const phrase of ['handle', 'name', 'accent', 'link title', 'alt text', 'video title', 'some text', 'section heading', 'location label']) assert.ok(issues.some(issue => issue.includes(phrase)), phrase);
  assert.equal(publicationIssues({ ...page(), ownerKey: 'private-example' }).length, 1);
  assert.ok(publicationIssues(page([card('section')])).some(issue => issue.includes('content card')));
});

test('every supported card class can publish and unknown HTTPS embeds keep their outbound fallback', () => {
  const source = page([
    card('link', 1, { url: 'mailto:studio@example.test' }),
    card('image', 2, { url: 'https://media.example.test/swatch.webp', title: '', alt: 'An authored color swatch.' }),
    card('video', 3, { url: 'https://media.example.test/clip.webm' }),
    card('embed', 4, { title: '', url: 'https://example.test/unsupported-player' }),
    card('map', 5, { lat: 40.4, lng: -3.7, url: 'https://example.test/location' }),
    card('text', 6, { title: '', text: 'Useful notes.' }), card('section', 7),
  ]);
  assert.equal(embedFor(source.cards[3].url), null);
  assert.deepEqual(publicationIssues(source, []), []);
  assert.ok(publicationIssues(page([card('embed', 1, { url: 'http://example.test/embed' })])).length);
  assert.ok(publicationIssues(page([card('image', 1, { url: '/local-image.png', alt: 'Swatch' })])).length);
});

test('assets are deduplicated in source order and supplied availability is enforced only when provided', () => {
  const source = page([card('link', 1, { url: 'https://example.test', mediaId: id(41) }), card('image', 2, { mediaId: id(41), alt: 'Swatch', url: 'tel:+34600700100' }), card('video', 3, { mediaId: id(42) })], { avatarId: id(40) });
  assert.deepEqual(assetIds(source), [id(40), id(41), id(42)]);
  assert.deepEqual(publicationIssues(source), []);
  assert.deepEqual(publicationIssues(source, new Set(assetIds(source))), []);
  const missing = publicationIssues(source, [id(40), id(42)]);
  assert.equal(missing.length, 1); assert.ok(missing[0].includes(id(41)));
  assert.ok(publicationIssues(page([card('image', 1, { mediaId: id(41), url: 'data:text/html,bad' })])).some(issue => issue.includes('destination')));
});

test('cover URLs preserve incomplete drafts, accept HTTPS publication and reject executable or local covers', () => {
  const unfinished = page([card('link', 1, { url: 'https://example.test', coverUrl: 'https://' })]);
  assert.equal(validatePage(unfinished).cards[0].coverUrl, 'https://');
  assert.ok(publicationIssues(unfinished).some(issue => issue.includes('cover image URL')));
  const complete = page([card('link', 1, { url: 'https://example.test', coverUrl: 'https://media.example.test/cover.webp' })]);
  assert.deepEqual(publicationIssues(complete), []); assert.deepEqual(assetIds(complete), []);
  for (const coverUrl of ['javascript:alert(1)', 'data:image/svg+xml,bad', 'http://example.test/image.png', '/media/cover.png']) assert.ok(publicationIssues(page([card('video', 1, { url: 'https://media.example.test/clip.mp4', coverUrl })])).some(issue => issue.includes('cover image URL')));
  assert.throws(() => validatePage(page([card('link', 1, { coverUrl: 'x'.repeat(2049) })])), /at most 2048/);
  const legacy = card(); delete legacy.coverUrl;
  assert.throws(() => validatePage(page([legacy])), /missing or unknown/);
});

test('navigation helpers allow intentional web/email/telephone destinations and reject executable/deceptive URLs', () => {
  assert.equal(safeHref(' https://EXAMPLE.test/a b '), 'https://example.test/a%20b');
  assert.equal(safeHref('http://example.test'), 'http://example.test/');
  assert.equal(safeHref('mailto:studio@example.test?subject=Hello&body=One%0ATwo'), 'mailto:studio@example.test?subject=Hello&body=One%0ATwo');
  assert.equal(safeHref('tel:+34 (600) 700-100;ext=42'), 'tel:+34600700100;ext=42');
  for (const value of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,bad', 'blob:https://example.test/x', 'ftp://example.test/file', '//example.test', 'https:example.test', 'https://owner:secret@example.test', 'https://example.test\n/path', 'https://example.test\\evil', 'mailto:not-an-address', 'mailto:studio@example.test?subject=Hi%0ABcc:other@example.test', 'tel:call-me', 'tel:12']) assert.equal(safeHref(value), null, value);
});

test('media helper supports generated assets without allowing remote HTTP, executable schemes or traversal', () => {
  for (const value of ['https://media.example.test/a.png', '/api/media/sample-studio/asset?preview=example', 'media/example.webp', './media/example.webp', `blob:https://example.test/${id(1)}`, `blob:null/${id(1)}`]) assert.equal(safeImageUrl(value), value);
  for (const value of ['http://media.example.test/a.png', '//evil.test/a.png', 'data:image/svg+xml,bad', 'javascript:alert(1)', 'media/../secret', 'media/%2e%2e/secret', '/%2f%2fevil.test/image', 'file:///private/example', 'https://user:secret@media.example.test/a.png']) assert.equal(safeImageUrl(value), null, value);
});

test('provider embeds use fixed HTTPS player origins and ignore unrelated query injection', () => {
  const youtube = embedFor('https://youtu.be/AbCdEf012_-?autoplay=1&origin=https://evil.test');
  assert.deepEqual(youtube, { provider: 'youtube', title: 'YouTube video', src: 'https://www.youtube-nocookie.com/embed/AbCdEf012_-' });
  assert.equal(embedFor('https://www.youtube.com/shorts/AbCdEf012_-').provider, 'youtube');
  assert.equal(embedFor('https://www.youtube.com/watch?v=AbCdEf012_-&start=90').src, 'https://www.youtube-nocookie.com/embed/AbCdEf012_-?start=90');
  assert.equal(embedFor('https://www.youtube.com/embed/videoseries?list=PL0123456789abcdef').src, 'https://www.youtube-nocookie.com/embed/videoseries?list=PL0123456789abcdef');
  assert.equal(embedFor('https://vimeo.com/123456789/abcdef1234').src, 'https://player.vimeo.com/video/123456789?h=abcdef1234');
  assert.equal(embedFor('https://open.spotify.com/intl-es/track/0123456789ABCDEFGHIJKL?si=ignored').src, 'https://open.spotify.com/embed/track/0123456789ABCDEFGHIJKL');
  const soundcloud = embedFor('https://soundcloud.com/authored-studio/sample-track?tracking=ignored');
  assert.equal(new URL(soundcloud.src).origin, 'https://w.soundcloud.com');
  assert.equal(new URL(soundcloud.src).searchParams.get('url'), 'https://soundcloud.com/authored-studio/sample-track');
  assert.equal(embedFor('https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F12345&auto_play=true').src, 'https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F12345&auto_play=false&show_user=true');
  assert.equal(embedFor('https://w.soundcloud.com/player/?url=https%3A%2F%2Fevil.test%2Fa'), null);
  for (const value of ['https://youtube.com.evil.test/watch?v=AbCdEf012_-', 'https://evil.test/youtube.com/embed/AbCdEf012_-', 'https://youtube.com@evil.test/watch?v=AbCdEf012_-', 'http://youtube.com/watch?v=AbCdEf012_-', 'https://youtube.com/watch?v=bad', 'https://vimeo.com/showcase/123', 'https://open.spotify.com/search/test', 'https://soundcloud.com/search/test', 'https://youtube.com:444/watch?v=AbCdEf012_-']) assert.equal(embedFor(value), null, value);
});

test('handle normalization stays explicit and publication rejects invalid claimed identities', () => {
  assert.equal(normalizeHandle(' @Sample-Studio '), 'sample-studio');
  assert.equal(normalizeHandle('Two words'), 'two words');
  for (const handle of ['ab', '-abc', 'abc-', 'Aaa', 'two words', 'x'.repeat(31)]) {
    const source = page(); source.handle = handle;
    assert.ok(publicationIssues(source).some(issue => issue.toLowerCase().includes('handle')));
  }
  assert.deepEqual(publicationIssues(page()), []);
});

function assertReadableLayout(cards, columns) {
  const layout = packCards(cards, columns);
  assert.deepEqual(layout.map(item => item.id), cards.map(item => item.id));
  for (const [index, item] of layout.entries()) {
    assert.ok(item.column >= 1 && item.column + item.columns - 1 <= columns);
    assert.ok(item.row >= 1 && item.row + item.rows - 1 <= 64);
    if (index) assert.ok((item.row - 1) * columns + item.column > (layout[index - 1].row - 1) * columns + layout[index - 1].column);
    for (const other of layout.slice(0, index)) assert.ok(item.column + item.columns <= other.column || other.column + other.columns <= item.column || item.row + item.rows <= other.row || other.row + other.rows <= item.row, 'Visible card rectangles must not overlap.');
  }
  return layout;
}
test('two/four-column layouts stay deterministic, bounded, nonoverlapping and in readable source order', () => {
  const sizes = ['small', 'wide', 'tall', 'large'];
  for (const columns of [2, 4]) for (let seed = 0; seed < 16; seed++) {
    const cards = freeze(Array.from({ length: 32 }, (_, n) => card('text', n + 1, { size: sizes[(n * (seed + 1) + seed + Math.floor(n / 3)) % sizes.length] })));
    const layout = assertReadableLayout(cards, columns); assert.deepEqual(layout, packCards(cards, columns));
  }
  const cards = [card('text', 1), card('text', 2, { size: 'tall' }), card('text', 3), card('text', 4, { size: 'small' })];
  const layout = assertReadableLayout(cards, 4);
  assert.ok(layout[3].row >= layout[2].row, 'A later small card must not jump into an earlier visual gap.');
  assert.throws(() => packCards(cards, 3), /two or four/);
  assert.throws(() => packCards(Array.from({ length: 33 }, (_, n) => card('text', n + 1)), 2), /at most 32/);
});

test('move and resize operations preserve content immutably and handle stale/no-op controls safely', () => {
  const source = freeze(page([card('text', 1), card('text', 2), card('text', 3)]));
  const moved = moveCard(source, id(1), 99);
  assert.deepEqual(moved.cards.map(item => item.id), [id(2), id(3), id(1)]);
  assert.deepEqual(source.cards.map(item => item.id), [id(1), id(2), id(3)]);
  assert.equal(moved.cards[2], source.cards[0]); assert.equal(moveCard(source, id(99), 0), source);
  assert.equal(moveCard(source, id(1), NaN), source); assert.equal(moveCard(source, id(1), 0), source);
  const resized = resizeCard(source, id(2), 'large');
  assert.equal(resized.cards[1].size, 'large'); assert.equal(source.cards[1].size, 'wide');
  assert.equal(resized.cards[0], source.cards[0]); assert.notEqual(resized.cards[1], source.cards[1]);
  assert.equal(resizeCard(source, id(99), 'large'), source); assert.equal(resizeCard(source, id(1), 'wide'), source);
  assert.throws(() => resizeCard(source, id(1), 'huge'), /not supported/);
});
