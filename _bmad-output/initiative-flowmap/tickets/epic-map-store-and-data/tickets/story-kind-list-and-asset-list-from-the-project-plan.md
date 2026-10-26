---
title: 'Kind list and asset list from the project'
type: 'feature'
ticket: '3'
created: '2026-10-26'
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
  - '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/story-tracer-one-edit-saved-through-the-write-path-and-read-back-plan.md'
  - '{project-root}/docs/platform-checks.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** After story 1 the setup names `kindsFunction` and `assetsFunction`, but nothing calls them: `map.load` carries no kinds, no assets and no word on whether the host project's lists work, and story 9 (item validation) and story 10 (icon check) have no cache to read.

**Approach:** A Gateway adapter service calls the two project functions the setup names through `getProjectScriptManager` on a bounded pool with a fixed timeout, checks each row against the published kind list and asset contract, caches the result per project, refreshes it on the setup's interval and on demand, logs one line per status change, and adds `kinds`, `assets` and `adapters` (status per list) to `map.load`. The dev project gets a dev adapter whose mode (ok, empty, broken, slow, incomplete) a dev page switches; `docs/kinds-and-assets.md` documents both contracts with two Jython 2.7 example adapters. No migration, no write-path change.

## Boundaries & Constraints

**Always:**
- Build on story 1's contracts unchanged: envelope `v` 1, `CONTRACT_VERSION` "0.2.0-draft", setup v1 fields `kindsFunction`, `assetsFunction`, `refreshIntervalSeconds` (no new setup field), `MapStudio.<area>` loggers, info-only browser console lines.
- Host functions run only on the adapter pool (2 threads, queue 8, daemon threads `MapStudio-adapter-N`), at most one call in flight per project and list, 5 s timeout per call; a call still running at the next tick is skipped, never queued twice.
- Status words are stable kebab-case: `ok`, `empty`, `failing`, `slow`, `incomplete`, `not-configured`, `loading`; every message is plain words naming the function.
- One Gateway log line per status change per project and list (warning into a bad status, info back to `ok`); a status that stays the same logs nothing. No asset or kind row content beyond ids in a log line; host exception text cut to its first line, 200 characters.
- The setup is read from story 1's `SetupRegistry` at every tick, so a changed setup (story 6) applies without a hook into it.
- Example and dev adapters follow Jython 2.7, catch `java.lang.Throwable` and `Exception`, and re-raise so a failure reports `failing`, never `empty`.

**Never:**
- A database migration or a `mapstudio_` table change (caches live in memory); any write-path, role-matrix or `edits.apply` change; validating map item ops against the kind list (story 9); checking icon names (story 10); derived item fields (`basePath`, unlinked reason, unknown kind) in `map.load`; visible adapter UI (epic-editing); `map.changed` (story 4).
- Change `testSet`, `popupView`, the point-click round trip or existing e2e specs; touch `ign-scada-template`.

## I/O & Edge-Case Matrix

| Scenario | Adapter returns | `adapters.<list>` in map.load | Log |
|----------|----------------|-------------------------------|-----|
| Good lists | list of valid dicts | `ok`, count, rows in `kinds`/`assets` | info once on first `ok` |
| Empty | `[]` | `empty`, "The asset function mapstudio_dev.assets returned no assets." | one warning |
| Raises | any exception | `failing`, function and first line of the error | one warning |
| Too slow | no answer in 5 s | `slow`, "did not answer within 5 s" | one warning |
| Bad rows | missing field, wrong type, duplicate id, asset kind not in kind list, base path without `[provider]` | `incomplete`, "2 of 45 assets left out: ..." (first 3 reasons); valid rows kept | one warning |
| Not a list | dict, string, None, Dataset | `failing`, "returned a <type>, expected a list of dicts" | one warning |
| No function in setup | `""` | `not-configured`, "The setup names no kind function." | one info |
| Not loaded yet | first call pending | `loading` | none |
| Recovers | good list again | `ok` | one info "recovered" |

</frozen-after-approval>

## Code Map

Story 1 (planned, not built) owns: `common/.../common/contract/*` (`Setup` with `kindsFunction()`, `assetsFunction()`, `refreshIntervalSeconds()`), `gateway/.../setup/SetupRegistry.java` (per-project setup lookup), `gateway/.../load/MapLoader.java` (`map.load` reply body), `MapStudioGatewayHook.java` (executors, start, shutdown), `MapStudioScriptModule` (abstract) with `gateway/.../script/GatewayScriptModule.java` and `designer/.../DesignerScriptModule.java`, `web/typescript/contract.ts`, `MapStudio.tsx` map.load handling, `docs/contract.md`, `ops/project/com.aoindustrial.perspective.mapstudio/setup/setup.json`, `ops/config/core/**`. Use the names story 1 actually lands; the ones here are from its plan.

- Spike caller to reuse, `git show 51104c8:gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ProjectScriptCheck.java`: way 2 (`runCode("import <module>\n", locals, name)`, then `locals.__finditem__(<top module>)`, walk dotted attributes, `manager.runFunction(callable)`); `JythonExecException.getPyCause()` for the error text. Project modules are not in `getGlobals()` until imported **[live 8.3.10]**.
- `git show 51104c8:ops/project/ignition/script-python/mapstudio_checks/{code.py,resource.json}` -- project library resource shape (`scope "A"`, `hintScope 2`).
- `git show 51104c8:ops/checks/config/core/ignition/tag-definition/default/Checks/unary-resource.json` and `.../tag-provider/default/*` -- seeded tag shape for the dev memory tag.
- `TypeUtilities.pyToGson(PyObject)` **[SDK 8.3.0 javap]** -- convert the result before parsing; parsers work on Gson only.
- `org.python:jython-ia` is in the Gradle cache **[build]**; on the gateway test runtime classpath through `ignition-common` (unverified).
- `MapStudio.tsx` root data attributes (`data-points-loaded`, `data-map-ready`) -- pattern for the new hidden status element; do not add to existing counts.

## Tasks & Acceptance

**Execution:**
- [ ] `common/.../common/contract/{KindList,Kind,FormField,AssetList,Asset,AdapterStatus}.java` (new) -- parse and check rows from Gson into immutable records plus a list of reasons; asset kinds checked against a given kind id set -- shared by gateway, testable without Ignition.
- [ ] `gateway/.../adapter/{AdapterCaller,ProjectFunctionCaller,AdapterService,AdapterSnapshot}.java` (new) -- `AdapterCaller` interface (project, dotted function, timeout) -> Gson or failure; `ProjectFunctionCaller` implements it with way 2 on the pool; `AdapterService` owns the pool and a 1 s scheduler tick that refreshes each project whose interval elapsed, keeps per project and list the snapshot and last status, logs transitions on `MapStudio.adapters`, offers `snapshot(project)` (for `MapLoader`, story 9, story 10) and `refreshNow(project)`.
- [ ] `gateway/.../MapStudioGatewayHook.java` -- create `AdapterService` after `SetupRegistry`, start it, shut it down; pass it where story 1 builds `MapLoader`.
- [ ] `gateway/.../load/MapLoader.java` -- add `kinds`, `assets` (per Open Question 3) and `adapters {kinds, assets}` from `AdapterSnapshot`; nothing else changes.
- [ ] On-demand refresh per Open Question 1 (recommended: `MapStudioScriptModule`, `GatewayScriptModule`, `DesignerScriptModule`, `MapStudioScriptModule.properties` gain `refreshAdapters(project)` returning both statuses; Designer raises "runs in Gateway scope only").
- [ ] `web/typescript/adapters.ts` (new, pure: read `kinds`, `assets`, `adapters` from a map.load body, tolerant of their absence), `web/typescript/MapStudio.tsx` -- keep them in state, render one hidden `.mapstudio-adapter-status` with `data-kinds-status`, `data-kinds-count`, `data-kinds-message` and the same for assets.
- [ ] `ops/project/ignition/script-python/mapstudio_dev/{code.py,resource.json}` (new) -- `kinds()` (ids include `line` and the kind story 1's script point uses, plus `pad`, `geofence`), `assets()` (a few pads with `[default]` base paths), `set_mode(mode)`; mode read from memory tag `[default]MapStudioDev/AdapterMode` (`ok`, `empty`, `broken`, `slow` sleeps 8 s, `incomplete`); `ops/config/core/ignition/tag-definition/default/MapStudioDev/*` (new, plus `tag-provider/default` only if a fresh Gateway lacks it, unverified); `setup.json` -- set the two function names.
- [ ] `ops/project/com.inductiveautomation.perspective/views/MapStudioAdapters/*` (new), `page-config/config.json` (add `/adapters`) -- the map plus one button per mode (session script: `set_mode`, then refresh) and a label with the refresh result.
- [ ] `docs/kinds-and-assets.md` (new: kind list, form fields, label rank, asset contract, status words and messages, refresh and timeout, caller-side rules), `docs/examples/adapters/{udt_instances.py,named_query.py}` (new; `system.tag.browse` of UDT instances and `system.db.execQuery`, both unverified live), one link line in `docs/contract.md`.
- [ ] Tests: `common/src/test/.../contract/{KindListTest,AssetListTest}.java` (every bad-row case), `gateway/src/test/.../adapter/{AdapterServiceTest,ExampleAdaptersCompileTest}.java` (fake caller and clock: each matrix row, one log per change, single flight, last good list per Open Question 2; Jython compiles both examples and the dev adapter), `web/typescript/__tests__/adapters.test.ts`, `e2e/tests/adapters.spec.mjs` (new: each mode then reload shows its status, count and message; ends in `ok`; screenshots `mapstudio-adapters-{ok,failing}-1440.png`).

**Acceptance Criteria:**
- Given the dev stack, when `/adapters` opens, then the status element shows kinds and assets `ok` with the dev counts.
- Given the dev stack, when each mode button is pressed and the page reloads, then the matching status and message show, the Gateway log (`ops/logs.sh | grep MapStudio.adapters`) holds exactly one line per change, and no restart happened.
- Given `slow`, when it is pressed twice within 5 s, then the host function ran once (one dev-adapter log line).

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

Contract additions (0.2.0 draft, in `docs/kinds-and-assets.md`):

```json
{"kinds": [{"id": "pad", "name": "Well pad", "geometry": "point", "icon": "well-pad",
            "labelRank": 10, "fields": [{"key": "operator", "label": "Operator",
            "type": "text", "required": false}]}],
 "assets": [{"id": "P12", "name": "Pad 12", "kind": "pad", "basePath": "[default]Mesa/P12"}],
 "adapters": {"kinds": {"status": "ok", "message": "4 kinds from mapstudio_dev.kinds",
              "function": "mapstudio_dev.kinds", "count": 4, "left": 0,
              "refreshedAt": "2026-10-26T10:00:00Z"}, "assets": {"...": "..."}}}
```

Field `type` is `text|number|integer|boolean|choice` (`choices` required for `choice`); `labelRank` an integer, higher keeps its label longer, default 0; ids at most 64 characters; unknown extra keys ignored. Assets are checked after kinds, so a kind failure makes every asset kind unknown only when no earlier good kind list exists. A timed-out Jython call cannot be killed; its result is discarded and single flight keeps the pool from filling.

## Open Questions

1. **On-demand refresh.** (a) `system.mapstudio.refreshAdapters(project)`: host scripts refresh after their own data changes; touches story 1's four scripting files (recommended). (b) A new `adapters.refresh` message for full editors: epic-editing's tools could use it; touches `Messages`, `contract.ts` and the delegate. (c) Both.
2. **When a refresh fails or is slow.** (a) Keep the last good list and say so in the message ("showing the list from 10:42 UTC"): one bad call does not make every item an unknown kind (recommended). (b) Clear the list: map.load shows exactly what the function gives now.
3. **Assets in `map.load`.** (a) To every level: simplest. (b) Only to `phone` and `full`; viewers get kinds and both statuses: smaller, and tag paths reach only editors, who link items (recommended). Under (b) the e2e page signs in as the dev editor.
4. **Timeout.** (a) Fixed 5 s in the module, documented; setup v1 unchanged (recommended). (b) A setup field `adapterTimeoutSeconds`: a setup schema change that story 6 must also validate and document.

## Verification

**Commands:**
- `./gradlew build` -- expected: green with the new common, gateway and Jest tests.
- `ops/up.sh --fresh`, then `cd e2e && npm test` -- expected: all pass, existing specs unchanged.
- `ops/logs.sh -n 400 | grep MapStudio.adapters` -- expected: one line per status change of the e2e run.
- `git grep -nP '\x{2014}'` -- expected: no match.

**Manual checks:**
- Edit `mapstudio_dev/code.py` to raise, rescan the project, wait one interval: `failing` without a restart (fresh script manager after a scan is unverified; record the result in Implementation Notes).
