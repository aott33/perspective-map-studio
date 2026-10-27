---
id: 2
type: story
title: "Popup parameters: per-item override, empty values, URL-encoding"
parent: none
covers: []
after: []
refined: false
hitl: false
risk: medium
---

# Popup parameters: per-item override, empty values, URL-encoding

## Description

The details of popup view parameters and link placeholders that the owner's decision of 2026-10-27 left open. The decision itself is in the plan: a kind setup's custom popup view is `popupView {path, params}`, the view always receives `mapItem`, each param is a literal or one placeholder from a closed list (`{item.id}`, `{item.name}`, `{asset.id}`, `{asset.path}`, `{item.properties.X}`), the popup link takes the same placeholders, and the write path refuses an unknown placeholder with `invalid` (initiative R8, R39; prd FR-6, FR-37; architecture AD-7, AD-16; stored and validated in epic-map-store-and-data entry 9, rendered in epic-viewing). Three details remain, not decided or scheduled.

## Requirements

- Verify: when it is scheduled, a map item override of params, a placeholder with an empty or missing value in a param and in a link, and a link value holding spaces or `/` each behave as the owner decides, shown in a test on the dev Gateway.

## References

- initiative - _bmad-output/initiative-flowmap/initiative-flowmap.md, R8, R16, R39 and Notes (Decision 2026-10-27, popup view parameters and link placeholders)
- prd - _bmad-output/initiative-flowmap/prd-map-studio/prd-map-studio.md, FR-6, FR-13, FR-37, section 9 question 15
- architecture - _bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md, AD-7 (popup view parameters and placeholders) and AD-16 (popup view params)
- story - _bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/tickets.toml, entry 9 (2.9)
- epic - _bmad-output/initiative-flowmap/tickets/epic-viewing/epic-viewing.md (custom popup view and popup links)

## Notes

- Decision: 2026-10-27 Owner: params, the closed placeholder list, links using the same placeholders and the `invalid` refusal moved into the plan (epic-map-store-and-data entry 9); this ticket keeps only the open details below and is retitled from "Per-kind parameters for the custom popup view and the popup link".
- Open question: Whether a map item override may change the params, like any other part of the kind setup (R16), and whether it replaces the whole `params` or one param at a time.
- Open question: What an empty or missing placeholder value does in a param (pass an empty string, pass null, or leave the param out); the popup link icon is already hidden when a placeholder has no value (R8).
- Open question: Whether placeholder values filled into a link are URL-encoded (a name with spaces or `/`), and whether `{asset.path}` is encoded as one segment or kept with its slashes.
