---
title: 'Setup: validation, live change and docs'
type: 'feature'
ticket: '6'
created: '2026-10-26'
status: 'built'
baseline_revision: '61a0279cda46677b55a0b3e861c4be1bdb0b3903'
route: 'full'
route_source: 'pinned'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/story-tracer-one-edit-saved-through-the-write-path-and-read-back-plan.md'
  - '{project-root}/docs/platform-checks.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Story 1 reads the project setup once at project start and only checks that it parses: a wrong field gives no plain-words reason, and a changed setup needs a Gateway restart. The `onResourcesModified` path that would apply a change live was never seen to fire (docs/platform-checks.md check 4, `[not verified]`; spike report item 3, owner skipped).

**Approach:** On top of story 1's setup loader (`SetupLifecycle`, `SetupRegistry`, `common` `Setup`), validate every field of setup v1 and collect every problem as one plain-words reason; keep one setup state per project (valid, invalid with reasons, missing) that `map.load`, the write service and the scripting API read on every call; re-read the resource on created, modified and deleted after proving live that a project scan reaches `onResourcesModified`; publish the setup schema in `docs/setup.md` with an example. Live proof first; no other code is built on the modified path before it is seen.

## Boundaries & Constraints

**Always:**
- Story 1's contracts are fixed: setup v1 fields and `schemaVersion: 1`, error codes (a bad or missing setup is `store-unreachable` with the reason as `message`), envelope, ops, migration 1. This story changes no message type and adds no error code.
- Every problem names its field and says what is wrong in plain words (`refreshIntervalSeconds must be a whole number from 1 to 3600, not "ten"`); all problems reported together.
- One warning per project per setup read that is bad (at start and at each change), on logger `MapStudio.setup`, naming the project and the reasons; one info line when a changed setup applies. Never log a secret value.
- Setup state is read per call, never cached in the write service, `MapLoader` or the script module, so a change applies at the next `map.load`, `edits.apply` or `applyEdits`.
- Every SDK behaviour not seen live marked unverified in comments and docs. No em dashes.

**Never:**
- A database migration (none needed), a Designer editor (entry 7), kind or asset function calls or their cache (entry 3), pushing a setup change to open maps (entry 4, `map.changed`), store states beyond reading the connection name (entry 5), role matrix changes (entry 2).
- Touch `testSet`, `popupView`, existing e2e specs, or `ign-scada-template`.
- A Gateway-wide module setting, or a JSON Schema library dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid setup | v1, all fields good | state valid; `map.load` works | none |
| Bad field | `refreshIntervalSeconds: "ten"` | state invalid; one warning | `map.load` `store-unreachable`, message names the field |
| Several bad fields | bad `basemaps` and `roles.full` not a list | one reason listing both | as above |
| Not JSON | truncated `setup.json` | state invalid | "setup.json is not valid JSON (line L, column C)" |
| Resource without `setup.json` | `resource.json` only | state invalid | "setup.json is missing from the setup resource" |
| Newer schema | `schemaVersion: 2` | state invalid | "written for a newer Map Studio (schema 2; this module reads 1)" |
| Setup deleted | resource removed, project scanned | state missing | story 1's missing-setup warning and reason |
| Roles changed | `roles.full` edited, project scanned | next `map.load` level follows, no restart | none |
| Fixed after invalid | good file, scanned | state valid; info line; `map.load` works | none |
| Connection changed | `connection` renamed to another valid one | next call uses it (story 1's lazy per-connection migrate) | missing connection as story 1 |

## Decisions (owner, "approve 2 to 7, recommendations", 2026-10-26)

1. Only `schemaVersion` and `connection` are required; every other field defaults (`roles` both empty, so nobody edits; functions `""`; `refreshIntervalSeconds` 10; `alarmPage` `""`; `basemaps` `["none", "osm"]`; `tokenSecret` `""`).
2. An unknown field makes the setup invalid, with a "did you mean" hint when a known field is close; any new field bumps `schemaVersion`.
3. `refreshIntervalSeconds` is a whole number from 1 to 3600.
4. A bad change on a running project makes its store unavailable until fixed (R12): every open map loses editing at its next call; the last good setup is not kept.
5. `map.load.reply` gains an optional `setup: {refreshIntervalSeconds, basemaps, alarmPage}` (additive, 0.2.0 draft), and the component carries `data-refresh-interval`.
6. `setup.spec.mjs` edits the dev `setup.json` and restores it (finally block, plus recovery in the global setup); no second dev project.

</frozen-after-approval>

## Code Map

Story 1 is built and merged (`ccr-3c8b84b9-f1vbsm`, baseline above); names below are the built ones (its plan's Change Log). Paths under `common/src/main/java/com/aoindustrial/perspective/mapstudio/common/` (`common/...`) and `gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/` (`gateway/...`).
- `common/.../contract/Setup.java` -- `parse(String)` throws `Setup.SetupException` on the first problem. Add `Setup.read(String)` returning every `SetupProblem`; `parse` keeps its signature and throws with `describe(problems)`. Entry 7's Designer form calls `read`, not its own rules. Callers: `SetupLifecycle`, tests (`ContractTest`, `MapLoaderTest`, `WriteServiceTest`, `RoleMatrixTest`).
- Strict JSON: `common.gson.internal.Streams.parse` on a non-lenient `JsonReader` (`JsonParser.parseString` is lenient), so "line L, column C" is real.
- `gateway/.../setup/SetupLifecycleFactory.java` -- unchanged.
- `gateway/.../setup/SetupLifecycle.java` -- already overrides `onResourcesCreated/Modified/Deleted` and re-reads (never seen firing). Move the reading into package-private static methods so `SetupLifecycleTest` drives them with `Resource.newBuilder()` resources (no Mockito in the build).
- `gateway/.../setup/SetupRegistry.java` -- today two maps (`setups`, `problems`) and `warnOnce` at first use (`require`). Replace with one `SetupState` per project; keep `put`, `putProblem`, `remove`, `find`, `require`, `warnOnce` signatures (used by `StoreGate`, `MapStudioDelegate`, tests). `putProblem` warns at once (the project has a setup resource, so it uses Map Studio) and marks the project warned, so `require` does not warn twice; a missing setup keeps story 1's warning at first use. The constructor's `Consumer<Setup>` (store registry `ensure`) stays; listeners are added with `addListener`.
- `gateway/.../store/StoreGate.java`, `load/MapLoader.java`, `write/WriteService.java`, `script/GatewayScriptModule.java`, `MapStudioDelegate.storeReply` -- every call goes through `StoreGate.requireReady` or `setups.find`, per call; no cache. `StoreRegistry` caches per connection, not per project, so a renamed connection is `ensure`d by the `put` consumer. Only `MapLoader.mapLoadReply` changes (adds `setup`).
- `common/.../Messages.java` (map.load.reply comment), `web/typescript/contract.ts` (`MapLoadReplyBody.setup?`, `readMapLoadReply`), `web/typescript/MapStudio.tsx` (delegate keeps `refreshIntervalSeconds`; `data-refresh-interval` on `.mapstudio-map`); the failed load already shows `.mapstudio-load-status` "Map store: code: message".
- `docs/contract.md` -- setup section becomes a link to `docs/setup.md`; map.load.reply gains `setup`. `docs/platform-checks.md` check 4 says `onResourcesModified` is not verified.
- Spike evidence: `git show 51104c8:gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ChecksLifecycle.java`.
- Dev stack: `ops/project` is bind-mounted as `mapstudio-dev`; `ops/secrets/api-token` holds `X-Ignition-API-Token` (`ops/gen_secrets.py`, used by `ops/users.py`); `ops/lib.sh` gives `GATEWAY_URL` and the compose project `MAPSTUDIO_CONTAINER`.
- e2e: `e2e/playwright.config.mjs` (`workers: 1`), `editorTest`, `openMap`, `mapLoaded` from `e2e/tests/fixtures.mjs`; `e2e/lib/env.mjs` (`repoRoot`, `gatewayUrl`, `screenshotDir`); `e2e/global-setup.mjs`.

## Tasks & Acceptance

**Execution:**
- [x] Proof first: `SetupLifecycle.java` logs at info on `onResourcesModified` in `MapStudio.setup`; `ops/scan.sh` (new) posts `POST /data/api/v1/scan/projects` with the story 1 api-token (endpoint [IA docs], unverified on 8.3.10). Edit the dev `setup.json`, run `ops/scan.sh`, and record in `docs/platform-checks.md` a new section "Epic 2 story 6 - setup change on a live Gateway" (which hook fired, delay after the scan, whether a file edit alone fires it). Fallback if no hook fires: `MapLoader` re-reads the resource from the project manager when its signature changed (SDK call unverified; record which one worked).
- [x] `common/.../contract/SetupProblem.java` (new, `field`, `message`), `common/.../contract/Setup.java` -- rules in Design Notes; `Setup.describe(List<SetupProblem>)` joins them into one sentence list.
- [x] `gateway/.../setup/SetupState.java` (new: `valid(Setup)`, `invalid(String reason)`, `missing()`), `gateway/.../setup/SetupChangeListener.java` (new), `SetupRegistry.java`, `SetupLifecycle.java` (story 1's existing overrides) -- created, modified and deleted re-read and replace the state; warn or info lines as in Always; listeners called after the swap, exceptions caught and logged.
- [x] `gateway/.../load/MapLoader.java` and the other s1 readers -- invalid state gives `store-unreachable` with the reason; per-call reads verified by test.
- [x] `docs/setup.md` (new) -- every field, type, default, rule and example message; a full example; how to change it (edit and scan, or Designer save once entry 7 lands); that open maps see a change on their next load; semantic versioning of the schema; unverified marks. `docs/contract.md`, `docs/architecture.md` (link).
- [x] `e2e/lib/gateway.mjs` (new: `scanProject()`, reads the token file, never prints it), `e2e/tests/setup.spec.mjs` (new), `e2e/global-setup.mjs` (restore the dev setup from `e2e/out/setup.json.bak` if a crashed run left one) -- signed in as `mapeditor`: level `full`; set `roles.full` to `["Nobody"]`, `roles.phone` to `["MapEditor"]`, `refreshIntervalSeconds` 30, scan, reload until level `phone` and interval 30 (30 s cap); write `"ten"`, scan, the component shows the reason naming `refreshIntervalSeconds`; restore, scan, level `full`. Screenshots `mapstudio-setup-invalid-{1440,390}.png`.
- [x] Unit tests: `common/src/test/.../contract/SetupValidationTest.java` (every matrix input and every rule), `gateway/src/test/.../setup/{SetupLifecycleTest,SetupRegistryTest}.java` (state swaps, one warning per bad read, listener isolation, `MapLoader` sees a change with no restart).

**Acceptance Criteria:**
- Given the dev stack running, when the dev `setup.json` changes roles and refresh interval and `ops/scan.sh` runs, then the next `map.load` shows the new level and interval and the Gateway uptime did not reset.
- Given a setup with a bad field, when the project is scanned, then the Gateway log has exactly one `MapStudio.setup` warning naming `mapstudio-dev` and the field, and `map.load` replies `store-unreachable` with the same words.
- Given the e2e suite has run, when `git status --porcelain ops/project` runs, then it prints nothing.

## Implementation Notes

Story 1 merged (`git merge ccr-3c8b84b9-f1vbsm`, 2026-10-27); `baseline_revision` is that merge. Names follow the built code (Code Map).

## Plan Change Log

- 2026-10-27: Story 1 merged; Code Map rewritten to its built names (`MapStudioException`, `map.load.reply`, `StoreGate`, existing `onResources*` overrides, `editorTest`, per-checkout compose project). Owner's answers (2026-10-26, all recommendations) recorded as Decisions; Open Questions removed; status in-progress. Not a scope change.

- 2026-10-27, implementation deviations (not a loopback): the proof needed no fallback (scan reaches `onResourcesModified`, `onResourcesCreated` and `onResourcesDeleted`, recorded in `docs/platform-checks.md`). `SetupRegistry` gained `deleted(project)` (logs the removal; `remove` stays the quiet project-stop path), `state(project)`, `put`/`putProblem` overloads with a `cause` naming the hook for the log line, and a `SetupRegistry.Log` seam (default the Gateway logger) so tests count warnings. `Setup.read` returns `Setup.Reading(setup, problems)`; `parse` keeps its signature. The warning reads "The Map Studio setup of project P (read on resource modified) cannot be read: <reason>"; `map.load` carries the same reason without the hook. Story 1's `ContractTest` assertion on the schema 2 message changed to the new words. The 390 px test runs as the viewer and also proves the not-JSON message; screenshots go to `e2e/out/screenshots` (to `docs/screenshots` only with `E2E_DOCS=1`, as story 1's). `README.md` names `ops/scan.sh` and `docs/setup.md`.

## Review Triage Log

Pass 1 (quick lens, context-free, 2026-10-27; the reviewer had the plan, the rules and the diff, and ran `./gradlew --offline :common:test :gateway:test` green): high 0, medium 1, low 6, false 0. Patched 7, rejected 0. Security, SQL, Jython and em dashes: nothing found.

| # | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|
| 1 | The delegate read the setup twice per call (`setups.find` for the level, then `requireReady` in `MapLoader` or `WriteService`), so a scan in between could check a batch against a level from the old setup, or send a level from setup A with the `setup` block of setup B | medium | patch | `MapLoader.mapLoadReply` and `WriteService.apply` gained a `Function<Setup, String> levelOf` overload that works out the level from the one setup `requireReady` returns; `MapStudioDelegate.storeReply(loader, writes, view, ...)` passes `setup -> RoleMatrix.level(setup, roles)` and no longer reads `setups`. The `String level` overloads stay for scripts and tests. `StoreReplyPerCallTest.aScanDuringACallNeverMixesTwoSetups` changes the setup mid-call and gets level and refresh interval both from the old setup, then both from the new one. |
| 2 | The once-only warning flag was not swapped with the state: `putProblem` marked warned after the swap, `put` cleared it before, so a racing `require` could log a second warning for one bad read | low | patch | `SetupRegistry` now keeps one `Entry(state, warned)` per project, swapped whole; `putProblem` stores the invalid state already warned; `require` never warns for an invalid state (the read did) and marks a missing project warned with `ConcurrentHashMap.compute`. `warnOnce` keeps its own key set for the store gate's project and connection key. Tests: `callsRacingScansNeverWarnTwiceForOneBadRead` (200 bad reads against four calling threads: exactly 200 warnings) and `aMissingSetupWarnsOnceUnderConcurrentCalls`. |
| 3 | `strictParse` let a duplicate key through, last value wins | low | patch | `Setup.read` walks the text with the streaming `JsonReader` (`duplicateKeys`) and reports `X is set twice` once per key at any depth (`roles.full is set twice`). `SetupValidationTest.aFieldSetTwiceIsAProblemNeverASilentChoice` covers the reviewer's `"ten"` then `10` case, a nested key set three times and two fields at once; `docs/setup.md` already says every problem is reported. |
| 4 | Restoring the setup was fragile: the backup was deleted before the scan, and the global setup restored only after the Gateway checks passed | low | patch | `restoreSetup()` keeps the backup; `putBackSetup()` restores, scans and only then calls `forgetSetupBackup()`. The global setup restores the file first (so `ops/project` is clean even with the Gateway down) and scans and drops the backup after the Gateway and bundle checks. |
| 5 | The tests checked less than they claimed: no uptime or module start check, no automated one-warning check, no delegate or script module per-call test | low | patch | `setup.spec` records `gatewayRun()` (uptime from `GET /data/api/v1/overview`, the module's `startupTime` from `GET /data/api/v1/modules/healthy`, both seen live on 8.3.10) before and after and expects the uptime to grow and the start time to stay. It also reads `GET /data/api/v1/logs?logger=MapStudio.setup` after the bad read and three map.loads and expects exactly one warning for `mapstudio-dev`, naming the field. New `StoreReplyPerCallTest` (delegate `storeReply`, map.load and edits.apply before and after `setups.put`) and `GatewayScriptModuleTest` (`getMapImpl` and `applyEditsImpl` follow a changed connection, an invalid setup and its fix). `MapLoaderTest` now takes the level through the loader. `gateway/build.gradle.kts` sets `python.cachedir.skip` for tests, so the Jython the script module test starts writes no package cache into the checkout. |
| 6 | `ops/scan.sh` exited at curl's own error when the Gateway was not reachable (`set -e`), so the planned line never printed | low | patch | `status="$(... || true)"` with curl's stderr dropped; an empty or `000` status prints "Gateway not reachable at ${GATEWAY_URL}; start it with ops/up.sh." and exits 1 (checked with the same block against port 1). |
| 7 | `docs/contract.md`'s `store-unreachable` row did not name a setup that cannot be read | low | patch | The row now says "its setup cannot be read (the reason lists every problem, `docs/setup.md`)". |

After the patches: `./gradlew clean build` green (common 22 tests, gateway 61, Jest 43 of 43); `ops/up.sh` on `ms-e2s6` (port 9126) then `cd e2e && npm test` 18 of 18; `git status --porcelain ops/project` empty; no em dash in the changed files.

## Design Notes

**Rules (setup v1).** `schemaVersion` 1 (higher: newer-module reason; else invalid). `connection` non-empty string. `roles` object with `full` and `phone`, each a list of non-empty strings, no duplicates. `kindsFunction`, `assetsFunction` empty or a dotted Python name (`^[A-Za-z_]\w*(\.[A-Za-z_]\w*)+$`). `refreshIntervalSeconds` whole number 1 to 3600 (Decision 3). `alarmPage` empty or starting with `/`. `basemaps` non-empty list from `none`, `osm`, `satellite`, `mapbox`, no duplicates. `tokenSecret` string (a secret name, never a value). Required fields, defaults and unknown fields per Decisions 1 and 2. A field value is quoted in a message, except `tokenSecret` and unknown fields' values, which are never echoed.

**Why `store-unreachable`:** story 1 already maps a missing setup to it; one code keeps entries 3 to 8 from handling a fourth store state.

## Verification

**Commands:**
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build` -- expected: green, the new common and gateway tests included.
- `ops/up.sh` then `cd e2e && npm test` -- expected: all pass, existing specs unchanged.
- `ops/logs.sh -n 400 | grep MapStudio.setup` -- expected: the proof line, one warning per bad read, one info per applied change, no secret.
- `git grep -nP '\x{2014}'` and `git status --porcelain ops/project` -- expected: nothing.

**Manual checks (if no CLI):**
- The new `docs/platform-checks.md` section and the two `mapstudio-setup-invalid` screenshots, readable at 390 px.
