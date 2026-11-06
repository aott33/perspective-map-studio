---
title: "In Edit mode a click selects and opens Details, no popup"
type: 'feature'
ticket: '26'
created: '2026-11-06'
status: 'draft'
baseline_revision: '1153ef47de8776749793951b0cc2b183c8e798f2'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
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
- `web/typescript/MapStudio.tsx` -- `setEditMode` (481): entering Edit mode closes the popup here (`selection.closePopup`, which sends `popup.close` through `onPopupClosed`); `onRootKeyDown` (763); `selectionState` (747) keeps `panel` only for the same id.
- `web/typescript/editing.ts` -- `onKeyDown` (1206), a capture listener on the map container: its Esc puts the tool down outside React's batching, so the root's Esc then finds no tool and closes Details; `ev.preventDefault()` there when it puts a tool down lets the root skip it.
- Handles: entry 5's geometry module shows them for the selected line or area in Edit mode (`editing.ts`, `geometry` state); reuse, do not change.
- Tests: Jest beside `__tests__/selection*.test.ts` and `__tests__/shortcuts.test.ts`; e2e `studio.spec.mjs` (416, a card placed beside the docked studio), `tracer.spec.mjs` (72), `delete.spec.mjs` (455) and any other spec that clicks for a popup in Edit mode; new cases in `studio.spec.mjs` or a new `editclick.spec.mjs` restoring the seed after itself.
- Docs: `docs/contract.md` (the studio's behaviour paragraphs), `CHANGELOG.md` 0.4.0; `_bmad-output/deferred-work.md`'s Esc entry is marked resolved by this entry.

## Tasks & Acceptance

**Execution:**
- [ ] `web/typescript/selection.tsx` -- in Edit mode a point, line, pick row or restore selects with Details open and opens no popup -- the click goes to Details, not a card.
- [ ] `web/typescript/MapStudio.tsx` -- entering Edit mode closes an open popup or pick list -- no card stays over the studio.
- [ ] `web/typescript/editing.ts` -- Esc that puts a tool down is handled there alone -- one press, one step.
- [ ] Jest -- the Edit-mode branch, the switch closing a popup, the Esc step.
- [ ] e2e -- the matrix at 1366 px as `mapeditor`; the specs that clicked for a popup in Edit mode moved to View mode or Details.
- [ ] `docs/contract.md`, `CHANGELOG.md`.

**Acceptance Criteria:**
- Given the dev Gateway as `mapeditor` at 1366 px, when the matrix runs, then each row holds.
- Given the whole e2e suite on a fresh dev stack, when it runs, then every spec passes.

## Implementation Notes

- Planner, 2026-11-06: the environment, commit and identity rules are entry 4's plan's (Docker started by hand after a container restart, `ops/up.sh --fresh` before a whole-suite run with nothing else against the stack, the two trailer lines from the session's attribution reminder, `git commit --only` your paths, no em dashes, no model identifier, never a bare `git stash`, never a push). Commit at each working milestone.

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` -- expected: BUILD SUCCESSFUL.
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK at 0.4.0.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: green (the review 390 px flake may fail once; rerun it alone).
