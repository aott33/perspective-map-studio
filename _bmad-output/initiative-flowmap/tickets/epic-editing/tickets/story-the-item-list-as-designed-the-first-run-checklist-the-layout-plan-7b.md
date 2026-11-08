---
title: "7b: The first-run checklist on an empty map and the viewer's note"
type: 'feature'
ticket: '7'
created: '2026-11-08'
status: 'in-progress'
baseline_revision: '3a34b954c09bb78f76dda242fa3b829fffa8c1d5'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md', '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A map editor who opens Edit mode on a new, empty map sees a blank map and an empty list with no idea where to start, and a viewer on that map sees nothing at all and cannot tell whether it is broken.

**Approach:** Decisions (owner, 2026-10-27: the checklist is the only first-run aid, the tour dropped; 2026-11-08: entry 7 split, 7b last; "Approved and continue" on the planner's four picks: Add an item for step 2 until import, the card gone once an item lands or on Hide and hidden while a tool is in hand, the note "Nothing on this map yet.", an empty dev project for the tests). The card DESIGN.md `components.first-run-checklist` and key screen 8 draw, on an empty map in Edit mode, with steps that tick from what the map really holds, and a short note for View mode on an empty map.

## Boundaries & Constraints

**Always:** **When.** The card shows in Edit mode (the studio on) while the map has loaded with no items, is not hidden, and no tool is in hand (a tool armed hides it until put down); it is a floating card centred on the stage, 400 px, `surface-panel`, radius `lg`, the one soft shadow, never in the bottom-right corner. **Card.** Title "Get <project> on the map" (the Perspective project name the list's header uses), subline "Three steps. Edits save as you go."; three rows, each a numbered ring (`line-pipeline` 1.5 px; a check when done), a bold label, a help line and a button: (1) "Set up your kinds", help "Choose icons, key values, comms and alarms for the N kinds this project defines." (N from the host's kind list), primary "Open Kinds" opening the rail's Kinds surface; done when at least one kind setup exists; (2) "Add or import items", help "Click a kind in the toolbar and click the map. Importing a CSV, KML or GeoJSON file comes later.", button "Add an item" arming the generic Point tool (as the list's Add item; import is epic 5); done when the map has an item, which also ends the empty map and so the card; (3) "Check the operator view", help "See the map the way operators will, with live values.", button "Open view mode" leaving Edit mode; done once View mode was opened from it. Footer "N of 3 done" and a ghost "Hide checklist". **Kept.** Hide and step 3's done are kept per project and user in `localStorage` (null-safe as `unsaved.ts`); step 1 follows the kind setups the delegate now holds from `map.load.reply` (editors) and from `map.changed` kind-setup ops, so a setup saved through `system.mapstudio.applyEdits` ticks it live. **Keys.** The card's buttons are in the tab order; Esc does not hide it. **Empty list** keeps "No items yet - Items you add or import are listed here, grouped by place." **Viewer's note.** In View mode on a loaded map with no items, for every user, a small centred note "Nothing on this map yet." in `text-secondary` on the panel surface; gone once an item exists. 1366 and 1440 px; the card's width shrinks to fit at 1200 px. No em dashes.

**Never:** A tour, a modal, a toast; import; the Kinds screen itself (entry 12); change the card's look beyond DESIGN.md; show the card on the phone (Edit mode is desktop only) or in View mode; touch the Gateway beyond reading what `map.load.reply` and `map.changed` already carry.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty | An empty project, `mapeditor`, Edit mode | The card centred: title with the project name, "0 of 3 done" | No error expected |
| Kinds | Open Kinds pressed, then a kind setup saved by script | The Kinds surface opens; step 1 ticks live, "1 of 3 done" | No error expected |
| View | Open view mode pressed, Edit mode again | View mode with the note; back in Edit, step 3 ticked | No error expected |
| Add | Add an item pressed, a click on the map | The card hides while the tool is in hand; the pad placed; the card gone | No error expected |
| Hide | Hide checklist, then a reload | No card after the reload | No error expected |
| Viewer | The empty project as a viewer | The empty map and "Nothing on this map yet." | No error expected |
| Seeded | The seeded dev map in Edit mode | No card, no note | No error expected |

</frozen-after-approval>

## Code Map

- `web/typescript/MapStudio.tsx` -- render 1616-1765 (stage siblings 1695-1708: the chip, `DrawToolbar`, `DrawingBar`, `GeometryBar`, `renderListOverlay`, the style panel, the popup; the card and the note go here); `studioOn()` 1021-1028; `projectName()` 724-727 (the list's title 1541); `onRailSurface('kinds')` 1046-1058; `onRailView` 1040 (`setEditMode(false, true)`); `onAddItem` 1221 (`editing.pickTool(this, 'point', null)`); empty is `delegate.load.state === 'loaded' && delegate.items.length === 0` (load state at 717).
- `web/typescript/MapStudioStoreDelegate.ts` -- `onMapLoad` 1216-1240 drops `kindSetups`: keep them (`contract.ts` `KindSetupRecord` 74-79, `MapLoadReplyBody.kindSetups` 131, parsed 256-257); localStorage helper 152-156.
- `web/typescript/changes.ts` 20-23, 73, 111 -- `map.changed` ops with entity `kindSetup` parsed but not applied: apply them to the held setups (deleted drops).
- New `web/typescript/studio/FirstRunChecklist.tsx` (+ a pure `firstRun.ts` for when it shows and what is done, Jest-tested); kept flags beside `unsaved.ts`' localStorage key pattern (project and user).
- `web/typescript/mapstudio.css` -- floating layers (z-index notes 34-3635); the card and the note; `.mapstudio-list-empty` 2756 stays.
- Dev: an empty project for e2e (e.g. `mapstudio-empty`, inheriting `mapstudio-dev`'s views and setup, mounted by the dev compose and `ops/up.sh`, its store rows kept empty by the spec's cleanup through the test hook); a dev button or Gateway script on its page that saves one kind setup through `system.mapstudio.applyEdits` and one that deletes it, for step 1. ignition-lint on what changes. `e2e/lib/env.mjs` 41-50 `sessionUrl(path, project)`, `fixtures.mjs` `openMap(page, path, project)` 109.
- Tests: Jest `itemListPanel.test.ts` 100-101 stays; new `firstRun.test.ts`; e2e new `firstrun.spec.mjs` at 1366 (and the card at 1200 fits), as `mapeditor` and a viewer.
- Docs: `docs/development.md` (the empty project), `CHANGELOG.md` 0.4.0, `docs/test-playbook-0.4.0.md` a section "First run", `_bmad-output/deferred-work.md` the 7b entry resolved.

## Tasks & Acceptance

**Execution:**
- [x] Delegate and `changes.ts` -- kind setups held and kept live, Jest.
- [x] `firstRun.ts`, `FirstRunChecklist.tsx`, `MapStudio.tsx`, CSS -- the card, the note, Jest.
- [x] Dev empty project and the kind-setup buttons, ignition-lint clean.
- [x] e2e `firstrun.spec.mjs`.
- [x] Docs, CHANGELOG, deferred-work, the playbook section.

**Acceptance Criteria:**
- Given the empty dev project as `mapeditor` and as a viewer at 1366 px, when the matrix runs, then each row holds.
- Given a fresh dev stack, when the whole e2e suite runs, then every spec passes (the review 390 px flake may fail once and pass rerun alone).

## Implementation Notes

- Planner, 2026-11-08: the environment, commit and identity rules are 7c's plan's (Docker by hand after a restart, JDK 17 by apt if gone, `ops/up.sh --fresh` before a whole-suite run, the session's trailers, `git commit --only`, no em dashes, no model identifier, never a bare `git stash`, never a push). Commit at each working milestone.

- Approval (owner, 2026-11-08): "Approved and continue" with the four picks, written into the Approach; the plan kept whole.

## Plan Change Log

- Build, 2026-11-08: the empty project is `ops/project` mounted a second time as `mapstudio-empty`, not a child project inheriting `mapstudio-dev`: the module makes a setup lifecycle only for runnable projects (enabled and not inheritable, `SetupLifecycleFactory`), so making `mapstudio-dev` inheritable would have taken the dev map's setup away. Same views, setup, kind list and scripts; its own map. The kind setup buttons are on a new page `/empty` (view `MapStudioEmpty`, library `mapstudio_empty`, always writing `mapstudio-empty`'s geofence kind setup). The suite signs in per project (`editorAuth.mjs` `stateFile(user, project)`, `signInEditorOnce(user, project)`). Step 1's help says "kind" for one kind. The ring's check is a new chrome glyph `check` (`controls.ts`); a ghost button style `mapstudio-button--ghost` is new. The second mount made `adapters.spec.mjs`' call count double (the empty project refreshes its lists through the same `mapstudio_dev` functions), so the dev adapter counts only `mapstudio-dev`'s calls (`system.util.getProjectName()`); the designer tests listing the dev project's pages and libraries take `/empty` and `mapstudio_empty`. Save a kind setup restores at a tombstone's version, as the seed does.

## Review Triage Log

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL (the `SetupLookupsTest` timing flake may fail once; rerun).
- `ignition-lint --files` on changed dev scripts and views -- expected: zero errors and warnings.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: green (the review 390 px flake may fail once; rerun it alone).

Build, 2026-11-08: `tsc` clean, Jest 659 passed in 63 suites (`firstRun.test.ts` new); `./gradlew clean build --offline --rerun-tasks` BUILD SUCCESSFUL. On `ops/up.sh --fresh` the whole e2e suite: 258 passed, 7 skipped, 2 failed in 49.6 min: `adapters.spec.mjs`' call count (the second mount, fixed as above, then adapters.spec 3 of 3) and the known review 390 px flake (passed rerun with its theme's group, 5 of 5). After the fixes `firstrun.spec.mjs` 16 of 16 with `--repeat-each 2`. A whole-suite rerun after the fixes was not done. ignition-lint not run: installing it was not permitted in this session; the changed scripts and view scripts were parsed with Python's `ast` only.
