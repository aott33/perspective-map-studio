---
title: 'Scripting API documented, and the 30-pad set seeded through it'
type: 'feature'
ticket: '11'
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
- [ ] `ops/project/ignition/script-python/mapstudio_seed/{code.py,resource.json}` -- `SCALE` (30 pads `Pad 1`..`Pad 30`, 30 lines `Line to Pad N`) and `TRACER` (`Point 1`..`Point 3`, `Tracer line`) literals; pure `plan_ops(current, seed)`; `run(project, actor)` reads `getMap`, sends one batch, restores tombstones from the conflict, returns `{created, updated, restored, unchanged, seq, ids, scale: {pads, lines}, error?}` (`scale` counts live items named as seed items, by kind) -- the seed.
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
    conflicts = system.util.jsonDecode(str(ex.conflicts())) if hasattr(ex, 'conflicts') and ex.conflicts() else []
```

## Open Questions

1. **How a re-run finds a deleted seed item's version.** (a) Catch the `conflict` and read `ex.conflicts()` (no Java change; documented as the way scripts read conflicts) [unverified that Jython reaches the method]. (b) Add `getMap(project, includeDeleted)` (store query, Gateway and Designer modules, tests; contract addition). (c) Leave deleted seed items deleted (then "exactly 30" fails after someone deletes a pad). Recommended: (a).
2. **The tracer's points beside the 30 pads.** (a) Seed them as separate items at their old coordinates (3 pads `Point 1`..`3`, 1 line): the seed writes 33 pads and 31 lines, and the verify line is read as "30 pads and 30 lines of the scale set". (b) Make the tracer click three of the 30 pads: no extra items, the verify holds literally, spec coordinates and phone probes change. Recommended: (a).
3. **Other specs' items on the measured map.** (a) Keep them; the measure records how many points and lines were drawn (CI starts empty, so only earlier specs' items). (b) The seed takes `prune=True` from the e2e and deletes every other live map item of `mapstudio-dev` before measuring (exact 64, but wipes a developer's dev items). Recommended: (a).
4. **Plan size** is about 2,800 tokens, above the 1,600 guide. (a) Keep as one story, as sliced (docs and seed meet in the re-run rule). (b) Split the docs into their own entry. Recommended: (a).

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `./gradlew build --no-daemon` -- expected: green, `ScriptDocsTest` and the seed's Jython planner cases pass.
- `cd web && npm test` -- expected: green with `testSet` and `scaleData` tests gone.
- `grep -rn "testSet\|scale30\|MapStudioScale" web common ops e2e README.md` -- expected: no hits.
- `cd e2e && npm test` (dev Gateway `ms-e2s11`, port 9135) -- expected: all pass.
- `ops/psql.sh -c "select kind, count(*) from mapstudio_item where project='mapstudio-dev' and not deleted and name ~ '^(Pad [0-9]+|Line to Pad [0-9]+)$' group by kind"` -- expected after two runs: `line 30`, `pad 30`.
