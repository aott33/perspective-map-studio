---
id: 10
type: story
title: "Owner review notes on the 0.3.0 map"
parent: none
covers: []
after: []
refined: false
hitl: true
risk: low
---

# Owner review notes on the 0.3.0 map

## Description

The owner accepted epic-viewing entry 15's showcase renders on 2026-10-29 ("I'll keep it") and will review and test the system next, expecting several items. This file collects them as they come, each with the owner's words and the date, so they can be built together as one story before release 0.3.0 (epic-viewing entry 13) or moved to a later release by the owner.

## Requirements

- Verify: when it is scheduled, every item below is fixed or moved by the owner, shown in the showcase renders (`docs/screenshots/showcase-*.png`) where it is visible.

## Notes

- Item 1 (owner, 2026-10-29): the scale bar beside the Legend button "looks floating"; bottom-align it with the Legend button (`web/typescript/LegendControl.ts`, the bottom-left row; `mapstudio.css`).
- Item 2 (owner, 2026-10-29, with a 390 px screenshot of the open legend): "The legend for the phone and the phone layout needs rework. Why is the basemap selected here, isn't that a project setting?" At 390 px the open legend panel covers most of the map. Open: whether the viewer chooses the basemap at all (entry 14 put the choice in the legend because viewers never reach Edit mode's Layers rail) or the project setup's basemap is the only one shown.
- Item 3 (owner, 2026-10-29): "Make the attribution more discrete and put it along the bottom right of the map pretty much underneath the ignition black info button." Small text along the bottom-right edge, under Perspective's App Bar toggle, never covering the toggle.
