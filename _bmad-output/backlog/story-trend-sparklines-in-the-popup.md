---
id: 17
type: story
title: "Trend sparklines in the popup: 24 hours per KPI from the historian, loaded on open"
parent: none
covers: []
after: []
refined: false
hitl: true
risk: medium
---

# Trend sparklines in the popup

## Description

Each KPI row of the default popup gains a small sparkline of the last 24 hours (a setup choice per kind, off by default), so an operator sees whether a pressure is falling before opening the site's page. From the gap review of 2026-11-03 (item 7): AVEVA PI Integrator popups carry trends; WellDatabase and OFM show them per well. The Gateway reads the KPI's history with `system.historian.queryAggregatedPoints` (one aggregate per 15 minutes, 96 points) only when a popup opens (`popup.open`) and only for KPIs whose tags are historised, sent once in the popup's values; a KPI with no history shows no line and no error. The sparkline is a single neutral stroke with no axis, the current value already in the row, in the theme's text token; the stale and style states stay on the value, never on the line.

## Requirements

- Verify: when it is scheduled, with the dev stack's historian holding a day of a pad's pressure, opening the pad's popup draws the sparkline for that KPI within a second and nothing for a KPI with no history; the historian is queried only on `popup.open` and never while a popup is closed (checked in the Gateway log at debug level); the popup's width and the phone's bottom sheet are unchanged at 390 px; the line passes the 3:1 contrast check in both themes.

## References

- gap review - _bmad-output/initiative-flowmap/gap-review-2026-11-03.md, item 7 (AVEVA PI Integrator for Esri, WellDatabase, SLB OFM)
- initiative - R6 (the default popup and its KPIs, live while open), Constraints (prd NFR-2: popups are live while open, nothing read while closed)
- architecture - AD-6 (live values), AD-7 (the popup)
- platform - the project's CLAUDE.md "History" rule: `system.historian.*`, not the deprecated `system.tag.queryTagHistory` family

## Notes

- Decision: 2026-11-03 Owner (gap review, "agree, write up the gap review as recommended"): in the backlog, after 0.3.0.
- Constraint: one historian query per open popup, at most one per KPI; a popup kept open re-queries on its own interval (a candidate: every 5 minutes), never per values push.
- Open question: whether the kind setup names the window (24 hours) and the aggregate, or Map Studio fixes both at first.
- Open question: a custom popup view (R39) gets the history too, as a `history` field on `mapItem`, or not at all.
