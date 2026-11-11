# Linen checks

The original44frontend fixtures in `unit/` retain their separate installed
source/run in [the build receipt](../docs/results/2026/11-11/local-build.md).
Do not replay that accepted scope unchanged.

The [local-editor profile](../docs/proposals/editor-browser-checks.md) owns four
actual production Chromium journeys in `e2e/editor.mjs`. `scripts/ci-editor.py`
owns exact source/export checks, private runtime/tool installation, complete
streams and task/proof cleanup. It runs only in the declared public CI branch;
local Storage Guard is failed. No local app/browser/server is authorized by
that failed preflight. Syntax checks do not execute browser code.

`fixtures/browser-tool-package{,-lock}.json` are copied byte-for-byte from the
accepted Business Claw Playwright1.65.0 test-only lock, whose historical private
package name is retained. The root application manifest/lock are separate and
unchanged. Both official-registry tool resolutions, SHA512 integrity and exact
graph are frozen. No tooling is added to product dependencies.

The browser program authors a real two-by-two RGBA PNG with standard Node
libraries, then chooses the actual file through native FileChooser events.
Malformed PNG/ZIP fixtures are separate authored bytes. No external media,
account, private profile, generation model or production record is used.

Actual UI downloads are independently decoded from their ZIP directory without
importing app/archive helpers. Static HTML/media from the actual website ZIP
are served on a separate loopback origin and opened in a real second page.
This is static export proof, not hosted publication or backend ownership proof.
