# Frozen local frontend build

11 November 2026. Follow-up to the accepted
[first lock](../results/2026/11-11/first-lock.md) and
[local-editor scope](local-editor-checks.md). The owner's standing all-work/
checks/temporary-CI authorization applies to Linen. Cloud capacity stays pending;
no deployment, provider configuration, account, backend tests or browser runs.

Baseline `aaee557e8dc367ca95a781b9ee3aba8712b05f29` is published and native-clean:
60files/512,825bytes. The first lock phase is closed, its workflow disabled and
exact owned QA ref deleted/read back404. Do not regenerate the accepted lock.

One public Ubuntu24.04/Node24.22.2 job, capped at20minutes. The exact reviewed
lock SHA256 is `e45695227f15135d0e85174be8930b8e34350eb362538b6b0a507ca30ff3e6e1`.
Export35explicit application/config/fixture files into private owned scratch,
preserve that source copy and create a second disposable application copy.
Install only using `npm ci --ignore-scripts --no-audit --no-fund`, with private
empty npm configuration/cache, minimal credential-free environment, original
HOME meaning and Next telemetry disabled. Do not call Convex CLI/codegen.

Run the exact source static parser/import/document checker against installed
TypeScript. Run only the existing three frontend fixture files:44cases with
zero failures/skips/cancellations/TODOs. This is a new installed-compatibility
profile; the historical fixture receipt remains separate. Then run the actual
package `build` script (`next build`) without a dev server or provider binding.
Require its successful exit and a real nonempty production BUILD_ID.

The head/index/native source and all baseline blobs/modes must stay exact at
five guards. Original exported files and package/lock bytes cannot change.
Only Next's known automatic `next-env.d.ts`/`tsconfig.json` changes may appear in
the disposable app; retain their exact before/after bytes for review rather
than silently adopting them. No other exported app input can change.

`scripts/ci-build.py` reserves600seconds of work/90cleanup/90margin from the
first-step20minute clock; it checks8GiB remote admission/2GiB free reserve,
3GiB owned scratch, complete bounded streams and child PID/start/UID/groups.
Verify owned process absence before deleting only the marked scratch root.
Upload exact originals before separate source/identity/no-openers proof
retirement. Preserve every failed invocation before making a supported repair.
Retire only this task's workflow/QA ref. Sampled/boundary checks do not attest
all host processes, vendor caches or external runner disposal.

Local Storage Guard remains failed4.3/34GiB: no local install/build/app/server/
browser/database. Passing a production build does not establish working local
editing/IndexedDB/media/backup, deployed ownership enforcement or durable public
pages. The concrete browser source follows only once the build is usable.

The [inactive workflow](build-ci.workflow.yml.example) is added only by an
activation child at `.github/workflows/linen-local-editor-build.yml`, with the
exact checked commit substituted. No workflow belongs in main.
