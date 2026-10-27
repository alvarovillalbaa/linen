import { internalMutationGeneric as internalMutation, internalQueryGeneric as internalQuery, type GenericMutationCtx, type GenericQueryCtx, type GenericDataModel } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { assetIds, LIMITS, publicationIssues, validatePage } from '../lib/model';
import { handle as validHandle, hash, pageRecord, uuid, type ErrorCode } from '../lib/server/protocol';
import type { ProfilePage } from '../lib/types';

type QueryCtx = GenericQueryCtx<GenericDataModel>;
type MutationCtx = GenericMutationCtx<GenericDataModel>;
type Row = Record<string, any>;
const CAPS = { claims: 100, media: 64, bytes: 256 * 1024 * 1024, uploads: 1024 } as const;
const HOUR = 60 * 60 * 1000;
const fail = (code: ErrorCode): never => { throw new ConvexError({ code }); };
function page(value: unknown): ProfilePage { try { return pageRecord(validatePage(value)); } catch { return fail('invalid_input'); } }
function proof(value: unknown): string { if (!hash(value)) fail('unauthorized'); return value; }
async function profile(ctx: QueryCtx | MutationCtx, name: unknown): Promise<Row | null> {
  if (!validHandle(name)) fail('invalid_input');
  return ctx.db.query('profiles').withIndex('by_handle', q => q.eq('handle', name)).unique();
}
function own(row: Row | null, owner: unknown, allowDeleting = false): Row {
  if (!row || row.ownerHash !== proof(owner)) fail('unauthorized');
  if (row.state === 'deleted') fail('not_found');
  if (row.state !== 'active' && !allowDeleting) fail('profile_deleting');
  return row;
}
async function media(ctx: QueryCtx | MutationCtx, row: Row): Promise<Row[]> {
  return ctx.db.query('media').withIndex('by_profile', q => q.eq('profileId', row._id)).take(CAPS.media + 1);
}
async function asset(ctx: QueryCtx | MutationCtx, row: Row, id: unknown): Promise<Row | null> {
  if (!uuid(id)) fail('invalid_input');
  return ctx.db.query('media').withIndex('by_client', q => q.eq('profileId', row._id).eq('clientId', id)).unique();
}
function manifest(rows: Row[], refs?: Set<string>) {
  return rows.filter(row => row.state === 'ready' && (!refs || refs.has(row.clientId))).map(row => ({ id: row.clientId, name: row.name, type: row.type, size: row.size }));
}
async function snapshot(ctx: QueryCtx | MutationCtx, row: Row) {
  return { page: row.draft, revision: row.revision, publishedRevision: row.publishedRevision, assets: manifest(await media(ctx, row)) };
}
async function budget(ctx: MutationCtx): Promise<Row> {
  const row = await ctx.db.query('budget').withIndex('by_key', q => q.eq('key', 'global')).unique();
  if (row) return row;
  const id = await ctx.db.insert('budget', { key: 'global', claims: 0, bytes: 0, uploads: 0 });
  return (await ctx.db.get(id))!;
}
function revision(value: unknown, current: number) { if (!Number.isSafeInteger(value) || value !== current) fail('conflict'); }
function activeMediaRefs(row: Row) { return new Set([...(row.draft ? assetIds(row.draft) : []), ...(row.published ? assetIds(row.published) : [])]); }

export const read = internalQuery({
  args: { op: v.string(), data: v.any() }, returns: v.any(),
  handler: async (ctx, { op, data }) => {
    const row = await profile(ctx, data.handle);
    if (op === 'owner') return snapshot(ctx, own(row, data.ownerHash));
    if (op === 'public' || op === 'preview') {
      const target = op === 'public' ? row?.published : row?.draft;
      if (!row || row.state !== 'active' || !target || (op === 'preview' && (!hash(data.previewHash) || row.previewHash !== data.previewHash))) return null;
      return { page: target, revision: op === 'public' ? row.publishedRevision : row.revision, assets: manifest(await media(ctx, row), new Set(assetIds(target))) };
    }
    if (op === 'media') {
      if (!row || row.state !== 'active') fail('not_found');
      const item = await asset(ctx, row, data.id);
      if (!item || item.state !== 'ready' || !item.storageId) fail('not_found');
      const owner = hash(data.ownerHash) && row.ownerHash === data.ownerHash;
      const preview = hash(data.previewHash) && row.previewHash === data.previewHash && assetIds(row.draft).includes(item.clientId);
      const published = row.published && assetIds(row.published).includes(item.clientId);
      if (!owner && !preview && !published) fail('not_found');
      return { storageId: item.storageId, type: item.type, size: item.size, name: item.name };
    }
    if (op === 'verification') {
      const owned = own(row, data.ownerHash);
      const item = await asset(ctx, owned, data.id);
      if (!item || item.storageId !== data.storageId) fail('not_found');
      return { ...item, metadata: await ctx.db.system.get(item.storageId) };
    }
    if (op === 'resume') {
      const item = await asset(ctx, own(row, data.ownerHash), data.id);
      if (item && (item.sha256 !== data.sha256 || item.size !== data.size || item.type !== data.type)) fail('asset_id_conflict');
      return item?.state === 'verifying' && item.storageId ? { storageId: item.storageId } : null;
    }
    fail('invalid_input');
  },
});

export const change = internalMutation({
  args: { op: v.string(), data: v.any() }, returns: v.any(),
  handler: async (ctx, { op, data }) => {
    if (op === 'claim') {
      const incoming = page(data.page), ownerHash = proof(data.ownerHash);
      if (!validHandle(incoming.handle) || !uuid(incoming.id)) fail('invalid_input');
      const existing = await ctx.db.query('profiles').withIndex('by_page', q => q.eq('pageId', incoming.id)).unique();
      if (existing) return snapshot(ctx, own(existing, ownerHash));
      if (await profile(ctx, incoming.handle)) fail('handle_taken');
      const allowance = await budget(ctx); if (allowance.claims >= CAPS.claims) fail('quota');
      const now = Date.now();
      const id = await ctx.db.insert('profiles', { pageId: incoming.id, handle: incoming.handle, ownerHash, state: 'active', draft: incoming, revision: 1, publishedRevision: null, createdAt: now, updatedAt: now });
      await ctx.db.patch(allowance._id, { claims: allowance.claims + 1 });
      return snapshot(ctx, (await ctx.db.get(id))!);
    }
    const found = await profile(ctx, data.handle);
    if (!found && op === 'beginDelete' && data.confirm === true) { proof(data.ownerHash); return { absent: true }; }
    const row = own(found, data.ownerHash, ['beginDelete', 'finishDelete', 'discard'].includes(op));
    if (op === 'save') {
      revision(data.revision, row.revision);
      const incoming = page(data.page);
      if (incoming.id !== row.pageId || incoming.handle !== row.handle) fail('immutable_profile');
      await ctx.db.patch(row._id, { draft: incoming, revision: row.revision + 1, updatedAt: Date.now() });
    } else if (op === 'publish') {
      revision(data.revision, row.revision);
      const ready = (await media(ctx, row)).filter(item => item.state === 'ready');
      if (publicationIssues(row.draft, ready.map(item => item.clientId)).length) fail('publication_invalid');
      const types = new Map(ready.map(item => [item.clientId, item.type]));
      if (row.draft.avatarId && !types.get(row.draft.avatarId)?.startsWith('image/')) fail('publication_invalid');
      for (const card of row.draft.cards as ProfilePage['cards']) {
        if (card.mediaId && !types.get(card.mediaId)?.startsWith(card.kind === 'video' ? 'video/' : 'image/')) fail('publication_invalid');
      }
      await ctx.db.patch(row._id, { published: row.draft, publishedRevision: row.revision, updatedAt: Date.now() });
    } else if (op === 'unpublish') {
      await ctx.db.patch(row._id, { published: undefined, publishedRevision: null, updatedAt: Date.now() });
    } else if (op === 'preview' || op === 'revokePreview') {
      if (op === 'preview' && !hash(data.previewHash)) fail('invalid_input');
      await ctx.db.patch(row._id, { previewHash: op === 'preview' ? data.previewHash : undefined, updatedAt: Date.now() });
      return { ok: true };
    } else if (op === 'beginDelete') {
      if (data.confirm !== true) fail('invalid_input');
      await ctx.db.patch(row._id, { state: 'deleting', published: undefined, publishedRevision: null, previewHash: undefined, updatedAt: Date.now() });
      return { ok: true };
    } else if (op === 'finishDelete') {
      if (row.state !== 'deleting' || data.confirm !== true) fail('invalid_input');
      const items = await media(ctx, row), allowance = await budget(ctx);
      for (const item of items) {
        if (item.storageId && await ctx.db.system.get(item.storageId)) await ctx.storage.delete(item.storageId);
        await ctx.db.delete(item._id);
      }
      await ctx.db.patch(allowance._id, { bytes: Math.max(0, allowance.bytes - items.reduce((sum, item) => sum + item.size, 0)) });
      // The minimal tombstone prevents an old claim retry from resurrecting a deleted page.
      await ctx.db.patch(row._id, { state: 'deleted', handle: '', draft: undefined, published: undefined, previewHash: undefined, updatedAt: Date.now() });
      return { deleted: true };
    } else if (op === 'reserve') {
      if (!uuid(data.id) || !hash(data.sha256) || typeof data.name !== 'string' || !data.name.trim() || data.name.length > 255 || ['.', '..'].includes(data.name) || /[\x00-\x1f\x7f/\\]/.test(data.name)) fail('invalid_input');
      const video = ['video/mp4', 'video/webm'].includes(data.type), image = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(data.type);
      if ((!video && !image) || !Number.isSafeInteger(data.size) || data.size < 1) fail('invalid_input');
      if (data.size > (video ? LIMITS.videoBytes : LIMITS.imageBytes)) fail('too_large');
      const existing = await asset(ctx, row, data.id), allowance = await budget(ctx);
      if (existing && (existing.sha256 !== data.sha256 || existing.size !== data.size || existing.type !== data.type)) fail('asset_id_conflict');
      if (existing?.state === 'ready') return { uploaded: true };
      if (existing?.uploadUrl && existing.expiresAt > Date.now()) return { uploadUrl: existing.uploadUrl };
      const items = await media(ctx, row);
      if (!existing && (items.length >= CAPS.media || items.reduce((sum, item) => sum + item.size, 0) + data.size > LIMITS.mediaBytes || allowance.bytes + data.size > CAPS.bytes)) fail('quota');
      if (allowance.uploads >= CAPS.uploads) fail('quota');
      const uploadUrl = await ctx.storage.generateUploadUrl();
      if (existing) await ctx.db.patch(existing._id, { uploadUrl, expiresAt: Date.now() + HOUR });
      else await ctx.db.insert('media', { profileId: row._id, clientId: data.id, name: data.name, type: data.type, size: data.size, sha256: data.sha256, state: 'pending', uploadUrl, expiresAt: Date.now() + HOUR, createdAt: Date.now() });
      await ctx.db.patch(allowance._id, { bytes: allowance.bytes + (existing ? 0 : data.size), uploads: allowance.uploads + 1 });
      await ctx.db.patch(row._id, { updatedAt: Date.now() });
      return { uploadUrl };
    } else if (op === 'bind') {
      const item = await asset(ctx, row, data.id);
      if (!item) fail('not_found');
      if (item.storageId && item.storageId !== data.storageId) fail('asset_id_conflict');
      if (item.state === 'ready') return { ready: true };
      const storageId = ctx.db.normalizeId('_storage', data.storageId);
      if (!storageId) fail('invalid_input');
      const other = await ctx.db.query('media').withIndex('by_storage', q => q.eq('storageId', storageId)).unique();
      if (other && other._id !== item._id) fail('unauthorized');
      const metadata = await ctx.db.system.get(storageId);
      if (!metadata || metadata._creationTime < item.createdAt) fail('invalid_input');
      await ctx.db.patch(item._id, { storageId, state: 'verifying' });
      await ctx.db.patch(row._id, { updatedAt: Date.now() });
      return { ready: false };
    } else if (op === 'complete') {
      const item = await asset(ctx, row, data.id);
      if (!item || item.storageId !== data.storageId || !['verifying', 'ready'].includes(item.state)) fail('not_found');
      const metadata = await ctx.db.system.get(item.storageId);
      if (!metadata || metadata.size !== item.size || metadata.sha256 !== item.sha256 || metadata.contentType?.split(';')[0].trim().toLowerCase() !== item.type) fail('invalid_input');
      await ctx.db.patch(item._id, { state: 'ready', uploadUrl: undefined });
      await ctx.db.patch(row._id, { updatedAt: Date.now() });
    } else if (op === 'discard') {
      const item = await asset(ctx, row, data.id);
      if (!item || item.state === 'ready' || item.storageId !== data.storageId) return { ok: true };
      if (await ctx.db.system.get(item.storageId)) await ctx.storage.delete(item.storageId);
      await ctx.db.patch(item._id, { state: 'pending', storageId: undefined, uploadUrl: undefined, expiresAt: 0 });
      return { ok: true };
    } else if (op === 'removeMedia') {
      const item = await asset(ctx, row, data.id);
      if (!item) return { deleted: true };
      if (activeMediaRefs(row).has(item.clientId)) fail('media_referenced');
      if (item.storageId && await ctx.db.system.get(item.storageId)) await ctx.storage.delete(item.storageId);
      const allowance = await budget(ctx);
      await ctx.db.patch(allowance._id, { bytes: Math.max(0, allowance.bytes - item.size) });
      await ctx.db.delete(item._id);
      await ctx.db.patch(row._id, { updatedAt: Date.now() });
      return { deleted: true };
    } else fail('invalid_input');
    return snapshot(ctx, (await ctx.db.get(row._id))!);
  },
});
