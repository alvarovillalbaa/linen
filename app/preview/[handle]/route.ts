import { getPreviewProfile } from '../../../lib/server/backend';
import { renderDocument } from '../../../lib/render';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export async function GET(request: Request, context: { params: Promise<{ handle: string }> }) {
  const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow, noarchive', 'X-Content-Type-Options': 'nosniff' };
  try {
    const { handle } = await context.params, key = new URL(request.url).searchParams.get('key') || '';
    const snapshot = await getPreviewProfile(handle, key);
    if (!snapshot) return new Response('This preview is unavailable or has been revoked.', { status: 404, headers });
    return new Response(renderDocument(snapshot.page, Object.fromEntries(snapshot.assets.map(asset => [asset.id, asset.url])), { preview: true }), { headers });
  } catch { return new Response('This preview could not load. Please try again later.', { status: 503, headers }); }
}
