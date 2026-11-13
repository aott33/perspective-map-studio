---
title: "20b: the Units row in Edit mode's Layers surface"
type: 'feature'
ticket: ''
part_of: '20'
created: '2026-11-12'
status: 'ready-for-dev'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'medium'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/docs/contract.md', '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-editing/tickets/story-the-tag-browser-one-tree-for-every-tag-pick-asset-relative-p-plan-13b.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The store keeps a map editor's units override (19b) and every distance follows it (20a), but no control sets it: only a script or the test hook can. R27 asks for the choice in Edit mode's Layers surface.

**Approach:** The Layers tab of the Layers surface gains a Units section under Show and Basemap: a System group (From setup, Metric, US) and a Labels group (Short, Long), drawn as the Basemap buttons are. A press saves at once as one settings op through the delegate; the row shows the override the store holds, so it follows another editor live.

Decisions (owner, 2026-11-13, "Approve" on the plan and its seven picks): (1) Place: a third section, "Units", on the Layers tab only; never on the Legend tab, View mode's legend panel or the phone sheet. (2) Form: two button groups in the Basemap buttons' style, each with a small label ("System", "Labels"); the one in force is pressed. (3) From setup clears the override (a delete op). Labels are then Short and the Labels group is disabled, with the note "Pick Metric or US to choose the labels." (4) A note under System says what the setup gives: "The setup says Metric.", "The setup says US.", or "The setup follows each browser's language." (5) A press shows as pressed at once and is put back if the save is refused; a refused or unsent save is told by the save card as every other edit is; no new status words in the Layers header. (6) Words: the row says Short and Long, and Recent changes follows it ("Metric, short labels", "US, long labels") in place of 19b's "symbols" and "words". (7) No Undo step (19b's rule); Revert in Recent changes is the way back.

## Boundaries & Constraints

**Always:** The row reads the delegate's live override (`units`) and the setup's units; nothing is kept in the control but the press in flight. Ops as 19b defines them: create at 0, or at the tombstone's version after a clear; update and delete at the held version. One save in flight; a later press waits and goes at the version the reply gave. A press of the pressed button sends nothing. While editing is paused (store or Gateway down, a reload pending) both groups are disabled. Buttons are real buttons with `aria-pressed` inside a labelled group; focus stays on the pressed button through a redraw. Each has `data-units-system` or `data-units-labels` for the tests. The e2e helpers stay, and every spec that sets units through the row clears them at its end.

**Never:** A change to the Gateway, the store, the contract's messages or the formatter; a third system or an "Auto" button (an override of `auto` can still be set by a script; the row then presses nothing in System and both groups stay enabled); the row for a phone editor or a viewer; a units control in the Designer (19a has it).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| U1 Shown | Edit mode, Layers tab, no override, setup `metric` | Units under Show and Basemap: From setup pressed, Short pressed and Labels disabled, the note "The setup says Metric." | No error expected |
| U2 Set | Press US | A create op `{us, short}`; US pressed, Labels enabled; the popup of L-SWD reads 1.8 mi here, in a second editor's browser and in a viewer's, no reload | No error expected |
| U3 Labels | Press Long after U2 | An update `{us, long}`; "1.8 miles" in all three | No error expected |
| U4 Clear | Press From setup after U3 | A delete op; distances back to the setup's, labels short, Labels disabled | No error expected |
| U5 Again | Press Metric after U4 | A create at the tombstone's version, no conflict | No error expected |
| U6 Same | Press the pressed button | Nothing is sent | No error expected |
| U7 Live | Another editor sets `us, long` | This row shows US and Long pressed without a reload | No error expected |
| U8 Quick | Press US then Long before the first reply | Two saves, the second at the first reply's version; ends `{us, long}` | No error expected |
| U9 Conflict | Another editor's save lands between the press and the send | The row shows the stored value | The save card tells the conflict as 19b words it |
| U10 Paused | The store is down | Both groups disabled | No op sent |
| U11 Elsewhere | Legend tab; View mode's legend; the phone sheet | No Units section | No error expected |
| U12 History | After U2 to U4 | Three rows in Recent changes in the row's words, each with Revert; no Undo step | No error expected |

</frozen-after-approval>

## Code Map

- `web/typescript/LegendControl.ts` -- draws the docked Layers tab (`render`, :256-330; `renderShow` :554; `renderBasemaps` :607, the buttons' pattern; `section` :596; focus kept by `data-focus-key`). The Units section goes in the `controls` part of a docked host only.
- `web/typescript/MapStudio.tsx` -- `renderDock` :1927 (the Layers surface), `setLayersHost`, `applyUnits` (20a; feeds the controls), the delegate's props.
- `web/typescript/MapStudioStoreDelegate.ts` -- `units`, `setupUnits` in the state (:201-211); `saveKindSetup` and `pumpKind` (:566-620), the pattern for one save in flight with no undo step; `dispatch` :1100; the saved units held at the reply's version (:2469); `pausedFor`.
- `web/typescript/changes.ts` -- `ChangeState.units` (the tombstone's version is here), `liveUnits` :60.
- `web/typescript/unsaved.ts` -- `unitsWords` :127 (decision 6).
- `web/typescript/mapstudio.css` -- `.mapstudio-basemap-group`, `.mapstudio-basemap-button`, `.mapstudio-legend-note`.
- `e2e/tests/units.spec.mjs`, `e2e/tests/settings.spec.mjs`, `e2e/tests/fixtures.mjs` (`setUnits`, `clearUnits`) -- the specs to extend.
- Docs: `docs/contract.md` ("The units setting"), `docs/setup.md`, `docs/test-playbook-0.4.0.md` (8t, 8u; a new 8v), `CHANGELOG.md`, DESIGN.md and EXPERIENCE.md under `_bmad-output/initiative-flowmap/ux-map-studio`.

## Tasks & Acceptance

**Execution:**
- [ ] `MapStudioStoreDelegate.ts` and a unit test -- `saveUnits(choice)`: the op built from the held record, one in flight, the wait, the put-back on a refusal -- U2 to U6, U8, U9, tests first.
- [ ] `LegendControl.ts`, `mapstudio.css` and a unit test -- the Units section, its setter and callback, disabled states, the notes -- U1, U7, U10, U11.
- [ ] `MapStudio.tsx` -- the control fed from the delegate's props; the callback wired to `saveUnits`.
- [ ] `unsaved.ts`, `history.ts` and their tests -- decision 6's words.
- [ ] `e2e/tests/units.spec.mjs` -- U1 to U5, U7, U11, U12 through the row with a second editor and a viewer.
- [ ] Docs, the playbook's 8v, the changelog.

**Acceptance Criteria:**
- Given the dev Gateway, when an editor presses US in the Layers row, then a second open browser and a viewer's map read miles with no reload, and Metric puts kilometres back.
- Given a phone editor or a viewer, when the legend opens, then no Units section shows.
- Given the whole suite on a fresh stack, then it passes with the units cleared at the end.

## Implementation Notes

- Planner, 2026-11-12: the environment and identity rules are entry 13b's plan's first Implementation Note; they hold here. Leave the work uncommitted; run the specs you touch, not the whole suite. Check `docker ps` before any stack work and start Docker as the hand-off note says if it stopped. Clear the override at the end of every spec that sets it.

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean, all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK
- `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` on a fresh stack -- expected: 0 failed
