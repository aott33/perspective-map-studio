---
title: 'Performance check before 0.2.0'
type: 'chore'
ticket: '17'
created: '2026-10-27'
status: 'in-review'
baseline_revision: '273dccd7dfd61e3bc1bbcf90d128988b3ffb1f8c'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'coordinator'
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/docs/platform-checks.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** 0.2.0 changes the public contract and adds the map store, the write path, the change bus and the host lists, but nothing has measured them past the 30-pad dev set. Before the release the owner wants numbers, with limits, that the next release can be compared against.

**Approach:** One repeatable perf run (`ops/perf.sh` driving a Playwright runner in `e2e/perf/`) on a separate scratch project `mapstudio-perf` of the dev stack, then the same run against the template's 300-pad test stack on the owner's laptop. Each run writes one JSON result; the method and the numbers go into docs/platform-checks.md; the committed results are compared release to release.

## Decisions (owner, 2026-10-27)

- Measure on the dev stack, then on the template's test stack (300-pad scale setup). The template is read only: nothing in it is edited or committed.
- A repeatable script; results with their method in docs/platform-checks.md; compared release to release from now on.
- Measures and limits: map.load time and payload at 30, 1,000 and 5,000 items (5,000 under 1 s); edits.apply median and p95, 1-op and 50-op batches, 1 and 10 editors at once (p95 under 300 ms); a save reaching other open maps (map.changed) with 10 and 50 open sessions (all within 1 s); kind and asset list refresh with 300 assets (under 1 s, no CPU spike); Gateway CPU and memory idle and with 20 sessions open (small next to a Gateway without Map Studio, "small" defined as a number here); browser bundle versus 0.1.0 (grows less than 10%); the frame-rate measure repeated as `e2e/tests/measures.spec.mjs` does (recorded, not pass/fail).
- A miss is fixed before the release or accepted by the owner.

## Decision (owner, 2026-10-27: "agree with all recommendations, start building")

1. One story: the template-stack run is the same script with `--target template`.
2. "Small" and "spike" as below are the limits: idle, Map Studio adds at most 2% of one core (mean) and 64 MiB heap; with 20 sessions open on the 1,000-item map at most 10% of one core and 200 MiB more than 20 sessions on `/plain` without the module; no spike = no 1 s CPU reading during list refreshes above the idle mean plus 50% of one core. map.load is judged on p95 of 10 runs; map.changed is timed from the editor's send (the save included).
3. Template stack: hand-install the unsigned 0.2.0 candidate on the kept 300-pad stack. If that Gateway refuses unsigned modules, record it and run the template measures right after the 0.2.0 tag (story 13); a miss found then is fixed in 0.2.1.
4. A miss is fixed in this story when the fix is small; otherwise it becomes a new entry before story 13, or the owner accepts it in docs/platform-checks.md.
5. A busy refusal is counted, never retried, and makes its measure a miss.
6. 50 sessions are tried here at 320x240; when they do not all load within 5 minutes the measure is `unavailable` with the count reached, and the laptop run fills it.

## Boundaries & Constraints

**Always:** items are created through the real write path (edits.apply), never SQL; every number carries its method, environment (CPUs, renderer, Gateway version, target) and label (measured, or [unverified] where a reading is not proven); a measure that cannot run is `{status: 'unavailable', reason}`, never a guess; the run leaves the dev stack as it found it (EXIT trap); secrets are read from files and never printed or written to a result; no em dashes.

**Never:** no change to Gateway or component production code to make a measure possible (a miss found is a separate, owner-decided change); no edit, commit or pull request in `ign-scada-template`; no perf items in the `mapstudio-dev` project; `npm test` does not run the perf suite.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Full dev run | `ops/perf.sh` on a running dev stack | `e2e/out/perf.json` with every measure, a verdict per limit (pass, miss, recorded) | Exit 0 all pass, 3 any miss, 2 refusal, 1 crash |
| Busy refusal | the work pool answers `store-unreachable` "busy" | counted in the measure's `busy`, sample not retried, the measure is a miss naming it | none expected at these loads (at most 10 + 50 jobs against 4 threads + 64 queue) |
| Box too small | 50 contexts do not all reach `data-load-state=loaded` in 5 min | that measure `unavailable` with the count reached; the laptop run fills it | the rest of the run goes on |
| Trial too short | `GET /data/api/v1/trial` under 45 min left | refused before anything starts, exit 2 | message names a Gateway restart |
| Record | `PERF_RECORD=0.2.0` | also writes `docs/perf/0.2.0-<target>.json` without timestamps | only when no measure crashed |

</frozen-after-approval>

## Code Map

- `e2e/tests/measures.spec.mjs` -- `paced`, `panGesture`, `zoomGesture`, `startSampler`, `stopSampler`, `measureView`, `webglRenderer`, `envFor`: move to a shared lib, no behaviour change; its bundle test is the model for reading `/res/mapstudio/*`.
- `e2e/tests/fixtures.mjs` -- reuse `openMap`, `mapLoaded`, `loadedCounts`, `signedInContext`, `nextFrames`; `sessionUrl` (`e2e/lib/env.mjs`) is hard-wired to `mapstudio-dev`: add a project argument.
- `web/typescript/testHook.ts` -- `window.__mapStudioTest.send('map.load'|'edits.apply', body)` resolves with the reply envelope, 30 s timeout; the component ignores replies the hook takes, so a timed `map.load` is round trip plus parse only.
- `web/typescript/MapStudio.tsx` -- `map.load` is sent only after MapLibre's `load` event (needs WebGL, so every session must render); attributes `data-store-seq` (last `map.changed` seq), `data-load-state`, `data-items-loaded`.
- `gateway/.../MapStudioServices.java` `WORK_THREADS = 4`, `WORK_QUEUE = 64`; `MapStudioDelegate.submitWork`/`busyReply` (`store-unreachable`, "Map Studio is busy ..."). `ChangeBus` delivers on its own thread, not the pool. `EditBatch.MAX_OPS = 1000`.
- `gateway/.../adapter/AdapterService.java` -- tick every 1 s, `refreshIntervalSeconds` per setup, `TIMEOUT` 5 s, pool 2 + 8; `system.mapstudio.refreshAdapters(project)` waits for both lists (`GatewayScriptModule`).
- `ops/store-checks.sh`, `ops/docker-compose.store-checks.yml` -- the pattern to copy: overlay project, recreate, EXIT trap restores the plain stack. `ops/scan.sh`, `ops/users.py` -- API token from `ops/secrets/api-token` via stdin header. `ops/project/ignition/script-python/mapstudio_dev` -- kinds to copy, `holdsMapEditor` role check pattern.
- Store tables are keyed by `project` (`migrations/0001_first_schema.sql`): `mapstudio_item`, `_edit`, `_batch`, `_kind_setup`, `_project`.
- Template (read only): `tests/load/gateway_stats.py` proves `GET /data/api/v1/systemPerformance/currentGauges` (`cpu`, `heapMemory`, `maxMemory`), `/data/perspective/api/v1/sessions/` and `/data/api/v1/trial` [live 8.3.9, template]; `docs/performance.md` runs `scripts/test/load.sh --pads 300 ... --keep`; 50 contexts need 4 to 7 GB.

## Tasks & Acceptance

**Execution:**
- [x] `ops/perf/project/` -- scratch project `mapstudio-perf`: setup (connection from a flag, default `MapStudio`; roles as dev; `mapstudio_perf.kinds`/`assets`; 30 s refresh), page `/` with the map at 100% size, `/plain` (a label, no component), `/tools` (button running `mapstudio_perf.timeRefresh()`), script `mapstudio_perf` (dev kinds, 300 deterministic assets, `timeRefresh` returns `{ms, statuses}` after a MapEditor check).
- [x] `ops/docker-compose.perf.yml`, `ops/docker-compose.perf-nomodule.yml` -- mount the perf project; the second also mounts an empty folder over `/external-modules`.
- [x] `ops/perf.sh` -- phases `nomodule` and `main` (default both), `--target dev|template`, trial check, SQL wipe of `project = 'mapstudio-perf'` rows only while the project is unmounted, starts and stops the sampler, runs `npx playwright test -c perf/playwright.perf.config.mjs`, EXIT trap recreates the plain stack.
- [x] `e2e/lib/frameRate.mjs` + `e2e/tests/measures.spec.mjs` -- move the frame-rate helpers; the spec imports them.
- [x] `e2e/lib/env.mjs` -- `sessionUrl(path, project)`, perf output paths.
- [x] `e2e/perf/items.mjs` -- deterministic pads and lines (UUIDv5 of `mapstudio-perf/<n>`, half points, half lines on a grid), batches of 500 ops.
- [x] `e2e/perf/sampler.mjs` -- `docker stats` stream (1 s CPU, memory) plus `currentGauges` and sessions every 5 s, written after every sample.
- [x] `e2e/perf/result.mjs`, `e2e/perf/compare.mjs` -- result schema, limits, verdicts; compare two results and print deltas.
- [x] `e2e/perf/perf.spec.mjs`, `e2e/perf/playwright.perf.config.mjs` -- the measures in the order of Design Notes.
- [x] `e2e/perf/perf.test.mjs`, `e2e/package.json` -- unit tests (items, verdicts, percentile, compare, busy counting) in `test:unit`; script `perf`.
- [x] `docs/platform-checks.md`, `docs/perf/0.2.0-dev.json`, `docs/perf/README.md`, `.gitignore` -- the story section (method, dev numbers, template numbers from the laptop run, misses and their outcome); write-back noise of `ops/perf/project` ignored. Done for the dev run; the template numbers wait on the laptop run after the 0.2.0 tag (decision 3), so that row of the table is `unavailable`.

**Acceptance Criteria:**
- Given the dev stack, when `ops/perf.sh` runs twice, then both runs finish, the dev project's item count and the plain stack are unchanged, and each result holds every measure with a verdict.
- Given a result, when `node perf/compare.mjs a.json b.json` runs, then it prints each measure's value, delta and verdict.
- Given the owner's laptop with the template's 300-pad stack kept, when `ops/perf.sh --target template` runs, then `docs/perf/0.2.0-template.json` and its rows in docs/platform-checks.md come from it.
- Given any miss, then docs/platform-checks.md names it and whether it was fixed or accepted by the owner, before story 13 starts.

## Design Notes

**Run order (main phase):** bundle; idle 3 min; 30 items: map.load x10, frame rate; seed to 1,000: map.load x10, map.changed with 10 then 50 viewer sessions (5 saves each), 20 sessions open 3 min; seed to 5,000: map.load x10, edits.apply, frame rate; list refresh x10. The `nomodule` phase: idle 3 min, 20 sessions on `/plain` 3 min. About 30 min on this box.

**How each is taken.** map.load: in an editor page, `performance.now()` around `send('map.load')`, median and p95 of 10 after one warm-up, payload = byte length of the reply's websocket frame; open-to-drawn also recorded; judged on p95. edits.apply: each editor (own context, map editor sign-in) updates its own disjoint 50 pads, 20 one-op and 20 fifty-op batches, versions from map.load; 1 then 10 editors at once. map.changed: N anonymous contexts at 320x240 on `/`, a MutationObserver per page stamps `Date.now()` when `data-store-seq` reaches the save's seq; latency from the editor's send, max over sessions; session count checked with the sessions route. CPU and heap: container CPU mean and 1 s max from `docker stats`; heap as the minimum `heapMemory` over the window (a live-set estimate [unverified]). List refresh: `/tools` button 10 times, `ms` from the Gateway script, CPU 1 s samples alongside. Bundle: sum of decoded bytes of `/res/mapstudio/*` versus the same files in the v0.1.0 release `.modl` (public URL, SHA-256 `04caa07b...` as in the template lock), unzipped with `unzip`; nested path [unverified until built]. Frame rate: `measureView` on `/` at 30, 1,000 and 5,000 items.

**"Small" and "spike" (proposed):** idle, Map Studio adds at most 2% of one core (mean) and 64 MiB heap; with 20 sessions open on the 1,000-item map, at most 10% of one core and 200 MiB more than 20 sessions on `/plain` without the module. No CPU spike: no 1 s sample during list refreshes above the idle mean plus 50% of one core.

**Template run:** same runner, `--target template` reads the template's `GW_URL`, compose project `ign-og-test`, `secrets/api-token` and a map editor user from a local file (never printed); the perf project is copied into the running test Gateway by `docker cp` and a project scan (no compose edit); its setup names the test stack's PostgreSQL connection by flag.

**This box cannot measure well:** 4 CPUs shared by the Gateway, PostgreSQL and up to 50 Chromium contexts with software WebGL, so latencies under browser load are pessimistic and the 50-session and 10-editor numbers may be `unavailable`; 15 GB RAM; frame rates are software WebGL; the 2 h trial and a box recycled every 30 to 60 min. The laptop run is the deciding run for sessions, CPU and the 300-pad realism.

## Open Questions

None: all six were answered by the owner on 2026-10-27 (Decision above).

## Implementation Notes

- Built as planned, with the Plan Change Log's eight gap fixes. One complete dev run (`PERF_RECORD=0.2.0 ops/perf.sh`, both phases, 2026-10-27 23:55 to 2026-10-28 00:17 UTC, container `ms-e2s17`, exit 3) is committed as `docs/perf/0.2.0-dev.json`; the first attempt was lost to a container restart before it finished (saved as a WIP commit), so only one complete run exists on this box.
- Results: every limit passed except `edits.apply` with 50-op batches from 10 editors at once (p95 1,791.9 ms, median 303.4, max 2,952.7, n 200, no busy refusal, no timeout; limit p95 under 300 ms). The 1-op 10-editor case passed (p95 276.6 ms). The table, the cause and the method are in docs/platform-checks.md, "Epic 2 story 17".
- Cause analysis (after the first run, commit 7c1fcb1): each `edits.apply` measure now records the open editor pages, the whole box's CPU busy share over the measure (`/proc/stat`, `procStatCpu` and `hostBusyPct` in `e2e/perf/result.mjs`, unit tested) and the Gateway container's window, and the 10 editors' 50-op streams are also sent from one page (`50op-10streams-1page`, recorded, not judged on p95; a busy refusal, timeout, error or missing sample is still a miss). The host was 99.7 to 99.8% busy over 4 CPUs during every judged `edits.apply` measure while the Gateway used under one core; from one page the Gateway's share rose to 81% of one core and p95 fell to 314.3 ms (median 200, max 394.7). So the miss is this 4-CPU box running 10 Chromium pages (5,000-item map, software WebGL) beside the Gateway and PostgreSQL, not the write path; the residual ~314 ms with 10 concurrent 50-op streams is the per-project serialisation of batches (story 2's design) and is near the limit. The verdict in the record stays `miss`; the docs mark it "miss on this box". No Gateway or component code changed.
- Open for the owner (decision 4): accept the miss for 0.2.0 with the cause recorded (a dated Decision line in the epic's Notes), or re-run the dev target on a laptop first (`PERF_RECORD=0.2.0 ops/perf.sh`, the exact command is in docs/platform-checks.md and docs/perf/README.md). Recorded in the epic's Notes and in `_bmad-output/deferred-work.md`.
- Template target: not run (decision 3; the kept stack refuses unsigned modules [unverified live]); `ops/perf.sh --target template` refuses with exit 2 until the test Gateway runs Map Studio 0.2.x, and its code path is [unverified] until the laptop run after the tag.
- Not changed: `e2e/tests/measures.spec.mjs` still writes its frame-rate section through `e2e/lib/frameRate.mjs` (moved helpers, no behaviour change); `npm test` does not run the perf suite (its own config, `npm run perf`).

## Plan Change Log

- 2026-10-27, approval: the owner approved with all six recommended answers; Decision recorded, Open Questions resolved, status in-progress. A context-free review of the plan alone (before any code) found eight gaps; each is addressed in the build as below.
- Finding 1 (template cleanup): `ops/perf.sh` cleans up per target. Dev: the EXIT trap recreates the plain stack with `docker compose -p <this checkout>` and deletes only `project = 'mapstudio-perf'` rows. Template: never `compose up` or `down` on `ign-og-test`; the project is copied in with `docker cp` plus a project scan and removed on exit the same way, only perf rows are deleted, and the trap compares the Gateway's project list and every other project's row counts before and after (a change fails the run). The dev run compares the same row counts.
- Finding 2 (timeouts pass as fast): every send is classified (`ok`, `busy`, `timeout`, `error:<code>`) in `e2e/perf/result.mjs`; any non-ok outcome makes the measure a miss, and a verdict needs exactly the planned number of good samples (`latencyVerdict`, unit tested with every sample timed out).
- Finding 3 (fewer items than claimed): before each map.load measure the warm-up reply must hold the target count and every timed reply is checked; open-to-drawn, frame rate and viewer pages check `data-items-loaded`; editors check their map.load. A wrong count makes the measure unavailable (or that sample an error).
- Finding 4 (percentile method): nearest-rank (`PERCENTILE_METHOD` in result.mjs, recorded in every result), n with every statistic, unit tests for n of 10 and 20; edits.apply samples are pooled over the editors (n 20 or 200).
- Finding 5 (baseline comparable): the dev image brings no third-party module and `ops/modules` holds only the staged Map Studio `.modl`, so the nomodule overlay mounting an empty folder over `/external-modules` removes Map Studio only; each phase records the Gateway's module list (`/data/api/v1/modules/healthy`) in its env. Both phases recreate the Gateway, settle the same `PERF_SETTLE_S`, mount the same perf project and run back to back.
- Finding 6 (secret in traces): `perf/playwright.perf.config.mjs` sets trace, video and screenshot off; sign-in stays in `lib/signInCli.mjs`'s own process; the global teardown's password scan runs, and `ops/perf.sh` greps `e2e/out` for every secret of the run (dev passwords, admin password, API token, PostgreSQL password), deleting a hit and failing the run.
- Finding 7 (map.changed observer gap): the MutationObserver is attached on every viewer before the first save; each save records how many sessions saw its seq against N; fewer than N within 10 s is a miss.
- Finding 8 (warm-up): every timed measure discards one warm-up (map.load, each editor's edits.apply per batch size, list refresh); frame rate keeps measureView's 2 s warm-up.
- Implementation: the `/tools` page is part of `/edit` (one signed-in page holds the map, the sign-in and the "Time a list refresh" button); its dom ids for the user label and the login button are the dev `/edit` page's, so `lib/editorAuth.mjs` signs in unchanged apart from the project in its URL check (`e2eProject()`, from `MAPSTUDIO_E2E_PROJECT`). Frame rate is also taken at 1,000 items (Design Notes name 30, 1,000 and 5,000; the run order named two). The bundle is judged on the files a page load fetches against every non-licence file of the v0.1.0 web jar.
- Decision 3, read from `ign-scada-template/docker-compose.yml` (read only): its Gateway command has no `-Dignition.allowunsignedmodules=true`, so the kept 300-pad stack refuses the unsigned candidate [unverified live, read from the compose file]; no template stack is kept on this box either. Per decision 3 the template measures run right after the 0.2.0 tag (story 13); `ops/perf.sh --target template` refuses (exit 2) until the test Gateway runs Map Studio 0.2.x.

## Review Triage Log

## Verification

**Commands run (what was actually run; Docker was not available while the record was written up, so nothing was re-measured):**
- `cd e2e && npm run test:unit` -- passed (lib, secret scan and the perf unit tests: items, verdicts, percentile, compare, busy counting, `/proc/stat` CPU, the every-sample-timed-out case).
- `bash -n ops/perf.sh` and `cd ops && shellcheck -x perf.sh` -- clean (from the repository root shellcheck only reports SC1091, info, that it does not follow `lib.sh`).
- `node --check` on every `e2e/perf/*.mjs` -- clean.
- `PERF_RECORD=0.2.0 ops/perf.sh` on the dev stack (`ms-e2s17`, 2026-10-27 23:55 to 2026-10-28 00:17 UTC) -- exit 3 (one limit missed), a complete `e2e/out/perf.json` with every measure and a verdict, written to `docs/perf/0.2.0-dev.json` (commit 2a3b500). The trap's own checks (the plain stack recreated, no `mapstudio-perf` rows left, the dev item count unchanged) ran in that session but their outcome is not written into the record: [not verified] here.
- `cd e2e && node perf/compare.mjs docs/perf/0.2.0-dev.json docs/perf/0.2.0-dev.json` (the record against itself) -- prints every headline number with a zero delta and its verdict.
- `grep -rnP '\xE2\x80\x94'` over the files this story touched (`docs/`, `ops/perf.sh`, `ops/perf/`, `e2e/perf/`, `e2e/lib/`, this plan, the epic and `_bmad-output/deferred-work.md`) -- no match (the installed `_bmad/` tooling has its own, outside this story).
- Not run: `cd e2e && npm test` (needs the dev stack); a second `ops/perf.sh` run on this box for the "runs twice" criterion (the first attempt was lost to a container restart); `ops/perf.sh --target template` (decision 3, after the tag).

**Acceptance criteria:**
- Runs twice, stack unchanged, every measure with a verdict: one complete run with every measure and a verdict; the second run and the unchanged-stack check are [not verified] on this box (above).
- `compare.mjs` prints value, delta and verdict: yes.
- Template run writes `docs/perf/0.2.0-template.json`: not yet (decision 3, after the 0.2.0 tag; the table row is `unavailable`).
- Any miss named with its outcome before story 13: named in docs/platform-checks.md ("miss on this box", cause and both options); the owner's decision is open (epic Notes, deferred-work).
