---
id: 8
type: story
title: "Demo project: water utility (lift stations and mains)"
parent: none
covers: []
after: []
refined: false
hitl: false
risk: low
---

# Demo project: water utility (lift stations and mains)

## Description

A third small demo for a fleet of sites spread over a town: a water or wastewater utility with lift stations, wells, a treatment plant and storage tanks as point kinds, force mains and water mains as line kinds with a flow meter and a pressure meter on a main (instruments on lines), and pressure zones as area kinds. Simulated tags (wet well level, pump run states, flow, comms). This is the classic remote-sites fleet that Ignition users map today, and it shows the comms and data-age states well. Alternatives considered, if the owner prefers: an EV charging network, telecom towers, or a fleet of pump stations on a pipeline. Raised by the owner, 2026-10-27.

## Requirements

- Verify: on a fresh 8.3 Gateway with Map Studio installed and the demo project imported, the map shows each lift station's level and pump states, a station with lost comms shows as such, a main's meter values show on the line, and "Needs you" lists the stations in alarm, following its README.

## References

- prd - _bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md, FR-40 (instruments on lines)
- experience - _bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md, Needs you and data states

## Notes

- Decision (owner, 2026-10-27): water utility is the third demo.
- Decision (owner, 2026-10-27): a small water icon set is needed (lift station, well, treatment plant, storage tank, flow meter, pressure meter, valve), drawn in the core set's style; built as an icon story before this demo.
- Decision (owner, 2026-10-27): the demos live in a separate repository, working name `perspective-map-studio-demos` (owner open to other names), and are hosted on the owner's website, not shipped inside this repository. Waits for story 14 (instruments on lines) and epic-viewing.
