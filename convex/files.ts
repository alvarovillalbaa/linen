'use node';

import { anyApi, internalActionGeneric as internalAction } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { inspectMedia } from '../lib/media';
import { digest } from '../lib/server/protocol';

export const finalize = internalAction({
  args: { handle: v.string(), ownerHash: v.string(), id: v.string(), storageId: v.string() }, returns: v.any(),
  handler: async (ctx, data): Promise<any> => {
    const bound = await ctx.runMutation(anyApi.operations.change, { op: 'bind', data });
    if (bound.ready) return ctx.runQuery(anyApi.operations.read, { op: 'owner', data });
    try {
      const item = await ctx.runQuery(anyApi.operations.read, { op: 'verification', data });
      if (!item.metadata || item.metadata.size !== item.size || item.metadata.sha256 !== item.sha256
        || item.metadata.contentType?.split(';')[0].trim().toLowerCase() !== item.type) throw new ConvexError({ code: 'invalid_input' });
      const blob = await ctx.storage.get(item.storageId);
      if (!blob) throw new ConvexError({ code: 'not_found' });
      try { await inspectMedia(blob, item.type, item.size); } catch { throw new ConvexError({ code: 'invalid_input' }); }
      if (await digest(await blob.arrayBuffer()) !== item.sha256) throw new ConvexError({ code: 'invalid_input' });
      return await ctx.runMutation(anyApi.operations.change, { op: 'complete', data });
    } catch (error) {
      // Only the mutation's proven reservation binding permits cleanup.
      try { await ctx.runMutation(anyApi.operations.change, { op: 'discard', data }); } catch { /* Retained binding remains available to owner/operator cleanup. */ }
      throw error;
    }
  },
});
