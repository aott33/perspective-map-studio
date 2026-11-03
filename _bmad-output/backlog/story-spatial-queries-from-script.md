---
id: 19
type: story
title: "Spatial queries from script: itemsWithin an area and locate a point in the shared geometry module"
parent: none
covers: []
after: []
refined: false
hitl: false
risk: medium
---

# Spatial queries from script

## Description

Two Gateway-scope functions answer "what is in this area" and "where is this point", so a project script can raise a geofence event, pick the nearest site to a truck or list the pads inside a lease without its own geometry code. From the gap review of 2026-11-03 (item 10): the Kymera Map Panel module's `containsPoint`. `system.mapstudio.itemsWithin(project, areaId)` returns the map items whose point, or any vertex, lies inside the area (ids, names, kinds); `system.mapstudio.locate(project, lng, lat, nearest=5)` returns the areas containing the point and the nearest map items with their distance in metres. Both read the live map (as `getMap` does) and run in the shared geometry module (`common/`, the one the attachment and snapping use, AD-19), so the browser and the Gateway agree on inside and outside; both are in the versioned contract with Jython examples in docs/contract.md.

## Requirements

- Verify: when it is scheduled, on the dev map `itemsWithin` of the seeded `North fence` geofence returns exactly the map items seeded inside it and none outside, an item on the boundary counted as the docs say; `locate` on CTB1's coordinates returns the geofence that holds it, if any, and CTB1 first at 0 m; a deleted item is never returned; both run under a second on the 30-pad set and are unit tested in `common/` against the browser's answers.

## References

- gap review - _bmad-output/initiative-flowmap/gap-review-2026-11-03.md, item 10 (Kymera Map Panel: containsPoint)
- architecture - AD-18 (the scripting API), AD-19 (the shared geometry module), AD-20 (the record)
- contract - docs/contract.md, "The scripting API"
- epic-live-field - _bmad-output/initiative-flowmap/tickets/epic-live-field/epic-live-field.md (a geofence state on a dynamic item would use `locate`)

## Notes

- Decision: 2026-11-03 Owner (gap review, "agree, write up the gap review as recommended"): in the backlog, after 0.3.0.
- Constraint: the functions read only; nothing is written to the map store, tags or devices (initiative Constraints, prd NFR-5).
- Open question: whether a browser-side counterpart (the same module in `web/`) is exposed to a page through an event, or script only at first.
- Open question: distance along a line to the nearest point of a line (for a leak estimate) as a third function, or left to epic-live-field's `pointToStation`.
