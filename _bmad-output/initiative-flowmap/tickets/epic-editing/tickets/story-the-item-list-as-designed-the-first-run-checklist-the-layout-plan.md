---
title: "7a: The item list as designed (grouped by place, Sort by, Filter, the footer, Last changed)"
type: 'feature'
ticket: '7'
created: '2026-11-08'
status: 'in-review'
baseline_revision: '7613c87bd13da873fb6473b0f9b8198403dfa799'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md', '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The Edit-mode Items list is one flat list by name: on a field of 30 pads an editor cannot see what is where, what needs attention, what was just added or changed, or what is unlinked.

**Approach:** Decisions (owner, 2026-11-03: grouped by place from the linked asset's base path, Field-wide, Not linked, Just added; 2026-11-08: entry 7 split, this is 7a, then 7c the layout, then 7b the checklist; 2026-11-08, "Approved and continue" on the planner's five picks: the longest asset path prefix as the parent, field lines in Field-wide, Just added on top in every sort and cleared on reload, Add item arming the Point tool, other editors' changes as of the last load). The list as EXPERIENCE.md's Item list and DESIGN.md's list row, group header and filter chip describe it, with `changed {actor, at}` added to `map.load.reply` for the phone and full levels in contract 0.4.0. Checkboxes and Select all are entry 8; the layout and the collapse are 7c.

## Boundaries & Constraints

**Always:** **Place.** An item's place comes from its linked asset's base path (the provider prefix `[...]` dropped, split on `/`): the first segment is its field ("MESA FIELD" header). An item is the child of the item whose asset path is the longest proper prefix of its own, indented 26 px under it with "on P14" in secondary text (P14-2H well, P14 lateral); an item with no parent item is a site row if it is a point, and goes to its field's **Field-wide** sub-group if it is a line or an area (L-SWD, under `Mesa/Lines/`). Unlinked or vanished-asset items go to **Not linked** after every field. Items added in this session (the delegate notes each create, and drops it when the add is undone) head the list in **Just added**, newest first, whatever the sort; the page's reload clears it. **Sort by** (a select in the header, beside a **Filter** button): Needs attention (default): in each field the sites whose own or a child's state needs attention (alarm, comms lost, stale) first, ranked as Needs you ranks, the field header right side "4 NEED ATTENTION", then an "All normal" divider and the rest by name; Place: the same groups by name with no divider; Kind: flat under one header per kind; Name: flat A-Z (today's order); Last changed: flat, newest first, each row's second line "Sam - Today 10:42" (Today, Yesterday, else the browser locale's short date). **Filter** opens the kind chips ("All 11", "Well pad 3", each kind on the map with its count), one chosen at a time, filled `attention`; the button names the chosen kind; it filters every sort. **Search items** filters within the grouping; a matching child shows under its site row for context. **Footer:** **Add item** (arms the generic Point tool, as the toolbar's Point does) and "N unlinked" (shown when N > 0) filtering the list to Not linked, with a clear. Badges stay live; a row click does what it does today. **`changed`:** `map.load.reply` gains `changed: {<itemId>: {actor, at}}` at the phone and full levels (none for a viewer), each item's last edit from `mapstudio_edit` in one query per load, `at` ISO UTC to the second as `LastEdit` gives it; this session's own edits update it locally (the session user, now); documented in contract 0.4.0. Jest and Java tests for every rule; no em dashes.

**Never:** Checkboxes, Select all, range select (entry 8); the 1280 px collapse or layout (7c); the checklist (7b); a new message type or a store schema change; a query per item; change View mode, the toolbar or Details; weaken a test beyond the flat-order expectations this entry replaces.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Place | Seeded dev map, Edit mode | MESA FIELD with CTB1, SWD1, Point 1 (P12) and the other linked pads as sites; PT-1 and LV-1 under their parent if their asset path nests, else sites; L-SWD under Field-wide; the 30 scale pads and the fences under Not linked | No error expected |
| Attention | Point 1 in alarm | Point 1 first in MESA FIELD, "1 NEED ATTENTION", then All normal | No error expected |
| Just added | A pad placed with the Point tool | It heads Just added; undoing the add removes it | No error expected |
| Sort | Sort by Name, then Kind, then Last changed | A-Z flat; kind groups; newest first with "actor - when" | No error expected |
| Filter | Filter, Well pad | Only pads, in every sort; the button says Well pad | No error expected |
| Search | "swd" typed | SWD1 and L-SWD in their groups | No error expected |
| Footer | "30 unlinked" pressed | Only Not linked rows, a clear to return | No error expected |
| Add item | Add item pressed | The Point tool armed | No error expected |
| Reply | `map.load` as phone, full, viewer | `changed` for phone and full, absent for a viewer | No error expected |

</frozen-after-approval>

## Code Map

- `web/typescript/itemList.ts` -- `ListRow` 27-45 gains assetPath, area, changed; `listRows` 68-101 (flat by name, 99) becomes the row builder; new pure `groupRows(rows, sort, filter, query, justAdded)` returning headers and rows with depth; `filterRows` 108-115 reused. Ranking from `needsyou.ts` (header 1-9, `needsYou` 251) and `live.ts` `itemState` 573.
- `web/typescript/studio/ItemList.tsx` -- render 113-167: header (title row 124, `ProblemStatus` 128, search 130-143) gains Sort by (a native select like `PropertiesPanel.tsx` 588) and Filter with the chips; the `ul.mapstudio-list` 149-164 renders headers, the divider, indented children; a footer. Keep `.mapstudio-list-row`, `data-item-id`, `data-state`, `aria-current`: many specs use them.
- `web/typescript/MapStudio.tsx` -- `<ItemList>` mount 1342-1356 (`listRows(delegate.items, ...)`) passes assets (`delegate.lists.assets` with `basePath`), `changed`, Just added, `onAddItem` (the toolbar's generic Point tool); `onRowSelect` 917-934 unchanged.
- `web/typescript/MapStudioStoreDelegate.ts` -- `createPoint` 605 and `createLine` 478 note Just added; undo of an add drops it (`undoStack.ts` `UndoStep` 28-42); `changed` read from the reply and set on this session's saves.
- `web/typescript/contract.ts` -- `MapLoadReplyBody` 117-137 (`user?` is the precedent), `readMapLoadReply` 209.
- `web/typescript/mapstudio.css` -- list 2692-2871: group header (section-label, text-secondary), divider, child indent 26 px, chips (26 px, radius full), footer.
- Gateway: `gateway/.../load/MapLoader.java` `mapLoadReply` 100-133 (editors get extras; copy the `withUser` pattern in `MapStudioDelegate.java` 463-474 or add in the loader for phone and full); `store/MapStore.java` `LastEdit` 39 and `Tx.lastEdit` 67; `JdbcMapStore.java` 218-237 (one query per entity today): a new `Tx.lastEdits(project)` (latest `actor`, `at` per item from `mapstudio_edit`, the index `mapstudio_edit_project_entity` from `0002`). `MapLoaderTest.java` (60, 94, 173, 191) gains the level cases; a store test for `lastEdits`.
- Tests: `itemList.test.ts` 38 (flat order, replaced), `shortcuts.test.ts` 165 (new props); e2e `studio.spec.mjs` 190-192, 312, 346, 405-407, 715 `listIds`, 886-992 (order-relative search tests; keep them passing), new `itemlist.spec.mjs` at 1440 and 1366 px.
- Dev data: `mapstudio_dev/code.py` ASSETS 54-67 (flat `[default]Mesa/<site>`, `Mesa/Lines/`), `mapstudio_seed/code.py` (scale pads unlinked 252-255, tracer points linked 119-122, SWD set 166-171). Add one nested asset (`[default]Mesa/P14/P14-2H`) and a seeded item linked to it, so a child shows; update the dev docs' seed notes.
- Docs: `docs/contract.md` messages row 14, the `user` note 218 (add `changed`), line 3; `CHANGELOG.md` 0.4.0; `docs/test-playbook-0.4.0.md` a section "The item list".

## Tasks & Acceptance

**Execution:**
- [x] Gateway `lastEdits`, `MapLoader` `changed`, Java tests -- the reply.
- [x] `contract.ts`, the delegate's `changed` and Just added, Jest.
- [x] `itemList.ts` grouping and sorts, Jest for every Boundaries rule.
- [x] `ItemList.tsx`, `MapStudio.tsx`, CSS -- header, chips, groups, footer.
- [x] Dev seed nested asset; e2e `itemlist.spec.mjs` and the changed specs.
- [x] Docs, CHANGELOG, the playbook section.

**Acceptance Criteria:**
- Given the seeded dev map as `mapeditor` at 1440 and 1366 px, when the matrix runs, then each row holds.
- Given a fresh dev stack, when the whole e2e suite runs, then every spec passes (the review 390 px flake may fail once and pass rerun alone).

## Implementation Notes

- Planner, 2026-11-08: the environment, commit and identity rules are entry 16's plan's (Docker by hand after a restart, JDK 17 by apt if gone, `ops/up.sh --fresh` before a whole-suite run, the session's trailers, `git commit --only`, no em dashes, no model identifier, never a bare `git stash`, never a push). Commit at each working milestone.

- Approval (owner, 2026-11-08): "Approved and continue" with the five picks, written into the Approach; the plan, over size, kept whole.

- Build, 2026-11-08: the dev child is `P14 lease`, a geofence linked to the new dev asset `P14L` at `[default]Mesa/P14/Lease`, not a well at `Mesa/P14/P14-2H`: the dev tag provider cannot hold a folder inside the P14 UDT instance, so a pad or well there would read comms lost and change every Needs you count the specs check; a geofence reads no tag. The seed is 75 items and the dev asset list 11 (seed harness, scale, adapters and details specs follow). The kind chips are `.mapstudio-kind-chip` (`.mapstudio-chip` is the map's status chip). ignition-lint was not run: installing it was refused in this session (the two dev scripts parse, and the seed runs under Jython in `DevSeedTest`).
- Verified, 2026-11-08: tsc clean, Jest 636 passed in 62 suites; `./gradlew build --offline` green (MapLoaderTest 11, LastEditsTest 2, DevSeedTest 9); the contract check OK at 0.4.0; on a fresh stack the whole e2e suite 235 passed, 7 skipped, 1 failed (`events.spec.mjs` "before the items load", the zoom read during the back navigation's reconnect, 13 for 15; the page does not use the list), which passed with its file rerun alone (9 of 9); `itemlist.spec.mjs` 16 of 16 at 1440 and 1366 px.

## Plan Change Log

- 2026-11-08, review fixes: the divider follows the sites needing attention; parents are worked out from every row, a filtered-out or just-added parent shown as context over its children; a saved create (Redo of an undone add) rejoins Just added; docs/kinds-and-assets.md names eleven dev assets.
- 2026-11-08, second review fix: a parent in Just added is not shown again as a context row (one row per item id, studio.spec's P31 linked to P14); its children keep their indent and "on <parent>" line.

## Review Triage Log

Quick lens, 2026-11-08: 6 findings; high 0, medium 2, low 3, false 1.

| Finding | Verdict | Evidence | Route |
| --- | --- | --- | --- |
| With only a Field-wide row needing attention, "All normal" heads the field with nothing above it | medium | `groupRows`: `needing` counts `f.sites.concat(f.wide)`, `divided` starts false, the first normal site pushes the divider | patch: the divider follows the sites that need attention |
| The parent tree is built after the kind filter, the unlinked filter and the Just added removal | medium | `parentsOf(rows)` runs on the filtered rows; under Filter Geofence "P14 lease" loses Point 2 and lands in Field-wide | patch: parents from all rows, a filtered-out parent shown as context |
| Without the asset list every linked item lands in Not linked and the footer count, while its badge stays normal | low | `assetPath` null when `lists.assets` lacks the asset, `vanished` false when `assetsKnown` is false | rejected: met only when the adapter's asset list fails for an editor, which the tools already report (entry 5); the fix adds a group for places unknown |
| Redo of an undone add does not return the item to Just added | low | Undo sends `delete` (dropped by `noteSaved`), Redo a `create` that only `createPoint`/`createLine` would note | patch: every saved create of this session noted |
| `docs/kinds-and-assets.md:124` still names ten dev assets | low | The seed adds `P14L`; specs expect 11 | patch: eleven named |
| ignition-lint not run on the two dev scripts | false | Run by the orchestrator: `mapstudio_dev/code.py` and `mapstudio_seed/code.py` "No issues found" | rejected |

## Design Notes

The parent rule (longest asset path prefix among the map's items) needs no new setup field and reads the asset tree the project already has; a field's lines linked under a folder such as `Mesa/Lines/` have no parent item, so they land in Field-wide as the mock shows L-SWD.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL.
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK at 0.4.0.
- `ignition-lint --files` on changed dev scripts -- expected: zero errors and warnings.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: green (the review 390 px flake may fail once; rerun it alone).
