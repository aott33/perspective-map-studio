# Owner review notes, group c: renders

Before (the base build, `761c36a`) and after (this branch) renders of the items of group c that change what a person sees, from the group's dev stack (scratch Playwright spec on the e2e fixtures; light theme unless named). "3x" files are taken at a device scale of 3, so the map's marks are seen at their drawn size enlarged.

| Item | Before | After | What to look at |
| --- | --- | --- | --- |
| 4 | `before-4-dev-empty-1440.png` | `after-4-dev-empty-1440.png` | The empty dev map: the line says to seed from `/edit` (Seed the dev map) |
| 5 | `before-5-dev-after-click-1440.png` | `after-5-dev-after-click-1440.png` | The dev `/` page after a click: the spike's click echo is gone from View mode |
| 6 | `before-6-dots-z13-1440.png`, `before-6-dots-z11-1440.png` | `after-6-dots-z13-1440.png`, `after-6-dots-z11-1440.png` | The showcase at zoom 13 (14 px dots, were 11) and 11 (10 px, were 7), each with the halo |
| 7 | `before-7-instruments-{light,dark}-3x.png`, `before-7-badges-{light,dark}-3x.png` | `after-7-instruments-{light,dark}-3x.png`, `after-7-badges-{light,dark}-3x.png` | The tap, meter and valve glyphs on 28 px discs; the acknowledged alarm glyphs (P12, PT-2) outlined with "!" |
| 7 (options) | | `7-glyph-options-3x.png` | The acknowledged badge at 18 px in both themes: before, option B (built, recommended: outlined with a bold "!") and option A (filled with a bigger "!"); the instrument markers before and after |
| 11 | `before-11-lines-z15-1440.png` | `after-11-lines-z15-1440.png` | L-GL21 (4 in, no instrument) now 3 px in the pipeline grey like the other sized lines; the laterals with no size stay thin in the lateral tone |
| 11 (tone option) | | `option-11-tone-by-instruments-z15-1440.png` | The alternative tone rule: weight from the size, but the lateral tone kept for every line without instruments (L-GL21 3 px in the lighter tone) |
| 16 | `before-16-selected-ring-3x.png` | `after-16-selected-ring-3x.png` | Point 1 selected, in alarm, with the Warning ring: the selection ring no longer clipped |
| 22 | `before-22-arrows-z17-1440.png` | `after-22-arrows-z17-1440.png` | L-SWD selected at zoom 17 (its card hidden for the render): the flow arrow repeated along the line about every 250 px, where before one sat by the name chip |
| 25 | `before-25-osm-{light,dark}-1440.png` | `after-25-osm-{light,dark}-1440.png` | OpenStreetMap drawn quiet under the map's marks |
| 29 | `before-29-dark-no-reload-1440.png` | `after-29-dark-no-reload-1440.png` | `/dark` without a reload: the map itself dark |
| 32 | `before-32-lost-{light,dark}-1440.png` | `after-32-lost-{light,dark}-1440.png` | The connection lost: the chip in words, every value stale, Needs you "State unknown" |
| 31 | `before-31-setup-form.png` | `after-31-setup-form.png` | The Designer's setup form: Map token provider and Map token secret as two labelled rows |

Items 10 (the showcase restores SWD1's stale state as it opens) and the stale-jar build fix change nothing a person sees; their tests are in `e2e/tests/showcase.spec.mjs` and the plan file.
