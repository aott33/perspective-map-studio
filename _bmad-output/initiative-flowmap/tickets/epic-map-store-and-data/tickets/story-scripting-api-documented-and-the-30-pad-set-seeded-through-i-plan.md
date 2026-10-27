---
title: 'Scripting API documented, and the 30-pad set seeded through it'
type: 'feature'
ticket: '11'
created: '2026-10-27'
status: 'built'
baseline_revision: 'da7e3db88005000e763f56605156e597902944a3'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/docs/contract.md'
  - '{project-root}/docs/kinds-and-assets.md'
  - '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/story-kind-setups-in-the-map-store-and-items-checked-against-the-k-plan.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `system.mapstudio.getMap` and `applyEdits` are documented only in part (the `.properties` docs miss deletes, kind setups, attachments, errors and the re-run rule, and contract.md's example says a re-run is refused), and the dev map still draws the spike-only `testSet` data instead of the map store (epic R13, R14, R15; AD-18, AD-22; deferred-work story 7 entry).

**Approach:** Document the scripting API fully (Designer autocomplete text and docs/contract.md); add a Jython 2.7 dev seed library that writes the 30-pad set and the tracer's points into `mapstudio-dev`'s map store through `applyEdits` with UUIDv5 ids, safe to re-run; remove `testSet`, its stand-in data and the Scale view, so the component draws, clicks and measures store items only.

## Boundaries & Constraints

**Always:** One batch per seed run, all or none, actor `seed-script`. Ids are UUIDv5 (`uuid.NAMESPACE_URL`, name `mapstudio-dev/seed/<set>/<key>`), so a re-run updates. Seed items are valid against the dev kind list (`pad` with `status: producing`, `line`). Coordinates are the current `scaleData.ts` and `testData.ts` output frozen as 6-decimal literals. Jython 2.7: no f-strings, `%` or `.format`, `import java.lang` and catch `java.lang.Throwable` then `Exception`, no `import system`, logger not print. `popupView` stays (epic: must not change; epic-viewing replaces it). No em dashes. Contract stays 0.2.0 draft; every claim not seen live is marked [unverified].

**Never:** No instruments in the seed (frame rates stay comparable with epic 1's 30 circles and 30 lines; a tap needs a Turf-computed point Jython cannot make). No SQL seeding. No migration. No new message type or prop.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Error |
|---|---|---|---|
| First run | none of the 64 seed ids stored | one batch of 64 creates at `baseVersion` 0; result `{created: 64, updated: 0, restored: 0, unchanged: 0, seq}` | none |
| Re-run, unchanged | all stored, equal on kind, name, geometry, properties | no batch sent; `{unchanged: 64, seq: null}` | none |
| Re-run, edited | pad 7 renamed by an editor (v3) | one `update` at `baseVersion` 3 with the seed's kind, name, geometry, properties | none |
| Re-run, deleted | pad 7 is a tombstone (v4) | `create` at 0 refused `conflict`; seed re-sends that op as `create` at 4 (restore) | none |
| Concurrent edit | an item changes between `getMap` and `applyEdits` | nothing written; result `{error: "conflict: ..."}` logged; next run succeeds | reported, not retried |
| Kind list down | dev adapter `broken` | nothing written | `{error: "invalid: The kind list is not available ..."}` |
| Not a map editor | /edit button, user without `MapEditor` | nothing called | refused text, as the script checks |

</frozen-after-approval>

## Code Map

- `common/.../MapStudioScriptModule.java`, `common/src/main/resources/.../MapStudioScriptModule.properties` -- `@JythonElement` methods documented through `PropertiesFileDocProvider` (registered in `MapStudioGatewayHook:44`, `MapStudioDesignerHook:81`); the text is the deliverable, signatures unchanged.
- `gateway/.../script/GatewayScriptModule.java`, `MapList.java` -- behaviour to document: actor blank or batch null `invalid`; `getMap` leaves tombstones out and answers `.readOnly`, `.kindSetups`; refusals are `MapStudioException` with `code()`, `plainMessage()`, `conflicts()` (Gson `JsonArray` of `{index, entity, id, baseVersion, current, changedBy, changedAt}`).
- `common/.../contract/MapStudioException.java` -- `conflicts()` is how the seed finds a tombstone's version (Open Question 1).
- `docs/contract.md` "The scripting API (AD-18)" -- rewrite; its example's "re-run is refused" paragraph is the bug.
- `ops/project/ignition/script-python/mapstudio_dev/code.py` -- dev kinds `pad` (required `status` choice: required fields are not enforced at save, story 9 Decision 5, but present ones are typed) and `line`; pattern for the new library and its `resource.json`.
- `ops/project/.../views/MapStudioEdit/view.json` "Run script checks" -- the MapEditor gate and JSON-to-label pattern the seed button copies.
- `web/typescript/testSet.ts`, `scaleData.ts`, `testData.ts` and their two tests -- removed; `MapStudio.tsx` lines 45, 67-77, 450-453, 474, 504-540 (test sources and layers), 589-592 (click and hover on `LAYER_POINTS`), 774-791 (`publishReadiness` counts the test sources), 877, 1015, 1074.
- `web/typescript/save.ts:79` `itemsToGeoJson` -- item features already carry `{id, name, kind}`, enough for `point.click` and `PopupPoint`.
- `common/src/main/resources/mapstudio.props.json:34` -- `testSet` schema entry.
- `ops/.../views/MapStudioScale/`, `page-config/config.json` `/scale` -- removed. `MapStudioDev`, both fallback views and `Popups/PointDetails` stay.
- `e2e/tests/tracer.spec.mjs`, `popup.spec.mjs`, `scale.spec.mjs`, `measures.spec.mjs` (lines 236-301), `e2e/lib/geo.mjs` `TRACER` -- move to store data; `fixtures.mjs` `signedInContext`, `mapLoaded` reused.
- `gateway/src/test/.../adapter/ExampleAdaptersCompileTest.java` -- compiles shipped Jython under jython-ia; add the seed library and run its pure planner there.
- Every spec writes into the same `mapstudio-dev` map (no reset; CI purges the volume per run), so pages draw the seed plus other specs' items.

## Tasks & Acceptance

**Execution:**
- [ ] `ops/project/ignition/script-python/mapstudio_seed/{code.py,resource.json}` -- `SCALE` (30 pads `Pad 1`..`Pad 30`, 30 lines `Line to Pad N`) and `TRACER` (`Point 1`..`Point 3`, `Tracer line`) literals; pure `plan_ops(current, seed)`; `run(project, actor)` reads `getMap`, sends one batch, restores tombstones from the conflict, returns `{created, updated, restored, unchanged, seq, ids, scale: {pads, lines}, error?}` (`scale` counts live items whose ids are the scale set's seed ids, by kind) -- the seed.
- [ ] `ops/project/.../views/MapStudioEdit/view.json` -- "Seed the dev map" button, MapEditor-gated, result JSON in a label (`#mapstudio-dev-seed-result`).
- [ ] `web/typescript/MapStudio.tsx`, `common/src/main/resources/mapstudio.props.json`; delete `testSet.ts`, `scaleData.ts`, `testData.ts`, `__tests__/testSet.test.ts`, `__tests__/scaleData.test.ts` -- drop the prop and test layers; fixed start view (center -104.9725, 39.7445, zoom 12) until epic-viewing; click, hover and map-click popup close on `LAYER_ITEM_POINTS`; `data-points-loaded`/`data-lines-loaded` read back from the item sources after the items' first idle.
- [ ] `ops/.../page-config/config.json`; delete `views/MapStudioScale/` -- no `/scale`.
- [ ] `e2e/tests/fixtures.mjs` -- `ensureSeeded(browser)`: once per worker, an editor context runs the seed button and returns its result.
- [ ] `e2e/tests/scale.spec.mjs` -- seed twice: second run `unchanged` 64, `scale` `{pads: 30, lines: 30}` both times; `/` draws at least 33 points and 31 lines; screenshot `mapstudio-scale-1440.png`.
- [ ] `e2e/tests/tracer.spec.mjs`, `popup.spec.mjs`, `e2e/lib/geo.mjs` -- seeded, `TRACER.zoom` 12, ids from the seed result (`Id: <uuid>`, reply names the uuid).
- [ ] `e2e/tests/measures.spec.mjs` -- frame rate on `/` only (one map now; the tracer contrast view goes), recording the points and lines drawn; value batch sized for the 30 seed pads.
- [ ] `gateway/src/test/.../adapter/ExampleAdaptersCompileTest.java` -- compile the seed; run `plan_ops` under Jython for each matrix row.
- [ ] `common/src/test/.../ScriptDocsTest.java` -- every `@JythonElement` method has `desc`, each `param.<name>` and `returns`.
- [ ] `MapStudioScriptModule.properties`, `docs/contract.md`, `README.md`, `_bmad-output/deferred-work.md` -- full API text (args, results incl. `attachment` and `kindSetups`, the four ops, error codes, `conflicts()`, actor rule, UUIDv5, re-run rule, trust); README Status and `ops/` row; mark the story 7 entry resolved and the GPU check's page as `/`.

**Acceptance Criteria:**
- Given an empty store, when the seed runs twice, then each of the 64 ids is stored once and `scale` reads 30 pads and 30 lines both times.
- Given `testSet` gone, when `npm test` runs in `e2e/`, then every spec passes and `measures.json` has a frame rate for the 30-pad set read from store items.
- Given the Designer on the dev Gateway, when `system.mapstudio.` is typed, then `getMap` and `applyEdits` show the new text [unverified until an owner Designer session].

## Design Notes

Re-run, per seed id: absent from `getMap` gives `create` at 0; present and equal gives nothing; present and different gives `update` at its stored version carrying the four seed fields. A tombstone looks absent, so its create is refused `conflict`; for each conflict whose `current.deleted` is true the seed re-sends a new batch with that op as `create` at `current.version`; any other conflict is reported.

```python
except java.lang.Throwable as ex:
    # On the Gateway the conflicts iterate as dict-like elements (Implementation Notes).
    found = ex.conflicts() if hasattr(ex, 'conflicts') else None
    conflicts = list(found) if found is not None else []
```

## Decisions

**2026-10-27, owner ("agree with all recommendations, start building"):**
1. A re-run reads a deleted seed item's version from the conflict the save returns (`ex.conflicts()`); no Java change.
2. The tracer's points stay separate items at their old coordinates: the seed writes 33 pads and 31 lines; "30 pads and 30 lines" means the scale set.
3. Other specs' items stay on the measured map; the measure records how many points and lines it drew.
4. One story, as sliced.
Also confirmed: pads carry `status: producing`; no instruments in the seed; `popupView` stays.

## Open Questions

None (resolved by the Decisions above).

## Implementation Notes

- Implemented directly (no subagent in this session), 2026-10-27.
- Live finding: on the Gateway, `ex.conflicts()` reaches Jython through Ignition's JSON adapters, so the array iterates as dict-like objects (`'com.inductiveautomation.ignition.common.script.ada...' object has no attribute 'getAsJsonObject'` on the first try); the seed reads a conflict either way (`_conflict_row`), and DevSeedTest covers both forms.
- The seed's re-send copies the ops list (the first batch's list was mutated in place, caught by DevSeedTest's restore row).
- The seed result carries `ranAt` (added by the view), so `runSeed` tells two runs with an equal result apart without touching the label's DOM.
- `data-points-loaded`/`data-lines-loaded` are set after the first loaded items are drawn and the map has gone idle; `data-map-ready` still after the first idle. Only features in loaded tiles count, so the phone checks use "at least the tracer's".
- Review, 2026-10-27 (quick, context-free): `conflicts()` documented as read like dicts on the Gateway, `scale` counted by seed id, the role spec proves nothing was written, the re-run wording narrowed to the four seed fields, platform-checks dated; the popup spec moves to p3 and the draw vertices clear p1's popup at zoom 12. Status built. See the Review Triage Log.
- Plan matrix row "Not a map editor" is covered by `e2e/tests/scale.spec.mjs` ("the seed needs the MapEditor role"); the other rows by `DevSeedTest` (Jython, stand-in store), and first run, re-run and deleted also live in `scale.spec.mjs`.

## Plan Change Log

- 2026-10-27, review (quick): `scale` in the seed result counts the scale set's seed ids by kind, not names (was "live items named as seed items"); the Design Notes snippet reads the conflicts as dicts, as the Gateway hands them over, not through `jsonDecode(str(...))`. Intent unchanged.

## Review Triage Log

Pass 1 (lens: quick, context-free, on the uncommitted working tree over `da7e3db`, 2026-10-27; each finding checked again here against the code and, where it could be, the dev stack): high 1 (rejected as stated, but the e2e run found a real neighbouring defect, patched), medium 1, low 4. Five patched, one rejected; no loopback (each fix is local and the plan's intent stands).

| # | Finding | Verdict | Route | Evidence and action |
|---|---|---|---|---|
| 1 | Point 1 sits under seeded Pad 15 at zoom 12, so a click on Point 1 gets Pad 15 | high | reject (as stated); patch (what the e2e run found) | Not real as stated: the reviewer projected with 256 px tiles; MapLibre's zoom 12 is 512 px tiles (`e2e/lib/geo.mjs`), so Pad 15 is 12.7 px from Point 1, beyond its 9 px circle, and every p1 click in the run named Point 1's uuid (`tracer.spec` both widths, `popup.spec`, `measures.spec`). The tracer points keep their old coordinates (Decision 2). The full e2e run did show the real cost of the zoom change from 12.5 to 12: p1's open popup covers p2 at 1440 px (`popup.spec` clicked p2 and got p1's popup again) and the second draw vertex at 390 px (it sits right of p1 there; `tracer.spec` 390 drew 1 point). Patched: `popup.spec` moves the popup to p3 (205 px right of p1), and `TRACER.drawOffsets` are now `[-50, 150]` and `[100, 150]`, below the popup on both widths and at least 34 px from every seeded point. |
| 2 | `conflicts()` docs say to walk it with Gson methods [live] and the Designer text recommends the unverified `jsonDecode(str(...))` | medium | patch | Real: the live finding (Implementation Notes) is that on the Gateway the elements arrive as dict-like objects and `getAsJsonObject` raised AttributeError. `docs/contract.md` now says they read as dicts (`c['current']['deleted']`, `c['current']['version']`) **[live 8.3.10]** and that Gson's methods are for plain Jython outside the Gateway only (`DevSeedTest`); its example and the `applyEdits.desc` text drop `jsonDecode(str(...))` and read the elements as dicts. |
| 3 | `scale` counts names, not the seeded ids | low | patch | Real: a same-named stray counted. `_count_scale(records, seed)` counts live records whose id is one of the scale set's seed ids and whose kind matches; `DevSeedTest.theScaleCountReadsTheSeedIdsNotTheNames` (a stray "Pad 7" does not count, a renamed seed line does, a deleted seed pad is missing). contract.md and the plan say so. The repeated `pads == 30` in `measures.spec` is kept: it is cheap and names the set the frame rate was measured on. |
| 4 | The "seed needs the MapEditor role" test cannot show that nothing was written | low | patch | Real: specs before it had seeded already, so an editor's seed would also leave the count unchanged. The test now deletes Pad 29 as an editor first, presses the button anonymously, asserts the refusal, no `seq`, and that Pad 29 is still deleted in `map.load`, then restores it with an editor's seed for the specs after it. |
| 5 | A re-run does not fully restore an edited seed item (`assetId`, `overrides`, `ends`, `attachment` stay) | low | patch (docs) | Real as a wording overstatement. Sending those fields as None from a seed would clear an editor's binding on every re-run, which the seed has no reason to own, so the docs are narrowed instead: contract.md and the seed's header say an edited item is put back on the four fields it compares and sends (kind, name, geometry, properties), and other fields an editor added stay. |
| 6 | `docs/platform-checks.md` still describes `testSet` and the Scale view as current | low | patch | Real: a dated 2026-10-27 note under story 8's "Kept on purpose" says story 11 removed `testSet`, `scaleData.ts`, `testData.ts`, `MapStudioScale` and `/scale`, and the set is now the seeded store items on `/`; the frame-rate limit (3) notes `scaleData.ts` was removed. |

Re-run after the patches: `./gradlew clean build` green (Java common 86, gateway 267, designer 34; `DevSeedTest` 9 of 9), `cd web && npx tsc --noEmit && npx jest` 144 of 144 in 16 suites; `ops/up.sh --fresh` then `cd e2e && npm test` 55 passed, 7 skipped (the six `store-ops` cases `ops/store-checks.sh` runs, and the stopped-Gateway case), 0 failed on `ms-e2s11`; `ops/store-checks.sh` all five scenarios passed; the Verification `psql` query returns `line 30`, `pad 30`.

## Verification

**Commands:**
- `./gradlew build --no-daemon` -- expected: green, `ScriptDocsTest` and the seed's Jython planner cases pass.
- `cd web && npm test` -- expected: green with `testSet` and `scaleData` tests gone.
- `grep -rn "testSet\|scale30\|MapStudioScale" web common ops e2e README.md` -- expected: no hits.
- `cd e2e && npm test` (dev Gateway `ms-e2s11`, port 9135) -- expected: all pass.
- `ops/psql.sh -c "select kind, count(*) from mapstudio_item where project='mapstudio-dev' and not deleted and name ~ '^(Pad [0-9]+|Line to Pad [0-9]+)$' group by kind"` -- expected after two runs: `line 30`, `pad 30`.
