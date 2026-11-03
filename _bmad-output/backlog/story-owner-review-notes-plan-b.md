# Plan: owner review notes, group b (top bar, legend, phone)

Story 10 (`story-owner-review-notes-on-the-0-3-0-map.md`), items 1, 2, 3, 8, 9, 12, 23, 24, 26, 28, 30. Worktree
`/home/user/wt-notes-b`, branch `ccr-e1048b93-r2p8l4-notes-b`, Gateway port 9102. No ticket entry; the contract stays 0.3.0
(unreleased), so the CHANGELOG's 0.3.0 section gains the lines and nothing is bumped. Renders (before and after) go to
`_bmad-output/backlog/renders/notes-b/` with a README listing each pair and its item.

## What is built, per item

| Item | Build | Files | Test |
|---|---|---|---|
| 1 | The scale bar sits on the Legend button's bottom edge (no 4 px lift) | `mapstudio.css` | e2e `basemaps.spec.mjs`: scale bottom equals button bottom, 1440 and 390 |
| 2, 3 (decision a) | The setup's first listed basemap is the default (no new setup field: the Designer's list keeps its order, so the first line is the default); the Basemap section and the switch exist only when the setup lists more than one | `LegendControl.ts`, `basemaps.ts` (`offersSwitch`) | jest `basemaps.test.ts`; e2e `basemaps.spec.mjs` (dev lists three: switch; one-basemap case by the setup editor is not driven, so the control is unit-tested through `offersSwitch`) |
| 2, 3 (decision b) | Phone: the legend opens as a bottom sheet like the popups (handle, header with Close, 44 px), shorter and scrolling, Show (Lines, Names) first, the key in two columns with smaller rows, no basemap section | `LegendControl.ts`, `mapstudio.css` | e2e at 390: sheet position, Show first, two columns, no Basemap heading |
| 2, 3 (decision c) | Attribution leaves the legend row: MapLibre's attribution control in the bottom-right corner, small muted text along the bottom edge under the App Bar toggle, never covering it | `MapStudio.tsx` (one `addControl`), `LegendControl.ts`, `mapstudio.css` | e2e: attribution inside the map, below the toggle's reserved area, no overlap with the toggle; 1440 and 390 |
| 8 | A chevron in the search field opens the list of every map item, alphabetical (no groups), typing filters it, ArrowDown opens it too; the list scrolls inside its card and is drawn in pages of 50 as it scrolls | `search.ts` (`allEntries`, paging), `SearchControl.ts`, `mapstudio.css` | jest `search.test.ts`; e2e `search.spec.mjs` |
| 9 | `--mapstudio-hover`: `var(--neutral-30, color-mix(...))` on the surface token; every `var(--neutral-30)` hover uses it; the colon span is gone with the words (item 12) | `mapstudio.css` | e2e computed hover background is opaque on the Needs you bar and its rows (before the fix: transparent when the token does not resolve, simulated by unsetting `--neutral-30` on the root) |
| 12 | The bar has no words at any width: a bell with the alarm count (hue of the highest unacknowledged priority; neutral and hollow when all are acknowledged), comms lost and stale glyphs with their counts, a grey bell alone when nothing needs you (no number: recommended; "0" rendered for the owner). New sprite glyphs `bell` (solid) and `bell-outline`. Placeholder "Search assets", accessible name keeps the long form. `setUnknown()` is the place for group c's lost-Gateway look. | `NeedsYouControl.ts`, `needsyou.ts`, `search.ts`, `web/icons/src/bell*.svg`, `sources.json`, `icons.json`, `mapstudio.css` | jest `needsyou.test.ts` (highest unacknowledged priority, labels); e2e `needsyou.spec.mjs`, `search.spec.mjs`, `icons.spec.mjs`, Java `IconCatalogueTest` (30 icons) |
| 23 | The legend panel stops below the top bar at every width (the map less the top bar and the bottom row), its key scrolling inside | `mapstudio.css`, `MapStudio.tsx` (publishes the map width too) | e2e: panel top is below the bar's bottom, on a tall key (kinds), 1440 and 390 |
| 24 | States first; Kinds collapsed ("Kinds (9)", a button) when more than six kinds are on the map, open otherwise | `legend.ts` (`KINDS_COLLAPSE_OVER`), `LegendControl.ts` | jest `legend.test.ts`; e2e needsyou/showcase legend headings |
| 26 | Phone: an open top-bar list (search or Needs you) draws over the zoom card, which is hidden while it is open | `mapstudio.css` | e2e at 390 |
| 28 | Thin themed scroll bars on every Map Studio scrolling panel (`scrollbar-width`, `scrollbar-color`, the WebKit pseudo-elements), track transparent so it sits on the panel's surface | `mapstudio.css` | e2e: computed `scrollbar-width` thin on the legend panel, the Needs you list, the popup body |
| 30 | The Needs you list keeps its own width (360 px on a desktop), its left edge under the bar's, never wider than the map less the zoom card | `mapstudio.css` | e2e: list width 360 at 1440, left edge equals the bar's |

Group a and c edit the same big files: edits here stay inside the controls' own code and the CSS blocks named above.

## Status

Status: built. Items 1, 2, 3, 8, 9, 12, 23, 24, 26, 28, 30 are built as the table says (see each item's "Built:" line in the notes file). Deviations from the table: item 9's cause was MapLibre's own button hover outranking the bar's rule (neutral-30 is opaque in the bundled themes), fixed by specificity plus the `--mapstudio-hover` token; the Designer's list order is the default (no new setup field); the bar's logic is `barModel` in `needsyou.ts` (unit tested) rather than e2e-only.

Group c's hook for item 32: `needsYouControl.setUnknown(true)` (and `false` on reconnect) in `MapStudio.tsx`; the summary is kept and shows again at once. The "state unknown" look is `data-state="unknown"`: a hollow grey bell with "?" and no counts, label `BAR_UNKNOWN` in `needsyou.ts`.
