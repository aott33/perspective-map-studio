---
type: epic
title: "Integrators provision and move maps with files"
parent: initiative-flowmap
covers: ["R25", "R26", "R27", "R28", "R35"]
sources: []
companions: []
after: []
refined: false
risk: medium
---

# Integrators provision and move maps with files

## Description

Files in and out: CSV templates per kind, CSV, KML and GeoJSON imports through guided steps (preview, column mapping, matching to assets, summary) undoing as one step, bulk editing shared properties of items selected in the list or by box or lasso, and export as GeoJSON or CSV that can seed another project.

## Outcome

An integrator brings a field onto the map from files instead of by hand, and any map can be backed up or moved (prd UJ-3).

## Done when

- A filled CSV template imports with no errors; unreadable rows are listed with reasons.
- An import runs Preview, Map columns, Match to assets and Summary before Import, is cancellable at every step, and one undo removes it.
- Same-name assets link automatically, confident matches ticked and doubtful ones flagged, and the counts of linked and unlinked show.
- A bulk change from the list or a box or lasso selection shows only shared fields, Mixed where values differ, and undoes as one step.
- An export imported into an empty map store gives the same map items.
- Verified on the template's test stack.

## Boundaries

- Not here: any approval of imported data; geometry is never bulk edited.
- Not here: reference layers (R29), deferred, not dropped (ux-map-studio, 2026-10-27).

## References

- parent - _bmad-output/initiative-flowmap/initiative-flowmap.md, section Requirements
- prd - _bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md
- prd - section 4.7, FR-35

## Notes

- Decision: 2026-10-26 Names, licence (Apache-2.0) and the Alarm Metrics answer are recorded in the initiative's Notes and apply here.
- Waits on epic-editing because: map items, forms, linking and undo.
- Decision: 2026-10-27 UX workshop (ux-map-studio, 2026-10-27): R26 the import is guided (Preview on the map and in a table, Map columns to fields, Match to assets, Summary of new, updated and skipped, then Import) and undoes as one step; R27 confident matches are ticked and doubtful ones flagged; R28 selection in epic-editing's item list (checkboxes, Shift-click range, select all in a group or filter) and on the map (box, Alt for a lasso), with a bulk form of shared fields and Mixed values, one undo step. R29 (reference layers) is deferred, not dropped, and leaves this epic's covers until the owner brings it back. Behaviour is in EXPERIENCE.md (Import steps, Bulk form, Multi-select). Stories are planned when this epic is refined.
