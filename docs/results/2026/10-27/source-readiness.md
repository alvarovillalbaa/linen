# Linen source readiness

Recorded 27 October 2026. Status: authored source with focused static/frontend proof. The overall product is incomplete: no Linen service is deployed, and browser/backend acceptance has not run. Free capacity remains pending by the owner's explicit choice.

## Implemented source

- React editor with direct text editing, seven card classes, layout/appearance inspector, pointer and keyboard reorder controls, undo/redo, responsive width preview, native dialogs and clear local/cloud/public states.
- Strict versioned page model; separate bounded draft validation and semantic publication rules; safe URLs/fixed supported embed origins; deterministic readable two/four-column placement.
- Linen-only IndexedDB workspace/media stores, truthful failure handling, signature-checked files and versioned validated ZIP backup/import. Replacement is atomic after full validation/confirmation. Public export and page backups omit private owner credentials; a separate recovery file retains them.
- Canonical escaped HTML/card styles shared by editor, public pages and static export. Published profile HTML includes per-profile metadata and a generated PNG sharing-image route. Private previews suppress indexing/referrers/caching.
- Isolated Convex backend and server relay source for idempotent handle claims, hashed separate owner/preview capabilities, revision compare-and-save, private drafts, published snapshots, media reservation/finalization/access proxies, revocation, quotas and confirmed deletion. Exact boundaries and remaining upload/cleanup risks live in [backend readiness](../../../../convex/README.md).

Integration review found and fixed missing import aliases, draft saves incorrectly requiring publish-complete content, a pending occupied handle locking its editor, hidden modal error feedback, recovery-file reads before size validation, misleading successful attachment after validation failure, and media cleanup failing to protect an older durable draft after autosave failure. These are source-reviewed fixes; no interactive or backend execution proof is claimed.

## Checks completed

| Check | Result and scope |
| --- | --- |
| Authored frontend fixtures on Node v24.21.0 | 44 passed, zero failures: 16 model, 20 media/archive/local-unavailable and 8 rendering tests. No network, browser or database. |
| Model coverage | Unknown/accessor/prototype fields, malformed identities/arrays, UTF-8 limits, international text, incomplete drafts, publish requirements, URL/embed handling, asset identity and responsive layout order/non-overlap. |
| Archive/media coverage | Six file signatures and byte limits; exact ID/byte preservation; credential omission; ZIP CRC/path/header/count/size/reference validation; unsupported ZIP rejection; escaped portable website output. Header fixtures do not prove image decoding/video playback. |
| Renderer coverage | Text/attribute injection, unsafe URL schemes, packaged cover precedence, supported/unsupported embed behavior, profile metadata, preview indexing flags, source/placement order, missing/video output. |
| Exact-file static parsing/import checks | TypeScript 5.9.3: 33 TS/TSX files, 56 local import targets, two script paths, seven Markdown documents, 31 local links and four anchors; zero errors. No semantic typecheck or backend imports/execution. A separate 5.8.3 parser read also passed. |
| Stylesheet parsing | PostCSS: 206 rules and 759 declarations; CSSTree: zero diagnostics. Exact Node v24.21.0; no visual/browser proof. |
| Dependency metadata | npm registry returned all nine pinned versions, including Next 16.4.2, React/React DOM 19.3.1, Convex 1.48.0, TypeScript 5.9.3 and type packages. Next/React DOM peer ranges include the selected React version. One Next metadata read had ECONNRESET; a subsequent read succeeded. No packages were installed. |
| Secret/local-path source scan | No credential or local-only workspace path found. A `file:///private/example` string belongs to an authored rejection fixture. |

The focused frontend command is `node --test tests/unit/*.test.mjs` using Node v24.21.0. The static command is `node scripts/check.mjs --typescript <existing-parser>`; it parses source and resolves local references without running the imported backend/application. The checker's own Node syntax check passed. Initial staged whitespace validation found one extra EOF blank line in the protocol helper; it was removed before the final `git diff --cached --check`.

## Source publication

The original personal-project goal authorizes a separate personal GitHub repository. An authenticated read identified `alvarovillalbaa`; `repos/alvarovillalbaa/linen` returned 404 before creation. Publication receipt will identify the actual source commit and remote readback. Local files or a planned repository URL alone do not prove publication. No Vercel project, integration, deployment, Convex account/project or environment setting was created by this source release.

## Gates retained

- Latest storage preflight: **27.7 GiB free; 34.0 GiB required**, exit 2. Earlier implementation preflight measured 26.3/34.0 GiB. No dependency installation, application build, broad TypeScript compile, large worktree or test database was attempted. No lockfile exists yet; accepted reproducible dependency/build proof remains required.
- The owner answered **“Leave capacity check pending.”** Do not retry login, assume free team allowance, provision an alternative or enable hosting while it remains pending.
- Publishing remains off by default. Auth/media/quota/cleanup policies are reviewable source, not deployed enforcement. The [backend matrix](../../../../convex/README.md#required-acceptance-before-claiming-readiness) must be exercised only after specific authorization and capacity readiness.
- Linen has no browser/backend-check approval. Do not reuse Trippin, Agent Library or Dearweek approvals. Desktop/mobile editing, IndexedDB persistence, file-picker upload, undo/reorder, recovery, backup replacement, real media decoding/playback, fresh-browser publication and same-link update acceptance remain unverified.
- Stable persistent public profiles and durable media are still required by the [product contract](../../../spec.md). A static ZIP or private preview does not fulfill the hosted product requirement. No paid plan, trial, chargeable upgrade or automatic overage is authorized.

The broader multi-project goal remains active and is not complete.
