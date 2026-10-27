import { api, checkedHandle, json, limitedJson, ownerProof, ownerSnapshot, rpc } from '@/lib/server/backend';
type Context = { params: Promise<{ handle: string }> };
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: Context) {
  return api(async () => { const name = checkedHandle((await context.params).handle), ownerHash = await ownerProof(request), body = await limitedJson(request); return json(ownerSnapshot(await rpc('publish', { handle: name, ownerHash, revision: body.revision }), name)); });
}
export async function DELETE(request: Request, context: Context) {
  return api(async () => { const name = checkedHandle((await context.params).handle); return json(ownerSnapshot(await rpc('unpublish', { handle: name, ownerHash: await ownerProof(request) }), name)); });
}
