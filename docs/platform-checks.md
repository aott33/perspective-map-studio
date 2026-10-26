# Platform checks

The spike stories of epic-module-foundation answer the architecture's open questions on a live Ignition 8.3 Gateway (R3). Each story adds its own section here; story 9 compiles them into the go or no-go report and carries the answers into claude-ignition-skills.

Labels: **[live 8.3.10]** seen on the ops/ dev Gateway (`inductiveautomation/ignition:8.3.10`); **[client typings]** read from `@inductiveautomation/perspective-client` 2.3.10, the package matching 8.3.10; **[bundle]** read from Perspective's own `PerspectiveMap` browser bundle inside the 8.3.10 Perspective module; **[unverified]** not checked live.

## Story 4 - Project view as a popup

**Question** (architecture open questions, AD-7): can a third-party Perspective component open a project view by its path, the way the built-in Map renders a view from a `path`, passing a parameter object?

**Answer: yes.** **[live 8.3.10]** Clicking a test point on the `mapstudio-dev` view opens a MapLibre popup whose content is the project view `Popups/PointDetails`, rendered by Perspective's own `View` component with the point as its `mapItem` parameter. The view's expression bindings resolve on the Gateway (`Id: p1`, `Name: Point 1 (dev)`), so the Gateway view model is started for the embedded view with no Map Studio Java involved.

### Method

- **[bundle]** The built-in Map renders a view from a path as `<View key={PageStore.instanceKeyFor(path, mountPath)} store={store.view.page.parent} mountPath={...} resourcePath={path} params={...} parent={store} useDefaultWidth useDefaultHeight />`, for its custom controls, view layer and popup content alike. Its custom controls, rendered in a second React root inside a Leaflet control, wrap it in `ClientStoreProviderContext.Provider`.
- **[client typings]** `View`, `ViewProps`, `ViewStateType`, `PageStore` and `ClientStoreProviderContext` are public exports of `@inductiveautomation/perspective-client`; a component store reaches the client store through `store.view.page.parent` and its own mount path through `store.viewMountPath` and `store.addressPathString`. Embr Periscope (open source, `modules/periscope/web/src/components/embedding/swiper.tsx`) uses the same element the same way.
- Map Studio (`web/typescript/PointPopup.tsx`, `web/typescript/MapStudio.tsx`) mounts `View` with `resourcePath` from the `popupView.path` prop, mount path `<viewMountPath>$<addressPath>[popup]`, `params = {...popupView.params, mapItem: {id, name}}` and the component store as `parent`. The content is a MapLibre `Popup` DOM node filled through `ReactDOM.createPortal`, so the view stays inside the component's React tree and Perspective's contexts reach it without a second root.
- The dev view sets `popupView.path = "Popups/PointDetails"` and `popupView.params = {"source": "dev"}`; `Popups/PointDetails` has input params `mapItem` and `source` and labels bound by expression to `{view.params.mapItem.id}`, `{view.params.mapItem.name}` and `{view.params.source}`.

### Results

All on the ops/ dev Gateway (`ms-s4`, port 9104, image 8.3.10, module 0.1.0 unsigned), 2026-10-26, headless Chromium through Playwright. **[live 8.3.10]**

| Check | Seen |
| --- | --- |
| Click p1 at 1440 px and at 390 px | A popup anchored at p1 renders `Popups/PointDetails`: `Point details / Id: p1 / Name: Point 1 (dev)`; the Gateway reply text still shows; no console error or page error. Screenshots `docs/screenshots/mapstudio-dev-1440.png` and `mapstudio-dev-390.png` (popup narrower than the phone). |
| Bindings resolve on the Gateway | The labels are expression bindings on `{view.params.mapItem.id}`, `{view.params.mapItem.name}` and `{view.params.source}`, evaluated by the Gateway view model; `source` is the author's param `dev`, so both the author params and `mapItem` arrive. |
| Click p2 while the popup is open | The popup moves to p2 and the view shows `Id: p2 / Name: Point 2 (dev)`; one `.maplibregl-popup` in the DOM. Delegate log: `point.click ... for point p1` then `for point p2`. |
| Close button | The popup node and the view are removed from the DOM (zero `.mapstudio-popup` nodes); the session stays connected. The view store's `shutdown` sends `view-stop` to the Gateway **[client typings]**; the Gateway side of the stop was not read from a log line **[unverified]**. |
| Gateway log | No Map Studio or Perspective error across the runs (`E [` count 0 after the last restart); only the usual trial-mode and keystore warnings. |

One defect was found and fixed during the run: with MapLibre's `closeOnClick`, a click on a second point moved the popup and then MapLibre's own map-click handler closed it, because that handler runs after the layer click handler. Map Studio now closes the popup itself on a map click that hits no point (`queryRenderedFeatures` on the points layer).

### Fallback behaviour

**[live 8.3.10]**

- `popupView.path = "Popups/Nope"` (a view that does not exist): the popup first shows Perspective's own loading state, then `View` reports state `error` through `onViewStateChange` (not `notFound`, which the typings also list), and Map Studio swaps to the text popup `p1 - Point 1` with one console warning: `[MapStudio] Popup view "Popups/Nope" cannot be shown (error); showing the text popup instead.` No console error, no Gateway error.
- `popupView.path = ""`: the text popup `p1 - Point 1` opens at once, no `View` is mounted and nothing is logged.
- `access-denied` was not provoked (the dev project has no view permissions) **[unverified]**; the handler treats it like `error`.

### What story 9 should carry into claude-ignition-skills

- A third-party Perspective component renders a project view by path with the public `View` component from `@inductiveautomation/perspective-client` (`store`, `resourcePath`, `mountPath`, `params`, `parent`, `key` from `PageStore.instanceKeyFor`); the view model starts through Perspective's own `view-start` message, so no Gateway code is needed. **[live 8.3.10]**
- Content rendered through `ReactDOM.createPortal` keeps Perspective's React context; a second React root (the built-in Map's custom controls) needs `ClientStoreProviderContext.Provider`. **[bundle]**, portal path **[live 8.3.10]**
- `View` reports `notFound`, `error` and `access-denied` through `onViewStateChange`; a component can fall back on them. A missing view reported `error` in 8.3.10, so a fallback must treat every failed state alike, not `notFound` alone. **[live 8.3.10]**
- The `View` typings target `@types/react` 18 while a module built on the 16.14 typings needs one cast (`View as unknown as React.ComponentClass<ViewProps>`) **[client typings]**; the cast element rendered the view at runtime, where React is the one the Perspective client loads **[live 8.3.10]**.
