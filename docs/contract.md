# Map Studio contract, version 0.3.0

The public contract between the browser, the Gateway, the host project and the map store, as epic-map-store-and-data built it (0.2.0, AD-8, AD-9) and epic-viewing extends it (0.3.0, unreleased: the live values of entry 5, [CHANGELOG.md](../CHANGELOG.md)). It follows semantic versioning (AD-9): a later change names the version that made it in the "Since" column or the section that describes it. The code is the reference: `common/src/main/java/com/aoindustrial/perspective/mapstudio/common/Messages.java` and `common/.../common/contract/`, mirrored in `web/typescript/contract.ts`, `web/typescript/messages.ts` and `web/typescript/live.ts`.

Labels: **[live 8.3.10]** seen on the `ops/` dev Gateway by this repository's e2e suite (`e2e/tests/store.spec.mjs`, and from entry 2 `e2e/tests/writepath.spec.mjs`, from entry 4 `e2e/tests/changes.spec.mjs`, from epic 3 entry 5 `e2e/tests/live.spec.mjs`); **[unverified]** written but not seen working.

## Messages

Every message, both ways, is one JSON object `{v, type, id, body}` carried under the model event `mapstudio.message`; `v` is 1. A type not listed here is not sent. "Since" is the contract version that added the type (0.1.0 is the spike's release; 0.2.0 is epic-map-store-and-data's release; 0.3.0 is epic-viewing's, unreleased); the sections below that describe a 0.2.0 or 0.3.0 type say so in their heading or first line.

| Type | Direction | Since | Body |
| --- | --- | --- | --- |
| `map.load` | browser to Gateway | 0.2.0 | `{}` |
| `map.load.reply` | Gateway to browser | 0.2.0 | `{level, seq, items, kinds, assets, adapters, readOnly, setup?}`: `level` is `none`, `phone` or `full` for this session; `seq` is the project's last change sequence number; `items` are map item records, deleted ones left out (at level `none` each with `overrides` `{}`: overrides hold full tag paths, which viewers do not get, epic 2 entry 9, unit tested `MapLoaderTest`); `kinds` the project's kind list; `assets` its asset list, sent only at level `phone` or `full`; `adapters` `{kinds: status, assets: status}`, at level `none` with viewer messages (no host error text, no row reasons) ([kinds-and-assets.md](kinds-and-assets.md)) **[live 8.3.10]**; `readOnly` is null, or the reason in plain words when the map can be read but not saved on this Gateway (a newer schema **[live 8.3.10]**, or a standby **[unverified]**; entry 5); `kindSetups` (added by epic 2 entry 9) the live kind setup records `{kindId, setup, version, deleted}`, sent only at level `phone` or `full` ([kind-setup.md](kind-setup.md)) **[live 8.3.10]**; `setup` (optional, added by epic 2 entry 6) is `{refreshIntervalSeconds, basemaps, alarmPage}` from the project setup (`docs/setup.md`), and a reader treats a missing or malformed `setup` as absent **[live 8.3.10]**; `assetNames` (added in 0.3.0 by epic 3 entry 9) is `[{id, name}]`, every asset's id and name and nothing else (no base path, no kind), sent at every level so a viewer's search finds a map item by the name of the asset it is linked to; a reader treats a missing `assetNames` (an older Gateway) as the names of `assets` when it has them, else none **[live 8.3.10]** |
| `edits.apply` | browser to Gateway | 0.2.0 | `{batchId, ops}` (below) |
| `edits.apply.reply` | Gateway to browser | 0.2.0 | `{batchId, seq, results: [{entity, id, version}]}`: the batch's change sequence number and each op's new version **[live 8.3.10]** |
| `map.changed` | Gateway to browser | 0.2.0 | `{seq, batchId, actor, ops}`: one committed batch, sent to every open map of the project (below) **[live 8.3.10]** |
| `error` | Gateway to browser | 0.1.0 (`batchId`, `op`, `conflicts` 0.2.0) | `{code, message}`, plus `batchId` and `op: {index, id}` when an `edits.apply` op is at fault, and `conflicts` on a `conflict` (below) |
| `tags.browse` | browser to Gateway | 0.2.0 | `{provider?, folder?}` (entry 15, below) |
| `tags.browse.reply` | Gateway to browser | 0.2.0 | `{provider, folder, providers: [{name, isDefault}], children: [{name, path, type, dataType, hasChildren}], truncated}` **[live 8.3.10]** |
| `tags.resolve` | browser to Gateway | 0.2.0 | `{kindId, assetId, path}` (entry 15, below) |
| `tags.resolve.reply` | Gateway to browser | 0.2.0 | `{path, relative, n?, m?}` **[live 8.3.10]** |
| `values.batch` | Gateway to browser | 0.3.0 | `{seq, full, items, kindDisplay?}`: the live values of the open map's items (epic 3 entry 5, below) **[live 8.3.10]** |
| `popup.open`, `popup.close` | browser to Gateway | 0.3.0 | `{itemId}`: the map item whose popup is open; its values are pushed on change meanwhile (below) **[live 8.3.10]** |
| `basemap.source` | browser to Gateway | 0.3.0 | `{basemap}`: the browser asks for a basemap's raster tile source; only `satellite` is asked for (epic 3 entry 6, below) **[live 8.3.10]** |
| `basemap.source.reply` | Gateway to browser | 0.3.0 | `{basemap, provider, tiles, tileSize, maxzoom, attribution}`: the raster source, its token (read on the Gateway from the setup's secret) inside the tile URL template only (below) **[live 8.3.10]** |
| `point.click`, `point.click.reply` | both | 0.1.0 | the spike's round trip, unchanged |

The `id` of a reply is the `id` of the message it answers.

## map.changed: saved edits reach every open map

After every committed batch, from a browser or from `system.mapstudio.applyEdits`, the Gateway sends one `map.changed` to every open Map Studio component of that project, whatever its level, the saving session included: a `full` editor, a `phone` editor (since story 12, `changes.spec.mjs`) and a `none` viewer of one project **[live 8.3.10]**; another project's maps getting nothing is unit tested (`ChangeBusTest`, `MapStudioDelegateTest`) and was seen on the template's test stack: a second project's open map got no `map.changed` **[live 8.3.9]** (the rehearsal and the published 0.2.0 on the template stack) (see [platform-checks.md](platform-checks.md), "Epic 2 story 13"). Its `id` is a new UUID (it answers nothing).

```json
{"v": 1, "type": "map.changed", "id": "<UUID>",
 "body": {"seq": 5, "batchId": "<UUID>", "actor": "mapeditor",
          "ops": [{"op": "create", "entity": "item", "id": "<UUID>", "version": 1,
                   "record": {"id": "<UUID>", "kind": "line", "name": "Line 21:05:09",
                              "geometry": {"type": "LineString", "coordinates": [[-104.99, 39.74], [-104.98, 39.75]]},
                              "properties": {}, "assetId": null, "overrides": {}, "ends": null,
                              "attachment": null, "version": 1, "deleted": false}}]}}
```

- `seq` is the batch's change sequence number; `batchId` and `actor` are the saved batch's (the session's user name, or the actor a script named). A map at level `none` gets `actor` as `""`: an anonymous viewer never learns the editors' user names (`map.load` never names them either). `phone` and `full` maps get the name. The level is read when the change is sent (unit tested, `MapStudioDelegateTest`) **[unverified]** live.
- Each op carries `version` (after the op) and `record`, the full stored record after the op: a map item record for `entity` `item` (a tombstone has `deleted: true`), a kind setup record `{kindId, setup, version, deleted}` for `kindSetup` (entry 9); a map at level `none` gets that record without `setup` (unit tested, `MapStudioDelegateTest`, and seen on a viewer's websocket frames, `changes.spec.mjs`, **[live 8.3.10]**), and each map item record with `overrides` `{}` (both hold tag paths; unit tested, `MapStudioDelegateTest`, **[unverified]** live). Full records, because an update carries only the fields it changes. Every op carries both: the Gateway refuses to send a batch with an op that has no record (it logs the hook failure at error) rather than send a body every browser would read as unreadable; the skipped `seq` then reaches browsers as a gap.
- **Order.** The Gateway sends a project's changes in `seq` order: a batch whose hook runs before an earlier batch's is held up to 2 s for it; a `seq` that never arrives is skipped after 2 s. The first event of a project after a Gateway start sets the expected `seq`, so an out-of-order pair among the very first batches after a start is not held: open browsers reload once on that gap. Delivery never runs inside the write transaction and never delays the saver's reply.
- **Browser rule.** Before its `map.load.reply` the browser holds `map.changed`, then applies the held ones above the loaded `seq` in order. On a loaded map: `seq` at or below the current one is ignored; `seq` one above is applied, each record only when its `version` is above the drawn one (so a repeated or self-sent change does nothing); a `seq` further ahead, or an unreadable `map.changed` (no `seq` or `ops`, or a bad record), is a gap: the browser sends `map.load` once, replaces its items with the reply and keeps holding changes until then. `seq` advances only through `map.load.reply` and `map.changed`, never through `edits.apply.reply`.
- A `map.load` answered with an error (the busy `store-unreachable` reply among them) leaves the map not loaded and holding changes; the next `map.changed` sends one new `map.load`, and so does a 15 s timer while no `map.load` is pending (a quiet project sends no `map.changed`; epic 2 story 8), so a refused reload never leaves the map stale until the page is reloaded.
- A browser that was disconnected catches up at its next gap or its next page open; reloading on a Perspective reconnect is epic-viewing's (AD-6).
- The dev component shows the state for tests as `data-store-seq` (the last `seq` applied) and `data-map-reloads` (gap reloads) on `.mapstudio-map`.

## tags.browse and tags.resolve: the tag browser's lookups

Added in 0.2.0 by entry 15 for epic-editing's tag browser (Map Studio's own tree with a provider dropdown). Both answer a **full editor** only: the level comes from the session user's roles on the Gateway, and anything but `full` (a phone editor, a viewer) is refused `role` ("Browsing tags needs a full editing role. Ask for a Map Studio editing role.") before the body is read, so a viewer learns nothing about tags **[live 8.3.10]**. Checks, in order: the project's setup (`store-unreachable`), the level (`role`), the body and the names (`invalid`), for `tags.resolve` the map store (`store-unreachable`; a read-only store still answers) and the level again on the setup the map items are read under (`role`), then the tag calls (`tags-unavailable`). Both read tag structure only (browse), never a value: no tag is read, subscribed, written or edited (AD-1). Each runs on the module's work pool (a full pool gets the busy `store-unreachable` reply) and every tag call answers within 5 s or the reply is `tags-unavailable`. How Ignition answered each call: [platform-checks.md](platform-checks.md), epic 2 story 15.

### tags.browse

```json
{"type": "tags.browse", "body": {"provider": "default", "folder": "Mesa/P12"}}
{"type": "tags.browse.reply", "body": {"provider": "default", "folder": "Mesa/P12",
  "providers": [{"name": "default", "isDefault": true}, {"name": "System", "isDefault": false}],
  "children": [{"name": "Comms", "path": "[default]Mesa/P12/Comms", "type": "tag", "dataType": "Boolean", "hasChildren": false},
               {"name": "Flow", "path": "[default]Mesa/P12/Flow", "type": "tag", "dataType": "Float8", "hasChildren": false},
               {"name": "Pressure", "path": "[default]Mesa/P12/Pressure", "type": "tag", "dataType": "Float8", "hasChildren": false}],
  "truncated": false}}
```

- `provider` omitted, null or empty is the default provider; a name is matched without letter case and answered in the Gateway's spelling, as Ignition matches it **[live 8.3.10]**. An unknown provider is `invalid`, "There is no tag provider named nope on this Gateway."
- The default provider (owner decision, 2026-10-27) is the session project's default tag provider; when that is blank or names a missing provider, `default` if it exists, else the first provider by name other than `System` (else `System`). Exactly one entry of `providers` has `isDefault: true`. The dev project's own default is blank, so `default` is marked **[live 8.3.10]**; a project naming its own is unit tested only **[unverified]**.
- `folder` omitted, null or empty is the provider's root; leading and trailing `/` are trimmed; a folder holding `[` or `]`, an empty part (`a//b`) or longer than 1024 characters is `invalid`; a folder the tag system does not have is `invalid`, "The folder Mesa/Nope was not found in tag provider default." **[live 8.3.10]**.
- One level per call. Each child: `name`; `path`, its full path with `[provider]`; `type`, one of `folder`, `tag`, `udt-instance`, `udt-type` (in `_types_`), `other`; `dataType`, Ignition's data type name (`Float8`, `Boolean`, `Int4`, ...) for a tag, null for anything else; `hasChildren`. Tag properties and nodes without a path (a UDT instance's `Parameters`) are left out, so a tag browses as empty **[live 8.3.10]**.
- At most 1000 children, ordered by name (ignoring letter case first); `truncated` is true when the folder has more, or may have more (the tag system answered as many nodes as were asked for). Only listed children count toward the 1000. A truncated page is sorted, but it holds the first 1000 children the tag system answered, not the first 1000 by name. Paging may come later without changing these fields.
- The browse runs under the session user's roles. A tag whose read permissions the user lacks was still listed on 8.3.10 **[live 8.3.10]**: the list is not a permission check.

### tags.resolve

```json
{"type": "tags.resolve", "body": {"kindId": "pad", "assetId": "P12", "path": "[default]Mesa/P12/Pressure"}}
{"type": "tags.resolve.reply", "body": {"path": "{asset.path}/Pressure", "relative": true, "n": 2, "m": 3}}
```

- `kindId` must be in the project's kind list and `assetId` in its asset list ([kinds-and-assets.md](kinds-and-assets.md)), the asset's kind equal to `kindId`; else `invalid`.
- `path` is a full path `[provider]a/b`, `{asset.path}` or `{asset.path}/<suffix>`. Anything else is `invalid`: no provider (`Mesa/P12/X`), a relative provider (`[~]`, `[.]`), another placeholder (`{asset.name}`), a brace or bracket inside the path, an empty part, or over 1024 characters.
- A full path equal to the asset's base path, or below it on a `/` boundary, comes back as `{asset.path}` or `{asset.path}/<suffix>` with `relative: true`. The provider and the base path's parts are compared without letter case, as Ignition compares tag paths **[live 8.3.10]**; the suffix keeps the picked path's case. `[default]Mesa/P12/X` is not below `[default]Mesa/P1`. Any other full path comes back unchanged with `relative: false` and no `n` or `m`: `{"path": "[default]Plant/Header/Pressure", "relative": false}` **[live 8.3.10]**. `{asset.path}/...` sent as it is answers the same as the full path it stands for.
- `m` is the number of the project's live map items of kind `kindId` whose `assetId` names an asset in the asset list; `n` is how many of those have a tag at `<their asset's basePath>/<suffix>` (or at the base path itself for `{asset.path}`), checked by structure under the session user's roles, once per distinct path and in one call per parent folder, at most 50 calls at a time **[live 8.3.10]**. A parent folder the tag system does not have counts its tags as missing; any other bad answer is `tags-unavailable`, never a low `n`.
- The asset list accepts base paths the lookups cannot build on (`[~]Mesa/P12`, `[default]/Mesa/P12`). A full `path` for such an asset is `invalid`, "The asset P12's basePath [default]/Mesa/P12 cannot be used for tag paths; the host adapter must give a full path such as [default]Mesa/P12." (the picked path itself is checked first). A linked item on such an asset counts in `m`, never in `n`. A kind with no linked item answers `n: 0, m: 0`. The tag browser shows "resolves for n of m items".

## values.batch, popup.open and popup.close: live values (epic 3 entry 5)

Added in 0.3.0 (AD-6, AD-7). The Gateway holds one subscription per project to every tag path the project's kind setups turn on, in one shared live-value cache, and sends each open map its values in batches; no session and no map item has a subscription of its own, and a part a kind setup turns off is never subscribed. The code is `gateway/.../live/` (`ValuePlan`, `LiveValueCache`, `LiveSession`), `common/.../contract/LiveValue.java` and `KindDisplay.java`, and `web/typescript/live.ts`; how Ignition answered: [platform-checks.md](platform-checks.md), "Epic 3 entry 5".

**What is subscribed.** For every live map item whose kind has a kind setup ([kind-setup.md](kind-setup.md)): the comms path when `comms.on` is not false, each KPI's path when its `on` is not false, and under the alarms path the three Alarm Metrics `ActiveAckCount`, `ActiveUnackCount` and `HighestActivePriority` (`<path>/Alarm Metrics.<Metric>`, by Java subscription only; a read answers `Bad_Unsupported`). `{asset.path}` and `{asset.path}/<suffix>` resolve from the item's own asset (its base path in the asset list); a full `[provider]path` is one tag for every item of the kind, and one subscription serves them all. An item's `overrides` replace the kind's `comms` and `alarms` parts and, by key, a KPI's `path` and `on`, with full paths only. The plan is rebuilt after every committed batch of the project (a link, a kind setup or an item change) and when the asset list is replaced; the Gateway log (`MapStudio.live`) has one line per path subscribed or unsubscribed and one per rebuild ("Project P: live plan rebuilt: N map items, M tag paths (a subscribed, b unsubscribed), c unresolved slots.") **[live 8.3.10]**.

**LiveValue.** Each slot is `{value, quality, t, stale, reason}`: the tag's value as JSON (null before the first delivery), Ignition's quality name (`Good`, `Uncertain_InitialValue`, `Bad_NotFound`, ...), the value's time (ISO 8601 UTC, null before the first delivery), and stale with its reason in plain words, worked out on the Gateway: a slot is stale when its quality is not good (reason: the quality name, or `no value yet` before the first delivery), and every KPI and the alarms slot of an item are stale with the reason `comms lost` while the item's comms value is false or its comms slot is stale. The comms slot itself is a value (`false` with a good quality is comms lost, not stale). A reason never holds a tag path: viewers get batches too. The alarms slot's value is `{active, unacked, priority}`: the active alarms below the path (acknowledged plus unacknowledged), how many of them are unacknowledged, and the highest active priority as the map's 1 (Critical, High), 2 (Medium) or 3 (Low), 0 when none is active (Diagnostic never shows).

```json
{"v": 1, "type": "values.batch", "id": "<UUID>",
 "body": {"seq": 41, "full": true,
          "items": [{"id": "<UUID>",
                     "comms": {"value": true, "quality": "Good", "t": "2026-10-28T10:00:00Z", "stale": false, "reason": ""},
                     "kpis": {"pressure": {"value": 412.5, "quality": "Good", "t": "2026-10-28T10:00:00Z", "stale": false, "reason": ""}},
                     "alarms": {"value": {"active": 1, "unacked": 1, "priority": 1}, "quality": "Good", "t": "2026-10-28T10:00:02Z", "stale": false, "reason": ""},
                     "problems": []},
                    {"id": "<UUID>", "kpis": {}, "problems": [{"slot": "comms", "reason": "no asset is linked"}]}],
          "kindDisplay": [{"kindId": "pad", "comms": true,
                           "kpis": [{"key": "pressure", "label": "Pressure", "unit": "psi", "icon": true, "on": true}],
                           "alarms": {"on": true, "count": true, "summary": true}, "link": "/pad/{item.name}"}]}}
```

- **Batches.** After every `map.load.reply` (the open, and the reconnect path, which reloads) the map gets one **full** batch at once: every planned map item of the project and `kindDisplay`, the path-free projection of every kind setup (comms on, each KPI's key, label, unit, icon and on, the alarm parts, the link), which a viewer needs to draw the popup's words. Then, once per refresh interval of the setup (`refreshIntervalSeconds`, default 10 s), a **changes-only** batch with the items whose values changed since the map's last batch, and nothing when none did. A plan rebuild (a link, a kind setup or an asset list change) makes the next batch full again. `seq` is the cache's change counter when the batch was built; the browser replaces every item on `full` and the carried items otherwise (`web/typescript/live.ts`, `applyBatch`). Its `id` is a new UUID (it answers nothing). **[live 8.3.10]**
- **Items.** `comms`, `alarms` and each `kpis` key are present only where the kind setup (with the item's overrides) turns that part on and the path resolves; `problems` lists the slots that could not be resolved (`comms`, `kpi:<key>`, `alarms`) with a reason: `no asset is linked`, `the linked asset is not in the asset list`, `the tag path is not a full path or an {asset.path} path`, or `the tag was not found` once the tag system answered `Bad_NotFound` (a slot in that state still carries its LiveValue, stale, quality `Bad_NotFound`). A map item whose kind has no setup, or whose setup turns everything off, is not in any batch. The batch goes to every level, `none` included, and never carries a tag path.
- **popup.open and popup.close.** When the browser opens a map item's popup it sends `popup.open {itemId}`; while it is open the Gateway pushes that item's values as a changes-only batch of that one item within 250 ms of a change (the regular batch still comes on its interval), until `popup.close {itemId}` or the map closes. A new `popup.open` replaces the one before. Neither is answered on success; a missing `itemId` is `invalid` ("popup.open needs an itemId."). An item the plan does not cover is accepted and pushes nothing **[live 8.3.10]**.
- **Threads and load.** Deliveries arrive on the tag system's threads and only store the value and mark the item; batches are built on the module's one live thread and queued on the session's execution queue, as `map.changed` is. Many sessions of one project cost one subscription per path, seen in the Gateway log of three open sessions (`e2e/tests/live.spec.mjs`) **[live 8.3.10]**.
- **The style slot (epic 3 entry 1).** An item whose kind setup (or its own `overrides.styleRule`) has a style rule carries `style: {preset, stale, reason}`: the preset the rule gives for the source's value, worked out on the Gateway ([kind-setup.md](kind-setup.md), "Style rules as the map evaluates them"), or `normal` with `stale: true` and the reason (`no value yet`, the quality name, `comms lost`) while the source is stale, so the map draws the stale look alone until a fresh value arrives. The rule's source is one more slot of the plan (`style`): a `{path}` resolved like any other, or a `{kpi}` that shares that KPI's path (one subscription, kept while the rule names it even when the KPI is off). A `problems` entry with slot `style` says why no preset could be worked out (`the style rule names a KPI the setup does not have`, the expression's failure in words, `the value is not a number, so no band holds it`). `kindDisplay` carries each kind's `styleRule` as its path-free display, `{type, source, cases: [{label, preset}]}` (`source` is `kpi:<key>`, `tag` or `instruments`; an expression's text stays on the Gateway and its cases are the presets it names), and an area kind's `areaTints {property, tints}` as stored, so the preview, the legend and a viewer's areas need no path **[live 8.3.10]**.
- **Drawing (the browser, entry 5).** A point draws its kind's glyph on a neutral disc; comms lost adds a dashed ring, the comms-lost badge and the word "Comms lost" in the `comms-lost` token (`--mapstudio-comms-lost`, falling back to the Perspective variable `--qual-1`; never a colour literal); a stale value the stale glyph and the word; an active alarm the priority glyph on a solid badge in the priority token (`--mapstudio-alarm-1` to `-3`, falling back to `--error`, `--warning`, `--info`) when unacknowledged and on a hollow badge when acknowledged, with the priority digit beside it; the icon KPI's text under the disc. The default popup opens on a click, in the order header (kind glyph, name, the page link icon slot), comms with its data age, two to three KPIs, alarms (counts; the summary in words is entry 8), with every stale value marked "Stale - " and its reason. The spike's `popupView` prop keeps precedence until entry 8 retires it. The dev page `/live` shows it; the hidden element `.mapstudio-live` carries one `.mapstudio-live-item` per map item with values (`data-state`, `data-comms`, `data-alarm`, `data-kpi`, `data-problems`, `data-marker`) for tests, and `.mapstudio-map` carries `data-live-seq` and `data-live-full`.

## basemap.source: the satellite basemap's tile source (epic 3 entry 6)

Added in 0.3.0 (AD-12; the user's side is in [basemaps.md](basemaps.md)). The setup's `basemaps` list reaches the browser in `map.load.reply`'s `setup`; the component offers the ones this version draws, `none`, `osm` and `satellite`, in the setup's order (`mapbox`, the deferred vector style, is left out with one console line). None and OpenStreetMap need nothing from the Gateway: None is the blank background and OpenStreetMap's tiles (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`, attribution "(c) OpenStreetMap contributors") are built into the browser. Satellite is Mapbox satellite imagery through the Raster Tiles API, and its token is the secret the setup's `tokenSecret` names, read on the Gateway only when a browser asks:

```json
{"v": 1, "type": "basemap.source", "id": "<UUID>", "body": {"basemap": "satellite"}}
{"v": 1, "type": "basemap.source.reply", "id": "<UUID>",
 "body": {"basemap": "satellite", "provider": "mapbox",
          "tiles": ["https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=pk...."],
          "tileSize": 512, "maxzoom": 22,
          "attribution": "&copy; <a href=\"https://www.mapbox.com/about/maps/\">Mapbox</a> &copy; Maxar <a href=\"https://apps.mapbox.com/feedback/\">Improve this map</a>"}}
```

- The Gateway (`gateway/.../basemap/BasemapSources`) runs it on the work pool like `map.load`: the project's setup (`store-unreachable` without one), the ask (`invalid` for a basemap other than `satellite`, or when the setup does not offer `satellite`), then the token through `SecretProviderManager.getProvider(provider).read(name)` (`Plaintext`, closed after the text is taken; how 8.3.10 answered: [platform-checks.md](platform-checks.md), "Epic 3 entry 6") **[live 8.3.10]**. The provider and the tile template are the Gateway's (AD-12: the provider is a setting, never browser code), so a later provider changes the reply and nothing in the browser.
- **The token must be a public Mapbox token** (`pk.`): it reaches every viewer's browser in the tile URL, so a secret token (`sk.`) or any other value is refused. Use a token restricted to the site's URLs in the Mapbox account.
- Every token problem is the error code `token-unavailable` with a plain-words message that names the secret (`<provider>/<name>`) and never its value: the setup names no secret ("The Map Studio setup names no map token secret (tokenSecret): ..."), the name has no provider, the provider does not exist, the secret was not found, it could not be read (one warn line with the exception's class name), it is empty, or it is not a public token ("The map token secret P/N is not a public Mapbox token: it must start with pk. ...") **[live 8.3.10]**. The browser shows the message under the Legend panel's basemap buttons and keeps the basemap it had (with nothing drawn yet it falls back to the first offered basemap that needs no token).
- The Gateway log (`MapStudio.basemap`) names the secret and the outcome, never the value (unit tested with the log captured at debug, `BasemapSourcesTest`; the e2e suite searches the live log) **[live 8.3.10]**. The browser keeps the reply in the component's memory for the page, never in `localStorage` or `sessionStorage` (the remembered choice is the basemap's id only, key `mapstudio.basemap.v1`), and no console line holds it.
- The browser draws the source as the raster layer `mapstudio-basemap` under the item layers, and MapLibre's attribution control (bottom-left beside the Legend button and the scale bar, never collapsed; epic 3 entry 14) shows the provider's `attribution`. A tile that does not load is said in words under the panel's basemap buttons ("OpenStreetMap tiles are not loading; check the network.") at console info, never as a browser error, so a site without internet keeps a working map.
- For tests: `.mapstudio-map` carries `data-basemap` (the chosen id), `data-basemap-offered`, `data-basemap-status` (the refusal or tile status, or '') and `data-basemap-tiles` (`none`, `loading`, `loaded`, `failed`), and `data-center` and `data-zoom` (the view, for the starting area), and `data-legend-open` (whether the Legend panel is open; entry 14).

## The component's props

The closed list in `common/src/main/resources/mapstudio.props.json` (AD-1; a prop outside it is not read). Since 0.3.0:

| Prop | Since | What it does |
| --- | --- | --- |
| `startingArea` | 0.3.0 | Where this component opens the map (epic 3 entry 6, R1): `{center: {lng, lat}, zoom, bounds: {west, south, east, north}}`. When all four bounds are numbers with `west < east` and `south < north` (longitudes within -180 to 180, latitudes within -85 to 85) the map fits them with 24 px of padding; otherwise it opens on `center` at `zoom` (0 to 24). The default is the whole world (0, 0 at zoom 1). An invalid value opens on the whole world with one console warning saying why. A changed value moves the map. Two components on one page may open on different areas: both show the same map items (the one project map), seen on the dev page `/two` **[live 8.3.10]**. The component's `START_VIEW` constant of 0.2.0 is gone; the dev views set the old view (centre -104.9725, 39.7445, zoom 12) through the prop. |
| `popupView` | 0.1.0 | Spike-only: `{path, params}`, the project view opened as a popup on a point click; retired when the kind setup's `popupView` replaces it (epic 3 entry 8). |
| `editMode` | 0.3.0 | `true` opens the component in Edit mode (epic 3 entry 14). Today Edit mode holds the spike's Draw a line tool alone, which View mode (the default) never shows; epic-editing builds the studio behind this prop (EXPERIENCE.md: the integrator opens the component straight into Edit mode with a prop). The dev project's `/edit` page sets it **[live 8.3.10]**. It is read once, when the component mounts; a changed value needs the page reopened. |
| `previewStyles` | 0.3.0 | `true` draws the style preview panel over the map (epic 3 entry 1): every kind's style rule and area tints from the kind display, each case in its preset, then the point and line preset palettes and the tint palette ([styles.md](styles.md)). It is the preview the kind setup screen embeds (`StylePreview`, exported by the bundle), shown here for review; off by default. The dev page `/styles` sets it **[live 8.3.10]**. |
| `style` | 0.1.0 | Perspective's style properties. |

### What the map draws (epic 3 entry 7)

Not a message, but what a project may rely on. A point map item draws its kind's glyph in a neutral disc from zoom 14, an 11 px dot from 12 to 14 and a 7 px dot below (an item in alarm, comms lost or stale keeps its marker at every zoom), with its name under the disc from zoom 14, a chip "Stale" or "Comms lost" beside the name, and the kind setup's icon KPI under it from zoom 15; names give way to each other when they would overlap, the selected item first, then alarms by priority, comms lost, stale, then the kind list's `labelRank` ([kinds-and-assets.md](kinds-and-assets.md)). A line draws 2 px neutral with no instrument on it, else 3, 4 or 6 px by its `diameter` property (inches: up to 4, up to 8, above), takes a hue only from its own alarm (its kind setup's alarms path) with the alarm glyph and digit at its midpoint, and dashes when comms lost or stale; its name sits in a chip at the midpoint. Points within 20 m of each other draw as one marker named "A and B" whose click opens a pick list. The text is set in the bundled Noto Sans served at `/res/mapstudio/glyphs/` ([icons.md](icons.md)). The View-mode controls are as DESIGN.md draws them (entry 14): one zoom card top-right with plus, the zoom level ("z 15"), minus, Fit and Return (Return disabled with nothing selected), and a Legend button bottom-left with the scale bar and the attribution beside it, whose panel holds the basemap choice ([basemaps.md](basemaps.md)); nothing sits in the bottom-right corner, which is the Perspective App Bar toggle's. The checklist against the template's map is [map-parity.md](map-parity.md) **[live 8.3.10]**.

**Search (epic 3 entry 9, R4).** A search field sits top-left (DESIGN.md `search-field`: 300 by 40 px, the placeholder "Search sites, wells or lines"), the View-mode top bar that entry 3 shares with the Needs you summary. As the user types it lists the live map items whose name or linked asset's name holds the text, without regard to letter case or accents, ranked: a name that starts with the text first, then an asset name that does, then the names that hold it, then the asset names that do, by name within each, at most eight rows, each with the kind's glyph, the name and the kind (or "kind - asset" when the asset matched); with no match it says "No matches". Everything runs in the browser from `map.load.reply` (`items`, `kinds`, `assetNames`): no message goes to the Gateway for a search. The input is an ARIA combobox (`aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant`) over a listbox of options; the arrow keys move the active row and wrap, Home and End jump, Enter chooses the active row (the first when none is), Esc clears the text and closes the list (the map and the legend never see it), a click or a tap chooses a row. Choosing zooms to the item and selects it as a click on it does: a point is shown at zoom 15 at least (its glyph, name and icon KPI all draw from there) with its popup open and `point.click` sent, a line or an area is fitted and selected with no popup (a line's popup is entry 2's); a kept Fit ends; the text is cleared and a polite live region says "<name> selected", and the focus moves into a chosen point's popup (as MapLibre opens it) or stays in the field for a line. At phone width (below 768 px) the control is the one top bar, 8 px from the edges and as wide as the map, 48 px tall, that expands with the results inside it; the zoom card sits under it; every target is 44 px; after a choice the field gives the focus up so the keyboard goes away. For tests `.mapstudio-map` carries `data-search-open`, the control is `.mapstudio-topbar` (its row `.mapstudio-topbar-row`, the field `.mapstudio-search-field`, the input `.mapstudio-search-input`, the panel `.mapstudio-search-panel` with `data-results`, each row `.mapstudio-search-option` with `data-item-id` and `data-matched`), and the live region is `.mapstudio-search-status` **[live 8.3.10]**.

**Value styles and tints (epic 3 entry 1, AD-11).** A kind setup's style rule picks a preset from the closed list, and the map draws it ([styles.md](styles.md) has every look in both themes): on a point, `attention` a heavier neutral ring and the chip word "Attention", `warning` and `fault` a ring in their token with the word, `dimmed` the disc faded with a dashed ring and "Out of service"; on a line, the same hues and words, the `solid`, `dashed` and `dotted` patterns and the `dimmed` fade, with the weight by pipe size as above. An alarm draws over a value style (the badge and, on a line, the hue); comms lost and stale replace it (the Gateway sends `normal` while the rule's source is stale). An item of an area kind (a line kind with `area: true`) draws as a closed fill at low opacity with an outline in the tint its category picks (`areaTints`), or the neutral area look with no tint; a point or a line never takes a tint. Every hue is a token on the component root with a Perspective variable as its fallback (`--mapstudio-attention`, `--mapstudio-warning`, `--mapstudio-fault`, `--mapstudio-tint-1` to `-6`), never a colour literal; the hues stand in until entry 12's review. For tests the hidden live row carries `data-preset` and `data-style` and `.mapstudio-map` carries `data-areas` (each area's id, tint and resolved colour) **[live 8.3.10]**.

## Unsaved edits in the browser (epic 2 story 8)

A batch is never lost when the Gateway does not answer (AD-10, FR-29, FR-31). The code is `web/typescript/unsaved.ts` (the queue) and `web/typescript/unsavedSender.ts` (the reply timer, replay and Discard rules), both pure and unit tested in node with a fake store and Jest fake timers, and the store delegate in `web/typescript/MapStudio.tsx`.

- **`map.load.reply` gains `user`** (optional, additive in 0.2.0): the session user name, sent only at level `phone` and `full` (`MapStudioDelegate.withUser`); absent at level `none`, for an anonymous session and from an older Gateway **[live 8.3.10]** (the e2e editor's queue key names `mapeditor`).
- **Queue.** Key `mapstudio.unsaved.v1:<project>:<user>` in `localStorage` (`<user>` empty when `map.load.reply` names none), per project and user (owner decision, 2026-10-27), so on a shared computer one user's edits are never replayed under another's name; other users' entries stay stored and hidden. Value: a JSON array, oldest first, of `{batchId, batch, queuedAt, state: "unsent" | "refused", reason?: {code, message, changedBy?}}`; a malformed entry is dropped and the rest kept (a `delete` op with no `data` is well formed; any other op needs an object `data`). Until the first `map.load.reply` names the key, the entries of this page are held in memory and move into storage then. The project name comes from the Perspective client store (`ClientStore.projectName`) **[live 8.3.10]**.
- **Written before sent.** Every batch the component sends is written to the queue first and removed only by an `edits.apply.reply` for its `batchId` or by Discard. A replay sends the stored batch unchanged: same `batchId`, same ops and `baseVersion`s, never rebased; a resend of a committed batch gets the first reply (Retries, below) **[live 8.3.10]**. Test hook sends (`window.__mapStudioTest`) bypass the queue.
- **Classes.** Transient, kept `unsent` and replayed automatically: no reply within 15 s (`timeout`), the client not connected (`disconnected`; `ChannelStore.connected` **[unverified]** live), `store-unreachable` (busy included: the message starting "Map Studio is busy"), `read-only`. Final, kept `refused` with the reason, replayed only on Try again: `conflict`, `role`, `invalid`, `stale` and any other code.
- **Replay.** One batch at a time, oldest first, only after a `map.load.reply` at level `phone` or `full` (with no project name, from the entries this page holds in memory); again on each `map.changed`, on Try again and every 15 s while unsent entries remain. A refused entry in the middle does not stop the replay (owner decision, 2026-10-27): each batch is judged alone, and its `baseVersion`s refuse any later batch that depended on it. At level `none` entries stay with "Sign in with a Map Studio editing role to save these edits."
- **Storage failure.** Every read and write is in try/catch; when storage throws (quota, private window) the batch is still sent and the component says once "This browser cannot keep unsaved edits; an edit not saved now is lost when the page closes." From then on this tab's memory decides until a write succeeds again: the key is removed at once, so an entry stored before the failure and later saved, refused or discarded here can never come back on the next page open; storage is not re-read meanwhile, and every change and every 15 s replay tick tries the write again. Otherwise every queue change re-reads storage first, and a `storage` event from another tab refreshes the list. Two tabs may both replay one entry at the same time (nothing marks an entry in flight in storage); the second gets the first reply and removes nothing more.
- **Discard** is off while this tab waits on a reply for the entry (up to 15 s), since the Gateway may still commit it; once allowed, every message id of the batch is forgotten, so a late answer to an earlier send changes nothing.
- **Store unreachable at load.** A `map.load` answered `store-unreachable` turns editing off: the draw tool is disabled, no store item is drawn (`data-items-loaded` 0), queued items of this page stay drawn as unsaved **[live 8.3.10]**, `ops/store-checks.sh unavailable`, and for a load that fails after items were drawn, `unsaved.spec.mjs` (the reply rewritten in the test's websocket route). The busy answer ("Map Studio is busy") is the exception: the level, the store state and the items drawn stay and editing stays on. After any failed `map.load` the map sends `map.load` again every 15 s (and on the next `map.changed`) until one succeeds, which turns editing back on. A connection lost after the map loaded keeps editing on and queues (owner decision, 2026-10-27; epic-editing revisits with the save banner).
- **For tests** (dev component): `.mapstudio-map` carries `data-unsaved-count`, `data-unsaved-drawn` (features in the unsaved sources) and `data-editing` (`on`, `off`); `.mapstudio-unsaved` lists one `.mapstudio-unsaved-row` per entry with `data-batch-id`, `data-unsaved-state`, `data-code`, a Try again button (once a reason is known) and Discard (disabled while the batch is being sent). `.mapstudio-save-status` keeps its attributes and gains the state `unsent` (no answer, or not connected; `data-code` `timeout` or `disconnected`). Queued map items are drawn dashed from the sources `mapstudio-unsaved-line` and `mapstudio-unsaved-point`.

## Error codes

Stable kebab-case words; the message is plain words for the person.

| Code | When |
| --- | --- |
| `conflict` | an op's `baseVersion` is not the stored version, a create names an id that exists, or an update or delete names a deleted map item or kind setup. Every such op of the batch is listed in `conflicts` with the stored record; nothing in the batch is written |
| `role` | the session has no role that allows the op (checked on the Gateway against the session user's roles, never anything the browser sends; the role matrix below). A batch refused for role is never reported as a conflict |
| `invalid` | the message, batch or op is malformed (two ops on one id included), an update, delete or restore names a map item or kind setup that was never saved, a `batchId` was already saved by another actor, a map item does not match the project's kind list or a kind setup breaks its schema (entry 9, [kind-setup.md](kind-setup.md)), or no kind list is in use for a batch that is not only deletes |
| `stale` | reserved: the browser's map is behind (a gap in `seq`). Nothing sends it in 0.2.0; a gap makes the browser reload with `map.load` instead (below). A reader treats it as final, like any code it does not handle (owner decision, epic 2 story 12) |
| `read-only` | the map can be read but not saved here: the map store's schema is newer than this module, or this Gateway is the standby of a redundant pair (entry 5). Checked before the batch and the role, so every save is refused, a viewer's too; the message says which. Nothing is written |
| `tags-unavailable` | a `tags.browse` or `tags.resolve` tag call failed or did not answer within 5 s (entry 15, added in 0.2.0; a slow or failing tag system is unit tested only **[unverified]** live). The message is one of: "The tag system did not answer within 5 s."; "The tag system could not be asked to <what>; see the Gateway log." (`<what>` is "list the tag providers", "find a tag provider", "browse a folder" or "check that tags exist", with "(quality Bad_...)" when the tag system answered a bad quality other than `Bad_NotFound`); "Map Studio could not look up tags; see the Gateway log." (an unexpected failure). Nothing is written either way |
| `token-unavailable` | a `basemap.source` could not be answered because of the basemap token (epic 3 entry 6, added in 0.3.0): the setup names no `tokenSecret`, the name has no provider, the secret provider or the secret does not exist, the secret could not be read, it is empty, or it is not a public Mapbox token (`pk.`). The message names the secret, never its value ("basemap.source" above) |
| `store-unreachable` | the project has no setup, its setup cannot be read (the reason lists every problem, `docs/setup.md`), its setup names a connection the Gateway does not have, the map store is starting or unavailable, or the Gateway is busy: when the module's bounded work pool (4 threads, 64 waiting messages) is full, a `map.load`, `edits.apply`, `tags.browse` or `tags.resolve` is answered at once with this code and "Map Studio is busy with other map requests; nothing was saved. Try again in a moment." (no separate `busy` code in 0.2.0) |

## Batches and ops

```json
{"batchId": "<UUID>",
 "ops": [{"op": "create", "entity": "item", "id": "<UUID>", "baseVersion": 0,
          "data": {"kind": "line", "name": "Line 21:05:09",
                   "geometry": {"type": "LineString", "coordinates": [[-104.99, 39.74], [-104.98, 39.75]]}}}]}
```

- `op` is `create`, `update` or `delete`; `entity` is `item` (a map item) or `kindSetup`. A map item `id` is a UUID string made by the caller (the browser, or UUIDv5 from a stable name in a script). Letter case does not matter: the Gateway turns a map item id into lower-case canonical form, and replies, conflicts and the edit log carry that form.
- `baseVersion` is 0 on create and the stored version otherwise; a create at a deleted map item's version restores it (below). A delete carries no `data`. At most one op per id in a batch.
- A create's `data` is the record's fields except `id`, `version` and `deleted`; `kind` and `geometry` are required. An update's `data` replaces only the top-level fields it carries (owner decision, 2026-10-26), so a moved point sends only `geometry`.
- A batch is all or none: one transaction, every op's version checked, every saved op recorded. It takes the project's next change sequence number `seq`. At most 1000 ops per batch.
- Supported in 0.2.0: create, update, delete and restore of map items and (from entry 9) kind setups by a session with full editing or a script; a point's geometry and any map item's properties by a session with phone editing; retried `batchId`s; the conflicting records in a `conflict` reply. A kind setup op's `id` is the kind id and its `data` is `{"setup": {...}}` ([kind-setup.md](kind-setup.md)).
- Checks, in order: the store is ready; the batch is well formed; a `batchId` already committed replays (below); the role matrix on each op's shape; there is an actor; a kind list is in use, read once for the batch, unless every op is a delete (entry 9); then, in the transaction, the project's row is locked, the `batchId` looked up again, the map items and kind setups locked, the role matrix checked on each stored geometry, every op's version compared, each op's record checked against the kind list as it is written, and then (epic 2 story 14) the instruments on lines checked on the state the whole batch leaves (below). A refusal writes nothing and takes no `seq` **[live 8.3.10]**.

### Conflicts

A batch with stale ops is refused once, listing every one of them: the stored record (`current`, a deleted one with `deleted: true`), and the user or script actor of its last edit record with the time (`changedBy`, `changedAt`, ISO 8601 UTC to the second; null when there is no edit record). `op` names the first. The message names the map item, or the kind setup by its kind's display name from the kind list ("The Well pad kind setup"; by its kind id when the kind is not in the list; the name is shown on one line and cut after 64 characters; epic 2 story 12; the id fallback and the cut are unit tested only, `WriteServiceKindSetupTest`), or the count when there are several **[live 8.3.10]**:

```json
{"code": "conflict", "batchId": "<UUID>", "op": {"index": 0, "id": "<UUID>"},
 "message": "Pad P12 was changed by mapoperator at 14:02 UTC since you loaded it. Nothing in this save was written.",
 "conflicts": [{"index": 0, "entity": "item", "id": "<UUID>", "baseVersion": 1,
                "current": {"id": "<UUID>", "kind": "pad", "name": "Pad P12", "version": 2, "deleted": false, "...": "..."},
                "changedBy": "mapoperator", "changedAt": "2026-10-26T14:02:11Z"}]}
```

Several: "3 map items were changed by others since you loaded them. Nothing in this save was written." A create on an existing id: "<name> already exists (saved by ...), so it was not created again." A deleted one: "<name> was deleted by ... since you loaded it."

### Retries

A `batchId` is the batch's identity. Sent again after it was committed, by the same actor (the session's user name or the script's actor), it is answered with the first reply, the same `seq` and versions, and nothing is written again; the change hook is not called again. Two sends of one batch at the same time are serialised by the project's row lock, so one commits and the other replays it **[live 8.3.10]**. A batch that was refused left no record, so sending it again checks it afresh. A `batchId` committed by another actor is refused `invalid`, "This save id was already used for another change; send a new batchId." Example: the reply to both sends of

```json
{"batchId": "8d4f...", "ops": [{"op": "update", "entity": "item", "id": "<UUID>", "baseVersion": 2, "data": {"name": "P12"}}]}
```

is the same `{"batchId": "8d4f...", "seq": 41, "results": [{"entity": "item", "id": "<UUID>", "version": 3}]}`.

### Delete and restore

A delete keeps the record as a tombstone: `deleted` becomes true, the version goes up by one, the edit record says `delete`, and `map.load` and `getMap` leave it out. A `create` whose `baseVersion` is the tombstone's version restores it with the create's full `data` (as a new create: `kind` and `geometry` required), live again at the next version; its edit record says `create`. So one map item's edit records can read create v1, delete v2, create v3 **[live 8.3.10]**. An update or delete of a tombstone, a create at 0 of a tombstoned id, or a restore at another version is a `conflict`; a restore of an id never saved is `invalid`.

```json
{"batchId": "<UUID>", "ops": [{"op": "delete", "entity": "item", "id": "<UUID>", "baseVersion": 1}]}
{"batchId": "<UUID>", "ops": [{"op": "create", "entity": "item", "id": "<UUID>", "baseVersion": 2,
  "data": {"kind": "line", "name": "Line 21:05:09", "geometry": {"type": "LineString", "coordinates": [[-104.99, 39.74], [-104.98, 39.75]]}}}]}
```

### The role matrix

The level comes from the session user's roles as the Gateway sees them against the setup's `roles` lists (`full` first, then `phone`); a script runs as `full` under its actor.

| Level | May |
| --- | --- |
| `full` | create, update, delete and restore any map item |
| `phone` | `update` of a map item whose `data` carries only `properties`, or `geometry` of a map item stored as a `Point` (moved to another `Point`), or both. Anything else, a create, delete, restore, a line's geometry, `name`, `kind`, `assetId`, `overrides`, `ends` or a kind setup, is refused `role`: "Phone editing may move a point and change a map item's properties; this change needs a full editing role. Nothing in this save was written." **[live 8.3.10]** A point of an instrument kind (or one with an attachment) is the exception (owner, 2026-10-27; epic 2 story 14): moving it, or sending `attachment`, is refused `role` with "An instrument moves along its line; only full editing can move it. Nothing in this save was written."; its properties may still be changed **[live 8.3.10]** |
| `none` | nothing: `role`, "You do not have a role that lets you change the map. Ask for a Map Studio editing role." |

```json
{"batchId": "<UUID>", "ops": [{"op": "update", "entity": "item", "id": "<UUID>", "baseVersion": 3,
  "data": {"geometry": {"type": "Point", "coordinates": [-104.9745, 39.7442]}}}]}
```

saved for a phone editor; the same op with a `LineString` on a line is refused `role`. Known gap (epic-editing, AD-19): a phone move of a point that lines snap to cannot carry the line ends a phone editor may not change.

## The map item record (AD-20)

```json
{"id": "<UUID>", "kind": "line", "name": "Line 21:05:09",
 "geometry": {"type": "LineString", "coordinates": [[-104.99, 39.74], [-104.98, 39.75]]},
 "properties": {}, "assetId": null, "overrides": {}, "ends": null, "attachment": null, "version": 1, "deleted": false}
```

Closed: no other field is stored or accepted. `attachment` (added in 0.2.0 by epic 2 story 14, schema version 2) is an instrument's place on its line, `{lineId, distanceM}`, and null on every other map item (below); a reader treats a missing `attachment` (an older Gateway) as null. Geometry is GeoJSON `Point` or `LineString`, longitude first, WGS 84, rounded to 6 decimals when saved. Every saved record is checked against the project's kind list (entry 9): a known `kind`, the geometry its kind takes, `properties` keyed and typed by the kind's form fields (CSV-style text numbers stored as numbers), `overrides` a partial kind setup with full tag paths ([kind-setup.md](kind-setup.md)). Versions start at 1.

## Instruments on lines (AD-19, epic 2 story 14)

A tap, meter or line valve is a point of an **instrument kind** (`instrument: true` in the kind list, [kinds-and-assets.md](kinds-and-assets.md)) that may be attached to a line: its record's `attachment` is `{"lineId": "<the line's id>", "distanceM": 1143.0}`, the distance along the line in metres from its first vertex, measured geodesically on WGS 84 with Turf 7.4.0's formulas (haversine, earth radius 6371008.8 m), stored to 0.1 m (half up), and its `geometry` is the point at that distance, sent in the same op. The Gateway measures with the same formulas (`common/.../contract/LineMeasure.java`, test vectors shared with `web/typescript/__tests__/geometry.test.ts`); it never projects a point itself and never infers an attachment from nearness. Stored and checked only in 0.2.0: drawing, the line popup's instrument list and the instruments style are epic-viewing's, the tools epic-editing's.

Every save is checked on the state the whole batch leaves, after every op is written, so a line and its instruments created, moved or restored together pass in any op order. Each refusal is `invalid` naming the op `{index, id}`, and nothing is written **[live 8.3.10]**:

- `attachment` is exactly `{lineId, distanceM}`: `lineId` a UUID (kept in lower-case form), `distanceM` a finite number, 0 or more ("attachment.distanceM must be 0 or more (metres from the line's first vertex), not -1.").
- Only an instrument kind's map item has one; on any other kind it is refused ("attachment: kind pad is not an instrument kind, ..."). On an instrument kind it is optional: null is a free point (owner, 2026-10-27).
- The line is a live map item (in this batch or stored) whose geometry is a `LineString` and whose kind is in the kind list and not an area: "instrument PT-1 is attached to map item <id>, which does not exist.", "... to line L-SWD, which is deleted.", "... to PT-2, which is a point, not a line.", "... to Fence, an area (kind geofence); instruments go on lines that are not areas.", "... to Old line, whose kind retired is not in the kind list; instruments go on lines of a line kind that is not an area."
- `distanceM` is at most the line's length plus 1 m: "instrument PT-1 is at 2,924.0 m along line L-SWD, past its end (the line is 2,922.4 m long)."
- The point is within 1 m of the place `distanceM` gives on the line (owner, 2026-10-27): "instrument PT-1 is 5.0 m from its place on line L-SWD (1,143.0 m along it); its point must be within 1.0 m of that place."
- A batch that changes a line's geometry or deletes it carries an op with `attachment` (or a delete) for every live instrument attached to it; a rename or a property change of a line needs none (owner, 2026-10-27): "Op 0 (<id>): line L-SWD has 2 instruments (PT-1, PT-2) this save does not move or delete. Send each instrument's new place in the same save. Nothing in this save was written." (for a delete: "Delete its instruments in the same save."). The op named is the line's. A batch that changes a line's `kind`, or leaves it on a kind that is an area or not in the kind list, needs the same, ending "Its new kind geofence is not a line instruments go on; delete or detach its instruments in the same save." (detach: `"attachment": null`, a free point).
- When another editor attached an instrument to the line after this browser loaded it, the line batch leaves that instrument out and is refused with the same `invalid` (it names the instrument the browser has not seen), not `conflict`: the line's own version did not change, so there is no `current` to send. The browser treats it like any `invalid` line batch: reload the map (`map.load`), which brings the new instrument, and build the batch again.

A line batch that carries its instruments is one batch: one `seq`, all or none, each instrument's version bumped, so an instrument changed meanwhile by someone else makes the whole batch a `conflict` naming it, and story 8's queue replays it whole with its `baseVersion`s. Deleting a line deletes its instruments in the same batch, and the one reverse batch (a create at each tombstone's version, `web/typescript/undo.ts`) restores all of them (owner, 2026-10-27) **[live 8.3.10]**. The browser builds these batches with the shared geometry module `web/typescript/geometry.ts`: a reshape or vertex change places each instrument at its nearest place on the new geometry, a move carries them with the line, a split puts each on the part it lies on, measured from that part's start. A reshape of L-SWD, 2,922 m, with PT-1 and PT-2:

```json
{"batchId": "<UUID>", "ops": [
 {"op": "update", "entity": "item", "id": "<L-SWD>", "baseVersion": 2,
  "data": {"geometry": {"type": "LineString", "coordinates": [[-103.52, 31.92], [-103.505, 31.9223], [-103.490423, 31.926]]}}},
 {"op": "update", "entity": "item", "id": "<PT-1>", "baseVersion": 1,
  "data": {"geometry": {"type": "Point", "coordinates": [-103.508198, 31.92181]},
           "attachment": {"lineId": "<L-SWD>", "distanceM": 1131.9}}},
 {"op": "update", "entity": "item", "id": "<PT-2>", "baseVersion": 1,
  "data": {"geometry": {"type": "Point", "coordinates": [-103.491243, 31.925792]},
           "attachment": {"lineId": "<L-SWD>", "distanceM": 2793.8}}}]}
```

From a script, Jython 2.7: a tap created on a line saved in the same batch (the tap's point is where 1,143 m along the line falls, from the geometry module or the Gateway's `LineMeasure`):

```python
import java.lang
import uuid

logger = system.util.getLogger('MapStudio.instruments')
project = 'my-project'
line_id = str(uuid.uuid5(uuid.NAMESPACE_URL, 'my-project/lines/L-SWD'))
tap_id = str(uuid.uuid5(uuid.NAMESPACE_URL, 'my-project/taps/PT-1'))
batch = {'batchId': str(uuid.uuid4()), 'ops': [
    {'op': 'create', 'entity': 'item', 'id': line_id, 'baseVersion': 0,
     'data': {'kind': 'line', 'name': 'L-SWD', 'geometry': {'type': 'LineString',
              'coordinates': [[-103.52, 31.92], [-103.505, 31.9205], [-103.490423, 31.926]]}}},
    {'op': 'create', 'entity': 'item', 'id': tap_id, 'baseVersion': 0,
     'data': {'kind': 'tap', 'name': 'PT-1', 'geometry': {'type': 'Point', 'coordinates': [-103.507899, 31.920404]},
              'attachment': {'lineId': line_id, 'distanceM': 1143}}}]}
try:
    result = system.mapstudio.applyEdits(project, batch, 'seed-script')
    logger.info('Saved as seq %s' % result['seq'])
except java.lang.Throwable as ex:
    logger.warn('Not saved: %s' % ex.getMessage())
except Exception as ex:
    logger.warn('Not saved: %s' % ex)
```

## The project setup, schema version 1 (AD-5)

The project resource `com.aoindustrial.perspective.mapstudio/setup/` (`setup.json`). Every field, its default and rule, the messages a wrong setup gives, and how to change it on a running Gateway: `docs/setup.md`. In short: only `schemaVersion` (1) and `connection` are required; unknown fields are refused; a wrong or missing setup makes the project's map store answer `store-unreachable` with the reason; a changed setup applies at the next call after a project scan, with no restart **[live 8.3.10]**. The map is keyed by the project's own name, even when a child project inherits the setup. The kind and asset functions (`kindsFunction`, `assetsFunction`) and how often they are called (`refreshIntervalSeconds`): [kinds-and-assets.md](kinds-and-assets.md).

## The map store, schema version 2 (AD-3, AD-21)

PostgreSQL only. On start, for each connection a setup names, Map Studio waits for the connection to be usable (every 5 s, up to 2 minutes), then reads the recorded schema version with no lock and no DDL (`to_regclass`, then `max(version)`); only when a migration is pending does it apply its versioned migrations (`gateway/src/main/resources/.../store/migrations/`), each in one transaction under `pg_advisory_xact_lock(hashtext('mapstudio_migrations'))`, and records the version **[live 8.3.10]**. When the connection never becomes usable it logs one error naming the connection; when a statement fails it logs one error naming the connection, the migration, the statement (its number in the migration's transaction and its first words), the SQLState ("none" for a failure that is not a database error), the missing right for 42501, and PostgreSQL's message (entry 5, `docs/operations.md`). Either way the map store is unavailable (`store-unreachable`), with no half-created schema, and Map Studio tries again at most once a minute on the next `map.load` or `applyEdits` **[live 8.3.10]**, logging the line again only when it changes (unit tested, `StoreRegistryStateTest`; **[unverified]** live: no live run has retried with the same failure). A recorded version newer than the module makes the map store read only: one warning naming the connection and both versions, nothing migrated or changed, `map.load` as usual with `readOnly`, saves refused `read-only` **[live 8.3.10]**. Of a redundant pair only the active node migrates and saves; a standby reads the version only and refuses saves `read-only` **[unverified]**. Rights: the first start needs a role that may CREATE in the schema, and the upgrade to schema 2 (epic 2 story 14: `ALTER TABLE`) the role that owns the tables ([operations.md](operations.md)) **[live 8.3.10]**; after that a least-privilege runtime role with CONNECT, USAGE on the schema, SELECT, INSERT and UPDATE on the tables and USAGE and SELECT on the sequences is enough **[live 8.3.10]** (docs/platform-checks.md). Map Studio has no backup of its own: the site's PostgreSQL backups cover these tables.

| Table | Key | Columns |
| --- | --- | --- |
| `mapstudio_schema_version` | `version` | `applied_at timestamptz`, `module_version text` |
| `mapstudio_project` | `project` | `seq bigint`: the project's change sequence |
| `mapstudio_item` | `(project, id uuid)` | `kind`, `name`, `geometry text` (GeoJSON), `properties jsonb`, `asset_id`, `overrides jsonb`, `ends jsonb`, `version`, `deleted`, `updated_at`, `attachment jsonb` (schema 2, null but on an attached instrument); partial index `(project, (attachment->>'lineId'))` on live attached rows (schema 2) |
| `mapstudio_kind_setup` | `(project, kind_id)` | `setup jsonb`, `version`, `deleted`, `updated_at` (written from entry 9) |
| `mapstudio_edit` | `edit_id bigserial` | `project`, `batch_id uuid`, `seq`, `entity`, `entity_id`, `op`, `version` (after the op), `actor`, `source` (`session` or `script`), `at timestamptz` (UTC); indexes `(project, seq)` and (schema 2) `(project, entity, entity_id)` |
| `mapstudio_batch` | `(project, batch_id)` | `seq`, `actor`, `result jsonb`, `committed_at` (the reply a retried `batchId` gets, from entry 2) |

The edit record answers "who changed what, when": the Ignition user name of the session, or the actor a script names.

## The scripting API (AD-18)

Gateway scope: Perspective session scripts **[live 8.3.10]**, and Gateway event scripts and project library functions called from either **[unverified]** (the module registers the functions on every script manager the Gateway creates, docs/platform-checks.md check 3); the dev seed is a project library function called from a Perspective session script **[live 8.3.10]**. In the Designer the functions autocomplete with their docs (the text below, from `MapStudioScriptModule.properties`; every function, argument and result is documented there, `ScriptDocsTest`) **[unverified until an owner Designer session]**, and raise "runs in Gateway scope only" when called.

| Function | Arguments | Returns |
| --- | --- | --- |
| `system.mapstudio.getMap(project)` | the Ignition project's name; it needs a Map Studio setup | a list of the live map item records (dicts: the map item record below, with `attachment` a dict or None, epic 2 story 14 **[live 8.3.10]**); deleted ones (tombstones) are left out. The list has two attributes: `readOnly` is None, or the reason the map cannot be saved here (entry 5) **[live 8.3.10]**; `kindSetups` is the list of live kind setup records `{kindId, setup, version, deleted}` (entry 9) **[live 8.3.10]** |
| `system.mapstudio.applyEdits(project, batch, actor)` | the project; one batch `{batchId, ops}` ([Batches and ops](#batches-and-ops)); the actor, who makes the change | `{batchId, seq, results: [{entity, id, version}]}`: `seq` is the project's change number the batch took, one result per op with its new version **[live 8.3.10]** |
| `system.mapstudio.refreshAdapters(project)` | the project | `{kinds: status, assets: status}` after calling the project's kind and asset functions now; waits for both to answer or time out, at most 21 s ([kinds-and-assets.md](kinds-and-assets.md)) **[live 8.3.10]** |
| `system.mapstudio.ping()` | none | a short text with the Gateway time (a health check) |

**Ops.** Everything in [Batches and ops](#batches-and-ops) holds for a script: `create`, `update` and `delete` of an `item` or a `kindSetup` (its `id` the kind id, its `data` `{"setup": {...}}`), restore as a `create` at a deleted map item's version, an update's `data` replacing only the top-level fields it carries, an instrument's `attachment` `{lineId, distanceM}`, every record checked against the project's kind list, at most 1000 ops and one op per id, all or none.

**Actor and trust.** `actor` is required: blank or None is refused `invalid`, "applyEdits needs an actor: who makes the change, for example "seed-script"." **[live 8.3.10]**. It is recorded in the edit record as a script actor, and a `batchId` sent again by the same actor after it was saved is answered with the first reply ([Retries](#retries)). `applyEdits` trusts its caller, like `system.db` (owner decision, 2026-10-26): it saves with full editing under the actor it names. A Perspective session script runs on the Gateway, so a view author can expose saving to someone without an editing role; keep such scripts behind your own role checks. The dev project's `/edit` page does: its "Run script checks" and "Seed the dev map" buttons read the session user's roles (`session.props.auth.user.roles`, set by the Gateway at sign-in) and write nothing unless the user holds `MapEditor` **[live 8.3.10]**.

**Errors.** A refusal raises a Java exception (`MapStudioException`; catch `java.lang.Throwable`), and nothing is written. Its message starts with the code: `conflict: ...`, `role: ...`, `invalid: ...`, `read-only: ...` or `store-unreachable: ...` ([Error codes](#error-codes)); a missing project name is `invalid`, a project without a setup `store-unreachable` **[live 8.3.10]**. A `conflict`'s exception also answers `conflicts()`: the same list as the `conflicts` of the error body ([Conflicts](#conflicts)), `[{index, entity, id, baseVersion, current, changedBy, changedAt}]` with `current.deleted` true for a deleted map item, returned as Gson's `JsonArray`. In a Gateway script Ignition hands it to Jython through its JSON adapters, so it iterates as dict-like elements: read `c['index']`, `c['current']['deleted']`, `c['current']['version']` **[live 8.3.10]** (the dev seed does, below; Gson's own methods such as `getAsJsonObject()` raise AttributeError there). Only outside the Gateway, in plain Jython with the raw `JsonArray` (as in `DevSeedTest`), walk it with Gson's methods (`get(i).getAsJsonObject()`). Other refusals answer None.

**Ids and re-runs.** A map item id is a UUID the script makes. Make it a UUIDv5 of a stable name (`uuid.uuid5(uuid.NAMESPACE_URL, '<project>/<your key>')`), so a re-run names the same map items. A re-run must not send `create` at 0 again: an id already stored is refused `conflict` ("<name> already exists ..."), not saved twice. Read the stored records with `getMap` first and, per id: absent, `create` at 0; present and as wanted, nothing; present and different, `update` at its stored `version`. A deleted map item is not in `getMap`, so its `create` at 0 is refused `conflict` too; that conflict's `current` is the tombstone, and a `create` at `current.version` restores it ([Delete and restore](#delete-and-restore)).

Jython 2.7, catching both kinds of exception:

```python
import java.lang
import uuid

logger = system.util.getLogger('MapStudio.example')
project = 'my-project'
pad_id = str(uuid.uuid5(uuid.NAMESPACE_URL, 'my-project/pads/P12'))
data = {'kind': 'pad', 'name': 'P12', 'properties': {'status': 'producing'},
        'geometry': {'type': 'Point', 'coordinates': [-104.9650, 39.7360]}}

stored = None
for item in system.mapstudio.getMap(project):
    if item['id'] == pad_id:
        stored = item
if stored is None:
    op = {'op': 'create', 'entity': 'item', 'id': pad_id, 'baseVersion': 0, 'data': data}
else:
    op = {'op': 'update', 'entity': 'item', 'id': pad_id, 'baseVersion': stored['version'], 'data': data}
try:
    result = system.mapstudio.applyEdits(project, {'batchId': str(uuid.uuid4()), 'ops': [op]}, 'pad-import')
    logger.info('Saved as seq %s' % result['seq'])
except java.lang.Throwable as ex:
    found = ex.conflicts() if hasattr(ex, 'conflicts') else None
    conflicts = list(found) if found is not None else []
    deleted = [c for c in conflicts if c['current'] is not None and c['current']['deleted']]
    if deleted:
        logger.info('P12 was deleted; send create at version %s to restore it' % deleted[0]['current']['version'])
    else:
        logger.warn('Not saved: %s' % ex.getMessage())
except Exception as ex:
    logger.warn('Not saved: %s' % ex)
```

### The dev seed (epic 2 story 11)

The dev project's `mapstudio_seed` library (`ops/project/ignition/script-python/mapstudio_seed/code.py`) seeds `mapstudio-dev` through this API and is the worked example of the rules above. Its "Seed the dev map" button on `/edit` (MapEditor only) runs `mapstudio_seed.run()`, and the e2e suite presses it before the specs that draw or click map items. It writes 66 map items under the actor `seed-script`: the 30-pad scale set (`Pad 1` to `Pad 30`, kind `pad`, `status: producing`, and `Line to Pad 1` to `Line to Pad 30`, kind `line`; the coordinates of the spike's seeded stand-in, frozen as 6-decimal literals), the tracer's set (`Point 1` to `Point 3` and `Tracer line`) and the shared pair (`Shared A` and `Shared B`, two pads 15 m apart, which the map draws as one shared marker; epic 3 entry 7). Ids are UUIDv5 of `mapstudio-dev/seed/<set>/<key>` (`scale/pad-7`, `tracer/p1`). One batch per run, all or none: a re-run sends nothing when every item is as seeded **[live 8.3.10]**, puts an edited one back with an `update` at its stored version (on the four fields it compares and sends: kind, name, geometry and properties; an `assetId`, `overrides`, `ends` or `attachment` an editor added stays, since an update replaces only the fields it carries), and restores a deleted one with a second batch whose `create` is at the version the first batch's conflict reported **[live 8.3.10]**. Any other conflict is reported, not retried. It returns `{created, updated, restored, unchanged, seq, ids, scale: {pads, lines}}` (`scale` counts the live map items whose ids are the scale set's seed ids, by kind, read back with `getMap`), or with `error` when nothing was written. It adds no instruments.

## Change hook (Gateway, for contributors)

Every committed batch calls `ChangeHook.onCommitted(CommittedBatch)` once, after the commit: `{project, seq, batchId, actor, ops: [{op, entity, id, record}]}` with the full stored record of each op. The module's hook is the change bus (`gateway/.../change/ChangeBus.java`): it builds the `map.changed` body on the caller's thread and delivers it from its own thread, in `seq` order, to the open Map Studio delegates of the project, each subscribed from its `onStartup` to its `onShutdown`. `CommittedOp.record` is a `StoredRecord` (entry 9): a `MapItemRecord` or a `KindSetupRecord`, whose `toJson()` `ChangeEvent.of` writes.
