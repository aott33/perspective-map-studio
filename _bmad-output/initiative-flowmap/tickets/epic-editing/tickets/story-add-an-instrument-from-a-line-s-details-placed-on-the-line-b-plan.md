---
title: "Add an instrument from a line's Details: placed by click or typed distance, moved only along the line"
type: 'feature'
ticket: '9'
created: '2026-11-09'
status: 'draft'
baseline_revision: '70f6fa9bd27895019fffe0bb713b816afb81e3c9'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md', '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md', '{project-root}/docs/instruments.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The store and the Gateway know instruments on lines (attachment `{lineId, distanceM}`, AD-19), but an editor cannot add one, and an existing one cannot be moved: its lat and lng fields send a move the Gateway refuses, and a tap can be placed loose with the Point tool.

**Approach:** Decisions (owner, 2026-11-06, entry 3: no toolbar tool; a selected line's Details holds an Instruments row and Add an instrument; placed by a click on the line or a typed distance; moved only along the line, never off it, WCAG 2.5.7). Instruments are made and moved from their line, in one op each, with the shared geometry module's projection.

## Boundaries & Constraints

**Always:** **Line Details** (a line, not an area) gains, after Location, an **Instruments** row listing its instruments by name in order along the line, each with its distance (the line popup's `distanceText`) and a click selecting it, "None yet" when empty; and **Add an instrument**: one instrument kind in the project arms it at once, several open a short list of instrument kinds to pick from. **Placing:** while armed, the drawing bar reads "New <kind> on <line> - click the line or type its distance", with a distance field in metres ("of 2,936 m" beside it), a Place button and Cancel; a map click within 12 px of that line places the instrument at the click's projection; a click anywhere else is refused in the bar in words ("Click on L-SWD: an instrument sits on its line") and nothing is saved; a typed distance from 0 to the line's length places it there, outside that range refused in words; Esc or Cancel puts it down. One create op with its point and attachment (`placeOp`'s shape); one undo step "add <kind>"; then the new instrument's Details opens with Name focused, as a placed pad's. **Instrument Details:** Location reads "On <line> at <distance>", a "Distance along the line (m)" field that moves it on Enter or blur, latitude and longitude read-only, no Move; the Kind select lists instrument kinds only. **Dragging:** a selected instrument drags in Edit mode with the Select tool; the pointer is projected onto its line throughout (the marker never leaves the line, a pointer off the line projects back); release writes one update op with point and attachment, one undo step "move <name>"; snapping never applies. **Elsewhere:** instrument kinds leave the Point tool's kind list and the toolbar's kind buttons (an instrument is only added from a line); everything entry 5 and entry 8 do with a line's instruments (reshape, move, split, delete, one undo) stays; the Gateway's attachment rules stay the judge, a refusal shown on the save status row as today. **Dev:** a Meter kind (`meter`, instrument) in the dev project, drawn with a new `meter` glyph in the core icon set (a flow meter on a line, distinct from meter station, prd), in the set's style. No em dashes.

**Never:** A toolbar instrument tool; free instruments; snapping for instruments; a change to the Gateway's attachment rules, the store, a message or the instrument's drawn look beyond the new glyph (epic-viewing's); instruments in View mode or on the phone.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Row | L-SWD selected | Instruments: PT-1 1.1 km, LV-1 2 km, PT-2 2.8 km, in order | No error expected |
| Click place | Add an instrument, Tap, a click on L-SWD near PT-1 | A new tap stored within 1 m of the click's projection; Details with Name focused | No error expected |
| Typed place | Add an instrument, Meter, 2841 typed, Place | A meter at 2841 m, listed in order in the row and the line popup | No error expected |
| Off the line | Armed, a click on empty map or on another line | Refused in the bar in words, nothing saved | The words |
| Out of range | Armed, 99999 typed | Refused in words | The words |
| Drag | PT-1 dragged along and then off the line | It stays on the line; released off the line it lands at the projection | No error expected |
| Typed move | PT-1's distance set to 1143 | PT-1 at 1143 m | No error expected |
| Undo | After an add and a move | Each one undo step | No error expected |
| Reshape and delete | L-SWD reshaped, then deleted, then Undo | Instruments kept at their nearest places; deleted with it; one Undo restores all | No error expected |
| No loose taps | The Point tool's kinds and kind buttons | No tap, meter or valve | No error expected |

</frozen-after-approval>

## Code Map

- `web/typescript/geometry.ts` -- `project` 65 (Turf nearest point, `round1`/`round6`), `pointAt` 50, `lengthM` 45, `instrumentsOn` 73, `placeOp` 98 (point and attachment in one op: the model for create and move); keep-instrument batches 116-386; delete batches 405-431. New pure helpers for an instrument create batch and a move batch, Jest.
- `web/typescript/MapStudioStoreDelegate.ts` -- `createPoint` 634 (model), `moveItem` 749 (the lat/lng path that today sends geometry only: instruments must not use it), `sendShapeChange` ~771; add `createInstrument(lineId, kind, distanceM)` and `moveInstrument(id, distanceM)`; undo labels in `undoStack.ts` `stepLabel` 188.
- `web/typescript/editing.ts` -- `wantedHandles` 475-499 (null for an instrument today; dragging is own handling, not Terra Draw), `onGeometryClick` 687 (the armed placement's click), `refuseInBar` 721 (words in the bar), `onPointFinish` 1195-1238 (Details with Name focused after a placement), `pickTool` 917, `putToolDown` 936.
- `web/typescript/studio.ts` -- `toolOf` 187, `kindsFor` 192, `toolKind` 209, `kindButtons` 218: drop instrument kinds; an armed instrument placement state beside the tools.
- `web/typescript/studio/DrawingBar.tsx` (99 lines; point branch 54-69) and `drawing.ts` (`newItemText` 133, `barTitle` 141) -- the placement bar with its distance field; `GeometryBar.tsx` for refusals.
- `web/typescript/studio/PropertiesPanel.tsx` -- `render` 517, Location 597-650 (a line's "A line of N points" 633; the point branch 519), the Instruments row after it; an instrument's Location; Kind select 588; `items` already passed (`MapStudio.tsx` 1796-1826), `canMoveByClick` 1815.
- `web/typescript/linePopup.ts` `distanceText` 31, `LinePopup.tsx` 179-205 rows (reuse the order and words).
- Dev: `ops/project/ignition/script-python/mapstudio_dev/code.py` kinds 41-47 (add Meter); `web/icons/sources.json` and the icon build for the `meter` glyph; `icons.test.ts`. ignition-lint.
- Tests: Jest `geometry.test.ts` (projection 60-130), `deleteItem.test.ts` 89 (a tap by raw batch today), `editClick.test.ts` TAP 52; e2e `instruments.spec.mjs` (store side, keep), `geometry.spec.mjs` 141/211/379, `delete.spec.mjs` 220, `linepopup.spec.mjs`; new `addinstrument.spec.mjs` at 1366 px.
- Docs: `docs/instruments.md` (adding and moving in the studio), `docs/contract.md` 328-375 unchanged in rules, `CHANGELOG.md` 0.4.0, playbook section "Instruments".

## Tasks & Acceptance

**Execution:**
- [ ] Geometry create and move batches, delegate methods, undo labels, Jest.
- [ ] `studio.ts` and the armed placement, the drawing bar, refusals.
- [ ] Line and instrument Details, the Kind select.
- [ ] Dragging along the line.
- [ ] Dev Meter kind and glyph, ignition-lint; e2e `addinstrument.spec.mjs` and the changed specs.
- [ ] Docs, CHANGELOG, playbook.

**Acceptance Criteria:**
- Given the seeded dev map as `mapeditor` at 1366 px, when the matrix runs, then each row holds.
- Given a fresh dev stack, when the whole e2e suite runs, then every spec passes.

## Implementation Notes

- Planner, 2026-11-09: the environment, commit and identity rules are entry 8's plan's (Docker by hand after a restart, JDK 17 by apt if gone, `ops/up.sh --fresh` before a whole-suite run, the session's trailers, `git commit --only`, no em dashes, never a bare `git stash`, never a push). Commit at each working milestone. Render the new `meter` glyph beside `tap`, `line-valve` and `meter-station` at 18 px into the plan's notes for the owner.

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL.
- `ignition-lint --files` on the changed dev script -- expected: zero errors and warnings.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: green.
