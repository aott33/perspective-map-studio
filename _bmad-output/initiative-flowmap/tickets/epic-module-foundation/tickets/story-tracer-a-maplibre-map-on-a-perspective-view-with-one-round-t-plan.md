---
title: 'Tracer: a MapLibre map on a Perspective view, with one round trip'
type: 'feature'
ticket: '1'
created: '2026-10-26'
status: done
baseline_revision: '64d282043a05625e38871d0bfbcb31ac7fd17736'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Map Studio has no code yet; every later story needs a module skeleton that builds, installs on a Gateway, draws a map in Perspective and talks to its Gateway side.

**Approach:** Scaffold the module in Map Studio's own layout, copying the working shape of Mustry's 8.3 module (build, hooks, web bundle, Docker dev Gateway) and IA's example's component model delegate for the round trip; draw a MapLibre map with fixed test data and send one message in the `{v, type, id, body}` envelope.

## Boundaries & Constraints

**Always:** Java 17; `io.ia.sdk.modl` 0.5.0; Node 22 fetched by the build; module id `com.aoindustrial.perspective.mapstudio`, name "Map Studio", component id `ao.mapstudio`; scopes common GD, designer D, gateway G; numeric module version; Apache-2.0 with a NOTICE file; theme tokens only, no colour literals beyond MapLibre's blank style background taken from a token; no em dashes; the envelope and error shape of AD-8.

**Never:** basemap tiles, Terra Draw, signing in CI or release jobs, Playwright suite, any change to `ign-scada-template`; no tag reads, database or host scripts (later stories); no copying Mustry's components, branding or EULA text.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Point click | `{v:1, type:"point.click", id:"<uuid>", body:{pointId:"p1"}}` | Reply `{v:1, type:"point.click.reply", id:"<same uuid>", body:{pointId:"p1", receivedAt:"<ISO UTC>"}}`; text shown on map and logged | No error expected |
| Unknown type | `{v:1, type:"nope", id:"x", body:{}}` | Reply `{v:1, type:"error", id:"x", body:{code:"invalid", message:"Unknown message type: nope"}}` | Logged at warn on `MapStudio.delegate`; no exception |
| Malformed message | missing `id` or `type` | Reply type `error`, code `invalid` | No exception escapes `handleEvent` |

</frozen-after-approval>

## Code Map

Reference repos (read only, never build from inside them) are cloned at `/tmp/claude-0/-home-user/d8fcc768-17a3-54cb-a35d-639787b0aa6c/scratchpad/refs/mustry` and `/tmp/claude-0/-home-user/d8fcc768-17a3-54cb-a35d-639787b0aa6c/scratchpad/refs/iaex/perspective-component`. Environment: JDK 17 at `/usr/lib/jvm/java-17-openjdk-amd64` (default `java` is 21), the Docker daemon is running, image `inductiveautomation/ignition:8.3.10` is pulled, IA's Nexus registries are reachable, and Chromium with Playwright is pre-installed (`require('playwright')` works; do not install browsers).

- Mustry `build.gradle.kts`, `settings.gradle.kts` -- root build to copy: plugin config, IA Nexus repos, numeric `moduleVersion`, `freeModule`, `skipModlSigning` unless signing properties, license file staging into module content.
- Mustry `common/.../MustryPerspectiveComponentsModule.java`, `comp/Components.java`, `src/main/resources/*.props.json` -- descriptor builder, `BROWSER_RESOURCES` at `/res/<alias>/<Bundle>.js`, schema loading, one `Components.ALL` list.
- Mustry gateway hook -- registers components on startup, removes on shutdown, `getMountedResourceFolder` "mounted", `getMountPathAlias`, `isFreeModule`, `isMakerEditionCompatible`.
- IA `gateway/.../RadGatewayHook.java`, `delegate/MessageComponentModelDelegate.java` -- `getComponentModelDelegateRegistry().register(id, Delegate::new)`; `handleEvent(EventFiredMsg)`, reply with `fireEvent`.
- IA `web/packages/client/typescript/components/Messenger.tsx` -- client `ComponentStoreDelegate`: `fireEvent`, `handleEvent`, `mapStateToProps`, meta `createDelegate`.
- Mustry `web/package.json`, `webpack.config.js`, `tsconfig.json`, `.npmrc`, `web/build.gradle.kts` -- bundle output `build/generated-resources/mounted`, UMD library, externals (React, ReactDOM, mobx, mobx-react, PerspectiveClient), node-gradle 7.1.0, Node 22, `modlImplementation(project(":web"))` in gateway.
- Mustry `docker-compose.yml`, `ops/lib.sh`, `ops/verify/project/` -- dev Gateway compose, external modules folder, unattended module acceptance by `data/modules.json` entry, project folder mounted into `data/projects`, session URL `/data/perspective/client/<project>`.
- Gotchas (Mustry AGENTS.md): component id must match in Java, TSX and both registrations; props schema with `additionalProperties: false`; project files read only at Gateway start; verify by rendering in a browser, never by a 200.

## Tasks & Acceptance

**Execution:**
- [x] `settings.gradle.kts`, `build.gradle.kts`, `gradle/wrapper/*`, `gradlew*` -- root build modelled on Mustry with Map Studio's ids, Ignition minimum 8.3.0, scopes, free module, signing skipped without properties.
- [x] `common/` -- `MapStudioModule` (ids, alias `mapstudio`, browser resources), `MapStudioComponent` descriptor for `ao.mapstudio`, `mapstudio.props.json` (closed schema, no props needed yet beyond style).
- [x] `gateway/` -- hook registering the component and its model delegate; `MapStudioDelegate` handling the envelope (`point.click`, unknown type, malformed) with logger `MapStudio.delegate`.
- [x] `designer/` -- hook registering the component in the Designer palette.
- [x] `web/` -- TypeScript and React component: MapLibre map, blank style, three fixed points and one line as GeoJSON layers, click sends the envelope through the client delegate, reply logged and shown as text; webpack, tsconfig, `.npmrc`, `build.gradle.kts`; unit test for the envelope builder and reply handling.
- [x] `ops/` -- `docker-compose.yml` on `inductiveautomation/ignition:8.3.10` with EULA, admin user and unsigned modules allowed (fallback: Mustry's dev keystore and signed dev build), external modules folder, unattended module acceptance, `ops/project/` holding a `mapstudio-dev` project with one view; scripts to build, stage and start.
- [x] `ops/screenshot.mjs` (or similar) -- headless Chromium captures the view at 1440 and 390 px after a point click; images saved to `docs/screenshots/`.
- [x] `LICENSE`, `NOTICE`, `README.md` -- Apache-2.0, MapLibre attribution, how to build and run the dev Gateway.

**Acceptance Criteria:**
- Given a fresh clone, when `./gradlew build` runs, then a `.modl` for `com.aoindustrial.perspective.mapstudio` is produced and a broken web build fails it.
- Given the dev Gateway, when the module is staged and the Gateway restarts, then Map Studio is running and its start-up logs show no Map Studio error.
- Given the `mapstudio-dev` view at 1440 and 390 px, when a point is clicked, then the map shows three points, one line and the reply text, with no console error, and both screenshots are in `docs/screenshots/`.

## Implementation Notes

- Build: root `build.gradle.kts` (plugin `io.ia.sdk.modl` 0.5.0, Gradle 9.8 wrapper copied from Mustry), `sdk_version` 8.3.0 so Java compiles against the declared minimum; `requiredIgnitionVersion` 8.3.0; `freeModule`; `skipModlSigning` unless `-Pignition.signing.keystoreFile`; `license.html` (own Apache-2.0 notice, not Mustry's EULA text) staged into the module and referenced from `module.xml`. A plain build writes `build/Map-Studio.unsigned.modl`. The `:web` project declares a Java 17 toolchain too, or Gradle on a newer JDK refuses it as a dependency of `:gateway`.
- `common/`: `MapStudioModule` (ids, alias `mapstudio`, `BROWSER_RESOURCES` at `/res/mapstudio/MapStudio.{js,css}`), `MapStudioComponent` (`ao.mapstudio`, Java2D palette icon), `Messages` (envelope keys, `mapstudio.message` event name, types `point.click`, `point.click.reply`, `error`, code `invalid`), `mapstudio.props.json` (closed schema, `style` only).
- `gateway/`: hook registers the descriptor and `MapStudioDelegate::new`; the delegate's `reply(JsonObject)` is a pure static method; nothing escapes `handleEvent` (RuntimeException caught twice: building the reply and sending it). Logger `MapStudio.delegate`. `receivedAt` is ISO 8601 UTC truncated to milliseconds.
- `web/`: TypeScript 4.9.5, webpack 5, React 16.14 as externals, `@inductiveautomation/perspective-client` pinned 2.3.10 (matches 8.3.10), `maplibre-gl` pinned 6.16.0. MapLibre 6 is ESM only, so `tsconfig.json` emits `es2020` modules for webpack and `tsconfig.test.json` overrides to `commonjs` for Jest. MapLibre 6 runs its worker from a separate file resolved from `import.meta.url`, which a bundle cannot satisfy: webpack copies `maplibre-gl-worker.mjs` beside the bundle as `maplibre-gl-worker.js` and the component calls `setWorkerUrl('/res/mapstudio/maplibre-gl-worker.js')`. The `.js` name matters: the Gateway serves `.mjs` with no content type under `nosniff`, and the browser refuses the worker. Colours: `themeColor()` reads `--containerRoot`, `--neutral-70`, `--label` from the component root's computed style (MapLibre paint cannot take `var()`); the overlay and controls use the tokens in `mapstudio.css`; no colour literal anywhere. Point labels are not drawn: a MapLibre symbol layer needs a glyph source, which the blank style has no business shipping yet. Unit tests: `web/typescript/__tests__/messages.test.ts` (8 tests: builder, uuid ids, reply reading, every malformed shape).
- `ops/`: `docker-compose.yml` (Ignition 8.3.10, EULA, admin/password, standard edition, `-Dignition.allowunsignedmodules=true`, external modules folder, project bind mount). Unattended acceptance is the env variables `ACCEPT_MODULE_LICENSES` and `ACCEPT_MODULE_CERTS` (module id lists read by `ModuleUtil`, found in the 8.3.10 gateway jar): seeding `data/modules.json` with the licence CRC, as Mustry does, left an unsigned module parked in commissioning. `up.sh` (`--fresh`, `--no-build`), `down.sh [--purge]`, `logs.sh`, `lib.sh`; `ops/project` is the `mapstudio-dev` project with one flex view `MapStudioDev` at `/`. `ops/screenshot.mjs` projects the click target with the Web Mercator formula from the fixed centre and zoom, fails on any console error or page error, and writes `docs/screenshots/mapstudio-dev-{1440,390}.png`.
- Env note: the Perspective runtime in 8.3.10 tags DOM nodes with `__reactFiber$` keys (React 17+ internals naming), useful for test scripts that need the component store.
- Committing: WIP commits appeared on the branch during the build from outside this session; one of them swept `web/node_modules` (15,704 files) into git before `.gitignore` covered it. `git rm -r --cached web/node_modules` is staged so the next commit drops them; the history still carries them until it is rewritten or squashed.

- Orchestrator after the implementer (2026-10-26): matrix audit found no committed Gateway-side test for the three I/O rows; added `gateway/src/test/.../MapStudioDelegateTest.java` (4 tests, JUnit 5, run by `./gradlew :gateway:test`, 4/4 pass). Dev Gateway admin password now generated into the git-ignored `.env` (was the literal `password`); host port bound to `127.0.0.1`; test line now between the first two points, per story criterion 3. Fresh `ops/up.sh --fresh`: no Map Studio warning or error; screenshots retaken.
- Owner reviewed the screenshots on 2026-10-26 and confirmed they match criteria 3 and 4 (story criterion 5).

- Owner's fresh clone on their own Ubuntu machine (2026-10-26): `ops/up.sh --fresh` built, tested (Java and Jest pass), started 8.3.10 and loaded Map Studio; clicks logged by `MapStudio.delegate` for p2 and p3. This is the story's check beyond the criteria (rebuild from a fresh clone on another machine): passed. Warnings seen (Gradle deprecations, npm peer and audit) are deferred to the refactor sweep.

## Plan Change Log

- Unattended module acceptance moved from a `data/modules.json` seed (Mustry's method, which assumes a signed module) to the Gateway's `ACCEPT_MODULE_LICENSES` / `ACCEPT_MODULE_CERTS` environment variables, so no stop, copy, chown and restart dance is needed. Same acceptance criterion, simpler scripts.
- MapLibre's worker is published as a separate `.js` file beside the bundle (not in the plan; a consequence of MapLibre 6's split worker build). Noted in the README.

## Review Triage Log

Pass 1 (quick lens, 2026-10-26): high 0, medium 0, low 7, false 2, maybe-false 0. Patched 5, rejected 4, deferred 1.

| # | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|
| 1 | Palette icon colour literal in `MapStudioComponent.paletteIcon()` | low | patch | Real literal against AD-11; now takes the Swing look-and-feel's `Label.foreground` (grey only as a fallback). |
| 2 | A late reply clears the pending state of a newer click in `MapStudioStoreDelegate.handleEvent` | low | reject | Real but tracer-only (one test click); correlating replies adds logic the viewing epic replaces with `map.changed` and `values.batch`. |
| 3 | Root-relative worker URL breaks under a context path | false | reject | Perspective serves every module bundle at root-relative `/res/<alias>/`, as `MapStudioModule.BROWSER_RESOURCES` does; a prefix would fail the bundle load first, so the worker adds no new failure. |
| 4 | Theme colours read once at mount; a theme switch does not repaint; silent transparent fallback | low | reject | Real, but no story 1 criterion covers theme switching; the viewing epic owns theme following (AD-11) and will repaint on token change. |
| 5a | Version check truncates `1.5` to `1` | low | patch | `getAsInt` truncates; now compares `getAsDouble`, with a test. |
| 5b | `INBOUND_TYPES` unused, AD-8 list not enforced | low | patch | `reply()` now rejects any type outside `INBOUND_TYPES`. |
| 5c | No tests for version mismatch and missing `pointId` | low | patch | Two tests added; 6/6 pass. |
| 6 | README names the wrong `.modl` file | low | patch | Corrected to `build/Map-Studio.unsigned.modl`. |
| 7 | Gradle web task inputs omit `.npmrc` | false | reject | The webpack task fails the build on a broken bundle (seen live); `.npmrc` changes the registry, not the bundle content. |
| 8 | `.env` world-readable; unsigned-module flag Gateway-wide | low | patch (first part), reject (second) | `.env` now written with `umask 077` and `chmod 600`; the unsigned flag is the approved dev-only plan. |
| 9 | `web/node_modules` remains in branch history | low | defer | Process, not code: an early WIP commit swept it in; removing it needs a history rewrite the owner must approve. |


## Design Notes

The round trip uses the component model delegate (IA's pattern), not a component event, because later stories need the Gateway to push (`values.batch`, `map.changed`). The envelope travels as one JSON object under one event name in each direction, so new message types never need new event names.

## Verification

**Commands:**
- `./gradlew build` -- expected: success, `.modl` in `build/`
- `cd web && npx tsc --noEmit && npm test` -- expected: no type errors, tests pass
- `ops/up.sh` then the Gateway status page and logs -- expected: Map Studio running, no Map Studio errors
- `node ops/screenshot.mjs` -- expected: two screenshots showing points, line and reply text

**Manual checks (if no CLI):**
- Owner reviews `docs/screenshots/` against story criteria 3 and 4.

**Results (2026-10-26):**
- `./gradlew build`: success; `build/Map-Studio.unsigned.modl` with `module.xml` carrying id, version 0.1.0, hooks, Perspective dependency and the licence. A webpack error fails the build (seen with the first MapLibre import).
- `cd web && npx tsc --noEmit && npm test`: no type errors; 8 of 8 tests pass.
- `ops/up.sh --fresh`: Gateway RUNNING with no wizard; log shows `Starting up module 'com.aoindustrial.perspective.mapstudio' v0.1.0` and `Registering the Map Studio component.`; no Map Studio warning or error.
- `node ops/screenshot.mjs`: both screenshots written; reply text `Gateway received click on p1 at <ISO UTC>` on both; no console error (the script fails on one). Delegate log: `point.click <uuid> for point p1`.
- I/O matrix exercised against the live Gateway by firing envelopes through the client delegate from a Playwright script: unknown type -> `Error (invalid): Unknown message type: nope` (warn logged); missing id or type -> `The message needs an id and a type.`; version 2 -> unsupported version; `point.click` without `pointId` -> `point.click needs a pointId.`; a valid `point.click` for p3 -> reply. No exception in the Gateway log.
