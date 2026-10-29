# Kinds and assets from the project, version 0.3.0

Map Studio learns what can be drawn (the **kind list**) and what a map item can be linked to (the **asset list**) from two project library functions the project's setup names (AD-4). The module knows nothing of the project's data model: the functions read it however the project likes and return rows in the shapes below. Part of contract 0.3.0 ([contract.md](contract.md)); unchanged since 0.2.0.

Labels: **[live 8.3.10]** seen on the `ops/` dev Gateway by this repository's e2e suite (`e2e/tests/adapters.spec.mjs`); **[unverified]** written but not seen working.

## Naming the functions

In the setup (`com.aoindustrial.perspective.mapstudio/setup/setup.json`, [contract.md](contract.md)):

```json
{"kindsFunction": "my_map_adapters.kinds", "assetsFunction": "my_map_adapters.assets", "refreshIntervalSeconds": 10}
```

Each is a project library module path and a function in it, dotted identifiers only (`my_map_adapters.kinds`, `site.map.assets`); any other text is refused as `failing` without running anything. An empty string means "none": that list is `not-configured`. The functions take no arguments and run in the Gateway scope of the project, through the project's script manager **[live 8.3.10]**, so `system.tag`, `system.db` and the rest are there, and so is `system.mapstudio`.

## The kind list

A list of dicts, one per kind:

```python
[{'id': 'pad', 'name': 'Well pad', 'geometry': 'point', 'icon': 'well-pad', 'labelRank': 10,
  'fields': [{'key': 'operator', 'label': 'Operator', 'type': 'text', 'required': False},
             {'key': 'status', 'label': 'Status', 'type': 'choice', 'required': True,
              'choices': ['producing', 'shut in', 'abandoned']}]},
 {'id': 'line', 'name': 'Gathering line', 'geometry': 'line'}]
```

| Key | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Text, at most 64 characters, unique in the list. A map item's `kind` names it. |
| `name` | yes | Text people read. |
| `geometry` | yes | `point` or `line`. |
| `icon` | no | An icon id from [icons.md](icons.md) (`well-pad`, `pipeline`, ...); default `""`, drawn as `point`. A name the icon set does not have keeps the kind (drawn as `point`) and is reported in the kind status (see "Icon check"). |
| `labelRank` | no | Whole number; when labels collide, the higher rank keeps its label longer. Default 0. |
| `fields` | no | The form fields of the kind's map items (their `properties`), default none. |
| `area` | no | `True` on a `line` kind drawn as a closed area; only an area kind's setup takes `areaTints` ([kind-setup.md](kind-setup.md)). Refused on a `point` kind. Default false; `map.load` sends it only when true. |
| `instrument` | no | `True` on a `point` kind whose map items sit on a line, such as a tap, a meter or a line valve (epic 2 story 14, AD-19): only an instrument kind's map item may carry an `attachment` to a line ([contract.md](contract.md), "Instruments on lines"), and it may also be a free point (attachment null). A `line` kind with it is left out with the reason "instrument applies to point kinds only" and the list is `incomplete`. Default false; `map.load` sends it only when true. |

A form field is `{key, label, type, required, choices}`: `key` text, at most 64 characters, unique in the kind; `label` defaults to the key; `type` is `text`, `number`, `integer`, `boolean` or `choice`; `required` defaults to false; a `choice` field needs a non-empty `choices` list of text. Adding a kind needs no module change: return one more row.

## The asset list

A list of dicts, one per asset a map item can be linked to:

```python
[{'id': 'P12', 'name': 'Pad 12', 'kind': 'pad', 'basePath': '[default]Mesa/P12'}]
```

| Key | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Text, at most 64 characters, unique in the list. A map item's `assetId` names it. |
| `name` | yes | Text people read. |
| `kind` | yes | A kind `id` from the kind list. |
| `basePath` | yes | The asset's fully qualified tag path, provider included: `[default]Mesa/P12`. Live values and alarms are read below it. |

Assets are checked after kinds, against the last good kind list: an asset whose kind is not in it is left out.

**Asset-relative tag paths (entry 15).** A kind's setup names tags once for every asset of that kind, below the asset's `basePath`: `{asset.path}/Pressure` reads `[default]Mesa/P12/Pressure` for P12 and `[default]Mesa/P14/Pressure` for P14. The tag browser picks a full path and asks the Gateway (`tags.resolve`) to turn it into this form: a pick inside the asset's `basePath` becomes `{asset.path}/<suffix>`, with how many of the kind's linked map items the tag exists for ("resolves for 2 of 3 items"); a pick outside stays a full path, the same tag for every item. So give assets of one kind the same tag layout below their `basePath` (one UDT per kind does that). The shapes and rules: [contract.md](contract.md), "tags.browse and tags.resolve".

For both lists, keys Map Studio does not know are ignored, and the values must be plain JSON values (text, numbers, true or false, lists, dicts). Return a list (a tuple also works), not a Dataset: convert one with `system.dataset.toPyDataSet` and build the dicts.

## What Map Studio does with them

- It calls each function on its own small pool (2 threads, 8 waiting calls) with a **fixed 5 s timeout**, never on a Perspective thread or per click **[live 8.3.10]**.
- It keeps the result per project in memory and calls again every `refreshIntervalSeconds` of the setup (the setup is read afresh each time), kinds first, then assets. At most one call per project and list is in flight: a call still running at the next refresh is not started again.
- `system.mapstudio.refreshAdapters(project)` calls both now and returns both statuses; it waits for the calls to answer or time out, at most 21 s (four timeouts and 1 s: kinds then assets, each of which may wait for a timed-out call to end before its own call), then returns the statuses it has; a refresh still running lands in the cache later. It blocks the calling script's thread that long, so call it from a session or Gateway script, not a binding or a tag event. Call it after your own kind or asset data changed. A refresh asked for while a call is in flight joins it **[live 8.3.10]**.
- A timed-out call cannot be stopped (Jython has no safe way): it keeps its thread until it returns, and its answer is dropped.
- `map.load` carries `kinds` to every session, `assets` only to sessions with phone or full editing (asset rows carry tag paths), `assetNames` (`[{id, name}]`, since 0.3.0: the ids and names alone, so the map's search finds an item by its asset's name for a viewer too; epic 3 entry 9) and `adapters: {kinds: status, assets: status}` to every session ([contract.md](contract.md)).
- The write path checks every saved map item and kind setup against the same cache, read once per batch ([kind-setup.md](kind-setup.md), entry 9); with no list in use only deletes are saved. The icon check (entry 10) reads it too. Nothing is stored in the database.

## Icon check

Each kind's `icon` is checked against the icon set the module ships ([icons.md](icons.md), `IconCatalogue`) every time the kind list is read (`e2e/tests/icons.spec.mjs` checks it on the dev Gateway):

- A known icon, or no icon: nothing is reported; no icon means `point`.
- An unknown icon (`wel-pad`): the kind stays in the list with the name it gave, the map draws it as `point`, and the status word does not change (`ok`, or `incomplete` for other left-out rows). The kind status message adds one sentence per kind, the first three named: "3 kinds from mapstudio_dev.kinds. Kind pad names icon wel-pad, which Map Studio does not have; it shows as a plain point." A session that cannot edit gets the count only ("1 kind names an icon Map Studio does not have and shows as a plain point.").
- The Gateway log gets one warning on `MapStudio.adapters` when the set of kinds naming unknown icons changes, naming kind ids only ("Kind pad names an icon Map Studio does not have."), and one info line when it clears ("No kind from mapstudio_dev.kinds names an icon Map Studio does not have any more."). The set is the kind ids: the same kinds again logs nothing, even when a kind's unknown icon name or the row order changed. When the status word changes at the same time, its one line carries the sentence instead ("No kind names an icon Map Studio does not have any more." when it clears).
- If the module's icon catalogue cannot be read (a broken build), the Gateway logs one warning when it starts and checks no icons; the kind list still loads.
- The dev adapter's mode `unknown-icon` (the `/adapters` page) gives the pad kind the icon `wel-pad`.

## Status

Each list has a status: `{status, message, function, count, left, refreshedAt}`. `count` is the number of rows in use, `left` the rows the last call left out, `refreshedAt` when the list in use was read (ISO 8601 UTC, or null).

| `status` | When | `message` (examples) | The list in use |
| --- | --- | --- | --- |
| `ok` | every row is good | "3 kinds from mapstudio_dev.kinds." | the new rows |
| `empty` | the function returned `[]` | "The asset function mapstudio_dev.assets returned no assets." | none |
| `failing` | the function raised, could not be found, or returned something other than a list | "The kind function mapstudio_dev.kinds failed: RuntimeError: ...", "... returned a dict, expected a list of dicts." | the last good list, if any ("Showing the list from 10:42 UTC.") |
| `slow` | no answer within 5 s, or Map Studio's adapter pool was full | "The kind function mapstudio_dev.kinds did not answer within 5 s." | the last good list, if any |
| `incomplete` | some rows were left out | "2 of 6 assets from mapstudio_dev.assets left out: row 5 (id P99): basePath does not start with a [provider]; ..." (the first three reasons) | the good rows |
| `not-configured` | the setup names no function | "The setup names no kind function." | none |
| `loading` | the first call has not answered yet | "Loading the kind list from mapstudio_dev.kinds." | none |

All seven words are stable kebab-case; messages are plain words and may change. Reasons name rows by position and `id` only, never other row content; an echoed `id`, `kind` or field `key` is cut to 64 characters and every control character in it (newline, tab, escape) becomes `?`, and exception text is cut the same way to one line of 200 characters, so a host value cannot add a line to the Gateway log.

**Viewers.** A session at level `none` gets the same status words and counts, but `failing` and `incomplete` messages without the host's error text or the row reasons: "The kind function mapstudio_dev.kinds failed.", "2 of 6 assets from mapstudio_dev.assets left out." (with "Showing the list from ..." when it applies). Sessions at `phone` and `full`, `refreshAdapters` and the Gateway log get the full message.

**Gateway log.** One line per status change per project and list, on the logger `MapStudio.adapters` (the Gateway log shows it as `M.adapters`): a warning into `empty`, `failing`, `slow` or `incomplete`, an info line into `ok` (on the first good list, and "recovered" after a bad one) and into `not-configured`. A status that stays the same logs nothing **[live 8.3.10]**. Exception text is cut to its first line, 200 characters.

## Writing an adapter

- Jython 2.7: no f-strings, no type hints (the Ignition Jython rules).
- Catch both kinds of exception around `system.*` calls (`java.lang.Throwable` and `Exception`), log the class name, and **re-raise**: a failure must reach Map Studio as `failing`, never as `[]`, which reads as "no rows" and replaces the list.
- Keep it fast: it runs every refresh interval, and past 5 s the list goes `slow`. Cache in the project if the source is expensive.
- Return fully qualified base paths, provider included.
- Two examples, both **[unverified]** on a live Gateway (they compile under Jython 2.7 in the unit tests): [examples/adapters/udt_instances.py](examples/adapters/udt_instances.py) (one asset per UDT instance in the tag tree, through `system.tag.browse`) and [examples/adapters/named_query.py](examples/adapters/named_query.py) (kinds and assets from named queries, through `system.db.execQuery`).

## The dev adapter

The dev project's library `mapstudio_dev` (`ops/project/ignition/script-python/mapstudio_dev/code.py`) is test equipment: five kinds (`pad`, `line`, `geofence`, an area kind, and the instrument kinds `tap` and `valve`) and ten assets (the tracer's and the L-SWD set's, epic 3 entry 2), and a mode (`ok`, `empty`, `broken`, `slow`, `incomplete`) switched by the buttons of the `/adapters` page (map editors only) and kept in `system.util.getGlobals()`, which the page's session scripts and Map Studio's calls share **[live 8.3.10]**. Its setup refreshes every 30 s, so the e2e test's two overlapping refreshes are not crossed by a timed one. The library also holds the dev views' role check, `holdsMapEditor(session)`, used by the `/adapters` buttons and by the `/edit` page's script checks and seed button (epic 2 story 12); if the library fails to load, those buttons raise a script error and write nothing.
