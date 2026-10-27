---
title: 'Kind list and asset list from the project'
type: 'feature'
ticket: '3'
created: '2026-10-26'
status: 'built'
baseline_revision: 'bf9737ec5f7bc182fc509c6490ba8a41f61e00ab'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: [quick]
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/story-tracer-one-edit-saved-through-the-write-path-and-read-back-plan.md'
  - '{project-root}/docs/platform-checks.md'
  - '{project-root}/docs/contract.md'
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

**Decisions (owner, 2026-10-26, "approve 2 to 7, recommendations"):**
- On-demand refresh is `system.mapstudio.refreshAdapters(project)` only (no new message type): host scripts refresh after their own data changes; it returns both statuses; in the Designer it raises "runs in Gateway scope only".
- When a refresh fails or is slow, the last good list is kept and the message says so ("showing the list from 10:42 UTC"); an `empty` answer is a real answer and replaces the list.
- `map.load` carries `assets` only to `phone` and `full` sessions; every level gets `kinds` and both statuses. The e2e page signs in as the dev editor.
- The timeout is a fixed 5 s in the module, documented; setup v1 is unchanged.

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

Story 1 is built and merged (its plan's Change Log has the final names). What this story touches or reuses:

- `common/.../common/contract/Setup.java` -- `kindsFunction()`, `assetsFunction()`, `refreshIntervalSeconds()`; unchanged. `MapStudioException(code, message)` is the one refusal type (`toErrorBody()`); the scripting API raises it.
- `gateway/.../setup/SetupRegistry.java` -- per-project setups (`find`, `require`, `put`, `remove`); add a read-only `projects()` (names with a setup) for the tick. Nothing else changes there.
- `gateway/.../MapStudioServices.java` -- wires every part once (`scheduler` for the store, bounded `work` pool 4/64 for delegates, `setups`, `gate`, `loader`, `scriptModule`, `start()`, `stop()`); add the `AdapterService` here (own pool and tick thread), start it in `start()`, stop it in `stop()`, pass it to `MapLoader` and `GatewayScriptModule`. `MapStudioGatewayHook` itself needs no change.
- `gateway/.../load/MapLoader.java` -- `mapLoadReply(project, level)` builds `{level, seq, items}` after `gate.requireReady`; add `kinds`, `assets` (phone and full only) and `adapters` there. `MapLoaderTest` builds it with `new MapLoader(gate, store)`.
- `gateway/.../MapStudioDelegate.java` -- unchanged: `map.load` already runs on the work pool and replies `map.load.reply`; refusals are `error {code, message}`.
- `common/.../MapStudioScriptModule.java` (abstract, `getMapImpl`, `applyEditsImpl`), `gateway/.../script/GatewayScriptModule.java`, `designer/.../DesignerScriptModule.java`, `MapStudioScriptModule.properties` -- add `refreshAdapters` the same way.
- Spike caller to reuse, `git show 51104c8:gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ProjectScriptCheck.java`: way 2 (`runCode("import <module>\n", locals, name)`, then `locals.__finditem__(<top module>)`, walk dotted attributes, `manager.runFunction(callable)`); `JythonExecException.getPyCause()` (`Optional<PyException>`) for the error text; `GatewayContext.getProjectManager().getProjectScriptManager(project)` **[SDK 8.3.0 javap]**. Project modules are not in `getGlobals()` until imported **[live 8.3.10]**. The function name goes into `runCode` text, so it must match a dotted identifier pattern first.
- `git show 51104c8:ops/project/ignition/script-python/mapstudio_checks/{code.py,resource.json}` -- project library resource shape (`scope "A"`, `hintScope 2`).
- `TypeUtilities.pyToGson(PyObject)` **[SDK 8.3.0 javap]** -- convert the result before parsing; parsers work on Gson only.
- `web/typescript/contract.ts` (`readMapLoadReply` keeps only level, seq, items), `web/typescript/messages.ts` (`readReply`), `web/typescript/MapStudio.tsx` (`MapStudioStoreDelegate.onMapLoad`, root `.mapstudio-map` data attributes) -- pattern for the new hidden status element; do not add to existing counts.
- `ops/project/com.inductiveautomation.perspective/views/MapStudioEdit/view.json` -- toolbar, sign-in label and button, the map component, the session-script role check (`MapEditor` from `session.props.auth.user.roles`) to copy for `/adapters`.
- `e2e/tests/fixtures.mjs` -- `editorTest` (fresh sign-in per test, never `signInAsEditor`), `openMap`, `mapLoaded`, `nextFrames`; `e2e/tests/store.spec.mjs` for the screenshot helper. Existing specs unchanged.
- Dev stack: each checkout has its own compose project from `MAPSTUDIO_CONTAINER` in `.env`; `ops/project` is bind-mounted; `ops/logs.sh` reads the Gateway log.

## Tasks & Acceptance

**Execution:**
- [x] `common/.../common/contract/{KindList,Kind,FormField,AssetList,Asset,AdapterStatus}.java` (new) -- parse and check rows from Gson into immutable records plus a list of reasons; asset kinds checked against a given kind id set -- shared by gateway, testable without Ignition.
- [x] `gateway/.../adapter/{AdapterCaller,ProjectFunctionCaller,AdapterService,AdapterSnapshot}.java` (new) -- `AdapterCaller` interface (project, dotted function) -> rows, not-a-list or failure; `ProjectFunctionCaller` implements it with way 2; `AdapterService` owns the adapter pool and a 1 s tick thread, refreshes each project of `SetupRegistry.projects()` whose interval elapsed (kinds first, then assets against the kind ids), keeps per project and list the snapshot and last status, logs transitions on `MapStudio.adapters`, offers `snapshot(project)` (for `MapLoader`, story 9, story 10) and `refreshNow(project)` (joins a call in flight; a refresh asked while a timed-out call still runs starts once that call ends).
- [x] `gateway/.../setup/SetupRegistry.java` -- add `projects()`.
- [x] `gateway/.../MapStudioServices.java` -- create `AdapterService` after `SetupRegistry` with `context.getProjectManager()`, start it in `start()`, stop it in `stop()`; pass it to `MapLoader` and `GatewayScriptModule`.
- [x] `gateway/.../load/MapLoader.java` -- add `kinds`, `assets` (phone and full only) and `adapters {kinds, assets}` from `AdapterSnapshot`; nothing else changes.
- [x] `MapStudioScriptModule`, `GatewayScriptModule`, `DesignerScriptModule`, `MapStudioScriptModule.properties` gain `refreshAdapters(project)` returning both statuses (waits for the calls to settle, at most the timeout plus a margin); Designer raises "runs in Gateway scope only".
- [x] `web/typescript/adapters.ts` (new, pure: read `kinds`, `assets`, `adapters` from a map.load body, tolerant of their absence), `web/typescript/contract.ts` (`MapLoadReplyBody` gains them through that reader), `web/typescript/MapStudio.tsx` -- keep them in state, render one hidden `.mapstudio-adapter-status` with `data-kinds-status`, `data-kinds-count`, `data-kinds-message`, the same for assets, and `data-assets-rows` (rows received).
- [x] `ops/project/ignition/script-python/mapstudio_dev/{code.py,resource.json}` (new) -- `kinds()` (ids include `line` and `pad`, which story 1's browser and script save, plus `geofence`), `assets()` (a few pads with `[default]` base paths), `set_mode(mode)`, `mode()`; mode `ok`, `empty`, `broken`, `slow` (sleeps 8 s), `incomplete`; `setup.json` -- set the two function names.
- [x] `ops/project/com.inductiveautomation.perspective/views/MapStudioAdapters/*` (new), `page-config/config.json` (add `/adapters`) -- sign-in label and button, one button per mode (session script, `MapEditor` only: `set_mode`, then `refreshAdapters`), a label with the refresh result, and the map.
- [x] `docs/kinds-and-assets.md` (new: kind list, form fields, label rank, asset contract, status words and messages, refresh and timeout, caller-side rules), `docs/examples/adapters/{udt_instances.py,named_query.py}` (new; `system.tag.browse` of UDT instances and `system.db.execQuery`, both unverified live), `docs/contract.md` (map.load body, `refreshAdapters`, link line).
- [x] Tests: `common/src/test/.../contract/{KindListTest,AssetListTest}.java` (every bad-row case), `gateway/src/test/.../adapter/{AdapterServiceTest,ExampleAdaptersCompileTest}.java` (fake caller and clock: each matrix row, one log per change, single flight, last good list; Jython compiles both examples and the dev adapter), `MapLoaderTest` (kinds and statuses for every level, assets only for phone and full), `web/typescript/__tests__/adapters.test.ts`, `e2e/tests/adapters.spec.mjs` (new, `editorTest`: each mode then reload shows its status, count and message; ends in `ok`; a viewer gets the statuses and no asset rows; screenshots `mapstudio-adapters-{ok,failing}-1440.png`).

**Acceptance Criteria:**
- Given the dev stack, when `/adapters` opens, then the status element shows kinds and assets `ok` with the dev counts.
- Given the dev stack, when each mode button is pressed and the page reloads, then the matching status and message show, the Gateway log (`ops/logs.sh | grep MapStudio.adapters`) holds exactly one line per change, and no restart happened.
- Given `slow`, when it is pressed twice within 5 s, then the host function ran once (one dev-adapter log line).

## Implementation Notes

Implemented directly in the planning session (no implementation subagent was available), 2026-10-26 to 27, on the `ms-e2s3` dev Gateway (port 9123, `inductiveautomation/ignition:8.3.10`, `postgres:16-alpine`), on top of story 1 merged from `ccr-3c8b84b9-f1vbsm`.

- **Live facts** (recorded in `docs/platform-checks.md`, "Epic 2 story 3"): way 2 runs on the adapter pool and a Python error comes back as `JythonExecException` with type and message; a function sleeping 8 s goes `slow` at 5 s and its thread ends later; two `refreshAdapters` from two sessions one second apart ran each dev function once; an edited `mapstudio_dev.kinds` plus a project scan (`POST /data/api/v1/scan/projects`) was `failing` at the next refresh and "recovered" after the revert and a second scan, with no restart (the manual check of the Verification section); `system.util.getGlobals()` is shared between a session script and the functions the module calls; a fresh 8.3.10 Gateway has only the `System` tag provider; the log shows `MapStudio.adapters` as `M.adapters`.
- **Gateway log of one e2e run** (`ops/logs.sh | grep M.adapters`): one line per change and nothing else: info "3 kinds"/"4 assets" at start, warnings into incomplete, failing ("Showing the list from 00:11 UTC"), empty and slow, info "recovered" back to ok **[live 8.3.10]**.
- **Runs and results:**
  - `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build`: green; Java 81 tests (common 14: contract 8, kind list 3, asset list 3; gateway 67: adapter service 18, example adapters and caller 5, map loader 4, story 1's 40 unchanged), Jest 47 (8 suites, `adapters.test.ts` 5 new).
  - `ops/up.sh --fresh` then `cd e2e && npm test` (Playwright 1.63.0): 19 of 19, the 16 existing tests unchanged and passing, `adapters.spec.mjs` 3 new; the teardown found no password in `e2e/out`. The same spec alone passed 3 of 3 on the kept volume before.
  - Gateway log of the fresh run: one `M.adapters` line per status change, as listed above; no Map Studio warning or error except story 1's expected "Project no-such-project has no Map Studio setup" from its script checks.
  - No generated secret (admin and editor passwords, PostgreSQL password, API key) in either container's log or in any tracked or new file (a scratch script counted occurrences without printing them). `git grep` for an em dash over the changed files: none.
  - Matrix audit: every row of the I/O matrix has a passing `AdapterServiceTest` case (good, empty, raises, slow, bad rows, not a list, not configured, loading, recovers), and the e2e test covers good, empty, raises, slow, bad rows and recovers live.
- **After the quick lens review (2026-10-27):** `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build` green, Java 87 tests (common 15, gateway 72: adapter service 22, map loader 5), Jest 47 of 47 (8 suites); `ops/up.sh` on `ms-e2s3` then `cd e2e && npm test`: 19 of 19, teardown found no password in `e2e/out`. No em dash in the changed files.
- **Not run:** the two example adapters on a live Gateway (compiled under Jython 2.7 only; marked unverified in the docs); Designer autocomplete of `refreshAdapters` (owner, optional).

## Plan Change Log

**Approval and story 1's final names, 2026-10-26 (not a review loopback).** The owner approved this plan with the recommended answer to every Open Question ("approve 2 to 7, recommendations"); the answers are the Decisions in the frozen block. Story 1 was merged into this branch (`ccr-3c8b84b9-f1vbsm`) and the Code Map and tasks now use its built names: `MapStudioServices` (not the hook) wires the parts, `SetupRegistry` gains `projects()`, `MapStudioException` is the refusal, replies are `map.load.reply`, editor e2e tests use `editorTest`. The kinds `pad` and `line` are the ones story 1 saves.

**Implementation deviations, 2026-10-27 (not a review loopback).** Later entries read these:

- *Parsers:* no `KindList` or `AssetList` classes: `Kind.parseList(JsonArray)` and `Asset.parseList(JsonArray, Set<String> kindIds)` return `Parsed<T>(kept, reasons, total)`; `Rows` (package-private) holds the readers. `AdapterStatus` is a record in `common/.../contract/` with the status word constants.
- *Reasons carry ids only:* a reason names the row (`row 5 (id P99)`) and the key at fault, never a value ("geometry must be point or line", "basePath does not start with a [provider]"), so map.load messages and log lines hold no tag path or other row content, for viewers too.
- *Adapter service API (for stories 9 and 10):* `AdapterService.snapshot(project)` gives `AdapterSnapshot(kinds, assets, kindsStatus, assetsStatus)`, never blocking; `refreshNow(project)` gives a future of it. `MapLoader` takes a `Function<String, AdapterSnapshot>` as its third constructor argument. `MapStudioServices.adapters` is the instance.
- *A full adapter pool* reports `slow` with "Map Studio is busy calling other project functions ..." (no new status word).
- *A refresh asked for while a timed-out call still runs* waits for that call to end and then makes one new call (never more than one waiting); a tick never waits.
- *No kind function:* every asset is left out (its kind is not in an empty kind list), as for a kind list that never loaded.
- *Dev adapter mode:* kept in `system.util.getGlobals()`, not a memory tag: a fresh 8.3.10 Gateway has no `default` tag provider, and seeding one was not needed. No `ops/config/core` change.
- *Dev page:* besides one button per mode, a "Refresh lists" button (refresh only), and the result label carries the dev adapter's own call counts since the last mode change; the e2e test uses them for criterion 3 (single flight) instead of counting log lines. The dev setup's `refreshIntervalSeconds` is 30 (was 10), so a timed refresh does not cross that test's two overlapping refreshes.
- *Browser:* `MapLoadReplyBody` gained `lists: HostLists` (`adapters.ts`); the hidden status element also carries `data-kinds-rows`.
- *Story 1 files changed:* `SetupRegistry` (`projects()`), `MapStudioServices` (wiring), `MapLoader` (constructor and reply), `MapLoaderTest`, the scripting module trio and its `.properties`, `web/typescript/contract.ts`, `MapStudio.tsx`, `__tests__/contract.test.ts` (expected body), `setup.json` (function names, interval 30), `page-config/config.json`, `docs/contract.md`, `docs/platform-checks.md`.

**Quick lens review, 2026-10-27 (review loopback, iteration 0).** Patches for the findings in the Review Triage Log; later entries read these:

- *Locking:* no code holds both list monitors. A call's `settled` future and a list's `pending` future are completed only after the list monitor is left (the timeout task, `finish`), and the kind ids for an asset check are read before the asset monitor is entered. A rejected call still completes its new future under the monitor (nothing depends on it yet).
- *Echoed row values:* `Rows.echo` cuts an echoed `id`, `kind` or field `key` to 64 characters plus "..." and turns every control character and line or paragraph separator into `?`; `firstLine` does the same for exception text (200 characters).
- *Viewer messages (contract change):* `AdapterStatus` gained a seventh component, `viewerMessage` (a six-argument constructor keeps `viewerMessage = message`). `map.load` at level `none` sends it in `message`: `failing` without the host's error text ("The kind function X failed."), `incomplete` without the row reasons ("2 of 6 assets from X left out."), with "Showing the list from ..." when it applies. `phone`, `full`, `refreshAdapters` and the Gateway log keep the full message. `AdapterSnapshot.statusJson(boolean detail)` and `AdapterStatus.toJson(boolean detail)` carry the choice; no new JSON key.
- *`refreshAdapters` wait:* at most 21 s (four timeouts and 1 s: kinds then assets, each may wait for a timed-out call to end and then time out itself), `GatewayScriptModule.refreshWait`; documented in `docs/contract.md` and `docs/kinds-and-assets.md`, with the advice to call it from a session or Gateway script, not a binding or tag event.
- *Dev adapter:* every `system.util.getGlobals()` read goes through `_globals`, which catches `java.lang.Throwable` and `Exception`, logs the class name and re-raises; `mode()` no longer reports `ok` on a failed read.
- *Example adapters:* the UDT example's asset id is the instance path below `ROOT` (unique across folders); both examples use `unicode()` for text, and a NULL column stays `None` so the row is left out with a reason.

## Review Triage Log

**Quick lens, context-free, 2026-10-27 (iteration 0).** Seven findings; all patched, none rejected. Build, Jest and e2e re-run after the patches: green (see Implementation Notes).

| # | Finding | Severity | Decision | Where |
| --- | --- | --- | --- | --- |
| 1 | Lock-order inversion between the kind and asset monitors: a settling kind call ran the asset step under the kind monitor while an answering asset call asked for the kind ids under the asset monitor | High | Patched: futures completed outside the monitors, kind ids read before the asset monitor; tests `aKindCallSettlingWhileAnAssetCallAnswersDoesNotDeadlock`, `manyOverlappingRefreshesAllSettle` | `AdapterService`, `AdapterServiceTest` |
| 2 | Reasons and log lines echo raw `kind` (any length) and ids with control characters | Low | Patched: `Rows.echo` (64 characters, control characters to `?`) for ids, kinds and field keys; `firstLine` filters control characters; tests `reasonsEchoIdsAndKindsAsOneShortLine`, `errorTextIsOneLineInTheLog` | `Rows`, `Asset`, `Kind`, `FormField`, `AdapterService`, `docs/kinds-and-assets.md` |
| 3 | Host exception text reaches sessions at level `none` | Low | Patched: viewer messages at level `none` (no error text, no row reasons); tests `aViewerMessageHasNoHostErrorTextAndNoRowReasons`, `aViewerGetsTheStatusWithoutTheHostErrorText` | `AdapterStatus`, `AdapterSnapshot`, `MapLoader`, `docs/contract.md`, `docs/kinds-and-assets.md` |
| 4 | `refreshAdapters` waits 21 s, more than planned, unrecorded | Low | Patched by recording: the bound kept (four timeouts are reachable), named `refreshWait`, documented with the advice on where to call it | `GatewayScriptModule`, Change Log, `docs/contract.md`, `docs/kinds-and-assets.md` |
| 5 | Dev adapter `system.util.getGlobals()` calls without both handlers; `mode()` swallowed a failure as `ok` | Low | Patched: `_globals` catches both, logs the class name, re-raises | `ops/project/.../mapstudio_dev/code.py` |
| 6 | Example adapters: duplicate ids across folders, `str()` on non-ASCII text, NULL id as `'None'` | Low | Patched: id is the path below `ROOT`, `unicode()` for text, NULL stays `None` (row left out with a reason) | `docs/examples/adapters/udt_instances.py`, `named_query.py` |
| 7 | The late-answer test did not check that nothing more is logged | Low | Patched: asserts the log line count is unchanged; overlap tests added for finding 1 | `AdapterServiceTest` |

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

Field `type` is `text|number|integer|boolean|choice` (`choices` required for `choice`); `labelRank` an integer, higher keeps its label longer, default 0; ids at most 64 characters; unknown extra keys ignored. Assets are checked after kinds, against the last good kind list, so a kind failure makes every asset kind unknown only when no earlier good kind list exists. A timed-out Jython call cannot be killed; its result is discarded and single flight keeps the pool from filling.

## Verification

**Commands:**
- `./gradlew build` -- expected: green with the new common, gateway and Jest tests.
- `ops/up.sh --fresh`, then `cd e2e && npm test` -- expected: all pass, existing specs unchanged.
- `ops/logs.sh -n 400 | grep M.adapters` (the log abbreviates `MapStudio.adapters`) -- expected: one line per status change of the e2e run.
- `git grep -nP '\x{2014}'` -- expected: no match.

**Manual checks:**
- Edit `mapstudio_dev/code.py` to raise, rescan the project, wait one interval: `failing` without a restart (fresh script manager after a scan is unverified; record the result in Implementation Notes).
