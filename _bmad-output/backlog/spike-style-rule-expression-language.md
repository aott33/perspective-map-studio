---
id: 3
type: spike
title: "Where a style rule Expression is evaluated, and in which language"
parent: none
covers: []
after: []
refined: false
hitl: true
risk: medium
---

# Where a style rule Expression is evaluated, and in which language

## Description

A kind setup's style rule may be an Expression that returns one preset name (R40, AD-16). Where it is evaluated (Gateway or browser) and in which expression language (Ignition expressions or a small Map Studio language) is open in AD-16 and EXPERIENCE.md (Open Questions 4). epic-viewing entry 1 draws style rules and epic-editing writes them, so both wait on the answer. Source: architecture Deferred and EXPERIENCE.md, carried to the backlog 2026-10-27.

## Approach

- Verify: the answer, with a live 8.3 check if it is an Ignition expression, is recorded in architecture AD-16 and docs/platform-checks.md, and the owner accepts it.

## References

- architecture - _bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md, AD-16 and Deferred, open questions
- experience - _bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md, Open Questions 4
- initiative - _bmad-output/initiative-flowmap/initiative-flowmap.md, R40 and Notes (open question on the expression)

## Notes

- Open question: Evaluated on the Gateway (one place, the live-value batch already there, AD-6) or in the browser (no round trip, preview without the Gateway).
- Open question: Can module code evaluate an Ignition expression against a map item's values, and what does an expression that errors draw (AD-16 says `normal`, reported for that item).
- Open question: Whether the instruments aggregate source (AD-16) is computed in the same place.
- Decision: 2026-10-28 Settled when epic-viewing was refined (owner): on the Gateway, in Ignition's expression language, checked live as the first step of epic-viewing entry 1. This spike is closed as moved there.
