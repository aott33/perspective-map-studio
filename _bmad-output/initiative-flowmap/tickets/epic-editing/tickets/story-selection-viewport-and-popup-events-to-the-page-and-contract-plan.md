---
title: "Selection, viewport and popup events to the page, and contract 0.4.0"
type: 'feature'
ticket: '14'
created: '2026-11-07'
status: 'in-review'
baseline_revision: '2859994be52e3c0f4679ac9f9725e4c91c62ae79'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A page can see what the map selects (`selectedItem`, `onItemSelected`, entry 2) but cannot select an item on the map, and it learns nothing of where the map is looking or which popup is open: a table beside the map cannot drive it, and a page cannot follow it.

**Approach:** Decisions (owner, 2026-11-03: the gap review's item 1, initiative R48 and R49; 2026-11-06: in Edit mode a click opens Details, entry 26; 2026-11-07 in the round table, "I don't have a preference": a page's choice made while a tool is in hand waits for the tool to go down, the room's pick). An id the page writes to `selectedItem` does what a click on that item does; the map writes a read-only `viewport` once per move end; `onViewportChanged`, `onPopupOpen` and `onPopupClose` fire for the page; all are declared, documented in contract 0.4.0 and shown on a dev page.

## Boundaries & Constraints

**Always:** A page-written `selectedItem` id selects the item and moves the map to it: in View mode as a search choice does (a point centred with its popup, a member of a shared marker with its own popup at the shared marker, a line fitted with its popup), in Edit mode as an Edit-mode click does (Details open, no popup, the item in view); `null` clears the selection and closes the popup; an id not on the map clears the selection with one `console.warn` naming it; the component's own write coming back is ignored; a value the page set before the items load is applied once they load and wins over the remembered place's selection; a value written while a Point, Line or Area tool is in hand waits and is applied when the tool is put down, the drawing never touched (the latest write wins). A loop of page and map (a table row writing `selectedItem`, the map's `onItemSelected` selecting the row, the row writing the same id) settles with one `onItemSelected`. `onItemSelected` carries the AD-7 object as `mapItem` (R21 and R48 name it so; entry 2 shipped `item`; 0.4.0 is unreleased, so the schema, the docs and the dev script follow), null when cleared. `viewport` is `{center: [lng, lat], zoom, bounds: [[west, south], [east, north]]}`, written when the map first settles and at every move end, never during a move, and `onViewportChanged` fires with the same object at the same moments; a page's write to `viewport` is not read. `onPopupOpen {itemId, segment}` and `onPopupClose {itemId}` fire wherever the Gateway is told `popup.open` and `popup.close` (a new segment of the same line is a new open; segment null for a point); Edit mode opens no popup, so none fire there. The four events are declared in the descriptor with a schema each, so the Designer lists them. Every write and fire is try-guarded as `publishToPage` is. Ignition files changed pass ignition-lint with zero errors (the session's CLAUDE.md). No em dashes.

**Never:** Fire per frame (R37). Change a message between the browser and the Gateway, `gateway/` or `designer/` Java, or a map behaviour a click already has. Delete a test or weaken its expectation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Table selects | The /events page's table row P14 chosen (writes `selectedItem`) | P14 selected, centred, its popup open; `onItemSelected` once with `mapItem` P14 | No error expected |
| Map selects | A click on CTB1 | The table selects CTB1's row through `onItemSelected` | No error expected |
| Line | The page writes L-SWD's id | L-SWD fitted, its popup open; `onPopupOpen {itemId: L-SWD, segment}` | No error expected |
| Edit mode | The page writes CTB1's id in Edit mode | CTB1 selected with Details, no popup, no `onPopupOpen` | No error expected |
| Table and map loop | The table row P14 chosen, its script and the map's event each answering the other | One `onItemSelected`, one camera move, the row and the map both on P14 | No error expected |
| Tool in hand | Edit mode, the Line tool with two points, the page writes CTB1 | The drawing continues; CTB1 selected with Details when the tool is put down | No error expected |
| Unknown or null | The page writes "nope", then null | Selection cleared, one warning naming "nope"; null closes the popup | The warning, nothing else |
| Viewport | A pan | One `onViewportChanged` at its end with the bounds, none during it; `viewport` equal to it | No error expected |
| Popup close | P14's popup closed | `onPopupClose {itemId: P14}` once | No error expected |
| Phone | The same writes at 390 px | The sheet opens as a tap does | No error expected |

</frozen-after-approval>

## Code Map

- `web/typescript/selection.tsx` -- `ITEM_SELECTED_EVENT` (906), `publishSelection` (912, deduped by `host.publishedSelection`; keep it the one fan-out), `publishToPage` (940: `store.props.write('selectedItem', id)`, then `store.componentEvents.fireComponentEvent('onItemSelected', {item})`, each try-guarded: the payload key becomes `mapItem`), `selectedItemObject` (973, the AD-7 object), `selectWithDetails` (298, Edit mode), `openPick` (470), `onPick` (503), `openPopup` (524), `openLinePopup` (369); `sendPopupOpen`/`sendPopupClose` call sites (395, 399, 491, 541, 544, 774).
- `web/typescript/MapStudioStoreDelegate.ts` -- `sendPopupOpen` (412), `sendPopupClose` (416): firing the page events beside these covers every call site; check that the delegate can reach the store's `componentEvents`, else fire beside the call sites.
- `web/typescript/MapStudio.tsx` -- `componentDidUpdate` (443) calls `applyEditMode` (464, its doc says `selectedItem` "is read here too and does nothing"): a page-written `selectedItem` is read beside it with the same `prevProps` pattern and an echo guard; `getPropsReducer` (1467) reads `selectedItem`; `moveend` (332-335) runs `camera.publishView` and `camera.savePlace`: the viewport write and `onViewportChanged` go there; `onRowSelect` (about 870) is the Edit-mode move to an item.
- `web/typescript/camera.ts` -- `goToItem` (340, the search choice: a point jumped to with its popup and `sendPointClick`, a line fitted; it logs `console.info` for a missing item), `applyRestore` (181, the remembered place, gated on `itemsReady`), `publishView` (389), `cameraPadding` (236), `fitTo` (274).
- `common/src/main/resources/mapstudio.props.json` -- `selectedItem` (104, its "not read yet" text goes), a new `viewport`; `mapstudio.events.json` (the `onItemSelected` schema, `item` becomes `mapItem`) and new schemas for the three events; `common/.../MapStudioComponent.java` (`EVENT_ITEM_SELECTED` 34, `DESCRIPTOR` 43-60, `setEvents` 52-53); `MapStudioComponentTest.java` (36-38 expects one event).
- Dev project: `ops/project/com.inductiveautomation.perspective/views/MapStudioEdit/view.json` (the map with an `onItemSelected` script, 186-198, and the labels `mapstudio-dev-selected` and `mapstudio-dev-event`) is the model for a new `MapStudioEvents` view: the map, a Perspective table of the items wired both ways, and a label per event with its last payload and one for `viewport`; `page-config/config.json` gains `/events`.
- e2e: `studio.spec.mjs` (138-146, the selection labels) and `editclick.spec.mjs` touch `selectedItem`; a new `events.spec.mjs` beside them, at 1366 and 390 px.
- Docs: `docs/contract.md` "The component's props" (143, `selectedItem` row near 152, `viewport` added, `editMode`'s bidirectional behaviour stated) and "The component's events" (156-164, rows for the three, the `mapItem` key, the "entry 14's" sentence replaced); `docs/platform-checks.md` (1019-1030) gains whether an object prop written by the component reaches a binding, [live 8.3.10]; `CHANGELOG.md` 0.4.0. `scripts/ci/check-contract-versions.sh` checks line 1 and two headings only: keep them.

## Tasks & Acceptance

**Execution:**
- [x] `common/` schemas, `MapStudioComponent.java` and its test -- the four events declared, `viewport` in the props, `mapItem` -- the Designer lists them.
- [x] `web/typescript/MapStudio.tsx`, `selection.tsx`, `camera.ts`, `MapStudioStoreDelegate.ts` and Jest -- the page's write read, the viewport and the popup events -- the matrix in code.
- [x] `ops/project/` -- the `/events` page and its view, ignition-lint clean -- the table beside the map.
- [x] `e2e/tests/events.spec.mjs` -- the matrix at 1366 and 390 px as `mapeditor`.
- [x] `docs/contract.md`, `docs/platform-checks.md`, `CHANGELOG.md`.

**Acceptance Criteria:**
- Given the dev Gateway as `mapeditor` at 1366 and 390 px, when the matrix runs, then each row holds.
- Given the whole e2e suite on a fresh dev stack, when it runs, then every spec passes.

## Implementation Notes

- Approval (owner, 2026-11-07): "Approved" after a round table on the plan (the page's choice waits for a tool to go down; the table and map loop settles with one event; the `mapItem` rename agreed; the viewport's Gateway cost carried to entry 18); the plan, over size, kept whole; it went ready-for-dev and implementation started in this session.
- Planner, 2026-11-07: the environment, commit and identity rules are entry 4's plan's (Docker started by hand after a container restart, `ops/up.sh --fresh` before a whole-suite run with nothing else against the stack, the two trailer lines from the session's attribution reminder, `git commit --only` your paths, no em dashes, no model identifier, never a bare `git stash`, never a push). Commit at each working milestone. ignition-lint: `pip install ignition-lint-toolkit` in a scratch venv, then `ignition-lint --files <view.json or code.py>`; zero errors and zero warnings, naming hints recorded.

## Plan Change Log

- 2026-11-07 (implementer): P14. The dev map has no item named P14: the tracer's Point 2, linked to the dev asset P14, stands in for it, as `editclick.spec.mjs` already names it ("P14's pad (Point 2)"); CTB1 and L-SWD are the seed's own.
- 2026-11-07 (implementer): the code. A new pure module `web/typescript/pageEvents.ts` holds the four event names, the viewport object (centre and corners to 6 decimals, the zoom to 2, as `data-zoom` reads it), the try-guarded prop write and event fire every path shares, and the echo guard. `selection.tsx` reads the page's choice (`readMountSelection` at mount, `readPageSelection` in `componentDidUpdate` beside `applyEditMode`) and applies it (`applyPageSelection`, before `applyRestore`); `publishToPage` fires `{mapItem}`. `camera.ts` `goToItem` takes `linePopup` for the page's choice (a line fitted, then its line popup at its middle and the segment there, `lineMiddle`; an area fitted and selected, as a View-mode click on one opens nothing) and `publishViewport`. The delegate reaches `componentEvents` on its store (the SDK types it as the element store), so `onPopupOpen` and `onPopupClose` fire beside `sendPopupOpen` and `sendPopupClose` and every call site is covered.
- 2026-11-07 (implementer): the echo guard is a list of the component's own writes not yet seen back, not one last value: two writes can come back as one change, and a click on CTB1 then on P14 before a sync must not read CTB1's echo as the page's. A write of the value the prop already holds (the page's own choice published) changes nothing and is not noted. At mount, a prop equal to the remembered place's selected id is left to the restore: it is the component's earlier write, which the page's Gateway session keeps across a reload, and taking it as the page's would jump a reloaded map to the item instead of its remembered camera (retest R4 (a)); any other value wins and drops the restore.
- 2026-11-07 (implementer): order and waits. `applyEditMode` says whether it set the mode, and a page's choice read in that update is applied on the next, so a page writing `editMode` and `selectedItem` together has the item chosen in the new mode. In View mode the choice waits for the first full batch (the kind display a popup is drawn from), at most `RESTORE_WAIT_MS`, as the restore does; Edit mode does not wait. The Edit-mode move is `onRowSelect` (the Code Map's "Edit-mode move to an item"), not `selectWithDetails`, whose `keepPlace` moves nothing while Details is already open and so would leave a page's item off the map.
- 2026-11-07 (implementer): the viewport is published at the map's first idle with the readiness and at every `moveend` after it; a move end with the same rounded viewport writes and fires nothing; `.mapstudio-map` carries `data-viewport` for the suite. Its schema says `readOnly: true`, as `ia.components.json` marks a prop a component writes; the component's own write is not stopped by it. The three new schemas are `mapstudio.events.viewport.json`, `mapstudio.events.popup-open.json` and `mapstudio.events.popup-close.json`. `MapStudioComponentTest` keeps its test names: one event becomes the four in order, `event.item` becomes `event.mapItem` in the description and the schema's one key, the props list gains `viewport`; one test is added for the three new schemas.
- 2026-11-07 (implementer): the dev page. `MapStudioEvents` at `/events`, and at `/events/:select`, a route added so a value set before the items load is seen live (the view's startup script writes the param; the browser's back from `/edit` starts the view again). The project library `mapstudio_events` gives the table's rows, a row's index and the viewport's words. The table and the labels sit in a column left of the map, hidden below 768 px (`page.props.dimensions.viewport.width`) so the phone map has the width. Perspective's Table keeps `selection.data` when a script sets `selectedRow` to None, so the table's label reads `selectedRow`; the scripts write only a changed value, which is what settles the loop. Each event label is `count|payload`, its count in the label's `custom.count`, so the spec counts events. The `/edit` page's `onItemSelected` script reads `event.mapItem`; `docs/development.md` lists the new page and library.
- 2026-11-07 (implementer): tests. `pageEvents.test.ts` (24 tests) drives the component itself, its libraries stubbed as in `editClick.test.ts`: the matrix in View and Edit mode, the echo guard (two clicks before one sync), the loop, the mount and remembered-place cases, the tool in hand, the first-batch wait, the viewport's once-per-change write and fire, the delegate's popup events, and `editMode` with `selectedItem` written together with setState batched as React does (it fails without the guard). `editClick.test.ts` and every other suite unchanged.
- 2026-11-07 (implementer): verified. `cd web && npx tsc --noEmit && npx jest`: clean, 561 tests in 54 suites (537 before). `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline`: BUILD SUCCESSFUL, `MapStudioComponentTest` 4 of 4 with four events. `bash scripts/ci/check-contract-versions.sh`: OK at 0.4.0 (`test-contract-versions.sh` OK). ignition-lint as below. `ops/up.sh --fresh` then the whole e2e suite: 199 passed, 7 skipped (the opt-in ones), 1 failed in 40.6 min, the failure the known review 390 px flake (dark theme, "No Connection to Gateway" in its snapshot), which passed rerun alone in both themes; `events.spec.mjs` 9 of 9 among them, and 9 of 9 alone before. The docs' live facts are in `docs/platform-checks.md`, "Epic 4 entry 14".
- 2026-11-07 (implementer): ignition-lint-toolkit 1.6.0, `ignition-lint --files`: `MapStudioEvents/view.json` 0 errors, 0 warnings, 18 naming hints (the dev views' lower camel case component names); `MapStudioEdit/view.json` 0 and 0, its 11 hints as before; `mapstudio_events/code.py` no issues. The full profile (`--target <copy> --profile full`) reports only findings the existing `/edit` view and libraries share, all false positives or the dev views' accepted pattern: `SCHEMA_VALIDATION` on `ao.mapstudio` (the linter knows only `ia.*` types), `EXPR_UNKNOWN_FUNCTION` "in" (the words "Signed in as" inside a string), `JYTHON_BAD_COMPONENT_REF` and `JYTHON_RECOMMEND_ERROR_HANDLING` on `getChild` and `getSibling` (inside each script's try), `IGNITION_UNKNOWN_SYSTEM_CALL` for `system.mapstudio.getMap` (the module's own function).

## Review Triage Log

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` -- expected: BUILD SUCCESSFUL, `MapStudioComponentTest` passing with four events.
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK at 0.4.0.
- `ignition-lint --files` on each changed view and script -- expected: zero errors and zero warnings.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: green (the review 390 px flake may fail once; rerun it alone).
