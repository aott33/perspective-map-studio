---
title: "Delete, undone in one step, and every shortcut named on its control"
type: 'feature'
ticket: '25'
created: '2026-11-06'
status: 'in-progress'
baseline_revision: 'cb5d8d3e31bc7cf2e808419ff15c8fb2e386da16'
route: 'full'
route_source: 'auto'
risk: 'low'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A map editor cannot delete a map item from the studio at all: a wrong item saved earlier, by another editor or by the seed, stays until a script removes it. And the few shortcuts the studio has are named only on some of its controls.

**Approach:** Decisions (owner, 2026-11-06, the evaluation of entry 5's split: "agree"). Delete with no confirmation from the properties panel's footer (a delete icon, DESIGN.md Properties panel) or the Delete key outside a field, one undo step restoring the item with its link and properties ("delete L-TEST"; a line with its instruments in one step). No `?` panel: each control with a shortcut names it in its hover text and accessible description.

## Boundaries & Constraints

**Always:** A delete is one `edits.apply` batch through the delegate's queue and one undo step; Undo restores the item at its tombstone (undo.ts) with its link, properties, kind and geometry, and Redo deletes it again. A line goes with every instrument on it (`geometry.ts` `lineDeleteBatch`; the Gateway refuses a line deleted without them). Deleting an item that lines snap to clears the `ends` entries naming it in the same batch, so no line names a deleted item, and Undo puts them back. With one of a line's points chosen (entry 5), the Delete key removes that point as the bar's Delete point does; otherwise it deletes the selected item. A key typed in a field is the field's. After a delete the selection clears and Details closes. Nothing says it saved (no toast); a refusal shows on the save status row. Shortcut words: "Undo: add Gathering line (Ctrl+Z)", "Redo: ... (Ctrl+Shift+Z)", "Delete (Del)", Cancel (Esc), Finish (Enter), Done (Esc), Delete point (Del). Only at level `full` and 768 px and wider; paused with the store. Colours from theme tokens; no em dashes.

**Never:** Ask "Are you sure?". Delete several items at once (entry 8). Change the Gateway, `common/`, a message, a prop or the contract version. Delete a test or weaken its expectation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Delete a pad | CTB1 selected, the footer's delete icon | One batch: CTB1 deleted, the `ends` naming it cleared on L-SWD; Details closes; Undo restores both with CTB1's link | A refusal on the save status row |
| Delete a line | L-SWD selected, the Delete key | L-SWD and PT-1, LV-1, PT-2 in one batch; Undo restores all four; Redo deletes again | As above |
| A point chosen | A point of L-SWD chosen, Delete | That point removed, as Delete point | Off at the floor, as entry 5 |
| In a field | The Name field focused, Delete | The field's | No error expected |
| Hover | Undo, Redo, the footer's delete, the bars' buttons | Each names its shortcut | No error expected |
| Phone or viewer | 390 px, or level below full | No delete | As today |

</frozen-after-approval>

## Code Map

- `web/typescript/studio/PropertiesPanel.tsx` -- the panel (header, Details); no footer yet; DESIGN.md "Footer: a delete icon" (key screen 4: bottom right).
- `web/typescript/MapStudioStoreDelegate.ts` -- `sendBatch`, the held geometry builders (entry 5), `knownRecord`, `items`; `stepLabel` in `undoStack.ts` (gains delete); `undo.ts` reverses a delete to a restore at the tombstone's version with the record before it.
- `web/typescript/geometry.ts` -- `lineDeleteBatch`, `instrumentsOn`; the new pure delete of a point item with the snapped `ends` it clears belongs here; tests in `__tests__/geometry.test.ts`.
- Keys: `selection.tsx` `onRootKeyDown` (Esc), `MapStudio.tsx` (Ctrl+Z and Ctrl+Shift+Z outside a field), `editing.ts` `onKeyDown` (the map container, `inField` from `drawing.ts`), the chosen point's Delete point (entry 5, `studio/GeometryBar.tsx`).
- Hover words: `studio/UndoGroup.tsx` (329, 341), `studio/GeometryBar.tsx` (64-72), `studio/DrawingBar.tsx` (63, 91-93).
- e2e: `geometry.spec.mjs` and `studio.spec.mjs` (helpers, the seed's L-SWD with PT-1, LV-1, PT-2 and CTB1); a delete spec beside them restores the seed after itself.
- Docs: `docs/contract.md` (the studio's actions and hooks), `CHANGELOG.md` 0.4.0.

## Tasks & Acceptance

**Execution:**
- [ ] `web/typescript/geometry.ts` + tests -- a point item's delete with the `ends` it clears; a line's with its instruments (existing).
- [ ] `web/typescript/MapStudioStoreDelegate.ts`, `undoStack.ts` -- the delete sent through the queue, "delete <name>" as its step.
- [ ] `web/typescript/studio/PropertiesPanel.tsx`, `MapStudio.tsx`, `editing.ts` or `selection.tsx`, `mapstudio.css` -- the footer's delete icon, the Delete key, the selection cleared after.
- [ ] `web/typescript/studio/UndoGroup.tsx`, `GeometryBar.tsx`, `DrawingBar.tsx` -- the shortcut words.
- [ ] `e2e/tests/delete.spec.mjs` -- the matrix at 1366 px as `mapeditor` and the phone and viewer row; a render of the footer under `E2E_DOCS=1`.
- [ ] `docs/contract.md`, `CHANGELOG.md`.

**Acceptance Criteria:**
- Given the dev Gateway as `mapeditor` at 1366 px, when the matrix runs, then each row holds.
- Given the whole e2e suite on a fresh dev stack, when it runs, then every spec passes.

## Implementation Notes

- Approval (owner, 2026-11-06): "start entry 25", after agreeing the entry's scope; the delete icon follows DESIGN.md as written.
- Planner, 2026-11-06: the environment, commit and identity rules are entry 4's plan's (Docker started by hand after a container restart, `ops/up.sh --fresh` before a whole-suite run, the two trailer lines from the session's attribution reminder, no em dashes, no model identifier, never a bare `git stash`, never a push). Commit at each working milestone.

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` -- expected: BUILD SUCCESSFUL.
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK at 0.4.0.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: green (the review 390 px flake may fail once; rerun it alone).
