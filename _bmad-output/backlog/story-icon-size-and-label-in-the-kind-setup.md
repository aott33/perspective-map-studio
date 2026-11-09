---
id: 38
type: story
title: "Icon, size and label in the kind setup and as per-item overrides"
parent: none
covers: []
after: []
refined: false
hitl: false
risk: medium
---

# Icon, size and label in the kind setup and as per-item overrides

## Description

Split out of epic 4 entry 12 by the owner (2026-11-09, "go with recommended"): the Kinds screen's Icon section and the Style tab's icon, size and label (DESIGN.md, EXPERIENCE.md) have no place in the kind setup today. A setup's parts are exactly `comms, kpis, alarms, link, popupView, styleRule, areaTints` (`common/.../contract/KindSetup.java`), a kind's icon comes read-only from the asset adapter, and `docs/kind-setup.md` "Item checks" says "icon, size and label overrides come with epic-editing". Entries 12a and 12c show them read-only.

Making them editable needs new setup and override parts in `KindSetup.PARTS` and `KindDisplay`, the contract and `docs/kind-setup.md`, the marker drawing in `web/typescript/markers.ts` and `features.ts`, and the Kinds screen's and Style tab's rows. A contract change, so it rides a release that can carry one.
