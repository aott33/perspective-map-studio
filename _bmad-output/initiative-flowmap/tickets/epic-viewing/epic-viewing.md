---
type: epic
title: "Everyone reads live state from the map"
parent: initiative-flowmap
covers: ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R36", "R37", "R39"]
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
