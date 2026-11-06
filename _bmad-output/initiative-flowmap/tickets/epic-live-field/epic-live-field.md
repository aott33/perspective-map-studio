---
type: epic
title: "Operators follow the live field on the map"
parent: initiative-flowmap
covers: ["R53", "R54", "R55", "R56", "R57", "R58", "R59"]
sources: []
companions: [_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md, _bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md]
after: []
refined: false
risk: medium
---

# Operators follow the live field on the map

## Description

What moves, and where things are along a line. Transient items (trucks, crews, a pig, a leak estimate, a geofence alert) come from a page's `dynamicItems` prop or from a Gateway script's `system.mapstudio.setDynamicItems`, draw above the map items with a kind's glyph in a preset, count in Needs you when they carry a state, open a popup of their own properties, and are never saved, exported or edited. Lines gain linear referencing: a station origin and unit per line kind or per line (metres, kilometres, miles or feet stations such as `10+34.05`), stations beside every distance the map already keeps (`distanceM` of instruments, AD-19), Go to station in search and in the scripting API, dynamic items placed on a line by distance or station, and a distance profile strip in the line popup. Added by the gap review of 2026-11-03 (items 4 and 5): everything in Map Studio 0.3.0 is a stored, edited map item, and the map stores a distance per instrument but never shows a station.

## Outcome

A control room sees where a crew, a truck or a pig is on the same map that shows the sites' state, and a pipeline operator reads a leak alarm by its station and goes there (gap review 2026-11-03, items 4 and 5; prd SM-5's two-click path holds for a dynamic item too).

## Done when

- A page prop and a Gateway script each place dynamic items on the dev map; a changed value moves them within 100 ms and a refresh interval respectively; nothing of them reaches the map store, the edit record or an export.
- A dynamic item with a state counts in Needs you and a row zooms to it; one without a state counts nowhere; the map at the 30-pad scale with 50 moving items keeps 60 frames per second (R37).
- A line with a station origin and unit shows stations in its popup and on its instruments; `L-SWD 10+34` in search lands on the line at that station; `stationToPoint` and `pointToStation` agree with the map.
- A dynamic item placed by `{lineId, distanceM}` sits on the line, stays on it when the line is reshaped, and is listed in the line popup in order with the instruments.
- The distance profile strip draws every instrument and line-placed item with its state and moves the map on a click.
- The dynamic item's look and the strip's state marks pass the engineering review (ER-27).
- Verified on the template's test stack.

## Boundaries

- Hands on: nothing; epic-phone and epic-template-cutover do not wait on this epic.
- Dynamic items never become map items: there is no "save as map item", no edit, no link; a project that wants one stored draws it or imports it (epic-editing, epic-import-export).
- Not here: the component's selection and viewport props and events (R48, R49, epic-editing), which a dynamic item's click reuses; weather and lightning overlays (backlog story 16), spatial queries from script (story 19) and the upstream or downstream trace (story 21), which build on the shared geometry module this epic extends.
- Not here: history or playback of positions (a time slider is out for the first version, prd 6.3).

## References

- parent - _bmad-output/initiative-flowmap/initiative-flowmap.md, section Requirements (R53 to R59) and the Decision of 2026-11-03
- gap review - _bmad-output/initiative-flowmap/gap-review-2026-11-03.md, items 4 and 5 and the products behind them (Kymera dataset-bound points and shapes, Esri Workforce and Velocity, Esri Pipeline Referencing, KROHNE PipePatrol, Atmos Pig, DNV)
- prd - _bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md, NFR-1, NFR-2, NFR-8, section 6.3
- architecture - _bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md, AD-6 (the batch), AD-7 (the popup and the line popup), AD-11 (look and colour), AD-17 (changes reach every open map), AD-18 (the scripting API), AD-19 (snapping and `distanceM`), AD-20 (the closed record: a dynamic item is not one)
- contract - docs/contract.md, "The component's props" and "The scripting API"; docs/instruments.md (distance along a line)
- design - _bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md, the visual identity (adopted companion)
- experience - _bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md, the behaviour: popups, Needs you, search (adopted companion)

## Notes

- Decision: 2026-10-26 Names, licence (Apache-2.0) and the Alarm Metrics answer are recorded in the initiative's Notes and apply here.
- Waits on epic-viewing because: the map view, the batch, popups, Needs you, search and the line segments with instruments.
- Waits on epic-editing because: the Kinds screen and the properties panel to write a line's station origin and unit (R56); the rest of this epic needs only the map view.
- Decision: 2026-11-03 Owner (gap review, "agree, write up the gap review as recommended"): this epic is new, id 8, covering R53 to R59 (items 4 and 5), after epic-editing as the owner asked. Build order: after epic-import-export in the table and beside it in time. It does not wait on epic-import-export and epic-import-export does not wait on it (no shared code beyond the map view both read); epic-import-export keeps the earlier row because it is first-version PRD scope (prd UJ-3, section 6) whose forms, matching and undo come fresh from epic-editing, while this epic is new scope from the gap review and needs epic-editing for one field only (the station origin and unit). epic-phone and epic-template-cutover keep their `after` lists; neither waits on this epic.
- Decision: 2026-11-03 Two channels for dynamic items, both in the contract: the `dynamicItems` prop for a page (bound to a dataset, a tag or a script as any prop is) and `system.mapstudio.setDynamicItems(project, layer, items)` for a Gateway script feeding every open map of the project (a pig tracker, a fleet feed), carried on the change bus as `map.changed` is (AD-17). How the layer reaches the browser (its own message type or a part of `values.batch`) and the `ttl` default are settled at refinement.
- Constraint: alarm presentation (ER-27, AD-11): a dynamic item's `state` is one of R40's presets, so it draws with the preset's token and glyph or word and never a free colour; a dynamic item never draws an alarm glyph (alarms belong to map items with an alarms path); the strip's segment states are the map's, not a new vocabulary.
- Constraint: prd NFR-2: a dynamic item carries its values; Map Studio subscribes to no tag for it, and a layer with many items is one message per refresh, never a subscription per item.
- Open question: whether a dynamic item may name an `assetId` so its popup shows that asset's live values through its kind setup (a truck that is also an asset); if so, through the same shared subscription as a map item's popup (AD-6), decided at refinement.
- Open question: feet stations' notation (`10+34.05` means 1,034.05 ft) and whether a line's station may run opposite to its drawn direction; both settled with a midstream reviewer at refinement.
- Open question: geofence enter and exit (ArcGIS Velocity) as a state a Gateway script sets on a dynamic item from backlog story 19's `locate` (the shared geometry module); not in this epic's requirements until the owner asks.
- Note: stories are planned when this epic is refined; the tracer bullet is likely the `dynamicItems` prop drawn on the dev page with one moving item, then the stationing of L-SWD.
- Decision: 2026-11-06 Owner ("Epic 8 will be right after cutover"): built after epic-template-cutover; an order only, since it needs nothing from the cut-over.
