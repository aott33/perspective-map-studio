---
id: 4
type: spike
title: "How the Kinds screen tag browser lists one example asset's tags"
parent: none
covers: []
after: []
refined: false
hitl: true
risk: medium
---

# How the Kinds screen tag browser lists one example asset's tags

## Description

The Kinds screen's tag browser shows one example asset's tags and saves the picked tag as a path relative to the asset (R15, EXPERIENCE.md Tag browser). It needs a Gateway tag-browse lookup the module can call, which is unverified, and no message type in AD-8 carries it yet. epic-editing waits on it. Source: architecture Deferred and EXPERIENCE.md Open Questions 3, carried to the backlog 2026-10-27.

## Approach

- Verify: a live 8.3 check of the browse call from the module's Gateway scope, and the new message type proposed for `common/` (AD-8), are recorded in docs/platform-checks.md and the architecture, and the owner accepts them.

## References

- architecture - _bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md, AD-8 and Deferred, open questions
- experience - _bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md, Component Patterns (Tag browser) and Open Questions 3
- initiative - _bmad-output/initiative-flowmap/initiative-flowmap.md, R15 and Notes (open question on the tag browser); prd FR-12; Constraints (NFR-7)

## Notes

- Open question: Which Gateway API browses tags under an asset's base path, under whose permissions, and how deep and how fast on a UDT instance.
- Open question: The message shape (for example a `tags.browse` request with base path and folder) and its role check (full editing only).
- Open question: How "resolves for N items" is counted across every asset of the kind without a browse per asset.
- Dropped: 2026-10-27 Moved into the plan by the owner's decision: the tag browser is in scope, built as Map Studio's own tree. The Gateway lookup is epic-map-store-and-data entry 15 ("Tag browse for the Kinds screen", 2.15), which checks the 8.3 browse API live first and answers the three questions above (`tags.browse`, full editing only, "resolves for N of M items"); the tree with the Kinds screen is epic-editing's (architecture AD-8).
