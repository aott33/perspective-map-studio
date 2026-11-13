---
title: "21: four keyboard fixes from the entry 17 pass (Esc from a button, the map's focus ring, focus kept, 24 px targets)"
type: 'fix'
ticket: ''
part_of: ''
created: '2026-11-13'
status: 'draft'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'low'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/docs/platform-checks.md', '{project-root}/e2e/tests/keyboard.spec.mjs', '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-editing/tickets/story-the-tag-browser-one-tree-for-every-tag-pick-asset-relative-p-plan-13b.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Entry 17b's keyboard pass of Edit mode recorded failures and fixed none. Four of them are small and R14 names them: Esc does not put a tool down while the focus is on the button that armed it; the map takes the focus with no ring; the focus falls to the page body after Undo's last step and after Details' Close; five kinds of target are under 24 px.

**Approach:** Fix those four with the smallest change each, take their lines out of the spec's pinned failures so the spec now asserts them, and write the record again. The other three findings (no key places a point on the map, arrow keys on the tabs, toolbar, rail and instrument list, faint pressed and hover fills) stay pinned and go to entry 18's release notes as known limits.

Decisions (owner chose the four on 2026-11-13; the picks below are pending at the checkpoint; **built only after the owner's hand testing, on the owner's word**): (1) Esc on any control that is not a text field puts the tool in hand down, once per press; the focus stays where it is; every card, menu, list and field keeps its own Esc. (2) The map's ring is the one every control has (2 px, the selection colour, drawn inside the edge), shown for keyboard focus only, not for a mouse click. (3) When Undo or Redo turns off under the focus, the focus goes to the undo list's chevron; when that is off too, to the map. (4) Details' Close sends the focus to the map, as Esc does today. (5) Targets grow in their hit area, not their look: the list's tick box keeps its 16 px box inside a 24 px label; "Select all", the "Saved" status and a kind setup's tick box and switch labels get a 24 px least height; no row grows. (6) Redo's lost focus is fixed with Undo's, though the pass did not check it.

## Boundaries & Constraints

**Always:** Each fixed check comes out of `KNOWN_FAILURES` and holds at 1366 and 1440 px. The map's ring is read by the contrast part in both themes and must reach 3:1 on the blank ground; if it does not, stop and bring it to the owner. The record in `docs/platform-checks.md` is written again by the spec, and its hand-written answer and candidate list are brought in line. A unit test for Esc at the root with a tool in hand.

**Never:** A change to what Esc does in a text field, a card, a menu, the undo list, the tag browser or a box or lasso in progress; a second step from one Esc; `aria-disabled` in place of `disabled` on Undo or Redo; a moved or taller row; a loosened, skipped or re-pinned check; a fix for the three findings left as known limits.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| F1 Esc on the arming button | A drawing tool armed from its toolbar button (six buttons) or the list's Add item; Esc with the focus still there | Select in hand; the focus stays on the button; Details and the selection kept | N/A |
| F2 Esc on the map | A tool in hand, the focus on the map; Esc | As today: one step, the tool down | N/A |
| F3 Esc elsewhere keeps its meaning | Esc in a text field, an open card, menu, undo list or tag browser, with a tool in hand | That surface's own Esc, the tool still in hand | N/A |
| F4 Map ring | Tab to the map; a mouse click on the map | A ring with Tab; none with the click; at least 3:1, light and dark | Under 3:1: stop, ask the owner |
| F5 Undo's last step | Focus on Undo, its last step undone; the same for Redo | The focus is on the chevron (or the map when the chevron is off), never the body | N/A |
| F6 Details closed | Focus on Close; Enter | The panel closes; the focus is on the map | N/A |
| F7 Targets | The list's tick boxes, both "Select all", the "Saved" status, a kind setup's tick boxes and switches | Each at least 24 px both ways as the spec measures; no row's height changes | N/A |

</frozen-after-approval>

## Code Map

- `web/typescript/MapStudio.tsx` -- :1208-1257 `onRootKeyDown` (the new Esc branch goes after the list overlay's, before the `kindsOpen` return at :1253); :1557 `onPanelClose`; :1686-1692 `onUndo`.
- `web/typescript/editing.ts` -- :267-270 the map container's capture listener, :1302-1331 its Esc (it calls `preventDefault`, so the root sees a handled press), :987-995 `putToolDown`.
- `web/typescript/selection.tsx` -- :177 the early return with a tool in hand; :185-189 Esc's focus to the canvas (the pattern for F6); :545-550 `dropSelection`.
- `web/typescript/drawing.ts` -- :237-251 `inField`.
- `web/typescript/studio/UndoGroup.tsx` -- :341-346 and :354-358 the buttons, :141-161 `componentDidUpdate`, :134 the chevron's ref, :188-193 the focus back to the chevron.
- `web/typescript/studio/ItemList.tsx` -- :313-315 the tick box (an input with `aria-label`, no label), :168, :185, :420 "Select all", :360-363 the "Saved" status. `studio/KindSetupPanel.tsx` :561-567 the tick box and switch rows.
- `web/typescript/mapstudio.css` -- :19-21 the canvas's `outline: none`; :5059-5061 the ring other controls use; :5440-5447, :5455-5468, :2570-2583, :4640-4657, :3093-3105 the target rules.
- `e2e/tests/keyboard.spec.mjs` -- `KNOWN_FAILURES` :95-138 (out: :99-100, :106-108, :116-117, :120-126, :129-131), `ESC_ON_BUTTON` :94 (then unused), the toolbar's note :691; `targetBox` :280-289 counts an element's own box and its label's, never a pseudo-element or a margin; `ringOf` :225-246.
- `web/typescript/__tests__/editClick.test.ts` -- :854-901 Esc with a tool in hand; `drawToolbar.test.ts` :84-137 asserts `disabled=""`; `itemListPanel.test.ts` :140-141 matches the tick box's markup.
- `docs/platform-checks.md` -- :1191 the answer and :1405-1410 the candidate list, both written by hand.

## Tasks & Acceptance

**Execution:**
- [ ] `MapStudio.tsx` -- the root's Esc branch (not handled already, not in a field, a tool in hand: `putToolDown`) -- F1 to F3; `onPanelClose` focuses the map -- F6.
- [ ] `studio/UndoGroup.tsx` -- the focus moved when Undo or Redo turns off under it -- F5.
- [ ] `mapstudio.css`, `ItemList.tsx` -- the ring (`:focus-visible`) -- F4; the targets -- F7.
- [ ] `__tests__/editClick.test.ts` -- Esc at the root alone with a tool in hand; a test of the tick box's label.
- [ ] `e2e/tests/keyboard.spec.mjs` -- the fixed lines out of the pin, F5's check made to name where the focus is, Redo's check added, the toolbar's note reworded; run with `E2E_DOCS=1`.
- [ ] `docs/platform-checks.md` (the answer, the candidate list), `docs/contract.md` if it states Esc or focus, `docs/test-playbook-0.4.0.md` 8w, `CHANGELOG.md`.

**Acceptance Criteria:**
- Given the keyboard spec, when run, then F1 to F7 hold at both widths and the pin holds only the three findings left as known limits.
- Given the whole suite on a fresh stack, then 0 failed.

## Implementation Notes

- Planner, 2026-11-13: the environment and identity rules are entry 13b's plan's first Implementation Note. Leave the work uncommitted; run the specs you touch, not the whole suite; check `docker ps` first. Chromium moves the focus off a disabled button at the next rendering update, so `componentDidUpdate` usually still sees it on the button; keep a flag from the click as well. Undo is also off while a save is in flight ("Undoing..."): the focus must come back to Undo, or stay sensible, when it is on again; say what you chose.

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean, all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK
- `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` on a fresh stack -- expected: 0 failed
