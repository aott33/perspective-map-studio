---
type: epic
title: "Map editors build and keep the map in the browser"
parent: initiative-flowmap
covers: ["R10", "R11", "R14", "R15", "R16", "R17", "R18", "R19", "R20", "R21", "R22", "R23", "R24", "R38", "R40"]
sources: []
companions: []
after: []
refined: false
risk: high
---

# Map editors build and keep the map in the browser

## Description

The Map Studio tools: one clear mode, a first-run path, drawing and changing points, lines and areas with snapping, validation and undo, fast entry, item forms with the place check, linking map items to assets, and writing kind setups and overrides with a tag browser.

## Outcome

A map editor new to the Mesa demo field lays it out with the tools alone in under 30 minutes (prd SM-2).

## Done when

- The tools show only for editing roles, with exactly one named mode.
- Points, lines and areas are added, changed, split, snapped, deleted and undone, each without dragging as well as with.
- A map item links to an asset, and its kind setup drives its icon and popup at once.
- The tools meet WCAG 2.2 for dragging, target size, contrast and keyboard use.
- The 30-minute test passes with an admin new to the Mesa field.
- Verified on the template's test stack.

## Boundaries

- Hands on: forms, linking and undo that epic-import-export and epic-phone reuse.
- Where the tools sit on the page is decided in a UX workshop before this epic is refined.
- Not here: imports, exports, bulk edit or phone editing.

## References

- parent - _bmad-output/initiative-flowmap/initiative-flowmap.md, section Requirements
- prd - _bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md
- prd - section 4.3 to 4.6, NFR-2, NFR-3
- research - _bmad-output/initiative-flowmap/brief-flowmap/addendum.md, ranked practices for the first version

## Notes

- Decision: 2026-10-26 Names, licence (Apache-2.0) and the Alarm Metrics answer are recorded in the initiative's Notes and apply here.
- Waits on epic-map-store-and-data because: saving, roles and the asset list.
- Waits on epic-viewing because: the map view to draw on.
- Decision: 2026-10-26 The owner approved value-driven styles and area category tints (initiative R40; prd FR-38, FR-39; architecture AD-11, AD-16); this epic covers writing a kind's style rule, area tints and per-item overrides in the kind setup screen, which embeds epic-viewing's preview of every state before saving.
