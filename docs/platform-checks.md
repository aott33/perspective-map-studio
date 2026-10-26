# Platform checks

The spike's platform questions (epic-module-foundation R3), each answered on a live Ignition 8.3.10 Gateway with its evidence and the fallback taken where it failed. One section per spike story; a story edits only its own section. Story 9 compiles these into the go or no-go report and carries the answers into claude-ignition-skills.

Labels: **[live 8.3.10]** seen on the `ops/` dev Gateway (`inductiveautomation/ignition:8.3.10`); **[build]** seen in this repository's build or tests; **[npm metadata]** read from the package registry; **[client typings]** read from `@inductiveautomation/perspective-client` 2.3.10, the package matching 8.3.10; **[bundle]** read from Perspective's own `PerspectiveMap` browser bundle inside the 8.3.10 Perspective module; **[SDK 8.3.0 javap]** read from the SDK jars' signatures, not run; **[IA docs]** from the IA 8.3 manual; **[unverified]** or **[not verified]** not checked here.

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

## Story 3 - Gateway platform checks

Date: 2026-10-26. Gateway: `inductiveautomation/ignition:8.3.10` (`sha256:174fb4d8c640a6439baec35540bdf15169f850f6f849a1ae80dcb91bbe66b119`), Standard edition, trial, container `ms-s3` on port 9103, module `com.aoindustrial.perspective.mapstudio` 0.1.0 built unsigned from this branch against SDK 8.3.0. PostgreSQL: `postgres:16-alpine` (`sha256:f4610795587492cd4fb887c2dc3de301b813278bb6f616992061141b5f15ac36`, server 16.15) on the same compose network, reached as `postgres:5432`. Run with `ops/checks.sh` (fresh volumes); the five lines below are the Gateway log's `CHECK` lines of that run, each logged by the module's `gateway/.../spike` package from a `ResourceCollectionLifecycle` of the `mapstudio-dev` project.

### Answers at a glance

| Open question (architecture spine) | Answer | Fallback |
| --- | --- | --- |
| Do Java tag subscriptions reach Alarm Metrics on folders and UDT instances? | Yes **[live 8.3.10]**: `TagManager.subscribeAsync` on `<folder>/Alarm Metrics.HasActive` and `<UDT instance>/Alarm Metrics.HasActive` delivered Good true and false as the alarm toggled. `readAsync` on the same paths answers `Bad_Unsupported` (IA: direct reads are not supported) | Not needed (was: a Reference tag per metric) |
| Can module code call project script functions? | Yes **[live 8.3.10]**: `ProjectManager.getProjectScriptManager(project)` gives a `ScriptManager` (`TrackingProjectScriptManager`) and both `runCode` and `runFunction` ran `mapstudio_checks.kinds()` and returned its dict | Not needed (was: a named query) |
| Can a module register `system.mapstudio.*`? | Yes **[live 8.3.10]**: `initializeScriptManager` + `addScriptModule("system.mapstudio", ...)`; the project function called `system.mapstudio.ping()` and got its answer. Designer autocomplete **[not verified]** (owner's manual check) | Not needed |
| Is a custom project resource type workable for the setup? | Gateway side yes **[live 8.3.10]**: a `com.aoindustrial.perspective.mapstudio/setup/{setup.json,resource.json}` folder in the project loads with no registration, and a `ResourceCollectionLifecycleFactory` filtered on the type receives it in `onStartup`. Designer editor not built (owner's decision, 2026-10-26): about 300 lines from IA's example, see below; decided in epic-map-store-and-data | Setup as a project script function returning the same schema (AD-5) |
| PostgreSQL on 8.3.10's connection defaults: connect, create a `mapstudio_` table, log an error on missing rights? | Yes **[live 8.3.10]**: owner role created `mapstudio_schema_version`, inserted and read back; a CONNECT-only role's CREATE failed with SQLState 42501 and the module logged one error line naming the connection, the statement and the SQLState, while the connection itself stayed `Valid` | Not needed |

### The five CHECK lines (Gateway log, 2026-10-26 06:59 UTC; fresh runs at 07:06 UTC, after the script module moved to the common scope and the Designer hook registered it too, and at 07:18 UTC, after the review's stricter pass rules (non-empty `ping` string, quality exactly Good, idempotent insert), gave the same five PASS lines)

```text
CHECK setup PASS project mapstudio-dev: lifecycle onStartup received 1 resource(s) of type com.aoindustrial.perspective.mapstudio/setup; parsed SetupResource[connection=MapStudio, connectionNoRights=MapStudioNoRights, adapterFunction=mapstudio_checks.kinds, alarmMetricPaths=[[default]Checks/Alarm Metrics.HasActive, [default]Checks/Pump1/Alarm Metrics.HasActive]]
CHECK postgres PASS connection MapStudio (status Valid): created mapstudio_schema_version, inserted 1, read back max(version)=1; server: PostgreSQL 16.15 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
CHECK postgres-rights PASS connection MapStudioNoRights (status Valid) answered SELECT 1 = 1; CREATE TABLE refused with SQLState 42501; one error line logged naming the connection
CHECK project-script PASS attempt 1: project mapstudio-dev, mapstudio_checks.kinds via ScriptManager TrackingProjectScriptManager: runCode: {'ping': u'Map Studio pong at 2026-10-26T06:59:06Z', 'kinds': [{'name': 'Pad', 'geometry': 'point', 'id': 'pad'}, {'name': 'Gathering line', 'geometry': 'line', 'id': 'line'}]}; runFunction: {'ping': u'Map Studio pong at 2026-10-26T06:59:06Z', 'kinds': [...same...]};
CHECK alarm-metrics PASS readAsync [default]Checks/Alarm Metrics.HasActive -> null quality Bad_Unsupported; readAsync [default]Checks/Pump1/Alarm Metrics.HasActive -> null quality Bad_Unsupported; subscription [default]Checks/Alarm Metrics.HasActive: 3 events in 90s (initial value null quality Uncertain_InitialValue, value true quality Good, value false quality Good); subscription [default]Checks/Pump1/Alarm Metrics.HasActive: 3 events in 90s (initial value null quality Uncertain_InitialValue, value true quality Good, value false quality Good);
```

### Check 1: Alarm Metrics by Java subscription

- Setup: tag provider `default`; UDT `Checks/Pump` with one Boolean expression member `Toggle` = `getSecond(now(1000)) % 60 < 30` carrying a `WhenTrue` alarm (priority High, `ackMode` Auto); instance `Checks/Pump1`. No tag is written: the alarm goes active and clears by the clock, every 30 s.
- **Engineering review flag (CLAUDE.md, alarm changes):** `Checks/Pump Toggled` is a dev-only test alarm that exists to toggle a metric for this check. It lives only in `ops/checks/config/core` of the disposable dev Gateway, is not rationalized, and must never be copied to a real Gateway or into the template.
- Code: `TagPathParser.parse("[default]Checks/Alarm Metrics.HasActive")` (the node `Alarm Metrics` with a space, the metric as the property suffix), `context.getTagManager().subscribeAsync(path, listener)` **[live 8.3.10]**. The listener is a plain `TagChangeListener`; `TagChangeEvent.getValue()` is the `QualifiedValue`, `isInitial()` marks the first delivery.
- Seen: both paths delivered `Uncertain_InitialValue` at subscription, `true` Good 100 ms later and `false` Good 24 s later (06:59:06 and 06:59:30 UTC). The folder path aggregates the instance below it. The check counts a delivery only when `QualityCode.isGood()` holds and the code's name is exactly `Good` on a Boolean value (an `Uncertain_InitialValue` delivery carries a value too and does not count).
- `readAsync` of the same paths: `Bad_Unsupported` **[live 8.3.10]**, which is the SDK's form of IA's "direct reads are not supported".
- The 8.3.10 Gateway jar names the node `Alarm Metrics` with alias `_Alarm Metrics` (`AlarmMetricsNode.ALARM_METRICS_NAME`, `ALT_ALARM_METRICS_NAME`) **[observed in the 8.3.10 Gateway jar]**.
- Consequence for AD-6: one Gateway subscription per metric per asset works as designed; no reference tags needed.

### Checks 2 and 3: project script function from module code, and `system.mapstudio`

- `ProjectManager.getProjectScriptManager("mapstudio-dev")` returned a `TrackingProjectScriptManager` at first try, 20 ms after the module's lifecycle started (the lifecycle starts after the project's own script lifecycle; a six-try, 5 s retry was in place and not needed) **[live 8.3.10]**.
- Way 1: `runCode("import mapstudio_checks\n__result__ = mapstudio_checks.kinds()\n", locals, name)` with `locals = manager.createLocalsMap()`, result read with `locals.__finditem__("__result__")`.
- Way 2: `runCode("import mapstudio_checks\n", locals, name)`, then `locals.__finditem__("mapstudio_checks").__getattr__("kinds")` run with `manager.runFunction(callable)`. The project module is **not** in `manager.getGlobals()` until imported (the first run found nothing there) **[live 8.3.10]**.
- Both returned the Python dict as a `PyObject` (`{'ping': u'Map Studio pong at ...', 'kinds': [...]}`); the check passes only when `kinds` is a non-empty `PyList` and `ping` a non-empty string (`PyBaseString`), read with `result.__finditem__(Py.newString(key))`, so a swallowed `ping()` failure in the adapter (it returns `ping` None) fails the check. The Jython 2.7 module is `ops/project/ignition/script-python/mapstudio_checks/code.py` (`resource.json` with `files: ["code.py"]`, `hintScope: 2`).
- `system.mapstudio.ping()` was callable inside that project function: the module's `initializeScriptManager(ScriptManager)` calls `manager.addScriptModule("system.mapstudio", new MapStudioScriptModule(), new PropertiesFileDocProvider())`; the Gateway calls it for every script manager it creates (project script managers included) **[live 8.3.10]**. The class lives in `common/` and the Designer hook registers it the same way, so the Designer's own script manager (autocomplete, script console) sees it too, as in IA's example; there a Gateway-only function goes over RPC. Docs come from `MapStudioScriptModule.properties` (`ping.desc`, `ping.returns`) registered through `BundleUtil` in a static block, and `@JythonElement(docBundlePrefix = ...)` on each method, as in IA's scripting-function example. Designer autocomplete of `system.mapstudio.` **[not verified]**: the owner checks it in the Designer on `ms-s3`.
- Consequence for AD-4 and AD-18: adapters as project functions and the scripting API as a module script module both work; call project functions on a bounded pool with a timeout (AD-1) since `runCode` is synchronous.

### Check 4: a custom project resource type

- The project folder `ops/project/com.aoindustrial.perspective.mapstudio/setup/` holds `setup.json` and a `resource.json` (`scope: "G"`, `files: ["setup.json"]`). The Gateway loaded it with no declaration anywhere; `ResourceCollectionLifecycleFactory.getResourceFilter()` with `ResourceFilter.newBuilder().addResourceType(new ResourceType(MODULE_ID, "setup"))` delivered it to `ChecksLifecycle.onStartup(List<Resource>)`, read with `resource.getData("setup.json").map(ImmutableBytes::getBytesAsString)` **[live 8.3.10]**.
- `onResourcesModified` **[not verified]**: changing the file needs a project scan (an API key, which the fresh dev Gateway has none of) or a Designer save; the lifecycle logs `CHECK setup-modified` when it fires. The owner can trigger it from the Designer.
- Designer editor estimate (not built, owner's decision): IA's project-resource example is 306 lines of Swing in the designer scope (`DesignerHook` 58, `PythonResourceWorkspace` 100 extending `TabbedResourceWorkspace`, `PythonResourceEditor` 67, `HandlerSearchProvider` 81), plus an icon, a bundle and the `designer-api` dependency. A form for AD-5's fields (connection, adapter functions, roles, refresh interval, alarm page, basemaps, token secret) is one editor class of that size; about one day with the Designer round trips. Decision deferred to epic-map-store-and-data; the fallback (a project script function returning the setup) costs nothing in the Designer.

### Check 5: PostgreSQL on the Gateway's default connection settings

- Connections created as files in `core` with the defaults the manual states **[IA docs]**: pool 0/8/8/0, max wait 5000 ms, validation `SELECT 1`, test on borrow, slow query 60000 ms, validation timeout 10000 ms, `translator` `POSTGRES`, `driver` `PostgreSQL`; the driver is the image's `user-lib/modules/PostgreSQL JDBC Driver Module.modl` **[observed in the 8.3.10 image]**. Passwords are Referenced secrets of a File secret provider reading Docker secrets.
- Owner role `mapstudio`: `Datasource.getConnection()` (an `SRConnection`), `runUpdateQuery("CREATE TABLE IF NOT EXISTS mapstudio_schema_version (version integer NOT NULL)")`, an idempotent `runPrepUpdate("INSERT ... SELECT ? WHERE NOT EXISTS (SELECT 1 FROM ... WHERE version = ?)", 1, 1)`, `runScalarQuery(SELECT max(version))` = 1; `psql` confirmed the table, owner `mapstudio` **[live 8.3.10]**.
- CONNECT-only role `mapstudio_ro` (created by `ops/checks/postgres-init.sh`; PostgreSQL 16 gives no CREATE on schema `public` to ordinary roles: `has_schema_privilege('mapstudio_ro','public','CREATE')` = f): the Ignition connection shows `Valid` (its `SELECT 1` passes), the CREATE throws `SQLException` with SQLState `42501` "permission denied for schema public", and the module logged exactly one error line: `Map Studio cannot create its tables on connection MapStudioNoRights: the database role lacks the right to CREATE TABLE (SQLState 42501): ERROR: permission denied for schema public` **[live 8.3.10]**. A `Valid` connection therefore says nothing about rights; AD-21's start-up check is the only signal.
- Seen at start-up on both fresh runs, before the module ran: two or three `E [C.BasicExecutionEngine] Task connection validation <name> threw uncaught exception ... NoClassDefFoundError: org/postgresql/Driver$1` while the Gateway installed, uninstalled and re-installed both connections during its JDBC classloader reload (06:59:01 and 07:06:49); five to eight seconds later both connections were `Valid` and every query ran. Transient, reproducible on a fresh volume, cause not established **[live 8.3.10]**.

### Facts learned on the way (not the questions, but needed to run them)

- A fresh 8.3.10 Gateway faults on a pre-filled `core` collection without its manifest: `ConfigurationSetupException: Unable to create 'core' resource collection ... Resource collection path '.../core' exists but is not empty`. With `core/config-mode.json` (`{"title": "Core", ..., "parent": "external"}`) it boots and commissions **[live 8.3.10]** (the skills already record the same for `external`).
- Named config resources (`ignition/tag-provider`, `ignition/database-connection`, `ignition/secret-provider`) need `attributes.uuid` in their `resource.json`, or the Gateway logs `Resource ... does not have required UUID attribute, will not be loaded` and skips them **[live 8.3.10]**. Any UUID works; the Gateway keeps it.
- Bind-mounting single resource folders into `core` leaves their parents root-owned, so the Gateway (uid 2003) cannot create its own resources beside them (`PushException: I/O error during prepare ... tag-provider/System`, `Error starting managed tag provider 'System'`). Seeding `core` by copying the files in from an init container and `chown -R ignition:ignition` works and keeps the Gateway's writes out of the repository **[live 8.3.10]**.
- A compose file secret keeps its host mode; PostgreSQL's init runs as `postgres` and the Gateway as uid 2003, so a 0600 secret file is `Permission denied` inside the container. 0644 files in a 0700 folder work **[live 8.3.10]** (the skills' "Secrets as files" says the same).
- The Perspective module is not needed by any of the five checks; they are plain Gateway SDK.

### For claude-ignition-skills (story 9 lands these; drafted here, target a new `ignition-dev/references/module-sdk.md`)

| Finding | Where it goes |
| --- | --- |
| Java subscriptions to `<folder or instance>/Alarm Metrics.<metric>` deliver Good values through `TagManager.subscribeAsync`; `readAsync` answers `Bad_Unsupported`; parse the path with `TagPathParser.parse` | `ignition-dev/references/module-sdk.md` (new), and a line in `ignition-ui/references/perspective-components.md` under Alarm Metrics |
| `ProjectManager.getProjectScriptManager(project)` runs project functions from module code (`runCode` with `createLocalsMap()`, or import into the locals and `runFunction`); project modules are not in `getGlobals()` until imported | `ignition-dev/references/module-sdk.md` |
| `initializeScriptManager` + `addScriptModule("system.<name>", object, new PropertiesFileDocProvider())` makes the function callable in project scripts; docs via a `.properties` bundle and `@JythonElement` | `ignition-dev/references/module-sdk.md` |
| A custom project resource type is a folder `<moduleId>/<typeId>/<name>/` with `resource.json` + data files, read by a `ResourceCollectionLifecycleFactory` filtered on `new ResourceType(moduleId, typeId)`; no registration needed on the Gateway | `ignition-dev/references/module-sdk.md`, and `ignition-config/references/file-layout.md` (project layout row) |
| `DatasourceManager.getDatasource(name).getConnection()` gives an `SRConnection`; a `Valid` connection can still lack CREATE (SQLState 42501); log the connection, the statement and the SQLState | `ignition-dev/references/module-sdk.md`; the AD-21 pattern in `ignition-architect/references/system-architectures.md` |
| A pre-filled `core` needs `core/config-mode.json`; named resources need `attributes.uuid`; seed `core` by copy from an init container rather than per-folder bind mounts | `ignition-config/references/docker.md` (rules 2 and 4) |
| Transient `NoClassDefFoundError: org/postgresql/Driver$1` during the start-up JDBC classloader reload, connections `Valid` 5 s later | `ignition-config/references/docker.md` or `rest-api.md` database-connection row, marked [live 8.3.10, cause not established] |

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
