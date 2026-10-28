# Basemaps and the starting area

What the map draws under its items, and where each component opens (epic 3 entry 6; initiative R1 and R10, architecture AD-12). The setup side is in [setup.md](setup.md) (`basemaps`, `tokenSecret`), the message in [contract.md](contract.md) ("basemap.source"), the prop in [contract.md](contract.md) ("The component's props").

Labels: **[live 8.3.10]** seen on the `ops/` dev Gateway (Ignition 8.3.10) by `e2e/tests/basemaps.spec.mjs` or by hand (`docs/platform-checks.md`, "Epic 3 entry 6"); **[not verified]** written but not seen working.

## The three basemaps

The project's setup lists the basemaps the map offers (`basemaps`, in the order the control shows them). A small control top-right, under the zoom buttons, has one button per offered basemap, named in words; it is hidden when the setup offers only one. The viewer's choice is remembered in that browser (the basemap's name only) and used again while the setup still offers it; otherwise the map opens on the first basemap the setup lists.

| Basemap | Setup name | What it draws | Attribution (always shown, bottom-left) |
| --- | --- | --- | --- |
| None | `none` | The theme's blank background (`--containerRoot`, the markers' halo token); the map items alone, for a site without internet | none |
| OpenStreetMap | `osm` | OpenStreetMap's public raster tiles, `https://tile.openstreetmap.org/{z}/{x}/{y}.png` **[live 8.3.10]** (tiles routed to a stub in the e2e suite; real tiles seen by hand only where the box could reach them **[not verified]** on the cloud box) | "(c) OpenStreetMap contributors", linked to the copyright page |
| Satellite | `satellite` | Mapbox satellite imagery (the `mapbox.satellite` tileset through the Raster Tiles API, 512 px tiles) with the project's own token (below) **[live 8.3.10]** with a placeholder token and stubbed tiles; real imagery from a real token **[not verified]** here | "(c) Mapbox (c) Maxar", with the "Improve this map" link Mapbox asks for |

`mapbox` (the Mapbox vector style) is accepted by the setup but not drawn in this version (deferred, not dropped; the browser says so once in its console and leaves it out of the control).

The provider's attribution is the provider's term of use: it is MapLibre's own attribution control, never collapsed, and the map keeps it even when the tiles do not arrive. When tiles do not load (a blocked network, a site without internet) the control says so in words under its buttons ("OpenStreetMap tiles are not loading; check the network.") and the map stays usable; nothing is written as a browser error **[live 8.3.10]** (a routed abort in the e2e suite).

### OpenStreetMap's tile usage policy

OpenStreetMap's public tile servers are a free service run by volunteers under a usage policy (https://operations.osmfoundation.org/policies/tiles/): the attribution must stay visible (it does), use must be light (a few screens in an office is fine; many kiosks open all day are not), no bulk downloading or pre-fetching, and the browser's normal headers are sent (it sends its Referer). A client site with heavy use runs its own tile server or chooses Satellite or None; offline tiles are out of scope for this version.

### The Satellite token

The token is a Mapbox **public** access token, restricted in the Mapbox account to the site's URLs, kept in a secret of one of the Gateway's secret providers and named in the setup as `tokenSecret: "<provider>/<name>"`. The Gateway reads the secret only when a browser picks Satellite, checks that it starts with `pk.`, and answers the browser with the tile URL template that carries it; nothing else carries the value: not the setup, not a view, not the Gateway log (which names the secret, never its value), not the browser's storage. A secret (`sk.`) token or any other value is refused with a plain-words status under the control, and so is a secret that is missing or not named **[live 8.3.10]**. Satellite stays on Mapbox (owner, 2026-10-28); the owner confirms Mapbox's terms for client sites before this epic's release, MapTiler being the switch if they fail (architecture, Deferred). Each client site holds its own Mapbox account and token.

## The starting area

Each component has a `startingArea` prop: a centre and zoom, or bounds to fit (all four numbers, `west < east`, `south < north`; 24 px of padding). The default is the whole world; an invalid value opens on the whole world with one console warning. Two components on one page may open on different areas and both show the same map items, since both load the one project map: the dev page `/two` does, the left on the dev centre and zoom, the right on bounds round the tracer's points **[live 8.3.10]**. Fit, Return and the labels that depend on the starting zoom are entry 7's.

## The dev stack

`ops/up.sh` generates `ops/secrets/map_token` (git-ignored, through `ops/gen_secrets.py`) with the placeholder `pk.placeholder-dev-not-a-mapbox-token`: it passes the `pk.` check, so the Satellite path runs end to end against stubbed tiles, but Mapbox does not know it, so a real browser on the dev stack gets no imagery. To see real imagery, put your own public token in that file (one line) and restart the Gateway; the file is never committed, and the e2e teardown then treats its content as a secret that must not appear under `e2e/out`. The dev setup offers all three basemaps and names `MapStudioFiles/map_token`; the `MapStudioFiles` File secret provider (`ops/config/core`) reads `/run/secrets/map_token`, which the compose file mounts. The provider's config is seeded on a fresh volume only, so a dev stack from before this entry needs `ops/up.sh --fresh` once.

The refusal paths the suite proves on the dev stack: the setup's `tokenSecret` rewritten to `MapStudioFiles/pg_password` (a real secret that is not a token), to `MapStudioFiles/nope` (missing), and to `""` (none named), each put back afterwards.
