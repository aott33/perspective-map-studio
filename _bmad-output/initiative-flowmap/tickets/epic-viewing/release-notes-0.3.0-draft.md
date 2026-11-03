<!--
Release notes for the GitHub release page of v0.3.0, modelled on the v0.2.0 page (RELEASING.md step 5:
what the release gives, requirements, upgrade with the warnings first, install and verify, what is not in
it, a link to the CHANGELOG; every repository link at the tag). On tag day the owner pastes everything
below the line into the draft release, after filling the two values marked TAG DAY from the release's
.sha256 asset and the README (the certificate line is unchanged unless the key was rotated).
-->

Map Studio 0.3.0 shows each site's live state on the project map: alarms, comms and a key value on every icon and line, a popup with the alarm summary and a link to the site's page, search, a legend and a Needs you summary of what is in alarm, comms lost or stale. A normal field shows no colour, so what needs attention stands out.

## What's new

- **Live state on the map.** Each kind setup turns on a comms tag, up to four values (one shown on the icon) and the alarms of an asset's folder (Ignition's Alarm Metrics). The Gateway keeps one subscription per tag for the whole project, however many sessions are open, and sends each open map one update per refresh interval (10 s by default) with only what changed; an open popup gets its values as they change.
- **Alarms and comms you can read at a glance.** The alarm glyph by priority, filled while unacknowledged and outlined once acknowledged, with a count; comms lost in its own magenta theme token with its glyph and the word; stale values marked with the hourglass and no colour. Every hue is a theme token with a Perspective fallback, checked for contrast in both bundled themes (engineering review ER-27 passed with changes, 2026-11-02).
- **Popups.** A click or tap opens the default popup: the name and a link to the site's page, comms with the data age, the key values, and the alarm summary with **View alarms** to your alarm page. A kind setup can name a project view to show instead. On a phone the popup is a bottom sheet with 44 px buttons. Map Studio acknowledges nothing.
- **Lines and instruments.** Line weight follows pipe size; instruments draw at their place on the line, each segment between two instruments takes their worst state (dashed while stale), and the line popup lists the instruments in order with their values and distances.
- **Value-driven styles and area tints.** A kind setup's style rule (States, Bands or an Ignition expression) picks a preset on the Gateway; geofences take a category tint.
- **Search, Needs you and the legend.** Search by map item or asset name (keyboard and phone too); a Needs you bar counts the items in alarm, comms lost and stale and lists them by rank; the legend shows every glyph and line look the map draws and holds the Lines and Names switches.
- **Basemaps and the starting area.** None, OpenStreetMap and Satellite (Mapbox imagery), each with its attribution always shown; the first basemap the setup lists is the default. A new component prop `startingArea` opens each map on its own centre and zoom or bounds.
- **Labels that give way.** Names, value labels and state chips are drawn with bundled fonts and give way to each other by rank as you zoom out; nearby items share one marker with a pick list.
- **Satellite on your own Mapbox account.** Satellite runs on the client's own Mapbox account and public token: the client accepts Mapbox's terms and pays its own tile requests, and Map Studio ships and holds no token. The Gateway reads the token from the secret the setup names, only when a browser asks, refuses anything but a public `pk.` token, and sends it only inside the tile URL. While Satellite is drawn the map shows the Mapbox logo and the attribution Mapbox's guide asks for ("© Mapbox © OpenStreetMap Improve this map © Maxar"), bottom-right, clear of the App Bar toggle ([basemaps](https://github.com/aott33/perspective-map-studio/blob/v0.3.0/docs/basemaps.md)).

## Requirements

- Ignition 8.3 (tested on 8.3.9 and 8.3.10), Perspective.
- A PostgreSQL database connection per project, as in 0.2.0 (the map store schema is unchanged).
- For Satellite: your own Mapbox account and a public (`pk.`) token, ideally restricted to your Gateway's URL, in a secret provider the setup's `tokenSecret` names ([setup](https://github.com/aott33/perspective-map-studio/blob/v0.3.0/docs/setup.md)). OpenStreetMap's public tiles ask for attribution and light use; a busy site should use its own tile service.

## Upgrading from 0.2.0

> **The `popupView` component prop is gone.** The 0.1.0 spike prop is no longer read: name the popup view in the kind setup instead ([kind setups](https://github.com/aott33/perspective-map-studio/blob/v0.3.0/docs/kind-setup.md)). A view that still sets it opens the default popup.

- No map store migration: the schema stays at version 2, so no database backup or owner role is needed for this upgrade (a backup before any upgrade is still good practice).
- The component no longer opens on a fixed view: set `startingArea` on each Map Studio component, or it opens on the whole world.
- Live values appear once a kind setup turns them on (comms, values, alarms); without one the map draws as in 0.2.0, neutral.
- If your project's theme defines its own colours, check the new tokens (`--mapstudio-comms-lost`, `--mapstudio-alarm-1` to `-3` and the presets) against your basemap ([review pack](https://github.com/aott33/perspective-map-studio/blob/v0.3.0/docs/review-er27.md)).

## Install and verify

Install `Map-Studio-0.3.0.modl` from the assets below on the Gateway (Platform > Modules), or pin it in a module lock ([how](https://github.com/aott33/perspective-map-studio/blob/v0.3.0/RELEASING.md#installing-through-a-hosts-module-lock)).

- SHA-256: `TAG DAY: the value in Map-Studio-0.3.0.modl.sha256` (also in `Map-Studio-0.3.0.modl.sha256`)
- Signing certificate SHA-256: `8F:93:FD:5C:B8:D9:C7:9B:E4:14:FD:EC:84:CF:21:26:A2:AC:39:F3:DA:3F:C9:0D:F8:08:0E:EA:5C:4D:38:3D` (TAG DAY: confirm it equals the README line)

## Not in this release

- **The in-browser editing studio** (drawing tools, the item list, Undo, the kind setup screen) is the next release (editing). Kind setups are written through the scripting API until then.
- **The Mapbox vector style** basemap is deferred; Satellite is raster imagery.
- **The template's map** (`ign-scada-template`) still runs its own map; moving it to Map Studio, with its cards taking the comms-lost colour, is a later step (template cutover).
- **Many editors saving large batches at once** is unchanged from 0.2.0 (ten editors each saving 50 changes at the same moment, p95 about 1.8 s on a 4-CPU test machine).
- A second browser tab still sends another tab's unsaved edit only after its next map load.

Full details for developers: [CHANGELOG](https://github.com/aott33/perspective-map-studio/blob/v0.3.0/CHANGELOG.md) and the [message contract](https://github.com/aott33/perspective-map-studio/blob/v0.3.0/docs/contract.md).
