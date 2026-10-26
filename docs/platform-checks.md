# Platform checks

The spike's platform questions (epic-module-foundation R3), each answered on a live Ignition 8.3.10 Gateway with its evidence and the fallback taken where it failed. One section per spike story; a story edits only its own section. Story 9 compiles these into the go or no-go report and carries the answers into claude-ignition-skills.

Labels: **[live 8.3.10]** seen on the `ops/` dev Gateway (`inductiveautomation/ignition:8.3.10`); **[build]** seen in this repository's build or tests; **[npm metadata]** read from the package registry; **[client typings]** read from `@inductiveautomation/perspective-client` 2.3.10, the package matching 8.3.10; **[bundle]** read from Perspective's own `PerspectiveMap` browser bundle inside the 8.3.10 Perspective module; **[unverified]** not checked here.

## Story 2 - MapLibre 6 and Terra Draw

**Question (architecture open question, Stack table):** does the Perspective toolchain (React 16.14, TypeScript 4.9, webpack 5) build and run maplibre-gl 6.16.0 with terra-draw and its MapLibre adapter?

**Answer:** yes, at the versions pinned below; no fallback was needed. Date: 2026-10-26.

| Package | Pinned | Reason |
| --- | --- | --- |
| `maplibre-gl` | 6.16.0 | The architecture's first choice built, bundled and ran; no step down was needed. |
| `terra-draw` | 1.38.0 | Newest release at the time; type-checks under TypeScript 4.9.5 and runs on the adapter. |
| `terra-draw-maplibre-gl-adapter` | 1.5.0 | Newest release; peers `terra-draw ^1.0.0`, `maplibre-gl >=4` **[npm metadata]**. |

Attempts, in order:

1. `maplibre-gl` 6.16.0 + `terra-draw` 1.38.0 + adapter 1.5.0 under TypeScript 4.9.5, webpack 5.101.3, React 16.14 externals **[build]**: `tsc --noEmit` clean, Jest 16 of 16, `./gradlew build` successful in 1 m 43 s on a warm cache, no webpack warning from either package (MapLibre's own "Critical dependency" warning stays ignored as in story 1). No failure, so no second attempt.

Facts that shaped the code:

- Both Terra Draw packages ship ESM (`exports.default` is `*.modern.js`) and a `.cjs` for `require` **[npm metadata]**; webpack 5 takes the ESM build and Jest's commonjs config (`tsconfig.test.json`) the `.cjs`, with no extra configuration **[build]**.
- Their `.d.ts` files use no TypeScript 5 syntax; `skipLibCheck: true` stays as in story 1 **[build]**.
- The adapter reads MapLibre's `map.version` getter and enables dash arrays only on MapLibre 5.8.0 or later **[npm metadata]**; the dashed style is not used by the line tool yet, so this branch is **[unverified]**.
- Terra Draw styles take hex colours only (`HexColor`), and its defaults are colour literals (`#3f97e0`, `#ffffff`). The component converts the theme tokens' computed values to hex (`web/typescript/theme.ts`, `toHexColor`, `drawColor`) and sets every style key the line tool draws, so AD-11 holds; a token that does not resolve leaves that key to the library default and logs one warning.
- Terra Draw owns the map's clicks while a drawing mode is on. The component keeps Terra Draw in `static` mode and enters `linestring` only from the "Draw a line" toggle; the story 1 point click is ignored while drawing.
- Terra Draw's adapter adds its own `td-*` GeoJSON sources and layers above the component's layers; the story 1 layers were not changed.

Measures:

| Measure | Story 1 (baseline `0fba47c`) | Story 2 | Delta |
| --- | --- | --- | --- |
| `MapStudio.js` (production, minified) | 1,065,187 bytes | 1,167,572 bytes | +102,385 bytes (+9.6 %) |
| `MapStudio.css` | 70,494 bytes | 70,976 bytes | +482 bytes |
| `maplibre-gl-worker.js` | 517,065 bytes | 517,065 bytes | 0 |
| `Map-Studio.unsigned.modl` | 456,998 bytes (the main checkout's story 1 build, read only) | 482,316 bytes | +25,318 bytes |

The baseline was measured by building the story 1 `web/` folder from commit `0fba47c` with the same webpack settings, outside the repository.

Live run **[live 8.3.10]** (dev Gateway `ms-s2`, fresh volume, module accepted unattended): the Gateway log shows the module starting and the component registering with no Map Studio warning or error. `node ops/screenshot.mjs` at 1440 x 900 and 390 x 844: the point click reply arrived, a one-vertex drawing cancelled with Escape left the tool off with nothing drawn, and a two-vertex line finished with Enter gave "Line drawn with 2 points"; no browser console error or page error in either viewport (the script fails on one). The toggle, the Escape cancel and the finished line were seen through the DOM attributes the component sets (`data-drawing`, `data-line-points`, `aria-pressed`) and in the screenshots.

Evidence: `docs/screenshots/mapstudio-dev-1440.png` and `docs/screenshots/mapstudio-dev-390.png` (point click reply and one line drawn with Terra Draw), written by `node ops/screenshot.mjs`, which fails on any browser console error.

Not covered here (later stories): frame rate, value batch size and phone breakage (story 7); saving, undo, snapping, select and edit modes (epic-editing).

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
