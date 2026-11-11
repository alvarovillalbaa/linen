# Preserve a newer local draft across tabs

11 November 2026. Source candidate based on clean main
`6277e1e56a4066fcb9b4a4b49496cdf980219f3f`. The owner's standing implementation
and focused free-CI approval applies. Publishing and the free-capacity check
remain pending. No deployment, provider configuration, account, dependency,
database schema or migration change is proposed.

## Finding and change

Source inspection found that `saveWorkspace` unconditionally replaces
`workspace.current`, and confirmed import/recovery unconditionally clear and
replace the workspace and media. Two tabs can retain separate snapshots, so an
older tab can overwrite a newer committed draft. This is a source finding;
the proposed real two-tab reproduction has not run yet.

Each workspace write now requires the snapshot previously read or successfully
committed by that editor. A read and full normalized-snapshot comparison occur
inside the same IndexedDB readwrite transaction as the put/clear. A mismatch
aborts before writes or media clearing. The stored format and database version
stay unchanged. An unread baseline fails closed; a successfully observed empty
store is represented by `null`.

The editor advances its baseline only after a successful commit. Publishing
bookkeeping uses that same guarded callback. A conflict keeps the current
in-memory edits, stops autosaving, shows **Not saved**, and offers backup export.
Retry reads the current saved snapshot before the existing native replacement
confirmation. Cancelling preserves both drafts; accepting attempts a guarded
takeover. An intervening write still conflicts. Import/recovery do not silently
adopt another tab's snapshot. Saved-status freshness compares the actual captured
workspace object rather than timestamps that can coincide within a millisecond.

This protects committed workspace writes. It does not introduce collaboration,
cross-tab undo/media leases or cloud concurrency acceptance. Another tab's
uncommitted uploads remain outside the committed-draft contract.

## Focused verification

[The authored browser program](../../tests/e2e/local-draft-cas.mjs) uses the real
production editor, native controls, actual reloads and independently decoded
downloaded backups. No raw storage access, application injection or fulfilled
responses are allowed. Its phase and runtime application commit are recorded
separately from the observer source.

| Scope | Required evidence |
| --- | --- |
| Baseline L05/L06 | Desktop and narrow Chromium each save a newer draft in tab A, edit stale tab B, then reload A and download a backup. Accept a reproduction only when the actual saved name and backup show B replaced A. A generic failure or missing banner is insufficient. Preserve the original failed records, responses, downloads and screenshots. |
| Candidate L05/L06 | Refuse B's stale autosave, retain B's memory/backup, preserve A after retry cancellation, accept explicit retry against a fresh snapshot, refuse A's opposite stale write and confirmed stale import, then reload B and compare its complete backup and authored avatar bytes. |
| Candidate L01–L04 | Repeat the existing desktop/narrow authoring and media/portability journeys because persistence code changed. Keep historical passes attached to their original source; carry none as candidate runtime acceptance. |
| Candidate frontend/build | Run the existing 44 frontend fixtures plus exact static checks and an actual frozen production build, including semantic typechecking. Product dependencies and both lockfiles remain fixed. |

Prepare one public Ubuntu 24.04/Node 24.22.2 job, capped at 20 minutes, with
750 seconds for work, 90 for cleanup and 90 margin. The existing reviewed
Playwright 1.65.0 tool lock is reused. Install once, build the baseline, run only
its two reproduction cases, retire the owned baseline build, restore generated
Next declarations/config and install the three exact candidate application files
before a fresh candidate build. Keep separate phase directories, BUILD_IDs,
application vectors, complete command/server streams and browser response originals.
Require both exact baseline overwrite witnesses and all six candidate passes.
No service binding or network request beyond the bounded package/browser setup
and owned loopback browser origins is needed.

Do not activate a new job while the frozen editor-recovery run `43095738552`
remains live. Preserve and close that run first. A separately published source
branch can be reviewed now; it does not change main, its frozen source, or
runtime acceptance. The concrete controller and inactive workflow must be
reviewed and frozen before activation. No workflow belongs in main.

Local checks so far cover syntax/import resolution and patch applicability only.
Semantic types, frontend fixture execution, baseline reproduction and candidate
browser behavior are pending. Storage Guard prevents local heavy execution.
These checks cannot establish hosted publishing, backend ownership, physical
touch, Safari, assistive technology, quota behavior or full-product completion.
