---
title: "Change geometry: move, vertices, insert, split, snapped ends that follow, and the non-drag ways"
type: 'feature'
ticket: '5'
created: '2026-11-06'
status: 'in-progress'
baseline_revision: '0704c338b53f59e7856338b7c0daf29a837f4f0a'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md', '{project-root}/docs/instruments.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** In Edit mode a map item, once saved, cannot be reshaped: a point moves only by typed latitude and longitude, a line or an area's points cannot be dragged, added, removed or split, and moving a pad leaves the lines snapped to it behind.

**Approach:** Decisions (owner, 2026-11-06: the entry split to geometry, then "looks good" on its four mocks). A selected line or area shows a handle at each point and a smaller dashed one at each midpoint; dragging a point moves it, dragging a midpoint adds a point there. Choosing a point puts it in the bottom bar ("Point 2 of 3 on L-SWD") with Move, Split here (inner points of a line) and Delete point (not below two points for a line, three for an area). Move, in that bar or beside a point item's Location in Details, then a click on the map is the way without a drag ("Click the new place on the map - Esc to cancel"). A point item is dragged as well. Moving an item that lines snap to moves their snapped ends with it. Every change is one save and one Undo step.

## Boundaries & Constraints

**Always:** Each change is one `edits.apply` batch through the delegate's queue, sent when the drag or the action ends, never per pointer move, and one undo step named for it ("move CTB1", "reshape L-SWD", "split L-SWD"). Instruments stay on their line at their nearest place on the new shape, and on a split each goes to the part it sits on measured from that part's start, through `geometry.ts`'s `lineGeometryBatch` and `lineSplitBatch` (AD-19). Moving an item moves the first or last point of every line whose stored `ends` name it, in the same batch. `ends` stay stored, never inferred: a line's end point dragged with Snap on lands on and names a target, with Snap off it floats and its `ends` entry goes; a split's two new ends at the split point float. On a split, the line keeps its name, link and start; the new part takes the kind, the properties and the end, the name "<name> 2", no asset link, and opens in Details with Name focused. An area is an unclosed ring (AD-20) and has no Split. The bottom bar is the one place that talks; with nothing chosen nothing does. Esc puts down Move or a chosen point. Tools only at level `full` and 768 px and wider; the store unreachable pauses it all as it pauses the toolbar. Colours from theme tokens; no em dashes.

**Never:** Change the Gateway, `common/`, a message, a prop or the contract version. Move a whole line or area by dragging its body. Delete an item (entry 25), multi-select (entry 8), the instrument tool (entry 9). Add a dependency. Delete a test or weaken its expectation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Handles | A line or area selected (Select tool) | A handle at each point, a dashed one at each midpoint | No error expected |
| Drag a point | A lateral's inner point dragged | One batch: the new geometry, its instruments at their nearest places; Undo puts it back | A refusal on the save status row |
| Insert | A midpoint dragged | One more point there, one batch | No error expected |
| Choose a point | A point handle clicked | The bar: "Point 2 of 3 on L-SWD", Move, Split here, Delete point | Delete point off at the floor; Split here off on an end point and on an area |
| Delete point | Pressed | One batch without it; an end point's `ends` entry goes | No error expected |
| Split | L-SWD split at a point between PT-1 and PT-2 | Two lines; PT-1 on the first, PT-2 on the second at distances from each part's start; the new part in Details with Name focused; one Undo step | No error expected |
| Move then tap | Move, then a click | The point or the item moves there; one batch | Esc cancels; nothing sent |
| Pad moved | CTB1 dragged or moved | The snapped ends of its lines move with it, one batch, one Undo step | No error expected |
| End dragged | A line's end point dragged, Snap on near SWD1 | Lands on SWD1, `ends` names it | Snap off: floats, `ends` entry gone |
| Phone or viewer | 390 px, or level below full | No handles, no bar, no Move | As today |

</frozen-after-approval>

## Code Map

- `web/typescript/editing.ts` -- Terra Draw on the MapLibre adapter (`startTerraDraw`: line, polygon and point modes, `onDrawFinish`, `onDrawChange`, `onKeyDown`, `putToolDown`, `placedPoints`, the queued Terra Draw copies dropped once the store draws the item, `EditingHost`). Terra Draw 1.38 has `TerraDrawSelectMode` (`modes/select/select.mode.d.ts`): per mode, `feature.draggable` and `coordinates.{draggable, midpoints: {draggable}, deletable, snappable}`, finish actions `dragCoordinate`, `insertMidpoint`, `dragFeature` (`common.d.ts`), and its styling keys for selection points and midpoints. The selected item goes into Terra Draw as a feature while it is selected (an area as a closed ring) and leaves when the selection changes or its saved record draws; the bar's actions and Move are the component's.
- `web/typescript/geometry.ts` -- `lineGeometryBatch` (a reshape with each instrument re-placed), `lineSplitBatch` (`SplitPart`), `instrumentsOn`, `project`, `snapTargets`, `nearestSnap`, `endsFrom`; tested in `__tests__/geometry.test.ts`. New pure pieces here: a point item's move with the snapped ends of its lines in one batch, a line's end point changed with its `ends`, the split at a point with the parts' `ends`, a point removed.
- `web/typescript/MapStudioStoreDelegate.ts` -- `sendBatch`, `moveItem` (a point's typed move today), `knownRecord`, `items`; `undoStack.ts` `stepLabel` (gains reshape, split).
- `web/typescript/studio/DrawingBar.tsx`, `drawing.ts` -- the bottom bar; a chosen point's bar and Move's bar beside the drawing ones.
- `web/typescript/studio/PropertiesPanel.tsx` -- the Location row (latitude and longitude for a point, "A line of 3 points" for a line); Move beside the label for a point item.
- `web/typescript/selection.tsx` (`onMapClick`, `onPointClick`), `features.ts` (`selected`, the selected line's casing and arrow), `MapStudio.tsx` (`selectionState`, `studio`, the bar's render), `studio.ts` (the tool model; Select stays the tool while handles show).
- Seed and dev page: L-SWD from CTB1 to SWD1 with PT-1, LV-1 and PT-2 on it (`ops/project/ignition/script-python/mapstudio_seed/code.py`).
- e2e: `drawing.spec.mjs` and `studio.spec.mjs` (helpers `pixelNow`, `spot`, `openEditor`, `view`, `send`), `e2e/lib/geo.mjs` `pagePixel`.
- Docs: `docs/contract.md` (the Drawing paragraph, the studio's hooks), `docs/instruments.md` (what a reshape and a split do to instruments), `CHANGELOG.md` 0.4.0.

## Tasks & Acceptance

**Execution:**
- [ ] `web/typescript/geometry.ts` + tests -- the new pure batches (an item's move with its snapped ends; an end point's change with `ends`; a point removed; the split at a point with the parts' data and `ends`) -- the pure half, tested.
- [ ] `web/typescript/editing.ts`, `MapStudio.tsx`, `selection.tsx` -- the select mode on the selected item, drags and midpoints saved as one batch each, a chosen point, Move then tap, Esc; paused with the store.
- [ ] `web/typescript/studio/DrawingBar.tsx` (or a sibling), `drawing.ts`, `PropertiesPanel.tsx`, `mapstudio.css` -- the chosen point's bar and Move's bar, Move beside Location, the handles' look from tokens (as the mocks).
- [ ] `web/typescript/undoStack.ts`, `MapStudioStoreDelegate.ts` -- the step names and the sends.
- [ ] `e2e/tests/geometry.spec.mjs` -- the matrix at 1366 px as `mapeditor` (drags by pointer, every non-drag way by clicks and keys), the phone and viewer row; renders of the four mocked states under `E2E_DOCS=1`.
- [ ] `docs/contract.md`, `docs/instruments.md`, `CHANGELOG.md` -- the geometry changes, their hooks, the split's rules.

**Acceptance Criteria:**
- Given the dev Gateway as `mapeditor` at 1366 px, when the matrix runs, then each row holds and each change is one batch and one Undo step.
- Given the whole e2e suite on a fresh dev stack, when it runs, then every spec passes.

## Implementation Notes

- Approval (owner, 2026-11-06): "Start", the split and "Looks good" on the four mocks, taken as the plan's approval; the split's naming of the new part and the end point's snap rule were told to the owner with the plan.
- Planner, 2026-11-06: the environment, commit and identity rules are entry 4's plan's (Docker started by hand after a container restart, `ops/up.sh --fresh` before a whole-suite run, the two trailer lines from the session's attribution reminder, no em dashes, no model identifier, never a bare `git stash`, never a push). Commit at each working milestone: a container restart has twice cut a session short.

## Plan Change Log

- 2026-11-06 (implementer): Terra Draw's select mode takes drags only. Its clicks and keys are off (`pointerEvents.leftClick` and `rightClick` false, `keyEvents` null, no manual selection), so Terra Draw selects, deselects and deletes nothing itself, a click on a midpoint adds nothing (only its drag does, as the Approach reads), and the component chooses a point on a click within 12 px of a handle and owns Esc. The copy belongs to three modes of its own (`edit-point`, `edit-line`, `edit-area`), never picked as tools, so the drawing tools' validation and snapping never see it.
- 2026-11-06 (implementer): MapLibre circles cannot be dashed, so the dashed midpoints are the map's own symbol layer over Terra Draw's point source (`mapstudio-handle-midpoints`, an image drawn on a canvas in the surface and selection tokens) and Terra Draw's own midpoints are drawn transparent; the chosen point is a circle layer on the same source filtered on its index (`mapstudio-handle-chosen`). The copy itself shows only while its shape differs from the stored record (during a drag and until its save draws), so the map's own line, with its look and hue, is what is seen otherwise. The handles' colours are read once at mount, as the drawing tools' are.
- 2026-11-06 (implementer): an instrument takes no handle and no Move in Details: it moves along its line (entry 9), and the Gateway refuses its point off the line. On a split the new part takes the kind, the properties and the end as the plan names them, not the line's `overrides`.
- 2026-11-06 (implementer): a line's end point snaps only with Snap on and only at an end (an inner point and an area's points never snap), to any point item or vertex within 20 px but the line's own; Move then a click of an end point follows the same rule.
- 2026-11-06 (implementer): the delegate's one send at a time per map item now covers every item a batch touches (a pad's move carries its lines, a reshape its instruments): a batch waits while any of them has one in flight. A geometry batch carries whole shapes built from the stored records, so one that would be built on a record whose earlier change is still being saved is not sent (one console line); meanwhile the bar's actions wait ("Saving...") and no drag starts until the last drag's save settles.
- 2026-11-06 (implementer): typed latitude and longitude go through the same `moveItem`, so they carry the snapped ends too (the plan's "Moving an item moves the first or last point of every line whose stored `ends` name it").
- 2026-11-06 (implementer): after Move then a click the point stays chosen and its bar returns; a drag keeps the dragged point chosen and puts any other chosen point down (the points may have moved on). Move swaps the bar's buttons for Cancel, and the focus follows (Cancel while Move waits, Move after) so Esc and Enter stay in the component. With Details docked the map is narrower than the mock's page, so the bar's hint wraps under its title.
- 2026-11-06 (implementer): `geometry.spec.mjs` restores the seed before and after (the seed run again, the strays removed), since later specs read L-SWD, and adds a fifth render, the split with the new part in Details (`mapstudio-geometry-split-1366.png`).
- 2026-11-06 (implementer): the first whole-suite run found the handle layers blocking Terra Draw's stop on unmount (MapLibre will not remove a source a layer reads; a console error in `live.spec.mjs`); they now leave first. Verified on the patched tree: `tsc` clean, 404 Jest tests green, Gradle build green offline, the contract check OK at 0.4.0, and the whole e2e suite on a fresh dev stack 159 passed, 7 skipped, 1 failed in 38.6 min, the one the review 390 px flake ("No Connection to Gateway"), which passed alone; `SetupLookupsTest` failed once in a build while the box was busy and passed on the next, as recorded. The renders went to `docs/screenshots` with `E2E_DOCS=1`.

## Review Triage Log

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` -- expected: BUILD SUCCESSFUL.
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK at 0.4.0.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: green (the review 390 px flake may fail once; rerun it alone).

**Manual checks (if no CLI):**
- The owner compares the renders with the four approved mocks.
