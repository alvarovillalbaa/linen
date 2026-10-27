import { anyApi, httpActionGeneric as httpAction, httpRouter } from 'convex/server';
import { ApiError, capability, digest, errorResponse, limitedJson, noStore, uuid } from '../lib/server/protocol';

async function relay(request: Request) {
  const expected = process.env.LINEN_RELAY_SECRET;
  if (process.env.LINEN_PUBLISHING_ENABLED !== 'true' || !capability(expected)) throw new ApiError('unavailable');
  const supplied = request.headers.get('authorization')?.match(/^Bearer ([\w-]{43})$/)?.[1] ?? '';
  if (!capability(supplied)) throw new ApiError('unauthorized');
  const a = await digest(expected), b = await digest(supplied); let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  if (difference) throw new ApiError('unauthorized');
}
const rpc = httpAction(async (ctx, request) => {
  try {
    await relay(request);
    const body = await limitedJson(request), op = body.op;
    if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) throw new ApiError('invalid_input');
    const data = body.data as Record<string, unknown>;
    let result;
    if (['owner', 'public', 'preview'].includes(String(op))) result = await ctx.runQuery(anyApi.operations.read, { op, data });
    else if (op === 'finalize') {
      if (!uuid(data.id) || typeof data.storageId !== 'string' || !data.storageId || data.storageId.length > 512) throw new ApiError('invalid_input');
      result = await ctx.runAction(anyApi.files.finalize, { handle: data.handle, ownerHash: data.ownerHash, id: data.id, storageId: data.storageId });
    }
    else if (op === 'delete') {
      const started = await ctx.runMutation(anyApi.operations.change, { op: 'beginDelete', data });
      result = started.absent ? { deleted: true } : await ctx.runMutation(anyApi.operations.change, { op: 'finishDelete', data });
    } else if (op === 'reserve') {
      const pending = await ctx.runQuery(anyApi.operations.read, { op: 'resume', data });
      if (pending) {
        await ctx.runAction(anyApi.files.finalize, { handle: data.handle, ownerHash: data.ownerHash, id: data.id, storageId: pending.storageId });
        result = { uploaded: true };
      } else result = await ctx.runMutation(anyApi.operations.change, { op, data });
    } else if (['claim', 'save', 'publish', 'unpublish', 'previewToken', 'revokePreview', 'removeMedia'].includes(String(op))) {
      result = await ctx.runMutation(anyApi.operations.change, { op: op === 'previewToken' ? 'preview' : op, data });
    } else throw new ApiError('invalid_input');
    return Response.json(result, { headers: noStore });
  } catch (error) { return errorResponse(error); }
});

function range(value: string | null, size: number) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return false;
  let start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] ? (match[2] ? Math.min(size - 1, Number(match[2])) : size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start || (!match[1] && Number(match[2]) < 1)) return false;
  return { start, end };
}
const serve = httpAction(async (ctx, request) => {
  try {
    await relay(request);
    const url = new URL(request.url), data = { handle: url.searchParams.get('handle'), id: url.searchParams.get('id'), ownerHash: request.headers.get('x-linen-owner') ?? '', previewHash: request.headers.get('x-linen-preview') ?? '' };
    const item = await ctx.runQuery(anyApi.operations.read, { op: 'media', data });
    const blob = await ctx.storage.get(item.storageId);
    if (!blob || blob.size !== item.size) throw new ApiError('not_found');
    // Recheck after storage I/O: revocation/deletion must govern this read too.
    const current = await ctx.runQuery(anyApi.operations.read, { op: 'media', data });
    if (current.storageId !== item.storageId) throw new ApiError('not_found');
    const part = range(request.headers.get('range'), blob.size);
    const filename = encodeURIComponent(item.name).replace(/['()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    const headers = new Headers({ ...noStore, 'Content-Type': item.type, 'Accept-Ranges': 'bytes', 'Content-Disposition': `inline; filename*=UTF-8''${filename}` });
    if (part === false) { headers.set('Content-Range', `bytes */${blob.size}`); return new Response(null, { status: 416, headers }); }
    if (part) {
      headers.set('Content-Range', `bytes ${part.start}-${part.end}/${blob.size}`); headers.set('Content-Length', String(part.end - part.start + 1));
      return new Response(blob.slice(part.start, part.end + 1, item.type), { status: 206, headers });
    }
    headers.set('Content-Length', String(blob.size));
    return new Response(blob, { headers });
  } catch (error) { return errorResponse(error); }
});
const http = httpRouter();
http.route({ path: '/linen/rpc', method: 'POST', handler: rpc });
http.route({ path: '/linen/media', method: 'GET', handler: serve });
export default http;
