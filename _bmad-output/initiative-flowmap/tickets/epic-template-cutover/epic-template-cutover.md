---
type: epic
title: "The template's map runs on Map Studio"
parent: initiative-flowmap
covers: []
sources: []
companions: []
after: []
refined: false
risk: high
---

# The template's map runs on Map Studio

## Description

The cut-over in `ign-scada-template`: `/map` and `/map/edit` run on Map Studio with the Mesa field moved into the map store; `prov`'s map steps, `ops.mapedit`, the `map_draft` tables and queries and the Leaflet map retire; the `_Model/Map` consumers, view generators and byte gates, the Edge example and the PV-29 harness follow; alarm presentation passes engineering review.

## Outcome

The template's map lives in the map store and the old map is gone (prd SM-1).

## Done when

- The template's map pages run on Map Studio and its CI passes, `check.py` included.
- The Mesa field is in the map store with every map item linked.
- The retired steps, tables, queries and views are removed in a template pull request.
- Engineering review (ER-27) of alarm presentation is passed and recorded.
- The Edge example still builds on the built-in Map.

## Boundaries

- Owns the initiative's touch point on `ign-scada-template`.
- Its work lands as pull requests in `ign-scada-template`, not in this repository.

## References

- parent - _bmad-output/initiative-flowmap/initiative-flowmap.md, section Requirements
- prd - _bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md
- addendum - _bmad-output/initiative-flowmap/prd-map-studio/addendum.md, template follow-up
- prd - SM-1, FR-34

## Notes

- Decision: 2026-10-26 Names, licence (Apache-2.0) and the Alarm Metrics answer are recorded in the initiative's Notes and apply here.
- Waits on epic-viewing because: parity with today's map.
- Waits on epic-editing because: editing.
- Waits on epic-phone because: phone editing.
