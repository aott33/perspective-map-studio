---
id: 6
type: story
title: "Demo project: oil and gas field"
parent: none
covers: []
after: []
refined: false
hitl: false
risk: low
---

# Demo project: oil and gas field

## Description

A small, self-contained Ignition project that shows Map Studio on an oil and gas field: a handful of well pads, a tank battery, a compressor station and an SWD tied together by pipelines and laterals, with instruments on a line, kind setups, a style rule and a popup view. Simulated tags (memory or expression tags in a UDT, no PLC or field simulator needed) so it runs on a bare Gateway with the module installed. Meant for the README, screenshots and a short screen recording, and as a starting point people can copy. Raised by the owner, 2026-10-27.

## Requirements

- Verify: on a fresh 8.3 Gateway with Map Studio installed and the demo project imported, the map shows live values, a style rule changes an item's look, a popup opens, and an editor can draw and save a line, all within 10 minutes of following its README.

## References

- template - aott33/ign-scada-template, the Mesa demo field (pads, assets, UDTs) as a source of realistic names and layout
- experience - _bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md, the Mesa map in the key screens

## Notes

- Decision (owner, 2026-10-27): the demos live in a separate repository, named `map-studio-examples` (owner, 2026-10-27), and are hosted on the owner's website, not shipped inside this repository.
- Open question: Hosting a live demo publicly needs an Ignition license for that Gateway (a trial Gateway stops every 2 hours) and a viewer-only public session (no editing role for anonymous visitors, or edits reset on a schedule); settle both before it goes on the website.
- Decision (owner, 2026-10-27): waits for epic-viewing (drawing, popups); storing and validation (epic 2) alone is not enough.
- Decision (owner, 2026-10-27): a smaller made-up field, so the demo stays independent of the template.
