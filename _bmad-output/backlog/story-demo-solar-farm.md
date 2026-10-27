---
id: 7
type: story
title: "Demo project: solar farm"
parent: none
covers: []
after: []
refined: false
hitl: false
risk: low
---

# Demo project: solar farm

## Description

A small, self-contained Ignition project that shows Map Studio outside oil and gas: a solar farm with inverter blocks and combiner boxes as point kinds, collection lines and the feeder to the substation as line kinds, the array blocks and the fence as area kinds, and a met station. Simulated tags (irradiance-driven power, inverter status, comms) so it runs on a bare Gateway. Proves the kind list, kind setups, style rules and popups are not tied to one industry, and gives a second set of screenshots. Raised by the owner, 2026-10-27.

## Requirements

- Verify: on a fresh 8.3 Gateway with Map Studio installed and the demo project imported, the map shows each inverter block's output and status, a block in fault stands out, and a popup shows the block's key values, following its README.

## References

- experience - _bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md, kinds and style rules
- icons - docs/icons.md: the core set is oil and gas; this demo may need a few solar icons, or uses the plain point

## Notes

- Open question: Whether to add a small solar icon set (inverter, combiner, met station, substation) or use plain points and labels.
- Open question: Same packaging and release questions as backlog 6.
