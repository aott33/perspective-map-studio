---
title: "Edit mode talks in one place: Undo and Redo on the toolbar with the last ten steps, one bar while a tool is in hand, no pill, no toast, no status box"
type: 'feature'
ticket: '23'
created: '2026-11-05'
status: 'ready-for-dev'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'medium'
review: ''
review_source: ''
lenses_ran: []
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
- [ ] `web/typescript/undoStack.ts` + `__tests__/undoStack.test.ts` -- the step's time, the history, the run's count -- tested.
- [ ] `web/typescript/MapStudioStoreDelegate.ts` (+ its tests) -- undo-to-here as a run of single undos, stopping on a refusal or another edit.
- [ ] `web/typescript/studio/DrawToolbar.tsx`, `ItemList.tsx`, `MapStudio.tsx`, `mapstudio.css` -- Undo, the history list (keyboard: arrows, Enter, Esc), Redo on the toolbar; the header without them; Snap as its glyph; no pill.
- [ ] `web/typescript/studio/DrawingBar.tsx`, `MapStudio.tsx`, `editing.ts`, `drawing.ts` -- the bar for every tool in hand; no toast (`Toast.tsx` and its state removed); the status line as the Always rule says.
- [ ] `e2e/tests/studio.spec.mjs`, `drawing.spec.mjs`, `tracer.spec.mjs` -- the matrix at 1366 px (the toolbar's clearance at 1440 px too); the pill and toast checks moved as the owner decided; Edit-mode renders under `E2E_DOCS=1`.
- [ ] `docs/contract.md`, `CHANGELOG.md` -- the toolbar's Undo and its history, the bar, the removed pill and toast, the test hooks.

**Acceptance Criteria:**
- Given the dev Gateway as `mapeditor`, when the matrix runs, then each row holds.
- Given the whole e2e suite on a fresh dev stack, when it runs, then every spec passes.

## Implementation Notes

- Approval (owner, 2026-11-05): "2, drop the toast" with the undo history ("can the undo have a dropdown that shows the last 10 actions and they can undo to a specific one") and its mock, taken as the plan's approval; the status line's problems-only rule until entry 10 was told to the owner with the plan, open to change.
- Planner, 2026-11-05: the environment, commit and identity rules are entry 4's plan's (Docker started by hand after a container restart, `ops/up.sh --fresh` before a whole-suite run, the two trailer lines from the session's attribution reminder, no em dashes, no model identifier, never a bare `git stash`, never a push). A Gateway Java test (`SetupLookupsTest`, thread-pool timing) can fail once on a busy box; rerun it.

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` -- expected: BUILD SUCCESSFUL.
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK at 0.4.0.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: green (the review 390 px flake may fail once; rerun it alone).

**Manual checks (if no CLI):**
- The owner compares the Edit-mode renders with the undo history mock and render 2 of the messages review.
