# Walkthrough - story 1, the Map Studio tracer (commit c8d3ca4)

A block is done only when the owner says so. Current block: 4.

- [x] Block 1 - Intent
- [x] Block 2 - Broad strokes
- [x] Block 3 - The build and how the module is packaged
- [ ] Block 4 - The component's identity and registration (current)
- [ ] Block 5 - The round trip between browser and Gateway
- [ ] Block 6 - Drawing the map
- [ ] Block 7 - The dev Gateway
- [ ] Block 8 - Periphery

## Block 1 - Intent

From the build plan's Intent ([plan](../tickets/epic-module-foundation/tickets/story-tracer-a-maplibre-map-on-a-perspective-view-with-one-round-t-plan.md)):

> **Problem:** Map Studio has no code yet; every later story needs a module skeleton that builds, installs on a Gateway, draws a map in Perspective and talks to its Gateway side.
>
> **Approach:** Scaffold the module in Map Studio's own layout, copying the working shape of Mustry's 8.3 module (build, hooks, web bundle, Docker dev Gateway) and IA's example's component model delegate for the round trip; draw a MapLibre map with fixed test data and send one message in the `{v, type, id, body}` envelope.

## Block 2 - Broad strokes

One Ignition module with three Java parts and one browser bundle. Open these in order:

1. [build.gradle.kts](../../../build.gradle.kts) - defines the module: id, name, minimum Ignition version, which parts run where.
2. [MapStudioGatewayHook.java](../../../gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/MapStudioGatewayHook.java) - what the Gateway does when the module starts: register the component and its Gateway side.
3. [MapStudio.tsx](../../../web/typescript/MapStudio.tsx) - the component in the browser: draws the map and sends the click.
4. [MapStudioDelegate.java](../../../gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/MapStudioDelegate.java) - the component's Gateway side: answers each message.
5. [ops/up.sh](../../../ops/up.sh) - builds the module and runs it on a dev Gateway in Docker.

## Block 3 - The build and how the module is packaged

Gradle builds three Java parts (`common`, `gateway`, `designer`) and runs npm and webpack in `web` to produce the browser bundle; the bundle is packed inside the Gateway part, and the Gateway serves it at `/res/mapstudio/`.

- [build.gradle.kts:25](../../../build.gradle.kts) module id; [:41](../../../build.gradle.kts) minimum Ignition; [:43](../../../build.gradle.kts) scopes; [:58](../../../build.gradle.kts) hooks.
- [web/build.gradle.kts:31](../../../web/build.gradle.kts) the webpack task; [:42](../../../web/build.gradle.kts) the Jest tests.
- [gateway/build.gradle.kts:18](../../../gateway/build.gradle.kts) packs the bundle into the Gateway part.
- [MapStudioGatewayHook.java:65](../../../gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/MapStudioGatewayHook.java) and [:71](../../../gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/MapStudioGatewayHook.java) serve the bundle under the `mapstudio` alias.

## Block 4 - The component's identity and registration

One id, `ao.mapstudio`, ties the Java description of the component to the browser code; the Gateway and the Designer each register it at start-up.

- [MapStudioComponent.java:25](../../../common/src/main/java/com/aoindustrial/perspective/mapstudio/common/MapStudioComponent.java) the id and the descriptor.
- [MapStudioModule.java:17](../../../common/src/main/java/com/aoindustrial/perspective/mapstudio/common/MapStudioModule.java) module id; [:32](../../../common/src/main/java/com/aoindustrial/perspective/mapstudio/common/MapStudioModule.java) the bundle the browser loads.
- [mapstudio.props.json](../../../common/src/main/resources/mapstudio.props.json) the component's props, closed.
- [MapStudioGatewayHook.java:41](../../../gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/MapStudioGatewayHook.java) and [MapStudioDesignerHook.java:26](../../../designer/src/main/java/com/aoindustrial/perspective/mapstudio/designer/MapStudioDesignerHook.java) registration.
- [index.ts:14](../../../web/typescript/index.ts) the browser registration.

## Block 5 - The round trip between browser and Gateway

The browser half sends one JSON envelope `{v, type, id, body}` under one event name; the Gateway half checks it and answers in the same envelope, or with an `invalid` error.

- [MapStudio.tsx:45](../../../web/typescript/MapStudio.tsx) the browser-side delegate; [:65](../../../web/typescript/MapStudio.tsx) receiving the reply.
- [messages.ts:62](../../../web/typescript/messages.ts) building an envelope; [:76](../../../web/typescript/messages.ts) reading a reply.
- [MapStudioGatewayHook.java:47](../../../gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/MapStudioGatewayHook.java) wires the Gateway half to the component.
- [MapStudioDelegate.java](../../../gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/MapStudioDelegate.java) `handleEvent` and `reply`.
- [Messages.java](../../../common/src/main/java/com/aoindustrial/perspective/mapstudio/common/Messages.java) the contract both sides share.
- Tests: [MapStudioDelegateTest.java](../../../gateway/src/test/java/com/aoindustrial/perspective/mapstudio/gateway/MapStudioDelegateTest.java), [messages.test.ts](../../../web/typescript/__tests__/messages.test.ts).

## Block 6 - Drawing the map

MapLibre draws the map in the component's box on a blank background, with the test points and line as two layers; colours come from the host theme's CSS tokens.

- [MapStudio.tsx:98](../../../web/typescript/MapStudio.tsx) map creation; [:128](../../../web/typescript/MapStudio.tsx) the layers; [:146](../../../web/typescript/MapStudio.tsx) the click.
- [MapStudio.tsx:27](../../../web/typescript/MapStudio.tsx) MapLibre's worker file, copied beside the bundle.
- [theme.ts:8](../../../web/typescript/theme.ts) reading theme tokens.
- [testData.ts](../../../web/typescript/testData.ts) the three points and the line.

## Block 7 - The dev Gateway

A disposable Ignition 8.3.10 Gateway in Docker that loads the freshly built module, accepts it without the wizard and serves a `mapstudio-dev` project.

- [ops/docker-compose.yml](../../../ops/docker-compose.yml) the Gateway, localhost only, generated password.
- [ops/lib.sh](../../../ops/lib.sh) shared helpers; [ops/up.sh](../../../ops/up.sh) and [ops/down.sh](../../../ops/down.sh).
- [ops/project/](../../../ops/project/) the dev project and its one view.
- [ops/screenshot.mjs](../../../ops/screenshot.mjs) the screenshot run.

## Block 8 - Periphery

- [LICENSE](../../../LICENSE) Apache-2.0; [NOTICE](../../../NOTICE) MapLibre attribution; [license.html](../../../license.html) shown at install.
- [README.md](../../../README.md) build and run.
- [.gitignore](../../../.gitignore) build output, `node_modules`, `.env`, signing material.
- [docs/screenshots/](../../../docs/screenshots/) the proof screenshots.
