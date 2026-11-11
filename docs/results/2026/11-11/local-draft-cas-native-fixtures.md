# Native frontend fixture observations

11 November 2026. Source under test:
[`6cddf6ceb90e8171b26fcb9efdaa9f19bc0fc211`](https://github.com/alvarovillalbaa/linen/tree/6cddf6ceb90e8171b26fcb9efdaa9f19bc0fc211).
An existing native macOS Node24.21.0 executed the three unchanged frontend
fixture files against nine exact source exports, including candidate
`lib/local.ts`:101,075bytes. No installation, build, browser, database or
provider was involved. Canonical main remained clean at `6277e1e5`.

The [original stdout](local-draft-cas-native.stdout.log) contains44passing
records and summary44tests/44pass/0fail/0cancelled/0skipped/0todo.
The [original stderr](local-draft-cas-native.stderr.log) is empty. Data-only
reconciliation independently matched every actual case name to its authored
test definition, plus all nine exported hashes and the Node executable digest.
The retained stdout is Node's **spec** reporter, despite its first local
filename ending in `.tap`; it is not a TAP document.

The overall outer controller remains **failed**. Its [original receipt error](local-draft-cas-native-observer-failure.log)
occurred after writing both streams, while comparing the Node executable's
entire stat record before and after execution. That comparison includes mutable
access time. The original before-stat fields were not retained, so the exact
differing metadata field is unconfirmed. Current executable bytes independently
match the recorded pre-execution digest. The child exit code was not persisted
before this assertion failed; it remains unknown. No successful controller or
zero child exit is inferred from passing case records. An earlier derived note
attributed the comparison failure to access time too strongly; its corrected
version records this uncertainty and preserves the original locally.

The [record and cleanup receipt](local-draft-cas-native-records.json) retains
case identities, source digests, original stream hashes and explicit limits.
Only the owned nine-file export plus its owner marker was removed after exact
identity/hash/source-preservation/no-openers checks and absence readback.
Original streams, before-source receipt and both reconciliation editions are
preserved in the owning local delivery bundle. No tests were replayed to fix
the observer or derive this record. Public evidence omits local-only paths.

These records exercise authored model/render/archive behavior and the
unavailable-storage error. They do not exercise a real IndexedDB transaction,
the React editor/client, stale-tab saving, backend ownership or hosted publishing.
Native Node24.21.0 is distinct from the proposed Linux Node24.22.2 profile.
That CI profile now explicitly selects `--test-reporter=tap` before checking
its actual complete summary and child exit. Its qualification remains pending,
alongside semantic builds and the real baseline/candidate browser journeys.
The existing recovery run43095738552 remains queued and is preserved; no new
workflow was activated. This is scoped evidence, not product completion.
