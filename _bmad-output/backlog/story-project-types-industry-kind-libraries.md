---
id: 29
type: story
title: "Project types: an industry's kind library chosen per project (oil and gas, water, solar and more)"
parent: none
covers: []
after: []
refined: false
hitl: true
risk: medium
---

# Project types: an industry's kind library chosen per project (oil and gas, water, solar and more)

## Description

Raised by the owner on 2026-11-06 while testing epic 4 on the dev stack: "for the future the user can select what theme/project type they want to see. For example, right now it's oil and gas but it would be great to have it categorized." Map Studio's kinds, icons, fields and style rules today come from the project's own kind list (the setup's `kindsFunction` and the kind setups, docs/kind-setup.md), and every example and the dev project are oil and gas: well pads, tank batteries, gathering lines. A project of another industry starts from nothing.

A project type would let a project pick a starting library of kinds for its industry (each with its geometry, icon, fields and style rule), which sets the toolbar's kind buttons, the legend's words and the first-run checklist's "Set up your kinds", and which the project then extends or edits. Candidate types: oil and gas gathering, water and wastewater, solar farms, electric distribution, pipelines, telecom.

**Workshop needed before refinement** (owner, 2026-11-06: "to workshop how to handle various types of projects").

## Notes

- Open question: Where the type is chosen: the Designer's setup form, the Kinds screen (epic-editing entry 12), or the first-run checklist (entry 7).
- Open question: Whether a type is a template copied into the project once, or a library the project keeps following when Map Studio ships a newer one.
- Open question: Whether a project may mix types (a utility with both water and electric assets).
- Open question: Where an industry's icons come from: Map Studio's own sprite, or the project's (backlog story `story-project-supplied-icons.md`).
- Open question: How the demo projects map to types (backlog `story-demo-oil-and-gas-field.md`, `story-demo-solar-farm.md`, `story-demo-water-utility.md`), and whether each type ships with its demo.
- Open question: Whether the words a type brings (the legend's, a kind's name) follow the project's language and units (epic-editing entries 19 and 20).

## References

- kind setup - docs/kind-setup.md and docs/kinds-and-assets.md, how kinds reach the map today
- backlog - story-project-supplied-icons.md, story-demo-oil-and-gas-field.md, story-demo-solar-farm.md, story-demo-water-utility.md
- epic-editing - entry 12 (the Kinds screen), entry 7 (the first-run checklist)
