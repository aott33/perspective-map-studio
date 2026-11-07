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
