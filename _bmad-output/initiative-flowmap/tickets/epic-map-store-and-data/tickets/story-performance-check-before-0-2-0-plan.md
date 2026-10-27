---
title: 'Performance check before 0.2.0'
type: 'chore'
ticket: '17'
created: '2026-10-27'
status: 'draft'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'medium'
review: ''
review_source: ''
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
- [ ] `ops/perf/project/` -- scratch project `mapstudio-perf`: setup (connection from a flag, default `MapStudio`; roles as dev; `mapstudio_perf.kinds`/`assets`; 30 s refresh), page `/` with the map at 100% size, `/plain` (a label, no component), `/tools` (button running `mapstudio_perf.timeRefresh()`), script `mapstudio_perf` (dev kinds, 300 deterministic assets, `timeRefresh` returns `{ms, statuses}` after a MapEditor check).
- [ ] `ops/docker-compose.perf.yml`, `ops/docker-compose.perf-nomodule.yml` -- mount the perf project; the second also mounts an empty folder over `/external-modules`.
- [ ] `ops/perf.sh` -- phases `nomodule` and `main` (default both), `--target dev|template`, trial check, SQL wipe of `project = 'mapstudio-perf'` rows only while the project is unmounted, starts and stops the sampler, runs `npx playwright test -c perf/playwright.perf.config.mjs`, EXIT trap recreates the plain stack.
- [ ] `e2e/lib/frameRate.mjs` + `e2e/tests/measures.spec.mjs` -- move the frame-rate helpers; the spec imports them.
- [ ] `e2e/lib/env.mjs` -- `sessionUrl(path, project)`, perf output paths.
- [ ] `e2e/perf/items.mjs` -- deterministic pads and lines (UUIDv5 of `mapstudio-perf/<n>`, half points, half lines on a grid), batches of 500 ops.
- [ ] `e2e/perf/sampler.mjs` -- `docker stats` stream (1 s CPU, memory) plus `currentGauges` and sessions every 5 s, written after every sample.
- [ ] `e2e/perf/result.mjs`, `e2e/perf/compare.mjs` -- result schema, limits, verdicts; compare two results and print deltas.
- [ ] `e2e/perf/perf.spec.mjs`, `e2e/perf/playwright.perf.config.mjs` -- the measures in the order of Design Notes.
- [ ] `e2e/perf/perf.test.mjs`, `e2e/package.json` -- unit tests (items, verdicts, percentile, compare, busy counting) in `test:unit`; script `perf`.
- [ ] `docs/platform-checks.md`, `docs/perf/0.2.0-dev.json`, `.gitignore` -- the story section (method, dev numbers, template numbers from the laptop run, misses and their outcome); write-back noise of `ops/perf/project` ignored.

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

1. **Plan size.** About 3,300 tokens, above the 1,600 guide. Keep, or split the template-stack run into its own entry? Recommended: keep; it is the same script with a target flag.
2. **Limit numbers.** Accept "small" and "no spike" as in Design Notes, map.load judged on p95 of 10, map.changed measured from the editor's send (save included)? Recommended: yes.
3. **0.2.0 candidate on the template stack.** Its image bakes the signed 0.1.0. Options: hand-install the unsigned candidate on the kept 300-pad stack (needs unsigned modules allowed there [unverified]); or run the template measures right after the 0.2.0 tag in story 13. Recommended: hand-install; if the Gateway refuses it, run after the tag and treat a miss as a 0.2.1 fix.
4. **A miss.** Fix in this story when the fix is small, otherwise a new entry before story 13 or the owner accepts it in docs/platform-checks.md? Recommended: yes.
5. **Busy refusal.** Count it, no retry, the measure is a miss? Recommended: yes; a retry would hide the limit.
6. **50 sessions here.** Try at 320x240 and record `unavailable` if they do not all load in 5 min? Recommended: yes; the laptop fills it.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd e2e && npm run test:unit` -- expected: passes, perf tests included.
- `cd e2e && npm test` -- expected: unchanged suite passes, measures.spec still writes its frame-rate section.
- `bash -n ops/perf.sh && shellcheck -x ops/perf.sh` -- expected: clean.
- `ops/perf.sh` -- expected: exit 0 or 3 with a complete `e2e/out/perf.json`; then `ops/psql.sh` shows no `mapstudio-perf` rows and the dev item count is as before.
