---
id: 1
type: story
title: "Reference layers: context shapes and images shown under the map items"
parent: none
covers: []
after: []
refined: false
hitl: false
risk: medium
---

# Reference layers: context shapes and images shown under the map items

## Description

A map editor uploads context once and toggles it in Layers: lease or unit boundaries from KML or a shapefile, survey grids (land grids), third-party pipelines, power lines and roads, or a drone orthophoto or site plan image. Reference layers are context only, never map items: they are not edited, linked or styled, and never saved as map items. Deferred by the owner in the UX workshop (ux-map-studio, 2026-10-27); parked here, not covered by any epic, until the owner brings it back (owner decision 2026-10-27).

## Requirements

- Verify: when it is scheduled, a map editor adds a KML boundary and an image layer, shows, hides and removes them in Layers, and no map item is created or changed.

## References

- initiative - _bmad-output/initiative-flowmap/initiative-flowmap.md, Requirements R29
- prd - _bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md, FR-26 and section 6.3
- architecture - _bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md, Deferred (reference layers last for the session)
- experience - _bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md, Layers (deferred, not dropped)

## Notes

- Parked: initiative R29 (prd FR-26), deferred by the owner in the UX workshop (ux-map-studio, 2026-10-27); moved to the backlog by the owner's decision of 2026-10-27; no epic covers it.
- Open question: "Uploaded once" means shared and kept, but R29 and the architecture's Deferred note say a reference layer lasts for the session only (architecture review T6: session-only, or a `mapstudio_reference_layer` row through the write path); the owner decides when it returns.
- Open question: Which formats are in: KML and GeoJSON (R29) plus shapefile, and raster images (orthophoto, site plan) placed by georeference or by hand; image size limits.
- Open question: Who may add or remove a layer (full editing only?), and whether viewers can toggle layers in View mode.
- Open question: Which epic takes it back: epic-import-export (the parsers) or epic-viewing (Layers and drawing).
