import { embedFor, packCards, safeHref, safeImageUrl, validatePage } from './model';
import type { Card, ProfilePage } from './types';

export const PROFILE_CSS = `
*{box-sizing:border-box}.linen-page{--ln-ink:#253b34;--ln-muted:#758179;--ln-surface:#fff;--ln-line:#e6e9e3;--ln-paper:#fafbf7;--ln-accent:#315b4b;color:var(--ln-ink);background:var(--ln-paper);font-family:"Avenir Next","Segoe UI",sans-serif;max-width:1040px;margin:auto;padding:64px 52px 28px;min-height:100%;container-type:inline-size;line-height:1.5}
.linen-page[data-theme=oat]{--ln-paper:#f1eee5;--ln-surface:#fffcf5;--ln-line:#e0ddcf;--ln-ink:#514b3c;--ln-muted:#8a8270}
.linen-page[data-theme=rose]{--ln-paper:#fbf1ee;--ln-surface:#fffaf7;--ln-line:#efdcd5;--ln-ink:#62483f;--ln-muted:#a08277}
.linen-page[data-theme=night]{--ln-paper:#182b25;--ln-surface:#233b32;--ln-line:#355044;--ln-ink:#f0f5e9;--ln-muted:#a4b9a8}
.linen-page[data-font=serif] .ln-name,.linen-page[data-font=serif] .ln-text,.linen-page[data-font=serif] .ln-section{font-family:Baskerville,"Iowan Old Style",Georgia,serif}
.ln-header{margin:0 0 42px;max-width:630px}.ln-avatar{display:flex;align-items:center;justify-content:center;width:88px;height:88px;border-radius:50%;overflow:hidden;background:var(--ln-line);font-size:31px;font-weight:600;margin-bottom:24px}.ln-avatar img{width:100%;height:100%;object-fit:cover}.ln-name{font-size:48px;line-height:1.06;letter-spacing:-2.2px;font-weight:650;margin:0 0 15px;overflow-wrap:anywhere}.ln-bio{font-size:16px;line-height:1.7;margin:0;color:var(--ln-muted);white-space:pre-wrap;overflow-wrap:anywhere}.ln-location{display:block;color:var(--ln-muted);font-size:12px;margin-top:18px}.ln-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:calc((100cqw - 48px)/4);gap:16px}.ln-card{position:relative;min-width:0;min-height:0;grid-column:var(--ln-dc)/span var(--ln-dw);grid-row:var(--ln-dr)/span var(--ln-dh);border:1px solid var(--ln-line);border-radius:24px;background:var(--ln-surface);overflow:hidden;box-shadow:0 2px 3px #22382d03;transition:box-shadow .16s,transform .16s}.ln-card:focus-within{outline:2px solid var(--ln-accent);outline-offset:3px}.ln-content{height:100%;width:100%;position:relative}.ln-card a{color:inherit;text-decoration:none}.ln-link{display:flex;flex-direction:column;justify-content:space-between;gap:12px;height:100%;padding:23px}.ln-link:hover .ln-out{transform:translate(2px,-2px)}.ln-link-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.ln-site-icon{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:var(--ln-accent);color:white;font-weight:700;font-size:19px}.ln-out{font:20px Georgia,serif;transition:transform .16s}.ln-link h3{font-size:16px;line-height:1.35;margin:0 0 5px;letter-spacing:-.25px;overflow-wrap:anywhere}.ln-domain{font-size:10px;color:var(--ln-muted);overflow-wrap:anywhere}.ln-link p{font-size:12px;line-height:1.5;margin:6px 0 0;color:var(--ln-muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.ln-cover{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.ln-with-cover:after{content:"";position:absolute;inset:25% 0 0;background:linear-gradient(transparent,#10251bce)}.ln-with-cover .ln-link{position:relative;z-index:1;color:white}.ln-with-cover .ln-domain,.ln-with-cover .ln-link p{color:#ffffffc9}.ln-text{height:100%;padding:24px;font-size:17px;line-height:1.55;white-space:pre-wrap;overflow:auto;overflow-wrap:anywhere}.ln-text-title{font-size:11px;font-family:"Avenir Next","Segoe UI",sans-serif;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:13px;color:var(--ln-muted)}.ln-card[data-kind=section]{background:transparent;border-color:transparent;box-shadow:none;border-radius:0}.ln-section{height:100%;display:flex;align-items:flex-end;padding:0 5px 12px;font-size:28px;line-height:1.15;font-weight:650;letter-spacing:-.9px;overflow-wrap:anywhere}.ln-image-link{display:block;height:100%}.ln-image-caption{position:absolute;left:16px;right:16px;bottom:14px;color:white;font-size:12px;font-weight:600;text-shadow:0 1px 10px #000b;z-index:1}.ln-media-missing{height:100%;padding:20px;display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;color:var(--ln-muted);text-align:center;font-size:12px;background:repeating-linear-gradient(-45deg,transparent,transparent 14px,var(--ln-line) 15px,transparent 16px)}.ln-media-missing span{font-size:32px}.ln-video{width:100%;height:100%;object-fit:cover;background:#17271f}.ln-embed{height:100%;display:flex;flex-direction:column}.ln-embed iframe{border:0;flex:1;width:100%;min-height:0}.ln-embed-label{font-size:10px;color:var(--ln-muted);padding:7px 13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ln-map{height:100%;position:relative;background:#e7eddf}.ln-map iframe{height:100%;width:100%;border:0}.ln-map-label{position:absolute;bottom:12px;left:12px;right:12px;padding:10px 12px;border-radius:13px;background:#fffffff0;color:#2d4437;font-size:11px;box-shadow:0 3px 15px #213c2220;pointer-events:none}.ln-map-label strong{display:block;font-size:12px}.ln-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:42px;color:var(--ln-muted);font-size:10px}.ln-footer a{color:inherit;text-decoration:none}.ln-footer strong{font-size:15px;font-weight:650;letter-spacing:-.6px}.ln-preview-banner{background:#fff1cf;padding:12px;text-align:center;font:12px "Avenir Next",sans-serif;color:#5c4a25}.ln-empty{padding:35px 20px;border:1px dashed var(--ln-line);border-radius:22px;color:var(--ln-muted);font-size:14px;text-align:center}
@container(max-width:620px){.ln-grid{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:calc((100cqw - 14px)/2);gap:14px}.ln-card{grid-column:var(--ln-mc)/span var(--ln-mw);grid-row:var(--ln-mr)/span var(--ln-mh);border-radius:21px}.ln-link{padding:18px}.ln-text{padding:20px;font-size:16px}.ln-link h3{font-size:15px}.ln-site-icon{width:34px;height:34px;font-size:16px}.ln-header{margin-bottom:32px}.ln-name{font-size:39px;letter-spacing:-1.6px}.ln-avatar{width:76px;height:76px}.ln-bio{font-size:15px}.ln-footer{margin-top:32px}}
@media(max-width:650px){.linen-page{padding:38px 20px 24px}}@media(prefers-reduced-motion:reduce){.ln-card,.ln-out{transition:none!important}}`;

const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
function mediaUrl(value: string | undefined): string | null {
  if (!value) return null;
  if (/^blob:https?:\/\//.test(value) || /^media\/[a-z0-9-]+\.[a-z0-9]+$/i.test(value) || /^\/api\/media\//.test(value)) return value;
  return safeImageUrl(value);
}
const outbound = (url: string) => `href="${escape(url)}" target="_blank" rel="noopener noreferrer"`;
const missing = (title: string) => `<div class="ln-media-missing"><span aria-hidden="true">◇</span>${escape(title)}</div>`;
function domain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') || 'Open link'; } catch { return 'Add a link'; }
}
function linkCard(card: Card, media: Record<string, string>): string {
  const href = safeHref(card.url), cover = mediaUrl(media[card.mediaId]) || safeImageUrl(card.coverUrl);
  const label = card.title.trim() || domain(card.url);
  return `${cover ? `<img class="ln-cover" src="${escape(cover)}" alt="" loading="lazy">` : ''}<${href ? 'a' : 'div'} class="ln-link" ${href ? outbound(href) : ''}><div class="ln-link-top"><span class="ln-site-icon" aria-hidden="true">${escape(domain(card.url).slice(0, 1).toUpperCase())}</span><span class="ln-out" aria-hidden="true">↗</span></div><div><h3>${escape(label)}</h3><span class="ln-domain">${escape(domain(card.url))}</span>${card.text ? `<p>${escape(card.text)}</p>` : ''}</div></${href ? 'a' : 'div'}>`;
}
export function renderCard(card: Card, media: Record<string, string>): string {
  if (card.kind === 'link') return linkCard(card, media);
  if (card.kind === 'section') return `<div class="ln-section">${escape(card.title || 'A new chapter')}</div>`;
  if (card.kind === 'text') return `<div class="ln-text">${card.title ? `<div class="ln-text-title">${escape(card.title)}</div>` : ''}${escape(card.text || 'A thought, a note, a little about you.')}</div>`;
  if (card.kind === 'image') {
    const src = mediaUrl(media[card.mediaId]) || (!card.mediaId ? safeImageUrl(card.url) : null);
    if (!src) return missing('Add an image');
    const href = safeHref(card.url);
    const image = `<img class="ln-cover" src="${escape(src)}" alt="${escape(card.alt || card.title)}" loading="lazy">${card.title ? `<span class="ln-image-caption">${escape(card.title)}</span>` : ''}`;
    return href ? `<a class="ln-image-link" ${outbound(href)}>${image}</a>` : image;
  }
  if (card.kind === 'video') {
    const src = mediaUrl(media[card.mediaId]) || (!card.mediaId ? safeImageUrl(card.url) : null);
    const poster = safeImageUrl(card.coverUrl);
    return src ? `<video class="ln-video" src="${escape(src)}"${poster ? ` poster="${escape(poster)}"` : ''} controls preload="metadata" playsinline aria-label="${escape(card.title || 'Video')}"></video>` : missing('Add a video');
  }
  if (card.kind === 'embed') {
    const embed = embedFor(card.url);
    if (!embed) return linkCard(card, media);
    return `<div class="ln-embed"><iframe src="${escape(embed.src)}" title="${escape(card.title || embed.title)}" loading="lazy" allow="encrypted-media; fullscreen; picture-in-picture" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"></iframe><a class="ln-embed-label" ${outbound(safeHref(card.url)!)}>${escape(card.title || embed.title)} ↗</a></div>`;
  }
  const lat = Math.max(-85, Math.min(85, card.lat)), lng = Math.max(-179.9, Math.min(179.9, card.lng));
  const parameters = new URLSearchParams({ bbox: `${lng - .008},${lat - .006},${lng + .008},${lat + .006}`, marker: `${lat},${lng}`, layer: 'mapnik' });
  const href = safeHref(card.url) || `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;
  return `<div class="ln-map"><iframe src="https://www.openstreetmap.org/export/embed.html?${escape(parameters.toString())}" title="${escape(card.title || 'Location')}" loading="lazy" referrerpolicy="no-referrer"></iframe><div class="ln-map-label"><strong>${escape(card.title || 'Somewhere good')}</strong>${escape(card.text || `${lat.toFixed(3)}°, ${lng.toFixed(3)}°`)}</div><a class="ln-map-open" ${outbound(href)} aria-label="${escape(`Open ${card.title || 'location'} on a map`)}" style="position:absolute;inset:0"></a></div>`;
}
export function cardStyle(page: ProfilePage, id: string): string {
  const desktop = packCards(page.cards, 4).find(item => item.id === id)!;
  const mobile = packCards(page.cards, 2).find(item => item.id === id)!;
  return `--ln-dc:${desktop.column};--ln-dr:${desktop.row};--ln-dw:${desktop.columns};--ln-dh:${desktop.rows};--ln-mc:${mobile.column};--ln-mr:${mobile.row};--ln-mw:${mobile.columns};--ln-mh:${mobile.rows}`;
}
export function renderPage(page: ProfilePage, media: Record<string, string>): string {
  page = validatePage(page);
  const accent = /^#[\da-f]{6}$/i.test(page.accent) ? page.accent : '#315b4b';
  const avatar = mediaUrl(media[page.avatarId]);
  const cards = page.cards.map(card => `<article class="ln-card${card.kind === 'link' && (media[card.mediaId] || safeImageUrl(card.coverUrl)) ? ' ln-with-cover' : ''}" data-kind="${card.kind}" style="${cardStyle(page, card.id)}"><div class="ln-content">${renderCard(card, media)}</div></article>`).join('');
  return `<main class="linen-page" data-theme="${page.theme}" data-font="${page.font}" style="--ln-accent:${accent}"><header class="ln-header"><div class="ln-avatar">${avatar ? `<img src="${escape(avatar)}" alt="${escape(page.name)}">` : escape((page.name || 'L').slice(0, 1))}</div><h1 class="ln-name">${escape(page.name || 'Your name')}</h1><p class="ln-bio">${escape(page.bio)}</p>${page.location ? `<span class="ln-location">⌖ ${escape(page.location)}</span>` : ''}</header>${page.cards.length ? `<section class="ln-grid" aria-label="Links and projects">${cards}</section>` : '<div class="ln-empty">Your little corner, ready to make your own.</div>'}<footer class="ln-footer"><a href="https://github.com/alvarovillalbaa/linen" rel="noopener noreferrer">Made with <strong>linen</strong> ↗</a><span>A little space for everything you do.</span></footer></main>`;
}
export function renderDocument(page: ProfilePage, media: Record<string, string>, options: { canonicalUrl?: string; imageUrl?: string; preview?: boolean } = {}): string {
  page = validatePage(page);
  const title = `${page.name || 'Your page'} · Linen`, description = page.bio.slice(0, 300);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta property="og:type" content="profile"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}">${options.canonicalUrl ? `<link rel="canonical" href="${escape(options.canonicalUrl)}"><meta property="og:url" content="${escape(options.canonicalUrl)}">` : ''}${options.imageUrl ? `<meta property="og:image" content="${escape(options.imageUrl)}"><meta name="twitter:card" content="summary_large_image">` : ''}${options.preview ? '<meta name="robots" content="noindex,nofollow,noarchive">' : '<meta name="robots" content="index,follow">'}<style>html,body{margin:0;min-height:100%;background:#fafbf7}${PROFILE_CSS}</style></head><body>${options.preview ? '<div class="ln-preview-banner">Private preview · this version is not a public page.</div>' : ''}${renderPage(page, media)}</body></html>`;
}
