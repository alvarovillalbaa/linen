# Implementation contract

Last updated: 2026-10-27.

Next.js/React provides the editor, public HTML and PNG sharing images. An isolated Convex implementation owns durable profiles/media. Provisioning remains pending: no service, credential, migration, CI or production auth configuration may be enabled by this source work. The existing personal-project goal authorizes a dedicated GitHub source repository. Local installs/builds remain stopped after Storage Guard's 26.3/34.0 GiB preflight failure.

`lib/types.ts` is the shared transport/type owner. Do not change its fields without coordinating with the integration owner. Draft strings may be incomplete; structural validation preserves bounded drafts, and publication applies stricter semantic validation. Rendering always treats text as text and uses safe URL helpers.

## Frontend model

`lib/model.ts` exports `blankPage()`, `createCard(kind)`, `validatePage(unknown)`, `publicationIssues(page, mediaIds?)`, `assetIds(page)`, `packCards(cards, columns)`, `moveCard(page,id,toIndex)`, `resizeCard(page,id,size)`, `safeHref(url)`, `safeImageUrl(url)`, `embedFor(url)`, and `normalizeHandle(value)`.

`packCards` returns one-based CSS placements with no overlaps, bounded row count and spans clamped to 2/4-column widths. Source/card order remains the editing and keyboard order. Sizes are small 1×1, wide 2×1, tall 1×2 and large 2×2. Page themes are paper/oat/night/rose, fonts sans/serif. IDs are client UUIDs; a profile handle is lower-case 3–30 letters/digits/hyphens and immutable after claiming. Maximum 32 cards, 128 KiB page JSON; 8 MiB per image, 32 MiB per video, 64 MiB media per page. Supported uploads: JPEG, PNG, WebP, GIF, MP4 and WebM, with file-signature checks rather than MIME trust alone.

## Local storage and portability

`lib/local.ts` exports `loadWorkspace():Promise<Workspace|null>`, `saveWorkspace(workspace):Promise<void>`, `putMedia(file:File):Promise<MediaFile>`, `getMedia(id):Promise<MediaFile|null>`, `listMedia():Promise<MediaFile[]>`, `deleteMedia(id):Promise<void>` and `removeWorkspace():Promise<void>`. Use IndexedDB transactions; never clear unrelated stores. Failures must reject rather than masquerade as a saved state. Media IDs survive export/import. `putMedia` validates signatures/types/limits before writing. Keep owner credentials in the private workspace only.

`replaceWorkspace(workspace,media):Promise<void>` commits a fully validated archive and its original media IDs atomically, after the UI confirms replacement. `lib/media.ts` owns shared file-signature validation for local insertion/archive import. `lib/model.ts` also exports frozen `LIMITS` with `cards`, `pageBytes`, `imageBytes`, `videoBytes`, and `mediaBytes` fields matching the limits above.

`lib/archive.ts` exports `exportBackup(page,media):Promise<Blob>`, `importBackup(blob):Promise<{page:ProfilePage,media:MediaFile[]}>`, and `exportSite(page,media):Promise<Blob>`. Versioned ZIPs contain JSON/media, never editing credentials or executable imported HTML. Validate paths, counts, sizes, CRCs and all manifest references before the caller commits a replacement. Site export uses the canonical `renderDocument` and packaged media paths. ZIP storage without compression is sufficient for already-compressed media; malformed/unsupported archives fail explicitly.

## Canonical public rendering

Root owns `lib/render.ts`: `PROFILE_CSS`, `renderCard(card, mediaUrls)`, and `renderDocument(page, mediaUrls, {canonicalUrl?,imageUrl?})`. Text/attributes/URLs are escaped and validated. The same card markup/styles support the editor, public page and portable export; editor controls stay outside public markup. Media maps resolve client IDs to local Blob URLs, public proxy paths or exported package paths. Public HTML includes page-specific metadata. Next's image route creates a PNG sharing image from published data.

## Backend and API

Backend source uses authenticated Convex HTTP actions as a server-to-service boundary. Internal query/mutation functions are not public client APIs. A server-only relay secret authenticates Next to Convex; owner and preview capabilities are separate, hashed before persistence, and never appear in public payloads. No `storage.getUrl` or raw storage IDs may be exposed to visitors: media is streamed through an access-checked proxy so unpublish/preview revocation affects future service access.

Next API surface:

- `GET /api/config` → `{publishing:boolean}`; true only after explicit readiness configuration and valid server bindings.
- `POST /api/profiles` with `{page}` and `Authorization: Bearer <client-generated 32-byte base64url ownerKey>` → `OwnerSnapshot`. Client page ID is the idempotency key; retry with the same key returns the same owned profile. Claims reserve the requested handle atomically.
- `GET /api/profiles/[handle]` owner bearer → `OwnerSnapshot`.
- `PUT /api/profiles/[handle]` owner bearer, `{page,revision}` → `OwnerSnapshot`. Reject stale revision with HTTP 409 and preserve client edits.
- `POST /api/profiles/[handle]/publish` owner bearer, `{revision}` → `OwnerSnapshot`.
- `DELETE /api/profiles/[handle]/publish` owner bearer → `OwnerSnapshot` (unpublish).
- `DELETE /api/profiles/[handle]` owner bearer and `{confirm:true}` → `{deleted:true}`.
- `POST /api/profiles/[handle]/preview` owner bearer → `{url:string}`; `DELETE` revokes preview.
- `POST /api/profiles/[handle]/media` owner bearer, `{id,name,type,size,sha256}` → `{uploadUrl?:string,uploaded?:boolean}`. The lowercase SHA-256 identifies the actual local Blob. An already completed matching ID/hash returns `uploaded:true`; changed content under that ID conflicts. The browser uploads only to the returned validated Convex upload origin, then `PUT` to the same route with `{id,storageId}` finalizes metadata after actual size/type/signature/hash checks. `DELETE` with `{id}` removes only unreferenced owned media. Failed reservations/orphans have a documented operator cleanup path in [the backend notes](../convex/README.md#source-quotas-and-cleanup).
- `GET /api/media/[handle]/[id]` serves only an asset referenced by the published revision, or uses owner bearer / `?preview=` for an authorized draft. No cached stale access after unpublish; support video Range where upstream permits.
- `GET /api/link-preview?url=` offers bounded metadata from fixed official GitHub/YouTube/Vimeo/Spotify endpoints only; all other URLs retain manual title/cover/link fallback. No arbitrary-URL server fetch.

Errors: `{error:{code:string,message:string}}`; 503 means publishing unavailable; 409 conflict; 404 absent/revoked; 401 ownership failure; 400 invalid input; 413 oversized input; 429 configured quota. Do not echo upstream bodies, private keys or deployment configuration.

Backend owner also implements server helpers `getPublicProfile(handle):Promise<PublicSnapshot|null>`, `getPreviewProfile(handle,key):Promise<PublicSnapshot|null>` and `publishingConfigured():boolean`. Root owns `/@handle` rendering and preview/OG pages. Handles use `/@name`; dynamic server routes reject other forms. Environment/configuration and ownership/quota policies remain reviewable source until approved deployment and targeted backend/browser acceptance.

## Verification boundaries

Allowed now: exact-file syntax/import checks, meaningful pure frontend model/archive tests using authored T2 data under `tests/unit/`, source review and whitespace checks. Backend tests, browser checks, local app builds, installed dependencies, service provisioning and live ownership/media/delete actions have no new approval for Linen. Do not reuse Trippin, Agent Library or Dearweek approvals. Persist bounded evidence in `docs/results/` and keep source, hosted behavior and runtime acceptance separate.
