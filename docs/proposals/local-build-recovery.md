# Complete the missing build with original fixture results

The first [build invocation](https://github.com/alvarovillalbaa/linen/actions/runs/43090924132)
failed overall. Frozen installation and static checks succeeded; all44actual
frontend fixtures exited0. The controller's raw Python summary pattern had two
backslashes before `s`, so it looked for a literal backslash instead of trailing
whitespace and stopped before running the build. This is an observer error,
without evidence of an application defect. The original runner/source remains
immutable at `69b1f8abfb54ae8a799c9fc24f5105657309987d`.

The [data-only correction](../results/2026/11-11/first-build-observer-correction.json)
binds all44numbered named TAP records, unique summaries, actual0exit and complete
streams. The [67-member original packet](../results/2026/11-11/first-build-originals.zip),
[index](../results/2026/11-11/first-build.index.json), original job log and
[API/cleanup observations](../results/2026/11-11/first-build-api.json) preserve
the failed invocation. All33commands/66streams and four source guards completed;
owned task root and uploaded proof were removed with absence readbacks. No
production-build or all-green invocation is inferred from those passing steps.

Use a separate source and runner `scripts/ci-build-v2.py`. All63first-source
blobs/modes, including all35exported app/config/fixture inputs, remain unchanged.
Repeat the necessary frozen install, run the current exact static checker,
validate the retained actual TAP bytes and44records using the corrected unique
summary pattern, then run the missing actual package `next build`. Do not
replay the accepted44cases. Record their carried source/run separately from
the new build, with no combined execution count.

This stays within the [approved local-editor scope](local-editor-checks.md).
Keep the [original build profile](local-build-checks.md)'s Node24.22.2/public
Ubuntu24.04/20minute/600work90cleanup90margin, three-GiB scratch and complete
source/stream/process/cleanup fences. Preserve actual generated config bytes;
do not hide type or build failures. No local heavy execution, browser, backend
test, provider binding, account, paid service, deployment or capacity retry.

The [inactive v2 example](build-v2-ci.workflow.yml.example) belongs only on
owned QA branch `qa/linen-local-editor-20261111-build-2`, activation-only path
`.github/workflows/linen-local-editor-build-v2.yml`. The old workflow415094498
is disabled/read back; retire exact old QA only after preserving this source.
The new workflow and QA must also be retired after terminal evidence.
