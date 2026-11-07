# Feature review, 2026-11-07

Features a map component for Perspective could offer that Map Studio does not have or plan, ranked, with where each went. The owner chose on 2026-11-07 ("I'm good with your recommendations"). Only the features are recorded here.

Map Studio's core (the map store, editing in the browser with roles, Undo and Recent changes, kinds and assets, live values in one batch, alarms, comms and stale states, Needs you, the legend, import and export, the place check, instruments on lines) has no counterpart in this review; the gaps are in display, camera control and the page's scripting.

| # | Feature | Where it went |
| --- | --- | --- |
| 1 | Camera control from the page: fly to a point, fit bounds, zoom, read the bounds from a script | Backlog story 31 (`story-camera-control-from-the-page.md`), with item 6's map-ready event |
| 2 | Filter the map's items in View mode by kind, state or property, from a control or the page | Backlog story 32 (`story-filter-the-maps-items-in-view-mode.md`) |
| 3 | A heatmap display mode beside clustering | A note on the clustering story |
| 4 | Georeferenced image overlays (plot plans, site drawings) and WMS tile endpoints | Notes on the reference layers and custom tile source stories |
| 5 | Moving items that glide to a new position and rotate by heading | A note on epic-live-field |
| 6 | A map-ready event, and the selection of several sent to the page | The event in story 31; the selection a note on epic 4 entry 8 |
| 7 | Tens of thousands of items | Backlog story 33 (`story-scale-to-tens-of-thousands-of-items.md`), after 0.4.0's performance run |
| 8 | A right-click menu on items | Backlog story 34 (`story-context-menu-on-map-items.md`), low |
| 9 | Perspective views drawn as markers on the map | Left out: it works against the neutral ISA-101 look and costs performance; views stay in popups (R39) |
| 10 | 3D (globe, terrain, pitch, models), camera fly-through tours, running arbitrary JavaScript from scripts | Left out: 3D was left out on 2026-11-03 as cosmetic for an operator map; arbitrary JavaScript from a script is a security hole the module will not offer |

## Addendum, the same day

A second look at the same kind of component (its full component contract and scripting recipes) added these; the owner took the recommendations ("I'm good with your recommendations").

| # | Feature | Where it went |
| --- | --- | --- |
| A | An AI guide: one Markdown file for an AI assistant with the exact props, events and scripting API, starter views and recipes, its examples checked in CI | A decision on backlog story 27 (the docs) |
| B | A click on empty ground sent to the page with its coordinates | Backlog story 31 |
| C | A right-click event sent to the page with the item, before a built-in menu | A note on backlog story 34 |
| D | A filter set from a script; a search across reference-layer shapes | Notes on backlog story 32 and the reference layers story |
| E | Very large collections loaded from a URL in pages | A note on backlog story 33 |
| F | Camera commands as component methods a script calls | A decision on backlog story 31 |
| G | Camera events during a move (move, zoom, drag, pitch, rotate) | Left out: the page gets one event at the end of each move, never per frame (R37) |

