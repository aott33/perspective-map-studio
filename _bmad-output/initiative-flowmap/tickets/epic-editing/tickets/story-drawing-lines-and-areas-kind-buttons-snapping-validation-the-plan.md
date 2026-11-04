---
title: "Drawing lines and areas: kind buttons, snapping, validation, the drawing bar, Esc and keyboard"
type: 'feature'
ticket: '4'
created: '2026-11-04'
status: 'in-review'
baseline_revision: 'b06a5ee1c4418e579190f9429a44d0604b5f5e0e'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/handoff-epic-4.md', '{project-root}/docs/contract.md', '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md', '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Edit mode draws only a point (entry 2) and the spike's Draw a line button, which still follows the edit-mode prop for every role and names a dev kind. Lines and areas, kind buttons, snapping, validation while drawing and the drawing bar are what a map editor lays a field out with (UJ-1), and ten e2e files still drive the Gateway through the spike's button.

**Approach:** First retire the spike's Draw a line toggle and its status line: the toolbar's Line tool takes their place at level `full`, and the specs that drew through the toggle move to the toolbar's tools (the shared `drawLine` fixture) or the test hook where the drawer is a viewer or a phone editor, their expectations kept. Then the toolbar as designed: kind buttons for the kind list's first kinds (up to three), the generic Point, Line and Area tools with the kind picked in the form after, vertex-by-vertex drawing with no drag, finished by double-click, Enter or Finish, Backspace removing the last vertex, Esc cancelling to Select; the drawing bar bottom-centre; the Snap toggle off by default, with the indicator naming the target when on, snapped and floating ends drawn apart and the snap stored in `ends`; validation while drawing in plain words; the mode pill for every tool; and the toast with Undo after an add.

## Boundaries & Constraints

**Always:** Every save is one `edits.apply` batch through the delegate's `sendBatch` (one send at a time per item, AD-2, AD-10), sent when the drawing is finished, never per vertex. Tools only at level `full` and 768 px and wider; below that no tool, no toolbar. The studio model in `studio.ts` is the one truth for the tool in hand and every write goes through `drawingState`, `pointToolState` and `selectionState`. Geometry stays Point or LineString (AD-20): an area is the ring's vertices as a LineString, unclosed, as the seed stores it and `features.ts` closes it. A snap is stored in `ends` and never inferred from coordinates (AD-19). Validation comes from Terra Draw's own `validation` hook and reasons where it has them. Every existing spec keeps its expectation: a refused save is still refused with the same code and words, an offline edit still queues and replays, the touch probe still proves 44 px targets. Colours from theme tokens only; no em dashes. Commit at each milestone (the toggle retired and the specs moved; the tools; snapping; the toast) with the configured git identity and the two trailer lines the session's attribution reminder gives.

**Never:** Change the Gateway, `common/` or any message type. Move a snapped-to item's ends when the item moves (entry 5), the instrument tool (entry 9), Box select or lasso (entry 8), the kind buttons' choice beyond the list's order, the Style tab, the first-run checklist. Keep the `DrawControl` or the dev `DEV_LINE_KIND` naming. Add a dependency: Terra Draw's polygon mode and `ValidateNotSelfIntersecting` are installed. Delete a test or weaken its expectation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Kind button | Pipeline pressed, two clicks, Enter | A line of that kind saves at once with the kind's name as placeholder; Details opens with Name focused; the toast reads "Pipeline added and saved" with Undo | A refused save in the save status |
| Generic Line | Line pressed, clicks, Finish | A line of the kind list's first non-area line kind; the form's Kind select offers every line kind and a change saves a `kind` update | No error expected |
| Area | Area or an area kind button, three clicks, double-click | A LineString of the ring's vertices, unclosed; drawn as a closed fill | No error expected |
| Too short | One vertex, Enter or Finish | Nothing finishes; the drawing bar says a line needs two points | No batch |
| Self-intersecting | A ring whose edges cross | The bar says so in words before Finish; Finish does nothing until fixed | No batch |
| Backspace, Esc | While drawing | Backspace removes the last vertex (the bar's count follows); Esc cancels the drawing and the pill reads Select | No batch |
| Snap on | Toggle on, the pointer near CTB1 | The indicator reads "Snap to CTB1 - click to connect"; the vertex lands on CTB1 and the saved line's `ends.start` is CTB1; a snapped end draws apart from a floating one | No error expected |
| Snap off | Default | Nothing snaps; `ends` null; the bar reads "start floating" | No error expected |
| Viewer, phone editor | A line through the test hook | Refused `role` with the same words as before | As today |

</frozen-after-approval>

## Code Map

- `web/typescript/DrawControl.tsx`, `MapStudio.tsx` `applySpikeTool` (477-494) and `render`'s `.mapstudio-reply` (`data-drawing`, `data-line-points`, `.mapstudio-draw-status`; the click echo stays), `draw.ts` (`DrawState`, `drawStatusText`), `MapStudioStoreDelegate.sendLineCreate`, `save.ts` `DEV_LINE_KIND`, `lineName`, `lineCreateBatch`, `mapstudio.css` 222-250 and 810 -- the spike's tool to retire; its tests `__tests__/save.test.ts` and `studio.test.ts` (16-161) follow.
- E2E users of it, through `e2e/tests/fixtures.mjs` `drawLine` (59-73) unless noted: `store.spec.mjs` 21 (an editor's saved line) and 45-51 (a viewer refused `role`, asserting the draw status text); `writepath.spec.mjs` 163-170 (a phone editor refused); `store-ops.spec.mjs` 70 (the button disabled with the store unavailable) and 86 (`read-only`); `unsaved.spec.mjs` 129, 252, 328 (an offline queue entry, which needs a real tool save: the hook bypasses the queue, contract.md 190) and 270-293 (enabled or disabled); `tracer.spec.mjs` 72-97 (Esc after one vertex, a two-vertex finish); `changes.spec.mjs` 67 and `e2e/rehearsal/release.spec.mjs` 43 (a saved line seen elsewhere); `studio.spec.mjs` 167, 177, 233; `measures.spec.mjs` 363-388 (the phone touch probe taps the button: no tool below 768 px now, so the probe takes another 44 px control there); `basemaps.spec.mjs` 392, 496 (none in View mode). `e2e/lib/geo.mjs` `TRACER.drawOffsets`, `pagePixel`.
- `web/typescript/editing.ts` -- `startTerraDraw` (the line and point modes), `applyEditing` (pauses), `toggleDrawing`, `pickPointTool`, `putToolDown`, `onDrawFinish`, `onPointFinish` (the Point tool's pattern: finish, save, select, Details with Name focused), `onKeyDown` (Esc, capture phase on the map container), `placedPoints`; `EditingHost`.
- `web/typescript/studio.ts` -- `StudioTool`, `pickTool`, `pillText`, `pointKind`, `withArticle`; `studio/DrawToolbar.tsx` (Select, Point, the pill; `paused`); `MapStudio.tsx` `drawingState`, `pointToolState`, `onSelectTool`, `onPointTool`, the toolbar render (1116-1122).
- Terra Draw 1.38.0 (`web/node_modules/terra-draw/dist`): `TerraDrawLineStringMode` and `TerraDrawPolygonMode` options `snapping {toCoordinate, toLine, toCustom(event, context)}`, `validation(feature, {updateType})` with `ValidateNotSelfIntersecting` and `ValidationReasons`, `keyEvents {cancel, finish}`, `pointerDistance`; a mode's public `undo()` pops the last vertex while drawing; `finish(id, {mode, action})` and `change` events; `getSnapshotFeature(id)` for the vertex count in progress; a line finishes only with two or more vertices.
- `web/typescript/adapters.ts` `Kind` (`geometry 'point' | 'line'`, `area?: true` on a line kind drawn closed); the dev kind list `ops/project/ignition/script-python/mapstudio_dev/code.py` (pad, line, geofence with `area: True`, tap, valve) and the seed's `GEOFENCES` (four unclosed vertices) in `mapstudio_seed/code.py` 133-138.
- `web/typescript/features.ts` -- `buildFeatures` closes an area's ring (260-276); `lineNodes` (91-102) reads `ends` for the node names only: the snapped and floating ends' looks go here. `web/typescript/contract.ts` 60 `ends: {start?: {itemId}, end?: {itemId}} | null`; the Gateway checks only that `ends` is an object or null (`MapItemRecord.java` 145-148; `ItemCheck.java` checks geometry type against the kind). `geometry.ts` `lengthM`, `project`, `round6`; no nearest-vertex helper yet. `linePopup.ts` `distanceText` for the bar's length.
- `web/typescript/studio/PropertiesPanel.tsx` -- Details; the Kind row is read-only text (entry 2): it becomes a select of the kinds with the item's geometry. `MapStudioStoreDelegate.ts` `sendBatch`, `createPoint`, `sendUpdate`, `knownRecord`, one send at a time per item; `undoStack.ts` `stepLabel`.
- DESIGN.md Components: draw-toolbar (groups, the active tool in `selection`, Snap with the magnet glyph and "Snap off" or "Snap on"), mode-pill, the drawing bar (bottom-centre: kind glyph, "New pipeline", "2 points - 0.7 km - start floating", snapping state, "Double-click or Enter to finish", Cancel and Finish), toast-undo-bar (dark, bottom-centre, a check, the message, Undo; never bottom-right); EXPERIENCE.md Floating draw toolbar, Drawing bar, Draw, Snap, Toast; `controls.ts` `GLYPH_PATHS` for the chrome glyphs (a magnet and an area glyph are new).

## Tasks & Acceptance

**Execution:**
- [ ] `web/typescript/DrawControl.tsx` (deleted), `MapStudio.tsx`, `editing.ts`, `draw.ts`, `save.ts`, `MapStudioStoreDelegate.ts`, `mapstudio.css`, the two unit tests -- the spike's toggle, its status line and the dev line kind retired; the toolbar's Line tool (level `full`) is the only line tool; `data-tool` on the map and the drawing bar's attributes replace `data-drawing` and `data-line-points` -- one drawing path (milestone 1, with the next task).
- [ ] `e2e/tests/fixtures.mjs` `drawLine`, and the specs listed in the Code Map -- `drawLine` drives the toolbar's Line tool; a viewer's or phone editor's refused line goes through the test hook with the same code and words asserted; the touch probe taps another 44 px control at phone width; `basemaps` and `studio` assert the toolbar instead of the button -- every spec keeps its expectation (milestone 1).
- [ ] `web/typescript/studio.ts` + `__tests__/studio.test.ts` -- the tools `line`, `area` and a kind-fixed tool (the kind button's kind), the kinds per geometry (point kinds; line kinds without `area`; area kinds), the toolbar's kind buttons (the kind list's first kinds, up to three), the pill's words per tool and kind ("Draw a pipeline - click to add points, Enter to finish", "Draw a geofence - click to add points, double-click to close") -- the model names every tool.
- [ ] `web/typescript/geometry.ts` + `__tests__/geometry.test.ts` -- `snapCandidates(items, zoom)` or the like: the nearest point item or line vertex within the snap distance of a map position, and `endsFrom(snaps)` for the saved line's `ends` -- the pure half of snapping, tested.
- [ ] `web/typescript/editing.ts` -- the polygon mode beside the line mode; a kind button or generic tool picks the mode and the kind; `validation` with Terra Draw's self-intersection check and a two-vertex floor; `snapping.toCustom` from the candidates while the toggle is on, with the snapped target remembered per vertex; Backspace calling the mode's `undo()`; Enter, double-click and Finish finishing, Esc cancelling to Select; a finished line or area saved at once through `sendBatch` (the kind's name as placeholder, `ends` from the snaps), selected, Details opened with Name focused as the Point tool does -- the tools.
- [ ] `web/typescript/studio/DrawToolbar.tsx`, new `studio/DrawingBar.tsx`, `Toast.tsx`, `controls.ts`, `mapstudio.css` -- the toolbar as designed (kind buttons, Point, Line, Area, Snap with "Snap off" or "Snap on", the active tool in the selection token, paused while the store is unreachable); the drawing bar bottom-centre (kind glyph, "New pipeline", "N points - 0.7 km - start floating" or "start snapped to CTB1", the snap indicator "Snap to CTB1 - click to connect", the validation words, the finish hint, Cancel and Finish, Finish inert until the drawing is valid); the toast bottom-centre with a check, "Pipeline added and saved" and Undo (6 s, paused on hover; entry 10 may refine), never bottom-right -- the surfaces.
- [ ] `web/typescript/features.ts` -- a floating end drawn apart from a snapped one (DESIGN.md Map line; a small mark in the selection token at a floating end while the line is selected, none at a snapped one; the implementer keeps it to tokens) -- the map shows the snap.
- [ ] `web/typescript/studio/PropertiesPanel.tsx` -- the Kind row a select of the kinds with the item's geometry, saving a `kind` update (the Gateway's item check accepts a kind of the same geometry); Name focused on a new line or area as on a new point -- the kind picked in the form after.
- [ ] `e2e/tests/drawing.spec.mjs` -- the matrix rows at 1366 px as `mapeditor`: a pipeline by kind button with Snap on from CTB1 to SWD1 (`ends` stored), the same with Snap off (`ends` null), a geofence by double-click, a one-vertex line that cannot finish, a self-intersecting ring flagged, Backspace and Esc, the toast's Undo; every step by keyboard and clicks with no drag; at 390 px no toolbar.
- [ ] `docs/contract.md` ("What the map draws": floating and snapped ends) and `docs/architecture.md`'s module table -- the docs follow.

**Acceptance Criteria:**
- Given the dev Gateway as `mapeditor` at 1366 px, when Pipeline is pressed, CTB1 and SWD1 are clicked with Snap on and Enter pressed, then one batch saves a line of kind `line` whose `ends` name CTB1 and SWD1, drawn snapped, with Details open on Name and the toast offering Undo; with Snap off the same line saves `ends` null and draws floating.
- Given a geofence drawn by three clicks and a double-click, when `map.load` is read, then its geometry is a LineString of three vertices and the map draws a closed fill.
- Given one vertex placed, when Enter, Finish or a double-click is tried, then no batch is sent and the drawing bar says a line needs two points; given a self-intersecting ring, then the bar says so and Finish stays inert.
- Given a drawing in progress, when Backspace is pressed, then the last vertex goes and the bar's count follows; when Esc is pressed, then nothing is saved and the pill reads Select.
- Given a viewer and a phone editor, when a line is sent through the test hook, then the Gateway refuses it `role` with the same words the old specs asserted.
- Given the whole e2e suite, when it runs on the dev stack, then every spec passes with its expectations kept and no `.mapstudio-draw-button` remains anywhere.

## Implementation Notes

- Decision (owner, 2026-11-04, approving the plan): no UX workshop for this entry; the toolbar, pill, drawing bar, snap indicator and toast follow DESIGN.md and EXPERIENCE.md as written; the floating end's mark is shown to the owner in the renders before and after.
- Environment (planner, 2026-11-04): Java 17 at `/usr/lib/jvm/java-17-openjdk-amd64`; the Gradle cache is warm (`--offline` works); `web/node_modules` and `e2e/node_modules` installed; Chromium at `/opt/pw-browsers/chromium` (never `playwright install`). Docker was started by hand (`dockerd`; if `docker info` fails after a container restart, start it again the same way, logging to the session scratchpad); the images are pulled and the dev stack (compose project `ms-2a5e1993`, port 9088) is up with entry 2's build staged; `ops/up.sh --fresh` rebuilds, restages and restarts it with a fresh trial (a restart inside the trial window keeps only the time left, so use `--fresh` before a whole-suite run). The e2e review test at 390 px can fail once on this box with "No Connection to Gateway" (deferred-work.md, entry 1); rerun it alone. Entry 2's notes record Terra Draw's point mode reporting a drag end as `action: 'draw'`.
- Commits (planner): one commit per milestone on the current branch, never a push; each message ends with the two trailer lines the session's attribution reminder gives (`Co-Authored-By` and `Claude-Session`); the configured git identity as it is (no `-c user.name` or `-c user.email`); no em dashes and no model identifier anywhere in files or messages apart from that trailer; never a bare `git stash`.

## Plan Change Log

- 2026-11-04 (implementer): the toolbar sits on the row under the View-mode top bar (the search field and the Needs you bar) while entry 2 keeps that bar over the map in Edit mode: with the kind buttons and Snap it is about 330 px wide, more than the room beside the bar at 1366 px with the properties panel docked (718 px of map); the connection chip moves under it. DESIGN.md's top row holds the toolbar once entry 7 moves the search into the Items list (one CSS value). Hiding the top bar in Edit mode was not taken: `needsyou`, `search`, `popup`, `review` and `connection` use it on `/edit` as the editor.
- 2026-11-04 (implementer): the drawing bar shows as soon as the Line or Area tool is in hand, not only after the first vertex, because the matrix's snap indicator ("Snap to CTB1 - click to connect") must name the target before the first click; with no vertex it reads "Click the map to add the first point" and Finish is inert. The tool stays in hand after a finish, as the Point tool does.
- 2026-11-04 (implementer): the specs that drew at 390 px (`store`, `unsaved`, `changes`) draw at 1366 px on the same page and return to 390 px for the kept state, the screenshot and the reload, since no tool shows below 768 px; `tracer`'s 390 px line goes through the test hook and is asserted drawn from `map.changed`, its Esc and two-vertex finish kept at 1440 px. The phone touch probe became the Legend sheet (open and close by touch alone).
- 2026-11-04 (implementer): the first whole-suite run found the studio vanishing while the store is unreachable (a failed load nulls the delegate's level; the spike's button had masked it); the component keeps the level last reported so the studio stays and the toolbar pauses. Recorded in `docs/platform-checks.md`.
- 2026-11-04 (implementer): the commits are grouped by what compiles rather than one per milestone: the toggle, the specs, the tools, the drawing bar, snapping and the toast share `editing.ts` and `MapStudio.tsx` (one commit), the floating end mark (one), the drawing spec and the docs (one), the toolbar's row and the platform checks (one), the outage fix (one).

## Review Triage Log

## Design Notes

A kind button fixes the kind at draw time; a generic tool saves with the first kind of its geometry and the Kind select in Details changes it, the same rule entry 2 set for the Point tool (owner, 2026-11-04: a finished drawing saves at once). Terra Draw does the drawing, the snapping callback and the validation; Map Studio owns the candidates, the remembered snap targets (so `ends` are stored, never inferred from coordinates), the words and the saves. The Finish button finishes the drawing the way Enter does (the mode's finish key event dispatched on the map container, or the mode's own finish if the library offers one); Backspace is the mode's `undo()`. The toast's Undo is the undo stack's last step, nothing new.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean; every suite green including the geometry, studio and toolbar tests.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` -- expected: BUILD SUCCESSFUL.
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK at 0.4.0 (no version change).
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: the whole suite green with `drawing.spec.mjs` and the migrated specs (the review 390 px flake of deferred-work.md may fail once; rerun it alone).
- `grep -rn "mapstudio-draw-button\|DEV_LINE_KIND\|data-line-points" web e2e docs` -- expected: nothing.

**Manual checks (if no CLI):**
- The owner draws a pipeline with Snap on and a geofence on the dev stack, presses Undo from the toast, and sees the pill, the bar and the toast as DESIGN.md draws them.
