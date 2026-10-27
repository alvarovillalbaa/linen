import { api, remoteMedia } from '@/lib/server/backend';
type Context = { params: Promise<{ handle: string; id: string }> };
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: Context) {
  return api(async () => { const { handle, id } = await context.params; return remoteMedia(request, handle, id); });
}
