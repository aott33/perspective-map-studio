---
type: epic
title: "Operators fix map items from a phone"
parent: initiative-flowmap
covers: ["R30", "R31"]
sources: []
companions: []
after: []
refined: false
risk: medium
---

# Operators fix map items from a phone

## Description

Phone editing: at 390 px, touch only, a user with phone editing moves a point by long-press and drag, sees an Undo bar, and edits properties in a bottom sheet, with no drawing tools offered.

## Outcome

An operator corrects a misplaced pin and its properties from the field (prd SM-3).

## Done when

- At 390 px a point is moved and a property edited and both reach the map store.
- Below 768 px no drawing tools are offered.
- Every touch target is at least 44 px.
- Verified on a real phone against the test stack.

## Boundaries

- Not here: drawing on a phone.

## References

- parent - _bmad-output/initiative-flowmap/initiative-flowmap.md, section Requirements
- prd - _bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md
- prd - section 4.8

## Notes

- Decision: 2026-10-26 Names, licence (Apache-2.0) and the Alarm Metrics answer are recorded in the initiative's Notes and apply here.
- Waits on epic-editing because: geometry edits, forms and undo.
