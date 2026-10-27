# Linen

This directory contains Linen's application and backend source. Read `docs/spec.md`, `docs/implementation-contract.md` and `docs/research/2026/10-27/source-and-publishing.md` before acting. `README.md` is the entry point; dated source/release evidence belongs in `docs/results/`.

- `docs/spec.md` owns the product and acceptance contract. The implementation contract owns shared types/API decisions. The research note owns source evidence, publishing comparisons and proof limits.
- Persistent public profiles, durable media and updates at the same public address remain required. Static export and preview links supplement publishing; they do not replace it.
- The owner explicitly left the free-capacity check pending. Do not re-ask for login, provision services, deploy Linen or change provider configuration while it is pending.
- This research does not authorize a paid plan, trial, metered upgrade or automatic overage. A nominal $0 base price does not establish a free plan.
- Source and static/frontend checks do not establish a deployed app, browser acceptance, IndexedDB durability or backend ownership enforcement. Keep publishing disabled by default. Backend acceptance and browser checks require specific Linen approval; other apps' approvals do not apply.
- Preserve unrelated work and use `apply_patch`. The active user goal authorizes implementation and a dedicated personal GitHub repository; source work independent of the capacity check can continue. Keep provisioning dependent on the pending check, follow the user's verification/approval rules, and run Storage Guard before installations or local app builds. Do not work around a failed preflight.
