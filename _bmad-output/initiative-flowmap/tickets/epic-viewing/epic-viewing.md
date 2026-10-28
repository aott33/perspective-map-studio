---
type: epic
title: "Everyone reads live state from the map"
parent: initiative-flowmap
covers: ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R36", "R37", "R39", "R40", "R41", "R42", "R43"]
sources: []
companions: [_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md, _bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md]
after: []
refined: false
risk: high
---

# Everyone reads live state from the map

## Description

The map everyone opens: the one project map on a basemap, opened on a starting area, icons with comms, the icon KPI and alarms from the Alarm Metrics folder, lines with state, labels that thin out, search, popups (a default popup with an alarm summary, or a project's custom popup view) with links, a legend and a Needs you summary, matching what the template's current map shows.

## Outcome

A viewer sees each site's state and reaches its page from an alarm in two clicks, and a normal field shows no hue (prd SM-5, SM-C2).

## Done when

- Two components with different starting areas show the same map items.
- Icons and lines show comms, the icon KPI and alarm state from Ignition's alarms, refreshed in one batch per page on the project's interval.
- Every item in the template's `docs/map.md` section 5 is met or listed for engineering review.
- Search, the Needs you summary, the legend, the default popup with its alarm summary, a custom popup view and popup links work on desktop and at 390 px.
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
- design - _bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md, the visual identity (adopted companion)
- experience - _bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md, the behaviour (adopted companion)

## Notes

- Decision: 2026-10-26 Names, licence (Apache-2.0) and the Alarm Metrics answer are recorded in the initiative's Notes and apply here.
- Waits on epic-map-store-and-data because: map items, kinds and kind setups readable from the map store.
- Decision: 2026-10-26 The owner approved value-driven styles and area category tints (initiative R40; prd FR-38, FR-39; architecture AD-11, AD-16); they are drawn here, R40 is in this epic's covers, and a stale value shows only as stale with no value style. Entry 1 in tickets/tickets.toml holds that work ahead of this epic's refinement and cites initiative R40 until the epic has its own Requirements; refining the epic re-slices it with the rest, id kept.
- Open question: Where a style rule's expression is evaluated and in which expression language (unverified); settled when this epic is refined.
- Decision: 2026-10-27 The owner approved instruments on lines (initiative R41; prd FR-40; architecture AD-7, AD-11, AD-16, AD-19). This epic draws them: instruments at their place on each line, the line split into line segments, the line popup listing its instruments in order with their live values plus the line's KPIs and alarms, a click on a line opening it at that segment with the instruments at its ends highlighted, an instrument's alarm at its place on the line, and the instruments style source, each segment drawing the worst of the instruments at the segment's ends. R41 is in this epic's covers; entry 2 in tickets/tickets.toml holds the work ahead of refinement, waiting on epic-map-store-and-data entry 14 (the stored attachment) and on entry 1 (the style rule drawing).
- Decision: 2026-10-27 Owner: each line segment draws from the instruments at its two ends, as the template's map does, not the whole line from all its instruments (entry 2).
- Decision: 2026-10-27 UX workshop (ux-map-studio, 2026-10-27): DESIGN.md and EXPERIENCE.md are this epic's companions; View mode follows EXPERIENCE.md (Information Architecture, Component Patterns, State Patterns, UJ-5). This epic gains R42 (legend, collapsed to a button) and R43 (Needs you summary, ranked list, All OK in neutral, one expanding top bar with search at 390 px); entry 3 in tickets/tickets.toml holds them ahead of refinement. R6 now fixes the default popup's order (header with the page link icon, comms with data age, 2 to 3 KPIs, alarms) and R8 makes the page link a header icon. R36: the first version offers None, OpenStreetMap and Satellite; the Mapbox vector style option is deferred, not dropped. Phone popups are bottom sheets, an engineering review item (ER-27) against the template's top sheets.
- Decision: 2026-10-27 Owner: a custom popup view is `popupView {path, params}` (initiative R8, R39; prd FR-6, FR-37; architecture AD-7): this epic renders it, passing `mapItem` and each param filled from the clicked map item, and fills the popup link's placeholders from the same closed list; epic-map-store-and-data entry 9 stores and validates them.
- Decision: 2026-10-27 Owner: a kind setup's tag paths come in two forms, asset-relative `{asset.path}/...`, resolved from each map item's own base path, and full tag paths, the same tag for every map item of the kind; an override's tag paths are full paths (initiative R15; architecture AD-16). This epic resolves both when it subscribes live values.
- Decision: 2026-10-28 Owner (ER-27 reviewer for 0.2.0): comms lost gets a colour on the map, because it is critical and must not get lost, replacing "comms lost and stale have no colour at all" (EXPERIENCE.md) and departing from the template's reviewed rule (template docs/ux.md: comms lost "never a colour"). Still to settle in this epic's refinement: the colour (its own theme token, distinct from every alarm hue so it is never read as an alarm, keeping the `comms-lost` badge and the words, since colour is never the only signal), whether stale follows, and whether the template's cards change to match so an operator sees one convention. It is an alarm presentation change: it goes to engineering review (ER-27) again with this epic's hue tokens before its release.
