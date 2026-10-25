---
title: Map Studio for Ignition Perspective - product brief
status: draft
created: 2026-10-25
updated: 2026-10-25
---

# Product Brief: Map Studio for Ignition Perspective

## Executive Summary

Map Studio is an open-source Ignition 8.3 Perspective component for drawing and editing maps in the browser. Ignition's built-in Map shows places but offers no way to change them except editing props, so every project that needs a usable map editor builds one around it or buys one: packaged Perspective projects sell to integrators for about 25,000 USD.

Map Studio puts the editing on the map itself: points, lines and areas drawn, dragged and snapped in place, many items edited at once, a point moved on a phone, in a modern and minimal UI on the host project's theme. It stores nothing; every edit goes to the page as an event, and the host project decides what it means. Its first user is the owner's oil and gas template, where it replaces a working but cobbled-together editor and keeps the template's review path to the registry. It is built to be open-sourced once proven there, and to show flow on the same map later.

## The Problem

Ignition's built-in Perspective Map shows places, but it is hard to change them. Adding a site, moving a pin or redrawing a pipeline means editing arrays of props in the Designer, or building a custom editor around the map. The map has no drawing tools of its own: no snapping, no dragging a vertex, no drawing an area. It is built on Leaflet and resists styling. It also cannot show flow: no animation, no styling along a line, no hover.

The upstream oil and gas template shows the cost. It built its own editor on the built-in Map: a draft, change set and review path that is sound, under a drawing layer that is not. That layer offers five actions (add, move a site; add, redraw, retire a pipeline), one tap per vertex with a Gateway call to snap each one, no areas, no deleting a site, and no editing below 768 px. Its own docs record a run of workarounds against the component: a marker without a popup crashes it, styles never reach the map container, and floating panels need CSS fixes to size. It works, and it looks cobbled together.

Integrators who want better today buy a packaged Perspective project, such as Nader Chinichian's Map Administration Tool (an admin project plus an end-user project with icons, styles and widgets, sold to integrators; about 25,000 USD by the owner's account). Or they build their own, as the template did.

## The Solution

Map Studio is a Perspective component module (`ao.mapstudio`) that draws a map and lets people edit it in place. A view places it, binds what to show, and handles what comes back, as it would any Perspective component. It draws on an open-source map stack (MapLibre GL JS, with deck.gl for display) and looks modern, minimal and clean, styled by the host project's theme tokens.

People draw and edit on the map itself: drop a point, draw a line or an area vertex by vertex, drag a vertex, snap to existing sites, select many items and change their properties together, import a CSV. Every change goes back to the page as an event; the module stores nothing. The host project decides what an edit means. In the template, edits feed the existing draft, change set and `prov` review path, so the registry in git stays the authority. Another project could write edits straight to its own database.

## Who This Serves

- **Admins**, the primary user. They keep a running system's map right (a new pad, a rerouted line, a geofence) and also build a new system's map from nothing, in the browser. They may never touch a CSV or a script: the editor alone has to be enough to lay out a whole field.
- **Integrators** provisioning a project. Most of a field arrives by script or CSV import; they need to correct, extend and bulk-edit it on the map without touching props.
- **Operators**, occasionally, on a phone: move a pin that is in the wrong place. Nothing more.
- **First and only confirmed user:** the owner's own `ign-scada-template`. Other projects come later, when the module is open-sourced; it is built for that day but not released for it.

## Success Criteria

The first version is done when all of these hold. The target is the end of January 2027 (three months at two days a week, about 26 working days); it is a target, not a deadline, and work continues until the criteria hold rather than cutting scope to meet the date.

1. **It replaces the template's `/map/edit`.** The template's map editing runs on Map Studio, the Leaflet drawing layer is gone, and the draft, change set and `prov` path work unchanged.
2. **An admin builds a field from nothing in 30 minutes.** The Mesa demo field (its sites, its pipelines split at taps, one geofence) laid out with the editor alone, no CSV and no script, in under 30 minutes, without help. Tested by an admin who has not seen the Mesa field.
3. **A point moves on a phone.** At 390 px, touch only, a pin is moved and the edit reaches the page.
4. **The demo field is the scale.** Smooth on the demo field; 300 sites and 2,000 segments are a later target.

Open-source readiness (a stranger installs it from the README) comes after the owner has validated it in the template.

## What Makes This Different

- **Open source and free** where the alternative is a packaged project sold for about 25,000 USD.
- **Editing on the map itself**, as a component, where the built-in Map and Perspective-only tools edit through props, forms and Gateway round trips.
- **Storage stays with the host.** Edits are events, so a project keeps its own authority (in the template, git and `prov` review). Honest limit: this is execution, not a moat; anyone with the same toolchain could build it.

## Design Principles

From map editing and map UI practice (detail and sources in the addendum):

- **One clear mode at a time.** A persistent toolbar names the mode in words and a glyph; Esc always returns to Select.
- **Editing is local and fast.** Every pointer move updates the map in the browser; nothing goes to the Gateway until an edit is finished.
- **Every edit can be undone.** Undo and redo cover moves, vertex changes, deletes and property edits, so deleting needs no confirm dialogs.
- **Drawing tells you where you are.** Vertex and midpoint handles on the selected item, a visible snap indicator, validation messages while drawing, and finish by double-click, Enter or a Finish button.
- **No drag-only actions.** Every drag has a tap or typed alternative (WCAG 2.2, 2.5.7): Move then tap the destination, coordinate fields, click to insert a vertex.
- **Grey is normal.** Items are neutral; colour is for problems only; state and selection carry words, glyphs and rings, at 3:1 contrast in both themes (ISA-101, WCAG 1.4.11).
- **A first-run path.** An empty state that offers "Draw your first site" and "Import CSV", and a short skippable tour of point, line and area.
- **Phone moves are safe.** 44 px targets, long-press to pick up, the point drawn above the finger, and an Undo bar after the drop.

## Scope

**First version: the editor.**

- Draw and edit points, lines (pipelines, routes) and areas (geofences, regions): add, move, delete, drag and insert vertices, snap to sites and vertices, undo.
- Fast entry for building a field by hand: duplicate an item, add another like the last, keyboard shortcuts on a laptop.
- Select many items and edit their shared properties at once.
- CSV import of points; the template's GeoJSON import stays in `prov`.
- Every edit sent to the page as an event. No storage in the module.
- Object kinds from a list the host supplies (fields and icon per kind), so new kinds need no module change.
- A small core icon set in one minimalist style for the oil and gas objects.
- Modern, minimal editor UI on the host's theme tokens; state shown by words and glyphs, never colour alone.
- Phones: view, and move a point. Drawing and forms on larger screens.
- Basemaps the template already uses: none, OpenStreetMap, Mapbox.

**Later, each its own decision:** flow animation (direction and rate along lines); the full icon library and other industries' kinds; a time slider replaying history; clustering; offline basemap tiles; a second renderer.

**Out:** storing or approving edits (the host's job); any write to a device; replacing the alarm table; Edge Gateways (built-in components only there).

## First Step: the Spike

One to two days of work, before any feature: build a blank Perspective component module from an existing open-source one (Mustry's, with Inductive Automation's module starter), get a MapLibre canvas drawing a few sites and one line on a Perspective view on a live 8.3 Gateway, and send one edit back to the page as an event.

- **Go** when the module builds and runs within the two days and the round trip (props in, event out) works.
- **No-go** when the toolchain or the Perspective client API takes most of the time. Then the answer is a better editor page on the built-in Map, and this brief records why.

## Vision

If the first version proves itself in the template, Map Studio becomes the open-source map component for Ignition Perspective: published for other projects once validated, then extended with what the original idea started from, flow on the map (direction and rate along lines, animated), a full minimalist icon library for oil and gas, water, power, gas distribution and fleets, and a time slider replaying history. Success in two to three years is integrators reaching for it before the built-in Map, and the owner known for it.

## Open Questions

- The module's licence when it is open-sourced (MIT, as the idea doc proposed, or another).
- Renaming the repository from `perspective-flowmap` to match Map Studio.
