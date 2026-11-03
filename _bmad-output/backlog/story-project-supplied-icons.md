---
id: 22
type: story
title: "Project-supplied icons: a validated project icon folder of currentColor SVGs"
parent: none
covers: []
after: []
refined: false
hitl: false
risk: low
---

# Project-supplied icons

## Description

A project adds its own glyphs for its kinds without a module change: a folder of SVG files the setup names (a Gateway folder under the project's data, or a Perspective resource path), each file one glyph drawn in `currentColor` on a 24 px grid, read by the Gateway at scan and sent to the browser with the built-in set, so a kind's `icon` may name `project:<file>` as it names a built-in glyph today (R12). From the gap review of 2026-11-03 (item 12): every surveyed product lets a project bring icons, and R12's core set covers oil and gas only. The Gateway validates each file at load (one path or group, no fill colours other than `currentColor`, no scripts, no external references, size under a limit) and lists the refused ones with reasons in the Gateway log and the Kinds screen's icon picker; a refused or missing icon falls back to the kind's generic glyph with the reason in the item's checks (R14's "unknown kind" pattern).

## Requirements

- Verify: when it is scheduled, a project folder with three valid SVGs and one with a hard-coded fill shows the three in the Kinds screen's icon picker and refuses the fourth with the reason, a kind using one draws it on the map in every state preset and in both themes with the 3:1 contrast check passing, and the icon survives a project scan and a module upgrade; no SVG with a script or an external reference ever reaches the browser (unit test on the validator).

## References

- gap review - _bmad-output/initiative-flowmap/gap-review-2026-11-03.md, item 12 (project icons)
- initiative - R12 (the kind list and the core icon set), Constraints (prd NFR-10: no icon from the OpenBridge set; the project's icons are the project's licence)
- docs - docs/icons.md (the built-in set's rules: currentColor, the grid, the states)

## Notes

- Decision: 2026-11-03 Owner (gap review, "agree, write up the gap review as recommended"): in the backlog, after 0.3.0, one story of its own (a validator and a loader, no UI beyond the picker).
- Constraint: a project icon is drawn with the same state treatment as a built-in one (the ring, the glyph stack, the dot below zoom 12); an icon that does not read at 24 px is the project's problem and the docs say what works.
- Open question: where the folder lives (a Gateway data folder, so it is config as code under `data/`, or a Perspective image resource); a Gateway folder is the leaning.
