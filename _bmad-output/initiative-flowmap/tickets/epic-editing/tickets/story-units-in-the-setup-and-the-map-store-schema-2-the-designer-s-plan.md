---
title: "19a: units in the project setup: schema 2, the Designer's Units row, and map.load.reply"
type: 'feature'
ticket: '19'
created: '2026-11-12'
status: 'built'
baseline_revision: '93dae81f84073153e711f904e39b8b4056cfa24c'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['{project-root}/docs/setup.md', '{project-root}/docs/setup-editor.md', '{project-root}/docs/contract.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A project cannot say whether its map shows kilometres or miles (R27): the setup has no units field, the Designer's form has no row for it, and the browser is told nothing.

**Approach:** The setup gains an optional `units` (`auto`, `metric` or `us`; absent means `auto`, the browser's locale), which takes the setup to schema 2. The Gateway reads schema 1 and 2; the Designer's Map section gains a Units row and writes schema 2 only when units is not auto; `map.load.reply`'s setup carries the units. This is the first half of entry 19; the map store's `settings` entity (Edit mode's override) is 19b.

Decisions (owner, 2026-11-12, "approve and continue" on the split and the plan's ten picks): entry 19 is split in two; this is 19a. (1) `units` is `auto`, `metric` or `us`; absent means `auto`. (2) A schema 1 file that holds `units` is refused in the words every unknown field gets. (3) A schema 2 file with no `units`, or `auto` typed by hand, reads as auto. (4) The newer refusal reads "... (schema 3; this module reads 1 and 2)". (5) The Designer's row sits in the Map section after Alarm page: "Auto (the browser's locale)", "Metric", "US". (6) The Designer's schema label shows the number the save will write. (7) The reply's `setup.units` is always present, at every level; the browser reads it and does nothing with it until entry 20. (8) The dev project becomes schema 2 with `metric`; the showcase, perf and store-check setups stay schema 1. (9) The 0.3.0 refusal is tried with `ops/release-smoke.sh 0.3.0` here; if the published module cannot be fetched, the step goes in the playbook for the owner. (10) The Designer's proof is its Java tests, with a Designer check for the owner in playbook section 8s.

## Boundaries & Constraints

**Always:** **Reading:** a schema 1 file reads as before, with units `auto`; a schema 2 file may hold `units`; a schema 1 file that holds `units` is refused in the words every unknown field gets; an unknown value is refused naming the three allowed; schema 3 or later is refused as newer ("this module reads 1 and 2"). **Designer:** a Units row in the Map section after Alarm page, a select of "Auto (the browser's locale)", "Metric" and "US"; saving writes `schemaVersion` 2 with `units` only when the choice is not Auto, else schema 1 with no `units`, so an unrelated edit never stops a 0.3.0 Gateway from reading the project; the schema label shows the number the save will write; the newer-schema state reads "newer than 2" in its own words. **The reply:** `map.load.reply`'s `setup` always holds `units` (one of the three), at every access level; the browser reads it (absent reads as `auto`) and does nothing with it yet. **The dev project** names `metric`, so the e2e suite keeps reading kilometres when entry 20 lands. Docs: `docs/setup.md`, `docs/setup-editor.md`, `docs/contract.md` (the setup section, the reply), `CHANGELOG.md`, EXPERIENCE.md's Designer Setup Form, the architecture's AD-5, playbook section 8s. Words brief and plain; no em dashes.

**Never:** The map store, `edits.apply`, the `settings` entity or `map.changed` (19b); any distance rendered differently or a Layers row (entry 20); a contract version bump (0.4.0 is unreleased); a schema 2 file written when units is Auto; a change to the other setups in the repository (showcase, perf, store checks stay schema 1).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| U1 Schema 1 | A schema 1 file, no units | Loads; the reply's setup has `units: "auto"` | No error expected |
| U2 Schema 2 | `schemaVersion` 2, `units: "us"` | Loads; the reply has `units: "us"` | No error expected |
| U3 Schema 2, none | `schemaVersion` 2, no units | Loads as `auto` | No error expected |
| U4 Units in schema 1 | `schemaVersion` 1, `units: "metric"` | Refused | "units is not a setup field of schema 1" |
| U5 Bad value | `units: "imperial"` | Refused | Names auto, metric, us |
| U6 Newer | `schemaVersion` 3 | Refused as newer | "... (schema 3; this module reads 1 and 2)" |
| U7 Designer sets | The form on a schema 1 file, Units to Metric, save | The file is schema 2 with `units: "metric"` | No error expected |
| U8 Designer clears | Units back to Auto, save | The file is schema 1 with no `units` | No error expected |
| U9 Designer, other edit | A schema 1 file, another row changed, save | Still schema 1 | No error expected |
| U10 Designer, newer | A schema 3 file opened | Read only, "newer than 2" words | Nothing written |
| U11 Viewer | An anonymous viewer loads the dev map | The reply's setup has `units: "metric"` | No error expected |

</frozen-after-approval>

## Code Map

- `common/.../contract/Setup.java` (458) -- the record :41-51, `SCHEMA_VERSION = 1` :53, `FIELDS` :61, `read()` :115, the newer refusal :135-138, "schemaVersion must be 1" :141, the unknown-field words :343, built at :236. A new component changes every `new Setup(...)` call and test.
- `gateway/.../load/MapLoader.java` -- `setupJson` :249-257 (add `units`), `mapLoadReply` :239. `gateway/.../setup/SetupLifecycle.java` :78 reads the file.
- `scripts/ci/check-contract-versions.sh` -- reads `SCHEMA_VERSION` and needs "## The project setup, schema version N (AD-5)" in `docs/contract.md` (:440) and "# Map Studio project setup, schema version N" as `docs/setup.md`'s first line; its test `scripts/ci/test-contract-versions.sh`.
- `designer/.../setup/SetupForm.java` (646) -- field constants :53-63, `FIELDS` :69, `KNOWN_KEYS` :73, newer detection :132-140, `text()`/`setText()` :300-320, `toJson()` :558 (always writes `SCHEMA_VERSION` :563: the schema rule goes here). `SetupPanel.java` (1217) -- the Map section :305-311, `row()` :377, fill :597-611, write back :643, the schema label :527. Words: `MapStudioDesigner.properties` :14-15, :91-92 ("schema 1" is hard-coded).
- `web/typescript/contract.ts` -- `readMapSetup` :279.
- Dev setup: `ops/project/com.aoindustrial.perspective.mapstudio/setup/setup.json`; e2e rewrites it through `e2e/lib/gateway.mjs` (`writeSetup`, `restoreSetup`); `e2e/tests/setup.spec.mjs` :50, :101.
- Tests: `ContractTest` :101-122, `SetupValidationTest` :107-112, `SetupLifecycleTest`, `MapLoaderTest`, `SetupFormTest` :237-243, `SetupPanelTest`, `SetupPanelRenderTest`.
- Docs: `docs/setup.md` (Fields :40, What the browser sees :100, Versions :104), `docs/setup-editor.md` (:14, :45), `docs/contract.md` :14, :440, `docs/operations.md` :51-59, `CHANGELOG.md` :7, EXPERIENCE.md :279-280, :306, the architecture's AD-5 (`architecture-map-studio.md` :80).
- `ops/release-smoke.sh 0.3.0` runs the published module; no script yet gives it a schema 2 file.

## Tasks & Acceptance

**Execution:**
- [x] `common/.../contract/Setup.java`, `ContractTest`, `SetupValidationTest` -- `units`, schema 1 and 2 read, the refusals -- U1 to U6, tests first.
- [x] `gateway/.../load/MapLoader.java`, `MapLoaderTest`; `web/typescript/contract.ts` and its test -- `units` in the reply's setup at every level, read by the browser -- U1, U2, U11.
- [x] `designer/.../setup/SetupForm.java`, `SetupPanel.java`, `MapStudioDesigner.properties`, their tests -- the Units row, the schema the save writes, the newer words -- U7 to U10.
- [x] `ops/project/.../setup/setup.json`, `e2e/tests/setup.spec.mjs` -- the dev setup at schema 2 with `metric`; a live check of U1, U2, U4 and U11.
- [x] `docs/setup.md`, `docs/setup-editor.md`, `docs/contract.md`, `docs/operations.md`, `CHANGELOG.md`, EXPERIENCE.md, the architecture's AD-5, `docs/test-playbook-0.4.0.md` section 8s (with the Designer steps and the 0.3.0 check for the owner).
- [x] `ops/release-smoke.sh 0.3.0` with a schema 2 setup, if the published module can be fetched here -- the 0.3.0 Gateway refuses it in words; if it cannot, say so and leave the step in the playbook.

**Acceptance Criteria:**
- Given the dev Gateway, when any role loads the map, then `map.load.reply`'s setup holds `units: "metric"`, and every existing e2e expectation holds.
- Given `scripts/ci/check-contract-versions.sh`, when run, then it reports setup schema 2.

## Implementation Notes

- Planner, 2026-11-12: the environment and identity rules are entry 13b's plan's first Implementation Note (`story-the-tag-browser-one-tree-for-every-tag-pick-asset-relative-p-plan-13b.md`); they hold here. Leave the work uncommitted; run the specs you touch, not the whole suite. The Designer form cannot be opened here: its tests are the proof, and the owner's Designer check is in the playbook.

- Implementer, 2026-11-12: built as planned, left uncommitted. `Setup.SCHEMA_VERSION` is 2 (the newest read), `OLDEST_SCHEMA_VERSION` 1; `units` is the record's last component and the file's last known key. The unknown-field words name the file's own schema. In the Designer a schema 1 file that holds `units` shows as not readable (the existing guard: never show as valid a file the Gateway refuses), and a value that is none of the three shows as a fourth line with the Gateway's reason. Task 6: the published 0.3.0 was fetched; `ops/release-smoke.sh 0.3.0 --image inductiveautomation/ignition:8.3.10` stopped at its browser check (map load "failed"), and the same stack started by hand logged "setup.json is written for a newer Map Studio (schema 2; this module reads 1)." (`docs/platform-checks.md`, "Epic 4 entry 19a"). Consequence of pick 8: the release smoke mounts `ops/project`, so a smoke of 0.3.0 or older fails while the dev setup is schema 2; the script is unchanged. The image 8.3.9 the smoke defaults to is not on this box. ignition-lint is not installed here. Not run: `ops/up.sh --fresh` and the whole e2e suite (the orchestrator's); run: `setup.spec.mjs` (3 passed), `basemaps.spec.mjs` and `store.spec.mjs` (13 passed) on `ops/up.sh` without `--fresh`.
- Implementer, 2026-11-12, after review: a schema 1 file that holds `units` is always not readable in the Designer, with the Gateway's words, whatever else is in it. `ops/release-smoke.sh` gives a version older than 0.4.0 a schema 1 copy of the dev setup (`ops/docker-compose.smoke-setup1.yml`), which supersedes the note above on pick 8; with it 0.3.0 reads the setup and loads the map, but the smoke of 0.3.0 still fails in its browser check, because the committed `drawLine` drives epic 4's toolbar, which 0.3.0 does not have (older than this entry, not fixed here).

## Plan Change Log

## Review Triage Log

Quick review, 2026-11-12 (one reviewer, by inspection). The acceptance criteria and U1 to U11 read as met; no em dash, no version bump, the other setups untouched. Four findings: 0 high, 2 medium, 2 low, 0 false, 0 maybe-false. Three routed patch, to the implementer; one rejected.

- medium, patch: a schema 1 file that holds `units` opens editable in the Designer when it has another problem or a value outside the three (`SetupForm.fromJson`'s guard fires only when the form's own rewrite would be accepted), showing "Schema version 2" and a reason the Gateway never gave. It is shown as not readable with the Gateway's words in every case, as `docs/setup-editor.md` says.
- medium, patch: `ops/release-smoke.sh` mounts `ops/project`, now schema 2, so the smoke of 0.3.x or older that `RELEASING.md` prescribes fails at its browser check, and neither says so. The script gives a release older than 0.4.0 a schema 1 copy of the setup, and `RELEASING.md` says it.
- low, patch: `docs/setup.md`'s `units` row sits after the blank line that ends the Fields table, so it renders as loose text. Moved into the table.
- low, rejected: EXPERIENCE.md's Newer schema row links a mockup with the older words. The text beside it says so, and the fix is a new mockup picture, not a correction.

Outcome (2026-11-12): three patches applied, one finding rejected; one thing deferred (`_bmad-output/deferred-work.md`: the release smoke of a release older than 0.4.0 still fails at its browser check, in the rehearsal's draw step). The Designer's row was not seen in a real Designer (playbook 8s). The orchestrator's Verification on the patched code: tsc clean, Jest 1117 passed, Gradle BUILD SUCCESSFUL, both contract checks OK (setup schema 2), and on a fresh stack the whole suite 332 passed, 9 skipped (the store-check and Gateway-stop scenarios, run by hand), 0 failed in 1.3 h. This plan covers 19a only: the entry is not done until 19b.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: all pass
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL
- `bash scripts/ci/check-contract-versions.sh` and `bash scripts/ci/test-contract-versions.sh` -- expected: OK, setup schema 2
- `ops/up.sh --fresh`, then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: 0 failed
