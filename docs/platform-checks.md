# Platform checks

The spike's platform questions (epic-module-foundation R3), each answered on a live Ignition 8.3.10 Gateway with its evidence and the fallback taken where it failed. One section per spike story; a story edits only its own section. Story 9 compiles these into the go or no-go report and carries the answers into claude-ignition-skills. The code and scripts that produced the Story 3 evidence were removed by Story 8 (see its section); they stay readable at commit `51104c8`.

Labels: **[live 8.3.10]** seen on the `ops/` dev Gateway (`inductiveautomation/ignition:8.3.10`); **[build]** seen in this repository's build or tests; **[npm metadata]** read from the package registry; **[client typings]** read from `@inductiveautomation/perspective-client` 2.3.10, the package matching 8.3.10; **[bundle]** read from Perspective's own `PerspectiveMap` browser bundle inside the 8.3.10 Perspective module; **[SDK 8.3.0 javap]** read from the SDK jars' signatures, not run; **[IA docs]** from the IA 8.3 manual; **[owner, seen in the Designer <date>]** observed by the owner in a Designer, by eye (first used by story 9); **[unverified]** not checked here (epic 1 sections also write **[not verified]**, the same meaning).

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
- `onResourcesModified` **[not verified]** in the spike: changing the file needs a project scan (an API key, which the fresh dev Gateway has none of) or a Designer save; the lifecycle logs `CHECK setup-modified` when it fires. The owner can trigger it from the Designer. Since seen firing after a project scan, with `onResourcesCreated` and `onResourcesDeleted`: "Epic 2 story 6" below **[live 8.3.10]**.
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

The spread between runs of one view is as large as the difference between the views, on a box that shares its 4 CPUs and renders WebGL on the CPU. An earlier run with unthrottled input gave 15.8 and 5.8 fps for the 30-pad pan in two runs. Limits: (1) software WebGL, so a laptop GPU is expected to do better, **[unverified]**; (2) circle and line layers only, with no icons, labels, KPI values or alarm styling; (3) the pads are a seeded stand-in (`web/typescript/scaleData.ts`, removed in epic 2 story 11: the same coordinates are now the dev seed's store items, see below) for the template's 30-pad set, which this repository cannot read; (4) no run reached 60 fps. NFR-1 (60 fps in a laptop browser) is therefore **not decided** by this measure. Running `E2E_HEADED=1 npm test` on a laptop records a real renderer string beside its numbers.

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

**2026-10-27, epic 2 story 11:** `testSet` (`scale30`), its stand-in data (`scaleData.ts`, `testData.ts`), the `MapStudioScale` view and its `/scale` page are removed. The 30-pad set and the tracer's points are now map items in the dev map store, written by the dev seed (`mapstudio_seed`, the "Seed the dev map" button on `/edit`; docs/contract.md, "The dev seed"), and `/` draws, clicks and measures them. `popupView` and the two fallback views stay.

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

## Epic 2 story 1 - session roles on the Gateway

**Question (epic-map-store-and-data, Notes; story 1, Notes):** how does the component's Gateway delegate read the Perspective session user's roles, so that the write path checks roles on the Gateway and never trusts anything the browser sends?

**Answer:** through the component's session: `component.getSession().getWebAuthStatus().getUser()` gives an `Optional<WebAuthUser>`, and `WebAuthUser.getRoles()` the user's roles by name **[live 8.3.10]**. `Session.getProjectName()` gives the project the map is keyed by. No fallback was needed. Date: 2026-10-26. Gateway: `inductiveautomation/ignition:8.3.10`, container `ms-e2s1` on port 9121, module 0.1.0 built from this branch with a temporary probe in `MapStudioDelegate.onStartup` (removed after this record).

| Session | `isAuthenticated()` | `getUser()` | `getRoles()` | `getSecurityLevels()` |
| --- | --- | --- | --- | --- |
| Anonymous (the viewer) | false | empty | (none) | `SecurityZones` only |
| `mapeditor` signed in through the project's identity provider | true | `mapeditor` | `[MapEditor]` | `SecurityZones`, `Authenticated/Roles/MapEditor` |

The probe line, as logged by the delegate of the `MapStudioEdit` view (`ops/project`), before and after the sign-in:

```text
I [M.roles] PROBE project mapstudio-dev authenticated=false user=<none> roles=<none> securityLevels=[{"name":"SecurityZones",...}]
I [M.roles] PROBE project mapstudio-dev authenticated=true user=mapeditor roles=[MapEditor] securityLevels=[{"name":"SecurityZones",...}, {"name":"Authenticated",...,"children":[{"name":"Roles",...,"children":[{"name":"MapEditor","children":[]}]}]}]
```

- The sign-in goes through the identity provider's page (`/idp/default/authn/login`, user name then password) and returns to the session URL; the page reloads, so the view and its delegate start again with the signed-in status **[live 8.3.10]**. The write path still reads the roles on every message rather than once per delegate, since a session can change user without the component restarting (sign out from another view) **[unverified]**.
- `getSecurityLevels()` carries the same roles as `Authenticated/Roles/<role>`, so it stays available as a fallback; it is not used.
- Signatures were first read from the SDK jars (`perspective-gateway` 3.3.0, `common` 8.3.0 with `javap`): `Component.getSession()`, `Session.getWebAuthStatus()`, `WebAuthStatus.getUser()`, `WebAuthUser.getUserName()`, `WebAuthUser.getRoles(): ImmutableCollection<String>`.

### Facts learned on the way (the dev stack's user and sign-in)

- A project needs its own identity provider for `system.perspective.login()`: without one the session shows "No Identity Provider Configured" and stays anonymous **[live 8.3.10]**. The project property lives in the binary `ignition/global-props/data.bin`; it was written by the Gateway, not by hand, with `PUT /data/api/v1/projects/mapstudio-dev {"identityProvider": "default"}` (the Gateway needs write access to the bind-mounted project folder for that call), and is committed in `ops/project/ignition/global-props/`.
- An API key resource cannot carry `Authenticated/Roles/<role>`: 8.3.10 logs `Security level 'Authenticated/Roles' cannot be granted via config and will be ignored` and the key gets 403 **[live 8.3.10]**. The dev key carries `Authenticated/ApiKeys/MapStudioDev`, which `ops/up.sh` adds to the Gateway's Read and Write permissions (`ops/dev_security.py`).
- First-boot commissioning writes `core` `security-properties` itself, so a copy seeded into `core` before the first boot is replaced **[live 8.3.10]**; `ops/up.sh` patches the Gateway's own file after the first RUNNING and restarts once.
- The identity provider a fresh volume gets was `default` on most first boots and once `temp` ("Temporary Ignition Identity Provider created during password reset") **[live 8.3.10]**, as `ign-scada-template` saw on 8.3.9 (its GW-1). The dev project pins `default` (its Gateway-written `global-props`), so `ops/users.py` makes sure a provider named `default` exists: when it is missing and the system identity provider is an internal one, it copies that provider under the name `default` (same user source and settings; `POST /data/api/v1/resources/ignition/identity-provider`, the route `ign-scada-template`'s `ensure_identity.py` uses on 8.3.9), then creates the user in the user source behind `default`. The copy path is unit tested (`ops/tests/test_users.py`); the fresh volumes since then got `default`, so the copy itself is **[unverified]** on 8.3.10.
- `GET /data/api/v1/resources/find/ignition/identity-provider/default` answered 404 on the volume whose only provider was `temp`: the route exists (it is in `/openapi.json`), and the 404 meant "no provider of that name" (an earlier version of this note read it as a missing route; corrected). `ops/users.py` reads `.../list/ignition/identity-provider` **[live 8.3.10]**. The SCIM routes of an internal user source (`/data/api/v1/scim/<userSource>/v2/Users` and `/Groups`) created `mapeditor` and the roles `MapEditor` and `MapOperator` as on 8.3.9 **[live 8.3.10]**.


### Least-privilege runtime role on a migrated map store

**Question (story 1 review, Quick lens, finding 2):** does a database role without CREATE bring the map store up once the schema exists? **Answer:** yes, now that the migrator reads the version first **[live 8.3.10]**. Date: 2026-10-26, `ms-e2s1`.

- Before the fix the migrator ran `CREATE TABLE IF NOT EXISTS mapstudio_schema_version` on every start, which PostgreSQL 16 refuses with SQLState 42501 for a role without CREATE on the schema even when the table exists (the reviewer reproduced it). Now it runs `SELECT to_regclass('mapstudio_schema_version') IS NOT NULL` and `SELECT coalesce(max(version), 0)` first, with no lock and no DDL, and takes the advisory lock and creates anything only when a migration is pending.
- Check: on the migrated dev database the owner role made `mapstudio_rt` (LOGIN; CONNECT on the database, USAGE on schema `public`, SELECT, INSERT and UPDATE on all tables, USAGE and SELECT on all sequences; `has_schema_privilege('mapstudio_rt', 'public', 'CREATE')` = f; its password passed to `psql` as a variable). The Gateway's `MapStudio` connection was pointed at `mapstudio_rt` and the Gateway restarted: its log said "map store on database connection MapStudio is at schema version 1" with no error, `pg_stat_activity` showed the Gateway connected as `mapstudio_rt`, and `e2e/tests/store.spec.mjs` passed 6 of 6 (editor saves, viewer refusals, script checks) on it.
- The first start on an empty database still needs a role that may CREATE (the dev stack's owner role `mapstudio`); entry 5 owns the missing-rights messages.

### The e2e sign-in without the password in a trace

Playwright traces record each action's parameters, a `fill()` value included, and CI uploads `e2e/out`. The suite therefore signs the map editor in with a plain Playwright browser in a separate node process (`e2e/lib/signInCli.mjs`, no tracing, no report) right before each editor test, and the test starts from the saved browser state (`storageState`). A state saved once in the global setup was signed out by the time the full suite reached the editor tests, about two minutes later (cause not established), so each editor test signs in afresh. A Perspective session opened from that saved state is signed in as `mapeditor` **[live 8.3.10]**. The global teardown deletes the state file (kept in the system temp folder, not in `e2e/out`) and scans `e2e/out`, trace zips unzipped, for the password, deleting any file that holds it and failing the run (`e2e/lib/secretScan.mjs`, unit tested with a zipped trace).

Check of the scan [live, Playwright 1.63.0]: a throwaway spec with `trace: 'on'` that `fill()`ed the password into a page input produced a `trace.zip` under `e2e/out/results`; the teardown found the password inside it (unzipped), deleted the file and failed the run (exit 1), and a scan of `e2e/out` afterwards, the HTML report included, found nothing. The spec was then deleted.

## Epic 2 story 2 - conflicts, retries, deletes and the phone role, live

**Question (story 2, Verification):** do the write path's new rules hold through a real Perspective session, for a map editor and a phone editor signed in in two browsers? **Answer:** yes **[live 8.3.10]**. Date: 2026-10-27 (UTC). Gateway: `inductiveautomation/ignition:8.3.10`, container `ms-e2s2` on port 9122, fresh volumes, module built from this branch; `e2e/tests/writepath.spec.mjs` 2 of 2 and the whole suite 18 of 18.

- The e2e suite sends `map.load` and `edits.apply` through the component's own model event path with `window.__mapStudioTest.send(type, body)` (`web/typescript/testHook.ts`), so the Gateway reads the roles of the session that sent them, as for the component's own saves. The phone editor `mapoperator` (role `MapOperator`, `ops/users.py`) signs in the same way as the map editor, in its own node process; `map.load` reported `level: phone` for it.
- A phone editor's properties change made the map editor's stale update a `conflict` whose `conflicts[0]` carried the stored record at version 2, `changedBy: mapoperator` and the UTC time; the message read "Conflict pad was changed by mapoperator at HH:MM UTC since you loaded it. Nothing in this save was written." `map.load`'s `seq` did not move.
- One batch sent twice in turn, and another sent twice at the same moment from the page, each got one reply twice with the same `seq`; `select batch_id, count(*) from mapstudio_edit group by batch_id having count(*) > 2` returned no row, and the only batches with two rows are two-op batches. The phone editor resending the map editor's `batchId` was refused `invalid` ("already used").
- Delete then restore of one line read, in `mapstudio_edit`: create v1, delete v2, create v3, actor `mapeditor`, source `session`, consecutive `seq`; `map.load` left the tombstone out and showed the restored item at version 3.
- The phone editor's drawn line was refused `role` with "Not saved: Phone editing may move a point ..." (screenshot `mapstudio-store-phone-390.png` in `e2e/out/screenshots`); its point move and a line's properties change saved as version 2; a line's geometry, a rename and a delete were refused `role` with `seq` unchanged.
- Order change seen live: the anonymous viewer's session has no user name, so the write service now looks for a retried `batchId` only when there is an actor and keeps entry 1's role-before-actor order; before that fix the viewer's save answered `invalid` ("needs an actor") instead of `role`.

## Epic 2 story 3 - calling the project's kind and asset functions

**Question (epic-map-store-and-data, entry 3):** can the module call the kind and asset functions the setup names on its own pool with a timeout, and see an edited function without a Gateway restart? **Answer:** yes **[live 8.3.10]**, on the `ms-e2s3` dev Gateway, 2026-10-27.

- The spike's way 2 (`getProjectScriptManager(project)`, `runCode("import <module>\n", locals, ...)`, the dotted attribute, `runFunction`) runs on Map Studio's adapter pool (`MapStudio-adapter-N`, 2 threads, queue 8). A Python `RuntimeError` raised in the function reaches the module as `JythonExecException` whose `getPyCause()` gives the type name and message; the module reports "failed: RuntimeError: ..." **[live 8.3.10]**.
- A function that sleeps 8 s leaves the list `slow` at 5 s; the call keeps its thread until it returns, and its answer is dropped. Two `refreshAdapters` from two Perspective sessions, one second apart, ran the dev functions once (`kinds: 1, assets: 1` in the dev adapter's own call count) **[live 8.3.10]**.
- Edited function, no restart: with `raise ValueError(...)` added to `mapstudio_dev.kinds` and `POST /data/api/v1/scan/projects` (dev API key), the Gateway logged "Restarting gateway scripts... project=mapstudio-dev" and the next refresh (1.7 s later) reported `failing: ValueError: ...`, keeping the last good list; reverted and scanned again, the next refresh logged "recovered" **[live 8.3.10]**. So the module needs no hook into project scans: each call asks for the project's script manager afresh.
- `system.util.getGlobals()` is shared between a Perspective session script and a project library function the module calls through the project's script manager: the dev adapter's mode, set from the `/adapters` page's buttons, reached the module's next call **[live 8.3.10]**. It is lost on a Gateway restart.
- A fresh 8.3.10 Docker Gateway has only the `System` tag provider (no `default`) in its config collections **[live 8.3.10]**, so the dev adapter keeps its mode in `getGlobals()` rather than in a memory tag, and the dev stack seeds no tag provider.
- The Gateway log shows the module's loggers abbreviated: `MapStudio.adapters` appears as `M.adapters` (as `M.setup`, `M.store`); grep for `M.adapters` **[live 8.3.10]**.

## Epic 2 story 4 - pushing from the Gateway

**Question (story 4, Tasks):** can the component's Gateway delegate send a message its browser did not ask for, from a thread of the module's own (the change bus), and which path reaches the browser: the session's execution queue, or `fireEvent` straight from the bus thread?

**Answer:** the session's execution queue works: the delegate subscribes in `onStartup` with `component.getSession().getProjectName()`, and for each change submits `fireEvent("model", "mapstudio.message", <map.changed envelope>)` to `component.getSession().queue()` (`ExecutionQueue.submit(Runnable)`), and the browser receives it **[live 8.3.10]**. The fallback (calling `fireEvent` from the bus thread directly) was not needed and is not used. Date: 2026-10-27. Gateway: `inductiveautomation/ignition:8.3.10`, container `ms-e2s4` on port 9124, module built from this branch.

- Seen by `e2e/tests/changes.spec.mjs` at 1440 and 390 px: an editor at `/edit` saves a line; an anonymous viewer at `/`, in a second browser context, draws it within 5 s (`data-items-loaded` + 1) with no page reload (a `window` marker set before the save survives) and no gap reload (`data-map-reloads` stays 0); then the dev page's "Run script checks" (`system.mapstudio.applyEdits` from a session script) reaches the viewer the same way, and both maps end at the same `data-store-seq` **[live 8.3.10]**.
- `Component.getSession()` and `Session.getProjectName()` work in `ComponentModelDelegate.onStartup` **[live 8.3.10]**.
- That `onShutdown` runs when a page or session closes, so the delegate leaves the bus, is **[unverified]**. A missed unsubscribe would keep the delegate, its component and its session reachable from the bus (the subscriber is the delegate's method) and submit every later change to a dead session's queue. So the delegate also leaves the bus at the next change when `component.isRunning()` is false or the session queue's `submit` throws (unit tested with a fake component and session in `MapStudioDelegateTest`); that a closed page or session gives either signal is also **[unverified]**. A subscriber that throws is logged at debug and the bus keeps serving the others.
- A gap reload (`seq` skipped): `e2e/tests/unsaved.spec.mjs` ("a map.load that fails after the map loaded") drops one `map.changed` frame on its way to the browser; the map detects the gap and sends `map.load` **[live 8.3.10]**. The test answers that `map.load` with a faked `busy`, and the reload completes on the 15 s timed retry, so the Gateway's reply to a gap's `map.load` is not checked live **[unverified]** (epic 2 story 8; recorded here by story 12, 2026-10-27). The bus's 2 s hold for an out-of-order commit is unit tested only (`ChangeBusTest`, `changes.test.ts`) **[unverified]** live.
- Signatures read first from the SDK jars with `javap` (`perspective-gateway` 3.3.0, `common` 8.3.0): `Session.queue(): ExecutionQueue`, `ExecutionQueue.submit(Runnable)` (ordered per session; that it runs tasks one at a time in order is the class's documented purpose, not checked here).

## Epic 2 story 5 - map store states

**Question (epic-map-store-and-data R2, AD-21):** what does the map store do when the database role lacks a right, when a migration fails midway, when the schema is newer than the module, and on the standby of a redundant pair; and does fixing a right heal without a restart?

**Answer:** a failed migration (any statement, any SQLState) is rolled back whole and logged once as one line naming the connection, the migration, the statement, the SQLState and, for 42501, the missing right; the map store is then unavailable and heals by itself at most a minute after the fix, with no restart. A schema newer than the module is read only: one warning, nothing migrated or changed, the map read as usual, every save refused `read-only` and nothing written **[live 8.3.10]**. The standby case is unit tested over a stand-in and **[unverified]** live (one Gateway only). Date: 2026-10-27. Gateway: `inductiveautomation/ignition:8.3.10`, container `ms-e2s5` on port 9125, PostgreSQL 16, module built from this branch.

How: `ops/store-checks.sh` adds the project `mapstudio-check` (`ops/store-checks/project`, mounted by `ops/docker-compose.store-checks.yml`), whose setup names the connection `MapStudioCheck`: role `mapstudio_check` on database `mapstudio_check`, made by `ops/postgres-init/20-store-checks.sh` with no right beyond PostgreSQL 16's defaults (no CREATE on schema `public`). Per scenario it sets the check database with `psql` as the owner role, restarts the Gateway where the scenario needs a fresh start, reads the Gateway log and runs `e2e/tests/store-ops.spec.mjs`. At the end it empties the check database and recreates the Gateway without the check project. Runs: `E2E_DOCS=1 ops/store-checks.sh`, all four scenarios passed; then `E2E_DOCS=1 ops/store-checks.sh rights newer` (after `partial` stopped overwriting the `rights` screenshots), both passed again.

| Scenario | Set up | Gateway log (`MapStudio.store`) | Map and database |
| --- | --- | --- | --- |
| `rights` | no grant | exactly one error line, below | `data-store-state="unavailable"`, "Map store: store-unreachable: The map store is unavailable: the database role of connection MapStudioCheck lacks the right to create Map Studio's tables. Ask an administrator (see the Gateway log)."; no `mapstudio_` table; still one line after the spec's `map.load`s (all within the 60 s retry interval, so this does not show a retry with the same failure logging nothing: that is unit tested only) |
| `partial` | `GRANT CREATE ON SCHEMA public`; the owner creates a table `mapstudio_kind_setup` | one error line: `migration 1, statement 4 of 8 (CREATE TABLE mapstudio_kind_setup ...) failed with SQLState 42P07: ERROR: relation "mapstudio_kind_setup" already exists` | unavailable; `pg_tables` lists only the pre-created `mapstudio_kind_setup`: the three tables the migration had created were rolled back with it |
| `healed` | the blocker dropped; no restart; 65 s wait | `Map Studio created its map store schema on database connection MapStudioCheck: applied version(s) [1], now at schema version 1.` | the first `map.load` after the 60 s retry interval started the migrator (and still answered unavailable); a reload a few seconds later was `ready`; the six `mapstudio_` tables exist; `getMap` from a view script gave `{"count": 0, "readOnly": null}` |
| `newer` | version 999 recorded; Gateway restarted | exactly one warning, below | `data-store-state="read-only"`, "Map store: read only. The map store was upgraded by a newer Map Studio (schema 999, this module knows 1); saving is off until the module is upgraded."; a drawn line refused `read-only` with the same words; `getMap(...).readOnly` the same reason; `mapstudio_edit` 0 rows before and after; the recorded version still 999 |

The two lines, as logged:

```text
E [M.store] Map Studio cannot prepare its map store on database connection MapStudioCheck: migration 1, statement 1 of 8 (CREATE TABLE IF NOT EXISTS mapstudio_schema_version ...) failed with SQLState 42501, the database role lacks CREATE on schema public: ERROR: permission denied for schema public   Position: 28
W [M.store] Map Studio's map store on database connection MapStudioCheck is at schema version 999, newer than this module knows (1); the map is read only here until the Map Studio module is upgraded. Nothing was migrated or changed.
```

- PostgreSQL rolled back the DDL of the failed transaction (`partial`), as its docs say **[live 8.3.10, PostgreSQL 16]**.
- The statements are numbered as the migration's transaction runs them: story 1's `CREATE TABLE IF NOT EXISTS mapstudio_schema_version` is statement 1, migration 1's six statements follow, the version record is last (8). The advisory lock and the version read are named but not numbered.
- `getMap` returns a Java subclass of Jython's `PyList` that answers `readOnly`; a Perspective view script iterated it with `len()` and read `items.readOnly` on 8.3.10's Jython **[live 8.3.10]**, and story 1's dev script checks (which iterate it) still pass.
- The anonymous viewer's save on the read-only store was refused `read-only`, not `role`: the write service checks the store state first (story 1's order).
- The plain dev stack (no overlay) logged no Map Studio error with the `MapStudioCheck` connection present and unused, and the plain e2e suite passed (16 passed, `store-ops` skipped). The Gateway makes a store-and-forward engine per connection (`mapstudiocheck`), which is harmless.
- Redundancy **[unverified]**: `RedundancyGate` reads `GatewayContext.getRedundancyManager()`, `isRedundancyEnabled()` and `isActive()` on every save and listens with `addRedundancyStateListener` **[SDK 8.3.0 javap]**; on this independent Gateway saving and migrating worked as before. A standby's refusal and migration on becoming active are unit tested only (`RedundancyGateTest`, `StoreRegistryStateTest`, `WriteServiceStoreStateTest`).
- Screenshots (`docs/operations.md`): `mapstudio-store-unavailable-{1440,390}.png` (scenario `rights`), `mapstudio-store-readonly-{1440,390}.png` (scenario `newer`).

## Epic 2 story 6 - setup change on a live Gateway

**Question (story 6, proof first; check 4 above):** does a changed project setup reach the module's `ResourceCollectionLifecycle` without a Gateway restart, and through which hook? **Answer:** yes. After `setup.json` is edited on disk, a project scan (`POST /data/api/v1/scan/projects` with the dev API key, HTTP 200; `ops/scan.sh`) calls `onResourcesModified` with the setup resource, and the module applied it within about 50 ms of the request; the file edit alone called nothing in 15 s **[live 8.3.10]**. No fallback was needed. Date: 2026-10-27. Gateway: `inductiveautomation/ignition:8.3.10`, container `ms-e2s6` on port 9126, module 0.1.0 built from this branch.

Sequence (by hand, then again by `e2e/tests/setup.spec.mjs`), log lines of `MapStudio.setup`, Gateway time:

| Step | Hook | Log line |
| --- | --- | --- |
| Gateway start | `onStartup` | `00:49:25.111 Project mapstudio-dev: Map Studio setup read (connection MapStudio, ... refresh interval 10 s)` |
| `roles` and `refreshIntervalSeconds` edited, no scan, 15 s | none | (nothing) |
| scan requested at `00:49:53.464` | `onResourcesModified` | `00:49:53.517 ... setup changed and applied on resource modified (... full editing roles [Nobody], phone editing roles [MapEditor], refresh interval 30 s)` |
| `refreshIntervalSeconds: "ten"`, scan | `onResourcesModified` | `W 00:49:56.713 The Map Studio setup of project mapstudio-dev ... cannot be read: refreshIntervalSeconds must be a whole number from 1 to 3600, not "ten".` |
| file cut to 40 bytes, scan | `onResourcesModified` | `W ... setup.json is not valid JSON (line 3, column 17).` |
| setup folder moved out of the project, scan | `onResourcesDeleted` | `00:50:03.141 ... setup removed; its map store is unavailable until a setup is added.` |
| folder put back, scan | `onResourcesCreated` | `00:50:06.329 ... setup read on resource created (...)` |
| `setup.json` removed from the folder, scan | `onResourcesModified` | `W ... setup.json is missing from the setup resource.` |
| file put back, scan | `onResourcesModified` | `... setup changed and applied on resource modified (...)` |

- The module started once in this sequence (one "Starting up module 'com.aoindustrial.perspective.mapstudio'" line) and the Gateway stayed `RUNNING`, so nothing was restarted. The e2e run did the same: the editor's level went from `full` to `phone` and the refresh interval from 10 to 30 at the first reload after the scan, the bad field gave `store-unreachable` with the reason in the component, and the restored file brought `full` back.
- The modified, created and deleted lists hold only resources of the lifecycle factory's filter type (the setup), as the deleted case shows with a `ResourceId` of type `com.aoindustrial.perspective.mapstudio/setup`.
- The lifecycle callbacks run on a Gateway thread whose log context carries `collection=mapstudio-dev` (the start's runs under `module-name=Map Studio`).
- `setup.json` written by the Gateway: no. The scans left `ops/project` unchanged (`git status --porcelain ops/project` empty after the suite).
- A Designer save is expected to call the same hook **[unverified]**; the owner checks it with any edit in the setup editor (story 7, below).

## Epic 2 story 7 - setup editor in the Designer

**Question:** can a Designer workspace built on the SDK's `TabbedResourceWorkspace` and `ResourceEditor` create and edit the project's one Map Studio setup at the type folder (`com.aoindustrial.perspective.mapstudio/setup/`, story 1's layout)? **Answer:** built and unit tested. The tab opens and shows the setup **[owner, seen in the Designer 2026-10-27]**; every other line below is **[unverified]** until the owner's Designer session marks it **[owner, seen in the Designer <date>]**.

What the code relies on, read from the 8.3.0 SDK jars with `javap` (signatures and bytecode, not run) **[SDK 8.3.0 javap]**:

- `ResourceEditor`'s constructor sets `workspace`, `context` and `resourcePath`, then reads `getProject().getResource(path)` and calls `loadResource`, which calls `deserialize(Resource)` and `init(T)`, before the subclass's own fields are set; a missing resource shows "Resource '...' not found!". So `SetupEditor` makes its panel inside `init`, and "Create setup" writes the resource before the tab is opened.
- `ResourceEditor.commit()` calls `getObjectForSave()`; with `isOptimizeCommits()` true and an object equal to the one read it writes nothing; otherwise a local resource is modified (`toBuilder`, `serializeResource`, `setApplicationScope(descriptor scope)`, `modifyResource`) and a resource the project does not hold locally (an inherited one) is created as this project's own (`Resource.newBuilder()`, `setResourceCollectionName(project)`, `createResource`); an exception goes to `onCommitFailed`, whose default shows `ErrorUtil.showError`.
- Nothing in the Designer commits a module's `TabbedResourceWorkspace`: `IgnitionDesigner.handleSave` runs `commitAll()` off the Swing thread, whose `getCommitTasks()` commits only the Designer's own module and script editors, `ScriptWorkspace` and `NamedQueryWorkspace`, then calls each module hook's `notifyProjectSaveStart(SaveContext)`; `WorkspaceManager` commits nothing. `ResourceEditor` has no dirty flag or change notification (its members are the constructor, `loadResource`, `updateResource`, `init`, `getObjectForSave`, the (de)serialize methods, `commit`, `dispose`, `onCommitFailed`). So `MapStudioDesignerHook.notifyProjectSaveStart` calls `SetupWorkspace.commitAll()` on the Swing thread (`invokeAndWait`), and the editor passes no edit callback.
- `TabbedResourceWorkspace.registerNavTreeNode()` adds `createRootNavTreeNode()` under `DesignerContext.getProjectBrowserRoot()`; `getKey()` is left to the subclass; `ResourceType.rootPath()` gives the type-folder path.

The owner's Designer session (the plan's manual check), to be recorded here:

- **[owner, seen in the Designer 2026-10-27]** On 8.3.10 the owner opened the **Map Studio Setup** tab of the dev project, and it showed the dev setup's values (`ops/project/.../setup/setup.json`) correctly. A save from the tab failed on a file permission of the dev stack's bind-mounted project, a dev-stack problem being fixed in a separate change, so the save lines below stay **[unverified]**.
- **[owner, seen in the Designer 2026-10-27]** The type-folder resource opens in the tabbed workspace (the line above), so the plan's fallback (a plain node opening the same `SetupPanel` in a dialog, saved with `DesignableProject.createOrModify`) is not needed.
- [unverified] On a scratch project with no setup, "Create setup" opens the form with the defaults, refuses Create while `connection` is empty, and after `MapStudio` and Create plus a project save `data/projects/<scratch>/com.aoindustrial.perspective.mapstudio/setup/` holds `resource.json` (scope `G`, `files: ["setup.json"]`) and `setup.json`.
- [unverified] A field edit alone (no other project change) makes the project save commit the setup: File, Save is offered, and `setup.json` holds the edit afterwards.
- [unverified] An invalid setup (refresh `0`) is refused at the project save with the dialog naming the field, and nothing is written; what the Designer does with the rest of that project save.
- [unverified] With `MapEditor` removed from full editing and saved (story 6 applies it without a Gateway restart; reload the view), `map.load` for `mapeditor` reports level `none`; restoring the role brings back `full`; `git diff ops/project` shows only the changed line.
- [unverified] An inherited setup shows "Inherited from <project>" and a save makes this project's own copy.

## Epic 2 story 10 - serving the icon set and checking kind icons

**Question (epic-map-store-and-data, entry 10, phase B):** does the Gateway serve the module's icon files under `/res/mapstudio/icons/` with content types a browser can use, and does a kind naming an unknown icon reach `map.load` and the log as planned? **Answer:** yes **[live 8.3.10]**, on the `ms-e2s10` dev Gateway (port 9132, fresh volumes), 2026-10-27.

- The module's mounted folder serves `mapstudio-icons.svg` as `Content-Type: image/svg+xml`, `icons.json` as `application/json` and `contact-sheet.html` as `text/html`, each `200` with `X-Content-Type-Options: nosniff`; a missing file is `404` **[live 8.3.10]** (curl and `e2e/tests/icons.spec.mjs`). So `<use href>` to the sprite, `fetch` of the catalogue and the contact sheet work as served; no content-type mapping is needed in the module. The contact sheet screenshots in `docs/icons.md` now come from the Gateway.
- With the dev adapter in mode `unknown-icon` (pad kind naming `wel-pad`), `map.load` kept all 3 kinds at `ok` and the kind message ended "Kind pad names icon wel-pad, which Map Studio does not have; it shows as a plain point."; the Gateway log got one warning ("Kind pad names an icon Map Studio does not have.", as `M.adapters`), and one info line when mode `ok` cleared it; no log line held the icon name **[live 8.3.10]**.

## Epic 2 story 15 - tag browse from the Gateway

**Question (story 15, Tasks):** can the module list tag providers and browse one folder from its Gateway scope with the session user's roles, how is the project's default provider found, what does an unknown folder answer, and how fast is an existence check of many tag paths? **Answer:** yes; the code follows what the check found **[live 8.3.10]**. Date: 2026-10-27 (UTC). Gateway: `inductiveautomation/ignition:8.3.10`, container `ms-e2s15` on port 9131, fresh volumes, module built from this branch with a throwaway check class (removed before the commit; it ran 40 s after module start and logged `TAGCHECK` lines), then `e2e/tests/tags.spec.mjs` 3 of 3 and the whole suite (28 passed, the 5 `store-ops` skipped).

How: the dev stack seeds a `default` tag provider on a fresh volume (`ops/config/core/ignition/tag-provider/default`, `tag-type-definition/default/udts.json` with the UDT `Pad`: memory tags `Pressure` Float8, `Flow` Float8, `Comms` Boolean; `tag-definition/default`: `Mesa/P12` and `Mesa/P14` instances of `Pad`, `Mesa/P15` a folder with `Flow` only, `Mesa/Lines/L3/Flow`, `Plant/Header/Pressure`, and `Plant/Secret/Code` whose `readPermissions` require a role nobody has). The seed loaded with no error; the files are copied by the init container as story 3's connections are. Test equipment: Map Studio never writes a tag.

- `GatewayTagManager.getTagProviderNames()` gave `[default, System]` **[live 8.3.10]**; story 3's fresh Gateway had only `System`, so the provider comes from the seed.
- `ProjectManager.getProjectProps("mapstudio-dev").getDefaultSQLTagsProviderName()` returned an empty string for the dev project **[live 8.3.10]**, so the owner's fallback applies there: `default`, present, is marked `isDefault`. A project that names its default provider is unit tested only (`TagLookupsTest`) **[unverified live]**.
- `getTagProvider("DEFAULT")` returned the `default` provider and `getTagProvider("nope")` null; the manager's two-argument `browseAsync` on `[DEFAULT]Mesa` answered as `[default]Mesa`, on `[nope]Mesa` it failed with "Provider 'nope' not found" **[live 8.3.10]**. Provider names are case-insensitive.
- Path segments are case-insensitive too: `[default]mesa/p12` listed P12's members, each `getFullPath()` in the stored case (`[default]Mesa/P12/Pressure`) **[live 8.3.10]**. So `tags.resolve` compares the provider and the base path's segments without case and keeps the picked path's case in the suffix.
- `TagProvider.browseAsync(path, new BrowseFilter(), SecurityContext)` goes one level deep: the root of `default` gave `_types_`, `Mesa`, `Plant`; `Mesa` gave `Lines` (Folder), `P12` and `P14` (UdtInstance), `P15` (Folder); `[System]` gave `Gateway` **[live 8.3.10]**.
- A UDT instance's browse lists its members (`AtomicTag` with `getDataType()` `Float8` or `Boolean`, `hasChildren()` false, full path set) and one node `Parameters` (`TagObjectType.Node`, data type Document, `getFullPath()` null); the reply leaves out property nodes and nodes without a full path. `getDataType()` is `String` for a folder and an instance, so the reply sends `dataType` null for anything but a tag **[live 8.3.10]**.
- Browsing a tag (`[default]Mesa/P12/Pressure`) lists its properties (`ValueSource`, `EngHigh`, `Quality`, `value`, ...; `TagObjectType.Property`, no full path); left out, so a tag browses as empty **[live 8.3.10]**.
- An unknown folder (`[default]Mesa/Nope`) answers result quality `Bad_NotFound` with no results; the reply is `invalid` naming the folder **[live 8.3.10]**.
- `SecurityContext.fromRolesAndZones(["MapEditor"], [])`, an empty roles list and `SecurityContext.systemContext()` all listed `Plant/Secret/Code`, whose `readPermissions` require the role `Nobody` **[live 8.3.10]**. So browse does not hide a tag for its read permissions; the module still browses under the session user's roles (owner decision 2026-10-27), and a provider or tag setting that does hide tags from a browse is **[unverified]**. Whether the Gateway applied that `readPermissions` setting at all is **[unverified]** (no value was read to see it refused). Security zones are not read from the session; the module passes none **[unverified]** whether a zone-scoped permission would then hide a tag.
- `BrowseFilter.setMaxResults(1)` on the root returned 1 result with `getTotalAvailableSize()` 0 and continuation point `"1"` **[live 8.3.10]**: no total is reported, so the module asks for 1001 and reports `truncated` when more than 1000 come back. The order the browse returns is not stated (`_types_` came before `Mesa`); the reply sorts by name, ignoring case first.
- Timing on the dev Gateway: a root or folder browse 0 to 10 ms, P12's members 7 ms (0 ms the second time); existence of 3 paths: `getTagConfigsAsync` 3 ms, one browse per parent 5 ms; of 300 paths (3 existing, 297 under missing parents): `getTagConfigsAsync` 6 ms, 300 parent browses one after the other 55 ms **[live 8.3.10]**. `getTagConfigsAsync` answers a missing tag with a model of type `Unknown` but takes no `SecurityContext`, so the module checks existence by browsing each distinct parent folder once, all at once, within one 5 s deadline, under the session user's roles.
- The `tags.browse` and `tags.resolve` round trips through a real Perspective session, a phone editor's and an anonymous viewer's `role`, and N of M for three pads linked to P12, P14 and P15 (P15 lacks `Pressure`) are in `e2e/tests/tags.spec.mjs` **[live 8.3.10]**. A slow tag system (`tags-unavailable` after 5 s) is unit tested only **[unverified live]**. The Gateway log showed no `M.tags` line during the suite.

## Epic 2 story 9 - kind setups and item checks, live

**Question:** do kind setups saved through `edits.apply` and `system.mapstudio.applyEdits` reach the `mapstudio_kind_setup` table and come back unchanged in `map.load` and `getMap`, and are map items checked against the project's cached kind list inside the save? **Answer:** yes **[live 8.3.10]**, on the `ms-e2s9` dev Gateway (fresh volumes), 2026-10-27, `e2e/tests/kindsetup.spec.mjs` (5 tests) with the full suite passing (30 passed, 5 skipped: the store-check scenarios).

- A pad kind setup with comms `{asset.path}/Comms`, a KPI on `[default]Shared/GasPrice`, a Bands rule, `popupView` params including `{asset.path}/Pressure`, and the link `/pad/{item.name}`; a line kind setup with a States rule on line presets; a geofence (an area kind, `area: True` in the dev adapter) setup with `areaTints`: each returns unchanged in `map.load.reply.kindSetups` (full and phone editors) and, for the pad, in `getMap(project).kindSetups` from a Perspective session script (a Jython `PyList` attribute read as `.kindSetups`) **[live 8.3.10]**. A viewer's `map.load.reply` has no `kindSetups` **[live 8.3.10]**.
- psql after the first full run and a rerun of two specs: one `mapstudio_kind_setup` row per kind (`geofence` v2, `line` v2, `pad` v9) and one `kindSetup` edit record per saved op (13 rows, versions 1 to 9 for `pad` with no gap, actor and source `session` or `script` as sent); `mapstudio_schema_version` holds only version 1 (no migration) **[live 8.3.10]**.
- Refused with code `invalid`, nothing written and `seq` unchanged: an unknown placeholder in the link or a param, a param mixing text and placeholders (`P-{item.name}`, `{item.name}/Pressure`), a param named `mapItem`, the presets `red` and `#ff0000`, a line preset on a point kind, bands out of order, `cases` on an expression rule, `tint-9`, `areaTints` on a non-area kind; a map item of an unknown kind, a `Point` on a line kind, `wells: "abc"`, an unknown property key, an override with an `{asset.path}/...` tag path **[live 8.3.10]**. A stale kind setup update is a `conflict` carrying the stored kind setup record **[live 8.3.10]**; a phone editor's kind setup op is refused `role` **[live 8.3.10]**.
- CSV-style values: `wells: "12"`, `diameter: " 4.5 "`, `buried: "true"` are stored and returned as 12, 4.5 and true, through `edits.apply` and through `applyEdits` **[live 8.3.10]**.
- A viewer (level `none`) open on the map applies a batch holding a kind setup op from a script (`changes.spec.mjs`, its `map.changed` sent without the setup) with no reload (`data-map-reloads` 0) **[live 8.3.10]**; that the viewer's copy has no `setup` is unit tested (`MapStudioDelegateTest`) and, since story 12, checked on the viewer's websocket frames in `changes.spec.mjs` (2026-10-27) **[live 8.3.10]**.
- With the dev adapter in mode `empty` a save other than a delete is refused `invalid`, "The kind list is not available (empty): The kind function mapstudio_dev.kinds returned no kinds. Nothing was saved." (`WriteServiceKindCheckTest`; live in `e2e/tests/adapters.spec.mjs` since story 12, 2026-10-27) **[live 8.3.10]**.
- `ops/store-checks.sh` (rights, partial, healed, newer) passes unchanged with this story's store statements **[live 8.3.10]**; its scenarios save map items only, so a kind setup saved by the least-privilege runtime role is **[unverified]** (that role's grants cover every `mapstudio_` table, `mapstudio_kind_setup` included).

## Epic 2 story 8 - unsaved edits in the browser

**Question:** can the browser keep a batch the Gateway did not answer and send it again later, keyed per project and user, and what does the Perspective client tell the component about its project and its connection? **Answer:** yes. Date: 2026-10-27. Gateway: `inductiveautomation/ignition:8.3.10`, container `ms-e2s8` on port 9128, module built from this branch; Chromium from `/opt/pw-browsers`.

- `component.view.page.parent.projectName` (the `ClientStore`, read from the store delegate's `component`) is the project name, `mapstudio-dev`: the e2e suite found the editor's queue under `mapstudio.unsaved.v1:mapstudio-dev:mapeditor` **[live 8.3.10]**.
- `map.load.reply`'s new `user` is the session user name at level `full` (`mapeditor`) and `phone` (`mapoperator`), and absent for an anonymous viewer at level `none` **[live 8.3.10]** (`StoreReplyPerCallTest`; phone and none live in `e2e/tests/tags.spec.mjs` since story 12, 2026-10-27). A signed-in user without an editing role (level `none`, a user name to leave out) is unit tested only: the dev stack has no such user **[unverified]** live.
- `ClientStore.connection.connected` (`ChannelStore`) read `false` once the Gateway container was stopped: the line drawn then was kept at once with code `disconnected` ("Not saved - store unreachable (not connected to the Gateway)"), without waiting for the 15 s reply timer **[live 8.3.10]**. The draw tool stayed usable while Perspective was disconnected (owner decision 3: editing goes off only when `map.load` says the store is unreachable).
- Stopped-Gateway run (the plan's manual check, scripted as `MAPSTUDIO_GATEWAY_STOP=1 npx playwright test tests/unsaved.spec.mjs -g "Gateway stopped"`): map open as `mapeditor`, `docker stop ms-e2s8`, line drawn, kept; browser context closed; `docker start ms-e2s8`; a new signed-in context given the stored queue (as a reopened browser keeps its `localStorage`) opened the map, the replay saved the batch and `data-items-loaded` rose by one. `ops/psql.sh`: `mapstudio_batch` holds batch `a86b5c2c-f719-443d-81a2-fee5ad4d34bf`, actor `mapeditor`, seq 38, with one `mapstudio_edit` row **[live 8.3.10]**. A real browser closed and reopened (rather than a context given the stored queue) is **[unverified]**.
- No answer at all (the save frame dropped on its way to the Gateway by Playwright's `routeWebSocket`): after 15 s the entry is `unsent` with code `timeout`, "Store unreachable - 1 edit not saved"; a new page of the same context replays it on `map.load` and a resend of the stored batch through the test hook gets `edits.apply.reply` for the same `batchId` (story 2's retry rule) **[live 8.3.10]**, at 1440 and 390 px.
- A stored stale update (baseVersion 1, item at 2) replayed on reload is refused `conflict`, listed as "Not saved - conflict with mapeditor's change." with the Gateway's sentence, and Discard empties the stored queue **[live 8.3.10]**.
- `store-unreachable` at load (`ops/store-checks.sh`, scenario `rights`): `data-items-loaded` 0, `data-editing="off"`, the draw button disabled **[live 8.3.10]**.
- Not seen live: whether Chromium's offline emulation (`context.setOffline`) closes an open Perspective websocket **[unverified]** (not relied on); a `storage` event between two real tabs **[unverified]** (unit tested over a shared fake store); a browser whose `localStorage` throws (unit tested).
- Screenshots (`e2e/out/screenshots`, not committed): `mapstudio-unsaved-kept-{1440,390}.png`, `mapstudio-unsaved-replayed-{1440,390}.png`, `mapstudio-unsaved-conflict-{1440,390}.png`, `mapstudio-unsaved-gateway-stopped-1440.png`.

## Epic 2 story 14 - instruments on lines, live

Date: 2026-10-27, on the `ops/` dev stack of this worktree (`MAPSTUDIO_CONTAINER=ms-e2s14`, port 9134), `inductiveautomation/ignition:8.3.10` and `postgres:16-alpine`.

| Check | How | Seen |
| --- | --- | --- |
| Upgrade from schema 1 with data | the stack built from the branch before this story, `ops/up.sh --fresh`, `writepath.spec.mjs` and `kindsetup.spec.mjs` run (9 map items saved), then this story's build with `ops/up.sh` on the same volumes | `Map Studio upgraded its map store schema on database connection MapStudio: applied version(s) [2], now at schema version 2.`; `mapstudio_schema_version` holds 1 and 2; the 9 items read back with `attachment` null (`count(attachment)` 0); the whole e2e suite then ran on that volume **[live 8.3.10]** |
| Upgrade by a role that does not own the tables | `ops/store-checks.sh upgrade`: schema 1 and one item created by the owner role `mapstudio`, the connection's role `mapstudio_check` given SELECT, INSERT, UPDATE, the sequences and CREATE on the schema | one error line: `... migration 2, statement 2 of 5 (ALTER TABLE mapstudio_item ADD COLUMN attachment jsonb) failed with SQLState 42501, the database role lacks ownership of the table: ERROR: must be owner of table mapstudio_item`; the version stays 1 and no `attachment` column exists; after `ALTER TABLE ... OWNER TO mapstudio_check` and the 65 s retry interval, with no restart, `upgraded ... applied version(s) [2], now at schema version 2.`, the item kept with `attachment` null, both new indexes present **[live 8.3.10]** |
| Schema and index | `ops/psql.sh`: `\d mapstudio_item`; `EXPLAIN` of `liveAttached`'s query with `enable_seqscan` off | `attachment jsonb` and `mapstudio_item_attached_line btree (project, (attachment ->> 'lineId')) WHERE attachment IS NOT NULL AND NOT deleted`; the plan is an `Index Scan using mapstudio_item_attached_line` (on the tiny dev table the planner picks a sequential scan when allowed, so the index use is shown with it off) **[live 8.3.10]** |
| The I/O matrix through the session | `e2e/tests/instruments.spec.mjs` (8 tests): save and read back, bad attachments (not an instrument kind, past the end, 5 m off, attached to a point, negative distance), a line moved or deleted without its instruments, the reshape with both instruments, a conflict on an instrument, the `instruments` style source on `line` and refused on `pad`, a phone editor refused `role` moving an instrument and saving its properties, `applyEdits` and `getMap` from a script | all pass, on the upgraded volume and on a fresh one **[live 8.3.10]** |
| Delete and its reverse are one seq each | psql after the fresh run: `SELECT seq, op, entity_id, version FROM mapstudio_edit WHERE seq IN (19, 20)` | seq 19: three `delete` rows (the line and both instruments, version 2); seq 20: three `create` rows (version 3), the restore at the tombstones' versions **[live 8.3.10]** |
| Store checks | `ops/store-checks.sh` (rights, partial, healed, newer, upgrade) | all pass; `healed` now applies `[1, 2]`, `newer` says "newer than this module knows (2)" **[live 8.3.10]** |
| Bundle | `measures.spec.mjs` | `MapStudio.js` served at 1,209,432 bytes **[live 8.3.10]**; the build before this story made 1,209,165 bytes **[build]**; nothing in the component imports the geometry module yet, so Turf is not bundled |

## Dev stack - Designer saves into the bind-mounted project

Date: 2026-10-27, on the `ops/` dev stack of this worktree (`MAPSTUDIO_CONTAINER=ms-dsave`, port 9136), `inductiveautomation/ignition:8.3.10`. Reported by the owner on a laptop: every Designer save of `mapstudio-dev` failed with `PushException: I/O error during prepare: .../projects/mapstudio-dev/com.aoindustrial.perspective.mapstudio/setup/setup.json.tmp` (`AtomicPushValidationHandler.throwIfInvalid`, `IgnitionProjectManager.push`). No one here can run a Designer, so the save itself stays **[unverified]**; the file writes below are the same Gateway-side push.

**Cause.** The project is bind-mounted from `ops/project`, whose files belong to the developer (mode 644 and 755), and the Gateway ran as the image's own user `ignition`, uid 2003, gid 2003 (`docker image inspect`: `User` is `2003:2003` **[observed in the 8.3.10 image]**). A push writes each resource through a `.tmp` beside it, so it needs write on the resource folder, which uid 2003 does not have on a folder owned by another uid with mode 755. The Gateway could not write any resource into the project, views included, which is also why `ops/project` never collected the Gateway's thumbnails or `session-props` that `.gitignore` expects.

**Fix.** The image's entrypoint (`/usr/local/bin/docker-entrypoint.sh`) supports `IGNITION_UID` and `IGNITION_GID` when the container starts as root: it remaps the `ignition` user (`usermod`/`groupmod` when the ids are free, a warning when they are taken), re-owns the install and the data volume (`find ... ! ( -user uid -group gid )`, then `chown -hRP`) and steps down with `gosu uid:gid` before starting the Gateway; both variables must be set, one alone is refused; `IGNITION_UID=0` keeps root **[observed in the 8.3.10 image]**. `ops/lib.sh` records `id -u` and `id -g` as `IGNITION_UID` and `IGNITION_GID` in `.env` on the next run, `docker-compose.yml` starts the Gateway as `user: root` with both variables, the init container chowns the volume to the same ids, and `ops/up.sh` recreates a running Gateway container whose `Config.User` is not `root` instead of restarting it (a restart keeps the old container configuration). Nothing is made world-writable, and the init container never mounts the repository. The entrypoint's `chown -hRP` does recurse into the bind-mounted projects: `ops/store-checks/project`, root-owned on this box and mounted into the Gateway by the store checks, came out 1000:1000 after the container was created with `IGNITION_UID=1000` **[live 8.3.10]**. With the developer's own ids (what `ops/lib.sh` records) that is a no-op on the repository.

| Check | How | Seen |
| --- | --- | --- |
| Reproduce, as the runtime user | `docker exec ms-dsave touch <setup>/setup.json.tmp` on the unfixed stack (`ps`: `tini` and `java` run as 2003:2003), with `ops/project` owned by root (this box) and then by uid 1000 (a laptop) | `Permission denied` both times; the same `touch` in the Gateway's own volume (`data/config`) succeeds **[live 8.3.10]** |
| Reproduce, a Gateway-side push | `PUT /data/api/v1/projects/mapstudio-dev` with the dev API key and a changed `description` | the route answers `{"success":true,...}` HTTP 200, but the log has `E [g.IgnitionProjectManager] Error writing collection manifest file ".../mapstudio-dev/project.json": java.nio.file.AccessDeniedException` and the host file is unchanged **[live 8.3.10]** |
| Fix, start-up | `.env` with `IGNITION_UID=1000`, `IGNITION_GID=1000`, `ops/project` owned by 1000:1000, `ops/up.sh --no-build` on the running stack | "The running Gateway container predates the uid mapping; recreating it", then the entrypoint: `WARNING: uid=1000 conflicts with existing user 'ubuntu'` (and the group), `Adjusting ownership of 1938 Ignition installation files to uid=1000,gid=1000.` (2 m 36 s on this box, on every container creation, not on a restart), `Staging user step-down from root to uid=1000,gid=1000`; `ps`: `tini` and `java` as 1000:1000; the kept volumes carried on (commissioned, module accepted, users present) **[live 8.3.10]** |
| Fix, as the runtime user | the same `touch` | created **[live 8.3.10]** |
| Fix, a Gateway-side push | the same `PUT` | `project.json` on the host rewritten by the Gateway, owner 1000:1000, mode 644, no error in the log; restored from git and `ops/scan.sh` afterwards **[live 8.3.10]** |
| Nothing else broke | `cd e2e && npm ci && npm test` and `ops/store-checks.sh` on that stack | e2e: 55 passed, 7 skipped (the store-ops scenarios), 11.3 min **[live 8.3.10]**. Store checks: the first run failed the `rights` count only, "expected exactly one log line ... found 2", the same error line twice 31 s apart after the scenario's restart (the container log was gone by then; cause not established); `ops/store-checks.sh rights` and then the whole set again, with the Gateway log captured: one line per Gateway start, "All store checks passed: rights partial healed newer upgrade" **[live 8.3.10]** |

- A root checkout (uid 0, as on this box's main checkout) runs the Gateway as root inside the container; the entrypoint does not step down for uid 0 **[observed in the 8.3.10 image]**, and the files it writes are root-owned like the rest of the checkout. The uid 0 run itself was not made here **[unverified]**.
- macOS (Docker Desktop) and WSL: not run here **[unverified]**. On Docker Desktop the bind mount shows the host user's ids through virtiofs, so the same mapping applies; `id -g` there is 20 (`staff`), which the image already uses for `dialout`, so expect the "conflicts with existing group" warning and nothing else.
- The `PUT /data/api/v1/projects/{name}` route replaces the project record: a body without `title` blanked it **[live 8.3.10]**. Send the whole record.

### Project Properties - User Source "" not found

Opening Project Properties for `mapstudio-dev` in the Designer logs `RpcException: IllegalArgumentException: User Source "" not found` from `UsersRpcImpl.getRoles` (owner's report **[unverified]** here). What the jars say **[observed in the 8.3.10 image]**: the platform's `ignition/global-props` resource (`GlobalProps`, binary `data.bin`) carries `authProfileName`, the project's legacy user source, beside `identityProviderName`; the Designer's `ProjectGlobalPropsPanel` (Project > General) edits it with a `UserSourceProfileDropdown`, and `PermissionsPropsPanel` (Project > Permissions: required view, save and delete roles) is what calls `getRoles` on it. The Vision module has its own `com.inductiveautomation.vision` general, login and launch props resources, but its login panel has no user source field in 8.3 (an identity provider and an auth strategy), so the field is the platform's, not Vision's. The dev project had `userSource` empty (`GET /data/api/v1/projects/find/mapstudio-dev`: `"userSource":""`), and the Gateway has an internal user source named `default`, the one behind the identity provider `default` (`GET .../resources/list/ignition/user-source`) **[live 8.3.10]**. Set through the Gateway, never by hand: `PUT /data/api/v1/projects/mapstudio-dev` with the full record plus `"userSource":"default"` (the body schema in `/openapi.json` lists `userSource`, "the default user source for this project"), after which `find` answers `"userSource":"default"` and the Gateway rewrote `ops/project/ignition/global-props/data.bin` (442 bytes, now committed) **[live 8.3.10]**. The dialog opening without the error is **[unverified]**. A fresh volume whose only identity provider was `temp` (Epic 2 story 1) may name its user source differently; `ops/users.py` prints the user source it found.

**Owner's check on the laptop (2026-10-27)** **[owner, seen in the Designer 2026-10-27]**: after `ops/up.sh` with the uid mapping (uid 1000, no `--fresh`) and the earlier `chmod` workaround reverted, a Designer save of the Map Studio Setup wrote `ops/project/com.aoindustrial.perspective.mapstudio/setup/{resource.json,setup.json}` owned by the developer (`ubuntu:ubuntu`, mode 644) with no error, and Project Properties > Project > General opened with user source `default` and no `User Source "" not found` error. Earlier the same day, with the `chmod` workaround, the owner also saw: a refresh interval change saved and applied (one changed line in `setup.json`; Ignition adds `lastModification` attributes to `resource.json` on every save); `0` gave the reason as typed and the save was refused with a dialog naming the field; with `MapEditor` removed from full editing, `mapeditor`'s drawn line was refused for the role; Create setup on a scratch project wrote both files. Inheritance and the `system.mapstudio` autocomplete are not checked yet.

## Epic 2 story 12 - refactor sweep

Date: 2026-10-27, on the `ops/` dev stack of this worktree (`MAPSTUDIO_CONTAINER=ms-e2s12`, port 9137, fresh volumes), `inductiveautomation/ignition:8.3.10` and `postgres:16-alpine`. Cleanup only: no message type, field, error code, setup or kind setup field, migration or `system.mapstudio` function changed (the dev library gained `mapstudio_dev.holdsMapEditor`, below).

- **What changed.** One echo for browser text (`Rows.echo`: 64 characters, control characters to `?`) now also in the tag lookups' messages (they cut at 80 and kept newlines); `TagPaths` uses `Placeholders.ASSET_PATH`; a kind setup conflict names the kind's display name ("The Well pad kind setup ...", the kind id when the kind is not in the list) **[build]**, and the display name in a stale update's message **[live 8.3.10]** (`kindsetup.spec.mjs`); one `RoleMatrix.isEditor`; story 1's `StoreRegistry.rightsMessage` and its copies of `FailureLine`'s helpers removed; three ordering sleeps in `AdapterServiceTest` replaced by the test pool's task counts, and a race in its deadlock test (an instant kind answer could settle before the asset step was chained; 1 failure in 20 runs) closed with a latch; one `isRecord` (`web/typescript/json.ts`); one e2e `drawLine` and `VERTEX_PAUSE_MS` (`e2e/tests/fixtures.mjs`); one dev role check, `mapstudio_dev.holdsMapEditor(session)`, for the nine dev view scripts.
- **Closed by e2e assertions** **[live 8.3.10]**: `map.load.reply` names the phone editor and has no `user` for an anonymous viewer (`tags.spec.mjs`); a phone editor's open map receives `map.changed` (`changes.spec.mjs`); a viewer's `map.changed` for a kind setup op carries no `setup` on the websocket (`changes.spec.mjs`); a save with the kind list empty is refused and leaves `seq` and the item count unchanged (`adapters.spec.mjs`). The story 4 gap reload line now points at `unsaved.spec.mjs`, which drops a `map.changed` live (gap detection and the `map.load` it sends; that reply is faked).
- **Results.** Gradle `clean build`: common 87, gateway 269, designer 34 tests (baseline 86, 267, 34); Jest 145 (baseline 144); e2e 55 passed, 7 skipped (the store-check and Gateway-stop specs, run by their own scripts); `ops/store-checks.sh`: rights, partial, healed, newer, upgrade pass; `AdapterServiceTest` 20 runs in a row, all passed **[build]** **[live 8.3.10]**. Gradle warnings: the two known ones (`Project.getProperties`, `Task.project` at execution time), none naming our scripts. `npm audit`: `web/` 8 (5 moderate, 3 high, all through `perspective-client`, as recorded), `--omit=dev` 0, `e2e/` 0. No Map Studio error in the Gateway log during the suite (the transient `org/postgresql/Driver$1` at start, check 5, and the dev adapter's own `broken` mode warnings only).
- **Owner's Designer check (2026-10-27)** **[owner, seen in the Designer 2026-10-27]**: the Map Studio Setup tab opened on 8.3.10 and showed the dev setup's values correctly; the save failed on a dev-stack file permission, fixed in a separate change. Recorded under story 7 above and in [setup-editor.md](setup-editor.md). The other story 7 steps and the Designer autocomplete check stay open.
- **Found already done:** the index on `mapstudio_edit (project, entity, entity_id)` (story 2's carry-over) was added by migration 2 (`mapstudio_edit_project_entity`, story 14), so it needs no later migration.

## Epic 2 story 16 - setup lists from the Gateway

**Question (story 16, Tasks):** can the module answer the Designer setup form's Gateway lists (database connections, the project identity provider's roles, secret providers and their secret names) through one module RPC, names only and never a secret value, and who can call it? **Answer:** the Gateway half is checked live; the Designer half is the owner's check. Date: 2026-10-27 (UTC). Gateway: `inductiveautomation/ignition:8.3.10`, container `ms-e2s16` on port 9138, fresh volumes, the module built from this branch with a throwaway check class (it ran 40 s after module start and logged `SETUPCHECK` lines at info, names counted and never printed for secrets; removed before the commit), then the suite on the module without it.

What the code relies on, read from the 8.3.0 SDK jars **[SDK 8.3.0 javap]**: `GatewayModuleHook.getRpcImplementation()` returns `Optional<GatewayRpcImplementation>`, made with `GatewayRpcImplementation.of(ProtoRpcSerializer.DEFAULT_INSTANCE, impl)`; `RpcDelegate` routes the methods of the one interface annotated `@RpcInterface(packageId)` that the implementation class implements, marks a method callable from a Vision client only with `RpcDelegate.RunsOnClient(clientPermissionId)`, and gives the caller through `RpcDelegate.session()` (a `ClientReqSession` with `isDesigner()`); the Designer calls it with the static `GatewayConnection.getRpcInterface(ClientRpcSerializer, moduleId, Class<T>, timeoutMs)`, whose client posts to `/data/rpc/<moduleId>/<packageId>/<function>` with the headers `X-Ignition-Session` and `X-Ignition-Scope`. `SecretProvider.list()` is a default method that may throw `SecretProviderException`; `SecretProvider.read(name)` returns the value as `Plaintext`, and the module never calls it.

| Check | How | Result |
| --- | --- | --- |
| The RPC is registered | `GatewayRpcImplementation.getRpcRouter().getRpcHandler(new RpcCall(MODULE_ID, "mapstudio-setup", f))` in the check class | a handler for `lists` and `secretNames`, none for an unknown function **[live 8.3.10]** |
| Who it is offered to | the handler's `clientPermissionId()`, `isActiveNodeRequired()`, `requiredMutabilityMode()` | `null` (no `RunsOnClient`: not offered to a Vision client), `true` (a redundant backup refuses it), `OFF` **[live 8.3.10]**; what a real Vision client gets back is **[unverified]** (no Vision client on the dev stack); the module refuses any caller whose session is not a Designer's itself (`DesignerCaller`, `SetupLookupsTest`) |
| A caller with no session | `curl -X POST /data/rpc/com.aoindustrial.perspective.mapstudio/mapstudio-setup/lists` | HTTP 403 "Missing session ID", before the module is reached; the same for an unknown function **[live 8.3.10]** |
| A caller with a made-up session | the same with `X-Ignition-Session: made-up` and `X-Ignition-Scope` `C` or `D` | HTTP 403 "Invalid session" **[live 8.3.10]** |
| The lookup outside an RPC call | `SetupLookups.lists("default")` from the check class (no RPC context) | refused, `SecurityException` "Only a Designer may ask for the setup lists.", one warn line in `MapStudio.setup-lookups` naming no value **[live 8.3.10]** |
| Database connections | `DatasourceManager.getDatasources()` | `MapStudio` and `MapStudioCheck`, both vendor `POSTGRES`, in 0 ms **[live 8.3.10]** |
| The project's identity provider | `data/config/resources/core/ignition/identity-provider/default/config.json` in the container; the dev project has no Perspective general properties resource | one identity provider `default` of type `internal` naming `"userSource": "default"`; so the dev project uses `default` (Perspective's own default, **[unverified]** in a Designer) **[live 8.3.10]** |
| Roles of the identity provider `default` | `UserSourceManager.getProfile("default").getRoles()` | `Administrator`, `MapEditor`, `MapOperator`, in 0 ms **[live 8.3.10]** |
| A name with no user source | `getProfile("Default")`, `getProfile("nope")` | each throws `IllegalArgumentException` (not null): names are compared with case. The module answers that list `not-listed`, so the form says "This identity provider does not list its roles. Type them." **[live 8.3.10]**; an internal identity provider whose user source has another name than its own is listed as not-listed too **[unverified]** whether 8.3 allows that; an OIDC or SAML provider has no user source of its name **[unverified live]** |
| Secret providers | `SecretProviderManager.getProviders()` | one, `MapStudioFiles` (the dev stack's file provider, `ops/config/core/ignition/secret-provider`, class `SecretProviderManagerImpl$RunningSecretProvider`, resource type `ignition/secret-provider`), in 0 ms. A fresh 8.3.10 Gateway has no built-in secret provider of its own: nothing else is listed **[live 8.3.10]** |
| `list()` of that provider | `ManagedSecretProvider.list()` | 1 secret name, in 0 ms (counted, not printed); a provider name the Gateway does not have: `getProvider` empty **[live 8.3.10]**. A provider whose `list()` throws is unit tested only (`SetupLookupsTest`) **[unverified live]** |
| No value read or logged | `IgnitionLookupSourceTest` (proxies whose `read` fails the test; a check that the lookup package names no `.read(`, `Plaintext`, `decrypt`); `git grep -n 'read(' -- gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/setuplookup`; the Gateway log and `e2e/out` searched for the dev secret's value after the suite | no match **[build]** **[live 8.3.10]** |
| Deadline | each list on its own pool thread with one 5 s deadline (`SetupLookups`) | live answers took 0 ms; a slow list is unit tested (`aSlowProviderIsUnavailableAfterTheDeadlineAndHoldsNothingElse`) **[build]** |

The Designer half, for the owner's session (plan, manual checks), each **[not verified]** until marked **[owner, seen in the Designer, <date>]**:

- [not verified] `GatewayConnection.getRpcInterface` with the module id reaches the RPC from the Designer, and the lists load within a few seconds of opening the tab.
- [not verified] The project's identity provider is read from the Perspective general properties resource (`idp`), `default` when it has none.
- [not verified] `DesignableProject.getResourcesOfType(ScriptLibrary.RESOURCE_TYPE)` includes inherited scripts.
- [not verified] With no setup, double-click opens a "Map Studio Setup" tab that is not a resource editor (the SDK's `ResourceEditor` cannot open a missing resource); its close button closes it; File > Save with a new setup without reasons creates `com.aoindustrial.perspective.mapstudio/setup/` in that same save.
- [not verified] A refused save (a reason left) shows the Designer's standard save failure and no Map Studio dialog; what the Designer does with the rest of that save.

## Epic 2 story 13 - release 0.2.0 rehearsal on the template stack

**Question (story 13, owner decisions 1 and 4, 2026-10-27):** does a 0.2.0 build, installed through `ign-scada-template`'s module lock on its 8.3.9 test stack, migrate an empty database, save through the browser write path with role checks, push `map.changed` across browsers and keep the edit over a Gateway restart; and do the live checks the refactor sweep could not make hold there? **Answer:** yes for every check below; two findings. Date: 2026-10-27 (UTC). Steps, commands and screenshots: [template-install.md](template-install.md), "0.2.0 rehearsal".

Labels: **[live 8.3.9, rehearsal, throwaway-signed]** seen on the template's test stack (`ign-og/ignition:8.3.9-modules`, compose project `ign-og-test`) with this branch's 0.2.0 build signed by a throwaway certificate, before the tag. The real release repeats them; until then nothing here is **[live]** for the published asset.

| Check | Result |
| --- | --- |
| Module on 8.3.9 by the lock | `modl.py fetch` and the template's bootstrap installed it; `smoke.sh` `ok module`; log `Starting up module ... v0.2.0` **[live 8.3.9, rehearsal, throwaway-signed]** |
| Migration on an empty database | schema 1 and 2 recorded on the first `map.load` after the connection appeared, six `mapstudio_` tables owned by the connection's role **[live 8.3.9, rehearsal, throwaway-signed]**; `module_version` recorded `dev` (finding) |
| `map.changed` across browsers | a line saved in one browser was drawn in a second browser of the same user without a reload, within 0.12 s **[live 8.3.9, rehearsal, throwaway-signed]** |
| Over a Gateway restart | after `docker compose restart`, the line is in `map.load` and drawn; its `mapstudio_edit` row names `render-engineer`, source `session` **[live 8.3.9, rehearsal, throwaway-signed]** |
| A signed-in user without an editing role (closes the sweep's item) | `render-pumper`: level `none`, save refused `role`, nothing written **[live 8.3.9, rehearsal, throwaway-signed]** |
| A phone editor's line | `render-operator`: level `phone`, the line refused `role`, nothing written **[live 8.3.9, rehearsal, throwaway-signed]** |
| A `storage` event between two real tabs (closes the sweep's item) | the second tab listed the first tab's queued batch at once and saved it once after its next `map.load`; it does not replay on its own timer (finding) **[live 8.3.9, rehearsal, throwaway-signed]** |
| A real browser closed and reopened with an unsaved edit (closes the sweep's item) | the queued line was replayed under its own id after the browser profile was opened again and signed in **[live 8.3.9, rehearsal, throwaway-signed]** |
| Another project's maps get no `map.changed` (closes the sweep's item) | an open map of a second project on the same connection got no `map.changed` frame and kept its `seq` **[live 8.3.9, rehearsal, throwaway-signed]** |

Still open after this rehearsal: `onShutdown` on page or session close, a redundant pair, a slow tag system, a kind setup saved by the least-privilege runtime role, the example adapters run live (the owner or later epics), and the owner's Designer session (gate G3).

Facts learned on 8.3.9, for claude-ignition-skills: a project copied in without `global-props/data.bin` but with its `resource.json` fails to start in Perspective (`NullPointerException`, `existingGlobalProps` is null) and needs a remove and rescan after the Gateway writes `data.bin`; a hand-written database connection resource without `attributes.uuid` is listed by `resources/list` but not loaded ("does not have required UUID attribute"); `GET /data/api/v1/projects/find/<name>` reads the project record whose `identityProvider` `PUT /data/api/v1/projects/<name>` sets (a `GET` of `/projects/<name>` itself answers 404) **[live 8.3.9]**.
