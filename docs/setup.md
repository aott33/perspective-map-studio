# Map Studio project setup, schema version 1

Each Ignition project that uses Map Studio has one setup: the project resource `com.aoindustrial.perspective.mapstudio/setup/`, a folder holding `setup.json` and a `resource.json` (AD-5). It says which database connection holds the project's map, which roles may edit it, and how the map behaves. This page is the reference for every field; the code that checks it is `Setup.read` in `common/src/main/java/com/aoindustrial/perspective/mapstudio/common/contract/Setup.java`, and the dev project's copy is `ops/project/com.aoindustrial.perspective.mapstudio/setup/`.

Labels: **[live 8.3.10]** seen on the `ops/` dev Gateway (Ignition 8.3.10) by this repository's e2e suite or by hand (`docs/platform-checks.md`, "Epic 2 story 6"); **[unverified]** written but not seen working.

## A full example

```json
{
  "schemaVersion": 1,
  "connection": "MapStudio",
  "roles": {
    "full": ["MapEditor"],
    "phone": ["MapOperator"]
  },
  "kindsFunction": "",
  "assetsFunction": "",
  "refreshIntervalSeconds": 10,
  "alarmPage": "",
  "basemaps": ["none", "osm"],
  "tokenSecret": ""
}
```

`resource.json` beside it:

```json
{"scope": "G", "version": 1, "restricted": false, "overridable": true, "files": ["setup.json"], "attributes": {}}
```

The shortest working setup is two fields; everything else takes its default:

```json
{"schemaVersion": 1, "connection": "MapStudio"}
```

With that setup nobody may edit the map (both role lists are empty), and everyone who can open the view sees it.

## Fields

| Field | Type | Required | Default | Rule |
| --- | --- | --- | --- | --- |
| `schemaVersion` | whole number | yes | | `1`. A higher number is a setup for a newer Map Studio and is refused as a whole. |
| `connection` | text | yes | | The name of a database connection of the Gateway (PostgreSQL). Not empty. |
| `roles` | object | no | `{"full": [], "phone": []}` | Only the keys `full` and `phone`. |
| `roles.full` | list of text | no | `[]` | Ignition role names, compared exactly, each at most once. A user holding one gets full editing. |
| `roles.phone` | list of text | no | `[]` | As `roles.full`. A user holding one (and none of `roles.full`) gets phone editing. |
| `kindsFunction` | text | no | `""` | Empty, or a project script function as a dotted name: `mapstudio.kinds.get` (letters, digits and `_`, at least one dot, no brackets). Used from entry 3. |
| `assetsFunction` | text | no | `""` | As `kindsFunction`, for example `mapstudio.assets.find`. Used from entry 3. |
| `refreshIntervalSeconds` | whole number | no | `10` | From 1 to 3600 seconds. Sent to the browser in `map.load.reply`. |
| `alarmPage` | text | no | `""` | Empty, or a Perspective page path starting with `/`, with any number of placeholders (`/alarms/{item.name}`; the list in [kind-setup.md](kind-setup.md), epic 2 entry 9). |
| `basemaps` | list of text | no | `["none", "osm"]` | At least one of `none`, `osm`, `satellite`, `mapbox`, each at most once. |
| `tokenSecret` | text | no | `""` | The secret that holds the basemap token, as `<provider>/<name>` (for example `Internal/mapbox-token`): a secret provider's name and its secret's name, never the token itself. The Designer splits it at the first `/`; a value with no `/` (story 7 wrote one name) is read as a secret name with no provider and shows the warning "Name the secret provider too." A story 7 name that itself holds a `/` (such as `maps/token`) is read as `<provider>/<name>` (provider `maps`, name `token`); the Designer writes a name with a `/` and no provider as `/<name>` (for example `/maps/token`), which it reads back as that name with no provider. A provider with no secret name (`Internal/`) shows the warning "Name the secret too." Its value is never written to the Gateway log or into a message. |

A field set to JSON `null` takes its default. Any other field is refused: a misspelt field is never silently ignored (owner decision, 2026-10-26). A new field in a later Map Studio bumps `schemaVersion`.

## When a setup is wrong

Map Studio checks every field and reports every problem at once, each naming its field in plain words. A project whose setup is wrong has no map store until it is fixed: every `map.load`, `edits.apply` and `system.mapstudio` call answers `store-unreachable` with the reason, and the component shows it under the map ("Map store: store-unreachable: ..."). The last good setup is not kept (owner decision, 2026-10-26), so a broken file is visible at once.

The Gateway log (logger `MapStudio.setup`) has one warning each time a wrong setup is read, naming the project and the reason **[live 8.3.10]**:

```text
W [M.setup] The Map Studio setup of project mapstudio-dev (read on resource modified) cannot be read: refreshIntervalSeconds must be a whole number from 1 to 3600, not "ten".
```

The messages, as `Setup.read` gives them (several are joined as "2 problems: first; second."):

| Problem | Message |
| --- | --- |
| Not JSON | `setup.json is not valid JSON (line 3, column 17)` |
| Not an object | `setup.json must be a JSON object {"schemaVersion": 1, ...}` |
| No `setup.json` in the resource | `setup.json is missing from the setup resource.` |
| Newer schema | `setup.json is written for a newer Map Studio (schema 2; this module reads 1)` |
| Other schema | `schemaVersion must be 1, not "1"`; `schemaVersion is missing; it must be 1` |
| Connection | `connection is missing; it must name a database connection of the Gateway`; `connection must be the name of a database connection, not ""` |
| Roles | `roles must be an object {"full": [...], "phone": [...]}, not [...]`; `roles.full must be a list of role names, not "MapEditor"`; `roles.phone must hold only role names (non-empty text), not ""`; `roles.full lists MapEditor twice` |
| Functions | `kindsFunction must be empty or a project script function name such as mapstudio.kinds.get, not "kinds"` |
| Refresh interval | `refreshIntervalSeconds must be a whole number from 1 to 3600, not "ten"` |
| Alarm page | `alarmPage must be empty or a page path starting with /, not "alarms"` |
| Alarm page placeholder | `alarmPage: {item.foo} is not a placeholder Map Studio knows; use {item.id}, {item.name}, {asset.id}, {asset.path} or {item.properties.<field key>}.` |
| Basemaps | `basemaps must be a list from none, osm, satellite, mapbox, not "osm"`; `basemaps must name at least one of none, osm, satellite, mapbox`; `basemaps has "google"; each entry must be one of none, osm, satellite, mapbox`; `basemaps lists osm twice` |
| Token secret | `tokenSecret must be the name of a secret as text (its value is not shown)` |
| Unknown field | `refreshInterval is not a setup field of schema 1 (did you mean refreshIntervalSeconds?)` (the value is not shown) |

A project with no setup resource at all is not an error until something uses it: its first `map.load` or `applyEdits` after a Gateway start logs one warning, "Project P has no Map Studio setup ...", and answers `store-unreachable` **[live 8.3.10]**.

## Changing a setup

Edit `setup.json` and have the Gateway read the project again; no Gateway or module restart is needed **[live 8.3.10]**:

- **On disk** (a project in git, as `ops/project`): edit the file, then scan the projects: `POST /data/api/v1/scan/projects` with an API key that may write (`ops/scan.sh` on the dev stack). The Gateway reads the changed setup within a second of the scan; editing the file alone does nothing until a scan **[live 8.3.10]**.
- **In the Designer:** edit the setup in the **Map Studio Setup** tab ([setup-editor.md](setup-editor.md), epic 2 story 7) and save the project. A Designer save is expected to reach the same hook as a scan **[unverified]**.

The Gateway log then has one line, "Project P: Map Studio setup changed and applied on resource modified (connection ..., full editing roles [...], phone editing roles [...], refresh interval N s)", or the warning above. Adding the setup resource logs "... read on resource created", and deleting it "... setup removed; its map store is unavailable until a setup is added" **[live 8.3.10]**.

A change applies at the next call: an open map gets the new editing level, refresh interval and connection at its next `map.load` (a reload of the view), and its next save is checked against the new roles. Open maps are not told of a setup change: no message carries one (`map.changed` carries saved edits only). A changed `connection` starts that connection's wait and migrations as a Gateway start would (`docs/contract.md`, "The map store") **[unverified]**.

## What the browser sees

`map.load.reply` carries `setup: {refreshIntervalSeconds, basemaps, alarmPage}` (optional, contract 0.2.0; `docs/contract.md`). The connection, the roles, the function names and the token secret's name stay on the Gateway. The component shows the interval as `data-refresh-interval` on `.mapstudio-map`.

## Versions

The setup schema is part of Map Studio's public contract and follows semantic versioning (AD-9): a new field or rule that would refuse a setup that worked before needs a new `schemaVersion` and a module release that reads both. This module reads schema 1 only.
