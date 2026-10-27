import { api, checkedHandle, json, limitedJson, ownerProof, ownerSnapshot, reserveMedia, rpc } from '@/lib/server/backend';
type Context = { params: Promise<{ handle: string }> };
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: Context) {
  return api(async () => { const name = checkedHandle((await context.params).handle), ownerHash = await ownerProof(request); return json(await reserveMedia(name, ownerHash, await limitedJson(request, 2048))); });
}
export async function PUT(request: Request, context: Context) {
  return api(async () => { const name = checkedHandle((await context.params).handle), ownerHash = await ownerProof(request), body = await limitedJson(request, 2048); return json(ownerSnapshot(await rpc('finalize', { handle: name, ownerHash, id: body.id, storageId: body.storageId }), name)); });
}
export async function DELETE(request: Request, context: Context) {
  return api(async () => { const name = checkedHandle((await context.params).handle), ownerHash = await ownerProof(request), body = await limitedJson(request, 2048); await rpc('removeMedia', { handle: name, ownerHash, id: body.id }); return json({ deleted: true }); });
}
