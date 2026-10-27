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

Phone editing: at 390 px, touch only, a user with phone editing taps Edit in the map item's bottom sheet, moves a point by tapping Move and panning the map under a fixed centre crosshair (Done or Cancel), sees an Undo bar, and edits properties in the bottom sheet, with no drawing tools offered.

## Outcome

An operator corrects a misplaced pin and its properties from the field (prd SM-3).

## Done when

- At 390 px a point is moved and a property edited and both reach the map store.
- Phone editing starts from an Edit button in the item's bottom sheet; there is no map-wide Edit switch on the phone.
- Move pans the map under a fixed centre crosshair; Done saves the point there and Cancel leaves it.
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
- Decision: 2026-10-27 UX workshop (ux-map-studio, 2026-10-27): R30 the crosshair (tap Move, the map pans under a fixed centre crosshair, Done or Cancel) replaces long-press and drag, with an Undo bar after Done; R31 phone editing starts from an Edit button in the item's bottom sheet and edits that one item; popups and properties are bottom sheets, a deliberate change from the template's chip row and top sheets and an engineering review item (ER-27). Behaviour is in EXPERIENCE.md (Bottom sheet, Phone crosshair, UJ-4). Stories are planned when this epic is refined.
