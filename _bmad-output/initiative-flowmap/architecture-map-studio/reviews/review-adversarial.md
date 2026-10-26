---
type: review
lens: adversarial
target: _bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md
units: the seven epics in _bmad-output/initiative-flowmap/tickets/
requirements: _bmad-output/initiative-flowmap/initiative-flowmap.md
created: '2026-10-26'
verdict: not ready to bind the epics; 8 blocking holes, 6 tightening items
---

# Adversarial review - Map Studio architecture spine

## Verdict

**Not ready.** The spine is sound on the axis it was built for (one Gateway authority, one write path, one shared subscription, one message envelope), but it only fully specifies one entity: the map item. Everything around the map item - kind setups, overrides, the edit batch, change propagation to other open components, live-value shapes, the host-side write API, the role-to-operation split - is named but not shaped. Two epics built by different agents can each obey AD-1 to AD-15 to the letter and still produce code that cannot be joined. Eight such pairs are blocking; each closes with a new or tightened AD, listed at the end as draft text.

## Method

For each pair of epics that share an entity, a message, a table or a state change, I built the most literal reading each epic's agent could defend from the spine, the initiative and its own ticket, then checked whether the two readings integrate. A pair counts only when both readings are compliant with every AD as written. Units: 1 module-foundation, 2 map-store-and-data, 3 viewing, 4 editing, 5 import-export, 6 phone, 7 template-cutover.

## Blocking pairs

### P1 - Kind setups and overrides: three owners, no write path, no key

**Units:** 2 (store) x 4 (editing), with 3 (viewing) and 7 (cut-over) as further owners.

**Compliant reading A (epic 2).** AD-5 says roles, adapters, alarm page and basemaps are "set once per project, as a project-level setup". A kind setup is also once per project per kind, so epic 2 puts kind setups in the project setup resource (or the setup script function AD-5 allows). It versions nothing, because AD-2 versions map items.

**Compliant reading B (epic 4).** The glossary says the map store holds "maps, map items and kind setups", and R15 says a map editor writes them in the browser. Epic 4 adds a `mapstudio_kind_setup` table with a browser-generated UUID per kind setup (copying AD-10's id rule) and a new message `kindsetup.save`, since AD-2 only defines `item.save`. Overrides go in a separate `mapstudio_override` table keyed by (item id, part), saved by `override.save`, which does not touch the item's version.

**Compliant reading C (epic 3).** Its ticket says kind setups "can be seeded in the map store" for this epic. With no write API yet (see P5), it seeds them with SQL fixtures in its own guessed table shape.

**Why it breaks.** Viewing reads kind setups from one place, editing writes them to another, the cut-over writes a third. Kind setups have no conflict check, so two map editors silently overwrite each other's kind setup (violates R34's intent). An override saved apart from the item does not bump the item version, so the R20 "refuse undo if another editor changed it since" check misses override changes. Two kind setups can exist for one kind (two browser UUIDs). Undo of a kind setup change (R20 covers "any own edit") has no reverse path.

**Fix (new AD-16, tighten AD-2 and AD-5).**
- The kind list (host-owned, read only through AD-4: kind id, geometry, icon, form fields, label rank) and the kind setup (map-store-owned: comms path, KPIs, alarms path, popup parts, popup link, custom popup view) are different entities with disjoint fields. No field may appear in both.
- A kind setup lives in the map store, one row per (project, kind id). Its key is the kind id from the kind list; it has no generated id. It carries an integer version like a map item.
- Overrides are a field of the map item (`overrides`, same shape as a partial kind setup) and are saved with it through `item.save`, so they bump the item version.
- AD-2 becomes "one write path for map items and kind setups": the edit batch (P3) may contain kind setup operations, checked, versioned and recorded the same way.
- AD-5 adds: kind setups are never part of the project setup.

### P2 - "Shows on other open components within a few seconds": no owner, no channel

**Units:** 2 (store) x 3 (viewing), with 4 (editing) as consumer.

**Compliant reading A (epic 2).** Its Done-when says an edit "shows on another [browser] within a few seconds". AD-6 already sends one `values.batch` per refresh interval per open map, so epic 2 piggybacks changed map items on that batch.

**Compliant reading B (epic 3).** AD-6 defines `values.batch` as live values only. Epic 3 builds it that way and loads map items once on open (AD-1: the browser holds what the Gateway sent). It never learns that an item changed.

**Also broken, in both readings:** AD-6's single subscription is to "every live value the kind setups turn on", but nothing says when that set is recomputed. Epic 3 builds it at Gateway start from the store. When epic 4 links an item, adds one or changes a kind setup's comms path, the subscription is not updated and the new icon stays blank until a Gateway restart.

**Why it breaks.** Either item changes ride a batch whose interval the project may set to 60 s (violating R32's "few seconds"), or they never arrive. And a project with refresh interval 10 s and an item edit still has no path for the live-value service to learn about new paths.

**Fix (new AD-17).** After every committed write, the write service publishes one in-process change event `{project, items: [...], kindSetups: [...], deletedIds: [...], batchId, sessionId}`. The component delegate of every open map of that project forwards it at once as `map.changed` (not on the batch timer; its own message type, separate from `values.batch`). The live-value service subscribes to the same event and recomputes the subscription set for the changed items and kinds. A browser holding an unsaved edit on a changed item marks it as a conflict locally (same words as R34). The event does not cross redundant Gateways in the first version; a backup Gateway reloads from the store on failover (state this as accepted).

### P3 - The edit batch has no shape: create, delete, atomicity and size are undefined

**Units:** 2 (store) x 5 (import-export), with 4 (editing) and 6 (phone) as other senders.

**Compliant reading A (epic 2).** `item.save` body is a list of full map items with `version`. A missing version means create. Delete is a hard `DELETE`. A batch is one transaction (AD-2), any conflict rolls it all back, and the conflict body is the first conflicting item.

**Compliant reading B (epic 5).** A 2 000-row import is too big for one websocket frame, so epic 5 sends it as 20 `item.save` messages of 100. New items carry `version: 1` (the "versions start at 1" convention). Undo sends deletes as items with a `deleted: true` property.

**Why it breaks.** Version 1 on a create is read as "update to version 1" and refused as a conflict on a missing row. Twenty messages are twenty undo steps and twenty transactions (R26 needs one undo step; a failure halfway leaves half an import). Hard deletes make undo-of-delete a re-create at version 1, so another editor still holding version 4 of that id is not detected (R20, R34). A deleted flag in properties is not a delete to epic 2. One conflicting item in 300 bulk-edited ones (R28) refuses the batch but names only one item.

**Fix (tighten AD-2, new contract entry under AD-8).**
- `edits.apply` (rename of the batch form of `item.save`) body: `{batchId, ops: [{op: "create"|"update"|"delete", entity: "item"|"kindSetup", id, baseVersion, data}]}`. `baseVersion` is 0 for create and the current version otherwise.
- Deletes are tombstones: the row stays with `deleted_at`, the version increments, and restore is an `update` of the tombstone with its `baseVersion`. Tombstones are hidden from reads and exports.
- A batch is all or none, in one transaction, one undo step, one edit-record `batch_id`. A conflict returns every conflicting op with its current entity.
- The spine states a maximum ops per batch and frame size (set in the spike); a larger import is sent as a chunked upload under one `batchId` (`edits.begin`, `edits.chunk`, `edits.commit`) and committed once, so it stays one transaction and one undo step.

### P4 - Live value shape: `values.batch`, the popup push and the map item object disagree

**Units:** 3 (viewing) x 7 (cut-over), with docs (AD-9) as the contract.

**Compliant reading A (epic 3).** `values.batch` is `{itemId: {comms: true, kpi: 412.5, alarms: {p: 3, n: 2, acked: false}}}` with a separate `stale: [itemIds]` list, deltas only. The popup push is the raw cache entry `{path, value, quality, t}` per tag path. The map item object (AD-7) is built from the batch, so a custom popup view's values are up to one interval old and not live while open.

**Compliant reading B (epic 7).** The template's example custom popup view (built from AD-7's "documented map item object ... live values with their quality") expects `liveValues.kpis[0].value` and `.quality`, binds an Alarm Status Table to `alarmsPath`, and treats the object as live.

**Also:** AD-6 decides stale "at batch time"; the popup push is on change, outside the batch, so the same value can show stale in the icon and fresh in the popup.

**Why it breaks.** Three shapes for one thing, so the custom view, the default popup and the icon disagree about the same tag, and a later fix to one is a breaking AD-9 change in another. The map item object as documented lacks the alarms path that the example view needs (glossary lists id, name, kind, properties, asset id, base path, live values).

**Fix (tighten AD-6 and AD-7).**
- One `LiveValue` shape everywhere: `{value, quality, t, stale, reason}`, where `stale` is computed in the cache whenever the value or its item's comms changes, by one function, not at batch time.
- Live values are addressed by slot, not by tag path: `comms`, `kpi1` to `kpi4`, `alarms` (`{counts: {critical, high, medium, low}, unacked, top: [...]}`).
- `values.batch` body: `{seq, full: bool, items: {itemId: {slot: LiveValue}}}`; `full` is true on open, reconnect and for items whose link or kind setup changed (P2), so a value that has not changed since subscribe still arrives.
- The map item object is `{id, name, kind, properties, assetId, basePath, alarmsPath, overrides, liveValues: {slot: LiveValue}}`, the custom popup view's parameter is updated on every popup push while open, and the same object is what placeholders (R8) and the alarm-page placeholders (AD-5) resolve against, as dotted paths (`{asset.id}` becomes `{assetId}` or the glossary example is kept as an alias, decided once).

### P5 - Host projects write "through an API the module exposes", which no epic builds

**Units:** 2 (store) x 7 (cut-over), with 3 (viewing seeding) as a third consumer.

**Compliant reading A (epic 2).** AD-2's last sentence names an API but no epic covers it; epic 2's Done-when lists only browser saves. Epic 2 ships the write service with the user's session as the only caller.

**Compliant reading B (epic 7).** The Mesa field must enter the map store "without hand-written SQL" and without `prov`'s map steps. With no scripting API, epic 7 either imports a GeoJSON export through the browser by hand (not repeatable, not in CI, and the template's rule is that generated data comes from the registry by a script) or writes rows with `system.db.runPrepQuery` (forbidden by AD-2). Epic 3 seeds kind setups for its tests by SQL for the same reason.

**Further gaps even with an API:** AD-10 says ids are created in the browser, so a script has no id rule; a re-run of the cut-over creates the field twice. The role check (AD-2) has no user in Gateway scope. The edit record needs a "who".

**Fix (new AD-18, owner epic 2).** The module exposes a Gateway-scope scripting function (for example `system.mapstudio.applyEdits(project, ops, actor)` and `system.mapstudio.getMap(project)`) that calls the same write service with the P3 batch shape. Rules: callers may supply ids; ids for host-provisioned items are UUIDv5 of a namespace plus the caller's stable key (for example the asset id), so a re-run updates instead of duplicating; `actor` is a required string recorded in the edit record (`script:<name>`); Gateway-scope calls skip the session role check but are refused from Perspective session scope; the function is in the AD-9 public contract. AD-10 is amended: browser-drawn items get browser UUIDv4; script items may use UUIDv5. Epic 3 seeds through this function, so its fixtures survive store migrations.

### P6 - Two editing roles, one role check

**Units:** 2 (store) x 6 (phone), with 4 (editing).

**Compliant reading A (epic 2).** AD-2: "The write service checks the editing role from the project setup." Epic 2 accepts a write when the user has the editing role, and treats phone editing as a UI concern (it owns the Gateway check, epic 4 owns visibility).

**Compliant reading B (epic 6).** R9 names full editing and phone editing separately. Epic 6 grants phone editors point moves and property edits and sends them through `item.save`.

**Why it breaks.** Under A, a phone-only editor is refused every save, so epic 6 cannot pass its Done-when. If epic 2 instead accepts "either role", a phone editor on a desktop browser (or a crafted message) can draw, split and delete lines, which R31's limit and R9's "refused on the Gateway" are meant to stop. Width (below 768 px) is a browser fact the Gateway cannot check.

**Fix (tighten AD-2, AD-5).** The project setup names `editRoles` and `phoneEditRoles`. The write service enforces an operation matrix: full editing allows every op; phone editing allows only `update` of a point item's geometry, its properties and its overrides-free fields, and the reverse of those for undo; no create, delete, line or area geometry, kind setup or link change. The browser offers tools by role and width; the Gateway enforces by role alone.

### P7 - Snapped ends: stored in one epic, recomputed in another

**Units:** 4 (editing) x 6 (phone), with 3 (viewing) and 5 (import-export).

**Compliant reading A (epic 4).** R19 needs snapped and floating ends to look different after reload, so epic 4 stores `snappedTo: {start: itemId, end: itemId}` on lines and, when a snapped-to point moves, moves the line ends too and saves both in one batch.

**Compliant reading B (epic 6).** A phone move is a point update (its ticket says nothing about lines); it saves one item. Epic 3 draws snapped ends by coordinate equality after 6-decimal rounding. Epic 5 exports lines without `snappedTo` and imports by coordinates.

**Why it breaks.** A pad moved on a phone leaves its pipelines attached in the store (by reference) but drawn floating (by coordinates), or attached on desktop and detached on the next export round trip, so R35's "same map items" fails.

**Fix (new AD-19, owner epic 4).** Snapping is a stored relation on the line (`ends: {start: {itemId, vertex?}, end: {...}}`), part of the map item shape and of the export formats. Moving a snapped-to item moves every attached end in the same batch, implemented once in a shared `web/` geometry module that epic 6 reuses; the Gateway rejects a batch that moves a snapped-to item without its attached ends. Coordinate equality is never used to infer snapping.

### P8 - Export and import disagree on identity and on what a map item is

**Units:** 5 (import-export) x 2 (store), with 4 (editing).

**Compliant reading A (export half of epic 5).** GeoJSON features carry kind, properties and asset link (R35), with `id` as the feature id. Overrides and kind setups are not named in R35, so they are left out. Base path is written so the file is readable.

**Compliant reading B (import half, or a different agent in epic 5).** Imports always create new items with new UUIDs (AD-10: ids created in the browser "when the item is drawn"), store the CSV `base_path` column on the item, and keep CSV values as strings.

**Also epic 4:** item forms store typed values (numbers, booleans) from the kind's form fields and store only `assetId`, resolving base path from the asset cache.

**Why it breaks.** Re-importing an export into the same store duplicates the field. An export into an empty store loses overrides and kind setups, so the round trip is not "the same map items" in any user-visible sense. Two items of the same kind hold `"12"` and `12`, so bulk edit (R28) shows mixed values that are equal, and a stored base path goes stale when the asset moves (R14 requires the vanished-asset case to be derived).

**Fix (tighten AD-9 and the map item object, new AD-20).** The map item record is closed: `{id, kind, name, geometry, properties, assetId, overrides, ends, version}`. Base path, unlinked reason and unknown kind are derived at read time from the adapter caches and never stored. Properties are keyed by the kind list's form field keys and typed by field type; the write service validates and normalises every op against the kind list (CSV strings are coerced there, once). Export writes the id, overrides and the kind setups of the exported kinds; import of a feature whose id exists is an `update` (with the current version) shown in the preview as "changes N items", else a `create` with that id.

## Tightening items (non-blocking, but two agents would still diverge)

| # | Units | Hole | Proposed rule |
| --- | --- | --- | --- |
| T1 | 1 x 2 x 7 | AD-5 lets the spike pick a custom resource or a script function; epic 2 reads it and epic 7 writes it, in shapes nobody has fixed. | One JSON schema for the project setup in `common/`; a resource stores it, a script function returns the same dict; both validated by one loader. |
| T2 | 3 x 4 x 7 | "Per-page settings such as the starting area" is open-ended; epic 4 may add `editable`, epic 3 `basemap` or `refreshInterval` props. | Close the component prop list in AD-5: `startingArea`, `initialBasemap` (from the setup's list), `showTools` (can only hide, never grant). Anything that changes data, roles, load or a Gateway call is project setup. |
| T3 | 7 x 3 | Template pages never spell a provider (`{session.custom.provider}`); a per-project Gateway subscription has no session. An adapter returning provider-less base paths breaks AD-6. | Asset contract: `basePath` is fully qualified (`[provider]path`); the adapter, not the page, applies the provider. |
| T4 | 2 x 7 | AD-3 keys rows by project name; the template may run its map in a child of an inheritable project; epic 7 seeds under the parent name. | Key is the leaf project the session runs in; setup may be inherited, the map is not. Rename is a documented migration. |
| T5 | 4 x 5 x 6 | Undo stack ownership: epic 6's Undo bar and epic 5's import undo could be separate stacks, making Ctrl+Z order wrong. | One undo stack module in `web/`, owned by epic 4, whose entry is the P3 batch plus its reverse; epics 5 and 6 push to it. |
| T6 | 5 x 3 | UJ-1 says others check work "against a reference layer, even while Sam is still working", implying a shared layer; R29 says never saved as map items. Epic 5 may keep it in browser memory only. | Decide: session-only in the first version (and amend UJ-1), or a `mapstudio_reference_layer` row through the write path, never as map items. |

## Proposed AD text (drafts for the architect)

- **AD-2 (tightened) - One write path, for map items and kind setups.** The only write is `edits.apply` with the P3 op list; all or none, one transaction, one undo step, one edit-record batch. Creates carry `baseVersion` 0; deletes are tombstones; every conflict is returned. The write service enforces the role-to-operation matrix of P6 and validates ops against the kind list. Large batches use `edits.begin`/`chunk`/`commit` under one batch id.
- **AD-16 - Kind list versus kind setup versus override.** Kind list: host-owned, read only, keyed by kind id. Kind setup: map store, one per (project, kind id), versioned, written by AD-2. Override: a field of the map item. No field in two of them; nothing of this is project setup.
- **AD-17 - Change propagation.** Each commit emits one in-process change event; every open map of the project receives `map.changed` immediately; the live-value service recomputes its subscription set from the same event.
- **AD-6 / AD-7 (tightened) - One live value shape.** `LiveValue {value, quality, t, stale, reason}` by slot; stale computed in the cache; `values.batch {seq, full, items}`; the map item object adds `alarmsPath`, `overrides`, and is live while a custom popup view is open; placeholders are dotted paths into it.
- **AD-18 - Host write API.** Gateway-scope `system.mapstudio.applyEdits` and `getMap`, same write service, caller ids (UUIDv5 for provisioned items), required actor, public contract, owned by epic-map-store-and-data.
- **AD-19 - Snapping is stored.** Line ends reference what they snap to; moves carry attached ends in the same batch; one shared geometry module.
- **AD-20 - The map item record is closed and typed.** Stored fields listed; derived fields never stored; properties typed by the kind list; export carries id, overrides and kind setups; import updates on a known id.

## SIS, alarm and MOC notes

- No SIS scope found. Map Studio never acknowledges alarms and never writes to tags (AD-7, constraints).
- P4 changes how alarm state and stale are computed and shown on icons and popups: that is alarm presentation and goes to the template's engineering review (ER-27) with epic 7, as AD-11 already requires.
- P5's scripting API is a new write path into the map store from Gateway scope; it does not cross a network zone, but its exposure (Gateway scope only) should be confirmed in the security review of epic 2.
