---
title: Flow Map module for Ignition Perspective - product brief
status: draft
created: 2026-10-25
updated: 2026-10-25
---

# Product Brief: Flow Map for Ignition Perspective

## The Problem

Ignition's built-in Perspective Map shows places, but it is hard to change them. Adding a site, moving a pin or redrawing a pipeline means editing arrays of props in the Designer, or building a custom editor around the map. The map has no drawing tools of its own: no snapping, no dragging a vertex, no drawing an area. It is built on Leaflet and resists styling. It also cannot show flow: no animation, no styling along a line, no hover.

The upstream oil and gas template shows the cost. It built its own editor on the built-in Map: a draft, change set and review path that is sound, under a drawing layer that is not. That layer offers five actions (add, move a site; add, redraw, retire a pipeline), one tap per vertex with a Gateway call to snap each one, no areas, no deleting a site, and no editing below 768 px. Its own docs record a run of workarounds against the component: a marker without a popup crashes it, styles never reach the map container, and floating panels need CSS fixes to size. It works, and it looks cobbled together.

Integrators who want better today buy a packaged Perspective project, such as Nader Chinichian's Map Administration Tool (an admin project plus an end-user project with icons, styles and widgets, sold to integrators; about 25,000 USD by the owner's account). Or they build their own, as the template did.

## Who This Serves

- **Integrators** building or provisioning a project. Most of a field arrives by script or CSV import; they need to correct, extend and bulk-edit it on the map without touching props.
- **Admins** keeping a running system's map right in the browser: a new pad, a rerouted line, a geofence.
- **Operators**, occasionally, on a phone: move a pin that is in the wrong place. Nothing more.
- **First and only confirmed user:** the owner's own `ign-scada-template`. Other projects come later, when the module is open-sourced; it is built for that day but not released for it.
