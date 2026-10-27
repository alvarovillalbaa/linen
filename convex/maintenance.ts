import { internalMutationGeneric as internalMutation, internalQueryGeneric as internalQuery } from 'convex/server';
import { ConvexError, v } from 'convex/values';

const AGE = 48 * 60 * 60 * 1000;
// Operator-only inventory. Never routed through the relay or browser API.
export const orphans = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) }, returns: v.any(),
  handler: async (ctx, { cursor }) => {
    const batch = await ctx.db.system.query('_storage').paginate({ cursor, numItems: 50 });
    const candidates = [];
    for (const item of batch.page) {
      const linked = await ctx.db.query('media').withIndex('by_storage', q => q.eq('storageId', item._id)).unique();
      if (!linked && item._creationTime < Date.now() - AGE) candidates.push({ id: item._id, size: item.size, createdAt: item._creationTime });
    }
    return { candidates, cursor: batch.continueCursor, done: batch.isDone };
  },
});
export const purgeOrphans = internalMutation({
  args: { ids: v.array(v.id('_storage')), confirm: v.boolean() }, returns: v.any(),
  handler: async (ctx, { ids, confirm }) => {
    if (!confirm || ids.length > 25 || new Set(ids).size !== ids.length) throw new ConvexError({ code: 'invalid_input' });
    let deleted = 0, alreadyMissing = 0;
    for (const id of ids) {
      const linked = await ctx.db.query('media').withIndex('by_storage', q => q.eq('storageId', id)).unique();
      const item = await ctx.db.system.get(id);
      if (linked || (item && item._creationTime >= Date.now() - AGE)) throw new ConvexError({ code: 'conflict' });
      if (item) { await ctx.storage.delete(id); deleted++; } else alreadyMissing++;
    }
    return { deleted, alreadyMissing };
  },
});
