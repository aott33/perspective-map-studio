---
title: "The status box retired: problems on the save status row in Edit mode and as the top chip in View mode"
type: 'feature'
ticket: '24'
created: '2026-11-05'
status: 'in-progress'
baseline_revision: '831291aab17dbf5bf38d387905d36288ada2b0d8'
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
- [ ] `web/typescript/MapStudio.tsx`, `mapstudio.css` -- the box removed; the chip's problem order and words; the attributes on the map for the tests.
- [ ] `web/typescript/studio/ItemList.tsx` -- the save status row's problems in words, and the waiting edits under it (Try again, Discard, Hide), from `renderUnsaved`'s rows.
- [ ] Unit tests for the chip's problem order and the row's words (pure, beside `save.ts` or `storeState.ts`).
- [ ] The e2e readers above -- the new places, expectations kept; renders of a problem in each mode under `E2E_DOCS=1`.
- [ ] `docs/contract.md`, `CHANGELOG.md` -- the box gone, where each problem shows, the hooks.

**Acceptance Criteria:**
- Given the dev Gateway, when the matrix runs, then each row holds at 1366 and 390 px.
- Given the whole e2e suite on a fresh dev stack, when it runs, then every spec passes.

## Implementation Notes

- Approval (owner, 2026-11-05): "a, go ahead with entry 24", taken as the plan's approval after the mocks of the problem places and of the waiting edits.
- Planner, 2026-11-05: the environment, commit and identity rules are entry 4's plan's (Docker started by hand after a container restart, `ops/up.sh --fresh` before a whole-suite run, the two trailer lines from the session's attribution reminder, no em dashes, no model identifier, never a bare `git stash`, never a push).

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` -- expected: BUILD SUCCESSFUL.
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK at 0.4.0.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: green.

**Manual checks (if no CLI):**
- The owner compares the problem renders with the approved mocks.
