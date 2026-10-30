---
id: 10
type: story
title: "Owner review notes on the 0.3.0 map"
parent: none
covers: []
after: []
refined: false
hitl: true
risk: low
---

# Owner review notes on the 0.3.0 map

## Description

The owner accepted epic-viewing entry 15's showcase renders on 2026-10-29 ("I'll keep it") and will review and test the system next, expecting several items. This file collects them as they come, each with the owner's words and the date, so they can be built together as one story before release 0.3.0 (epic-viewing entry 13) or moved to a later release by the owner.

## Requirements

- Verify: when it is scheduled, every item below is fixed or moved by the owner, shown in the showcase renders (`docs/screenshots/showcase-*.png`) where it is visible.

## Notes

- Item 1 (owner, 2026-10-29): the scale bar beside the Legend button "looks floating"; bottom-align it with the Legend button (`web/typescript/LegendControl.ts`, the bottom-left row; `mapstudio.css`).
- Item 2 (owner, 2026-10-29, with a 390 px screenshot of the open legend): "The legend for the phone and the phone layout needs rework. Why is the basemap selected here, isn't that a project setting?" At 390 px the open legend panel covers most of the map. Open: whether the viewer chooses the basemap at all (entry 14 put the choice in the legend because viewers never reach Edit mode's Layers rail) or the project setup's basemap is the only one shown.
- Item 3 (owner, 2026-10-29): "Make the attribution more discrete and put it along the bottom right of the map pretty much underneath the ignition black info button." Small text along the bottom-right edge, under Perspective's App Bar toggle, never covering the toggle.
- Decision (owner, 2026-10-29, "Those suggestions are good"): (a) the basemap is a project setting by default: the setup gains a default basemap and viewers get no switch unless the setup lists more than one; (b) on a phone the legend opens as a bottom sheet like the popups, shorter and scrollable, the key tighter (two columns, smaller rows, the Lines and Names toggles first), with no basemap section; (c) the attribution is small muted text along the bottom-right edge under the App Bar toggle, never covering it.
- Item 4 (owner, 2026-10-30, a fresh local stack): an empty dev map gives no hint how to fill it; the dev pages' line says "Click a point for its popup" when there are no points. The dev View page should say to seed from `/edit` ("Seed the dev map") when the map has no items.
- Item 5 (owner, 2026-10-30): the info bar under the dev map (the spike's click echo and save line) "Would that be better as a dock? Maybe a right dock that would show history? With a nicely formatted easy to read format? Like a list with dropdowns to show more details on that specific change?" For 0.3.0: the info bar is dev-page test output and leaves View mode (entry 15's backlog row "retiring the spike's click echo"). For epic-editing: input to Recent changes (initiative R45, EXPERIENCE.md "Recent changes", opened from the save status): the owner prefers a right-hand dock listing changes in an easy-to-read format, each row expanding to show that change's details (who, what, when, the values before and after, Revert); settled when epic-editing is refined.
- Playbook (owner, 2026-10-30): section 0 passed (stack up, seeded, private window, trial time); section 1: the showcase opens at zoom 15 (by design: its `startingArea` is zoom 15, the mockups' framing).
- Playbook (owner, 2026-10-30): section 13 done early: Satellite works with the owner's Mapbox token. Asked for more Mapbox styles: moved to its own backlog story, `_bmad-output/backlog/story-more-mapbox-basemap-styles.md`.
- Item 6 (owner, 2026-10-30): "the dots are a bit small"; decision (owner, option 1): keep the switch at zoom 14 and make the dots bigger, 14 px from zoom 12 to 14 and 10 px below 12, with a thin halo in the blank-map token so they read on any basemap (`web/typescript/markers.ts` `DOT_MID`, `DOT_SMALL`; the 44 px hit area unchanged; DESIGN.md's map-marker updated with it).
- Item 7 (owner, 2026-10-30): the instrument icon (the tap's pressure-gauge-on-a-stem glyph, and the meter and line valve beside it) "doesn't show up nicely" on the map: redraw for legibility at its drawn size (bolder strokes, a simpler silhouette, a larger disc), checked against the mockups' instrument markers; an ER-27 item with the other glyphs.
- Playbook section 2 (owner, 2026-10-30): search works nicely and zooms to the chosen item at zoom 15.
- Item 8 (owner, 2026-10-30): "the search should be a dropdown also so you can see all the possible items without having to start typing. Like a filterable dropdown." Proposal: on focus or a click on the field (or a chevron in it) the results list opens with every map item, grouped by kind with counts, sorted by name, items needing attention first in each group; typing filters the same list; keyboard as today; the list scrolls inside its card (and on a phone inside the expanded top bar), rendered in pages so a 300-site field stays fast.
