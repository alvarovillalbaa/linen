# Reject missing snapshots before opening storage

11 November 2026. Candidate source follows parent
`9a4042fb33af07463e245690f17b2604fd10e968`. The prior implementation rejected
an omitted expectation inside the write transaction, after opening IndexedDB.
`expectedSnapshot` now rejects it before storage access. The valid observed
empty-store expectation remains `null`; the database format and version do not
change. All three workspace write operations share this guard.

The existing unavailable-IndexedDB fixture now checks missing expectations
separately for save, removal and replacement, and passes the required `null`
expectation when exercising unavailable storage. This extends one existing
case; it does not add a forty-fifth case or carry earlier results onto changed
test inputs.

[One focused native case](expected-snapshot-native.json) passed on existing
macOS Node24.21.0: exit0, one test/pass, no failures, cancellations, skips or
TODOs. [Original TAP stdout](expected-snapshot-native.stdout.tap) is347bytes;
[original stderr](expected-snapshot-native.stderr.log) is empty. The actual
child result was persisted before subsequent observers; it was reaped and its
process group was absent. Node bytes and stable identity fields were preserved,
excluding mutable access time from the identity comparison.

The [frozen native controller](../../../../scripts/check-expected-snapshot.py)
exported nine exact source/test inputs totaling101,495bytes, selected only the
modified existing case, and verified both export and source preservation. The
owned export was removed after identity/hash/no-openers checks and absence
readback. No installation, build, browser, database, provider or other fixture
execution was required. No prior invocation was replayed to repair an observer.

The earlier [44-record observation](local-draft-cas-native-fixtures.md) remains
attached to its original source and failed controller; its child exit remains
unknown. This focused result has its own complete process verdict and source
vector. Neither result establishes actual IndexedDB transactions, React/client
behavior, two-tab safety, semantic build or hosted publishing. Linux CI still
uses its separate Node24.22.2 profile. Its baseline restores the original test
file alongside the original three app files before switching to the candidate
inputs. The live older recovery43095738552 is preserved; no new CI is activated.
