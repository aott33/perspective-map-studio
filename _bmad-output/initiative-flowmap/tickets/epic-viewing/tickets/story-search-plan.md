---
title: 'Search'
type: 'feature'
ticket: '9'
created: '2026-10-28'
status: 'built'
baseline_revision: '05a0921887101706a4e4617465a0cbebb8dc9612'
route: 'full'
route_source: 'pinned'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/handoff-epic-3.md'
  - '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md'
  - '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md'
  - '{project-root}/docs/contract.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A viewer has no way to find a map item but by panning: the 30-pad set and a 300-pad field need a search by name or by the asset an item is linked to, on a desktop and on a 390 px phone, by keyboard alone (R4; prd FR-33; EXPERIENCE.md Search; DESIGN.md search-field and Phone top bar).

**Approach:** One MapLibre control top-left, `SearchControl`, which is View mode's top bar: a search field (DESIGN.md `search-field`, 300 by 40 px, "Search sites, wells or lines") whose results list opens under it as the user types, built on a pure module `search.ts` (the entries from the loaded map and the asset names, the fold, the ranking, the cap) so no message goes to the Gateway for a search. A choice zooms to the item and selects it as a click does. The control's row leaves a slot after the field where entry 3 puts Needs you, and at phone width the control is the one top bar 8 px from the edges that expands with the results. `map.load.reply` gains `assetNames` at every level, since a viewer gets no asset rows and R4 says any user.

## Decisions (recorded for the owner, 2026-10-28; the session is unattended)

1. **`assetNames` in `map.load.reply`** (contract 0.3.0, unreleased, additive): `[{id, name}]` at every level, the path-free projection of the asset list, as `kindDisplay` is for the kind setups. The owner's rule that viewers get no tag paths holds (no `basePath`, no `kind`); item names are already shown to viewers, so an asset's name is no secret. A reader of an older Gateway takes the names from `assets` when it has them. No new message type.
2. **Ranking and cap.** Four tiers: a name that starts with the folded query, an asset name that does, a name that holds it, an asset name that does; by folded name within a tier, then by id; at most 8 rows (`SEARCH_LIMIT`; DESIGN.md names no number). The fold is NFD with the combining marks removed, lower case, one space between words. A whole-name prefix, not a word prefix.
3. **A row reads** the kind glyph (the sprite's symbol through `<use>`, as the default popup draws it), the name in bold, and the kind name, or "kind - asset" when the asset matched (the ticket's "name and kind or asset"). With no match the list says "No matches" (EXPERIENCE.md's assumed wording, kept).
4. **Choosing a point opens its popup.** EXPERIENCE.md's Select primitive says a select in View mode opens the popup and "choosing zooms and selects (lines and areas fitted)"; a chosen point is shown at zoom 15 at least (the glyph, the name and the icon KPI all draw from 15; a higher zoom is kept) with `jumpTo` (no animation, as Return and Fit move), its popup opened and `point.click` sent, as a click on its marker does; a line or an area is fitted (48 px padding, as Return fits a line) and selected with no popup (the line popup is entry 2's). A kept Fit ends, as any move of the view does.
5. **Keyboard and ARIA.** The input is a combobox (`aria-autocomplete="list"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`) over a listbox of options with `aria-selected`; ArrowDown and ArrowUp move the active row and wrap (ArrowDown opens a closed list), Home and End jump, Enter chooses the active row or the first when none is active, Esc clears the text and closes the list and is stopped there (the legend and the drawing tool never see it), Tab or a click elsewhere closes it (a press on a row or the Clear button keeps the focus in the input). After a choice the text is cleared (the chosen item is selected and in view, the placeholder shows as the mockups draw it), a polite live region says "<name> selected", and the focus goes where the choice leads: into the popup of a chosen point (MapLibre's `focusAfterOpen`, so Esc there closes the popup and the field is one Shift+Tab away), or stays in the field for a line, which opens no popup; at phone width the field gives the focus up so the keyboard goes away from the item and its sheet.
6. **The top bar.** On a desktop the row's children are separate floating cards (the field, and entry 3's Needs you beside it, 12 px apart, as the mockups draw them) and the results panel is a card of its own under the field, 300 px wide; at phone width the control itself is the one top bar (`phone-top-bar`: 48 px, `rounded.lg`, the floating shadow, 8 px from the edges and as wide as the map), its row's children flat inside it and the panel expanding inside it under a divider; the top-right corner moves down 56 px so the zoom card sits under the bar (DESIGN.md Phone). Entry 3 appends Needs you to the row through `SearchControl.slot()` (or adds its own control top-left, which MapLibre stacks under this one); `data-search-open` on the control and on `.mapstudio-map` lets it hide Needs you while the search is open on a phone.
7. **The style preview panel** (`/styles`, the `previewStyles` prop) moves from 8 px to 64 px from the top so it no longer covers the search field.
8. **No subagents.** The session has no subagent tool: this agent implements from the plan and runs the quick review lens itself over the diff.

## Boundaries & Constraints

**Always:** every colour a theme token (AD-11); the search in the browser from `map.load.reply` only; the Clear button and the list in the DOM only while they are needed (no hidden 0 by 0 target); the state said in words (the live region, "No matches"); 44 px targets below 768 px; nothing in the bottom-right corner; contract 0.3.0 (`check-contract-versions.sh` green); no em dashes; `README.md` untouched; existing e2e attributes kept.

**Never:** the Needs you summary (entry 3), the legend's key (3), the line popup (2), the bottom sheet (8), an items panel, a change to the basemap messages, a change to `ign-scada-template`, a `.modl` or scratch project committed, a Gateway write outside the local dev stack.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty query | '' or spaces | no list; the Clear button absent | none |
| Prefix first | "pad 1" over Pad 1, Pad 12, Point 1 (asset Pad 12) | Pad 1, Pad 12 (name prefix, by name), then Point 1 (asset prefix) | none |
| Contains | "d 3" | Line to Pad 3, Line to Pad 30, Pad 3, Pad 30 (names that hold it, by name) | none |
| Case and accents | "PÁD 14" | the same rows as "pad 14" | none |
| Asset match | "Pad 14" | Pad 14 (name, "Well pad") then Point 2 (asset, "Well pad - Pad 14") | a point linked to an asset not in the list matches by name only |
| Cap | "pad" over 30 pads | 8 rows | none |
| No match | "zzz" | "No matches" in the panel; Enter does nothing | none |
| Choose a point | Enter on Point 2 | zoom 15 (or the higher one kept), centred on it, selected, popup open, `point.click` sent, text cleared, "Point 2 selected" | an item gone since the list was built: one console line, nothing moves |
| Choose a line | Enter on Tracer line | fitted, selected (casing, arrow), no popup | none |
| Esc | text in the field, list open | text cleared, list closed, focus kept, the popup and the legend untouched | none |
| Deleted item | map.changed deletes an item | the next list leaves it out (entries follow the items revision) | none |
| Phone | 390 px | the bar 8 px from the edges, 48 px tall, 374 px wide; rows and the Clear button 44 px; the zoom card under the bar; the field blurred after a choice | none |

</frozen-after-approval>

## Code Map

- `common/.../contract/Asset.java` -- `namesJson(List<Asset>)`; `gateway/.../load/MapLoader.java` -- `assetNames` at every level; `MapLoaderTest`.
- `web/typescript/adapters.ts` -- `AssetName`, `HostLists.assetNames`, `readAssetName`, the older-Gateway fallback; `adapters.test.ts`, `contract.test.ts`.
- `web/typescript/search.ts` (new, pure) -- `fold`, `buildEntries`, `searchEntries`, `resultDetail`, `chosenText`, `SEARCH_LIMIT`, `CHOSEN_POINT_ZOOM`; `search.test.ts`.
- `web/typescript/SearchControl.ts` (new) -- the `IControl`: the row with the field, the slot, the panel, the combobox rules; `controls.ts` -- the `search` and `close` glyphs.
- `web/typescript/MapStudio.tsx` -- the control top-left, `setEntries` on an items change, `onSearchChoose`, `data-search-open`.
- `web/typescript/mapstudio.css` -- the top bar, the field, the panel, the rows, the phone bar, the zoom card's offset, the style panel's top.
- `e2e/tests/search.spec.mjs` (new) -- four tests: typing, ranking, cap and a click at 1440; keyboard only; the asset match for a viewer; 390 px.
- `docs/contract.md` (the `map.load.reply` row, "Search"), `docs/kinds-and-assets.md`, `docs/map-parity.md` (row 7), `CHANGELOG.md`, `docs/platform-checks.md` ("Epic 3 entry 9"), `docs/screenshots/mapstudio-search-{1440,chosen-1440,390,chosen-390}.png`, this plan.

## Tasks & Acceptance

**Execution:**
- [x] `common/`, `gateway/` -- `assetNames`.
- [x] `web/typescript/search.ts`, `SearchControl.ts`, `adapters.ts`, `controls.ts`, `MapStudio.tsx`, `mapstudio.css`, the Jest tests.
- [x] `e2e/tests/search.spec.mjs`.
- [x] `docs/`, `CHANGELOG.md`, this plan, the screenshots.

**Acceptance Criteria:**
- Given the dev 30-pad set, when part of a name or an asset name is typed, then the matches list ranked as decided, capped at eight, each with the kind glyph, the name and the kind or asset.
- Given a row, when it is clicked, tapped or chosen with the keyboard (arrows and Enter), then the map zooms to the item and selects it as a click does; Esc clears and closes.
- Given a viewer (level none), then the search by asset name works.
- Given 390 px, then the field is the top bar 8 px from the edges, the rows and buttons are 44 px, the zoom card sits under it and the bottom-right corner is clear.
- Given the hand-off's checks, then every one passes.

## Implementation Notes

- **Commits on the worktree branch** (`worktree-agent-a311ea430a62859c7`, baseline `05a0921`): 37ab35a (the search field and control, the pure module, `assetNames` in `map.load.reply`, the Jest tests), 308e889 (the e2e spec, the docs, the changelog, this plan), 518edb5 (what the first live run taught), 2fd5fff (the platform checks section), then the closing commit (evidence, screenshots, the measures, this plan). A container restart stopped the agent during the first final chain; a second agent resumed from `git log`, this plan and the scratch scripts and ran the chain again from the start on a fresh stack.
- **Decision 5 refined (518edb5):** MapLibre's popup takes the focus when it opens (`focusAfterOpen` defaults to true), so after a chosen point the focus is in its popup, not the field; the rule became "the focus goes where the choice leads" (the popup for a point, the field for a line). The same run showed "Pad 14" also lists "Line to Pad 14" (a name that holds the text), which the spec and the docs now say.
- **Build and run on this box:** Gradle's node plugin cannot download Node through the proxy, so the build ran with a scratch init script pointing the plugin at the box's Node 22 (`download=false`) and the module was staged by hand into `ops/modules/` for `ops/up.sh --fresh --no-build`; none of it is committed.
- **Not done, by scope:** the Needs you summary in the slot after the field and the hiding of it while the search is open on a phone (entry 3, through `SearchControl.slot()` and `data-search-open`), the line popup on a chosen line (entry 2), the bottom sheet (entry 8), the surface token review (entry 12).

## Plan Change Log

## Review Triage Log

## Design Notes

**Why the search is a MapLibre control and not React.** The other View-mode controls (`ZoomControl`, `LegendControl`) are `IControl`s in the map's corners, so the top bar follows the same insets, stacking and 44 px rules through the same stylesheet; the rows are a handful of DOM nodes rebuilt per keystroke, which needs no React. The pure part is in `search.ts` so the ranking is unit tested in node.

## Verification

**Commands:**
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` (with the scratch init script that keeps the node plugin from downloading Node) -- expected: BUILD SUCCESSFUL.
- `cd web && npx tsc --noEmit && npx jest` -- expected: no type error, all tests pass.
- `ops/up.sh --fresh --no-build` with the module staged by hand (port 9288 in `.env`), then `cd e2e && npm ci && E2E_DOCS=1 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: every spec passes, `search.spec.mjs` included.
- `bash scripts/ci/check-contract-versions.sh` and `bash scripts/ci/test-contract-versions.sh` -- expected: OK.
- `grep -rnP '\xE2\x80\x94'` on every changed file -- expected: no match.

**Manual checks:**
- `mapstudio-search-1440.png` and `-chosen-1440.png` against `view-mode-1440.png` and `key-screen-1-view-desktop-popup.png`; `mapstudio-search-390.png` and `-chosen-390.png` against `key-screen-2-phone-needs.png` and `key-screen-2-phone-sheet.png`.

**Results (2026-10-28, 4-CPU agent box, Ignition 8.3.10, container `ms-46653f23` on port 9288, fresh volumes; the whole chain in one run after the resume):**
- `./gradlew clean build --offline` (JDK 17, the scratch init script, the box's Node 22): BUILD SUCCESSFUL in 2m 35s with every Java and Jest test (`MapLoaderTest` with the `assetNames` case).
- `cd web && npx tsc --noEmit && npx jest`: no type error; 26 suites, 215 tests pass (`search.test.ts` added, `adapters.test.ts`, `contract.test.ts` and `controls.test.ts` extended).
- Full e2e on the fresh stack with `E2E_DOCS=1`: 78 passed, 0 failed, 7 skipped (22.4 min, one worker beside two other agents' stacks); `search.spec.mjs` 4 of 4 (9.9 s, 7.8 s, 6.5 s, 4.1 s). The skipped seven are the suite's own (the Gateway-stopped and the store-down cases that need the stack runs of `ops/store-checks.sh`). An earlier run of the four search tests alone on the stack of the first agent also passed 4 of 4 (`e2e9-search2.log`, scratch).
- `check-contract-versions.sh`: `OK (contract 0.3.0, setup schema 1, map store schema 2)`; `test-contract-versions.sh`: OK.
- Em dashes: none in any changed file; no model id outside the commit trailers.
- Manual: `mapstudio-search-1440.png` against `view-mode-1440.png`: the field top-left, 300 by 40 px, with the search glyph, the typed "Pad 1", the Clear button, and the results card under it listing Pad 1, Pad 10 to Pad 16 (eight rows, the kind glyph, the name in bold, "Well pad"); the mockup's Needs you beside it and the Edit switch are entries 3 and epic-editing. `mapstudio-search-chosen-1440.png` against `key-screen-1-view-desktop-popup.png`: Point 2 at zoom 15 with its default popup open and the field back to its placeholder. `mapstudio-search-390.png` against `key-screen-2-phone-needs.png`: the one top bar 8 px from the edges, "Point" typed, three 44 px rows inside the bar, the zoom card under the bar; `mapstudio-search-chosen-390.png` against `key-screen-2-phone-sheet.png`: Point 1 at zoom 15 with its popup (the sheet is entry 8) and the field blurred. The screenshots refreshed by the docs run are the ones the docs reference (every view-mode one now shows the field); `docs/spike-measures.json` was rewritten by the bundle measure (`MapStudio.js` 1,278,426 bytes, `MapStudio.css` 85,480) as earlier entries did. The unreferenced screenshots of the run were deleted. `mapstudio-styles-preview-dark-1440.png` was kept at its earlier version: the run's copy came out with the map and the swatch drawings unpainted (the dark theme's canvases had not drawn when the shot was taken, under the load of three stacks; the spec's assertions passed), a render timing to watch, not a search regression (the light copy, taken the same way, is complete and shows the panel 64 px from the top).
- Not verified: a real touch device; a screen reader's reading of the combobox; a name outside Latin script; a map with thousands of items; the owner's eye on the mockup match.
