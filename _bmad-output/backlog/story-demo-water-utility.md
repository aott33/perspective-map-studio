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

- Open question: Which third industry: water utility (recommended, a common Ignition fleet), EV charging, telecom towers, or pipeline pump stations.
- Open question: Same packaging and release questions as backlog 6; needs story 14 (instruments on lines) and epic-viewing.
