---
title: "Selecting several: checkboxes, Shift-click, Select all, a box and a lasso, the count, delete as one step"
type: 'feature'
ticket: '8'
created: '2026-11-08'
status: 'built'
baseline_revision: '62b8146b667506415703c83f12b46b140e8a3280'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md', '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** An editor can select only one item at a time, so clearing out ten test pads or picking every pad on a route means ten round trips, and a page cannot see a selection of several.

**Approach:** Decisions (owner, 2026-11-03: multi-select here, the bulk form in epic-import-export; 2026-11-05: no mode pill, the count in the panel; 2026-11-06, entry 3: no Box select button, Shift-drag a box and Shift+Alt-drag a lasso with the Select tool; 2026-11-07: the page learns a selection of several, settled here; 2026-11-08, "Approved and continue" on the planner's five picks: both a read-only `selectedItems` prop and an `onSelectionChanged` event, a box and a lasso adding with any part crossing, Select all replacing, "N selected", the dashed edge and tint on the box and lasso while dragging). Selection becomes a set in Edit mode, made in the list and on the map, shown as a count with Clear and Delete, and published to the page.

## Boundaries & Constraints

**Always:** Edit mode only (View mode unchanged). **The set** is `studio.selected` (already a list), ordered by when each joined; the last to join is the current item. **List:** each row starts with a checkbox (DESIGN.md list row); a checkbox toggles its row in or out without opening Details; a plain row click selects that one item alone as today (Details, the map moves); Shift-click on a row selects the range from the last row clicked or ticked to it, in the order shown (`entriesOf`), replacing the set; under each field header "Select all in <field>" and on each group header "Select all in group" replace the set with that group's rows as shown; with a kind filter, the unlinked filter or a search active, "Select all in filter" above the list replaces the set with every row shown; context rows are never selected by these. **Map, the Select tool (no tool in hand):** a plain click selects one as today; Shift-click toggles the clicked item in or out; Shift-drag draws a box and Shift+Alt-drag a lasso, each drawn with a dashed `selection` edge over a `selection-tint` fill, adding to the set on release every point inside it and every line or area any part of which crosses it; Esc during a drag cancels it; MapLibre's Shift-drag box zoom is off in Edit mode and on again in View mode; Select's hover text reads "Select (Shift-drag for a box, Shift+Alt-drag for a lasso)". **Shown:** every selected item takes today's selection ring or casing; with two or more selected, the properties panel shows only "N selected", a Clear button and the footer's Delete (no fields, no geometry handles); with one, Details as today. Clear, Esc (outside a field) and a click on the empty map empty the set; the rail switching surface keeps it; a tool picked up keeps it and puts down handles. **Delete** of several is one batch and one undo step labelled "delete N items" (each line with its instruments, an instrument also selected counted once, ends on surviving lines cleared once), from the footer or the Delete key; Undo restores all. **Page:** a new read-only prop `selectedItems` (array of ids in joining order, `[]` when none) written on every change of the set, and a new event `onSelectionChanged {mapItems: [AD-7 objects]}` fired once per change of the set, both try-guarded as entry 14's; `selectedItem` and `onItemSelected` carry the current item (null when the set empties); a page write to `selectedItem` still selects that one item alone; contract 0.4.0, the descriptor and the Designer's list. No em dashes.

**Never:** The bulk form (shared fields, Mixed values; epic-import-export); a mode pill or toast; multi-select in View mode or on the phone; geometry edits of several; change single selection, its camera moves or entry 14's echo rules beyond reading the set.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Checkboxes | Tick Point 1, Point 2, CTB1 | "3 selected", Clear, Delete; three rings; no Details | No error expected |
| Range | Click Point 1, Shift-click SWD1 in the list | Every row between them in shown order selected | No error expected |
| Select all | "Select all in MESA FIELD"; then Filter Well pad and "Select all in filter" | That field's rows; then every pad shown | No error expected |
| Box | Shift-drag over CTB1 and SWD1 | Both join; L-SWD joins as it crosses the box | No error expected |
| Lasso | Shift+Alt-drag around the Mesa pads | Every pad inside joins | No error expected |
| Shift-click map | Shift-click CTB1 while selected | CTB1 leaves the set | No error expected |
| Delete | Three selected, Delete | One batch, one step "delete 3 items"; Undo restores all three | No error expected |
| Line and instrument | L-SWD and PT-1 (on it) selected, Delete | One batch, PT-1 deleted once | No error expected |
| Kept | Three selected, rail to Kinds and back | Still three | No error expected |
| Cleared | Click on empty map; or Clear; or Esc | The set empty, the panel closed | No error expected |
| Page | Three selected then cleared | `selectedItems` the three ids then `[]`; `onSelectionChanged` twice | No error expected |
| View mode | Shift-drag in View mode | MapLibre's box zoom as before | No error expected |

</frozen-after-approval>

## Code Map

- `web/typescript/studio.ts` -- `StudioState.selected` 36 (a list), `select` 81, `toggleSelect` 89 (unused today), `clearSelection` 97, `selectedId` 120, `showSurface` 73 (keeps it); add range and set helpers here, pure and Jest-tested.
- `web/typescript/MapStudio.tsx` -- `selected` 142, `selectionState` 943-950 (keeps `panel`/`geometry` for the same id), `onRowSelect` 1100-1127, `renderItemList` 1561-1585 (`selectedId`, `onSelect`), `renderPanel` 1593-1640 (branch for two or more), `onPanelClose` 1204, `onRootKeyDown` 960-972, `applyEditMode` 629/664 (box zoom off/on), `map.on('click')` 417, `onMapClick` 1001-1010.
- `web/typescript/selection.tsx` -- `onMapClick` 240-307 (marker, line, area, ground at 306), `selectWithDetails` 324-331, `clearSelection` 487-492, `publishSelection` 999-1017 (map data attributes; add `data-selected-ids`), `publishToPage` 1026-1038, `readPageSelection` 1061, `applyPageSelection` 1085.
- `web/typescript/pageEvents.ts` -- event names 11, `writePageProp` 120, `firePageEvent` 134; `selectedItemObject` in `selection.tsx` 1135 builds the AD-7 objects.
- Drawing the set: `itemsLayer.ts` 89-97 (`selectionKey`, `drawnSelection`), `features.ts` `Selection` 82 and `buildFeatures` 200 (`isSelected` 241, 272; a set instead of one), `markers.ts` ring 626/707, `mapLayers.ts` 293-305 line casing. A new box and lasso layer or DOM overlay with the selection tokens (`markers.ts:102` resolves `selection`).
- `web/typescript/studio/ItemList.tsx` -- props 45-77, `Heading` 136-147 (Select all in group/field), `renderRow` 205-232 (checkbox before the glyph at 221), chips 278-295 (Select all in filter), `entriesOf` (`itemList.ts` 517) for ranges.
- `web/typescript/studio/DrawToolbar.tsx` 73-75 Select's title; `drawToolbar.test.ts`.
- `web/typescript/studio/PropertiesPanel.tsx` `render` 517 (one item) and footer 670; a small count view beside it.
- Delete: `editing.ts` `deleteSelected` 830-851, `onDeleteKey` 858; `MapStudioStoreDelegate.ts` `deleteItem` 935-952, `sendShapeChange` 771-785; `geometry.ts` `itemDeleteBatch` 420-441 and `lineDeleteBatch` 405 (generalise to several); `undoStack.ts` `stepLabel` 188.
- Contract: `mapstudio.props.json` (`selectedItems` after `selectedItem`, read-only), a new `mapstudio.events.selection-changed.json`, `MapStudioComponent.java` events 35-89, `MapStudioComponentTest.java` 38-44 and the props order; `docs/contract.md` 3, 147-170; the `/events` dev page shows `selectedItems` and the new event (ignition-lint).
- Tests: Jest `studio.test.ts` 88, `features.test.ts`, `deleteItem.test.ts`, `pageEvents.test.ts`, `itemListPanel.test.ts`, `editClick.test.ts`; e2e `editclick`, `delete`, `events`, `itemlist` specs keep passing; new `multiselect.spec.mjs` at 1366 px.
- Docs: `CHANGELOG.md` 0.4.0; `docs/test-playbook-0.4.0.md` a section "Selecting several".

## Tasks & Acceptance

**Execution:**
- [ ] `studio.ts` set helpers, Jest.
- [ ] List checkboxes, ranges, Select all; `MapStudio`, `ItemList`, CSS.
- [ ] Map Shift-click, box, lasso, box zoom; drawing the set.
- [ ] The count panel and Delete of several, one batch, Jest.
- [ ] `selectedItems`, `onSelectionChanged`, Java and the `/events` page.
- [ ] e2e `multiselect.spec.mjs`, the changed specs; docs, CHANGELOG, playbook.

**Acceptance Criteria:**
- Given the seeded dev map as `mapeditor` at 1366 px, when the matrix runs, then each row holds.
- Given a fresh dev stack, when the whole e2e suite runs, then every spec passes.

## Implementation Notes

- Planner, 2026-11-08: the environment, commit and identity rules are 7b's plan's (Docker by hand after a restart, JDK 17 by apt if gone, `ops/up.sh --fresh` before a whole-suite run, the session's trailers, `git commit --only`, no em dashes, no model identifier, never a bare `git stash`, never a push). Commit at each working milestone.

- Approval (owner, 2026-11-08): "Approved and continue" with the five picks, written into the Approach; the plan kept whole.

## Plan Change Log

- 2026-11-09, review fixes: a checkbox or button input is not a field for Delete, Esc and Ctrl+Z; a set of one shows its Details (except right after a checkbox ticked into an empty set); Shift-click on a shared marker opens its pick list and toggles the member chosen; Shift-click on a context row does nothing; Esc in a field leaves the set; the set is cut to its current item when the studio stops showing; the box and lasso end on pointercancel, lost capture and window blur; `selectedItems` and `mapItems` written from one resolved list; `events.spec.mjs` R4 waits for the move to settle before reading the zoom.

## Review Triage Log

Quick lens, 2026-11-09: 10 findings; high 0, medium 4, low 4, false 2. One more patch from the implementer's run: `events.spec.mjs:412` read the zoom mid-ease.

| Finding | Verdict | Evidence | Route |
| --- | --- | --- | --- |
| Delete and Ctrl+Z do nothing after ticking rows (focus on the checkbox) | medium | `inField` and the undo branch count any INPUT; the spec focused the canvas first | patch: checkboxes and buttons are not fields for these keys; the spec presses with focus on the checkbox |
| A set dropping to one keeps Details closed | medium | `selectionSetState` keeps `panel` only for the same id | patch: a set of one shows Details, except right after a first checkbox tick |
| Shift-click on a shared marker toggles every member | medium | `itemsAt` returns all `memberIds` | patch: the pick list, then one member toggled |
| A set of several survives the studio going away (below 768 px, a level drop) | medium | Only the Edit switch cuts the set; `drawItems` and the page still see several | patch: cut to the current item whenever the studio stops showing |
| Shift-click on a context row selects it | low | `onRowClick` falls back to `[id]` | patch: context rows ignored |
| Esc in an empty search field clears the set | low | The new branch lacks `inField` | patch: the guard |
| A cancelled pointer leaves the box drag active and pan off | low | `BoxSelect` listens only for move, up and keydown | patch: cancel on pointercancel, blur, lost capture |
| `mapItems` can be shorter than `selectedItems` | low | `itemFor` drops unresolved ids | patch: both from one resolved list |
| The whole suite was not rerun and ignition-lint not run | false | The orchestrator's whole-suite run follows the review; lint run by the orchestrator: `MapStudioEvents/view.json` 0 errors, 0 warnings, naming hints | rejected |
| The commit trailers name a model, against "no model identifier" | false | The trailers are the session's required attribution lines, used on every commit of this branch; the plan's rule covers file content | rejected |

Outcome, 2026-11-09: the nine patches applied (9191186) and verified by the orchestrator: `tsc` clean, Jest 696 passed, `./gradlew clean build --offline --rerun-tasks` green, the contract check OK at 0.4.0, ignition-lint on `MapStudioEvents/view.json` 0 errors and 0 warnings, and `ops/up.sh --fresh` with the whole e2e suite: 272 passed, 7 skipped, 0 failed in 48.2 min. The Designer's lists (five events, `selectedItems`) are the owner's check, carried to entry 18.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL.
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK at 0.4.0.
- `ignition-lint --files` on the changed `/events` view -- expected: zero errors and warnings.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: green.

Build, 2026-11-09: `tsc` clean, Jest 691 passed in 64 suites (`multiSelect.test.ts` new; studio, features, deleteItem, editClick, itemListPanel, itemPanel, pageEvents, shortcuts extended); `./gradlew clean build --offline --rerun-tasks` BUILD SUCCESSFUL; the contract check OK at 0.4.0. On `ops/up.sh --fresh` the whole e2e suite: 270 passed, 7 skipped, 2 failed in 47.6 min: `multiselect.spec.mjs`'s page test (its event count started before a selection the page's session kept from an earlier spec had settled; fixed: the page writes null first and the count waits for quiet) and `events.spec.mjs` R4's "chosen at zoom 15 or more" (read while the camera still eased; View mode, not touched here). Rerun `events.spec.mjs` with `multiselect.spec.mjs`: 21 of 21. A whole-suite rerun after the fix was not done. ignition-lint not run: installing it was not permitted in this session; the changed `/events` view's scripts were parsed with Python's `ast` only.
