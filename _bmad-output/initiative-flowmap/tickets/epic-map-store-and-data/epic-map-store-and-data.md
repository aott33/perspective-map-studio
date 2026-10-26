---
type: epic
title: "The map, its kinds and assets live in the map store"
parent: initiative-flowmap
covers: ["R9", "R12", "R13", "R32", "R33", "R34"]
sources: []
companions: []
after: []
refined: false
risk: high
---

# The map, its kinds and assets live in the map store

## Description

The data foundation: a project names its database connection, kind list, asset list and editing roles; Map Studio creates and upgrades its tables, saves every finished edit, refuses saves without an editing role or that would overwrite another editor, and records who changed what.

## Outcome

Every later epic reads and writes one map through one contract, and nothing is lost when a map editor leaves halfway (prd SM-4).

## Done when

- A new project with an empty database connection gets Map Studio's tables with no hand-written SQL.
- An edit saved from one browser shows on another within a few seconds and survives a browser restart.
- A save without an editing role, and a second conflicting save, are refused on the Gateway with a message.
- The kind list and asset contract are documented with examples, and a missing or incomplete list is reported.
- Verified on the template's test stack.

## Boundaries

- Hands on: the map store schema, the save and conflict contract, the kind list and asset contract (consumed by epics 3 to 7).
- The Map Studio tools' role-based visibility is epic-editing's; this epic owns the Gateway-side role check (R9).
- Not here: any drawing UI or viewing UI.

## References

- parent - _bmad-output/initiative-flowmap/initiative-flowmap.md, section Requirements
- prd - _bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md
- prd - FR-7, FR-9, FR-10, FR-29 to FR-31, NFR-5, NFR-8

## Notes

- Decision: 2026-10-26 Names, licence (Apache-2.0) and the Alarm Metrics answer are recorded in the initiative's Notes and apply here.
- Waits on epic-module-foundation because: the module skeleton, build and signing.
