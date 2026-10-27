import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Authored T2 frontend data. No browser, database or network is involved.
const lib = new URL('../../lib/', import.meta.url).href;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL?.startsWith(lib) && /^\.\/(model|types)$/.test(specifier)) return nextResolve(new URL(`${specifier}.ts`, context.parentURL).href, context);
  return nextResolve(specifier, context);
} });
const { blankPage, createCard } = await import('../../lib/model.ts');
const { renderCard, renderDocument } = await import('../../lib/render.ts');
const profile = () => ({ ...blankPage(), handle: 'authored-fixture', name: 'Authored creator', bio: 'A private local test fixture.' });

test('profile text and card attributes cannot become executable HTML', () => {
  const page = profile();
  page.name = '</title><script>alert(1)</script>';
  page.bio = '<img src=x onerror="alert(1)">';
  page.cards = [{ ...createCard('image'), url: 'https://example.com/photo.png', title: '"><script>alert(2)</script>', alt: '" onerror="alert(3)' }];
  const html = renderDocument(page, {});
  assert.doesNotMatch(html, /<script|<img src=x|alt="" onerror=/);
  assert.match(html, /&lt;\/title&gt;&lt;script&gt;/);
  assert.match(html, /alt="&quot; onerror=&quot;alert\(3\)"/);
});

test('unsafe link, cover and media schemes are omitted from rendered attributes', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'https://user:secret@example.com/']) {
    const link = renderCard({ ...createCard('link'), title: 'Fixture', url, coverUrl: url }, {});
    assert.doesNotMatch(link, /href=|src=/);
    const image = renderCard({ ...createCard('image'), url, alt: 'Fixture' }, {});
    assert.doesNotMatch(image, /href=|src=/);
  }
});

test('packaged uploaded media takes precedence over an external cover', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const card = { ...createCard('link'), title: 'A project', url: 'https://example.com/', coverUrl: 'https://example.com/external.jpg', mediaId: id };
  const html = renderCard(card, { [id]: `media/${id}.png` });
  assert.match(html, new RegExp(`src="media/${id}\\.png"`));
  assert.doesNotMatch(html, /external\.jpg/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test('unsupported embeds retain a usable outbound link without an arbitrary iframe', () => {
  const html = renderCard({ ...createCard('embed'), url: 'https://example.com/music', title: 'My music' }, {});
  assert.match(html, /href="https:\/\/example\.com\/music"/);
  assert.match(html, /My music/);
  assert.doesNotMatch(html, /<iframe/);
});

test('supported embeds use the fixed player origin and retain an outward link', () => {
  const html = renderCard({ ...createCard('embed'), url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Authored video link' }, {});
  assert.match(html, /src="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ"/);
  assert.match(html, /referrerpolicy="no-referrer"/);
  assert.match(html, /href="https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ"/);
  assert.doesNotMatch(html, /autoplay/);
});

test('sharing metadata is profile-specific and private preview excludes indexing', () => {
  const page = profile();
  const html = renderDocument(page, {}, { canonicalUrl: 'https://example.com/@authored-fixture', imageUrl: 'https://example.com/og/authored-fixture', preview: true });
  assert.match(html, /<title>Authored creator · Linen<\/title>/);
  assert.match(html, /property="og:description" content="A private local test fixture\."/);
  assert.match(html, /property="og:image" content="https:\/\/example.com\/og\/authored-fixture"/);
  assert.match(html, /name="robots" content="noindex,nofollow,noarchive"/);
  assert.match(html, /Private preview/);
  assert.doesNotMatch(html, /ownerKey|Authorization|storageId/);
});

test('public and portable output preserves card order and both responsive placements', () => {
  const page = profile();
  page.cards = ['First authored note', 'Second authored note', 'Third authored note'].map((text, index) => ({ ...createCard('text'), text, size: index === 1 ? 'wide' : 'small' }));
  const html = renderDocument(page, {});
  assert.ok(html.indexOf('First authored note') < html.indexOf('Second authored note'));
  assert.ok(html.indexOf('Second authored note') < html.indexOf('Third authored note'));
  assert.equal((html.match(/style="--ln-dc:/g) || []).length, 3);
  assert.equal((html.match(/;--ln-mc:/g) || []).length, 3);
  assert.match(html, /@container\(max-width:620px\)/);
  assert.doesNotMatch(html, /drag-grip|card-controls|contenteditable/);
});

test('video and missing local assets have explicit accessible output', () => {
  const card = { ...createCard('video'), title: 'An authored clip', mediaId: '00000000-0000-4000-8000-000000000002' };
  const missing = renderCard(card, {});
  assert.match(missing, /Add a video/);
  assert.doesNotMatch(missing, /<video/);
  const ready = renderCard(card, { [card.mediaId]: '/api/media/authored-fixture/00000000-0000-4000-8000-000000000002' });
  assert.match(ready, /controls preload="metadata" playsinline aria-label="An authored clip"/);
  assert.doesNotMatch(ready, /autoplay|storageId/);
});
