---
id: 26
type: story
title: "Icon extras: a value-proportional ring (size by KPI) and a hover tooltip on desktop"
parent: none
covers: []
after: []
refined: false
hitl: true
risk: low
---

# Icon extras: a value-proportional ring and a hover tooltip

## Description

Two small view-mode additions to the icon, grouped because both are icon presentation reviewed together (ER-27) and neither touches the store:

- **Size by KPI.** A kind setup may name one KPI whose value scales a neutral ring behind the icon between a minimum and a maximum the setup gives (for example tank level 0 to 100 %, production 0 to 500 bbl/d), from the preset list's two ring sizes, never a free size: a glance ranks the sites. The ring is neutral in every theme and the state marks stay as they are over it; a stale value draws no ring. From the gap review of 2026-11-03 (item 12): value-proportional symbols are in WellDatabase, OFM and Esri; the size stays within presets so it is a reviewed look (R40).
- **Hover tooltip.** On a pointer device, hovering an icon or a line for a moment shows the item's name, kind and its worst state in a word (the popup's header line), so a desktop user reads a crowded map without clicking; nothing on touch (the popup is the tap). From the same review item: every surveyed desktop map has one.

## Requirements

- Verify: when it is scheduled, with Size by KPI on a tank kind the rings on the dev map scale with the level and a stale tank draws none, every state glyph stays legible over the largest ring (the 3:1 check), and Needs you is unchanged; hovering P12 at 1440 px shows its name, kind and state within 500 ms and nothing at 390 px by touch; the owner's engineering review of both looks is recorded.

## References

- gap review - _bmad-output/initiative-flowmap/gap-review-2026-11-03.md, item 12 (value-proportional rings; hover tooltip)
- initiative - R2 (the icon's parts), R40 (presets, no free size or colour), R38 (hover is never the only way: the popup remains)
- architecture - AD-11 (look and colour)
- docs - docs/review-er27.md (the review pack the two looks join)

## Notes

- Decision: 2026-11-03 Owner (gap review, "agree, write up the gap review as recommended"): in the backlog, after 0.3.0; the two tiniest item 12 pieces grouped into one story (both icon presentation, one ER-27 review); the other item 12 pieces are stories 21 to 25.
- Constraint: alarm presentation (ER-27): the ring is neutral, two preset sizes only, and never reads as a state; the tooltip repeats a state in a word, never adds one.
- Open question: whether the ring is per kind only or per item override too (R16's pattern); per kind only is the leaning.
