# Linen

A little space for everything you do. An open-source profile builder for links, projects, notes, photos, video, music and places.

**Source release; hosting is pending.** Linen has not been deployed or checked in a browser. The owner left the free-capacity check pending. No provider account, service, environment setting or paid plan has been created. Persistent public publishing remains required before this project can be called complete.

The editor starts with your own blank page. Edit text in place, add cards, resize them in the inspector, drag their grips or use the keyboard reorder controls, and preview desktop/mobile layouts. Choose four page themes, two type styles and an accent color. Supported embeds have a working outbound-link fallback.

Local source includes IndexedDB draft/media storage, undo/redo, validated ZIP backup/import and a portable static website export. Imported backups require replacement confirmation and never publish automatically. Page backups omit editing credentials. A separate private recovery file grants control of a cloud page; preserve it and never share it publicly.

The publishing source provides stable `/@handle` pages, separate draft/published revisions, revision conflicts, durable uploads, revocable draft previews, profile metadata and sharing images, unpublish and confirmed deletion. It stays disabled until the operator configures an accepted isolated backend. Static export supplements this service; it does not replace it.

## Source map

| Surface | Owner |
| --- | --- |
| Editor and inspector | [`components/`](components/) |
| Strict draft model, semantic publication rules and responsive placement | [`lib/model.ts`](lib/model.ts), [`lib/types.ts`](lib/types.ts) |
| Local storage, file signatures and portable ZIPs | [`lib/local.ts`](lib/local.ts), [`lib/media.ts`](lib/media.ts), [`lib/archive.ts`](lib/archive.ts) |
| Shared editor/public/export markup | [`lib/render.ts`](lib/render.ts) |
| Browser publishing client | [`lib/client.ts`](lib/client.ts) |
| Next API relay and public pages | [`app/`](app/), [`lib/server/`](lib/server/) |
| Isolated persistence and media ownership | [`convex/`](convex/README.md) |
| Intent, shared contracts and provenance | [`docs/spec.md`](docs/spec.md), [`docs/implementation-contract.md`](docs/implementation-contract.md), [research](docs/research/2026/10-27/source-and-publishing.md) |
| Current evidence and missing acceptance | [Source readiness](docs/results/2026/10-27/source-readiness.md) |

## Development

Use Node 24. Read [`AGENTS.md`](AGENTS.md) and run the workspace's storage preflight before installing dependencies or building. Those steps were not run for this release because the preflight failed. No lockfile has been generated yet; dependency installation and a reproducible accepted build remain release gates.

After sufficient storage and the required approvals:

```sh
npm install
npm run dev
```

The editor and local export paths do not need a provider key. `.env.example` documents the disabled publishing settings. Do not place any owner capability, relay secret or deployment key in a browser-prefixed environment variable.

```sh
npm run check
npm run test:frontend
```

`check` parses exact TypeScript/TSX files and validates local imports/script/document paths; it does not typecheck, execute backend code or build the app. It can use an existing compatible parser with `node scripts/check.mjs --typescript /path/to/typescript` without installing one. The frontend tests use authored model/media/archive/render fixtures and no network or database. File-header tests do not establish image decoding or video playback.

## Publishing and ownership

Capacity and provider eligibility must be verified before provisioning. The source assumes an isolated Convex deployment plus a compatible Next host; an existing Vercel plan or a nominal $0 price is not proof of free capacity or permitted use. See the [publishing comparison](docs/research/2026/10-27/source-and-publishing.md#publishing-options) and [backend readiness](convex/README.md) for the exact pending gates and configuration.

An owner capability is generated and saved locally before claiming a handle. Cloud drafts save independently of public publication. Handle/page identities stay fixed after a successful claim. Losing all copies of the private owner key makes recovery unavailable; there is no email account or password-reset service. A preview key is separate, read-only and revocable. Anyone with a public page, public media or downloaded export may retain a copy; unpublish/deletion controls future service access.

Source limits are 32 cards, 128 KiB page JSON, 8 MiB per image, 32 MiB per video and 64 MiB media per page. JPEG, PNG, WebP, GIF, MP4 and WebM uploads receive signature checks. The backend additionally caps reservations, total reserved storage and lifetime claims/upload links. These bounds do not establish provider capacity or complete abuse protection. Direct uploads and orphan cleanup require the acceptance described in the backend notes before enabling a public service.

Linen is independently authored and MIT licensed. Bento is a product reference; its branding, source and assets are not included. Optional accounts, custom domains, analytics, collaboration and monetization are outside this source release.
