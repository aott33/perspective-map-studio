# Platform checks

The spike's platform questions (epic-module-foundation R3), each answered on a live Ignition 8.3.10 Gateway with its evidence and the fallback taken where it failed. One section per spike story; a story edits only its own section. Story 9 compiles these into the go or no-go report and carries the answers into claude-ignition-skills. The code and scripts that produced the Story 3 evidence were removed by Story 8 (see its section); they stay readable at commit `51104c8`.

Labels: **[live 8.3.10]** seen on the `ops/` dev Gateway (`inductiveautomation/ignition:8.3.10`); **[build]** seen in this repository's build or tests; **[npm metadata]** read from the package registry; **[client typings]** read from `@inductiveautomation/perspective-client` 2.3.10, the package matching 8.3.10; **[bundle]** read from Perspective's own `PerspectiveMap` browser bundle inside the 8.3.10 Perspective module; **[SDK 8.3.0 javap]** read from the SDK jars' signatures, not run; **[IA docs]** from the IA 8.3 manual; **[owner, seen in the Designer, <date>]** observed by the owner in a Designer, by eye, recorded by story 9; **[unverified]** or **[not verified]** not checked here.

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

Live run **[live 8.3.10]** (dev Gateway `ms-s2`, fresh volume, module accepted unattended): the Gateway log shows the module starting and the component registering with no Map Studio warning or error. the screenshot script (now the `e2e/` suite, story 7) at 1440 x 900 and 390 x 844: the point click reply arrived, a one-vertex drawing cancelled with Escape left the tool off with nothing drawn, and a two-vertex line finished with Enter gave "Line drawn with 2 points"; no browser console error or page error in either viewport (the script fails on one). The toggle, the Escape cancel and the finished line were seen through the DOM attributes the component sets (`data-drawing`, `data-line-points`, `aria-pressed`) and in the screenshots.

Evidence: `docs/screenshots/mapstudio-dev-1440.png` and `docs/screenshots/mapstudio-dev-390.png` (point click reply and one line drawn with Terra Draw), written by `e2e/tests/tracer.spec.mjs`, which fails on any browser console error (the ad-hoc script in `ops/` that first wrote them was replaced in story 7).

Not covered here (later stories): frame rate, value batch size and phone breakage (story 7); saving, undo, snapping, select and edit modes (epic-editing).

## Story 3 - Gateway platform checks

Date: 2026-10-26. Gateway: `inductiveautomation/ignition:8.3.10` (`sha256:174fb4d8c640a6439baec35540bdf15169f850f6f849a1ae80dcb91bbe66b119`), Standard edition, trial, container `ms-s3` on port 9103, module `com.aoindustrial.perspective.mapstudio` 0.1.0 built unsigned from this branch against SDK 8.3.0. PostgreSQL: `postgres:16-alpine` (`sha256:f4610795587492cd4fb887c2dc3de301b813278bb6f616992061141b5f15ac36`, server 16.15) on the same compose network, reached as `postgres:5432`. Run with `ops/checks.sh` (fresh volumes); the five lines below are the Gateway log's `CHECK` lines of that run, each logged by the module's `gateway/.../spike` package from a `ResourceCollectionLifecycle` of the `mapstudio-dev` project.

### Answers at a glance

| Open question (architecture spine) | Answer | Fallback |
| --- | --- | --- |
| Do Java tag subscriptions reach Alarm Metrics on folders and UDT instances? | Yes **[live 8.3.10]**: `TagManager.subscribeAsync` on `<folder>/Alarm Metrics.HasActive` and `<UDT instance>/Alarm Metrics.HasActive` delivered Good true and false as the alarm toggled. `readAsync` on the same paths answers `Bad_Unsupported` (IA: direct reads are not supported) | Not needed (was: a Reference tag per metric) |
| Can module code call project script functions? | Yes **[live 8.3.10]**: `ProjectManager.getProjectScriptManager(project)` gives a `ScriptManager` (`TrackingProjectScriptManager`) and both `runCode` and `runFunction` ran `mapstudio_checks.kinds()` and returned its dict | Not needed (was: a named query) |
| Can a module register `system.mapstudio.*`? | Yes **[live 8.3.10]**: `initializeScriptManager` + `addScriptModule("system.mapstudio", ...)`; the project function called `system.mapstudio.ping()` and got its answer. Designer autocomplete: yes **[owner, seen in the Designer, 2026-10-26]** on the current `main` build (Script Console: `echo(text)` and `ping()` with signature, description and parameters; recorded by story 9) | Not needed |
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
- `system.mapstudio.ping()` was callable inside that project function: the module's `initializeScriptManager(ScriptManager)` calls `manager.addScriptModule("system.mapstudio", new MapStudioScriptModule(), new PropertiesFileDocProvider())`; the Gateway calls it for every script manager it creates (project script managers included) **[live 8.3.10]**. The class lives in `common/` and the Designer hook registers it the same way, so the Designer's own script manager (autocomplete, script console) sees it too, as in IA's example; there a Gateway-only function goes over RPC. Docs come from `MapStudioScriptModule.properties` (`ping.desc`, `ping.returns`) registered through `BundleUtil` in a static block, and `@JythonElement(docBundlePrefix = ...)` on each method, as in IA's scripting-function example. Designer autocomplete of `system.mapstudio.` **[owner, seen in the Designer, 2026-10-26]** (recorded by story 9, on the current `main` build rather than `ms-s3`): in the Designer Script Console (Jython 2.7.4 executing locally in the Designer) typing `system.mapstudio.` offers `echo(text)` and `ping()`, both with return type `str`; the docs panel shows `echo( text: str ): str`, "Method on system.mapstudio", the description "Returns the text it is given. A placeholder for the spike; the real API (getMap, applyEdits) comes with the map store." and the parameter `text: str`. So the Designer-scope registration through the Designer hook's `initializeScriptManager` plus the `PropertiesFileDocProvider` gives Script Console autocomplete with signature, description and parameters.
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

## Story 7 - Smoke suite and measures

The Playwright suite in `e2e/` (`@playwright/test` 1.63.0, exact) replaces the two ad-hoc scripts of `ops/`: it renders the tracer view at 1440 and 390 px, saves the screenshots the docs embed, checks the popup (custom view, second point, close, and the text fallbacks for an empty and a missing view path, each on its own dev page so no Gateway restart is needed) and writes the measures below to `docs/spike-measures.json` (`npm run docs`; a plain `npm test` writes `e2e/out/measures.json`). It fails on any browser console or page error. Date: 2026-10-26; Gateway `inductiveautomation/ignition:8.3.10` (container `ms-s7`), Chromium 153.0.8010.12, 4 CPUs, software WebGL (`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`).

Labels used here: **measured** was read from a running Gateway and browser; **stand-in** was built from a contract or a synthetic data set because the real feature or data does not exist yet; **[unverified]** was not checked. Every number in `docs/spike-measures.json` carries one of the first two and its method.

Evidence: `docs/screenshots/mapstudio-dev-1440.png`, `docs/screenshots/mapstudio-dev-390.png` (the tracer after a point click, its popup view and a drawn line) and `docs/screenshots/mapstudio-scale-1440.png` (the 30-pad stand-in).

### Bundle size (measured)

Production webpack build, unsigned, as the Gateway served it on a page load (bytes decoded, gzip of that body, and delta against story 2):

| File | Bytes | gzip | Story 2 | Delta |
| --- | --- | --- | --- | --- |
| `MapStudio.js` | 1,179,848 | 316,097 | 1,167,572 | +12,276 |
| `MapStudio.css` | 72,208 | 10,591 | 70,976 | +1,232 |
| `maplibre-gl-worker.js` | 517,065 | 147,896 | 517,065 | 0 |

The `.modl` in `ops/modules` (the file the Gateway was given) is `Map-Studio.unsigned.modl`, 510,041 bytes, SHA-256 `69e190fab36977db5808fc74f94ae1116f4ddc8c03c2e447f60c7ea733122f10`. The Gateway answered with `content-encoding: gzip` (transferred `MapStudio.js` body 315,033 bytes). No size budget exists, so none is asserted. Playwright reported 0 transferred body bytes for the worker request; why is **[unverified]**.

### Frame rate on the 30-pad scale set (measured, with limits)

Method: requestAnimationFrame timestamps and long tasks sampled in the page while Playwright drives a 4 s circular drag (at most 60 mouse moves per second) and a 4 s wheel zoom (at most 25 wheel events per second: one call, then a 40 ms pause), after a 2 s warm-up, three runs per view. The driver's input events are handled on the page's main thread, so that load shares it with rendering; it is capped and the same in every run, but it is part of what is measured. The numbers are the page's frame cadence during the gesture, not MapLibre's own render count.

Two full suite runs on the same box (the one in `docs/spike-measures.json`, then a repeat), median fps with the three runs in brackets:

| View | Pan, record | Pan, repeat | Zoom, record | Zoom, repeat |
| --- | --- | --- | --- | --- |
| 30-pad stand-in (30 circles, 30 lines) | 8.4 (8.4, 7.7, 8.5) | 7.5 (7.3, 7.5, 12.8) | 10.7 (9.3, 10.7, 10.7) | 13.1 (9.2, 13.1, 13.9) |
| Tracer (3 points, 1 line) | 10.2 (10.2, 9.5, 10.5) | 9.9 (10.4, 9.1, 9.9) | 9.8 (9.8, 10.0, 9.2) | 10.8 (14.8, 10.8, 9.8) |

The spread between runs of one view is as large as the difference between the views, on a box that shares its 4 CPUs and renders WebGL on the CPU. An earlier run with unthrottled input gave 15.8 and 5.8 fps for the 30-pad pan in two runs. Limits: (1) software WebGL, so a laptop GPU is expected to do better, **[unverified]**; (2) circle and line layers only, with no icons, labels, KPI values or alarm styling; (3) the pads are a seeded stand-in (`web/typescript/scaleData.ts`) for the template's 30-pad set, which this repository cannot read; (4) no run reached 60 fps. NFR-1 (60 fps in a laptop browser) is therefore **not decided** by this measure. Running `E2E_HEADED=1 npm test` on a laptop records a real renderer string beside its numbers.

### Size of one value batch (stand-in)

`values.batch` does not exist yet. The AD-6 envelope `{v, type, id, body: {seq, full, items}}` was built for 30 pads with three LiveValue slots each (comms, icon KPI, alarm count; `e2e/lib/valueBatch.mjs`):

| Batch | Items | JSON bytes (UTF-8) | gzip bytes |
| --- | --- | --- | --- |
| Full (on open, reconnect) | 30 | 9,230 | 707 |
| Changes only, every 10th pad | 3 | 1,019 | 236 |

AD-6 fixes only the LiveValue fields `{value, quality, t, stale, reason}`; the item layout is this story's guess **[unverified]**. Whether Perspective compresses websocket frames is **[unverified]**, so the gzip figure is the best case, not the wire size. The one real message that exists was measured on the wire (Perspective session socket, readable text frames): `point.click` sent 261 bytes, `point.click.reply` received 327 bytes.

### What broke on the phone (measured probes)

390 x 844 px, device scale factor 2, `isMobile` and `hasTouch`, on the tracer view; touch moves go through the Chrome DevTools Protocol, which may differ from a real device **[unverified]**. Seven probes passed and two failed:

| Probe | Result |
| --- | --- |
| No horizontal page overflow; the map fills the width | pass (scrollWidth 390; map 390 x 804) |
| Tap a point: reply text and popup view | pass |
| Touch drag pans, pinch zooms (read from where the open popup's tip moves, the popup being anchored to the point: -120 px for a 120 px drag, a 2.4 times larger distance after a pinch of scale 2) | pass |
| Line tool finishes by touch alone (two vertex taps and a repeat tap on the last) | pass: 2 points |
| No console or page errors | pass |
| Touch targets of 44 px or more (PRD) | **fail**: zoom in and out 29 x 29, "Draw a line" 105 x 29 |
| Popup inside the viewport with a 44 px close button | **fail**: the popup fits (x 70 to 292 of 390) but its close button is 21 x 22 |

Findings feed the phone epic and the viewing epic's bottom sheet (PRD: touch targets of 44 px, popup as a bottom sheet on a phone); the probes record and never fail the suite.

### Not covered

Hours to a green build (story 9 compiles it); the 60 fps NFR-1 verdict on a real GPU; a value batch from a real `values.batch`; real touch hardware.

## Story 8 - Refactor sweep

Cleanup only; no platform question here. Date: 2026-10-26.

**Removed:** the Story 3 spike code (`gateway/.../spike/` and its three test classes, `MapStudioModule.SETUP_RESOURCE_TYPE`), the `mapstudio_checks` project script, the `setup` project resource, `ops/checks.sh`, `ops/checks/`, `ops/docker-compose.checks.yml` (the PostgreSQL 16 dev stack) and the checks hooks in `ops/lib.sh`. Nothing in `e2e/` used them. The module no longer logs `CHECK` lines. Kept: `MapStudioScriptModule` (`system.mapstudio.ping` and `echo`) and its registration in both hooks, because the Designer autocomplete check is still open (see below). Recovery: commit `51104c8` and the v0.1.0 release tag (not in the clone the sweep ran in, **[unverified]** here). The Story 3 section above remains the record of the answers.

**Kept on purpose:** `popupView`, `testSet` (`scale30`), the dev views `MapStudioScale`, `MapStudioFallbackEmpty` and `MapStudioFallbackMissing` and their pages, so the popup, scale and measures specs keep their coverage. The owner's earlier decision to remove `testSet` in the sweep was superseded on 2026-10-26 (the 30-pad measure and the headed run need it; the component has no other way to receive data until the map store exists). They go with epic-map-store-and-data and epic-viewing.

**Build tools** (Gradle 9.8.0, `./gradlew build --warning-mode all`, JDK 21 running Gradle with a JDK 17 toolchain) **[build]**:

| Warning or finding | Before | After |
| --- | --- | --- |
| `val x by extra(...)` (`build.gradle.kts`) | deprecated, fails in Gradle 10 | `extra["sdk_version"] = ...` |
| `val x by tasks.registering(...)` (`web/build.gradle.kts` twice) | deprecated | `tasks.register<NpmTask>(...)` |
| `Task.project` at execution time from our `copy {}` in `doLast` and `layout` in `doFirst` | deprecated | a `Copy` task and values captured at configuration time; `module.xml` and the file list are unchanged |
| `moduleDependencies` (owner's fresh clone) | not reproduced with `--warning-mode all` on the first run; appeared as a compile warning after the script changed | line removed; `moduleDependencySpecs` already declares the Perspective dependency |
| `Project.getProperties` and `Task.project` in `:common:collectModlDependencies` | present | **left**: raised by the `io.ia.sdk.modl` 0.5.0 plugin as far as the build log shows (plugin source not read) |
| npm peer warnings (webpack 5.101.3 against `^5.112`) | 4 `ERESOLVE` blocks | none; webpack 5.112.2 |
| `npm audit` | 12 (1 low, 7 moderate, 4 high) | 8 (5 moderate, 3 high); `npm audit --omit=dev` reports 0 |

The 8 remaining findings (`axios`, `lodash`, `moment`, `@babel/runtime` and the `react-swipeable-views` packages) all come through `@inductiveautomation/perspective-client`, which webpack treats as an external the Gateway provides, so none of them is in the bundle; npm's offered fix is a downgrade to 2.3.9, which does not match 8.3.10 and was not taken. The client moved to `devDependencies` (it is used at build time only) **[build]**; whether any other tool reads `dependencies` was not checked. The `serialize-javascript` findings went with `copy-webpack-plugin` 14.0.0 and `css-minimizer-webpack-plugin` 8.0.0 (both accept Node 20.9 or later and webpack 5 **[npm metadata]**).

**Bundle** (production, served by the dev Gateway): `MapStudio.js` 1,179,848 to 1,179,814 bytes, `MapStudio.css` 72,208 to 72,518, worker unchanged at 517,065. The unsigned `.modl` went from 510,041 to 488,266 bytes: the only entries removed are the eight `gateway/.../spike` classes; `module.xml` is identical, including `<license>`. `docs/spike-measures.json` and the screenshots were not rewritten (Story 9 compiles them from the v0.1.0 run).

**Verification:** `./gradlew build` green with Jest 32 and 6 Gateway tests (was 18); `npm test` in `e2e/` 10 of 10 on a fresh dev Gateway (`ms-s8`), no `CHECK` line and no Map Studio warning or error in the Gateway log; `scripts/ci/test-signing.sh` passes. A dev Gateway restarted with a leftover `setup` resource in the project started the project and the module, with no `CHECK` line and no Map Studio warning or error **[live 8.3.10]**.

**Still with the owner (listed for Story 9):** the headed frame-rate run; the Designer checks for `system.mapstudio.` autocomplete and `CHECK setup-modified` (run the second on the v0.1.0 module or on `51104c8`: the code behind it is gone from the current tree). Story 9 update, 2026-10-26: the frame-rate reading (60 fps on an integrated laptop GPU, by eye) and the autocomplete check (yes) are done and recorded in `docs/spike-report.md`; `CHECK setup-modified` is still open.
