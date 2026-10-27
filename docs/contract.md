# Map Studio contract, version 0.2.0 (draft)

The public contract between the browser, the Gateway, the host project and the map store, as epic-map-store-and-data builds it (AD-8, AD-9). **Draft:** everything here is version 0.2.0 in draft until release 0.2.0; it may still change, and each change is recorded in the plan of the entry that makes it. The code is the reference: `common/src/main/java/com/aoindustrial/perspective/mapstudio/common/Messages.java` and `common/.../common/contract/`, mirrored in `web/typescript/contract.ts` and `web/typescript/messages.ts`.

Labels: **[live 8.3.10]** seen on the `ops/` dev Gateway by this repository's e2e suite (`e2e/tests/store.spec.mjs`); **[unverified]** written but not seen working.

## Messages

Every message, both ways, is one JSON object `{v, type, id, body}` carried under the model event `mapstudio.message`; `v` is 1. A type not listed here is not sent.

| Type | Direction | Body |
| --- | --- | --- |
| `map.load` | browser to Gateway | `{}` |
| `map.load.reply` | Gateway to browser | `{level, seq, items, setup?}`: `level` is `none`, `phone` or `full` for this session; `seq` is the project's last change sequence number; `items` are map item records, deleted ones left out; `setup` (optional, added by epic 2 entry 6) is `{refreshIntervalSeconds, basemaps, alarmPage}` from the project setup (`docs/setup.md`), and a reader treats a missing or malformed `setup` as absent **[live 8.3.10]** |
| `edits.apply` | browser to Gateway | `{batchId, ops}` (below) |
| `edits.apply.reply` | Gateway to browser | `{batchId, seq, results: [{entity, id, version}]}`: the batch's change sequence number and each op's new version **[live 8.3.10]** |
| `map.changed` | Gateway to browser | `{seq, ops}`: declared; sent to every open map of the project from entry 4 **[unverified]** |
| `error` | Gateway to browser | `{code, message}`, plus `batchId` and `op: {index, id}` when an `edits.apply` op is at fault |
| `point.click`, `point.click.reply` | both | the spike's round trip, unchanged |

The `id` of a reply is the `id` of the message it answers.

## Error codes

Stable kebab-case words; the message is plain words for the person.

| Code | When |
| --- | --- |
| `conflict` | an op's `baseVersion` is not the stored version, or a create names an id that exists. Nothing in the batch is written |
| `role` | the session has no role that allows the op (checked on the Gateway against the session user's roles, never anything the browser sends) |
| `invalid` | the message, batch or op is malformed, an update names a map item that does not exist, a `batchId` was already saved, or the op is not supported in this version (deletes and any `kindSetup` op, until entries 2 and 3) |
| `stale` | the browser's map is behind (a gap in `seq`); used from entry 4 |
| `store-unreachable` | the project has no setup, its setup cannot be read (the reason lists every problem, `docs/setup.md`), its setup names a connection the Gateway does not have, the map store is starting or unavailable, or the Gateway is busy: when the module's bounded work pool (4 threads, 64 waiting messages) is full, a `map.load` or `edits.apply` is answered at once with this code and "Map Studio is busy with other map requests; nothing was saved. Try again in a moment." (no separate `busy` code in 0.2.0) |

## Batches and ops

```json
{"batchId": "<UUID>",
 "ops": [{"op": "create", "entity": "item", "id": "<UUID>", "baseVersion": 0,
          "data": {"kind": "line", "name": "Line 21:05:09",
                   "geometry": {"type": "LineString", "coordinates": [[-104.99, 39.74], [-104.98, 39.75]]}}}]}
```

- `op` is `create`, `update` or `delete`; `entity` is `item` (a map item) or `kindSetup`. A map item `id` is a UUID string made by the caller (the browser, or UUIDv5 from a stable name in a script).
- `baseVersion` is 0 on create and the stored version otherwise.
- A create's `data` is the record's fields except `id`, `version` and `deleted`; `kind` and `geometry` are required. An update's `data` replaces only the top-level fields it carries (owner decision, 2026-10-26), so a moved point sends only `geometry`.
- A batch is all or none: one transaction, every op's version checked, every saved op recorded. It takes the project's next change sequence number `seq`. At most 1000 ops per batch.
- Supported in 0.2.0 draft as of entry 1: create and update of map items by a session with full editing, or a script. Deletes, kind setups, retried `batchId`s, the conflicting record in a `conflict` reply and the phone editing role follow in entries 2 and 3.

## The map item record (AD-20)

```json
{"id": "<UUID>", "kind": "line", "name": "Line 21:05:09",
 "geometry": {"type": "LineString", "coordinates": [[-104.99, 39.74], [-104.98, 39.75]]},
 "properties": {}, "assetId": null, "overrides": {}, "ends": null, "version": 1, "deleted": false}
```

Closed: no other field is stored or accepted. Geometry is GeoJSON `Point` or `LineString`, longitude first, WGS 84, rounded to 6 decimals when saved. `kind` is any non-empty string until entry 9 checks it against the project's kind list. Versions start at 1.

## The project setup, schema version 1 (AD-5)

The project resource `com.aoindustrial.perspective.mapstudio/setup/` (`setup.json`). Every field, its default and rule, the messages a wrong setup gives, and how to change it on a running Gateway: `docs/setup.md`. In short: only `schemaVersion` (1) and `connection` are required; unknown fields are refused; a wrong or missing setup makes the project's map store answer `store-unreachable` with the reason; a changed setup applies at the next call after a project scan, with no restart **[live 8.3.10]**. The map is keyed by the project's own name, even when a child project inherits the setup.

## The map store, schema version 1 (AD-3, AD-21)

PostgreSQL only. On start, for each connection a setup names, Map Studio waits for the connection to be usable (every 5 s, up to 2 minutes), then reads the recorded schema version with no lock and no DDL (`to_regclass`, then `max(version)`); only when a migration is pending does it apply its versioned migrations (`gateway/src/main/resources/.../store/migrations/`), each in one transaction under `pg_advisory_xact_lock(hashtext('mapstudio_migrations'))`, and records the version **[live 8.3.10]**. When the connection never becomes usable it logs one error naming the connection; when a statement fails it logs one error naming the connection, the statement and the SQLState. Either way the map store is unavailable (`store-unreachable`), with no half-created schema. Rights: the first start needs a role that may CREATE in the schema; after that a least-privilege runtime role with CONNECT, USAGE on the schema, SELECT, INSERT and UPDATE on the tables and USAGE and SELECT on the sequences is enough **[live 8.3.10]** (docs/platform-checks.md). Map Studio has no backup of its own: the site's PostgreSQL backups cover these tables.

| Table | Key | Columns |
| --- | --- | --- |
| `mapstudio_schema_version` | `version` | `applied_at timestamptz`, `module_version text` |
| `mapstudio_project` | `project` | `seq bigint`: the project's change sequence |
| `mapstudio_item` | `(project, id uuid)` | `kind`, `name`, `geometry text` (GeoJSON), `properties jsonb`, `asset_id`, `overrides jsonb`, `ends jsonb`, `version`, `deleted`, `updated_at` |
| `mapstudio_kind_setup` | `(project, kind_id)` | `setup jsonb`, `version`, `deleted`, `updated_at` (written from entry 3) |
| `mapstudio_edit` | `edit_id bigserial` | `project`, `batch_id uuid`, `seq`, `entity`, `entity_id`, `op`, `version` (after the op), `actor`, `source` (`session` or `script`), `at timestamptz` (UTC); index `(project, seq)` |
| `mapstudio_batch` | `(project, batch_id)` | `seq`, `actor`, `result jsonb`, `committed_at` (read by entry 2 for retries) |

The edit record answers "who changed what, when": the Ignition user name of the session, or the actor a script names.

## The scripting API (AD-18)

Gateway scope: Perspective session scripts **[live 8.3.10]**, and Gateway event scripts and project library functions called from either **[unverified]** (the module registers the functions on every script manager the Gateway creates, docs/platform-checks.md check 3). In the Designer the functions autocomplete with their docs and raise "runs in Gateway scope only" when called.

| Function | Returns |
| --- | --- |
| `system.mapstudio.getMap(project)` | a list of map item records (dicts), deleted ones left out |
| `system.mapstudio.applyEdits(project, batch, actor)` | `{batchId, seq, results}`; `actor` is required and recorded in the edit record |
| `system.mapstudio.ping()` | a short text with the Gateway time (a health check) |

`applyEdits` trusts its caller, like `system.db` (owner decision, 2026-10-26): it saves with full editing under the actor it names. A Perspective session script runs on the Gateway, so a view author can expose saving to someone without an editing role; keep such scripts behind your own role checks. The dev project's `/edit` page does: its "Run script checks" button reads the session user's roles (`session.props.auth.user.roles`, set by the Gateway at sign-in) and writes nothing unless the user holds `MapEditor` **[live 8.3.10]**. A refusal raises a Java exception whose message starts with the code (`role: ...`, `conflict: ...`), and nothing is written. Jython 2.7, catching both kinds of exception:

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

Every committed batch calls `ChangeHook.onCommitted(CommittedBatch)` once, after the commit: `{project, seq, batchId, actor, ops: [{op, entity, id, record}]}` with the full stored record of each op. In 0.2.0 draft the hook does nothing; entry 4 sends `map.changed` from it.
