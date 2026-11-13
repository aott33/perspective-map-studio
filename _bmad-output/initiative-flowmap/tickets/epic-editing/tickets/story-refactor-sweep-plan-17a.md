---
title: "17a: the sweep's code and test-helper cleanup"
type: 'refactor'
ticket: ''
part_of: '17'
created: '2026-11-13'
status: 'ready-for-dev'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'medium'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/tickets/epic-editing/tickets/story-the-tag-browser-one-tree-for-every-tag-pick-asset-relative-p-plan-13b.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Twenty-odd entries left the same small helpers written two to four times across the studio's surfaces, a few leftovers of the mode and selection model, and the same e2e helpers copied into up to 25 specs. Each copy is a place for the next change to miss.

**Approach:** Cleanup only: each repeated helper gets one home and the copies import it; the model's unused and same-named leftovers are removed or renamed; the copied e2e helpers move to the shared fixtures. Nothing a user sees and nothing in the contract changes; every existing test passes with its expectations untouched.

Decisions (owner, 2026-11-13, "Get a new agent to do the sweep. Make sure it's very thorough", taken as approval of the plan and its five picks): (1) Entry 17 is split: this is 17a, the code and the test helpers; 17b is the keyboard and contrast pass, the contract docs' wording and the deferred-work housekeeping. (2) `drawing` and `selected` stay their own state fields beside `studio`; folding them into the model is not done (a wide change before a release for no gain a user sees). (3) Helpers of the same name that give different results (`whenText`, `lengthM`) are renamed apart, never merged. (4) The Layers and Legend tabs share the Details and Style tabs' markup helper only where that changes no key handling; arrow keys for them are 17b's finding, not this entry's. (5) Behaviour changes found on the way are written to `_bmad-output/deferred-work.md`, never fixed here.

## Boundaries & Constraints

**Always:** A move or a rename only: the body that survives is one of the existing copies, unchanged, and where the copies differ they stay apart under distinct names. No expectation in any unit or e2e test changes; a test file changes only in its imports and removed local helpers. Unit tests of a removed function go with it. The bundle's public surface (the component's props, events, `data-` attributes, CSS classes) is untouched.

**Never:** A behaviour, wording, timing or contract change; a new dependency; the Gateway, the store or the Designer; a fix of the undo-in-flight race, the Esc-in-a-field save or any other open deferred item; a change to `docs/contract.md` (17b); reformatting of lines not otherwise touched.

</frozen-after-approval>

## Code Map

- `web/typescript/history.ts` :164, :169, :387 and `unsaved.ts` :623, :635, :649 -- `same`, `changedKeys`, `pointOf` twice; `itemOverrides.ts` :470 a third `same`.
- `history.ts` :521, :557 against `itemList.ts` :281 (`whenText`, different output) and `geometry.ts` :47 (`lengthM`, haversine against Turf) -- rename apart.
- `studio/KindSetupPanel.tsx` :678-686, `studio/PropertiesPanel.tsx` :1026, `studio/RuleEditor.tsx` :578 -- three "Pick a tag" buttons.
- Small repeats: `without` (`kindSetup.ts` :151, `KindSetupPanel.tsx` :170, `PropertiesPanel.tsx` :366); `SPRITE_URL` (`LegendControl.ts`, `NeedsYouControl.ts`, `SearchControl.ts`, `mapLayers.ts`); `SVG_NS` three times; `EARTH_RADIUS_M` (`geometry.ts` :600, `shared.ts` :17, `userLocation.ts` :91); `finite` three times; `PHONE_QUERY` (`place.ts`, `startingArea.ts`).
- `studio.ts` :248 `selectedId` (tests only), `isDrawing` (one caller, `editing.ts` :1312); same names in two places: `pickTool`, `armInstrument` (`studio.ts` :87, :99; `editing.ts` :973, :1362), `clearSelection` (`studio.ts` :225, `selection.tsx`).
- `studio/PropertiesPanel.tsx` :43-49, :1116-1126 and `MapStudio.tsx` :1965-1972 -- the two tab lists.
- `e2e/tests/fixtures.mjs` -- the home for `openEditor` (the same in 25 specs), `liveItem`, `pixelNow`, `seqOf`, `selectRow`, `expectOneBatch`, `restoreSeed`, `expectNothingSent`, `storedAll`, `setupOf`, `openKinds`, `insideRing`, `expectStageWidth`, `placePad`, `legendPanel`; `shot` is exported there already and redefined in 8 specs; `groundSpot` differs in `events.spec.mjs` and stays apart; the OSM tile stub is copied in `basemaps.spec.mjs` :25 and `studio.spec.mjs` :1041.

## Tasks & Acceptance

**Execution:**
- [ ] `web/typescript` shared helpers -- one home each for the repeats above, the copies importing it -- only where the bodies are the same.
- [ ] `history.ts`, `itemList.ts`, `geometry.ts` -- the two differing pairs renamed apart.
- [ ] `studio/` -- one "Pick a tag" button; the tab list's markup shared where key handling does not change.
- [ ] `studio.ts`, `editing.ts`, `selection.tsx` and their tests -- the unused selector removed, the same-named functions renamed apart.
- [ ] `e2e/tests/fixtures.mjs` and the specs -- a helper moves only when every copy is the same; a copy that differs stays in its spec under its own name.
- [ ] `CHANGELOG.md` -- one line under internal changes.

**Acceptance Criteria:**
- Given the diff, when read, then no test expectation, user-visible string, CSS class, `data-` attribute or contract field changed.
- Given the whole suite on a fresh stack and the unit tests, then all pass.
- Given the built bundle, then it is no larger than before.

## Implementation Notes

- Planner, 2026-11-13: the environment and identity rules are entry 13b's plan's first Implementation Note; they hold here. Leave the work uncommitted; run the unit tests and the specs you touch in groups, not the whole suite at once. Check `docker ps` before any stack work and start Docker as the hand-off note says if it stopped. When two copies turn out to differ in any way, leave both and note it here.
- Planner, 2026-11-13 (the owner asked for a very thorough sweep): the Code Map is where the survey found repeats, not the limit. Before changing anything, search all of `web/typescript` and `e2e` yourself for every helper defined more than once (same name or same body) and for exports nothing imports, and list what you found here with each one's verdict: moved, renamed apart, or left and why. Compare the bodies of every copy character by character before a move. Run the unit tests after each group of moves, and every spec whose file you touched before you report; say which ran and their counts.

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean, all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK
- `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` on a fresh stack -- expected: 0 failed
