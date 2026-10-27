import { ImageResponse } from 'next/og';
import { getPublicProfile } from '../../../lib/server/backend';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export async function GET(_request: Request, context: { params: Promise<{ handle: string }> }) {
  const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
  try {
    const { handle } = await context.params, snapshot = await getPublicProfile(handle);
    if (!snapshot) return new Response('Not found', { status: 404, headers });
    const page = snapshot.page, night = page.theme === 'night';
    return new ImageResponse(<div style={{ display: 'flex', width: '100%', height: '100%', background: night ? '#182b25' : '#f4f5ec', color: night ? '#f0f5e9' : '#253b34', padding: 70, flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'sans-serif' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ display: 'flex', fontSize: 26, opacity: .65 }}>@{page.handle}</div><div style={{ display: 'flex', fontSize: 30 }}>linen •</div></div><div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}><div style={{ display: 'flex', fontSize: 74, fontWeight: 700, letterSpacing: -3 }}>{page.name.slice(0, 80)}</div><div style={{ display: 'flex', fontSize: 28, opacity: .7, maxWidth: 920 }}>{page.bio.slice(0, 190)}</div></div><div style={{ display: 'flex', gap: 16 }}>{page.cards.filter(card => card.kind !== 'section').slice(0, 4).map((card, index) => <div key={card.id} style={{ display: 'flex', alignItems: 'flex-end', width: 225, height: 100, padding: 18, borderRadius: 18, background: night ? '#29483a' : '#ffffff', fontSize: 17 }}>{card.title.slice(0, 36) || ['Links', 'Projects', 'Ideas', 'A little more'][index]}</div>)}</div></div>, { width: 1200, height: 630, headers });
  } catch { return new Response('Image unavailable', { status: 503, headers }); }
}
