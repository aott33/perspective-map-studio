---
title: Map Studio for Ignition Perspective - product brief
status: final
created: 2026-10-25
updated: 2026-10-25
---

# Product Brief: Map Studio for Ignition Perspective

## Executive summary

Map Studio is an open-source Ignition 8.3 Perspective component: the project's map, showing each site's live state, with tools to build and edit the map in the browser for those allowed to. Ignition's built-in Map shows places but offers no way to change them except editing props, so every project that needs a usable map editor builds one around it or buys one: packaged Perspective projects sell to integrators for about 25,000 USD.

Map Studio puts editing on the map itself, links every item to the project's assets and tags, and shows comms, a key value and details in a popup, in a modern, minimal UI. Its first user is the owner's oil and gas template, where it replaces a working but cobbled-together editor. It is built to be open-sourced once proven there, and to show flow on the same map later.

## The problem

Ignition's built-in Perspective Map shows places, but it is hard to change them. Adding a site, moving a pin or redrawing a pipeline means editing arrays of props in the Designer, or building a custom editor around the map. The map has no drawing tools of its own: no snapping, no dragging a vertex, no drawing an area. It is built on Leaflet and resists styling.

The oil and gas template shows the cost. It built its own editor on the built-in Map: a sound draft, change set and review path, resting on a weak drawing layer. That layer has five actions and makes one Gateway call per vertex. It cannot draw areas, delete a site or edit below 768 px, and it needs a run of workarounds against the component (listed in the addendum). It works, and it looks cobbled together.

Today's alternatives are a packaged Perspective project, such as Nader Chinichian's Map Administration Tool, or building one in-house, as the template did.

## The solution

Map Studio is a Perspective component module (`ao.mapstudio`): the project's map view, with role-gated editing tools. Everyone sees the configured map; each icon shows comms status and one key value, and a click opens a popup with details, values and an optional link to a page. Admins and integrators also see the Map Studio tools. It uses an open-source map stack (MapLibre GL JS, with deck.gl for display), styled by the host project's theme tokens.

With the tools, people draw and edit on the map itself: drop a point, draw a line or an area vertex by vertex, drag a vertex, snap to existing sites, select many items and change their properties together, and import files. Each item links to an asset in the project, and its icon and popup are bound to that asset's tags. Map Studio saves the map as you work to a database the project names, and that database is the map's source of truth; the project supplies its assets through a published contract.

**What makes it different:**

- **Open source and free**, where the alternative is a packaged project sold for about 25,000 USD.
- **Editing on the map itself**, as a component, where the built-in Map and tools built only in Perspective edit through props, forms and Gateway round trips.

These are advantages of execution, not a moat: anyone with the same toolchain could build it.

## Who this serves

- **Admins**, the primary users. They keep a running system's map right (a new pad, a rerouted line, a geofence) and also build a new system's map from nothing, in the browser. They might never touch a CSV or a script, so the editor alone has to be enough to lay out a whole field.
- **Integrators** provisioning a project. Most of a field arrives by script or CSV import; they need to correct, extend and bulk-edit it on the map without touching props.
- **Operators**, occasionally, on a phone: they move a pin that is in the wrong place or correct an item's properties.

## Success criteria

The first version is done when all four criteria hold. The target is the end of January 2027; it is a target, not a deadline.

1. **It replaces the template's map pages.** The template's map and map editing run on Map Studio, the Leaflet map and its drawing layer are gone, and the map lives in Map Studio's database instead of the git registry.
2. **An admin builds a field from nothing in 30 minutes.** An admin who has not seen the Mesa demo field (the template's sample field) lays it out (sites, pipelines split at taps, one geofence) with the editor alone, without help, in under 30 minutes.
3. **A point moves and its properties change on a phone.** At 390 px, touch only, a pin is moved and a property edited, and both edits reach the page.
4. **The demo field sets the scale.** Editing on the demo field stays responsive; 300 sites and 2,000 segments are a later target.

Open-source readiness, meaning a stranger can install it from the README, comes after the owner has validated it in the template.

## First step: the spike

Before any feature work, spend one to two days building a blank component module and getting a MapLibre canvas onto a Perspective view on a live 8.3 Gateway, with one edit sent back to the page as an event. The spike also checks that alarm counts aggregate on tag folders and UDT instances, which the alarm features depend on.

- **Go** when the module builds and runs within two days and the round trip (props in, event out) works.
- **No-go** when the toolchain or the Perspective client API takes most of the two days. Then the answer is a better editor page on the built-in Map, and this brief records why.

## Scope

**First version: the map and its editor.**

- Draw and edit points, lines (pipelines, routes) and areas (geofences, regions): add, move, delete, drag and insert vertices, snap to sites and vertices, undo.
- Fast entry for building a field by hand, and bulk editing of shared properties across selected items.
- Viewing for every role: icons with comms status and one key value, and popups with details, values and an optional link to a page.
- Search for map items by name, with zoom to the chosen one.
- Linking each item to a project asset and binding its icon and popup to tag paths, with a tag browser.
- Import of CSV, KML and GeoJSON, with features matched to existing assets, and a downloadable CSV template.
- Saving as you work to a database the project names, so leaving halfway loses nothing.
- On phones: view, move a point, and edit an item's properties. Drawing stays on larger screens.
- Supporting: object kinds from a list the host supplies (form fields and an icon per kind), a small core icon set in one minimalist style for oil and gas objects, and the basemaps the template already uses (none, OpenStreetMap, Mapbox).

**Later, each its own decision:** flow animation (direction and rate along lines); the full icon library and other industries' kinds; a time slider replaying history; clustering; offline basemap tiles; a second renderer.

**Out:** an approval workflow for edits; any write to a device; replacing the alarm table; Edge Gateways (built-in components only there).

## Design principles

The editor follows map editing practice, ISA-101 and WCAG 2.2. The ranked list and sources are in the addendum.

- **One clear mode at a time.** A persistent toolbar names the mode in words and a glyph, and Esc always returns to Select.
- **Editing is local and fast, and every edit can be undone.** The map updates in the browser as the user works. Nothing goes to the Gateway until an edit is finished. Undo covers deletes, so deleting needs no confirmation dialog.
- **No drag-only actions.** Every drag has a tap or typed alternative (WCAG 2.5.7).
- **Grey is normal.** Colour is for problems only. State and selection are shown with words, glyphs and rings, at 3:1 contrast in both themes.
- **A first-run path.** An empty state offers "Draw your first site" and "Import CSV", with a short, skippable tour.

## Key risks

- **Toolchain weight:** the build needs Java 17, Gradle with Inductive Automation's module plugin, Node and module signing, and one person has to keep it all working. The spike tests this first.
- **Perspective client coupling:** the client bundle (the browser-side code) compiles against Inductive Automation's Perspective client packages, so an 8.3.x upgrade can break it.
- **Alarm presentation:** icons and colours that change with a value's set point are alarm presentation and need the template's engineering review.
- **Basemap privacy:** map tiles are requested from outside the customer's network, and Mapbox needs a token that every viewer's browser can read.

## Vision

If the first version proves itself in the template, Map Studio becomes the open-source map component for Ignition Perspective, published for other projects and extended with the items under "Later", starting with flow on the map. Success in two to three years means integrators reach for it before the built-in Map, and the owner is known for it.

## Open questions

- Which licence should the module use when it is open-sourced (MIT, as `docs/idea.md` proposed, or another)?
- Should the repository be renamed from `perspective-flowmap` to match Map Studio?
