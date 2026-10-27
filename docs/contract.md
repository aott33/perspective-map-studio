# Map Studio contract, version 0.2.0 (draft)

The public contract between the browser, the Gateway, the host project and the map store, as epic-map-store-and-data builds it (AD-8, AD-9). **Draft:** everything here is version 0.2.0 in draft until release 0.2.0; it may still change, and each change is recorded in the plan of the entry that makes it. The code is the reference: `common/src/main/java/com/aoindustrial/perspective/mapstudio/common/Messages.java` and `common/.../common/contract/`, mirrored in `web/typescript/contract.ts` and `web/typescript/messages.ts`.

Labels: **[live 8.3.10]** seen on the `ops/` dev Gateway by this repository's e2e suite (`e2e/tests/store.spec.mjs`, and from entry 2 `e2e/tests/writepath.spec.mjs`, from entry 4 `e2e/tests/changes.spec.mjs`); **[unverified]** written but not seen working.

## Messages

Every message, both ways, is one JSON object `{v, type, id, body}` carried under the model event `mapstudio.message`; `v` is 1. A type not listed here is not sent.

| Type | Direction | Body |
| --- | --- | --- |
| `map.load` | browser to Gateway | `{}` |
| `map.load.reply` | Gateway to browser | `{level, seq, items, kinds, assets, adapters, readOnly, setup?}`: `level` is `none`, `phone` or `full` for this session; `seq` is the project's last change sequence number; `items` are map item records, deleted ones left out (at level `none` each with `overrides` `{}`: overrides hold full tag paths, which viewers do not get, epic 2 entry 9, unit tested `MapLoaderTest`); `kinds` the project's kind list; `assets` its asset list, sent only at level `phone` or `full`; `adapters` `{kinds: status, assets: status}`, at level `none` with viewer messages (no host error text, no row reasons) ([kinds-and-assets.md](kinds-and-assets.md)) **[live 8.3.10]**; `readOnly` is null, or the reason in plain words when the map can be read but not saved on this Gateway (a newer schema **[live 8.3.10]**, or a standby **[unverified]**; entry 5); `kindSetups` (added by epic 2 entry 9) the live kind setup records `{kindId, setup, version, deleted}`, sent only at level `phone` or `full` ([kind-setup.md](kind-setup.md)) **[live 8.3.10]**; `setup` (optional, added by epic 2 entry 6) is `{refreshIntervalSeconds, basemaps, alarmPage}` from the project setup (`docs/setup.md`), and a reader treats a missing or malformed `setup` as absent **[live 8.3.10]** |
| `edits.apply` | browser to Gateway | `{batchId, ops}` (below) |
| `edits.apply.reply` | Gateway to browser | `{batchId, seq, results: [{entity, id, version}]}`: the batch's change sequence number and each op's new version **[live 8.3.10]** |
| `map.changed` | Gateway to browser | `{seq, batchId, actor, ops}`: one committed batch, sent to every open map of the project (below) **[live 8.3.10]** |
| `error` | Gateway to browser | `{code, message}`, plus `batchId` and `op: {index, id}` when an `edits.apply` op is at fault, and `conflicts` on a `conflict` (below) |
| `tags.browse` | browser to Gateway | `{provider?, folder?}` (entry 15, below) |
| `tags.browse.reply` | Gateway to browser | `{provider, folder, providers: [{name, isDefault}], children: [{name, path, type, dataType, hasChildren}], truncated}` **[live 8.3.10]** |
| `tags.resolve` | browser to Gateway | `{kindId, assetId, path}` (entry 15, below) |
| `tags.resolve.reply` | Gateway to browser | `{path, relative, n?, m?}` **[live 8.3.10]** |
| `point.click`, `point.click.reply` | both | the spike's round trip, unchanged |

The `id` of a reply is the `id` of the message it answers.

## map.changed: saved edits reach every open map

After every committed batch, from a browser or from `system.mapstudio.applyEdits`, the Gateway sends one `map.changed` to every open Map Studio component of that project, whatever its level, the saving session included: a `full` editor and a `none` viewer of one project **[live 8.3.10]**; `phone` maps, and another project's maps getting nothing, are unit tested only (`ChangeBusTest`, `MapStudioDelegateTest`) **[unverified live]**. Its `id` is a new UUID (it answers nothing).

```json
{"v": 1, "type": "map.changed", "id": "<UUID>",
 "body": {"seq": 5, "batchId": "<UUID>", "actor": "mapeditor",
          "ops": [{"op": "create", "entity": "item", "id": "<UUID>", "version": 1,
                   "record": {"id": "<UUID>", "kind": "line", "name": "Line 21:05:09",
                              "geometry": {"type": "LineString", "coordinates": [[-104.99, 39.74], [-104.98, 39.75]]},
                              "properties": {}, "assetId": null, "overrides": {}, "ends": null,
                              "version": 1, "deleted": false}}]}}
```

- `seq` is the batch's change sequence number; `batchId` and `actor` are the saved batch's (the session's user name, or the actor a script named). A map at level `none` gets `actor` as `""`: an anonymous viewer never learns the editors' user names (`map.load` never names them either). `phone` and `full` maps get the name. The level is read when the change is sent (unit tested, `MapStudioDelegateTest`) **[unverified live]**.
- Each op carries `version` (after the op) and `record`, the full stored record after the op: a map item record for `entity` `item` (a tombstone has `deleted: true`), a kind setup record `{kindId, setup, version, deleted}` for `kindSetup` (entry 9); a map at level `none` gets that record without `setup`, and each map item record with `overrides` `{}` (both hold tag paths; unit tested, `MapStudioDelegateTest`, **[unverified live]**). Full records, because an update carries only the fields it changes. Every op carries both: the Gateway refuses to send a batch with an op that has no record (it logs the hook failure at error) rather than send a body every browser would read as unreadable; the skipped `seq` then reaches browsers as a gap.
- **Order.** The Gateway sends a project's changes in `seq` order: a batch whose hook runs before an earlier batch's is held up to 2 s for it; a `seq` that never arrives is skipped after 2 s. The first event of a project after a Gateway start sets the expected `seq`, so an out-of-order pair among the very first batches after a start is not held: open browsers reload once on that gap. Delivery never runs inside the write transaction and never delays the saver's reply.
- **Browser rule.** Before its `map.load.reply` the browser holds `map.changed`, then applies the held ones above the loaded `seq` in order. On a loaded map: `seq` at or below the current one is ignored; `seq` one above is applied, each record only when its `version` is above the drawn one (so a repeated or self-sent change does nothing); a `seq` further ahead, or an unreadable `map.changed` (no `seq` or `ops`, or a bad record), is a gap: the browser sends `map.load` once, replaces its items with the reply and keeps holding changes until then. `seq` advances only through `map.load.reply` and `map.changed`, never through `edits.apply.reply`.
- A `map.load` answered with an error (the busy `store-unreachable` reply among them) leaves the map not loaded and holding changes; the next `map.changed` sends one new `map.load`, so a refused reload never leaves the map stale until the page is reloaded.
- A browser that was disconnected catches up at its next gap or its next page open; reloading on a Perspective reconnect is epic-viewing's (AD-6).
- The dev component shows the state for tests as `data-store-seq` (the last `seq` applied) and `data-map-reloads` (gap reloads) on `.mapstudio-map`.

## tags.browse and tags.resolve: the tag browser's lookups

Added in 0.2.0 draft by entry 15 for epic-editing's tag browser (Map Studio's own tree with a provider dropdown). Both answer a **full editor** only: the level comes from the session user's roles on the Gateway, and anything but `full` (a phone editor, a viewer) is refused `role` ("Browsing tags needs a full editing role. Ask for a Map Studio editing role.") before the body is read, so a viewer learns nothing about tags **[live 8.3.10]**. Checks, in order: the project's setup (`store-unreachable`), the level (`role`), the body and the names (`invalid`), for `tags.resolve` the map store (`store-unreachable`; a read-only store still answers) and the level again on the setup the map items are read under (`role`), then the tag calls (`tags-unavailable`). Both read tag structure only (browse), never a value: no tag is read, subscribed, written or edited (AD-1). Each runs on the module's work pool (a full pool gets the busy `store-unreachable` reply) and every tag call answers within 5 s or the reply is `tags-unavailable`. How Ignition answered each call: [platform-checks.md](platform-checks.md), epic 2 story 15.

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

## Error codes

Stable kebab-case words; the message is plain words for the person.

| Code | When |
| --- | --- |
| `conflict` | an op's `baseVersion` is not the stored version, a create names an id that exists, or an update or delete names a deleted map item or kind setup. Every such op of the batch is listed in `conflicts` with the stored record; nothing in the batch is written |
| `role` | the session has no role that allows the op (checked on the Gateway against the session user's roles, never anything the browser sends; the role matrix below). A batch refused for role is never reported as a conflict |
| `invalid` | the message, batch or op is malformed (two ops on one id included), an update, delete or restore names a map item or kind setup that was never saved, a `batchId` was already saved by another actor, a map item does not match the project's kind list or a kind setup breaks its schema (entry 9, [kind-setup.md](kind-setup.md)), or no kind list is in use for a batch that is not only deletes |
| `stale` | the browser's map is behind (a gap in `seq`); used from entry 4 |
| `read-only` | the map can be read but not saved here: the map store's schema is newer than this module, or this Gateway is the standby of a redundant pair (entry 5). Checked before the batch and the role, so every save is refused, a viewer's too; the message says which. Nothing is written |
| `tags-unavailable` | a `tags.browse` or `tags.resolve` tag call failed or did not answer within 5 s (entry 15, draft addition; a slow or failing tag system is unit tested only **[unverified]** live). The message is one of: "The tag system did not answer within 5 s."; "The tag system could not be asked to <what>; see the Gateway log." (`<what>` is "list the tag providers", "find a tag provider", "browse a folder" or "check that tags exist", with "(quality Bad_...)" when the tag system answered a bad quality other than `Bad_NotFound`); "Map Studio could not look up tags; see the Gateway log." (an unexpected failure). Nothing is written either way |
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
- Supported in 0.2.0 draft: create, update, delete and restore of map items and (from entry 9) kind setups by a session with full editing or a script; a point's geometry and any map item's properties by a session with phone editing; retried `batchId`s; the conflicting records in a `conflict` reply. A kind setup op's `id` is the kind id and its `data` is `{"setup": {...}}` ([kind-setup.md](kind-setup.md)).
- Checks, in order: the store is ready; the batch is well formed; a `batchId` already committed replays (below); the role matrix on each op's shape; there is an actor; a kind list is in use, read once for the batch, unless every op is a delete (entry 9); then, in the transaction, the project's row is locked, the `batchId` looked up again, the map items and kind setups locked, the role matrix checked on each stored geometry, every op's version compared, and each op's record checked against the kind list as it is written. A refusal writes nothing and takes no `seq` **[live 8.3.10]**.

### Conflicts

A batch with stale ops is refused once, listing every one of them: the stored record (`current`, a deleted one with `deleted: true`), and the user or script actor of its last edit record with the time (`changedBy`, `changedAt`, ISO 8601 UTC to the second; null when there is no edit record). `op` names the first. The message names the map item ("The pad kind setup" for a kind setup), or the count when there are several **[live 8.3.10]**:

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
| `phone` | `update` of a map item whose `data` carries only `properties`, or `geometry` of a map item stored as a `Point` (moved to another `Point`), or both. Anything else, a create, delete, restore, a line's geometry, `name`, `kind`, `assetId`, `overrides`, `ends` or a kind setup, is refused `role`: "Phone editing may move a point and change a map item's properties; this change needs a full editing role. Nothing in this save was written." **[live 8.3.10]** |
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
 "properties": {}, "assetId": null, "overrides": {}, "ends": null, "version": 1, "deleted": false}
```

Closed: no other field is stored or accepted. Geometry is GeoJSON `Point` or `LineString`, longitude first, WGS 84, rounded to 6 decimals when saved. Every saved record is checked against the project's kind list (entry 9): a known `kind`, the geometry its kind takes, `properties` keyed and typed by the kind's form fields (CSV-style text numbers stored as numbers), `overrides` a partial kind setup with full tag paths ([kind-setup.md](kind-setup.md)). Versions start at 1.

## The project setup, schema version 1 (AD-5)

The project resource `com.aoindustrial.perspective.mapstudio/setup/` (`setup.json`). Every field, its default and rule, the messages a wrong setup gives, and how to change it on a running Gateway: `docs/setup.md`. In short: only `schemaVersion` (1) and `connection` are required; unknown fields are refused; a wrong or missing setup makes the project's map store answer `store-unreachable` with the reason; a changed setup applies at the next call after a project scan, with no restart **[live 8.3.10]**. The map is keyed by the project's own name, even when a child project inherits the setup. The kind and asset functions (`kindsFunction`, `assetsFunction`) and how often they are called (`refreshIntervalSeconds`): [kinds-and-assets.md](kinds-and-assets.md).

## The map store, schema version 1 (AD-3, AD-21)

PostgreSQL only. On start, for each connection a setup names, Map Studio waits for the connection to be usable (every 5 s, up to 2 minutes), then reads the recorded schema version with no lock and no DDL (`to_regclass`, then `max(version)`); only when a migration is pending does it apply its versioned migrations (`gateway/src/main/resources/.../store/migrations/`), each in one transaction under `pg_advisory_xact_lock(hashtext('mapstudio_migrations'))`, and records the version **[live 8.3.10]**. When the connection never becomes usable it logs one error naming the connection; when a statement fails it logs one error naming the connection, the migration, the statement (its number in the migration's transaction and its first words), the SQLState ("none" for a failure that is not a database error), the missing right for 42501, and PostgreSQL's message (entry 5, `docs/operations.md`). Either way the map store is unavailable (`store-unreachable`), with no half-created schema, and Map Studio tries again at most once a minute on the next `map.load` or `applyEdits` **[live 8.3.10]**, logging the line again only when it changes (unit tested, `StoreRegistryStateTest`; **[unverified]** live: no live run has retried with the same failure). A recorded version newer than the module makes the map store read only: one warning naming the connection and both versions, nothing migrated or changed, `map.load` as usual with `readOnly`, saves refused `read-only` **[live 8.3.10]**. Of a redundant pair only the active node migrates and saves; a standby reads the version only and refuses saves `read-only` **[unverified]**. Rights: the first start needs a role that may CREATE in the schema; after that a least-privilege runtime role with CONNECT, USAGE on the schema, SELECT, INSERT and UPDATE on the tables and USAGE and SELECT on the sequences is enough **[live 8.3.10]** (docs/platform-checks.md). Map Studio has no backup of its own: the site's PostgreSQL backups cover these tables.

| Table | Key | Columns |
| --- | --- | --- |
| `mapstudio_schema_version` | `version` | `applied_at timestamptz`, `module_version text` |
| `mapstudio_project` | `project` | `seq bigint`: the project's change sequence |
| `mapstudio_item` | `(project, id uuid)` | `kind`, `name`, `geometry text` (GeoJSON), `properties jsonb`, `asset_id`, `overrides jsonb`, `ends jsonb`, `version`, `deleted`, `updated_at` |
| `mapstudio_kind_setup` | `(project, kind_id)` | `setup jsonb`, `version`, `deleted`, `updated_at` (written from entry 9) |
| `mapstudio_edit` | `edit_id bigserial` | `project`, `batch_id uuid`, `seq`, `entity`, `entity_id`, `op`, `version` (after the op), `actor`, `source` (`session` or `script`), `at timestamptz` (UTC); index `(project, seq)` |
| `mapstudio_batch` | `(project, batch_id)` | `seq`, `actor`, `result jsonb`, `committed_at` (the reply a retried `batchId` gets, from entry 2) |

The edit record answers "who changed what, when": the Ignition user name of the session, or the actor a script names.

## The scripting API (AD-18)

Gateway scope: Perspective session scripts **[live 8.3.10]**, and Gateway event scripts and project library functions called from either **[unverified]** (the module registers the functions on every script manager the Gateway creates, docs/platform-checks.md check 3). In the Designer the functions autocomplete with their docs and raise "runs in Gateway scope only" when called.

| Function | Returns |
| --- | --- |
| `system.mapstudio.getMap(project)` | a list of map item records (dicts), deleted ones left out; the list's attribute `readOnly` is None, or the reason the map cannot be saved here (entry 5) **[live 8.3.10]**; its attribute `kindSetups` is the list of live kind setup records (entry 9) **[live 8.3.10]** |
| `system.mapstudio.applyEdits(project, batch, actor)` | `{batchId, seq, results}`; `actor` is required and recorded in the edit record |
| `system.mapstudio.refreshAdapters(project)` | `{kinds: status, assets: status}` after calling the project's kind and asset functions now; waits for both to answer or time out, at most 21 s ([kinds-and-assets.md](kinds-and-assets.md)) **[live 8.3.10]** |
| `system.mapstudio.ping()` | a short text with the Gateway time (a health check) |

`applyEdits` trusts its caller, like `system.db` (owner decision, 2026-10-26): it saves with full editing under the actor it names. A Perspective session script runs on the Gateway, so a view author can expose saving to someone without an editing role; keep such scripts behind your own role checks. The dev project's `/edit` page does: its "Run script checks" button reads the session user's roles (`session.props.auth.user.roles`, set by the Gateway at sign-in) and writes nothing unless the user holds `MapEditor` **[live 8.3.10]**. A refusal raises a Java exception whose message starts with the code (`role: ...`, `conflict: ...`, `read-only: ...`), and nothing is written. Jython 2.7, catching both kinds of exception:

```python
import java.lang
import uuid

logger = system.util.getLogger('MapStudio.seed')
pad_id = str(uuid.uuid5(uuid.NAMESPACE_URL, 'my-project/pads/P12'))
batch = {'batchId': str(uuid.uuid4()), 'ops': [
    {'op': 'create', 'entity': 'item', 'id': pad_id, 'baseVersion': 0,
     'data': {'kind': 'pad', 'name': 'P12', 'geometry': {'type': 'Point', 'coordinates': [-104.9650, 39.7360]}}}]}
try:
    result = system.mapstudio.applyEdits('my-project', batch, 'seed-script')
    logger.info('Saved as seq %s' % result['seq'])
except java.lang.Throwable as ex:
    logger.warn('Not saved: %s' % ex.getMessage())
except Exception as ex:
    logger.warn('Not saved: %s' % ex)
```

A re-run of this script finds `pad_id` already stored and is refused with `conflict`; to update instead, read the stored version with `getMap` and send an `update` with it as `baseVersion`.

## Change hook (Gateway, for contributors)

Every committed batch calls `ChangeHook.onCommitted(CommittedBatch)` once, after the commit: `{project, seq, batchId, actor, ops: [{op, entity, id, record}]}` with the full stored record of each op. The module's hook is the change bus (`gateway/.../change/ChangeBus.java`): it builds the `map.changed` body on the caller's thread and delivers it from its own thread, in `seq` order, to the open Map Studio delegates of the project, each subscribed from its `onStartup` to its `onShutdown`. `CommittedOp.record` is a `StoredRecord` (entry 9): a `MapItemRecord` or a `KindSetupRecord`, whose `toJson()` `ChangeEvent.of` writes.
