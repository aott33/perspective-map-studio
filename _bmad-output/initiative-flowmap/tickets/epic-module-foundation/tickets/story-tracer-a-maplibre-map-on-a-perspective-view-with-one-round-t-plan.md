---
title: 'Tracer: a MapLibre map on a Perspective view, with one round trip'
type: 'feature'
ticket: '1'
created: '2026-10-26'
status: 'draft'
baseline_revision: '64d282043a05625e38871d0bfbcb31ac7fd17736'
route: 'full'
route_source: 'auto'
risk: 'high'
review: ''
review_source: ''
lenses_ran: []
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

Reference repos (read only) are cloned in the session scratchpad: Mustry `refs/mustry`, IA example `refs/iaex/perspective-component`.

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
- [ ] `settings.gradle.kts`, `build.gradle.kts`, `gradle/wrapper/*`, `gradlew*` -- root build modelled on Mustry with Map Studio's ids, Ignition minimum 8.3.0, scopes, free module, signing skipped without properties.
- [ ] `common/` -- `MapStudioModule` (ids, alias `mapstudio`, browser resources), `MapStudioComponent` descriptor for `ao.mapstudio`, `mapstudio.props.json` (closed schema, no props needed yet beyond style).
- [ ] `gateway/` -- hook registering the component and its model delegate; `MapStudioDelegate` handling the envelope (`point.click`, unknown type, malformed) with logger `MapStudio.delegate`.
- [ ] `designer/` -- hook registering the component in the Designer palette.
- [ ] `web/` -- TypeScript and React component: MapLibre map, blank style, three fixed points and one line as GeoJSON layers, click sends the envelope through the client delegate, reply logged and shown as text; webpack, tsconfig, `.npmrc`, `build.gradle.kts`; unit test for the envelope builder and reply handling.
- [ ] `ops/` -- `docker-compose.yml` on `inductiveautomation/ignition:8.3.10` with EULA, admin user and unsigned modules allowed (fallback: Mustry's dev keystore and signed dev build), external modules folder, unattended module acceptance, `ops/project/` holding a `mapstudio-dev` project with one view; scripts to build, stage and start.
- [ ] `ops/screenshot.mjs` (or similar) -- headless Chromium captures the view at 1440 and 390 px after a point click; images saved to `docs/screenshots/`.
- [ ] `LICENSE`, `NOTICE`, `README.md` -- Apache-2.0, MapLibre attribution, how to build and run the dev Gateway.

**Acceptance Criteria:**
- Given a fresh clone, when `./gradlew build` runs, then a `.modl` for `com.aoindustrial.perspective.mapstudio` is produced and a broken web build fails it.
- Given the dev Gateway, when the module is staged and the Gateway restarts, then Map Studio is running and its start-up logs show no Map Studio error.
- Given the `mapstudio-dev` view at 1440 and 390 px, when a point is clicked, then the map shows three points, one line and the reply text, with no console error, and both screenshots are in `docs/screenshots/`.

## Implementation Notes

## Plan Change Log

## Review Triage Log

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
