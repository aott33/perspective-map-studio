---
title: 'Tracer: live values reach an icon and its default popup'
type: 'feature'
ticket: '5'
created: '2026-10-28'
status: 'in-progress'
baseline_revision: '1295f4a2f7f0c4f0f4f1c7a2e8a2b6f6d4e3c2b1'
route: 'full'
route_source: 'pinned'
risk: 'high'
review: 'quick'
review_source: 'coordinator'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/handoff-epic-3.md'
  - '{project-root}/docs/contract.md'
  - '{project-root}/docs/kind-setup.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Nothing live reaches the map yet: icons are neutral dots, the popup is the spike's project view, and `values.batch` exists only as a stand-in (`e2e/lib/valueBatch.mjs`). Epic 3 needs the thinnest working path through every layer viewing touches (AD-6, AD-7, AD-16) before basemaps, labels, styles and the rest build on it.

**Approach:** On the Gateway, one shared subscription per project to the comms, KPI and Alarm Metrics paths the kind setups turn on, kept in a live-value cache that sends each open map one `values.batch` per refresh interval (changes only; full on open, reconnect and after a link or kind setup change) and pushes an open popup's item on change (`popup.open`, `popup.close`). In the browser, a point draws its kind glyph, comms state, the icon KPI and the alarm glyph, and a click opens the default popup. Dev tags, an alarm and kind setups are seeded on the dev stack so the e2e suite can toggle a tag, raise and acknowledge an alarm and break comms.

## Decisions (recorded for the owner, 2026-10-28; no human could be asked in this unattended session)

1. **Alarm slot.** One `alarms` LiveValue per map item whose value is `{active, unacked, priority}` from three Alarm Metrics of the alarms path (`ActiveAckedCount` + `ActiveUnackedCount`, `ActiveUnackedCount`, `HighestActivePriority`); Ignition priority maps to the map's 1 (Critical, High), 2 (Medium), 3 (Low); Diagnostic never shows (DESIGN.md). The metric names are verified live and recorded in `docs/platform-checks.md`.
2. **Acknowledgement look.** Unacknowledged: a solid disc in the priority hue carrying the `alarm-N-unacknowledged` glyph; acknowledged: a hollow (outlined) disc carrying `alarm-N-acknowledged`; the priority digit beside the badge; the active count in the popup. Entry 12 takes it to ER-27 with the hue tokens.
3. **Stale rule.** A slot is stale when its quality is not Good (reason: the quality name, or "no value yet" before the first delivery), and every slot of an item is stale while its comms value is false or its comms slot is stale (reason "comms lost"). Comms lost is the comms value false or the comms slot stale; an item whose setup turns comms off never shows comms lost.
4. **Default popup and the spike prop.** The spike's `popupView` prop keeps precedence until entry 8 retires it (popup.spec.mjs keeps its coverage); with no prop, a kind whose setup turns a part on gets the default popup, else the text fallback. A new dev page `/live` (view `MapStudioLive`, no prop) is where this entry's e2e and screenshots run.
5. **Viewers get labels without paths.** A full `values.batch` carries `kindDisplay`, the path-free projection of every kind setup (comms on, KPIs with key, label, unit, icon and on, alarms count and summary, link), so a viewer draws the popup; `map.load.reply` does not change.
6. **Hue tokens for the tracer.** `comms-lost` is the CSS token `--mapstudio-comms-lost`, defined in the module stylesheet with the fallback `var(--qual-1)` (Perspective's purple-70 light, purple-60 dark; no colour literal); alarm priorities 1, 2, 3 fall back to `--error`, `--warning`, `--info` through `--mapstudio-alarm-1/2/3`. Entry 12 reviews them (ER-27).
7. **Dev stack.** `refreshIntervalSeconds` of the dev setup goes to the default 10 s; the Pad UDT's `Pressure` gains the dev-only alarm `High pressure` (above 900, priority High, manual acknowledgement; engineering review flag: test equipment, never for a real Gateway) so `[default]Mesa/P12/Alarm Metrics` aggregates it; a fresh volume (`ops/up.sh --fresh`) is needed once. The seed links the tracer's points to assets P12, P14 and P15 (P15 has no Comms or Pressure, so its paths report unresolved) and seeds the pad kind setup.
8. **Batches.** The first full batch goes right after `map.load.reply` (and after every `map.load`, which is also the reconnect path), then one changes-only batch per interval while something changed; a plan rebuild (link, kind setup or asset list change) makes the next batch full. While a popup is open, that item's changed values are pushed at most every 250 ms.
9. **The stand-in.** `e2e/lib/valueBatch.mjs`'s builder goes; the measures record the size of a real `values.batch` frame from the wire and `validateMeasures` accepts `measured` for it.

## Boundaries & Constraints

**Always:** one Gateway subscription per path per project whatever the number of open sessions or map items (AD-6), switched-off values never subscribed, Alarm Metrics by `TagManager.subscribeAsync` only (never `readAsync`); every colour from a theme token with a fallback to a Perspective variable, never a literal in code, CSS values or stored data (AD-11); comms lost always with its glyph and word; every state said in words in the popup; no tag path reaches a `none` session (unresolved reasons name no path); nothing writes a tag from module code; Jython 2.7 in every project script, no `import system`, `java.lang.Throwable` and `Exception` both caught; no em dashes; the message types live in `common/` and `docs/contract.md`, contract version 0.3.0.

**Never:** basemaps, labels thinning, style rules and presets, instruments, search, legend, the bottom sheet, the custom popup view by kind setup, the page link filled (its header slot only), the alarm summary in words (entry 8); a subscription per session; a change to `ign-scada-template`; a write to any Gateway but the local dev stack.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Plan from setups | pad setup comms `{asset.path}/Comms` on, KPIs pressure (icon) and flow on, gas `[default]Shared/GasPrice` off, alarms `{asset.path}`; p1 linked P12, p2 P14, p3 P15, Pad 1 unlinked | paths: P12 and P14 Comms, Pressure, Flow and three Alarm Metrics each; P15 Flow and its Alarm Metrics; nothing for gas; p3 reports comms and pressure unresolved ("the asset has no such tag" after a Bad_NotFound delivery); Pad 1 reports every asset-relative slot "no asset is linked" | a malformed stored setup is skipped with one warning |
| Full path | KPI `[default]Plant/Header/Pressure` on | one subscription serves every item of the kind | none |
| Override | item overrides `kpis[{key: pressure, path: [default]Plant/Header/Pressure}]` | that item's pressure slot reads the override's path; the kind's other items keep theirs | an override path that is not a full path is ignored with the slot unresolved |
| Change within an interval | Pressure of P12 written | p1's `kpi:pressure` in the next changes-only batch, the icon text updated within one interval | none |
| Alarm raised, acknowledged | Pressure above 900, then the alarm acknowledged | `alarms` `{active: 1, unacked: 1, priority: 1}` draws the solid badge and digit 1; after the acknowledgement `unacked: 0` draws the hollow badge | none |
| Comms lost | Comms of P12 written false | comms slot false, every slot of p1 stale with reason "comms lost"; the comms-lost glyph, the word and the token on the icon; the popup says Comms lost and marks every value Stale | none |
| Open and reconnect | a map sends `map.load` | a full batch with `kindDisplay` follows its reply | a batch to a closed session leaves the map's timer |
| Kind setup change | an editor saves the pad kind setup | the plan is rebuilt, subscriptions diffed, the next batch to every open map is full | none |
| Popup open | `popup.open {itemId}` then a value change | that item's batch within 250 ms; `popup.close` stops it | an unknown item id is answered `invalid` |
| Many sessions | three open maps of one project | the Gateway log shows one subscribe line per path, none per session | none |

</frozen-after-approval>

## Code Map

- `common/.../Messages.java`, `web/typescript/{contract,messages}.ts` -- the type list and `CONTRACT_VERSION`: add `values.batch`, `popup.open`, `popup.close`; bump to 0.3.0 (`scripts/ci/check-contract-versions.sh` ties the docs to it).
- `common/.../contract/LiveValue.java` (new), `KindDisplay.java` (new) -- the slot shape and the path-free projection of a kind setup; `KindSetup.java` is the schema (defaults: `on` true, `icon` false).
- `common/.../contract/{Placeholders,TagPaths}.java` -- `Placeholders.fill` resolves `{asset.path}/X` against an asset's base path; `TagPaths.parseFull` checks a full path. Reuse, do not change.
- `gateway/.../live/` (new): `ValuePlan` (pure: setups + items + assets to paths and per-item slots), `AlarmMetrics` (the metric names and the priority mapping), `LiveValueCache` (subscriptions, values, seq, listeners), `BatchSender` (per-delegate timer and popup push), `IgnitionTagSubscriber` and `TagSubscriber` (the `TagManager.subscribeAsync` seam, faked in tests).
- `gateway/.../MapStudioServices.java` -- wire the cache (tag manager, loader snapshot, adapters snapshot, change bus, setups) and its scheduler; `MapStudioDelegate.java` -- `popup.open`/`popup.close` on the event thread, the batch timer from `map.load.reply`, sends through the session queue as `map.changed` does.
- `gateway/.../change/ChangeBus.java` -- subscribe the cache per project so a link or kind setup change rebuilds the plan; `AdapterService.snapshot` -- the asset list (compared by identity at each tick).
- `gateway/.../load/MapLoader.java` -- `snapshot(project)` gives the items and kind setups the plan reads; `MapLoaderTest` shows the fakes.
- `web/typescript/live.ts` (new, pure) -- the batch reader, the per-item merge, the item state (comms lost, stale, alarm, icon KPI text), data age and value text; `theme.ts` -- `themeColor`; `icons` served at `/res/mapstudio/icons/mapstudio-icons.svg` (symbols `ms-<id>`).
- `web/typescript/markers.ts` (new) -- the image ids the symbol layers use and their canvas rasteriser from the sprite (`styleimagemissing`); `MapStudio.tsx` -- replace the circle layer with a symbol stack, apply batches, open the default popup, send `popup.open`/`popup.close`; `DefaultPopup.tsx` (new); `mapstudio.css` -- the tokens and the popup styles.
- `e2e/lib/valueBatch.mjs`, `e2e/lib/measures.mjs`, `e2e/tests/measures.spec.mjs`, `e2e/lib/lib.test.mjs` -- the stand-in and its rule.
- `ops/config/core/ignition/tag-type-definition/default/udts.json` -- the Pad UDT (alarm goes here); `ops/project/com.aoindustrial.perspective.mapstudio/setup/setup.json` -- the interval; `ops/project/ignition/script-python/mapstudio_seed/code.py` and `seed_harness.py` -- the seed (tracer `assetId`, the pad kind setup); new library `mapstudio_live/code.py` and view `MapStudioLive` with the `/live` page (`page-config/config.json`).
- `e2e/tests/live.spec.mjs` (new) -- the verify line on `/live`; `tracer.spec.mjs` and `popup.spec.mjs` keep the spike prop on `/`.
- `docs/contract.md`, `docs/kind-setup.md`, `docs/kinds-and-assets.md`, `docs/examples/adapters/*.py`, `CHANGELOG.md`, `docs/platform-checks.md`, `docs/icons.md` -- the 0.3.0 version lines, the new section, the evidence.

## Tasks & Acceptance

**Execution:**
- [ ] `common/` -- `Messages` 0.3.0 and the three types; `LiveValue`; `KindDisplay` with tests.
- [ ] `gateway/.../live/` -- the plan, the cache, the sender, the tag seam; unit tests with a fake subscriber for every matrix row that is pure.
- [ ] `gateway/.../MapStudioDelegate.java`, `MapStudioServices.java` -- the wiring, `popup.open`/`popup.close`, the batch timer; tests in `MapStudioDelegateTest`.
- [ ] `web/typescript/live.ts`, `markers.ts`, `DefaultPopup.tsx`, `MapStudio.tsx`, `messages.ts`, `contract.ts`, `mapstudio.css` -- the browser side; Jest tests for `live.ts` and the readers.
- [ ] `ops/` -- the alarm, the interval, the seed, `mapstudio_live`, the `/live` view and page.
- [ ] `e2e/` -- `live.spec.mjs`; the measures' real batch; `valueBatch.mjs` rewritten.
- [ ] `docs/`, `CHANGELOG.md` -- the contract section, the versions, the evidence, the screenshots.

**Acceptance Criteria:**
- Given the dev Gateway with the seeded kind setups and tags, when Pressure of P12 is toggled, then p1's icon KPI changes within one refresh interval.
- Given an alarm raised under P12's Alarm Metrics, when it is acknowledged, then the priority glyph and digit draw first solid, then hollow.
- Given Comms of P12 written false, then p1 draws the comms-lost glyph, the word and the `comms-lost` token, and its popup marks every value stale.
- Given a click on p1 on `/live`, then the popup opens in the order header, comms with data age, KPIs, alarms, and its KPI updates while open.
- Given three open sessions of the project, then the Gateway log shows one subscription line per path.
- Given the hand-off's check commands, then every one passes.

## Implementation Notes

(appended as the work goes)

## Plan Change Log

## Review Triage Log

## Design Notes

**Threads.** Tag listeners run on the tag system's threads and only write values into concurrent maps and bump a sequence; one daemon scheduler thread (`MapStudio-live`) rebuilds plans, runs each open map's interval timer and the popup pushes, and hands every envelope to the session's execution queue as the change bus does (docs/platform-checks.md, epic 2 story 4). No batch is built inside a tag callback.

**One subscription per path.** The cache keeps, per project, a map of full path to one listener; a plan rebuild subscribes the paths that are new and unsubscribes the ones gone, and logs one info line per path either way (`MapStudio.live`). Values are keyed by path, so two map items on one full path share one value.

**Batch body.** `{seq, full, items: [{id, comms?, kpis: {key: LiveValue}, alarms?, problems: [{slot, reason}]}], kindDisplay?: [...]}`; a slot the setup turns off is absent; `problems` carries unresolved paths with path-free reasons. `seq` is the cache's change counter at the time of the batch; the browser merges by item id and replaces everything on `full`.

**Marker stack (MapLibre).** One GeoJSON source with per-feature properties (`glyph`, `badge`, `digit`, `kpi`, `word`, `stale`), four layers: the disc and glyph image (`ms:glyph:<icon>:<state>`), the state badge image top-right (`ms:badge:<kind>:<look>`), the digit text beside the badge, the name and KPI text below. Images are rasterised from the sprite on `styleimagemissing` with the theme tokens read once from the component root.

## Verification

**Commands:**
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` -- expected: BUILD SUCCESSFUL, every Java and Jest test green.
- `cd web && npx tsc --noEmit && npx jest` -- expected: no type error, all tests pass.
- `ops/up.sh --fresh`, then `cd e2e && npm ci && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: every spec passes, `live.spec.mjs` included.
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK (contract 0.3.0).
- `grep -rnP '\xE2\x80\x94'` on every changed file -- expected: no match.

**Manual checks:**
- The Gateway log after three sessions open `/live`: one `subscribed` line per path, none repeated per session.
- Screenshots `docs/screenshots/mapstudio-live-{1440,390}.png` show the comms-lost token, the alarm badge and the default popup.
