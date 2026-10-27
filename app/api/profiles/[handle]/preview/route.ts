import { api, checkedHandle, createPreview, json, ownerProof, rpc } from '@/lib/server/backend';
type Context = { params: Promise<{ handle: string }> };
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: Context) {
  return api(async () => json(await createPreview(checkedHandle((await context.params).handle), await ownerProof(request))));
}
export async function DELETE(request: Request, context: Context) {
  return api(async () => { await rpc('revokePreview', { handle: checkedHandle((await context.params).handle), ownerHash: await ownerProof(request) }); return json({ revoked: true }); });
}
