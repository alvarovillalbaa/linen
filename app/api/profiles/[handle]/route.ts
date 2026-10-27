import { api, checkedHandle, json, limitedJson, ownerProof, ownerSnapshot, rpc } from '@/lib/server/backend';
type Context = { params: Promise<{ handle: string }> };
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: Context) {
  return api(async () => { const name = checkedHandle((await context.params).handle); return json(ownerSnapshot(await rpc('owner', { handle: name, ownerHash: await ownerProof(request) }), name)); });
}
export async function PUT(request: Request, context: Context) {
  return api(async () => { const name = checkedHandle((await context.params).handle), ownerHash = await ownerProof(request), body = await limitedJson(request); return json(ownerSnapshot(await rpc('save', { page: body.page, revision: body.revision, handle: name, ownerHash }), name)); });
}
export async function DELETE(request: Request, context: Context) {
  return api(async () => { const name = checkedHandle((await context.params).handle), ownerHash = await ownerProof(request), body = await limitedJson(request); await rpc('delete', { handle: name, ownerHash, confirm: body.confirm }); return json({ deleted: true }); });
}
