---
type: epic
title: "Everyone reads live state from the map"
parent: initiative-flowmap
covers: ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R36", "R37", "R39", "R40", "R41"]
sources: []
companions: []
after: []
refined: false
risk: high
---

# Everyone reads live state from the map

## Description

The map everyone opens: the one project map on a basemap, opened on a starting area, icons with comms, the icon KPI and alarms from the Alarm Metrics folder, lines with state, labels that thin out, search, and popups (a default popup with an alarm summary, or a project's custom popup view) with links, matching what the template's current map shows.

## Outcome

A viewer sees each site's state and reaches its page from an alarm in two clicks, and a normal field shows no hue (prd SM-5, SM-C2).

## Done when

- Two components with different starting areas show the same map items.
- Icons and lines show comms, the icon KPI and alarm state from Ignition's alarms, refreshed in one batch per page on the project's interval.
- Every item in the template's `docs/map.md` section 5 is met or listed for engineering review.
- Search, the default popup with its alarm summary, a custom popup view and popup links work on desktop and at 390 px.
- Pan and zoom run at 60 frames per second on the 30-pad scale set.
- Verified on the template's test stack with the field simulator's live tags.

## Boundaries

- Hands on: the map view and popup that epics 4 to 7 build on.
- Kind setups are read here, written in epic-editing; for this epic they can be seeded in the map store.
- Not here: any editing.

## References

- parent - _bmad-output/initiative-flowmap/initiative-flowmap.md, section Requirements
- prd - _bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md
- prd - section 4.1, 4.2, 4.10, NFR-1, NFR-9
- research - _bmad-output/initiative-flowmap/brief-flowmap/addendum.md, map UI practices

## Notes

- Decision: 2026-10-26 Names, licence (Apache-2.0) and the Alarm Metrics answer are recorded in the initiative's Notes and apply here.
- Waits on epic-map-store-and-data because: map items, kinds and kind setups readable from the map store.
- Decision: 2026-10-26 The owner approved value-driven styles and area category tints (initiative R40; prd FR-38, FR-39; architecture AD-11, AD-16); they are drawn here, R40 is in this epic's covers, and a stale value shows only as stale with no value style. Entry 1 in tickets/tickets.toml holds that work ahead of this epic's refinement and cites initiative R40 until the epic has its own Requirements; refining the epic re-slices it with the rest, id kept.
- Open question: Where a style rule's expression is evaluated and in which expression language (unverified); settled when this epic is refined.
- Decision: 2026-10-27 The owner approved instruments on lines (initiative R41; prd FR-40; architecture AD-7, AD-11, AD-16, AD-19). This epic draws them: instruments at their place on each line, the line split into line segments, the line popup listing its instruments in order with their live values plus the line's KPIs and alarms, a click on a line opening it at that segment with the instruments at its ends highlighted, an instrument's alarm at its place on the line, and the "worst of its instruments" style source. R41 is in this epic's covers; entry 2 in tickets/tickets.toml holds the work ahead of refinement, waiting on epic-map-store-and-data entry 14 (the stored attachment) and on entry 1 (the style rule drawing).
- Open question: Does each line segment draw its own look from the instruments at its ends (as the template's map does) or the whole line from all its instruments? Proposed: per segment (initiative Notes, 2026-10-27).
