# Changelog

Map Studio follows semantic versioning for its public contract (AD-9): the component's props and events, the message contract, the map item record, the kind list and asset contract, the kind setup schema, the project setup schema, the map store schema and the scripting API. Each contract document names the version it describes ([docs/contract.md](docs/contract.md), [docs/setup.md](docs/setup.md), [docs/kinds-and-assets.md](docs/kinds-and-assets.md), [docs/kind-setup.md](docs/kind-setup.md)), and `scripts/ci/check-contract-versions.sh` fails CI when one does not. Releases are signed `.modl` files on GitHub ([RELEASING.md](RELEASING.md)).

## 0.2.0

The map store and its data (epic-map-store-and-data). Contract 0.2.0; project setup schema 1; map store schema 2. Requires Ignition 8.3 and a PostgreSQL connection per project.

### Contract changes

- New message types: `map.load` and `map.load.reply` (level, change sequence, map items, kind and asset lists, adapter status, read-only reason, the browser's part of the setup, `kindSetups` (levels `phone` and `full` only) and the optional `user`, the session user name), `edits.apply` and `edits.apply.reply` (one all-or-none batch of versioned ops), `map.changed` (every committed batch, to every open map of the project), `tags.browse`, `tags.browse.reply`, `tags.resolve` and `tags.resolve.reply` (the tag browser's lookups, full editors only).
- `error` (0.1.0) may now carry `batchId`, `op: {index, id}` and `conflicts`. New error codes include `conflict`, `role`, `read-only`, `store-unreachable` (also the busy reply) and `tags-unavailable`; `stale` is reserved. The full list is in [docs/contract.md](docs/contract.md), "Error codes".
- The map item record (AD-20), closed: `id`, `kind`, `name`, `geometry` (GeoJSON `Point` or `LineString`, WGS 84), `properties`, `assetId`, `overrides`, `ends`, `attachment` (schema 2), `version`, `deleted`.
- The project setup, schema version 1 ([docs/setup.md](docs/setup.md)): a project resource naming the map store connection, the full and phone editing roles, the kind and asset functions, basemaps, refresh interval, alarm page and token secret (`<provider>/<name>`, a name only).
- The kind list and asset contract ([docs/kinds-and-assets.md](docs/kinds-and-assets.md)) and the kind setup schema ([docs/kind-setup.md](docs/kind-setup.md)), including popup view params and `{asset.path}/...` tag paths.
- The scripting API `system.mapstudio`: `getMap`, `applyEdits`, `refreshAdapters`, `ping`.
- Removed: the spike-only prop `testSet`.

### Stories

1. Tracer: one edit saved through the write path and read back.
2. Conflicts, retries, deletes and restore, and the phone editing role.
3. Kind list and asset list from the project's own library functions.
4. Saved edits reach every open map at once (`map.changed`, change sequence).
5. Map store operations: least-privilege rights, a failed or newer schema (read-only), the standby of a redundant pair (read-only).
6. Setup: validation with every problem listed, applied live without a Gateway restart, documented.
7. Setup editor in the Designer (the Map Studio Setup tab).
8. Unsaved edits kept in the browser and sent again.
9. Kind setups in the map store, and every saved map item checked against the kind list.
10. The core oil and gas icon set and state glyphs (`/res/mapstudio/icons/`), five adapted from Tabler Icons 3.49.0 (MIT, see [NOTICE](NOTICE)).
11. The scripting API documented, and the dev map's 30-pad set seeded through it.
12. Refactor sweep.
13. This release, rehearsed on the `ign-scada-template` test stack ([docs/template-install.md](docs/template-install.md)).
14. Instruments on lines: an instrument's attachment stored and kept on its line.
15. Tag browse and asset-relative paths for the tag browser.
16. The Designer setup form: pickers and layout.

### Map store migrations

- Migration 1 creates the `mapstudio_` tables on the first start (needs CREATE on the connection's schema).
- Migration 2 (story 14) adds `mapstudio_item.attachment` and two indexes. `ALTER TABLE` needs the role that **owns the `mapstudio_` tables**, not the least-privilege runtime role: start the upgraded module once with the owner's role on the connection, or give the tables to the connection's role first. Until then the map store is unavailable with an error naming `migration 2` and SQLState 42501, and nothing is changed. Take a backup first ([docs/operations.md](docs/operations.md)).

### Development

- The dev stack (`ops/`) runs the Gateway as the developer's uid and gid (`IGNITION_UID` and `IGNITION_GID`, recorded in the ignored `.env` on the first run), so Designer saves to the bind-mounted `ops/project` work. A Gateway container made before this change is recreated by `ops/up.sh`.
- The `web` and `e2e` packages are at 0.2.0. Release builds take their version from the tag, and every module jar's manifest carries it as `Implementation-Version`: `mapstudio_schema_version.module_version` records the real version (the 0.2.0 rehearsal found `dev` there).

## 0.1.0

The spike (epic-module-foundation): the `ao.mapstudio` Perspective component on MapLibre GL JS, `point.click` and `point.click.reply`, the `error` message, a line drawn with Terra Draw, the spike-only props `popupView` and `testSet`, a signed release installed through the template's module lock ([docs/template-install.md](docs/template-install.md)).
