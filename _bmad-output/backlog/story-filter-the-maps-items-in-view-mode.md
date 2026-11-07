---
id: 32
type: story
title: "Filter the map's items in View mode: by kind, state or property, from a control or the page"
parent: none
covers: []
after: []
refined: false
hitl: true
risk: medium
---

# Filter the map's items in View mode: by kind, state or property, from a control or the page

## Description

From the feature review of 2026-11-07 (item 2). An operator or a page wants to see only some items: one operator's wells, only items in alarm or comms lost, only one route. Edit mode's item list has a Filter with kind chips (epic 4 entry 7), but the map itself always draws every item. This story filters what the map draws in View mode by kind, by state and by a form field's value, chosen from a control (the Layers surface or the legend) or set by the page through a prop, the Needs you counts staying for every item.

## Requirements

- Verify: when it is scheduled, choosing "In alarm" draws only the items in alarm; a page prop naming an operator draws only that operator's wells; clearing the filter draws all; the filter says in words that items are hidden; e2e passes.

## References

- gap review - _bmad-output/initiative-flowmap/gap-review-2026-11-07.md
- epic - epic 4 entry 7 (the Edit-mode Filter and its kind chips)

## Notes

- Open question: Whether a filtered-out item still counts in Needs you (a hidden alarm should not be missed: probably yes, with a word that the filter hides it).
- Open question: Filter words a user picks from lists only, or a page-written expression; no free expressions from a viewer.
- Note: 2026-11-07 Owner: backlog, not scheduled.
