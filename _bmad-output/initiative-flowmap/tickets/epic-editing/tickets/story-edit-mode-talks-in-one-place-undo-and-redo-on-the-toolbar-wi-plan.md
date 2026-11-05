---
title: "Edit mode talks in one place: Undo and Redo on the toolbar with the last ten steps, one bar while a tool is in hand, no pill, no toast, no status box"
type: 'feature'
ticket: '23'
created: '2026-11-05'
status: 'in-review'
baseline_revision: 'ccacb73b6c353de0c50814dc3cb3e1b44f79a3a9'
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

**Problem:** Edit mode talks in four places at once while a line is drawn: the mode pill under the toolbar, the add toast, the drawing bar and the dev status box ("Click a point. Saved as version 1"), and Undo sits in the list header away from the tools.

**Approach:** Decisions (owner, 2026-11-05: "2, drop the toast, legend C", then the undo history mock). Undo and Redo move to the toolbar's end, each naming its step on hover; a chevron beside Undo opens the last ten of this session's steps, newest first, with how long ago, and choosing one undoes it and every later step. The pill, the add toast and the status box leave Edit mode; one bar bottom-centre is the only place that talks, and only while a tool is in hand; Snap is its glyph alone.

## Boundaries & Constraints

**Always:** Undo stays one reverse batch per step, sent one at a time through the queue (the 2026-11-04 rule): undo-to-here runs the same single undo in order, the next only after the last is saved, and stops at the first refusal with the reason on the save status row, or when the editor makes another edit. Ctrl+Z and Ctrl+Shift+Z (Ctrl+Y) undo and redo one step as today. The active tool is tinted and named on hover and to assistive technology. The bar shows for every tool in hand: for Line and Area as today without the "Snap on/off" words, "Snap to CTB1 - click to connect" only while a target is in reach; for Point the kind's glyph, "New well pad", "Click the map, then drag to fine-tune" and Done (puts the tool down, as Esc). The toolbar stays clear of the Editing switch at 1366 and 1440 px with Details docked. In Edit mode the status line reports problems only (a failed load, a read-only store, unsaved edits, a refused or unsent save) until entry 10's banner and save status take them; it never shows the click echo or a success, and stays in the DOM for the e2e suite. Colours from theme tokens; no em dashes.

**Never:** Group steps, or undo several in one batch. Change the Gateway, `common/`, a message, a prop or the contract version. Change View mode or the phone. Build entry 10's banners, the conflict card or entry 5's "naming who". Delete a test or weaken an expectation the owner's decision does not change (the pill and toast checks move to the toolbar, the bar and the save status).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Hover Undo | Three saved edits | "Undo: add Gathering line" (the last step) | Disabled with "Nothing to undo" and none |
| History | The chevron | The last ten done steps, newest first, each with how long ago; hovering a row marks it and every newer row; the footer counts them | Empty: "Nothing to undo" |
| Undo to here | The second newest chosen | Two steps undone, newest first, one batch each; the oldest stays; Redo then redoes one | A refusal stops the run; the save status row says why |
| Shortcuts | Ctrl+Z, Ctrl+Shift+Z | One step each way | As today |
| Line tool | Two vertices placed | One bar: glyph, "New gathering line", count and length, hint or problem, Cancel and Finish; no pill, no toast after Finish | The problem in the bar |
| Point tool | Picked | The bar: "New well pad", "Click the map, then drag to fine-tune", Done | No error expected |
| Select | No tool | Nothing talks: no bar, no pill | No error expected |
| Status line | Edit mode, a click on a point, a save | No echo, no "Saved as version 1" | A failed load or unsent save still shows |

</frozen-after-approval>

## Code Map

- `web/typescript/studio/DrawToolbar.tsx` -- the toolbar groups and the `.mapstudio-pill` (removed); Snap's word (`snapToggleText`) goes, its title says on or off; Undo, the chevron and Redo join as the last group.
- `web/typescript/studio/ItemList.tsx` -- the header's `.mapstudio-undo` and `.mapstudio-redo` (move to the toolbar; the header keeps the title and the save status).
- `web/typescript/undoStack.ts` -- `UndoStep` (gains the time it was saved), `pushStep`, `undoLabel`, `canUndo`; the history (last ten done steps, newest first) and the run's count are pure functions here, unit tested.
- `web/typescript/MapStudioStoreDelegate.ts` -- `undo()`, `redo()`, `sendReverse`, `settleUndo` (a reverse saved: `finishPending`), `giveUp` (`failPending`): the run's next undo goes after a reverse settles; a refusal or a new tool or field edit ends the run.
- `web/typescript/MapStudio.tsx` -- `onUndo`, `onRedo`, the Ctrl keys (`onRootKeyDown`), `applyToast`, `toastFor`, `ToastState`, the render's status line (`echo`, `quiet`, `.mapstudio-reply`), `<DrawToolbar>`, `<DrawingBar>` (shown for `isDrawingTool` only), `<Toast>`; `editing.ts` sets `toastFor` in `onLineFinish` and `onPointFinish`.
- `web/typescript/studio/DrawingBar.tsx`, `drawing.ts` (`snapToggleText`, `addedText`, `TOAST_MS`, `finishHint`), `studio/Toast.tsx` (removed with its CSS).
- `web/typescript/mapstudio.css` -- the pill, the toast, `.mapstudio--editing .mapstudio-connection` (its top counts the pill; entry 21), the toolbar's width at 1366 px.
- e2e: `studio.spec.mjs` (the pill at about 140, 244, 315, 400; the header's Undo and Redo at about 265; the pill's box in entry 21's top-row test at about 474 and 500), `drawing.spec.mjs` (the toast, the pill, the "Snap on/off" words), `tracer.spec.mjs` (the pill after Esc, the echo at about 60). `fixtures.mjs` waits for `.mapstudio-save-status` and `.mapstudio-reply` attached; `store`, `unsaved`, `changes` read `.mapstudio-save-status`.
- Docs: `docs/contract.md` (the Drawing paragraph and the studio's test hooks), `CHANGELOG.md` 0.4.0.

## Tasks & Acceptance

**Execution:**
- [x] `web/typescript/undoStack.ts` + `__tests__/undoStack.test.ts` -- the step's time, the history, the run's count -- tested.
- [x] `web/typescript/MapStudioStoreDelegate.ts` (+ its tests) -- undo-to-here as a run of single undos, stopping on a refusal or another edit.
- [x] `web/typescript/studio/DrawToolbar.tsx`, `ItemList.tsx`, `MapStudio.tsx`, `mapstudio.css` -- Undo, the history list (keyboard: arrows, Enter, Esc), Redo on the toolbar; the header without them; Snap as its glyph; no pill.
- [x] `web/typescript/studio/DrawingBar.tsx`, `MapStudio.tsx`, `editing.ts`, `drawing.ts` -- the bar for every tool in hand; no toast (`Toast.tsx` and its state removed); the status line as the Always rule says.
- [x] `e2e/tests/studio.spec.mjs`, `drawing.spec.mjs`, `tracer.spec.mjs` -- the matrix at 1366 px (the toolbar's clearance at 1440 px too); the pill and toast checks moved as the owner decided; Edit-mode renders under `E2E_DOCS=1`.
- [x] `docs/contract.md`, `CHANGELOG.md` -- the toolbar's Undo and its history, the bar, the removed pill and toast, the test hooks.

**Acceptance Criteria:**
- Given the dev Gateway as `mapeditor`, when the matrix runs, then each row holds.
- Given the whole e2e suite on a fresh dev stack, when it runs, then every spec passes.

## Implementation Notes

- Approval (owner, 2026-11-05): "2, drop the toast" with the undo history ("can the undo have a dropdown that shows the last 10 actions and they can undo to a specific one") and its mock, taken as the plan's approval; the status line's problems-only rule until entry 10 was told to the owner with the plan, open to change.
- Planner, 2026-11-05: the environment, commit and identity rules are entry 4's plan's (Docker started by hand after a container restart, `ops/up.sh --fresh` before a whole-suite run, the two trailer lines from the session's attribution reminder, no em dashes, no model identifier, never a bare `git stash`, never a push). A Gateway Java test (`SetupLookupsTest`, thread-pool timing) can fail once on a busy box; rerun it.

## Plan Change Log

- 2026-11-05 (implementer): no change to the frozen intent. Readings and small additions, for the reviewer:
  - The step's time (`UndoStep.at`): when the step's batch was last saved, the edit's save and then each undo's or redo's, so a step redone reads its redo's time in the history (which lists done steps only, newest first, ten at most). `finishPending` takes the time (Date.now by default).
  - The run (`MapStudioStoreDelegate.undoTo`, `undoStack.ts` `startRun` and `runAfterSave`): the first single undo goes at once through the same `startUndo` and `sendReverse` as Undo; each next one in `continueRun`, after the reverse's reply has set the save status and moved the item's turn on (`releaseFlight`), so it shows its own Saving...; a final refusal or a Discard of the run's reverse (`giveUp`) ends it with the reason on the save status row as for any undo; `sendBatch` (every tool and field) ends it, the reverse in flight still settling; a step whose reverse cannot be built ends it with a console line (the plan names no words for it). A transient refusal (store unreachable, busy, no answer) keeps the reverse queued and the run waiting until the replay saves it.
  - The history list (`studio/UndoGroup.tsx`): the menu button pattern (`aria-haspopup="menu"`, `role="menu"` with menuitems); Enter, Space or Down opens it on the newest row, Up on the oldest; a pointer opens it with the focus left on the chevron, and hovering marks rows without moving the focus (a first cut moved the focus on hover, which drew a focus ring the mock does not have after any key had been pressed); Up and Down wrap, Home and End jump; Tab closes it as Esc does, with the focus back on the chevron, so the focus never lands on a removed row; a press outside closes it; the times are read again every 15 s while it is open; while a reverse is in flight the rows are inert and the footer reads "Undoing...". With no row marked the footer reads "Click a step to undo back to it" (my words: the mock shows only the marked state). The chevron is 20 px wide and tinted while the list is open.
  - Placement, for the owner's comparison with the mock: the list opens left-aligned with Undo as the mock draws it and moves left as far as it must to stay inside the map and clear of the zoom card. The mock has no Details docked; with Details docked at 1366 px its alignment would run past the map's right edge. Measured with Details docked: 362 to 662 px of the 718 px map at 1366 px (the zoom card from 674), 392 to 692 px of the 748 px map at 1440 px. The toolbar with the new group: 392 px, ending 26 px before the Editing switch at 1366 px and 41 px before it at 1440 px.
  - Paused (the store unreachable): the pill's paused words go with the pill; the toolbar's label says it to assistive technology and Undo, the chevron and Redo say it on hover.
  - The bar: a tool whose kind list has no kind for it says "The kind list has no line kind" (point, area) as its problem, Finish inert (the pill used to say it). The Point tool's Done puts the tool down as Esc.
  - The status line: in Edit mode hidden unless a problem, `.mapstudio-save-status` hidden (in the DOM) for Saving and Saved. The echo also waits for map.load's level, so an editor's `/edit` page no longer flashes "Click a point." before the studio comes on; a viewer's `/edit` page shows it from the first answer, as it did after it.
  - Removed: `studio/Toast.tsx` and its CSS, `ToastState`, `toastFor`, `PendingToast`, `addedText`, `TOAST_MS`, `pillText`, `withArticle`, `snapToggleText` (now `snapTitle`, the hover title) and the chrome `check` glyph (the toast's alone). The unit checks of the pill's words move to the bar's (`barTitle`, `noKindText`, `PLACE_HINT`), the toast's to the toolbar's Undo group.
  - Not in the Code Map: `docs/architecture.md`'s module table (it named the toast, the pill and the header's Undo); `e2e/tests/unsaved.spec.mjs` gains a visible check that an unsent save still shows; the delegate's unit test (`__tests__/undoRun.test.ts`) stands Perspective's base class in as a virtual module.
  - Camera padding and the popup's room (not changed, noted): the toolbar float no longer holds the pill (about 30 px), so in Edit mode a list row picked centres about 15 px higher and an open card may sit closer to the top; no spec measures it. The connection chip sits 10 px under the toolbar.
  - Pre-existing, not changed, for review: an edit saved while an undo is in flight is pushed after the step being undone (`pushStep` keeps the undo pending); when that undo's reply comes, `finishPending` moves the cursor to the undone step's index, so the newer edit lands past the cursor, unreachable by Undo, and Redo would reverse it. Entry 2's single undo had the same window; a run widens it (an edit during the run). Fixing it needs the reverse's versions kept for `rebase` once the undone step leaves the stack, beyond this entry's scope.
- 2026-11-05 (implementer, verification): `tsc --noEmit` clean and 374 Jest tests green (41 suites; the new `undoRun.test.ts` and the history and run tests in `undoStack.test.ts` and `drawToolbar.test.ts` among them); `./gradlew clean build --offline` BUILD SUCCESSFUL; `check-contract-versions.sh` OK at 0.4.0; no em dash in the changed files. Whole suite on a fresh dev stack (`ops/up.sh --fresh`) at the tree of commit 10e000d: 145 passed, 7 skipped, 0 failed in 28.7 min (entry 22 had 143; the two new are this entry's; the review 390 px flake did not show). A first whole run stopped at once on a test title of mine with an unescaped quote (fixed in 10e000d). After it, the history's pointer opening and hover (the focus left on the chevron, rows marked by hover alone) changed in `UndoGroup.tsx`; `studio.spec.mjs` alone on the restaged stack: 20 passed. `E2E_DOCS=1` runs of `studio.spec.mjs`, `drawing.spec.mjs` and `tracer.spec.mjs` rewrote the Edit-mode renders (no pill, no toast, no status box, Undo and Redo on the toolbar) and added `mapstudio-studio-undo-history-1366.png` (three steps, the second newest hovered) and `mapstudio-studio-undo-refused-1366.png` (a run stopped by a conflict, the reason on the save status row). Left for the owner: comparing the renders with the undo history mock and render 2 of the messages review.

## Review Triage Log

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` -- expected: BUILD SUCCESSFUL.
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK at 0.4.0.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: green (the review 390 px flake may fail once; rerun it alone).

**Manual checks (if no CLI):**
- The owner compares the Edit-mode renders with the undo history mock and render 2 of the messages review.
