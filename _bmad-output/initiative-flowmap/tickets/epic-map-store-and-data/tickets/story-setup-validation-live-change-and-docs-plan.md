---
title: 'Setup: validation, live change and docs'
type: 'feature'
ticket: '6'
created: '2026-10-26'
status: 'draft'
baseline_revision: ''
route: 'full'
route_source: 'auto'
risk: 'medium'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-map-store-and-data/tickets/story-tracer-one-edit-saved-through-the-write-path-and-read-back-plan.md'
  - '{project-root}/docs/platform-checks.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Story 1 reads the project setup once at project start and only checks that it parses: a wrong field gives no plain-words reason, and a changed setup needs a Gateway restart. The `onResourcesModified` path that would apply a change live was never seen to fire (docs/platform-checks.md check 4, `[not verified]`; spike report item 3, owner skipped).

**Approach:** On top of story 1's setup loader (`SetupLifecycle`, `SetupRegistry`, `common` `Setup`), validate every field of setup v1 and collect every problem as one plain-words reason; keep one setup state per project (valid, invalid with reasons, missing) that `map.load`, the write service and the scripting API read on every call; re-read the resource on created, modified and deleted after proving live that a project scan reaches `onResourcesModified`; publish the setup schema in `docs/setup.md` with an example. Live proof first; no other code is built on the modified path before it is seen.

## Boundaries & Constraints

**Always:**
- Story 1's contracts are fixed: setup v1 fields and `schemaVersion: 1`, error codes (a bad or missing setup is `store-unreachable` with the reason as `message`), envelope, ops, migration 1. This story changes no message type and adds no error code.
- Every problem names its field and says what is wrong in plain words (`refreshIntervalSeconds must be a whole number from 1 to 3600, not "ten"`); all problems reported together.
- One warning per project per setup read that is bad (at start and at each change), on logger `MapStudio.setup`, naming the project and the reasons; one info line when a changed setup applies. Never log a secret value.
- Setup state is read per call, never cached in the write service, `MapLoader` or the script module, so a change applies at the next `map.load`, `edits.apply` or `applyEdits`.
- Every SDK behaviour not seen live marked unverified in comments and docs. No em dashes.

**Never:**
- A database migration (none needed), a Designer editor (entry 7), kind or asset function calls or their cache (entry 3), pushing a setup change to open maps (entry 4, `map.changed`), store states beyond reading the connection name (entry 5), role matrix changes (entry 2).
- Touch `testSet`, `popupView`, existing e2e specs, or `ign-scada-template`.
- A Gateway-wide module setting, or a JSON Schema library dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid setup | v1, all fields good | state valid; `map.load` works | none |
| Bad field | `refreshIntervalSeconds: "ten"` | state invalid; one warning | `map.load` `store-unreachable`, message names the field |
| Several bad fields | bad `basemaps` and `roles.full` not a list | one reason listing both | as above |
| Not JSON | truncated `setup.json` | state invalid | "setup.json is not valid JSON (line L, column C)" |
| Resource without `setup.json` | `resource.json` only | state invalid | "setup.json is missing from the setup resource" |
| Newer schema | `schemaVersion: 2` | state invalid | "written for a newer Map Studio (schema 2; this module reads 1)" |
| Setup deleted | resource removed, project scanned | state missing | story 1's missing-setup warning and reason |
| Roles changed | `roles.full` edited, project scanned | next `map.load` level follows, no restart | none |
| Fixed after invalid | good file, scanned | state valid; info line; `map.load` works | none |
| Connection changed | `connection` renamed to another valid one | next call uses it (story 1's lazy per-connection migrate) | missing connection as story 1 |

</frozen-after-approval>

## Code Map

Story 1 (planned, not built) creates every file below marked (s1); this story extends them only where listed.
- `common/.../common/contract/Setup.java` (s1) -- parse and validate of setup v1; extend validate to return `List<SetupProblem>` with every field rule; entry 7's Designer form must call this, not its own rules.
- `gateway/.../setup/SetupLifecycleFactory.java` (s1) -- unchanged (filter on the setup `ResourceType`).
- `gateway/.../setup/SetupLifecycle.java` (s1) -- add `onResourcesCreated`, `onResourcesModified`, `onResourcesDeleted` (signatures as the spike's `ChecksLifecycle` at `51104c8`: `List<Resource>` / `List<ResourceId>`).
- `gateway/.../setup/SetupRegistry.java` (s1) -- holds `SetupState` per project; atomic replace; listener list for entries 3 and 4 to join later.
- `gateway/.../load/MapLoader.java`, `gateway/.../write/WriteService.java`, `gateway/.../script/GatewayScriptModule.java`, `gateway/.../store/StoreRegistry.java` (s1) -- check each reads `SetupRegistry` per call; change only a cached lookup. `StoreRegistry` is entry 5's too: touch it only if it caches project to connection.
- `web/typescript/contract.ts`, `web/typescript/MapStudio.tsx` (s1) -- one optional reply field and one `data-` attribute only (Open Question 5).
- `docs/contract.md` (s1) -- replace its setup v1 section with a link to `docs/setup.md`.
- Spike evidence: `git show 51104c8:gateway/src/main/java/com/aoindustrial/perspective/mapstudio/gateway/spike/ChecksLifecycle.java` (the modified hook as written then), `.../SetupResource.java`, `resource.getData("setup.json").map(ImmutableBytes::getBytesAsString)` [live 8.3.10].
- `ops/docker-compose.yml` -- `ops/project` is bind-mounted as `mapstudio-dev`, so editing `ops/project/com.aoindustrial.perspective.mapstudio/setup/setup.json` (s1) reaches the Gateway on a project scan. Story 1's `lib.sh` generates the api-token used to call the scan.
- `e2e/playwright.config.mjs` -- `workers: 1`, serial, so a spec may change the dev setup and restore it.

## Tasks & Acceptance

**Execution:**
- [ ] Proof first: `SetupLifecycle.java` logs at info on `onResourcesModified` in `MapStudio.setup`; `ops/scan.sh` (new) posts `POST /data/api/v1/scan/projects` with the story 1 api-token (endpoint [IA docs], unverified on 8.3.10). Edit the dev `setup.json`, run `ops/scan.sh`, and record in `docs/platform-checks.md` a new section "Epic 2 story 6 - setup change on a live Gateway" (which hook fired, delay after the scan, whether a file edit alone fires it). Fallback if no hook fires: `MapLoader` re-reads the resource from the project manager when its signature changed (SDK call unverified; record which one worked).
- [ ] `common/.../contract/SetupProblem.java` (new, `field`, `message`), `common/.../contract/Setup.java` -- rules in Design Notes; `Setup.describe(List<SetupProblem>)` joins them into one sentence list.
- [ ] `gateway/.../setup/SetupState.java` (new: `valid(Setup)`, `invalid(String reason)`, `missing()`), `gateway/.../setup/SetupChangeListener.java` (new), `SetupRegistry.java`, `SetupLifecycle.java` -- created, modified and deleted re-read and replace the state; warn or info lines as in Always; listeners called after the swap, exceptions caught and logged.
- [ ] `gateway/.../load/MapLoader.java` and the other s1 readers -- invalid state gives `store-unreachable` with the reason; per-call reads verified by test.
- [ ] `docs/setup.md` (new) -- every field, type, default, rule and example message; a full example; how to change it (edit and scan, or Designer save once entry 7 lands); that open maps see a change on their next load; semantic versioning of the schema; unverified marks. `docs/contract.md`, `docs/architecture.md` (link).
- [ ] `e2e/lib/gateway.mjs` (new: `scanProject()`, reads the token file, never prints it), `e2e/tests/setup.spec.mjs` (new), `e2e/global-setup.mjs` (restore the dev setup from `e2e/out/setup.json.bak` if a crashed run left one) -- signed in as `mapeditor`: level `full`; set `roles.full` to `["Nobody"]`, `roles.phone` to `["MapEditor"]`, `refreshIntervalSeconds` 30, scan, reload until level `phone` and interval 30 (30 s cap); write `"ten"`, scan, the component shows the reason naming `refreshIntervalSeconds`; restore, scan, level `full`. Screenshots `mapstudio-setup-invalid-{1440,390}.png`.
- [ ] Unit tests: `common/src/test/.../contract/SetupValidationTest.java` (every matrix input and every rule), `gateway/src/test/.../setup/{SetupLifecycleTest,SetupRegistryTest}.java` (state swaps, one warning per bad read, listener isolation, `MapLoader` sees a change with no restart).

**Acceptance Criteria:**
- Given the dev stack running, when the dev `setup.json` changes roles and refresh interval and `ops/scan.sh` runs, then the next `map.load` shows the new level and interval and the Gateway uptime did not reset.
- Given a setup with a bad field, when the project is scanned, then the Gateway log has exactly one `MapStudio.setup` warning naming `mapstudio-dev` and the field, and `map.load` replies `store-unreachable` with the same words.
- Given the e2e suite has run, when `git status --porcelain ops/project` runs, then it prints nothing.

## Implementation Notes

Start after story 1 is merged: rebase on main, set `baseline_revision` then. Story 1 file names above follow its plan; where the built code differs, follow the code and log it here.

## Plan Change Log

## Review Triage Log

## Design Notes

**Rules (setup v1).** `schemaVersion` 1 (higher: newer-module reason; else invalid). `connection` non-empty string. `roles` object with `full` and `phone`, each a list of non-empty strings, no duplicates. `kindsFunction`, `assetsFunction` empty or a dotted Python name (`^[A-Za-z_]\w*(\.[A-Za-z_]\w*)+$`). `refreshIntervalSeconds` whole number 1 to 3600 (Open Question 3). `alarmPage` empty or starting with `/`. `basemaps` non-empty list from `none`, `osm`, `satellite`, `mapbox`, no duplicates. `tokenSecret` string (a secret name, never a value). Required fields, defaults and unknown fields per Open Questions 1 and 2.

**Why `store-unreachable`:** story 1 already maps a missing setup to it; one code keeps entries 3 to 8 from handling a fourth store state.

## Open Questions

1. **Required fields and defaults.** (a) Only `schemaVersion` and `connection` required; the rest default (`roles` both empty, so nobody edits; functions `""`; `refreshIntervalSeconds` 10; `alarmPage` `""`; `basemaps` `["none", "osm"]`; `tokenSecret` `""`). (b) Every v1 field required. Recommended: (a), the shortest working setup is two lines.
2. **Unknown fields.** (a) Invalid, with a "did you mean" hint, so `refreshInterval` is caught; any new field bumps `schemaVersion`. (b) Ignored with one warning; new optional fields stay schema 1. Recommended: (a).
3. **Refresh interval range.** (a) 1 to 3600 s. (b) 5 to 300 s. Recommended: (a); NFR-9 lets a large project go longer.
4. **A bad change on a running map.** (a) Store unavailable until fixed, as R12 says (every open map loses editing at its next call). (b) Keep the last good setup running and warn; `map.load` still works. Recommended: (a), visible and as specified; (b) hides a broken file until the next restart.
5. **How `map.load` shows the interval.** (a) Add an optional `setup: {refreshIntervalSeconds, basemaps, alarmPage}` to `map.load.reply` (additive, 0.2.0 draft), and `data-refresh-interval` on the component, so the verify line can be tested. (b) No contract change; prove the interval only in a Gateway test. Recommended: (a); entries 3, 4 and epic-viewing read it.
6. **e2e changes a committed file.** (a) `setup.spec.mjs` edits the dev `setup.json` and restores it (finally block, plus global-setup recovery). (b) A second dev project for the spec only. Recommended: (a), no second project to keep in step.

## Verification

**Commands:**
- `./gradlew build` -- expected: green, the new common and gateway tests included.
- `ops/up.sh` then `cd e2e && npm test` -- expected: all pass, existing specs unchanged.
- `ops/logs.sh -n 400 | grep MapStudio.setup` -- expected: the proof line, one warning per bad read, one info per applied change, no secret.
- `git grep -nP '\x{2014}'` and `git status --porcelain ops/project` -- expected: nothing.

**Manual checks (if no CLI):**
- The new `docs/platform-checks.md` section and the two `mapstudio-setup-invalid` screenshots, readable at 390 px.
