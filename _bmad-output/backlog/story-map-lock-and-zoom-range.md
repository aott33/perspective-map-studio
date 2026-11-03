---
id: 18
type: story
title: "Map lock and zoom range for kiosks and wall displays: maxBounds and zoomRange props"
parent: none
covers: []
after: []
refined: false
hitl: false
risk: low
---

# Map lock and zoom range for kiosks and wall displays

## Description

Two props for a map nobody should be able to pan away from: `maxBounds` (`{west, south, east, north}`, the map cannot leave these bounds) and `zoomRange` (`{min, max}`, the zoom cannot leave this range), both MapLibre's own options (`maxBounds`, `minZoom`, `maxZoom`), so a wall display or a kiosk stays on the field and a touch on it cannot zoom to the whole world. From the gap review of 2026-11-03 (item 9): the Kymera Map Panel module pins bounds and a maximum zoom. The zoom card's plus and minus disable at the range's ends with a title saying why; Fit, Return, search and Needs you rows clamp to the bounds; an invalid value is ignored with one console warning, as `startingArea` does. Both are in the closed prop list and the versioned contract.

## Requirements

- Verify: when it is scheduled, with `maxBounds` on the dev field a drag past the bounds springs back and search for an item outside them lands at the edge; with `zoomRange {12, 17}` the zoom card's buttons disable at 12 and 17 and a wheel or pinch goes no further; both props absent, the map behaves as today; the e2e suite covers the dev page that sets them at 1440 and 390 px.

## References

- gap review - _bmad-output/initiative-flowmap/gap-review-2026-11-03.md, item 9 (Kymera Map Panel: pinned bounds, maxZoom)
- contract - docs/contract.md, "The component's props" (`startingArea`'s validation is the pattern)
- initiative - R1 (starting area), Constraints (prd NFR-8: the props are versioned)

## Notes

- Decision: 2026-11-03 Owner (gap review, "agree, write up the gap review as recommended"): in the backlog, after 0.3.0; small, no owner decision pending.
- Note: the remembered place for the browser session (docs/contract.md, "The map's place") is clamped to the bounds when they are set.
