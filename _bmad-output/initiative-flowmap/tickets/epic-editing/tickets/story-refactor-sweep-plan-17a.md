---
title: "17a: the sweep's code and test-helper cleanup"
type: 'refactor'
ticket: ''
part_of: '17'
created: '2026-11-13'
status: 'built'
baseline_revision: '194206f44671fd669abd22738989f058356e968f'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
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
- [x] `web/typescript` shared helpers -- one home each for the repeats above, the copies importing it -- only where the bodies are the same.
- [x] `history.ts`, `itemList.ts`, `geometry.ts` -- the two differing pairs renamed apart.
- [x] `studio/` -- one "Pick a tag" button; the tab list's markup shared where key handling does not change.
- [x] `studio.ts`, `editing.ts`, `selection.tsx` and their tests -- the unused selector removed, the same-named functions renamed apart.
- [x] `e2e/tests/fixtures.mjs` and the specs -- a helper moves only when every copy is the same; a copy that differs stays in its spec under its own name.
- [x] `CHANGELOG.md` -- one line under internal changes.

**Acceptance Criteria:**
- Given the diff, when read, then no test expectation, user-visible string, CSS class, `data-` attribute or contract field changed.
- Given the whole suite on a fresh stack and the unit tests, then all pass.
- Given the built bundle, then it is no larger than before.

## Implementation Notes

- Planner, 2026-11-13: the environment and identity rules are entry 13b's plan's first Implementation Note; they hold here. Leave the work uncommitted; run the unit tests and the specs you touch in groups, not the whole suite at once. Check `docker ps` before any stack work and start Docker as the hand-off note says if it stopped. When two copies turn out to differ in any way, leave both and note it here.
- Planner, 2026-11-13 (the owner asked for a very thorough sweep): the Code Map is where the survey found repeats, not the limit. Before changing anything, search all of `web/typescript` and `e2e` yourself for every helper defined more than once (same name or same body) and for exports nothing imports, and list what you found here with each one's verdict: moved, renamed apart, or left and why. Compare the bodies of every copy character by character before a move. Run the unit tests after each group of moves, and every spec whose file you touched before you report; say which ran and their counts.
- Implementer, 2026-11-13: built as planned, left uncommitted. The survey (every top-level name defined in more than one file of `web/typescript` and of `e2e`, every pair of functions with the same body, every export no other file imports) and each one's verdict:
  - **Moved, the bodies the same character for character (parameter names aside):** `SPRITE_URL` (4 copies and the literal in `popupParts.tsx`), `SVG_NS` (3 and two literals in `SearchControl.ts`) and `PHONE_QUERY` (2; the Code Map's `place.ts`, `startingArea.ts` was a slip, they are in the Search and Legend controls) to `controls.ts`, the pure module all three controls import already (`mapLayers.ts` would pull MapLibre into `NeedsYouControl.ts`); `EARTH_RADIUS_M` (3) exported from `shared.ts`, which imports no Turf package (`geometry.ts` imports it from there); `finite` (3) to `json.ts`; `same` (`history.ts`, `unsaved.ts`) exported from `unsaved.ts`; `without` (`kindSetup.ts`, `KindSetupPanel.tsx` and `itemOverrides.ts`, where it was the private `withoutKey`: the panel's generic form is the one kept) exported from `itemOverrides.ts`, the lower module; `OP_PREFIX` (`kindSetup.ts`, `itemOverrides.ts`) exported from `itemOverrides.ts`, the lower module; `DATA_FIELDS` (`history.ts`, `undo.ts`) exported from `undo.ts`.
  - **Renamed apart, each body untouched (same name, different result):** private: `history.ts` `changedKeys` to `opKeys`, `pointOf` to `geometryPoint`, `coordsOf` to `geometryLine`, `lengthM` to `pathLengthM`; `unsaved.ts` `pointOf` to `recordPoint`; `itemOverrides.ts` `same` to `sameValues` (it has an `a === b` shortcut the shared `same` has not, so it stays apart); `PropertiesPanel.tsx` `without` to `copyWithout` (it always copies, the shared one returns the same map when the key is absent) and `sameValue` to `sameAsStored`; `adapters.ts` `readField` to `readFormField`; `basemaps.ts` `rounded` to `roundedText`; `placeCheck.ts` `join` to `joinPlace`; `directions.ts` `warned` to `warnedTemplates`. Exported: `history.ts` `whenText` to `historyWhenText`; `editing.ts` `pickTool` to `pickUpTool` (beside `putToolDown`) and `armInstrument` to `startInstrument`; `selection.tsx` `clearSelection` to `dropSelection` (the model's three in `studio.ts` keep their names, so `studio.test.ts` is untouched by them); `popupPlacement.ts` `cameraPadding` to `paddingFor` (the alias `camera.ts` gave it already); `connection.ts` `clockText` to `clockTextAt`; `SelectionCount.tsx` `countText` to `selectionCountText`; `itemList.ts` `fieldLabel` to `groupFieldLabel`; `drawing.ts` `reasonText` to `drawingReasonText`; `needsyou.ts` `summaryText` to `needsYouSummaryText`; `kindSetup.ts` `valueText` to `caseValueText`. A unit test of a renamed export imports it under its old name (`import { historyWhenText as whenText }`), so the test changes in its import only.
  - **Removed:** `studio.ts` `selectedId` (tests only; its six `expect(selectedId(...))` lines in `studio.test.ts` went with it, five beside an `expect(state.selected)` that stays and the mount test's replaced by the same check on `selected`), `editing.ts` `pickPointTool` and `kindSetup.ts` `setupKind` (no caller and no test).
  - **Shared markup:** `studio/TagButton.tsx` `tagButton` (the three "Pick a tag" buttons; the attributes in the order they were) and `studio/PanelTabs.tsx` `panelTabs` (the Details and Style tabs with `roving`: their ref, `tabindex` and key handler as before; the Layers and Legend tabs without it: no `tabindex`, no key handler, as before). Both are plain functions returning the markup, not components, so the React tree is the one it was.
  - **Left, and why (web):** `studio.ts` `isDrawing` (one real caller, `editing.ts`); `text` in `placeCheck.ts` and `kindSetup.ts` (private, different, and the word is in too many places for a safe rename); `shared.ts` `distanceM` and `geometry.ts` `haversineM` (the same formula written differently: not the same body, so not merged; a candidate for a later entry); `sameOverrides` and `sameSetup` (the same body under two exported, tested names, each named for what it compares); `assetListKnown` and `kindListKnown` (the same body by intent, each with its own comment); `contract.ts` `KindSetupOp` (no importer; a type of the contract's mirror, left with it); exports only their own file and its test read (`basemapSourceBody`, `lineMoveBatch`, `isFullTagPath`, `batchSetup`, `staleText`, `isAssetRelative`, `withItem`, `pointKind`, `resetDirectionsWarnings`, `CONTRACT_VERSION`): each has tests whose expectations would go, which this entry did not take on beyond `selectedId`; the many exports read only inside their own file or by its test (types and constants mostly) keep `export`; the Jest files' own copies (`notify`, `fireEvent`, `sent`, `save`, `reply` and the like in the delegate tests) close over each file's `jest.mock` and `delegate`, so they stay.
  - **Moved to `e2e/tests/fixtures.mjs`, every moved copy identical to the text it replaced** (checked by script against HEAD: 270 uses in 46 specs; each dependency of a moved helper is the same import or the same moved text in every spec it left): the constants `REPLY_MS` (22 specs), `NOTHING_MS` (10), `INTERVAL_MS` (13), `CTB1`, `SWD1`, `BEND`, `SWD_VIEW`, `CTB1_VIEW`, `UUID`, `PUSH_MS`, `INSET`, `SIMULATED`, `PROJECT`, `KEY`, `PSQL`, `OSM_TILES` and `TILE_PNG` (`basemaps.spec.mjs` imports it as `PNG`); the helpers `openEditor` (12), `liveItem` (13), `pixelNow` (9), `seqOf`, `selectRow`, `expectOneBatch`, `expectNothingSent`, `storedAll`, `setupOf`, `openKinds`, `insideRing`, `expectStageWidth`, `placePad`, `legendPanel`, `legendButton`, `press`, `stored`, `apply`, `saveWords`, `settled`, `storedQueue`, `openDev`, `load`, `saved`, `refused`, `create`, `update`, `del`, `batch`, `point`, `bar`, `undo`, `field`, `input`, `undoOnce`, `spotFromTop`, `sql`, `changedFrames`, `expectRefused`, `expectDetails`, `expectNoPopup`, `drag`, `endsAre`, `labelsPlaced`, `clickPoint`, `openItems`, `padCount`, `lossTest`; and the four identical `shot` wrappers (800 ms, then the shared `shot`) as `shotSettled`, imported as `shot`. `tagbrowser.spec.mjs` imports `firedEvent` and `EVENT_FIRED` from `lib/sockets.mjs`, which now exports them, in place of its copy. Imports a spec no longer used were dropped.
  - **Left in the specs (e2e):** every copy that differs keeps its name in its spec: `openEditor` (7 other forms in 13 specs), `expectOneBatch` (itemstyle, overrides, tagpicks: it reads `undo(page)`), `press` (adapters and details: the adapter buttons; itemlist), `openKinds` (kinds, overrides), `placePad` (layout), `stored` (drawing, layout, recentchanges), `settled` (details), `shot` (details, itemstyle, overrides, store-ops), `INTERVAL_MS` 40 s (itemlist, studio), `SWD_VIEW` (drawing), `groundSpot` (4 forms), the tile stubs `stubTiles` and `stubOsmTiles`. `restoreSeed` (5 the same) and `restore` stay: each reads its spec's own `seed`, so a move would change the body. Not moved, two copies each or one name with two meanings: `AWAY` (three different places), `P14`, `LOST_S`, `SWD`, the pairs `ADAPTERS`, `APP_BAR_CLEARANCE`, `ASSETS_FN`, `BIND_MS`, `CHANGE_MS`, `IN_VIEW_MARGIN`, `LIVE_MS`, `P12`, `POPUP_MS`, `PT1_AT`, `PT2_AT`, `YOU`, and the one-line locators `card`, `line`, `note`, `popup`, `row`, `rule`, `style`, `use`, `value`, `same`, `noUnsaved` (too plain a name to export for two users, or two meanings). `e2e/perf` and `e2e/lib` were surveyed and left (`playwrightVersion`, `percentile`, `round` are the perf run's own copies).
  - No behaviour change was found on the way, so nothing was added to `_bmad-output/deferred-work.md`.
- Implementer, 2026-11-13, what ran: `npx tsc --noEmit` clean and Jest 80 suites, 1176 passed (after each group of moves and at the end; the count is the one before, `selectedId` having no test of its own); `./gradlew clean build --offline --rerun-tasks` BUILD SUCCESSFUL; `check-contract-versions.sh` OK; the e2e lib's unit tests 36 passed; the production bundle `MapStudio.js` 1,804,072 bytes against 1,805,112 before (the stylesheet unchanged). On a fresh stack (`ops/up.sh --fresh`) with the new build, every spec (46 of the 53 are touched), in five groups in the suite's order: 74, 73, 74, 54 and 62 passed, 337 in all, 9 skipped (the store-check and Gateway-stop scenarios, as before), 0 failed. The specs were also checked with TypeScript's `checkJs` for a name no longer defined or imported: none. ignition-lint is not installed here and nothing in `ops/config` changed.

## Plan Change Log

## Review Triage Log

Quick review, 2026-11-13 (one reviewer, by inspection with a read-only script over the moved e2e helpers, and the orchestrator's reading of the shared markup and the unit tests' diff). The e2e moves, the spec edits, the shared helpers' bodies and the shared markup read as identical to what they replace. Six findings: 5 low, 1 false; no intent gap, no plan fault.

- low, patch: `studio/PropertiesPanel.tsx` :368: the panel's `without` was renamed `withoutKey`, a name `itemOverrides.ts` :321 already holds for a function with a different result (it returns the same map when the key is absent), so the rename made a new same-name pair (decision 3); and that private `withoutKey` has the body of the shared `without`, a third copy the survey missed. One home for the shared one; the panel's gets a name of its own.
- low, patch: `__tests__/studio.test.ts`: six `expect(selectedId(...))` lines went with the selector; five sit beside an `expect(state.selected)` that stays, but the mount test now asserts nothing of the selection its title names. An equal assertion on the state's `selected` is kept there.
- low, patch: `EARTH_RADIUS_M`'s home is `geometry.ts`, so `shared.ts` and `userLocation.ts` now import a module that pulls four Turf packages, the ground the note gave against `mapLayers.ts` for `SPRITE_URL`. No runtime effect today (one bundle, no cycle). Homed in a module with no such imports.
- low, patch: `controls.ts` :8-12: the surviving comments on `PHONE_QUERY` and `SPRITE_URL` describe one caller, and `SVG_NS` has none. Reworded for all callers.
- low, patch: two blank lines in a row left where constants were removed (`LegendControl.ts` twice, `NeedsYouControl.ts`, `SearchControl.ts`).
- false, rejected: "acceptance criteria 2 and 3 cannot be confirmed by inspection". They are run, not read: the orchestrator's Verification and the whole suite, recorded in the Outcome.

**Outcome (2026-11-13):** built. Review (quick): five low findings patched, one rejected as false; nothing deferred. tsc clean; Jest 80 suites, 1176 passed; Gradle BUILD SUCCESSFUL; contract check OK; `MapStudio.js` 1,803,991 bytes (before 1,805,112), CSS unchanged. Whole e2e suite on a fresh stack: 337 passed, 9 skipped, 0 failed.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean, all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK
- `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` on a fresh stack -- expected: 0 failed
