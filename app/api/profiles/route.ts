import { api, json, limitedJson, ownerProof, ownerSnapshot, rpc } from '@/lib/server/backend';
import { validatePage } from '@/lib/model';
import { ApiError } from '@/lib/server/protocol';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return api(async () => {
    const ownerHash = await ownerProof(request), body = await limitedJson(request);
    let page;
    try { page = validatePage(body.page); } catch { throw new ApiError('invalid_input'); }
    return json(ownerSnapshot(await rpc('claim', { page, ownerHash })));
  });
}
