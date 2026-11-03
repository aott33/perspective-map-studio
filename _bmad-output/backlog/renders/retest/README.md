# Re-test of 0.3.0: before and after renders (R2, R3, R4 (a), R6, R7)

The owner's re-test findings (`../../story-owner-review-notes-on-the-0-3-0-map.md`, "Re-test findings"; the notes in `docs/test-retest-0.3.0.md`), rendered on the showcase project (`mapstudio-showcase`, seeded by the dev `/edit` page) on a dev stack with Ignition 8.3.10, light theme, basemap None. `-before` is the branch before the fixes (commit 670193a), `-after` the build with them. The checks that hold each fix are `e2e/tests/retest.spec.mjs` (every one failed on the before build) and, for R1 and R4 (a), `web/typescript/__tests__/needsyou.test.ts` and `place.test.ts`.

| Finding | Files | What to look at |
|---|---|---|
| R2 | `r2-card-under-top-bar-1440-*.png`, `r2-card-under-zoom-card-1440-*.png` | P14's card opened, then the map panned so the card reaches over the top bar or the zoom card. Before, the card covers the search field and the zoom card; after, the controls stay on top and the card slides under them. |
| R3 | `r3-legend-1440-*.png` | The Legend panel at 1440 px. Before 208 px wide, "Priority 1 alarm, digit beside" and "Acknowledged: outlined, with "!"" wrap; after, the search field's 300 px and the rows on one line. |
| R4 (a) | `r4-place-left-1366-*.png`, `r4-place-after-back-1366-*.png` | P14's card open at zoom 16 (left), then View alarms and the browser's back. Before, the map is back on the page's starting area at zoom 15 with nothing selected; after, at zoom 16 where it was with P14's card open. |
| R6 | `r6-search-open-1440-*.png`, `r6-needs-open-1440-*.png`, `r6-needs-open-390-*.png` | An open top-bar list. Before, the list is a separate card 6 px below the field or bar (desktop) and the bar's open grey keeps a rounded bottom-right corner over the list (phone); after, the field or bar has square bottom corners and the list joins it. |
| R7 | `r7-popup-view-1366-*.png`, `r7-popup-view-sheet-390-*.png` | SWD1's custom popup view `Popups/SiteCard` under Map Studio's close row. Before, the view is pinned to its 120 px default height while its content is 128 px, so it scrolls inside itself (the thin overlay scroll bar shows on hover or scroll in Chromium, which a still does not catch; the e2e check measures it); after, the view is its content's height below the row and nothing scrolls. |

R1 (closing a popup makes the Needs you icons flash) has no render: the flash is the bar's glyphs drawn again and loading their sprite symbol for a frame, which a still image cannot show. The check is `retest.spec.mjs` R1: the bar's DOM nodes are the same objects after a popup opened and closed (before, they were replaced each time).

Made by a scratch Playwright spec (not committed) with the same steps as `retest.spec.mjs`, run with the before module and then the after module on the same stack.
