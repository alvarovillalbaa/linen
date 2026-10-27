import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  profiles: defineTable({
    pageId: v.string(), handle: v.string(), ownerHash: v.string(),
    state: v.union(v.literal('active'), v.literal('deleting'), v.literal('deleted')),
    draft: v.optional(v.any()), published: v.optional(v.any()), revision: v.number(),
    publishedRevision: v.union(v.number(), v.null()), previewHash: v.optional(v.string()),
    createdAt: v.number(), updatedAt: v.number(),
  }).index('by_page', ['pageId']).index('by_handle', ['handle']),
  media: defineTable({
    profileId: v.id('profiles'), clientId: v.string(), name: v.string(), type: v.string(), size: v.number(), sha256: v.string(),
    state: v.union(v.literal('pending'), v.literal('verifying'), v.literal('ready')),
    storageId: v.optional(v.id('_storage')), uploadUrl: v.optional(v.string()),
    expiresAt: v.number(), createdAt: v.number(),
  }).index('by_profile', ['profileId']).index('by_client', ['profileId', 'clientId']).index('by_storage', ['storageId']),
  budget: defineTable({ key: v.string(), claims: v.number(), bytes: v.number(), uploads: v.number() }).index('by_key', ['key']),
});
