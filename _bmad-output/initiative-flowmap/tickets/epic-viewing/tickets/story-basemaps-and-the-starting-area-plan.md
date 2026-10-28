---
title: 'Basemaps and the starting area'
type: 'feature'
ticket: '6'
created: '2026-10-28'
status: 'in-review'
baseline_revision: '722c1c4ff55202823988252d7b55555a33aeeda5'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/handoff-epic-3.md'
  - '{project-root}/docs/contract.md'
  - '{project-root}/docs/setup.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The map draws on a blank background only, starts at a view hard-coded in `MapStudio.tsx` (`START_VIEW`), and the setup's `basemaps` and `tokenSecret` reach nothing: a project cannot show OpenStreetMap or satellite imagery under its map items, and two components on one page cannot open on different areas (R1, R10, AD-12).

**Approach:** The browser offers the setup's basemaps None, OpenStreetMap and Satellite in a small View-mode control (the Mapbox vector style stays deferred and is not offered), each with its provider's attribution always shown; None keeps the blank background. OpenStreetMap needs no secret and is built in the browser; Satellite is Mapbox satellite raster tiles whose token the Gateway reads from the secret the setup names, checks to be a public `pk.` token, and hands to the browser only as the tile URL of a `basemap.source` reply when the user picks Satellite; a refusal is a plain-words status in the control. A `startingArea` component prop (centre and zoom, or bounds) replaces `START_VIEW`, documented in the props schema and `docs/contract.md`.

## Decisions (recorded for the owner, 2026-10-28; the session is unattended)

1. **Message shape.** New types `basemap.source` (browser to Gateway, `{basemap}`) and `basemap.source.reply` (`{basemap, provider, tiles, tileSize, maxzoom, attribution}`): the Gateway answers a raster tile source, so the satellite provider stays a Gateway setting (AD-12) and the browser never builds a Mapbox URL itself. Only `satellite` is asked for; `osm` is built in the browser. New error code `token-unavailable` for every token problem (no secret named, provider or secret missing, unreadable, empty, not `pk.`), the message naming the secret's name, never its value. Contract 0.3.0, unreleased.
2. **Initial basemap.** The viewer's last choice in this browser (`localStorage` key `mapstudio.basemap.v1`, a per-viewer convenience, never the token) when the setup still offers it, else the first basemap the setup lists. A `mapbox` entry in the setup is not offered (deferred) and logs one console info line. With one basemap offered the control is hidden; the attribution still shows.
3. **Control and attribution placement.** The basemap control is a MapLibre control group top-right under the zoom buttons (DESIGN.md: Edit switch and zoom top-right; the bottom-right corner stays clear), one button per offered basemap with its name in words and `aria-pressed`; a refusal or a tile failure is a short status line under it. MapLibre's AttributionControl (not compact, so always shown) sits bottom-left; the dev reply box moves up above it. The blank background keeps `--containerRoot` (the marker halo's token) until entry 12 reviews the hue and surface tokens; DESIGN.md's `basemap-blank` is noted there.
4. **Starting area prop.** `startingArea {center: {lng, lat}, zoom, bounds: {west, south, east, north}}`: when all four bounds are finite and ordered the map fits them (24 px padding), else centre and zoom; an invalid value falls back to the whole world (centre 0, 0, zoom 1) with one console warning. The default is the whole world; the dev views set the old `START_VIEW` values (centre -104.9725, 39.7445, zoom 12), so `e2e/lib/geo.mjs` keeps its numbers. A changed prop moves the map (`jumpTo` or `fitBounds`).
5. **Dev stack secret.** `ops/gen_secrets.py` writes `ops/secrets/map_token` (git-ignored, generated, never committed) holding the placeholder `pk.placeholder-dev-not-a-mapbox-token`, mounted as the Docker secret `map_token` and listed in the `MapStudioFiles` secret provider; the dev setup names `MapStudioFiles/map_token` and offers `satellite`. The placeholder passes the `pk.` check so the browser's tile request is seen (routed to a stub PNG in e2e); Mapbox's acceptance of a real token is **[not verified]** here. The refusal path uses the setup rewritten to `MapStudioFiles/pg_password` (a real secret whose value is not a `pk.` token), the missing path `MapStudioFiles/nope`, and the unnamed path `tokenSecret ""`. A fresh volume is needed once (`ops/up.sh --fresh`) for the provider change. A developer with a real public token replaces the file's content; the e2e teardown then treats it as a secret in `e2e/out`.
6. **Tiles in CI.** OSM tiles may be blocked, so the e2e routes `tile.openstreetmap.org` and `api.mapbox.com` to a 1 by 1 PNG and asserts on the selected basemap, the attribution text and the tile state; a routed abort proves the tile-failure status. A MapLibre `error` event of the basemap source is logged at console info (never console.error), so a site without internet shows "tiles are not loading" in words and no browser error.
7. **Implementation and review without subagents.** The session has no subagent tool: this agent implements from the plan itself and the quick review lens is run by this agent reading the staged diff.

## Boundaries & Constraints

**Always:** the token is read on the Gateway only, from `SecretProviderManager.getProvider(provider).read(name)` (checked live on 8.3.10 and recorded in `docs/platform-checks.md` with labels), only when a browser asks for the satellite source, only for a setup that offers `satellite`; it reaches the browser only inside the tile URL template, is kept in the component's memory, never in `localStorage` or `sessionStorage`, never in a log line (Gateway or console), never in a status message; a token that does not start with `pk.` is refused with a plain-words status; every colour in the control and the attribution is a theme token (AD-11); the attribution is always visible for OSM and Satellite; nothing new sits in the bottom-right corner; the tile URL for OSM is `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with `(c) OpenStreetMap contributors` linked to the copyright page; Jython 2.7 rules for any project script; no em dashes; contract 0.3.0 (`check-contract-versions.sh` green; web and e2e package versions 0.3.0 equal CHANGELOG's top section); README.md untouched (notes go to `docs/`).

**Never:** the Mapbox vector style basemap, Esri or MapTiler providers (AD-12's order stays a setting for later), offline tiles, a `basemap` prop, Fit or Return, labels (entry 7), a change to `ign-scada-template`, a real token in any file, a `.modl` or scratch project committed, a Gateway write outside the local dev stack.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Offered list | setup `basemaps` `["none","osm","satellite","mapbox"]` | control offers None, OpenStreetMap, Satellite in that order; `mapbox` dropped with one console info | none |
| One offered | setup `basemaps` `["osm"]` | OSM drawn, control hidden, attribution shown | none |
| None | None selected | no raster source or layer; background `--containerRoot`; attribution empty and hidden; `data-basemap="none"` | none |
| OSM | OpenStreetMap selected | raster source `mapstudio-basemap` with the OSM tiles, attribution "OpenStreetMap contributors" with the copyright link; `data-basemap="osm"` | a tile error sets `data-basemap-tiles="failed"` and the status "OpenStreetMap tiles are not loading; check the network." at console info |
| Satellite, good token | `basemap.source {basemap: "satellite"}`, setup offers satellite, secret `pk.abc` | reply `{basemap: "satellite", provider: "mapbox", tiles: ["https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=pk.abc"], tileSize: 512, maxzoom: 22, attribution}`; attribution shows Mapbox, Maxar and "Improve this map"; the Gateway log line names the secret, never the value | none |
| Satellite, not public | secret value `sk.abc` or `anything` | `error token-unavailable` "The secret P/N is not a public Mapbox token: it must start with pk. ..."; the control shows the status, the selection stays; the value is in no log or message | the refusal |
| Satellite, no secret named | `tokenSecret ""` | `token-unavailable` "The Map Studio setup names no map token secret (tokenSecret) ..." | the refusal |
| Satellite, no provider or secret | `tokenSecret "Nope/x"` or `"MapStudioFiles/nope"` | `token-unavailable` "There is no secret provider named Nope ..." or "The secret MapStudioFiles/nope was not found." | the refusal |
| Satellite, read fails | the provider throws | `token-unavailable` "The secret P/N could not be read; see the Gateway log." and one warn line with the exception class | the refusal |
| Not offered | setup `basemaps` `["none","osm"]`, `basemap.source satellite` | `error invalid` "The setup does not offer the satellite basemap." | the refusal |
| Wrong basemap | `basemap.source {basemap: "osm"}` or missing | `error invalid` "basemap.source answers the satellite basemap only." | the refusal |
| No setup | project without a setup | `error store-unreachable` (the registry's reason) | the refusal |
| Remembered choice | `localStorage` holds `satellite`, setup offers it | the map asks for the source on load and draws Satellite | a refusal falls back to the first offered basemap that needs no token |
| Starting area | prop `{center: {lng: -104.9725, lat: 39.7445}, zoom: 12}` | the map opens there; `.mapstudio-map` carries `data-center` and `data-zoom` | none |
| Bounds | prop `bounds {west, south, east, north}` all finite, west < east, south < north | the map fits them with 24 px padding; `data-zoom` differs from the centre case | none |
| Bad starting area | lat 95, or zoom "x" | the whole world (0, 0, zoom 1) and one console warning | none |
| Two components | one page, two components with different starting areas | both load the same `data-items-loaded`; each opens on its own area | none |

</frozen-after-approval>

## Code Map

- `common/.../Messages.java` -- add `BASEMAP_SOURCE`, `BASEMAP_SOURCE_REPLY`, `CODE_TOKEN_UNAVAILABLE` to the type and code sets; `CONTRACT_VERSION` stays 0.3.0. `ContractTest` lists the sets.
- `common/.../contract/Setup.java` -- `basemaps()` and `tokenSecret()` (as `<provider>/<name>`); `BASEMAPS` stays four names. Reuse, do not change.
- `common/src/main/resources/mapstudio.props.json` -- add `startingArea` beside `popupView`; closed schema.
- `gateway/.../basemap/` (new): `TokenSource` (interface: `read(provider, name)` with `TokenException {kind: NO_PROVIDER, NOT_FOUND, FAILED}`), `IgnitionTokenSource` (`SecretProviderManager.getProvider(name)` then `ManagedSecretProvider.read(secret)` in try-with-resources on `Plaintext`, trimmed string; `SecretNotFoundException` maps to NOT_FOUND [SDK 8.3.0 javap]), `BasemapSources` (pure: `reply(Setup, String basemap)` returns the JsonObject or throws `MapStudioException`; the `pk.` check; the Mapbox tiles URL with the token URL-encoded; logger `MapStudio.basemap`, never the value).
- `gateway/.../MapStudioDelegate.java` -- `basemap.source` runs on the work pool as the store types do (`isStoreType`), the job `basemapReply(setups, basemaps, view, id, body)`: `setups.require(project)` then `BasemapSources.reply`. `MapStudioServices` wires `basemaps` over `context.getSecretProviderManager()`. Tests: `BasemapSourcesTest` (every matrix row with a fake `TokenSource`, `LogCapture` on `MapStudio.basemap` proving no line holds the token), `BasemapReplyTest` through the delegate's static job as `TagsReplyTest` does.
- `gateway/.../setuplookup/IgnitionLookupSourceTest` bans `.read(` in its own package only; the new package is outside it. Keep it so.
- `web/typescript/basemaps.ts` (new, pure): ids, labels, `OSM` source spec, `offeredBasemaps`, `initialBasemap`, `readBasemapSource`, `tileStatusText`, storage key helpers (try/catch). `startingArea.ts` (new, pure): `readStartingArea(raw)` -> `{kind: 'center', center, zoom} | {kind: 'bounds', bounds}`, `WORLD`. Jest tests for both.
- `web/typescript/messages.ts` -- `basemapSource(id)` builder, the `basemap.source.reply` case in `readReply`, `Reply` union, `replyText`. `contract.ts` unchanged except nothing (the setup reader already carries `basemaps`).
- `web/typescript/BasemapControl.ts` (new) -- an `IControl` like `DrawControl`: `setOffered`, `setSelected`, `setStatus`, click callback; classes `mapstudio-basemap*`, tokens only in `mapstudio.css`.
- `web/typescript/MapStudio.tsx` -- `MapStudioProps.startingArea`; `getPropsReducer` reads `tree.readObject('startingArea', {})`; `START_VIEW` removed; the map is made with `center`/`zoom` or `bounds`; `AttributionControl` bottom-left; the delegate gains `basemap: BasemapState {offered, selected, source, status, pendingId, revision}` filled from `map.load.reply` (`setup.basemaps`) and `basemap.source.reply`/`error`; `selectBasemap(id)`; the component's `applyBasemap()` syncs source, layer (`mapstudio-basemap` raster, added before `LAYER_ITEM_LINES`), control, status, `data-basemap`, `data-basemap-status`, `data-basemap-tiles`, and the `error`/`sourcedata` listeners; `data-center`, `data-zoom` on `moveend` and at ready.
- `web/typescript/mapstudio.css` -- the control, the status line and the attribution on tokens; `.mapstudio-reply` bottom raised above the attribution.
- `ops/gen_secrets.py`, `ops/docker-compose.yml`, `ops/config/core/ignition/secret-provider/MapStudioFiles/config.json`, `ops/project/.../setup/setup.json` -- the dev `map_token` secret (decision 5). `ops/docker-compose.{perf,smoke,store-checks}.yml`: check whether they reference the compose secrets; add `map_token` only where the gateway service lists `pg_password`.
- `ops/project/com.inductiveautomation.perspective/views/*/view.json` -- `startingArea` on every `ao.mapstudio`; new view `MapStudioTwo` (two maps side by side, the right one on bounds round the tracer points) and page `/two` in `page-config/config.json`.
- `e2e/tests/basemaps.spec.mjs` (new) -- 1440 and 390 px, tile routes to a stub PNG, the setup rewrites through `lib/gateway.mjs` (`backUpSetup`, `writeSetup`, `scanProject`, `putBackSetup`), the Gateway log through `logLines('MapStudio.basemap', ...)`, storage checks, screenshots `mapstudio-basemap-{osm,satellite}-1440.png`, `mapstudio-two-1440.png`, `mapstudio-basemap-390.png`. `e2e/lib/editorAuth.mjs` `allPasswords()` adds the map token file's content when it is not the placeholder. `e2e/lib/geo.mjs` comment: the dev views' `startingArea`.
- `docs/contract.md` -- the two types in the table, a "basemap.source" section, `token-unavailable` in the codes, a new "The component's props" section (`startingArea`, `popupView`, `style`); `docs/setup.md` `basemaps` and `tokenSecret` rows (what the browser does, the OSM tile usage policy); `docs/basemaps.md` (new, user notes: the three basemaps, the token, the dev stack, labels); `docs/platform-checks.md` "Epic 3 entry 6"; `CHANGELOG.md` 0.3.0.
- `designer/.../setup/SetupForm.java` -- the "Mapbox needs a map token" warning also for `satellite` (small, with `SetupFormListsTest`); the message text gains Satellite.

## Tasks & Acceptance

**Execution:**
- [x] `common/` -- the message types, the code, the props schema; `ContractTest` updated.
- [x] `gateway/.../basemap/` and the delegate wiring; unit tests for every matrix row that is pure, the no-token-in-log test.
- [x] `web/typescript/{basemaps,startingArea,BasemapControl}.ts`, `messages.ts`, `MapStudio.tsx`, `mapstudio.css`; Jest tests.
- [x] `ops/` -- the dev secret, compose, provider config, setup, the views and the `/two` page.
- [x] `e2e/` -- `basemaps.spec.mjs`, the teardown's token scan, the geo comment.
- [x] `docs/`, `CHANGELOG.md`, the Designer warning.

**Acceptance Criteria:**
- Given the dev Gateway, when each basemap is chosen in the control, then it draws with its attribution and None draws the blank background.
- Given `/two`, when both maps load, then each opens on its own starting area and both show the same map items.
- Given the dev stack, when Satellite is chosen with the placeholder token, the pg_password secret, a missing secret and no secret, then the first draws (tiles stubbed) and the other three show a plain-words status; no token value is in the browser's storage or the Gateway log.
- Given the hand-off's checks, then every one passes; e2e at 1440 and 390 px pass.

## Implementation Notes

- **Commits on the worktree branch** (`worktree-agent-adbddc14f5f05770b`, baseline `722c1c4`): be020ec (common and the Gateway: `Messages` types and `token-unavailable`, `TokenSource`, `IgnitionTokenSource`, `BasemapSources`, the delegate's work-pool job, `BasemapSourcesTest`, `BasemapReplyTest`, the props schema), 51b6795 (the browser: `basemaps.ts`, `startingArea.ts`, `BasemapControl`, the delegate's basemap state and `basemap.source` round trip, the raster layer, the attribution control, `startingArea` in place of `START_VIEW`, Jest tests), e7df0b8 (the dev stack, docs, e2e, the Designer warning), then the closing commits (what the live run taught, evidence, screenshots, this plan).
- **Perf and store-checks projects.** Their views (`ops/perf/project`, `ops/store-checks/project`) also use the component, so they carry `startingArea` too (the perf grid is built inside that view: `e2e/perf/items.mjs`); `ops/perf.sh` and `ops/store-checks.sh` call `ensure_secrets` so the compose file's `map_token` secret exists on a checkout that ran `ops/up.sh` before this entry.
- **The first live run taught:** a status-only change (a refusal while OpenStreetMap is drawn) removed and re-added the raster layer, since `applyBasemap` redrew on every revision; it now touches the map only when the source object changed. A routed abort or a 404 for a tile makes Chromium log its own "Failed to load resource" console error for every tile, which the suite's error watch counts whatever the component does, so the tile-failure test serves bytes that are not an image (MapLibre's own error event, no console line). `locator.tap()` needs `hasTouch`; the 390 px test clicks as the other specs do. The `/two` page needs the seed (a fresh stack has no items), so the spec seeds in `beforeAll`. The Designer's `ProjectListsTest` and `ProjectResourcesTest` list the dev project's pages, so `/two` was added there.
- **The stub tile** is a 1 by 1 blue PNG, which is why the OSM and Satellite screenshots show a flat blue map: the tiles are drawn, they are just the stub.
- **Not done, by scope:** the Mapbox vector style (deferred), Esri and MapTiler (settings for later, AD-12), Fit and Return and the labels (entry 7), a `basemap` prop, offline tiles.

## Plan Change Log

## Review Triage Log

Review pass 1 (quick lens, read by this agent from the staged diff; no subagent tool in this session): 0 high, 1 medium, 1 low, 0 false, 0 maybe-false.

| Finding | Verdict | Route | Evidence |
| --- | --- | --- | --- |
| `applyBasemap` removed and re-added the raster source and layer on every basemap revision, a status-only change included, so a refused Satellite click while OpenStreetMap was drawn reloaded every OSM tile | medium | patch | `MapStudio.tsx`: the map is touched only when `b.source` is not the source drawn (`drawnSource`, compared by identity); seen in the first live run and in the diff; patched before the final verification |
| `Reply` kinds: an `error` whose id is the pending `basemap.source` is handled before the `map.load` error check, so a refusal never reaches the reply line; a late reply to a superseded ask is ignored with one console info line | low (a note, nothing wrong) | rejected | by inspection of `handleEvent`; no harm found |

## Design Notes

**Why a Gateway reply rather than the token in `map.load.reply`.** The token would otherwise reach every viewer on every load, Satellite chosen or not; the reply shape also lets a later provider (Esri, MapTiler) answer a different tile template without a browser change (AD-12: the provider is a setting).

**Tile errors.** MapLibre fires `error` on the map for a failed tile with `sourceId`; with no listener it writes `console.error`, which fails every e2e test (`fixtures.mjs` watches console errors). The component listens, logs a basemap tile failure at info once per selection and sets the status; any other error still goes to `console.error`.

## Verification

**Commands:**
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` (with the scratch init script that keeps the node plugin from downloading Node) -- expected: BUILD SUCCESSFUL.
- `cd web && npx tsc --noEmit && npx jest` -- expected: no type error, all tests pass.
- `ops/up.sh --fresh`, then `cd e2e && npm ci && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: every spec passes, `basemaps.spec.mjs` included.
- `bash scripts/ci/check-contract-versions.sh` and `bash scripts/ci/test-contract-versions.sh` -- expected: OK.
- `grep -rnP '\xE2\x80\x94'` on every changed file -- expected: no match.

**Manual checks:**
- The Gateway log of `MapStudio.basemap` after the e2e run holds the secret names only (asserted by the spec).
- Screenshots in `docs/screenshots/` show the control, the attribution and the two-map page.
