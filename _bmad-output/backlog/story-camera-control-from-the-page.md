---
id: 31
type: story
title: "Camera control from the page: fly to, fit bounds, zoom, read the bounds, and a map-ready event"
parent: none
covers: []
after: []
refined: false
hitl: false
risk: medium
---

# Camera control from the page: fly to, fit bounds, zoom, read the bounds, and a map-ready event

## Description

From the feature review of 2026-11-07 (item 1, the owner: "I'm good with your recommendations"). Entry 14 of epic 4 lets a page select an item (`selectedItem`) and read where the map looks (`viewport`, `onViewportChanged`), but a page cannot move the camera itself: a "Zoom to Mesa field" button, a dashboard tile that fits a site, a script that reads the bounds to query its own data. This story gives the page camera commands (fly to a point at a zoom, fit bounds with padding, zoom in and out, reset north) and a way to read the current bounds from a script, plus a map-ready event so a page knows when the map has loaded its items (from the same review, item 6).

## Requirements

- Verify: when it is scheduled, a dev page button flies the map to a given point and zoom and another fits a site's bounds; a script reads the bounds; the map-ready event fires once per load with the item count; nothing moves the camera while an editor is dragging; every command is in the versioned contract.

## References

- gap review - _bmad-output/initiative-flowmap/gap-review-2026-11-07.md
- epic - _bmad-output/initiative-flowmap/tickets/epic-editing/epic-editing.md, R21 and R22 (the page's selection and viewport)

## Notes

- Open question: Component methods called from a script (Perspective's component functions) or a writable camera prop the page sets; a prop is bindable, a method is not.
- Open question: Whether a command moves the camera while Edit mode has a tool in hand (entry 14 holds a page's selection until the tool is down).
- Note: 2026-11-07 Owner: backlog, not scheduled.
