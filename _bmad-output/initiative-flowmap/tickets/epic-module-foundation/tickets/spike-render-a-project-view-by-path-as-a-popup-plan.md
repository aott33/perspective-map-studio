---
title: 'Render a project view by path as a popup'
type: 'feature'
ticket: '4'
created: '2026-10-26'
status: 'draft'
baseline_revision: '0fba47cdb46cd4c75b7c24055d7b1489d41f834c'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** AD-7 lets a project name a custom popup view by its path, rendered the way the built-in Perspective Map renders a view from a `path`; the architecture lists it as an open question whether a third-party component can do that in 8.3. The spike answers it on the live dev Gateway.

**Approach:** Clicking a test point opens a MapLibre popup anchored to the point whose content is Perspective's own `View` component (exported by `@inductiveautomation/perspective-client`, the same element the built-in Map's custom controls and view layer render), given the project view path and params from a new component prop and the point's record as the `mapItem` parameter. The result and its evidence go into `docs/platform-checks.md`.

## Boundaries & Constraints

**Always:** Render the view with the `View` component from `@inductiveautomation/perspective-client` (`store`, `resourcePath`, `mountPath`, `params`, `parent`, `key` from `PageStore.instanceKeyFor`), never by iframe, a second session or copying view JSON; the prop shape mirrors the built-in Map's (`path` with format `view-path`, `params` object); the view's parameter is one object named `mapItem` (AD-7) carrying the point's `id` and `name`, with the author's `params` merged beside it; a missing or failing view (state `notFound`, `error`, `access-denied`) falls back to a text popup that still shows the point id, and is logged at warn with the path; closing the popup unmounts the view so its Gateway view model stops; theme tokens only, no colour literals, no em dashes; closed props schema (`additionalProperties: false`); the dev Gateway runs as `MAPSTUDIO_CONTAINER=ms-s4` on `GATEWAY_HTTP_PORT=9104` from the worktree's `.env`.

**Never:** no Gateway Java change (the view model starts through Perspective's own `view-start` message); no `popup.open` or `popup.close` messages, no live value push, no default popup from a kind setup, no kind setup at all (later epics); no change to `ign-scada-template` or `claude-ignition-skills` (story 9 records the platform answers there); no Terra Draw, basemaps, CI or signing; no Embr code copied (its `JoinableView` override is not needed here).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Custom view | `popupView.path = "Popups/PointDetails"`, click on p1 | Popup anchored at p1 renders the view; the view's label shows `p1` from `{view.params.mapItem.id}`; Gateway log shows no Map Studio or Perspective error | No error expected |
| Author params | `popupView.params = {"source": "dev"}` | The view receives `{source: "dev", mapItem: {id, name}}`; `mapItem` wins over an author key of the same name | No error expected |
| No path | `popupView.path = ""` | Text popup with the point id and name; no `View` mounted | Nothing logged |
| Missing view | `popupView.path = "Popups/Nope"` | `View` reports `notFound`; the popup swaps to the text fallback with the point id | One warn in the browser console naming the path |
| Another point | Popup open on p1, click p2 | Popup moves to p2, the view is remounted with `mapItem.id = "p2"` (new `key`) | No error expected |
| Close | Close button or map click | Popup removed, `View` unmounted (its `componentWillUnmount` stops the view store); the session stays healthy | No error expected |

</frozen-after-approval>

## Code Map

Evidence from the 8.3.10 runtime (`@inductiveautomation/perspective-client` 2.3.10 typings in `web/node_modules/.../build/dist/typedefs`, and `PerspectiveMap.*.js` inside the Perspective module's `app-3.3.10.jar`): the built-in Map renders a view as `<View key={PageStore.instanceKeyFor(path, mountPath)} store={store.view.page.parent} mountPath={mountPath} resourcePath={path} params={params} parent={store} outputListener={...} useDefaultWidth useDefaultHeight />`, with mount path `${store.viewMountPath}$${store.addressPathString}[${i}]`. Its custom controls, which live in a separate React root, wrap it in `ClientStoreProviderContext.Provider value={clientStore}`; content rendered through `ReactDOM.createPortal` keeps the component's React context, so no provider is needed. Embr Periscope (`/home/user/mussonindustrial/embr/modules/periscope/web/src/components/embedding/swiper.tsx`, read only) uses the same element the same way.

- `web/node_modules/@inductiveautomation/perspective-client/build/dist/typedefs/app/View.d.ts` -- `ViewProps` (`store: ClientStore`, `resourcePath`, `mountPath`, `parent?`, `params?`, `outputListener?`, `useDefaultWidth?`, `useDefaultHeight?`, `rootStyle?`, `onViewStateChange?(state)`) and `ViewStateType` (`notFound`, `notSpecified`, `loading`, `error`, `access-denied`, `valid`). `View` and `ViewStateType` are exported from `perspective-client.d.ts` line 72; `ClientStoreProviderContext` line 27; `ViewStateDisplay` line 53. The typings are written against `@types/react` 18 while the bundle compiles with `@types/react` 16.14: if `<View>` fails to type check, alias it once (`const PView = View as unknown as React.ComponentClass<ViewProps>`), the same trick story 1 used for `PComponent`.
- `.../typedefs/stores/ComponentStore.d.ts` -- `store.view` (ViewStore), `store.viewMountPath`, `store.addressPathString`, `store.element`; `.../stores/PageStore.d.ts` -- `parent: ClientStore`, `static instanceKeyFor(resourcePath, mountPath)`; `.../props/PropertyTree.d.ts` -- `readString(path, default)`, `readObject(path, default)` for the props reducer.
- `web/typescript/MapStudio.tsx` -- the component: `MapStudioProps` (empty today), `MapStudioMeta.getPropsReducer` (returns `{}`), `onPointClick` (sends `point.click`; the popup opens from the same handler), `componentWillUnmount` (`map.remove()`), `render()` (root div, `.mapstudio-map`, `.mapstudio-reply`). Keep the round trip and the reply text as they are.
- `web/typescript/testData.ts` -- `TEST_POINTS` features carry `properties.id` and `properties.name`, the source of `mapItem`.
- `web/typescript/mapstudio.css` -- token-only styles; MapLibre's `.maplibregl-popup-content` ships a white background and shadow that must be overridden with `--container`, `--border`, `--label`.
- `common/src/main/resources/mapstudio.props.json` -- closed schema with `style` only; add `popupView`. The Map's schema for the same thing (`perspective-map.components.json` in the Perspective common jar): `path` `{type: string, format: view-path, default: ""}`, `params` `{type: object, default: {}, extension: {"view-params": {"path": "../path"}}}`; the `format` gives the Designer's view picker and the `extension` its params editor.
- `ops/project/com.inductiveautomation.perspective/views/MapStudioDev/view.json` and `.../page-config/config.json` -- the dev view (flex column, label, `ao.mapstudio` with empty props); a view folder is a leaf (`resource.json` beside `view.json`, copy `MapStudioDev/resource.json`). The Gateway reads project files at start, so a restart follows edits.
- `ops/screenshot.mjs` -- Web Mercator projection of the click target, failure on any console error, `.mapstudio-reply` wait, `--url` or `GATEWAY_URL`; extend with the popup wait and keep the two sizes.
- `ops/lib.sh`, `ops/docker-compose.yml` -- read `MAPSTUDIO_CONTAINER` and `GATEWAY_HTTP_PORT` from `.env` (already written in this worktree as `ms-s4` and `9104`); compose project name follows the container, so volumes are separate from the other dev Gateways.
- `web/typescript/__tests__/messages.test.ts`, `web/jest.config.js` -- Jest runs pure modules in node (`tsconfig.test.json`), so popup logic to test must be in a module with no MapLibre or React import.
- `docs/architecture.md` (Popups section), `README.md` (Status, Message contract) -- documentation to update; `docs/platform-checks.md` is new.
- Do not change: `gateway/`, `designer/`, `Messages.java`, `messages.ts`, `web/webpack.config.js` externals (`react-dom` is already external as `ReactDOM`, which is what `createPortal` needs).

## Tasks & Acceptance

**Execution:**
- [ ] `common/src/main/resources/mapstudio.props.json` -- add `popupView: {path (format view-path, default ""), params (object, default {}, view-params extension)}` with `additionalProperties: false` -- the prop that names the view, shaped like the built-in Map's.
- [ ] `web/typescript/popupParams.ts` -- pure helpers: `popupMountPath(viewMountPath, addressPathString)` returning `${viewMountPath}$${addressPathString}[popup]`, `popupViewParams(authorParams, point)` returning `{...authorParams, mapItem: {id, name}}`, `isFailedViewState(state)` for `notFound`, `error`, `access-denied` -- testable in node, no MapLibre or React import.
- [ ] `web/typescript/__tests__/popupParams.test.ts` -- unit tests for the three helpers, including `mapItem` winning over an author key of the same name and an empty author object.
- [ ] `web/typescript/PointPopup.tsx` -- React component given `store`, `path`, `params`, `point`, `onClose`: renders `View` (props as in the Code Map, `useDefaultWidth` and `useDefaultHeight` true, `onViewStateChange` to swap to the text fallback and `console.warn` with the path on a failed state) or the text fallback (`point.id`, `point.name`) when `path` is empty or the view failed.
- [ ] `web/typescript/MapStudio.tsx` -- `MapStudioProps.popupView: {path: string; params: Record<string, unknown>}` read in `getPropsReducer` (`readString('popupView.path', '')`, `readObject('popupView.params', {})`); component state holds the open point; `onPointClick` keeps sending `point.click` and sets the open point; a `maplibregl.Popup({closeOnClick: true, closeButton: true, maxWidth: 'none'})` anchored at the point's coordinates takes an empty `div` through `setDOMContent`, and `render()` adds `ReactDOM.createPortal(<PointPopup .../>, div)` with `key` from `PageStore.instanceKeyFor(path, mountPath) + point.id`; the popup's `close` event clears the state (unmounting the View); `componentWillUnmount` removes the popup before the map.
- [ ] `web/typescript/mapstudio.css` -- `.mapstudio .maplibregl-popup-content`, `.maplibregl-popup-tip`, `.maplibregl-popup-close-button` on `--container`, `--border`, `--label`, `--borderRadius`; `.mapstudio-popup` fallback text; a min size for the view box so a default-size view is not clipped on a 390 px phone (cap at `calc(100vw - 32px)`).
- [ ] `ops/project/com.inductiveautomation.perspective/views/Popups/PointDetails/view.json` and `resource.json` -- a small flex view with input param `mapItem` (default `{"id": "", "name": ""}`) and labels bound to `{view.params.mapItem.id}` and `{view.params.mapItem.name}`, default size about 220 by 90.
- [ ] `ops/project/com.inductiveautomation.perspective/views/MapStudioDev/view.json` -- set `popupView.path` to `Popups/PointDetails` and `popupView.params` to `{"source": "dev"}` on the `map` component; update the title label.
- [ ] `ops/screenshot.mjs` -- after the click, wait for `.maplibregl-popup` containing text `p1` from the embedded view before the screenshot; keep the fail-on-console-error rule (the fallback warn must not fire on the happy path).
- [ ] `docs/platform-checks.md` -- new: the question (architecture open question, AD-7), the method, the result on 8.3.10 with the Gateway log lines and screenshot names, the client API used, the fallback behaviour seen, and what story 9 should carry into claude-ignition-skills.
- [ ] `docs/architecture.md`, `README.md` -- Popups section names the mechanism (`View` by path, `mapItem` parameter) and the spike-only `popupView` prop; README status and layout rows updated.

**Acceptance Criteria:**
- Given a fresh `./gradlew build`, when it runs, then the `.modl` is produced, `npx tsc --noEmit` has no error and all Jest tests pass (8 existing plus the new ones).
- Given the `ms-s4` dev Gateway on port 9104 with the module staged and the project reloaded, when p1 is clicked at 1440 and 390 px, then a popup anchored at p1 shows `p1` rendered by the `Popups/PointDetails` view, the reply text still appears, no console error is raised, and both screenshots are written.
- Given the Gateway log after the run, when it is read, then it holds no Map Studio or Perspective error, and the view model for `Popups/PointDetails` starts on open and stops on close (log at debug or the Perspective session page shows the view count return to one).
- Given `popupView.path` set to a view that does not exist, when a point is clicked, then the popup shows the text fallback with the point id and one warning names the path.
- Given `docs/platform-checks.md`, when read, then the open question is answered with its evidence and the answer is one a reader can check against the screenshots and log lines named.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

The popup is a MapLibre `Popup` whose DOM node receives the React content through `createPortal`, so the `View` stays inside the component's React tree: `ClientStoreProviderContext` and the other Perspective contexts reach it without a second React root, unlike the built-in Map's custom controls, which render into a Leaflet control outside React and must re-provide the context. `View` is the whole answer to the spike question: on mount its `ViewStore.startup` sends `view-start` to the Gateway, which creates the view model, so bindings in the embedded view work and no Map Studio Java is involved. The `key` changes with the point id, so a click on another point remounts the view with fresh params instead of relying on `UNSAFE_componentWillReceiveProps`.

The `mapItem` parameter follows AD-7 (the view receives the map item object) rather than the Map's verbatim `params`; the author's `params` are kept beside it, as the built-in Map allows, so a project can pass its own settings. `popupView` is a spike prop: AD-7 moves the view path into the kind setup later, and the schema's description says so.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npm test` -- expected: no type error, all tests pass.
- `./gradlew build` -- expected: success, `build/Map-Studio.unsigned.modl`.
- `ops/up.sh --fresh` (with `.env` holding `MAPSTUDIO_CONTAINER=ms-s4` and `GATEWAY_HTTP_PORT=9104`) -- expected: RUNNING, bundle served at `http://localhost:9104/res/mapstudio/MapStudio.js`, no Map Studio error in `ops/logs.sh`.
- `node ops/screenshot.mjs --url http://localhost:9104` -- expected: both screenshots written with the popup showing `p1`; exit 0.
- Playwright one-off (not committed) against `http://localhost:9104`: set `popupView.path` to `Popups/Nope` in the view JSON, restart, click p1 -- expected: text fallback and one console warning; restore the path afterwards.

**Manual checks (if no CLI):**
- Owner looks at `docs/screenshots/mapstudio-dev-1440.png` and `-390.png`: popup anchored at p1, the view's labels readable, nothing wider than the phone viewport.
