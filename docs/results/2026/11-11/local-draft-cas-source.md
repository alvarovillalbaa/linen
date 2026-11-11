# Local draft preservation source candidate

11 November 2026. Based on clean main
`6277e1e56a4066fcb9b4a4b49496cdf980219f3f`. This candidate is isolated from
main and from the live frozen editor-recovery run `43095738552`. It has not
been installed, built, deployed or accepted at runtime.

The [focused proposal](../../../proposals/local-draft-cas.md) records the source
finding, transactional compare-and-save repair, six candidate browser scenarios
and two baseline reproduction cases. Three runtime modules change:
`lib/local.ts`, `lib/client.ts`, `components/editor.tsx`. The implementation
contract and appended repository instructions describe their new local-save
contract. Shared types, product dependencies, lockfiles, database version,
backend policy and provider settings remain unchanged.

Local verification uses an existing read-only TypeScript 5.9.3 parser for the
three changed TS/TSX modules and their relative imports; Node syntax checking
for the authored browser program; Python AST parsing for the concrete CI
controller; source/Markdown-reference checks and an exact-base patch check.
These are static checks. Semantic types, 44 frontend fixtures, baseline
overwrite reproduction and all six candidate browser scenarios remain pending.
The inactive [workflow example](../../../proposals/local-draft-cas-ci.workflow.yml.example)
does not start a job. No `.github/workflows/` file is added by this source.

The [controller](../../../../scripts/ci-local-draft-cas.py) retains the earlier
bounded process, source, stream, storage and cleanup machinery as versioned
source. It separates baseline and candidate runtime identities and preserves
expected baseline failures. Neither historical browser passes nor a generic
baseline failure can satisfy this candidate's verdict. It requires actual
newer-draft loss in the baseline and guarded preservation in the candidate.

Do not activate it while the older recovery run remains live. Preserve and
close that run before freezing this candidate's checked source on its own
temporary QA branch. No merge to main or browser qualification is claimed.
Storage Guard prevents local heavy execution; the owner's pending free-capacity
check continues to block hosted publishing and backend acceptance.
