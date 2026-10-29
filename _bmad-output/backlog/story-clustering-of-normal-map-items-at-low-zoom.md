---
id: 9
type: story
title: "Clustering of normal map items at low zoom"
parent: none
covers: []
after: []
refined: false
hitl: true
risk: medium
---

# Clustering of normal map items at low zoom

## Description

When the map is zoomed out, nearby point map items that need nothing are grouped into one cluster marker showing how many it holds (for example "12", or "9+"), with a tooltip and a click that zooms in to split it or lists its members. Prompted by the Inductive Automation Exchange resource "Map View Clusters" (exchange 3027, 2026-10-28), which clusters the built-in Perspective Map's views with a Jython overlap script per zoom. Clustering is out of scope for the first version (prd section 6.3); the owner asked to explore how it could work, not to schedule it (owner, 2026-10-28).

How it would work in Map Studio (verified against the code, not built):

- MapLibre clusters a GeoJSON source natively in the browser (`cluster: true`, `clusterRadius`, `clusterMaxZoom`, `clusterProperties` to aggregate member values; `getClusterExpansionZoom` and `getClusterLeaves` for the click). Map Studio's points are already one GeoJSON source (`SOURCE_ITEM_POINTS` in `web/typescript/MapStudio.tsx`), so no Gateway work, no script and no per-zoom recompute on the Gateway: the Exchange approach's overlap script and binding are not needed.
- The cluster marker is a neutral disc with the count in `map-label` type; a click zooms to the expansion zoom, or opens the shared-marker pick list (`PickList.tsx`) when the members cannot split further.

## Requirements

- Verify: when it is scheduled, on the dev 30-pad set zoomed out to the field, normal items group into count markers that split as the user zooms in; every item in alarm, comms lost or stale stays drawn on its own with its glyph at every zoom; the Needs you count is unchanged by clustering; the owner's engineering review (ER-27) of the cluster look is recorded.

## References

- prd - _bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md, section 6.3 (clustering out of scope for the first version)
- initiative - _bmad-output/initiative-flowmap/initiative-flowmap.md, Boundaries (clustering out for the first version)
- template - ign-scada-template docs/map.md section 5 item 4 ("Crowding": nothing is hidden, the bar keeps the count) and item 8 (shared spot within 20 m)
- epic-viewing - entry 7 (dots below zoom 12, labels that give way, shared markers within 20 m)
- exchange - https://inductiveautomation.com/exchange/3027/overview

## Notes

- Constraint: alarm presentation. A cluster must never hide an abnormal item (template docs/map.md section 5 item 4, AD-11, ER-27): cluster only items in the normal state, so alarm, comms-lost and stale items always draw individually; if the owner wants abnormal items clustered too, the cluster takes the worst member's glyph and digit, which is an ER-27 item.
- Note: what the map already does for crowding (epic-viewing entry 7): normal items shrink to dots below zoom 12 with a 44 px hit area, labels give way by rank, and items within 20 m are one shared marker with a pick list. Clustering is the next step only if the 300-pad target or a dense field still crowds after that.
- Open question: Cluster radius and the zoom where clustering stops (a candidate: radius 40 px, none from zoom 14, where names show).
- Open question: A cluster's click: zoom in to split it (MapLibre's expansion zoom) or list its members first.
- Open question: Whether lines and instruments hide inside a cluster's area or keep drawing.
