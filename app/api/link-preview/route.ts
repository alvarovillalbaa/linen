import { api, json } from '@/lib/server/backend';
import { linkPreview } from '@/lib/server/link-preview';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return api(async () => json(await linkPreview(new URL(request.url).searchParams.get('url') ?? '')));
}
