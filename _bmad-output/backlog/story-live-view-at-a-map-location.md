---
id: 20
type: story
title: "A live view at a map location: a kind's markerView as a DOM marker from a zoom level"
parent: none
covers: []
after: []
refined: false
hitl: true
risk: medium
---

# A live view at a map location

## Description

A kind setup may name a small project view, `markerView {path, params, fromZoom}`, drawn on the map at the map item's place instead of its icon from zoom `fromZoom` upward: a mini faceplate at a site (a tank level bar, a compressor's two values and its run state), the project's own Perspective view with the same `mapItem` and params as a custom popup view (R39, AD-7). From the gap review of 2026-11-03 (item 11): the Kymera Map Panel module's Data Templates. Each is a MapLibre DOM marker holding a Perspective view, so it is capped: at most N on screen (a candidate: 12), the rest drawn as icons, and the cap, the zoom and the count seen are in the docs; below `fromZoom` the icon draws as today. The alarm glyph, the comms state and the stale mark stay on the marker's corner whatever the view shows, so the project's view can never hide a state (ER-27).

## Requirements

- Verify: when it is scheduled, the dev project's `Markers/TankLevel` view draws at a tank from zoom 15 with its live value, the icon returns below it, the cap holds with the 30-pad set zoomed in (icons past the cap, a console line naming the count), the alarm glyph and the stale mark draw over the view's corner, pan and zoom keep 60 frames per second (R37) with the cap of views on screen, and a missing view falls back to the icon with one console warning.

## References

- gap review - _bmad-output/initiative-flowmap/gap-review-2026-11-03.md, item 11 (Kymera Map Panel: Data Templates)
- initiative - R39 (the custom popup view and its params: the same contract), R37 (60 frames per second), R2 (the icon states)
- architecture - AD-7 (a project view with `mapItem`), AD-11 (look and colour)
- docs - docs/platform-checks.md (how a third-party component renders a project view, checked in the spike)

## Notes

- Decision: 2026-11-03 Owner (gap review, "agree, write up the gap review as recommended"): in the backlog, after 0.3.0.
- Constraint: alarm presentation (ER-27): the state marks draw over the view and the view's own colours are the project's; a marker view that draws its own alarm colour is the project's engineering review, not Map Studio's.
- Constraint: prd NFR-2: a marker view's live values come through Perspective's own bindings for that view, not through Map Studio's batch; the docs say so and name the cost per view.
- Open question: the cap and whether it is a setup value; and whether a marker view is clickable to its popup or replaces it.
