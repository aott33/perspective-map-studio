---
title: 'Needs you summary and legend in View mode'
type: 'feature'
ticket: '3'
created: '2026-10-28'
status: 'planned'
baseline_revision: '0b96ff3f2854d44a50f9c3ee3b57852909870d9b'
route: 'full'
route_source: 'pinned'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/handoff-epic-3.md'
  - '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md'
  - '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md'
  - '{project-root}/docs/contract.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A viewer of a 30-pad field has no summary of what needs attention: the only way to find the item in alarm, the one whose comms are lost or the stale one is to pan the map and read the markers; and the legend panel entry 14 built names no glyph or line look, so the map's own words (the alarm glyphs by priority and acknowledgement, the comms-lost ring, the dashed line) are known only to whoever read DESIGN.md (R14, R15; prd FR-41, FR-42; EXPERIENCE.md Needs you bar, Legend, Phone top bar; DESIGN.md needs-you-bar, legend).

**Approach:** A Needs you bar beside the search field top-left, fed by the same `values.batch` the markers draw from (AD-6: no message and no subscription of its own), counting the map items in alarm, comms lost and stale, each count with its glyph and word ("Needs you 3: 1 alarm, 1 comms lost, 1 stale"), "All OK" in neutral with nothing to attend to; a click or the keyboard opens a ranked list (alarms by priority, then comms lost, then stale) whose rows zoom to and select the item as the search does. The Legend panel gains the glyph key in the map's words (the kinds on the map, the alarm glyphs, comms lost, stale, the line looks, the value styles and area tints a kind setup turns on) and the Lines and Names toggles, remembered per session. At 390 px Needs you shares entry 9's top bar with search and expands inside it. Dev data is driven so the e2e suite sees the verify line: one alarm, one comms lost, one stale, then all cleared to All OK.

## Decisions (recorded for the owner, 2026-10-28; the session is unattended)

1. **One pure module per feature.** `needsyou.ts` builds the counts and the ranked rows from the items, the kinds and the live state (the same `itemState` the markers use), and `legend.ts` builds the key from the items, the kinds and the kind display; both unit tested in node. An item counts once, in its worst state (alarm over comms lost over stale, as the badge does); a shared marker's members count one each. Alarms rank by priority, unacknowledged before acknowledged within a priority, then by name; comms lost and stale by name. The words are the map's: "Priority 1 alarm, unacknowledged" with "1 alarm - 4 min ago" (the count and the alarms slot's age), "Comms lost" with "Last heard 14 min ago" (or the reason when there was never a value), "Stale value" with the first stale key value's label and age (else the alarms or the style slot's reason).
2. **The bar and its list are DOM in the top bar**, not React and not a MapLibre control of their own: `NeedsYouControl` mounts the bar into `SearchControl.slot()` (the row after the field, as entry 9 left it) and its list into the top bar's container under the row, so on a desktop the list is a card under the bar (320 px wide, `rounded.lg`, the floating shadow) and at phone width it expands inside the one top bar as the search results do. The bar is a button (`aria-expanded`, `aria-controls`), the list a `role="region"` named "Needs you" with a `role="list"` of row buttons (rank, state glyph, name and kind, the state in words, detail and age). Opening moves the focus to the first row; ArrowDown and ArrowUp move between rows and wrap; Enter or a click chooses; Esc closes and returns the focus to the bar; a click on the map closes it; the bar toggles it. The list's DOM exists only while it is open. `data-needs-open` on `.mapstudio-map`. On a phone, the search results and the Needs you list never show together: the bar is hidden while the search is open (`data-search-open`), and opening the list closes the search list.
3. **A chosen row goes where a search choice goes:** `MapStudio.goToItem` (the search handler's body, now shared) shows a point at zoom 15 at least with its popup open and `point.click` sent, fits and selects a line or an area; a kept Fit ends. The list closes first and the live region of the search says "<name> selected".
4. **All OK is neutral and stays.** With nothing to attend to the bar reads "All OK" in `text-secondary` (`--label--disabled`), no glyph, `data-state="ok"`, still a button that opens the list, which then says "Nothing needs you".
5. **The legend's key, in sections before Basemap** (entry 14's panel takes sections): **Kinds** (every kind that has a live item on the map, in the kind list's order: the glyph and the name; a line kind a line sample, an area kind a dashed box); **States** (Priority 1 alarm with the digit beside, Priority 2 alarm, Priority 3 alarm, Acknowledged, Comms lost, Stale value), the badges drawn as the marker draws them (the solid disc in the priority's token with the glyph in the panel colour, the hollow one for acknowledged) through the sprite's symbols in `currentColor`; **Lines** (weight by pipe size, thin with no instruments, dashed for no data or comms lost, the hue of the highest alarm); **Styles** only when a kind setup has a style rule (Attention, Warning, Fault, Out of service as the map draws them); **Areas** only when a kind setup has area tints (each category with its tint swatch, and "No category" neutral); **Show** with the Lines and Names checkboxes and the note "Below zoom 14 sites show as dots"; then Basemap. Every colour a token through a class (`--mapstudio-alarm-1` to `-3`, `--mapstudio-comms-lost`, `--mapstudio-attention`, `-warning`, `-fault`, `--mapstudio-tint-1` to `-6`, the neutral line token), no literal. The panel scrolls when taller than the map allows.
6. **Lines and Names.** Lines off sets `visibility: none` on every line layer (the casing, the dashed, dotted and solid lines, the line name chips and midpoint badges) and on the flow arrow; areas stay. Names off hides the item names, the state chips, the icon KPI text and the line name chips, and keeps the markers (so an abnormal item's badge and digit stay) and the line badges. Each is remembered per browser session (`sessionStorage`, keys `mapstudio.legend.lines.v1` and `mapstudio.legend.names.v1`; a browser that refuses storage keeps them for the page). `data-lines` and `data-names` (`on` or `off`) on `.mapstudio-map`. The panel's first focusable control (the Lines checkbox) takes the focus on open; `basemaps.spec.mjs` is updated from "the first basemap button".
7. **Dev data for the verify line** (`ops/`, dev only, MapEditor only): the `/live` page gains "P14 pressure bad" and "P14 pressure good", which write P14's Pressure as a `BasicQualifiedValue` at `Bad` quality (and back to Good at 400) through `mapstudio_live.set_quality`, so Point 2 draws stale (its icon KPI stale, comms fine). Point 1 takes the alarm (P12 pressure 950) and Point 3 is comms lost as the seed leaves it (P15 has no Comms tag, the not-found case of entry 5). For All OK the e2e spec unlinks Point 3 (an `edits.apply` update with `assetId` null through the test hook, which rebuilds the live plan and sends a full batch) and links it to P15 again when it is done, since the seed leaves an `assetId` alone.
8. **No subagents.** The session has no subagent tool: this agent implements from the plan and runs the quick review lens itself over the diff.

## Boundaries & Constraints

**Always:** every colour a theme token (AD-11); the counts and the rows from the live state the markers already hold (no new message, no extra subscription: AD-6); every state said with a glyph or a word, never colour alone; "All OK" neutral and visible; both panels operable by keyboard (Tab, Enter or Space, arrows, Esc) with the focus returned; 44 px targets below 768 px; nothing in the bottom-right corner; contract 0.3.0 (`check-contract-versions.sh` green); no em dashes; `README.md` untouched; the existing e2e attributes kept; the ER-27 items (the Needs you counts, the glyph key) left to entry 12's review.

**Never:** the point popup or the phone bottom sheet (entry 8), the line popup (entry 2), the hue tokens' review (entry 12), the Edit switch or the rail (epic-editing), a change to the basemap messages, a change to `ign-scada-template`, a `.modl` or scratch project committed, a Gateway write outside the local dev stack, a new alarm on the dev Gateway.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Nothing to attend to | every item normal (or no values yet) | "All OK" in neutral, `data-state="ok"`, `data-count="0"`; the list says "Nothing needs you" | none |
| Three states | Point 1 alarm p1 unacked, Point 3 comms lost, Point 2 stale KPI | "Needs you 3: 1 alarm, 1 comms lost, 1 stale"; rows 1 Point 1, 2 Point 3, 3 Point 2 | none |
| Worst state wins | an item in alarm and comms lost | counted once as an alarm; the row says the alarm, its detail "Comms lost" added | none |
| Priorities | p2 unacked, p1 acked, p1 unacked | p1 unacked, p1 acked, p2 unacked; "2 alarms" when one item holds both p1 and p2 is counted once | none |
| Row chosen | a click, or Enter on a row | the list closes, the map zooms to and selects the item (a point with its popup), the live region says "<name> selected" | an item gone since: one console line, nothing moves |
| Keyboard | Enter on the bar; Esc in the list | the list opens with the first row focused; Esc closes it and the bar has the focus | none |
| Phone, search open | 390 px, text in the field | the bar hidden, the results in the bar | none |
| Phone, list open | 390 px, the bar tapped | the list inside the top bar, rows 44 px at least, the zoom card under it | none |
| Legend key | the seeded map | Kinds: Well pad, Gathering line, Geofence; States 6 rows; Lines 4 rows; Styles (the pad's States rule); Areas (the geofence's two categories); Show: Lines, Names checked; Basemap | none |
| Lines off | the checkbox cleared | every line layer and the arrow hidden, `data-lines="off"`; areas and markers drawn | none |
| Names off | the checkbox cleared | names, state chips, KPI text and line chips hidden; markers with badge and digit drawn; `data-names="off"` | none |
| Remembered | Lines off, the page reloaded in the tab | still off; a new tab starts with both on | storage refused: on for the page |
| Age | the slot's `t` | "12 s ago", "4 min ago" as the popup says it; '' with no time | none |

</frozen-after-approval>

## Code Map

- `web/typescript/needsyou.ts` (new, pure) -- `NeedsYouRow`, `NeedsYouSummary`, `needsYou(items, kinds, live, now)`, `summaryText`, `countsText`, `NOTHING_NEEDS_YOU`; `__tests__/needsyou.test.ts`.
- `web/typescript/legend.ts` (new, pure) -- `LegendKey`, `legendKey(items, kinds, display)`, the fixed rows, the storage keys and `readToggle`/`writeToggle`; `__tests__/legend.test.ts`.
- `web/typescript/NeedsYouControl.ts` (new) -- the bar, the list, the keyboard rules, `setSummary`, `open`, `close`, `isOpen`.
- `web/typescript/LegendControl.ts` -- the key sections and the Show section before Basemap, `setKey`, `setToggles`, `onToggle`; the first focusable control takes the focus.
- `web/typescript/SearchControl.ts` -- `panelHost()` (the container the list goes into).
- `web/typescript/controls.ts` -- the `chevron` glyph.
- `web/typescript/MapStudio.tsx` -- the Needs you control in the slot, `goToItem` shared with the search, the summary and the key on each draw, the layer toggles (`applyLayerToggles`, `data-lines`, `data-names`), the list closed on a map click.
- `web/typescript/mapstudio.css` -- the bar, the list, the legend key rows, the toggles, the phone rules.
- `ops/project/ignition/script-python/mapstudio_live/code.py` -- `set_quality`; `ops/project/.../views/MapStudioLive/view.json` -- the two P14 quality buttons.
- `e2e/tests/needsyou.spec.mjs` (new) -- 1440: the three states, the bar's words, the list's order and words, a row chosen, the keyboard; 390: the shared top bar; 1440: cleared to All OK, the legend's key, the toggles and their memory. `basemaps.spec.mjs` -- the first focusable control, the Basemap heading not first.
- `docs/contract.md` ("What the map draws": Needs you and the legend), `docs/map-parity.md` (rows 2, 6, 7, 11), `docs/development.md` (the live page's buttons), `CHANGELOG.md`, `docs/platform-checks.md` ("Epic 3 entry 3"), `docs/screenshots/mapstudio-needs-you-{1440,390}.png`, `mapstudio-needs-you-ok-1440.png`, `mapstudio-legend-1440.png`, this plan.

## Tasks & Acceptance

**Execution:**
- [ ] `web/typescript/needsyou.ts`, `legend.ts`, the Jest tests.
- [ ] `NeedsYouControl.ts`, `LegendControl.ts`, `SearchControl.ts`, `controls.ts`, `MapStudio.tsx`, `mapstudio.css`.
- [ ] `ops/` -- the quality buttons and `set_quality`.
- [ ] `e2e/tests/needsyou.spec.mjs`, `basemaps.spec.mjs`.
- [ ] `docs/`, `CHANGELOG.md`, this plan, the screenshots.

**Acceptance Criteria:**
- Given the dev stack with one alarm, one comms-lost and one stale item, when a batch arrives, then the bar reads "Needs you 3: 1 alarm, 1 comms lost, 1 stale" within one refresh interval, the list ranks them in that order with the state in words, detail and age, and a row zooms to and selects its item.
- Given all three cleared, then the bar reads "All OK" in neutral and stays.
- Given the Legend panel, when it opens by click or keyboard, then it names every glyph and line look the map draws and its Lines and Names toggles hide what they say, remembered for the session; Esc closes it with the focus returned.
- Given 390 px, then the top bar holds search and Needs you, the list expands inside it and the bottom-right corner is clear.
- Given the hand-off's checks, then every one passes (build, tsc, jest, e2e on a fresh stack, the contract version checks).

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

## Verification

**Commands:**
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` (with the scratch init script that keeps the node plugin from downloading Node) -- expected: BUILD SUCCESSFUL.
- `cd web && npx tsc --noEmit && npx jest` -- expected: no type error, all tests pass.
- `ops/up.sh --fresh --no-build` with the module staged by hand (port 9288 in `.env`), then `cd e2e && npm ci && E2E_DOCS=1 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: every spec passes, `needsyou.spec.mjs` included.
- `bash scripts/ci/check-contract-versions.sh` and `bash scripts/ci/test-contract-versions.sh` -- expected: OK.
- `grep -rnP '\xE2\x80\x94'` on every changed file -- expected: no match.

**Manual checks:**
- `mapstudio-needs-you-1440.png` against `key-screen-1-view-desktop-needs.png` and `view-mode-needs-you-1440.png`; `mapstudio-legend-1440.png` against `view-mode-needs-you-1440.png` (the open legend); `mapstudio-needs-you-390.png` against `key-screen-2-phone-needs.png`.
