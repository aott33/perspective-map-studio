---
title: 'Kind setups in the map store, and items checked against the kind list'
type: 'feature'
ticket: '9'
created: '2026-10-27'
status: 'draft'
baseline_revision: '0759b1b47326e2a5140eaacf8be441bc8ee22171'
route: 'full'
route_source: 'auto'
risk: 'high'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/docs/contract.md'
  - '{project-root}/docs/kinds-and-assets.md'
  - '{project-root}/_bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md'
  - '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/story-conflicts-retries-deletes-and-the-phone-role-plan.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `kindSetup` ops are refused as "not supported" (`EditBatch.requireSupported`), so nothing can store a kind setup for epic-viewing to read, and any non-empty `kind`, any geometry and any `properties` are saved without a look at the project's kind list (AD-16, AD-20, epic R8, R11).

**Approach:** Publish the kind setup schema, the closed placeholder list with a pure fill function, and the closed style preset and tint lists in `common/`; save kind setups through the one write path (versioned, conflicts, edit record, `map.changed`) and return them in `map.load` and `getMap`; check and normalise every map item op, and every override, against the cached kind list inside the write transaction, refusing with code `invalid` and a plain-words reason. No migration: `mapstudio_kind_setup` and the `kindSetup` edit entity are already in migration 1.

## Boundaries & Constraints

**Always:** Every refusal writes nothing, takes no `seq` and names the op (`{index, id}`). Kind setups are keyed by project and kind id, `baseVersion` 0 on create, tombstoned on delete exactly like map items (restore = create at the tombstone's version). Full editing only for `kindSetup` ops (the role matrix already refuses phone). Tag paths in a kind setup are `{asset.path}`, `{asset.path}/<suffix>` or a full `[provider]path`; in an override, full only. Normalising happens once, on the Gateway. Jython 2.7 rules in every doc example. No em dashes. Contract stays 0.2.0 draft; every change recorded in docs.

**Never:** No migration (story 14 takes 0002). No rendering, popup, live value, tag read or tag browse (epic-viewing, story 15). No check of `assetId` against the asset list, no icon-name check (story 10). No browser save-queue change (story 8). No change to how `level` is worked out. No expression parsing beyond "non-empty text" (backlog spike-style-rule-expression-language). Never store or accept a colour code.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Error |
|---|---|---|---|
| Save setup | `applyEdits` create `kindSetup` `pad` with comms `{asset.path}/Comms`, KPI `[default]Shared/GasPrice`, States rule, popupView `{path: "Popups/PadDetails", params: {padName: "{item.name}", tagPath: "{asset.path}", area: "Mesa", pressure: "{asset.path}/Pressure"}}`, link `/pad/{item.name}` | v1; `map.load.kindSetups` and `getMap().kindSetups` return it unchanged; `map.changed` carries `{kindId, setup, version, deleted}` | none |
| Bad placeholder | param `{item.foo}`, link `/pad/{item.foo}`, param `P-{item.name}` or `{item.name}/Pressure`, param named `mapItem` | refused | `invalid`, reason names the param or link |
| Bad style | preset `red`, `#ff0000`, tint outside the palette, Bands out of order, `cases` on an expression rule, line preset on a point kind | refused | `invalid` ("Pick a preset: normal, attention, ...; colour codes are not accepted.") |
| Item vs kind list | unknown kind; `Point` on a line kind; `wells: "abc"` on an integer field; unknown property key | refused | `invalid` naming kind, geometry or field |
| CSV number | `wells: "12"`, `diameter: " 4.5 "`, `buried: "true"` | stored as `12`, `4.5`, `true` | none |
| Override | item `overrides.styleRule` valid; `overrides.kpis[0].path` `{asset.path}/X` | first saved unchanged; second refused | `invalid` ("an override's tag path is a full path") |
| Fill | `fill("{asset.path}/Pressure", item P12, asset basePath `[default]Mesa/P12`)` | `[default]Mesa/P12/Pressure` | a placeholder with no value gives null |
| Conflict | `kindSetup` update at a stale `baseVersion` | refused whole, `conflicts[].current` the stored kind setup record | `conflict` |

</frozen-after-approval>

## Code Map

- `common/.../contract/EditBatch.java` -- `requireSupported()` refuses every `kindSetup`: remove it and its two tests (`ContractTest.kindSetupOpsAreRefusedAsNotSupportedInThisVersion`, `WriteServiceTest.kindSetupOpsAreRefusedAsNotSupported`) and its call in `WriteService.apply`.
- `common/.../contract/EditOp.java` -- `kindSetup` ids are any string today: require a kind id as `Rows.id` does (non-empty, at most 64 chars).
- `common/.../contract/MapItemRecord.java` -- closed record, `merge` types fields; keep it. Its records go through the new checker after merge. Story 14 adds `attachment` here: keep the checker field-driven so that is one more case.
- `common/.../contract/Kind.java`, `FormField.java`, `Rows.java` -- kind list parse; `Kind.GEOMETRIES` `point|line`. Extend `Kind` only per Open Question 1 (the `instrument: true` flag of story 14 lands the same way).
- `common/.../contract/Conflict.java` -- `current` is a `MapItemRecord`: widen to a shared `StoredRecord` interface (`toJson()`, `version()`, `deleted()`, `name()` for messages) that `MapItemRecord` and the new `KindSetupRecord` implement.
- `common/.../contract/Setup.java` -- `alarmPage` must start with `/`; add the placeholder check (text plus any number of known placeholders).
- `gateway/.../write/WriteService.java` -- the one write path; `checkVersion` and `write` are map-item only; add a `kindSetup` branch to lock, version-check, write and record; constructor gains `Function<String, AdapterSnapshot>`.
- `gateway/.../write/ConflictReport.java` -- message uses `MapItemRecord.name()`; take `StoredRecord`; a kind setup is named "The <kind name> setup".
- `gateway/.../write/ChangeHook.java` -- `CommittedOp.record` becomes `StoredRecord`; `change/ChangeEvent.java` already writes `record.toJson()` and `version()`.
- `gateway/.../store/MapStore.java`, `JdbcMapStore.java`, test `write/FakeMapStore.java` -- add `lockKindSetup`, `insertKindSetup`, `updateKindSetup`, `liveKindSetups` (prepared statements, `?::jsonb`).
- `gateway/.../load/MapLoader.java` -- `Snapshot` gains `kindSetups`, read in the same transaction; `mapLoadReply` adds `kindSetups` per Open Question 6.
- `gateway/.../script/MapList.java`, `GatewayScriptModule.getMapImpl` -- `getMap` stays a list; add the `kindSetups` attribute like `readOnly`.
- `gateway/.../MapStudioServices.java:89` -- `new WriteService(gate, store, changes)`: pass `adapters::snapshot` (built on the next line; reorder).
- `gateway/.../adapter/AdapterSnapshot.java` -- `kinds()` and `kindsStatus()` are the cache the checker reads; read once per batch.
- `web/typescript/contract.ts`, `messages.ts`, `changes.ts` -- `entity` already `item|kindSetup`; `changes.ts:113` ignores kind setup records; add the types and read `kindSetups` tolerantly.
- `ops/project/.../views/MapStudioEdit/view.json` -- "Run script checks" creates a `pad` without the required `status`: stays valid if Open Question 5 keeps required fields unenforced; add kind setup checks here.
- `e2e/tests/writepath.spec.mjs`, `store-ops.spec.mjs` -- create `pad` and `line` items; `adapters.spec.mjs` switches the dev adapter to `empty` or `broken`, `workers: 1`, so specs never overlap, but each saving spec must leave the mode `ok`.

## Tasks & Acceptance

**Execution:**
- [ ] `common/.../contract/Placeholders.java` (new) -- closed list `{item.id}`, `{item.name}`, `{asset.id}`, `{asset.path}`, `{item.properties.X}`; `checkParam`, `checkTemplate` (link, alarm page), `checkTagPath(value, assetRelativeAllowed)`; pure `fill(template, ItemView)` returning the filled text or null when a placeholder has no value -- one rule set for validation and epic-viewing.
- [ ] `common/.../contract/StylePresets.java` (new) -- closed `PRESETS`, `LINE_PRESETS`, `TINTS` per Open Questions 2 and 3; colour-code detection for the message.
- [ ] `common/.../contract/KindSetup.java` (new) -- the schema (Design Notes): `parse(JsonObject, Kind, boolean override)` validates and returns the normalised JSON; style rule `source` parsed through one switch (`path`, `kpi`) so story 14 adds `instruments` as one case. `KindSetupRecord` (new) `{kindId, setup, version, deleted}`; `StoredRecord` (new) interface.
- [ ] `common/.../contract/ItemCheck.java` (new) -- `check(MapItemRecord, Kind)`: geometry type matches, properties keyed and typed by fields with CSV-string conversion, `overrides` through `KindSetup.parse(..., override=true)`; returns the normalised record.
- [ ] `EditBatch.java`, `EditOp.java`, `Conflict.java`, `MapItemRecord.java` (implements `StoredRecord`), `Setup.java` -- as in Code Map.
- [ ] `gateway/.../store/{MapStore,JdbcMapStore}.java`, test `FakeMapStore.java` -- kind setup rows.
- [ ] `gateway/.../write/{WriteService,ConflictReport,ChangeHook}.java`, `MapStudioServices.java` -- kind list read once per batch; item ops checked after the lock (stored kind for updates), `kindSetup` ops checked against their kind; rules of Open Question 4.
- [ ] `gateway/.../load/MapLoader.java`, `script/{MapList,GatewayScriptModule}.java` -- return kind setups.
- [ ] Tests: `common` `PlaceholdersTest`, `KindSetupTest`, `ItemCheckTest`, `SetupValidationTest` (alarm page); `gateway` `WriteServiceKindSetupTest` (create, update, delete, restore, conflict, retry, phone refused, `map.changed` record), `WriteServiceKindCheckTest` (the I/O matrix), `MapLoaderTest`, `GatewayScriptModuleTest`; existing tests given a kind list fixture in `WriteFixture`.
- [ ] `web/typescript/{contract,messages}.ts`, `placeholders.ts` (new, mirrors `fill` and the closed list), `__tests__/placeholders.test.ts` -- same cases as the Java test.
- [ ] `ops/project/.../MapStudioEdit/view.json`, `e2e/tests/kindsetup.spec.mjs` (new) -- live run of the verify line through `applyEdits` and `edits.apply`.
- [ ] `docs/kind-setup.md` (new), `docs/contract.md`, `docs/kinds-and-assets.md`, `docs/setup.md` -- schema with examples, placeholders, presets, tints, item checks, `kindSetups` in `map.load` and `getMap`; drop the "until entry 3" text.

**Acceptance Criteria:**
- Given the dev Gateway, when the I/O matrix rows run through `applyEdits` and `edits.apply`, then each saves or is refused as listed and psql shows one `mapstudio_kind_setup` row and one `kindSetup` edit record per saved op.
- Given a phone editor or a viewer, when either sends a `kindSetup` op, then it is refused `role` and nothing is written.
- Given the existing e2e suite and the dev script checks, when run after this story, then they pass unchanged except where the plan names a change.

## Design Notes

Kind setup schema (stored as `setup jsonb`; every part optional; unknown keys refused):

```json
{"comms": {"path": "{asset.path}/Comms", "on": true},
 "kpis": [{"key": "pressure", "label": "Pressure", "path": "{asset.path}/Pressure", "unit": "psi", "on": true, "icon": true},
          {"key": "gas", "label": "Gas price", "path": "[default]Shared/GasPrice", "unit": "", "on": false, "icon": false}],
 "alarms": {"path": "{asset.path}", "count": true, "summary": true},
 "link": "/pad/{item.name}",
 "popupView": {"path": "Popups/PadDetails", "params": {"padName": "{item.name}", "pressure": "{asset.path}/Pressure"}},
 "styleRule": {"source": {"kpi": "pressure"}, "type": "bands",
               "cases": [{"min": null, "max": 900, "preset": "normal"}, {"min": 900, "max": null, "preset": "warning"}]},
 "areaTints": {"property": "operator", "tints": [{"category": "North", "tint": "tint-1"}]}}
```

At most 4 KPIs, keys unique, at most one `icon: true`; the `on` switches are FR-12's per-value switches and FR-4's popup parts (all off = no popup). `source` is `{path}` or `{kpi: <key of this setup>}`; States `cases [{value, preset}]` with unique values; Bands ordered, `min < max`, open ends null, no overlap; `expression` a non-empty string and no `cases`. `{item.properties.X}` needs X to be a form field key of the kind. An override is a partial kind setup with the same parts (Open Question 7). Validation lives in pure `common/` classes so the Designer, the Gateway and later the Kinds screen share one rule set.

Placeholder fill is published twice on purpose: Java in `common/` (the contract reference the write service validates with) and a TypeScript mirror in `web/`, because AD-7 fills in the browser; both test the same vectors.

## Open Questions

1. **Area kinds for `areaTints`.** The kind list has only `point` and `line`; no kind is an area. (a) Add an optional `area: true` flag on a line kind (a closed line drawn as an area), `areaTints` refused elsewhere - mirrors story 14's `instrument: true`; (b) accept `areaTints` on any line kind until an area geometry exists; (c) refuse `areaTints` until an area geometry exists (the verify line's areaTints check fails). **Recommended: (a).**
2. **Tint names.** DESIGN.md says "palette not chosen yet". (a) `tint-1` to `tint-6`, mapped to theme tokens by epic-viewing; (b) named tints (for example `sand`, `sage`, `slate`) chosen now. **Recommended: (a)**, names carry no hue promise before ER-27.
3. **Line presets and pipe weight.** (a) `normal`, `attention`, `warning`, `fault`, `dimmed` for every kind, plus `solid`, `dashed`, `dotted` for line kinds only; weight by pipe size is not a preset in 0.2.0 and goes to the backlog for epic-viewing; (b) add `weight-1` to `weight-3` presets now. **Recommended: (a).**
4. **When the kind list cannot vouch.** (a) A delete always passes; any other item op, and any `kindSetup` create or update, needs a kind list in use (status `ok` or `incomplete`, or the last good list), else `invalid` "The kind list is not available (failing): ...; nothing was saved."; an update of an item whose kind left the list is refused unless it sets a known kind; (b) skip the checks when no list is in use. **Recommended: (a)**, (b) would let unchecked data in.
5. **Required form fields.** (a) Not enforced at save in 0.2.0 (the draw tool, the script checks and imports create items before their form is filled; epic-editing flags them); present fields are typed; (b) refuse a create missing a required field. **Recommended: (a)**, documented.
6. **Who receives kind setups.** Kind setups hold tag paths, which viewers do not get today (assets go to phone and full only). (a) `map.load.kindSetups` to `phone` and `full` only, and `getMap().kindSetups` to scripts; epic-viewing defines what a viewer needs; (b) to every level. **Recommended: (a).**
7. **Override keys.** (a) `overrides` holds only kind setup parts (validated as in a kind setup, tag paths full only), any other key refused; epic-editing adds icon, size and label as an additive draft change; (b) validate only `styleRule` and tag paths, pass other keys through. **Recommended: (a).**
8. **Plan size.** About 3,200 tokens, above the 1,600 guide: kind setup storage and item checking could ship as two pull requests, but the placeholder, preset and override checks need the kind, and the owner sliced it as one. (a) Keep; (b) split item checking into its own entry. **Recommended: (a).**

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build` -- expected: green, new common and gateway tests, existing ones passing.
- `cd web && npx jest` -- expected: all suites pass, `placeholders.test.ts` new.
- `ops/up.sh --fresh`, then `cd e2e && npm test` -- expected: all pass, `kindsetup.spec.mjs` new (worktree `.env`: `MAPSTUDIO_CONTAINER=ms-e2s9`, `GATEWAY_HTTP_PORT=9129`).

**Manual checks:**
- psql on the dev database: `SELECT kind_id, version, deleted FROM mapstudio_kind_setup` and the `kindSetup` rows of `mapstudio_edit` match the e2e run; `mapstudio_schema_version` still holds only version 1.
