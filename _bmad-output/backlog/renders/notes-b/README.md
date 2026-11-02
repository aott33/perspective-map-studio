# Renders for the owner's review notes, group b (top bar, legend, phone)

Light theme unless the name says dark. "Before" is the 0.3.0 build the owner tested (the committed docs screenshots at that commit, or a render of that build); "after" is this branch on the dev stack (port 9102). The dev stack has no internet tiles beyond OpenStreetMap's public ones, so the showcase draws on the blank map.

| Item | Before | After |
|---|---|---|
| 1 scale bar bottom-aligned with Legend | before-mapstudio-controls-1440.png (the bar floats 4 px above the button) | item01-03-bottom-edge-1440-after.png, item01-03-bottom-edge-390-after.png |
| 3 attribution small, bottom-right, under the App Bar toggle | same before image (attribution in the row beside the scale bar) | the same two after images (OpenStreetMap on) |
| 2 phone legend as a bottom sheet, Show first, no basemap | before-mapstudio-basemap-390.png | item02-legend-phone-390-after.png |
| 9 hover of the Needs you bar (opaque tint) | item09-hover-bar-1440-before.png (MapLibre's 5 % black wash, the text on the imagery) | item09-hover-bar-1440-after.png |
| 12 wordless bar with the bell | before-mapstudio-needs-you-1440.png, before-mapstudio-needs-you-390.png, before-mapstudio-needs-you-ok-1440.png | item12-bar-1440-after.png, item26-phone-list-390-after.png (phone), item12-quiet-no-number-after.png and item12-quiet-zero-after.png (the choice below) |
| 23 legend stops below the top bar | before-review-dark-needs-you-legend-1440.png (the legend grows over the bar) | item23-legend-1440-after.png, item28-dark-scrollbars-1440-after.png (dark) |
| 24 States first, Kinds collapsed | same before image | item02-legend-phone-390-after.png ("Kinds (9)"), item23-legend-1440-after.png |
| 26 phone list over the zoom card | item26-phone-list-390-before.png | item26-phone-list-390-after.png |
| 28 thin scroll bars, track on the surface (dark) | before-review-dark-needs-you-legend-1440.png | item28-dark-scrollbars-1440-after.png |
| 30 list keeps its own width | before-review-light-needs-you-legend-1440.png | item30-list-1440-after.png |
| 8 search chevron list | no before (new) | docs/screenshots/mapstudio-search-1440.png from the E2E_DOCS run shows the field with its chevron |

## Decision put to the owner (item 12)

With nothing needing attention the bar is a grey bell alone. Two renders: item12-quiet-no-number-after.png (no number) and item12-quiet-zero-after.png ("0"). Recommended: no number (the "0" reads as data and adds clutter; the bell's grey says quiet, and the accessible name says "Needs you: nothing needs attention"). Built as no number.
