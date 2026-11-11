# Linen local-editor qualification

11 November 2026. This source work is independent of the owner's pending free
capacity check. No provisioning, login, deployment or cloud publishing follows.
The owner's later "I approve everything" and "Keep going. Do all the work"
authorize the scoped free implementation/checks/temporary CI. This is specific
to Linen; other apps' earlier approvals are not reused.

The clean baseline is `503da8535a56b24129a0db99e89296c1f8153e0f`.
Storage Guard measured 4.3 GiB free /34 GiB required. No local install/build,
server, browser or database is permitted by that failed preflight.

## Phase 1: first reproducible dependency lock

One temporary public Ubuntu24.04 GitHub job, Node24.22.2, capped at20minutes.
`scripts/ci-lock.py` validates the exact checked commit, index, all native file
bytes/modes and unchanged baseline inputs five times. It copies only
`package.json` into its owned private scratch root. Npm gets empty task-owned
configuration/cache and a minimal environment without credentials. HOME retains
its original meaning; user configuration is not copied.

Run only `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`.
Do not install node_modules or execute application/dependency/backend code.
Require lock v3, all nine exact direct pins, registry-only SHA512 resolutions,
unchanged manifest and absent dependency directory. Retain the generated lock,
complete bounded command streams, source vector and actual failure/success.
No dependency upgrade or hand-authored generated lock is part of this phase.

The controller allows360seconds of work, reserves90seconds for owned cleanup
and90seconds of margin from the first-step20minute clock, enforces512MiB owned
scratch/2GiB free reserve with6GiB admission, fences child PID/start/UID/groups,
and verifies zero observed owned processes before deleting only its marked
root. Source and task-owned files remain unchanged until teardown. Upload the
bounded originals before a separate identity/no-openers/absence-checked proof
retirement. A failure stays failed; no repeated invocation on observation delay.
Retire only this task's temporary workflow/QA ref after terminal evidence.
Samples do not attest host-wide state, vendor caches or runner disposal.

## Subsequent phases and retained gates

Review actual lock output before adopting it. A separately frozen follow-up
will use `npm ci`, existing44 frontend fixtures, exact static checks and a
production build. It will retain original errors and make only supported
repairs; no accepted test packet is silently relabeled.

Only after that build is usable, freeze desktop/narrow editor journeys for
native direct editing, resize/reorder/undo, actual authored-file selection and
decode, IndexedDB reload, actual ZIP backup/replacement and static export.
Those later execution sources and assertions must be concrete before launch;
they do not run in Phase1. Use disposable browser contexts and local authored
data. No credential/storage injection, response fulfillment, external embeds,
accounts, cloud ownership tests, provider/model calls or paid resources.

Passing local qualification will not establish persistent public profiles,
durable cloud media, owner/preview enforcement, native touch/device behavior,
full accessibility or whole-product completion. Publishing stays disabled.
The historical44 fixture/static passes retain their original source boundary.

Inactive [workflow example](lockfile-ci.workflow.yml.example); the temporary
activation commit must add only `.github/workflows/linen-local-editor-lock.yml`
and substitute an exact checked source commit. No workflow is added to main.
