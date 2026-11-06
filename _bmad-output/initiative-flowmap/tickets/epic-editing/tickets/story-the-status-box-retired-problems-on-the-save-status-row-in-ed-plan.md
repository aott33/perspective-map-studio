---
title: "The status box retired: problems on the save status row in Edit mode and as the top chip in View mode"
type: 'feature'
ticket: '24'
created: '2026-11-05'
status: 'in-review'
baseline_revision: '831291aab17dbf5bf38d387905d36288ada2b0d8'
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

**Problem:** The spike's status line, a box stretched along the map's bottom edge, still holds the dev click echo, success words ("Saved as version 1", also left over in View mode after an edit) and every problem (the store unreachable, a read-only store, edits waiting unsaved with Try again and Discard, the browser unable to keep edits, a refused save), so the map carries a box the owner wants gone.

**Approach:** Decisions (owner, 2026-11-05, "yes to both", then "looks good" on the mocks): the box leaves the component at every width. Its echo and success words go. Its problems move: in Edit mode to the save status row in the list header, in words; in View mode to the top-centre chip that says "No connection - values from 14:02" today, in its look and place, one problem at a time, the worst first.

## Boundaries & Constraints

**Always:** Every problem the box shows today is still shown in words somewhere visible: in Edit mode on the save status row, in View mode on the chip (No connection first, then the store unreachable or a setup error, then edits waiting, then a read-only store, then the storage warning; a viewer sees only what concerns the map, not an editor's edits). The chip wraps to two lines at most and its full words are its title. Decision (owner, 2026-11-05, "a", after a mock of both places): in Edit mode the save status row reads "2 edits not saved" with the reason and opens the waiting edits under it in the dock, each in words with Try again (when it has a reason) and Discard, and Hide; View mode's chip names the problem only, with no list. The e2e hooks move with them: the save state, the last reply and the load and store states stay readable as attributes on the map, and the specs read the new places with their expectations kept. Colours from theme tokens; no em dashes.

**Never:** Build entry 10's save banner, busy banner, conflict card or "Show my N edits"; change the Gateway, `common/`, a message, a prop or the contract version; add a control in the bottom-right corner.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| A save | Edit mode, an add | No box; the header says Saving..., then Saved | No error expected |
| Store unreachable | The store stopped | Edit mode: the save status row says so in words, the toolbar paused; View mode: the chip says so | No blink across the 15 s retries |
| Setup error | `setup.json` invalid | The chip (View) or the row (Edit) holds the setup's reason | Long words wrap to two lines, the rest in the title |
| Edits waiting | Two unsent edits | Edit mode: the row says "2 edits not saved"; View mode (an editor): the chip says so | Edit mode: the rows under the save status row with Try again and Discard; View mode: words only |
| Read-only store | The store read-only | The row in Edit mode, the chip for an editor in View mode | No error expected |
| No connection | The client disconnected | The chip as today, before any other problem | No error expected |
| A point click | View or Edit mode | Nothing shows (the echo is gone) | No error expected |

</frozen-after-approval>

## Code Map

- `web/typescript/MapStudio.tsx` -- the render's status line (`.mapstudio-reply`: `echo`, `saveText`, `.mapstudio-save-status`, `.mapstudio-load-status`, `.mapstudio-store-status`, `renderUnsaved` with `.mapstudio-unsaved-row`, `-retry`, `-discard`, `-warning`), entry 23's `problem` rule, the connection chip (`connectionChipText`, `.mapstudio-connection`), `data-last-reply` on the map.
- `web/typescript/studio/ItemList.tsx` -- the header's save status (`.mapstudio-panel-save`, the problem row `--row` with `data-code`).
- `web/typescript/save.ts` (`saveStatusText`, `saveStatusWords`), `storeState.ts` (`storeStatusText`), `unsaved.ts` (`summaryText`, `entryText`, `STORAGE_WARNING`), `connection.ts` (`connectionChipText`).
- `web/typescript/mapstudio.css` -- `.mapstudio-reply` (23-45), `.mapstudio-connection` (59-90, and its Edit-mode top).
- e2e readers: `unsaved.spec.mjs` (the rows, Discard, the warning), `store.spec.mjs`, `store-ops.spec.mjs`, `setup.spec.mjs` (the load and store words), `changes.spec.mjs`, `tracer.spec.mjs`, `studio.spec.mjs`, `fixtures.mjs` (`drawLine` and `openMap` wait for `.mapstudio-save-status` and `.mapstudio-reply`).

## Tasks & Acceptance

**Execution:**
- [x] `web/typescript/MapStudio.tsx`, `mapstudio.css` -- the box removed; the chip's problem order and words; the attributes on the map for the tests.
- [x] `web/typescript/studio/ItemList.tsx` -- the save status row's problems in words, and the waiting edits under it (Try again, Discard, Hide), from `renderUnsaved`'s rows.
- [x] Unit tests for the chip's problem order and the row's words (pure, beside `save.ts` or `storeState.ts`).
- [x] The e2e readers above -- the new places, expectations kept; renders of a problem in each mode under `E2E_DOCS=1`.
- [x] `docs/contract.md`, `CHANGELOG.md` -- the box gone, where each problem shows, the hooks.

**Acceptance Criteria:**
- Given the dev Gateway, when the matrix runs, then each row holds at 1366 and 390 px.
- Given the whole e2e suite on a fresh dev stack, when it runs, then every spec passes.

## Implementation Notes

- Approval (owner, 2026-11-05): "a, go ahead with entry 24", taken as the plan's approval after the mocks of the problem places and of the waiting edits.
- Planner, 2026-11-05: the environment, commit and identity rules are entry 4's plan's (Docker started by hand after a container restart, `ops/up.sh --fresh` before a whole-suite run, the two trailer lines from the session's attribution reminder, no em dashes, no model identifier, never a bare `git stash`, never a push).

## Plan Change Log

- 2026-11-05 (implementer): no change to the frozen intent. Readings and small additions, for the reviewer:
  - The problems are one pure module, `web/typescript/problems.ts` (`editProblems` for the row, `viewProblems` and `chipProblem` for the chip), beside `save.ts`, `storeState.ts` and `unsaved.ts`; the row and the waiting list are `studio/SaveStatus.tsx` (`ProblemRow`, `WaitingList`), which `ItemList.tsx` holds. Unit tests: `__tests__/problems.test.ts` (the order, the viewer's two, the no-blink words, the setup's words) and `__tests__/saveStatus.test.ts` (the row and the list rendered).
  - Edit mode's row says **every** problem at once, one line each in the chip's order (the frozen text says "one at a time" for the chip only); the connection is not on it, since the chip keeps saying it under the toolbar in Edit mode as before. With no problem the status stays beside the title (Saved, Saving...).
  - The words: the store or the setup is "Map store: " and the Gateway's sentence, the code (`store-unreachable: `) left out of the words and kept on the map as `data-load-message`; an unavailable store says its reason while each retry loads, the same words as the failed load, so the row and the chip do not blink (measured on the dev stack: 0 of about 900 frames without them across a retry). The edits waiting are `unsaved.ts` `waitingText`: "Store unreachable - 2 edits not saved" while the store is out of reach (DESIGN.md's words), else "N edits not saved - " and the oldest reason in an entry's words (`reasonText`, the part of `entryText` after "Not saved - ", which now uses it), or the count alone while no entry has a reason. A refused or unsent save whose batch still waits is said by the edits line; only when its entry has gone (a discard) do the save's own words ("Not saved - ...") stand, until the next save, as entry 23's row did. So a refused undo reads "1 edit not saved - conflict with ...'s change. P42 moved on was changed by ..." on the row, its `data-code` still `conflict`.
  - The waiting edits open **closed**: the row's edits line is a button (`aria-expanded`, a chevron) that opens them under the row, in the dock above Search items; Hide, Esc in the list (going no further, so Details stays) or the edits' going close it, the focus back on the line. The owner's "opens the waiting edits under it" read as a press, as DESIGN.md's clickable save status and entry 10's "Show my 2 edits" are; the mock was not available to me, so the owner may want it open by default instead (one line in `ItemList.tsx`).
  - "A viewer" is a session whose level is not `phone` or `full` (with the level last reported while a failed load leaves it unknown). An anonymous viewer of a read-only store now sees no words for it (the frozen matrix: "the chip for an editor"); its reason stays on the map as `data-store-reason`, and `store-ops.spec.mjs` checks that instead of the old line. A level-`none` session's own queued edits ("Sign in with a Map Studio editing role ...") are not shown either (it has no studio, and the rule says a viewer never sees edits); no path queues an edit at level `none` today.
  - The chip: `.mapstudio-chip` with `data-problem`, also `.mapstudio-connection` (`data-state`) while it says the connection, so `connection.spec.mjs` and `studio.spec.mjs` read it unchanged. The cloud glyph (struck through) is new in `controls.ts` (DESIGN.md Icons names a cloud among the chrome glyphs) for every problem but the connection, which keeps the hourglass. The chip now takes the pointer (`pointer-events` was none), so its title shows; it is as wide as its words up to 560 px and clear of the zoom card on both sides (`max-width`), two lines at most (`line-clamp`). It stays under the controls (z-index 4 below the corners' 6).
  - The map's attributes for the suite: `data-save-state`, `data-save-item`, `data-save-version`, `data-save-code`, `data-load-message`, `data-store-reason` are new; `data-last-reply`, `data-load-state`, `data-store-state` stay. `saveStatusText` ("Saved as version 1") is removed with its unit check; `storeStatusText` stays as the store's words.
  - e2e: a new `e2e/tests/problems.spec.mjs` runs the matrix at 1366 and 390 px (the store unreachable and a setup error on the row and the chip with no blink across a retry; two edits waiting with the list, Hide, Esc and Discard, the editor's chip, No connection first; a read-only store on the row and the editor's chip; the phone's chip with the setup's long words on two lines and the title; a viewer's chip). Its websocket routing is unsaved.spec's, moved into `e2e/lib/sockets.mjs` with a read-only reply added, and unsaved.spec imports it. At 390 px the waiting edits' Discard is Edit mode's, so unsaved.spec's conflict test reads the chip and the stored queue there, then opens the page again at 1366 px for Discard. `fixtures.mjs` `drawLine` waits on the map's `data-save-state` and `openMap` no longer waits for the box.
  - Not in the Code Map: `docs/architecture.md` (the module table: `problems.ts`, `SaveStatus.tsx`) and `docs/development.md` (its sentence on the echo).
  - Seen, not changed: with the store unreachable the Items list still lists the items the map no longer draws (`listRows` reads `delegate.items`); pre-existing, for entry 10 or 7. The spines (DESIGN.md, EXPERIENCE.md) do not yet say that View mode's chip carries problems other than No connection; R26 in the epic does.
- 2026-11-06 (implementer, the review's patches; no change to the frozen intent):
  - Every dock surface says the problems: the row and the waiting list are one component, `studio/SaveStatus.tsx` `ProblemStatus`, under the title of Items, Kinds and Layers.
  - No stale "Not saved": the save's own words line (`save`) is gone. A refused or unsent save counts only while its batch waits in the queue, and while it waits the edits line already says it (the save state turns `refused` or `unsent` exactly when its queue entry takes a reason), so the fallback could only ever speak after the entry had left (a Discard, a replay's save). Unit tested in `problems.test.ts`.
  - The save state beside the title always (`problems.ts` `headerSaveWords`): "Saving..." while a batch is out, "Not saved" while edits wait, else "Saved"; the row no longer carries the `.mapstudio-panel-save` class, so that selector is the title row's status alone. `saveStatusWords` went with it (no user left).
  - A load's problem held until a load succeeds: the delegate keeps the last failed load's code and sentence in `load.message` while a retry loads (`sendMapLoadMessage`), '' once one succeeds; `storeProblem` reads it whatever the store state, so the busy answer no longer blinks. `__tests__/loadRetry.test.ts` drives the delegate through a busy answer, a retry and a success.
  - Each waiting edit named as Undo names its step: `unsaved.ts` `editLabel` from the batch's first map item op and the map's records ("Add Gathering line", "Rename P14 North", "Move SWD1", "Link P14", "Unlink P14", "Edit P14", "Delete L-TEST"; "an item" when the record is gone, "edit a kind setup" for a kind setup batch), the reason under it.
  - Glyphs (`problems.ts` `ProblemGlyph`, the chip's `data-glyph`): the hourglass for no connection, the cloud for the store out of reach and for edits waiting because of it, a warning glyph for the rest (busy and a setup's reason told from the Gateway's sentences, a refused edit, read-only, the storage warning). There was no warning glyph in the web code, so one is added to `controls.ts`: an exclamation mark in an octagon, since a triangle, circle or square is an alarm shape on the map (ER-27); for the owner to confirm. The row shows no glyph.
  - After a Discard the focus goes to the next row's Discard (the row now in the discarded one's place) if it is enabled, else to the edits line.
  - `problems.spec.mjs`: the 390 px run of a read-only store on an editor's chip with No connection before it; Saving... asserted in the header while an edit is sent with no row and no chip, then Not saved once edits wait; the Kinds and Layers surfaces checked for the row; the glyphs, the named rows and the focus after a Discard checked. `docs/operations.md` and `docs/setup.md` say where each problem shows now, without the code.

## Review Triage Log

Quick lens, 2026-11-06, plus one coordinator finding from the renders: 11 findings; high 0, medium 6, low 4, owner's call 1.

| Finding | Verdict | Evidence | Route |
| --- | --- | --- | --- |
| In Edit mode on the Kinds or Layers surface no problem is said anywhere | medium | The row is `ItemList`'s; `renderDock` mounts it for Items only and `chipProblem(facts, true)` gives the connection alone in Edit mode; the Always rule says every problem stays in words | patch: the problem row on every dock surface |
| False "Not saved" words stay after a Discard (`problems.ts` falls back to `facts.save`, which a Discard never resets) | medium | Two unsent edits, the newest discarded, the older saved by the replay: the queue empties while `save.state` stays `unsent` | patch: the save's words count only while its batch is still waiting |
| Any problem hides Saving... and Saved; the storage warning never clears, so in that state no save is ever confirmed | medium | `ItemList` renders the title row's status only with no problems; `warnStorage` sets the warning once | patch: the save state beside the title always, the problem row under it |
| The busy answer to a load blinks across the 15 s retries | medium | The busy reply leaves the store state, so the problem shows only while `load.state === 'failed'`; the unit test pins the blink; the matrix says no blink | patch: a load's problem held until a load succeeds, the unit test to the matrix |
| The waiting-edit rows give the reason but not which edit, where the approved mock named it ("Rename P14 to P14 North") | medium | The rows reuse `entryText`; the renders show "Not saved - store unreachable ..." on each row | patch: each row names its edit from its batch, as Undo's labels do |
| The struck cloud marks every problem but the connection: busy, read-only, the storage warning, a setup error | medium | DESIGN.md gives the cloud to Store unreachable and the warning glyph to Busy; a cloud beside "read only" reads as unreachable | patch: the cloud for the store unreachable only, the warning glyph for the rest |
| `problems.spec.mjs` covers three matrix rows at 1366 px only, and its "Saving..." comment has no assertion | low | The acceptance criterion says each row at 1366 and 390 px | patch: the 390 px rows and the Saving... assertion |
| `docs/operations.md` (36, 48, 58) and `docs/setup.md` (60) still describe the box and its words | low | Not in the diff; they say "under the map" and the old "Map store: store-unreachable: ..." | patch |
| Focus drops to the page after a Discard in the waiting list | low | The focused button leaves with its row; only Hide and Esc restore focus | patch: the next row's Discard, else the edits line |
| Try again and Discard cannot be reached below 768 px or at level `phone` | owner's call | The owner chose the list in the dock, Edit mode only; a refused edit waits there until a desktop session opens Edit mode | asked of the owner; the phone's own list belongs to epic-phone's edit sheet |
| The waiting edits open on a press, where the approved mock showed them open with Hide | owner's call | The implementer read "opens under it" as a press; the mock showed them open | asked of the owner with the render |

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` -- expected: BUILD SUCCESSFUL.
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK at 0.4.0.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: green.

**Manual checks (if no CLI):**
- The owner compares the problem renders with the approved mocks.
