---
type: epic
title: "Integrators provision and move maps with files"
parent: initiative-flowmap
covers: ["R25", "R26", "R27", "R28", "R29", "R35"]
sources: []
companions: []
after: []
refined: false
risk: medium
---

# Integrators provision and move maps with files

## Description

Files in and out: CSV templates per kind, CSV, KML and GeoJSON imports as a preview matched to assets by name, bulk editing shared properties, reference layers, and export as GeoJSON or CSV that can seed another project.

## Outcome

An integrator brings a field onto the map from files instead of by hand, and any map can be backed up or moved (prd UJ-3).

## Done when

- A filled CSV template imports with no errors; unreadable rows are listed with reasons.
- An import is a preview until added, then one undo removes it.
- Same-name assets link automatically and the counts of linked and unlinked show.
- An export imported into an empty map store gives the same map items.
- Verified on the template's test stack.

## Boundaries

- Not here: any approval of imported data; geometry is never bulk edited.

## References

- parent - _bmad-output/initiative-flowmap/initiative-flowmap.md, section Requirements
- prd - _bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md
- prd - section 4.7, FR-35

## Notes

- Decision: 2026-10-26 Names, licence (Apache-2.0) and the Alarm Metrics answer are recorded in the initiative's Notes and apply here.
- Waits on epic-editing because: map items, forms, linking and undo.
