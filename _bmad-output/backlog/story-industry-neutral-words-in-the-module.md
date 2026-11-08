---
id: 36
type: story
title: "Industry-neutral words in the module's own text (field, site, Field-wide and the like)"
parent: none
covers: []
after: []
refined: false
hitl: false
risk: low
---

# Industry-neutral words in the module's own text (field, site, Field-wide and the like)

## Description

Raised by the owner on 2026-11-08 after an analyst-style read of how oil and gas specific the module is: the engine (map, editing, undo, store, contract, live state, the page's events, you-are-here, Directions) and the model (kinds from the host project, places from asset paths, instruments along lines) are industry-neutral; the surface is not. Some of that surface is the module's own built-in text rather than a project's kinds: the item list's "MESA FIELD" header and "Field-wide" group (entry 7a), "Get <project> on the map" and its help lines (entry 7b), the legend's line words ("Pipeline, weight by size"), the line popup's wording, the docs' examples. A solar project (the next demo, backlog `story-demo-solar-farm.md`) would read "field" and "pipeline" where it means a site, an array or a cable run.

Make the module's own words neutral by default ("area" or the asset folder's own name rather than "field", "site", "Area-wide" or similar, "line" rather than "pipeline" where the module speaks generically), and decide whether a project or a project type (backlog 29) may rename them. A project's kind names and labels are already its own and are not part of this.

## Notes

- Owner, 2026-11-08: the oil and gas demo (Mesa) and the solar demo are the two demos; a water demo is not needed for the open-source release's two-demo bar.
- Open question: neutral defaults only, or a small set of renamable words in the setup (and so schema 2 with the units field, epic-editing entries 19 and 20).
- Open question: whether the core icon set (prd, oil and gas kinds) gains a small generic set (valve, pump, tank, meter, station, sensor, panel, inverter) here or under backlog 29 and `story-project-supplied-icons.md`.
- A sweep of every user-visible string in `web/typescript` and the Designer form, with the docs' examples, is the first step.

## References

- epic-editing - entries 7a and 7b (the list's groups, the checklist), 19 and 20 (units and the setup's schema 2)
- backlog - story-project-types-industry-kind-libraries.md (29), story-demo-solar-farm.md, story-open-source-release-readiness.md (35)
