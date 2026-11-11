# Linen

This directory contains Linen's application and backend source. Read `docs/spec.md`, `docs/implementation-contract.md` and `docs/research/2026/10-27/source-and-publishing.md` before acting. `README.md` is the entry point; dated source/release evidence belongs in `docs/results/`.

- `docs/spec.md` owns the product and acceptance contract. The implementation contract owns shared types/API decisions. The research note owns source evidence, publishing comparisons and proof limits.
- Persistent public profiles, durable media and updates at the same public address remain required. Static export and preview links supplement publishing; they do not replace it.
- The owner explicitly left the free-capacity check pending. Do not re-ask for login, provision services, deploy Linen or change provider configuration while it is pending.
- This research does not authorize a paid plan, trial, metered upgrade or automatic overage. A nominal $0 base price does not establish a free plan.
- Source and static/frontend checks do not establish a deployed app, browser acceptance, IndexedDB durability or backend ownership enforcement. Keep publishing disabled by default. Backend acceptance and browser checks require specific Linen approval; other apps' approvals do not apply.
- Preserve unrelated work and use `apply_patch`. The active user goal authorizes implementation and a dedicated personal GitHub repository; source work independent of the capacity check can continue. Keep provisioning dependent on the pending check, follow the user's verification/approval rules, and run Storage Guard before installations or local app builds. Do not work around a failed preflight.

## Approved local-editor qualification — 11 November 2026

The owner's subsequent "I approve everything" and "Keep going. Do all the work"
authorize this Linen-specific, free temporary-CI qualification described in
`docs/proposals/local-editor-checks.md`. The older no-approval statements retain
their historical source boundary. The capacity check remains pending: no
deployment, account, provider setup, public publishing or backend acceptance.
Start with the isolated lock-generation phase; review its actual output before
freezing a separate install/build/editor source. No local heavy execution.

The lock phase and frozen local build are now closed; see
`docs/results/2026/11-11/local-build.md`. Preserve the failed summary observer
and its 44 actual passing frontend records; do not replay them unchanged.
Next is concrete local-editor browser acceptance, with publishing still disabled.

The concrete four-case source and temporary CI bounds are in
`docs/proposals/editor-browser-checks.md`. Use fresh authored contexts and the
actual local production runtime; no raw storage/app injection, response
fulfillment, provider binding or capacity retry. Preserve failures and accepted
case identities before repairing or selecting another invocation.

## Local draft preservation candidate

`docs/proposals/local-draft-cas.md` owns a separate source-level stale-save
repair using the existing Workspace shape and database version. It is a
candidate pending semantic build and actual two-tab validation; do not carry
old browser passes as acceptance of changed persistence code. Keep the existing
recovery run43095738552 and its frozen source intact. Do not enqueue a duplicate
or another verification job while that run remains live. Source work is covered
by the all-project implementation authorization; no cloud/provider or migration
gate is opened. Native main remains the previously published qualified source.

Native Node24.21.0 produced44matching passing fixture records, but its outer
receipt observer failed and did not persist the child exit code. See
`docs/results/2026/11-11/local-draft-cas-native-fixtures.md`; do not relabel it
as a successful controller, Linux CI, IndexedDB or browser qualification.

The later expected-snapshot guard rejects missing expectations before opening
storage. One extended existing fixture passed on native Node24.21.0 with actual
child exit0 and verified cleanup; see
`docs/results/2026/11-11/expected-snapshot-native.md`. It is separate from the
old44-record observation. Real IndexedDB/two-tab and semantic-build acceptance
remain pending. The CI baseline also restores the original fixture before its
candidate phase; no live verification job is activated by this source work.
