---
title: "In Edit mode a click selects and opens Details, no popup"
type: 'feature'
ticket: '26'
created: '2026-11-06'
status: 'built'
baseline_revision: '1153ef47de8776749793951b0cc2b183c8e798f2'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 1
context: ['{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** In Edit mode a click on a map item opens its popup, which covers the item and gets in the way of dragging it (owner, testing entry 5 on the dev stack). And Esc with the Line or Area tool in hand puts the tool down and closes Details in the same press (deferred from entry 25).

**Approach:** Decisions (owner, 2026-11-06: "go with A as entry 26"; "Yes" to starting it with the Esc fix). In Edit mode a click selects the item and opens Details, as EXPERIENCE.md Select says; no popup, line popup or phone sheet opens in Edit mode, and an open one closes when Edit mode is entered. Esc with a tool in hand puts the tool down and nothing else.

## Boundaries & Constraints

**Always:** In Edit mode (the studio on: level `full`, 768 px and wider) a click on a point selects it with Details open, and it drags at once (entry 5); a click on a line or an area selects it with Details open and its handles; a shared spot still opens its pick list, whose choice selects and opens Details; a click on the ground clears the selection and closes Details, as today. Every other way into a popup also gives Details in Edit mode instead (Return's restore, a choice that opens a popup); the point click round trip (`sendPointClick`) still goes. Turning Edit mode on closes an open popup, line popup or pick list and tells the Gateway (`popup.close`). Esc with the Point, Line or Area tool in hand puts it down and Details stays open; a second Esc closes Details. View mode's clicks, popups, sheets and Esc are unchanged. Colours from theme tokens; no em dashes.

**Never:** Change View mode, a popup's content, the Live now block (entries 6 and 7), the Gateway, `common/`, a message, a prop or the contract version. Delete a test or weaken its expectation; a spec that clicked for a popup in Edit mode moves to View mode or to Details.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Point | Edit mode, Select, click CTB1 | CTB1 selected, Details open, no popup; dragging it moves it | A refused save on the save status row, as today |
| Line | Edit mode, click L-SWD | L-SWD selected with its handles and Details, no line popup | No error expected |
| Shared spot | Edit mode, click a shared marker | Pick list; a row selects that item and opens Details, no popup | No error expected |
| Popup open, switch on | View mode, P14's popup open, Edit switch on | Popup closed, `popup.close` sent | No error expected |
| Esc with a tool | L-SWD in Details, Line tool with two points, Esc | Drawing cancelled, Select in hand, Details still open; Esc again closes it | No error expected |
| View mode | The same clicks in View mode | Popups as before | As today |

</frozen-after-approval>

## Code Map

- `web/typescript/selection.tsx` -- `onPointClick` (153), `onMapClick` (188), `openLinePopup` (254), `onPick` (380), `openPopup` (399): the one place every popup opens through (the camera's restore and choices call `host.openPopup`, `camera.ts` 201, 358); the Edit-mode branch belongs here, through `host.studioOn()`, setting `panel` as `MapStudio.onRowSelect` does (`MapStudio.tsx` 860). `onRootKeyDown` (125): Esc closes the popup, else Details; it returns early on `ev.defaultPrevented` or a tool in hand.
- `web/typescript/selection.tsx` `onMapClick` -- it queries only `LAYER_ITEM_MARKERS` and the line layers, so an area's click falls to `clearSelection`; in Edit mode it also queries the area layers (`mapLayers.ts` 34-36: `LAYER_AREA_FILL`, `LAYER_AREA_LINE`, `LAYER_AREA_LINE_DASHED`; areas are `features.ts` `buildFeatures`' `areas` collection) after the markers and the lines, and an area is selected with Details as a list row selects one (`Selection` kind `'line'` for a non-point, `features.ts` 82; `MapStudio.onRowSelect`); View mode's area click stays as it is.
- `web/typescript/MapStudio.tsx` -- `setEditMode` (481): entering Edit mode closes the popup here, keeping the selection: `selection.closePopup` removes the MapLibre popup, whose close event runs `onPopupClosed` (`selection.tsx` 634-650), which clears the selection and so publishes `selectedItem: null` to the page; the switch must close the card with `popup.close` sent and the selected item kept selected (no Details opened for it). `onRootKeyDown` (763); `selectionState` (747) keeps `panel` only for the same id. The panel docks left of `.mapstudio-stage` (1293-1296): at 1366 px the stage narrows from about 1038 to 718 px when Details opens and MapLibre keeps the centre, so every item moves about 160 px right (Design Notes).
- `web/typescript/editing.ts` -- `onKeyDown` (1206), a capture listener on the map container: its Esc puts the tool down outside React's batching, so the root's Esc then finds no tool and closes Details; `ev.preventDefault()` there when it puts a tool down lets the root skip it.
- Handles: entry 5's geometry module shows them for the selected line or area in Edit mode (`editing.ts`, `geometry` state); reuse, do not change.
- Tests: Jest beside `__tests__/selection*.test.ts` and `__tests__/shortcuts.test.ts`; e2e `studio.spec.mjs` (416, a card placed beside the docked studio), `tracer.spec.mjs` (72), `delete.spec.mjs` (455) and any other spec that clicks for a popup in Edit mode; new cases in `studio.spec.mjs` or a new `editclick.spec.mjs` restoring the seed after itself.
- Docs: `docs/contract.md` (the studio's behaviour paragraphs, and "The map's place for the browser session", around line 198, whose restore opens a card "as a click opens it": in Edit mode Details instead), `docs/instruments.md` line 26 (a line click opens its popup: in View mode), `CHANGELOG.md` 0.4.0; `_bmad-output/deferred-work.md`'s Esc entry is marked resolved by this entry. Words that claim a behaviour (an area's click, the camera) match the code and its tests.

## Tasks & Acceptance

**Execution:**
- [x] `web/typescript/selection.tsx` -- in Edit mode a point, line, area, pick row or restore selects with Details open and opens no popup, and the clicked item keeps its place on the page as Details docks (Design Notes) -- the click goes to Details, not a card, and the item stays under the pointer.
- [x] `web/typescript/MapStudio.tsx` -- entering Edit mode closes an open popup or pick list and keeps the selection -- no card stays over the studio, and the page sees no change of selection.
- [x] `web/typescript/editing.ts` -- Esc that puts a tool down is handled there alone -- one press, one step.
- [x] Jest -- the Edit-mode branch (an area too), the switch closing a popup with the selection kept, the item's place kept as Details docks, the Esc step.
- [x] e2e -- the matrix at 1366 px as `mapeditor`, the drag pressing where it clicked without reading the item's position again, an area clicked, the switch keeping P14 selected; the specs that clicked for a popup in Edit mode moved to View mode or Details.
- [x] `docs/contract.md`, `docs/instruments.md`, `CHANGELOG.md`.

**Acceptance Criteria:**
- Given the dev Gateway as `mapeditor` at 1366 px, when the matrix runs, then each row holds.
- Given the whole e2e suite on a fresh dev stack, when it runs, then every spec passes.

## Implementation Notes

- Approval (owner, 2026-11-06): "Approve and continue"; the plan went ready-for-dev and implementation started in this session.
- Planner, 2026-11-06: the environment, commit and identity rules are entry 4's plan's (Docker started by hand after a container restart, `ops/up.sh --fresh` before a whole-suite run with nothing else against the stack, the two trailer lines from the session's attribution reminder, `git commit --only` your paths, no em dashes, no model identifier, never a bare `git stash`, never a push). Commit at each working milestone.

## Plan Change Log

- 2026-11-06 (implementer): the Edit-mode branch is one function, `selection.tsx` `selectWithDetails` (the selection, `pick` cleared, `panel` set as `onRowSelect` does; an open card or pick list closed through `closePopup`, so `popup.close` goes as for a hand close), called first in `openPopup` and `openLinePopup` while `studioOn()`; so a marker, a line, a pick list's row, the camera's restore and a choice all reach it, `onPointClick` and `onPick` still send `point.click`, and no `popup.open` is sent. A line is selected with no segment in Edit mode: the segment and its highlighted instruments are the line popup's.
- 2026-11-06 (implementer): the camera is not moved on an Edit-mode click: as Details docks the stage narrows and the map keeps its centre (the clicked item moves by half the panel's width, as after a Point tool placement since entry 2); keeping the selection in view is entry 7's (EXPERIENCE.md Responsive, 1366). `MapStudio.setEditMode` closes the popup on entering (the switch and the page's prop); the studio cannot come on another way with a popup open (the level arrives with the items, and a phone width leaves Edit mode and is not re-entered by widening).
- 2026-11-06 (implementer): no `selection*.test.ts` existed; the new `web/typescript/__tests__/editClick.test.ts` drives the `MapStudio` component itself (its map click, keys, Edit switch and pick row through `selection.tsx`, `editing.ts` and `camera.ts`), with `maplibre-gl`, `terra-draw`, its MapLibre adapter and the Perspective client stubbed; 9 of its 12 tests fail on the baseline sources, the 3 View-mode ones pass on both.
- 2026-11-06 (implementer): e2e: the matrix is the new `e2e/tests/editclick.spec.mjs` (P14 is Point 2, linked to the dev asset P14; `popup.open`, `popup.close` and `point.click` are read from the frames the page sends on the Perspective session socket). `delete.spec.mjs` line 455 (`noDelete`) clicks with the studio off (390 px, a phone editor, a viewer), so it is unchanged; its hover test's comment on Esc follows the fix and it now checks that Details stays after Cancel. `popup.spec.mjs`'s two editor tests click on the dev View page `/` (the 390 px sheet stays on `/edit`, which keeps View mode there); `studio.spec.mjs`'s two marker clicks (the selection test, the Layers legend test) and `tracer.spec.mjs`'s 1440 px click assert Details with no popup. A render for the docs, `docs/screenshots/mapstudio-editclick-point-1366.png`, under `E2E_DOCS=1`.
- 2026-11-06 (implementer): verified on the built tree: `tsc` clean, 450 Jest tests green (48 suites), the Gradle clean build green offline, the contract check OK at 0.4.0, no em dashes; `editclick.spec.mjs` 6 passed alone, `popup`, `tracer`, `delete` (18) and `studio` (20) passed alone; then `ops/up.sh --fresh` and the whole e2e suite with nothing else against the stack: 177 passed, 7 skipped, 0 failed in 40.1 min (the review 390 px flake did not show).

- 2026-11-06 (review loop 1, bad_plan): triggered by the quick lens finding that the clicked item slides about 160 px from the pointer as Details docks, so it does not drag at once. Amended: the Code Map (the area layers, the switch keeping the selection, the stage narrowing, the two docs), the Tasks, and a Design Notes section on the camera. Known-bad state avoided: a click that opens Details moving the item away from the pointer; an area that a click cannot select; the switch deselecting the page's item. The code of commits ebcd73f, 1acd964, 145e484 and b66c35c is reverted for re-derivation. KEEP (it worked and must survive): `selection.tsx` `selectWithDetails` as the one Edit-mode branch, called first in `openPopup` and `openLinePopup` while `host.studioOn()`, with `point.click` still sent, no `popup.open`, and a line selected with no segment; `editing.ts` `onKeyDown` calling `ev.preventDefault()` when its Esc puts the Point, Line or Area tool down; the Jest harness `__tests__/editClick.test.ts` driving the real `MapStudio` with `maplibre-gl`, `terra-draw` and the Perspective client stubbed, and its twelve cases; `e2e/tests/editclick.spec.mjs` reading `popup.open`, `popup.close` and `point.click` from the session socket's frames, undoing its drag and re-seeding after itself; `popup.spec.mjs`'s two editor tests on the View page `/`, `studio.spec.mjs`'s and `tracer.spec.mjs`'s clicks asserting Details, `delete.spec.mjs`'s check that Details stays after Cancel; the contract's "A click in Edit mode" paragraph, the CHANGELOG bullet, the deferred Esc entry marked resolved, and the render under `E2E_DOCS=1`. Those commits hold them and may be reapplied, then amended.

- 2026-11-06 (implementer, loop 1 re-derivation): the KEEP list reapplied from ebcd73f, 1acd964, 145e484 and b66c35c, then amended. `selectWithDetails(host, selected, lngLat)` takes the clicked place (a marker's or its shared marker's anchor, the spot on a line or an area, a restored line's anchor) and reads its page place (the map's box and the place's pixel) before the render that docks Details; in that render's callback `keepPlace` returns at once when the map's box did not change (Details already open: nothing moves), else calls `map.resize()` there and then (not on the resize observers' turn), pans with no animation by the place's page shift (`popupPlacement.ts` `pageShift`), and, when the place was in the stage before and is not now (22 px, the disc's radius and ring, from each edge: `insideMap`), pans it into the stage less the camera padding with a 48 px margin, animated over 200 ms (`intoView`; the padding through a new `SelectionHost.cameraPadding`). Closing Details is left as today (the stage widens round the centre, so a dock and a close leave the map half a panel from where it was); named in `_bmad-output/deferred-work.md` for entry 7.
- 2026-11-06 (implementer, loop 1 re-derivation): an area is asked for in `onMapClick` only while `studioOn()`, after the markers and the lines, by a 4 px box on `LAYER_AREA_FILL`, `LAYER_AREA_LINE` and `LAYER_AREA_LINE_DASHED` (the untinted area's fill is drawn at opacity 0 and still answers), and selected as `{kind: 'line', segment: null}` through `selectWithDetails`, with no `point.click`. The switch: `MapStudio.setEditMode(true)` calls `selection.dismissPopup`, which removes the MapLibre popup with its close listener off (so `onPopupClosed` does not clear the selection), sends `popup.close` for an open card through the shared `popupGone`, and keeps the selection (a line without its popup's segment, whose highlighted instruments were the popup's); the page's `selectedItem` is not written. In e2e, `groundSpot` in `editclick.spec.mjs` and `studio.spec.mjs` now also skips the inside of every drawn area (`data-areas`), since that is no longer ground in Edit mode; no expectation is weakened. CTB1 at `SWD_VIEW` lies under the panel's strip once Details docks, so the drag test views CTB1 in the stage's middle at zoom 15, and the covered case has its own test (CTB1 brought to 48 px inside the stage, at its height).
- 2026-11-06 (implementer, loop 1 re-derivation): verified on the built tree: `tsc` clean, 461 Jest tests green (48 suites; `editClick.test.ts` now 20 cases, 15 of them failing on the baseline sources and the 5 View-mode or no-tool ones passing on both; `popupPlacement.test.ts` 3 more for `pageShift`, `insideMap` and `intoView`), the Gradle clean build green offline, the contract check OK at 0.4.0, no em dashes and no model identifier in the changed files; `editclick.spec.mjs` 8 passed alone, then it with `popup`, `tracer`, `delete` and `studio` 46 passed; the render `docs/screenshots/mapstudio-editclick-point-1366.png` under `E2E_DOCS=1` (CTB1 at the page pixel it was clicked at, 847 px, with Details docked); then `ops/up.sh --fresh` and the whole e2e suite with nothing else against the stack: 178 passed, 7 skipped, 1 failed in 40.1 min, the failure the review 390 px flake (`review.spec.mjs:301`, dark theme, SWD1's custom view sheet, View mode at 390 px, which this entry does not reach), which passed alone on the rerun (both themes, 2 passed). Commits d5797e2 (code, Jest, e2e) and 03abd23 (docs, render).

## Review Triage Log

Quick lens, 2026-11-06 (loop 1): 4 findings; high 0, medium 3, low 1.

| Finding | Verdict | Evidence | Route |
| --- | --- | --- | --- |
| When Details docks after an Edit-mode click the clicked item slides about 160 px right, so a press where it was lands on the ground and an item near the right edge leaves the map: "it drags at once" fails | medium | The panel docks left of the stage (`MapStudio.tsx` 1293-1296), the stage narrows and MapLibre keeps the centre (the implementer's own change log); `editclick.spec.mjs` re-reads CTB1's pixel before the drag, hiding it; entry 7 leaves the click to entry 26 | bad_plan: the plan never said what the camera does as Details docks; Design Notes now do, and the e2e drag presses where it clicked |
| A click on an area in Edit mode does not select it; the CHANGELOG and contract say it does | medium | `onMapClick` queries only markers and line layers; areas are drawn by `LAYER_AREA_*` (`mapLayers.ts` 34-36); no test clicks an area | moot in the loopback; the Code Map now names the area layers |
| Turning Edit mode on with a popup open also clears the selection and publishes `selectedItem: null` | medium | `closePopup` removes the MapLibre popup, whose close event runs `onPopupClosed`, which calls `selectionState(prev, null)` (`selection.tsx` 648-650) | moot in the loopback; the Code Map now asks for the selection kept |
| `docs/contract.md` (the map's place, around 198) and `docs/instruments.md` 26 still say a restore or a line click opens a popup, with no Edit-mode exception | low | The diff qualified two other paragraphs only | moot in the loopback; the Code Map now names both |

Quick lens, 2026-11-06 (after loop 1): 4 findings; high 0, medium 1, low 3.

| Finding | Verdict | Evidence | Route |
| --- | --- | --- | --- |
| With Details open, a click on a shared marker closes Details and the stage widens, so the marker and its pick list slide about 160 px from the pointer | medium | `selection.tsx` `openPick` (490) clears the selection with `selectionState(prev, null)`, so `panel` goes null; the Design Notes say a click while Details is open moves nothing | patch: in Edit mode the pick list keeps the selection and Details as they are |
| A popup restored in Edit mode can leave its item outside the stage with Details open | low | `keepPlace` (354) brings into view only when the place was inside the map before Details docked; a restore's remembered centre may come from a wider map | patch: bring into view whenever the place ends outside the map, whatever it was before |
| The Edit switch can open Details for the kept selection when `panel` survives from an earlier Edit-mode session | low | `setEditMode(false)` keeps `panel`; a View-mode click on the same id keeps it (`selectionState`, 762); `dismissPopup` keeps it again, against the Code Map and `docs/contract.md` 178 | patch: `dismissPopup` clears `panel` |
| `docs/contract.md` 176 says the Delete key deletes the selected item "with Details open for it"; `onDeleteKey` acts on the selection alone, and this entry makes selected states with no Details | low | `editing.ts` `onDeleteKey`, `deleteSelected` (824-863) never read `panel` | patch: the sentence says the selected item, Details open or not |

Outcome, 2026-11-06: the four patches applied (edb7e3e) and verified by the orchestrator after two container restarts: `tsc` clean, Jest 464 passed in 48 suites, the Gradle clean build offline, the contract check OK at 0.4.0, and `ops/up.sh --fresh` with the whole e2e suite on a fresh dev stack: 179 passed, 7 skipped, 0 failed in 35.2 min. Deferred (`deferred-work.md`): the Point tool's placement shift since entry 2, and closing Details widening the map around its centre; both candidates for entry 7.

## Design Notes

The camera on an Edit-mode click (review, 2026-11-06): when the click docks Details (none open before), nothing on the page moves. Once the stage has narrowed, the map is panned with no animation by the stage's shift, so the clicked item, and every other item, keeps its page position and stays under the pointer: a press where it was clicked drags it. If the docked panel then covers the clicked item or it lies outside the stage, the map pans just enough, with the camera's padding, to bring it into view (EXPERIENCE.md Responsive 1366: opening properties keeps the selection in view). A click while Details is already open docks nothing and moves nothing. The Point tool's placement shift (since entry 2) is not this entry's.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` -- expected: BUILD SUCCESSFUL.
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK at 0.4.0.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: green (the review 390 px flake may fail once; rerun it alone).
