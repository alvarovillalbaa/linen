# Four local production editor journeys

11 November 2026. The owner's later all-work/checks/free temporary-CI approval
applies specifically to Linen through the
[local-editor qualification](local-editor-checks.md). Capacity remains explicitly
pending. No login, provisioning, deployment, provider setting, account, backend
ownership test, model call or paid resource follows from this profile.

Baseline main/native/origin/GitHub is clean
`6c542b9c0f9123bce1244c0a6bd89e05b4252841`:77files/864,195bytes. The
[lock/build](../results/2026/11-11/local-build.md) is closed;44actual frontend
fixture passes stay at their earlier source/run and are not replayed here.
All application inputs and dependency versions remain unchanged. The runtime
export additionally includes the existing `public/favicon.svg`; the earlier
build-only packet did not need to serve that public asset.

## Concrete cases

| Case | Profile | Actual assertions |
| --- | --- | --- |
| L01 |1440×1000 mouse/keyboard | Direct name/biography/note editing with literal angle brackets; profile handle/location/theme/typeface; Note/Link addition, size/undo/redo, keyboard reorder, native pointer reorder/undo, duplicate/delete; real preview link; disabled publishing and Escape/focus return; saved reload retains exact DOM IDs/content/order/style; actual backup agrees with UI. |
| L02 |390×844 Chromium emulated touch/keyboard | Native tap-based profile/card/settings dialogs, real editing and size/undo/redo, Move Earlier reorder, duplicate/delete, preview and disabled publication, modal Escape/focus return; saved reload and backup retain exact IDs/content/order/style; finite nonoverlapping layout without horizontal page overflow. |
| L03 | Desktop | Actual chooser uploads an authored PNG as avatar and image; both decode2×2; actual ZIP downloads preserve IDs/metadata and exact uploaded bytes. Malformed ZIP and malformed image retain the draft; native replacement confirmation cancel preserves edited backup, accept restores exact earlier backup. Reload recovers media/content from IndexedDB. Actual website ZIP opens with decoded media and literal content on a separate real local origin, without author storage or editor controls. |
| L04 | Narrow emulated touch/keyboard | Same actual chooser/media/backup/cancel/restore/reload/static-export workflow through narrow native dialogs and tap controls, with geometry checks after restoration. |

All four contexts are fresh and disposable, with no raw IndexedDB/localStorage
access, direct app/store injection, synthesized DOM events or fulfilled request
responses. Playwright uses native input, FileChooser, confirmation and download
events. Only DOM text/attributes/focus/layout/image-decoding reads use evaluation.
No external embed/metadata URL is loaded; outbound sample links remain unvisited.
The second static server serves only exact members from the actual downloaded
website ZIP, through normal HTTP, never a replacement app or fake backend.

## Runtime and evidence bounds

One public Ubuntu24.04/Node24.22.2 job capped at20minutes. Exact reviewed app
lock and copied test-only Playwright/core1.65.0 graph remain frozen. Private
npm config/cache, explicit ignore-scripts and disabled Next telemetry; no
credential forwarding or HOME repurposing. Fresh `npm ci`/production build are
necessary to create this disposable browser runtime, not a replay of the44
frontend cases. Preserve actual automatic Next declaration/config changes.

Five full source/head/index/native guards protect baseline files and new test
source. Export37explicit app/config/fixture/browser files, including favicon.
Keep original source export, installed tools and browser executable identities
unchanged. The Node browser child starts the real Next production CLI on a
selected loopback port, verifies the listener socket belongs to that spawned
PID, requires real `/api/config`200/`publishing:false`, and records its actual
BUILD_ID. Browser response bodies must complete and match compiled static files,
the real disabled config or actual static-export member bytes. Retain unique
response originals/hashes, real downloads, screenshots, errors, server streams,
declarations and command streams. No response stubbing or app-code producer.

Only the owned app origin's root/static/favicon/config GET/HEAD, own Blob
downloads and the separately owned static-export origin are allowed. Reject
unexpected requests, websockets, page errors or console errors. Explicitly
drain response observers before closing pages/context. Close export listeners
and verify refused connections; stop the actual spawned Next child, record full
stdout/stderr EOF, reap it and verify its port closed. Screenshots retain real
focus/fixed-element offsets; they do not establish pixel-perfect appearance.

`scripts/ci-editor.py` allows750seconds of work, reserves90cleanup/90margin
from the first-step20minute clock,8GiB remote admission/2GiB free reserve and
4GiB owned scratch. It captures bounded complete outer streams with child
PID/start/UID/group fences. Verify zero observed owned processes and source
preservation before deleting only the marked root. Upload original proof before
separate identity/no-openers/absence-checked retirement. Preserve every failure;
do not repeat an invocation on observation timeout. Retire only the owned task
workflow/QA ref after terminal evidence. Boundary/sampled checks do not attest
host-wide processes, vendor caches, continuous peak usage or runner disposal.

Local preflight remains4.3GiBfree/34GiBrequired. No local install/build/server/
browser/database. Tool source gets Node syntax/Python AST checks only locally.
The [inactive workflow](editor-browser-ci.workflow.yml.example) is activated
only by a child commit adding `.github/workflows/linen-editor-browser.yml` on
`qa/linen-local-editor-20261111-editor-1`, substituting the exact checked source.
No workflow belongs in main.

## Proof limits

This is local production Chromium and emulated touch, not hosted, physical
device/Safari/accessibility/long-duration or every card/provider acceptance.
Unbound exports contain no owner credential, so they do not establish cloud
capability isolation. Quota/save failure and concurrency need their own concrete
scope. Stable public profiles, durable cloud media and owner/preview policy
acceptance remain required and blocked on the explicitly pending capacity check.
Static export remains a supplement. Full Linen and portfolio goal stay unfinished.
