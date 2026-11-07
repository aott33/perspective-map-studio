---
id: 24
type: story
title: "Measure tool: distance along a drawn path and area of a drawn shape"
parent: none
covers: []
after: []
refined: false
hitl: false
risk: low
---

# Measure tool

## Description

A Measure button in View mode (beside the zoom card, and in the phone's legend sheet) lets any user click or tap points along the map to read the running distance in the project's unit (metres and kilometres, or feet and miles, from the setup), and close the path to read its area; Esc, Done or a tap on the button clears it. From the gap review of 2026-11-03 (item 12): Esri Field Maps and a Perspective map component ship one. The measure path is drawn in the selection look and never saved or counted; the readout is a chip under the top bar in words and numbers, keyboard usable (Enter adds a point at the map's centre crosshair, as the phone's Move does, R30). Nothing of it is an edit, so viewers have it without a role.

## Requirements

- Verify: when it is scheduled, measuring the dev map's L-SWD from end to end reads within 1 % of its stored length (docs/instruments.md: 2,922 m), a closed path reads an area, the unit follows the setup, Esc clears it, nothing reaches the map store or the edit record, and it works at 390 px by touch and by keyboard at 1440 px with 44 px targets.

## References

- gap review - _bmad-output/initiative-flowmap/gap-review-2026-11-03.md, item 12 (measure; Esri Field Maps and a Perspective map component)
- architecture - AD-19 (the shared geometry module's distance along a line is the arithmetic)
- initiative - R38 (WCAG 2.2: dragging, target size, keyboard), R30 (the centre crosshair)
- docs - docs/instruments.md (distance along a line)

## Notes

- Decision: 2026-11-03 Owner (gap review, "agree, write up the gap review as recommended"): in the backlog, after 0.3.0, one story of its own (view-mode only, no store work).
- Open question: whether the tool also shows a measured point's coordinates (useful in the field) and bearing between two points.
