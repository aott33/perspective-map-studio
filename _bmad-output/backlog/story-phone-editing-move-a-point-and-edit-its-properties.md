---
id: 30
type: story
title: "Phone editing: move a point and edit its properties from a phone"
parent: none
covers: []
after: []
refined: false
hitl: true
risk: medium
---

# Phone editing: move a point and edit its properties from a phone

## Description

Parked by the owner on 2026-11-06, out of the first version: "I think we can remove phone editing, I don't know how much value there is in that. We can backlog that for future (not part of this mvp)." It was epic-phone (id 6, now dropped), covering initiative R30 and R31 (prd FR-27, FR-28, SM-3, UJ-4), whose text the initiative keeps.

What it would be: at 390 px, touch only, a user with the phone editing role taps Edit in the map item's bottom sheet, which turns the sheet into an edit sheet for that one item (Location with Move, Name, kind fields, Undo and Done, each field saved as it is finished). Move pans the map under a fixed centre crosshair, with the old place shown as a faded "Was here" marker and the distance from it in a card; Done saves the point there with an Undo bar ("P12 moved 38 m. Saved"), Cancel leaves it. Below 768 px no drawing tools are offered, every touch target is at least 44 px, and there is no map-wide Edit switch on the phone. The design is settled in the UX spines: EXPERIENCE.md (Bottom sheet, Phone crosshair, Phone move, UJ-4) and DESIGN.md (Bottom sheet, Phone crosshair, key-screen-2-phone-move.png).

Already built and kept, so this story starts from them: the phone editing role in the Designer's Map Studio Setup and its Gateway level `phone` (epic-map-store-and-data, initiative R9); popups as bottom sheets on a phone (epic-viewing, R6); no drawing tools and no Kinds screen below 768 px (epic-editing). The sheet's Edit button, a placeholder that did nothing, leaves the sheet in epic-editing entry 16.

## Requirements

- Verify: when it is brought back, at 390 px on a real phone against the test stack, a user with the phone editing role moves a point with the crosshair and edits a property from the item's bottom sheet, both reach the map store and show on another open map within a few seconds, Undo reverses the move, and no drawing tool is offered.

## References

- initiative - _bmad-output/initiative-flowmap/initiative-flowmap.md, R30 and R31 (parked, text kept), the Decision of 2026-11-06
- epic - _bmad-output/initiative-flowmap/tickets/epic-phone/epic-phone.md (dropped; its Done when and the 2026-10-27 UX decision)
- prd - _bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md, UJ-4, FR-27, FR-28, SM-3
- ux - _bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md (Bottom sheet, Phone crosshair, Phone move, UJ-4) and DESIGN.md (Bottom sheet, Phone crosshair)

## Notes

- Note: 2026-11-06 Owner: parked, not scheduled; the template's editor offers no phone editing today ("Open the editor on a laptop" below 768 px), so the cut-over (epic-template-cutover) removes nothing a phone user has.
- Open question (owner): what the phone editing role means until this is built. Pick: leave the Designer's Phone-editing roles field and the Gateway's `phone` level as built (removing them is a setup schema change), and say in docs/setup.md that no screen uses the role yet.
- Open question: whether the edit sheet is still wanted when this comes back, or only Move from the popup sheet, the owner's doubt being the value of editing from a phone.
