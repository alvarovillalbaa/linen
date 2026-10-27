import { getPublicProfile } from '../../lib/server/backend';
import { renderDocument } from '../../lib/render';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' https: data:; media-src 'self' https:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://open.spotify.com https://w.soundcloud.com https://www.openstreetmap.org; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" };
export async function GET(request: Request, context: { params: Promise<{ profile: string }> }) {
  const { profile } = await context.params;
  if (!profile.startsWith('@')) return new Response('Page not found.', { status: 404, headers });
  try {
    const snapshot = await getPublicProfile(profile.slice(1));
    if (!snapshot) return new Response('<!doctype html><title>Page not found · Linen</title><p>This page is not published.</p><a href="/">Make your own page</a>', { status: 404, headers });
    const origin = new URL(request.url).origin;
    return new Response(renderDocument(snapshot.page, Object.fromEntries(snapshot.assets.map(asset => [asset.id, asset.url])), { canonicalUrl: `${origin}/@${snapshot.page.handle}`, imageUrl: `${origin}/og/${snapshot.page.handle}` }), { headers });
  } catch { return new Response('This page could not load. Please try again later.', { status: 503, headers }); }
}
