---
title: "The item form: kind fields, required marks, prefill, duplicate names, unknown kinds and the asset list's status"
type: 'feature'
ticket: '6'
created: '2026-11-06'
status: 'in-review'
baseline_revision: '3a971b7b6f9573f6eb48fded79b56e1aee04f360'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md', '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Details shows only Name, Kind, Location and Asset: the kind's own fields (a pad's Operator, Wells, Status) cannot be filled in the studio, nothing says a required field is missing, every new item starts blank, two items with one name on different assets pass unnoticed, a kind or asset that left its list shows as a raw id, and the asset list's status is hidden.

**Approach:** Decisions (owner, 2026-11-03 refinement, R3 and R12; 2026-11-06 "Split, and A": the place check is entry 27). Details shows the kind's fields typed per the kind list, saved as each is finished; required ones are marked and the missing ones named in words, never blocking a save; a new item takes the last values per kind; duplicates, unknown kinds, vanished assets and the asset list's status are said in words.

## Boundaries & Constraints

**Always:** Fields follow the kind list's order and types (`adapters.ts` `FormField`): text and number inputs saved on blur or Enter (Esc puts the record's value back), integer and number inputs refusing what is not one in words beside the field ("Wells takes a whole number") and not saved; a boolean a checkbox and a choice a select with an empty "Not set" first, both saved on change. A save is one `update` with the whole `properties` object, the changed key merged, one undo step "edit <name>". A required field shows "Required" by its label and, while empty, a line at Details' top names every missing one ("Missing: Status"); the item still saves what it has. The last finished value of each field is kept per project and kind in localStorage; a new item of that kind (the Point tool, a kind button, a generic tool, a line or an area) is created with those values; name, location and link are never prefilled. A kind change keeps the values the new kind defines and drops the rest in the same update (the Gateway refuses an unknown key); Undo brings them back. Another live item with the same name, ignoring case and outer spaces, linked to a different asset underlines Name in the `error` token with a tooltip and accessible description naming it ("Also the name of the item linked to Mesa/P15"); never a refusal. An item whose kind is not in the kind list shows "Unknown kind" with "<id> is no longer in the kind list; its values are kept" and its stored values read only, only Kind editable; one whose asset is not in the asset list shows "Not linked: <id> is no longer in the asset list", keeps its stored link and counts as unlinked in the list. When the asset list's status is `empty`, `incomplete`, `failing`, `slow` or `not-configured`, its message shows under Asset. A refused save shows on the save status row. Level `full`, 768 px and wider; paused with the store; colours from theme tokens; no em dashes.

**Never:** The place line, swapped values or Zoom to location (entry 27). Change the Gateway, `common/`, a message, a prop or the contract version; the Gateway's typing (`ItemCheck`) stays the rule the browser follows. A toast, a confirmation, or a save button. Delete a test or weaken its expectation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Required | A pad with Status not set | "Required" by Status; "Missing: Status"; Operator typed and finished saves | No error expected |
| Typed | Wells "abc", then "3" | "Wells takes a whole number", not saved; 3 saved as a number | A Gateway refusal on the save status row |
| Choice, boolean | Status "shut in"; a line's Buried ticked | Each saved at once, one undo step | As above |
| Prefill | Operator "Acme" finished on a pad, then a new pad placed | The new pad has Operator Acme, its name "Well pad", no link | No error expected |
| Kind change | A tap with Tag set changed to Valve | Tag kept if Valve defines it, others dropped; Undo restores | As above |
| Duplicate | A second item named P14, linked to another asset | Name underlined with the tooltip; the save goes through | No error expected |
| Unknown kind, vanished asset | An item of kind `tank`; one linked to P99 | "Unknown kind" with values read only; "Not linked: P99 is no longer in the asset list", counted unlinked | No error expected |
| Asset list status | The dev adapter `empty`, then `incomplete` | Its message under Asset | No error expected |

</frozen-after-approval>

## Code Map

- `web/typescript/studio/PropertiesPanel.tsx` -- Details today: Name, Kind (255, "(not in the kind list)"), Location (Move, Latitude, Longitude), Asset (300, "(not in the asset list)", hint 309); drafts `{name, lat, lng}` (93, `draftsOf` 100) kept while touched (`componentDidUpdate` 127); `onKey` (187) Enter blurs, Esc reverts; `readCoordinate` (110). The field rows go between Kind and Location; extend the drafts to field keys. Do not change the footer delete (`deleteButton` 30) or Move, pending and paused.
- `web/typescript/adapters.ts` -- `FormField {key, label, type, required, choices}` (16), `FIELD_TYPES` (68), `Kind` (24); `readAdapterStatus` (129) and the seven status words (10); `delegate.lists.adapters.assets`, `lists.assets` (editors), `lists.assetNames` (every level).
- `common/.../contract/ItemCheck.java` (41) -- the typing the browser mirrors: a choice must be in its list, number and integer stored as numbers, an unknown key refused; `required` is not enforced (FormField.java). Read only.
- `web/typescript/MapStudioStoreDelegate.ts` -- `renameItem` (574), `setKind` (795, sends `{kind}` alone today: give it the kept properties), `sendUpdate` (803); a new public method for properties beside `renameItem`. `createPoint` (567), `createLine` (449) call `save.ts` `pointCreateBatch` (52) and `lineCreateBatch` (28): they gain the prefilled properties.
- `web/typescript/MapStudio.tsx` -- `renderPanel` (1231) passes the panel's props (`assets` is editors only; use `assetNames` to tell a vanished asset); `onRename`, `onKind` (896-980); `renderAdapterStatus` (1010) stays as the e2e's hidden attributes.
- `web/typescript/itemList.ts` (16-75) and `studio/ItemList.tsx` (67) -- the unlinked badge counts `assetId === null` only; a vanished asset counts too.
- Storage: follow `place.ts` (`PlaceStore` 31, try-guarded reads and writes, an injected store in `__tests__/place.test.ts`); key per project and kind.
- Pure helpers (field parsing, missing required, duplicates, prefill) in a new `.ts` with Jest tests; no `PropertiesPanel` Jest exists.
- e2e: a new `details.spec.mjs` beside `studio.spec.mjs` (`openEditor` 130, `placePad` 477, `storedItem` 472) and `geometry.spec.mjs`; selectors `.mapstudio-field-*`; the dev kinds in `ops/project/ignition/script-python/mapstudio_dev/code.py` 26-45 (pad: operator text, wells integer, status choice required; line: diameter number, buried boolean; geofence: operator; tap and valve: tag); the adapter modes through the dev `/adapters` view (`adapters.spec.mjs` 24-58); the spec restores the seed after itself.
- CSS: `mapstudio.css` 2760, the properties panel section.
- Docs: `docs/contract.md` (the studio's behaviour), `docs/kinds-and-assets.md` (fields as the form shows them; required in the browser only), `CHANGELOG.md` 0.4.0.

## Tasks & Acceptance

**Execution:**
- [x] A helper module and Jest tests -- field values parsed and checked as `ItemCheck` does, the missing required, duplicate names, the prefill store -- the rules in one tested place.
- [x] `web/typescript/MapStudioStoreDelegate.ts`, `save.ts` -- properties saved as one update; creates take the prefill; a kind change keeps the new kind's values -- one save path for the form.
- [x] `web/typescript/studio/PropertiesPanel.tsx`, `MapStudio.tsx`, `mapstudio.css` -- the field rows, Required and Missing, the duplicate underline, Unknown kind, the vanished asset, the asset list's status -- the form as the matrix says.
- [x] `web/typescript/itemList.ts` -- a vanished asset counts as unlinked.
- [x] `e2e/tests/details.spec.mjs` -- the matrix at 1366 px as `mapeditor`; a render of Details under `E2E_DOCS=1`.
- [x] `docs/contract.md`, `docs/kinds-and-assets.md`, `CHANGELOG.md`.

**Acceptance Criteria:**
- Given the dev Gateway as `mapeditor` at 1366 px, when the matrix runs, then each row holds.
- Given the whole e2e suite on a fresh dev stack, when it runs, then every spec passes.

## Implementation Notes

- Approval (owner, 2026-11-06): "Keep full plan, approve and continue" (the plan about 2,400 tokens, kept whole); it went ready-for-dev and implementation started in this session.
- Implementation, 2026-11-07: verified as the Verification section says. `npx tsc --noEmit` clean and `npx jest` 51 suites, 496 tests passed (new: `itemForm.test.ts`, `itemFormSave.test.ts`, `itemPanel.test.ts`; added cases in `itemList.test.ts` and `save.test.ts`); `./gradlew clean build --offline` BUILD SUCCESSFUL; `check-contract-versions.sh` OK at 0.4.0; `ops/up.sh --fresh` then the whole e2e suite: 187 passed, 7 skipped (the opt-in ones), none failed, `details.spec.mjs` 8 of 8 among them; the spec alone again after its latitude Esc check, 8 passed. Not run: the quick review (`lenses_ran` empty), and the owner's look at the renders.
- Planner, 2026-11-06: the environment, commit and identity rules are entry 4's plan's (Docker started by hand after a container restart, `ops/up.sh --fresh` before a whole-suite run with nothing else against the stack, the two trailer lines from the session's attribution reminder, `git commit --only` your paths, no em dashes, no model identifier, never a bare `git stash`, never a push). Commit at each working milestone. A layout that departs from DESIGN.md's Properties panel is rendered for the owner before it is built (owner's rule, 2026-11-05).

## Plan Change Log

- 2026-11-06, implementation: the kind fields sit after Location and before Asset, not between Kind and Location as the Code Map said. DESIGN.md's Properties panel and EXPERIENCE.md's both order Details as name, kind, location, kind fields, asset link, and this plan's own note says a layout that departs from DESIGN.md's Properties panel is rendered for the owner before it is built; the spines' order needs no such render. Entry 27's place line stays in Location.
- 2026-11-06, implementation: the Gateway refuses any save of an item whose kind is not in the kind list, so the e2e cannot make "an item of kind `tank`" with the dev kinds as they were. The dev adapter (test equipment, `ops/project/.../mapstudio_dev/code.py`) gains the mode `tank`, which adds a point kind `tank` with one number field, and the `/adapters` page its button; the spec makes the item in that mode and switches back to `ok`. Nothing of the Gateway, `common/`, a message, a prop or the contract changes. An item linked to P99 needs no mode: the Gateway does not check an asset id.
- 2026-11-06, implementation: the duplicate's words name the other item's asset by its name, as the header's subline does ("Also the name of the item linked to Pad 14"), since `assetNames` carries names, not base paths; an unlinked item counts as on a different asset from a linked one, two unlinked items do not. An unknown kind also turns Name, Location, Move and Asset off (the Gateway refuses any change but the kind), the footer's delete as it was.
- 2026-11-06, implementation: a PropertiesPanel render test already existed (`__tests__/shortcuts.test.ts`); its props helper takes the new props, no expectation changed. The Esc of Name, Latitude and Longitude saved what was typed on the blur it makes (React batches the reset, so the blur read the draft); fixed with the kind fields' Esc, and the Name field now shows the name as saved, outer spaces aside.

## Review Triage Log

Quick lens, 2026-11-07: 6 findings; high 0, medium 3, low 3.

| Finding | Verdict | Evidence | Route |
| --- | --- | --- | --- |
| Every item reads "Unknown kind ... is no longer in the kind list" while the kind list is loading, not configured, failing or slow with none kept | medium | `MapStudio.tsx` 1253 finds the kind in an empty `lists.kinds`; the panel (432) has no guard like the asset side's `assetListKnown` | patch: "Unknown kind" only when the kind list is known; otherwise the kind list's status message, inputs off as the Gateway refuses saves then |
| A refused or dropped save leaves a kind field showing a value that is not stored, with nothing marked | medium | `commitField` and `chooseField` write the sent value into the draft; `componentDidUpdate` (188-201) keeps a draft equal to neither record value | patch: when the item's save settles, a draft the record does not hold goes back to the record's value |
| A field save resends keys the kind no longer defines (or a choice no longer listed), which the Gateway refuses, and Details cannot clear them | medium | `editProperty` (604) merges onto `propertiesFor` unfiltered; `ItemCheck.check` throws on an unknown key or an unlisted choice | patch: the merged properties pass through `keptProperties` with the item's kind, as a kind change does |
| Changing a field and changing it back before the reply loses the second change | low | `sameValue` (307, 333) compares with the stored record, not the value in flight; the delegate's `propertiesFor` knows the in-flight value | patch: compare with the value in flight, so a change back is sent |
| The duplicate-name words name the asset ("Pad 14"), not its folder as the frozen plan says ("Mesa/P15") | low | `itemForm.ts` 169 reads `assetNames`; at level `full` `lists.assets` carries `basePath` | patch: the words name the other asset's base path without its provider, as the plan's Always says |
| No ignition-lint result for the changed dev view and script (the session's CLAUDE.md) | low | The plan recorded tsc, Jest, Gradle, the contract check and e2e only | resolved by the orchestrator: ignition-lint-toolkit on both files, 0 errors and 0 warnings; the view's 12 naming hints are advisory and the same as at the baseline (11 there, the new `mode_tank` following the view's own names); `code.py` no issues; both ran live in the e2e |

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` -- expected: BUILD SUCCESSFUL.
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK at 0.4.0.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: green (the review 390 px flake may fail once; rerun it alone).
