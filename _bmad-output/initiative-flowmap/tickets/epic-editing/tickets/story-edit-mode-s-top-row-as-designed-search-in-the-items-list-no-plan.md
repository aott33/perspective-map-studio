---
title: "Edit mode's top row as designed: search in the Items list, no Needs you over the map, the toolbar beside the Editing switch"
type: 'feature'
ticket: '21'
created: '2026-11-05'
status: 'built'
baseline_revision: 'fb9ea5ef9723d114a881b03a75baa34a4e525e5d'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md', '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** In Edit mode the View-mode search field and the Needs you bar stay over the map and push the draw toolbar and its pill onto a second row: two rows of chrome the owner found cluttered after entry 4. DESIGN.md's Edit mode (Direction A, key screen 4) has neither over the map, the search in the Items list, and the toolbar on the top row beside the Editing switch.

**Approach:** While the studio shows, hide the View-mode top bar (search and Needs you), give the list panel a Search items field under its header that filters its rows, and move the toolbar, its pill and the connection chip up to the top row. View mode and phone widths keep everything as today.

## Boundaries & Constraints

**Always:** Decision (owner, 2026-11-05): option B of the layout review, the design as written. The View-mode search and Needs you are unchanged in View mode and below 768 px (which keep View mode); leaving Edit mode shows them again with their lists closed. The list's search filters the rows the list shows, in their order, by name, kind name or linked asset name, compared as `search.ts` `fold` compares (case and accents aside), and says "No matches" when none match. Choosing a filtered row is exactly a row click. The toolbar is clear of the Editing switch and the zoom card at 1366 and 1440 px with the properties panel docked. Colours from theme tokens; no em dashes. Every existing spec keeps its expectation.

**Never:** Change the Gateway, `common/`, a message, a prop or the contract version. Build the grouping, Sort by, the Filter chips, the footer or the collapse below 1280 px (entry 7). Remove the search or Needs you control from the map (View mode uses them). Move or hide the Legend button (owner: it stays until decided). Add a dependency. Delete a test or weaken its expectation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Top row | Edit mode at 1366 px, properties docked | No search field or Needs you bar; the toolbar level with the Editing switch and apart from it; the pill, then the connection chip, under it | No error expected |
| Leave Edit mode | The switch turned off | The search field and Needs you bar show again, their lists closed | No error expected |
| A list open on entry | The search's or Needs you's list open, then the switch on | The list closes; nothing comes back open on leaving | No error expected |
| Search items | "swd" typed | Only rows whose name, kind name or linked asset name holds it, in list order | "No matches" with none |
| Esc or Clear | The field holding text | The text empties and every row is back; the selection stays | No error expected |
| Pick a filtered row | A click on it | Selects, pans and opens Details, as any row does | No error expected |
| Phone | 390 px | View mode's top bar as today | No error expected |

</frozen-after-approval>

## Code Map

- `web/typescript/mapstudio.css` -- `.mapstudio-toolbar-float` (2817, `top` under the top bar since entry 4) and `.mapstudio--editing .mapstudio-connection` (2839). The root carries `mapstudio--editing` exactly while `studioOn()`, so a rule under it hides `.mapstudio-topbar`, the search control's container that also holds the Needs you bar (`viewControls.ts` 55-75). `.mapstudio-dock-header` and `.mapstudio-input` give the field's look.
- `web/typescript/studio/ItemList.tsx` -- header (title, Undo, Redo, save status), empty state, `.mapstudio-list` (`data-rows`) of row buttons calling `onSelect`.
- `web/typescript/itemList.ts` -- `ListRow`, `listRows`; the filter goes here, pure, with `search.ts` `fold` and `NO_MATCHES`; asset names from `delegate.lists.assetNames`, read as `search.ts` `buildEntries` reads them. Tests in `__tests__/itemList.test.ts`.
- `web/typescript/MapStudio.tsx` -- `<ItemList>` (1046), `onRowSelect` (804, reused), `setEditMode` (485), `searchControl.close()`, `needsYouControl.close(false)`.
- e2e: only `drawing.spec.mjs` (about 290-300) uses the View search in Edit mode. The search, Needs you and connection specs run on View pages (`/live`, `/`, `/dark`, the showcase project); their `/edit` opens only clear strays. `studio.spec.mjs` and `drawing.spec.mjs` write the Edit-mode renders under `E2E_DOCS=1`.
- Docs: `docs/contract.md` Drawing paragraph (the toolbar "on the row under the View-mode top bar"), its Search and Needs you paragraphs, the studio's test hooks; `CHANGELOG.md` 0.4.0.

## Tasks & Acceptance

**Execution:**
- [x] `web/typescript/mapstudio.css` -- the top bar hidden under `.mapstudio--editing`; the toolbar at the map inset; the chip under the pill; the field's style from tokens.
- [x] `web/typescript/itemList.ts` + `__tests__/itemList.test.ts` -- `ListRow` gains the asset name; a pure row filter (name, kind name, asset name; order kept; empty query keeps all), tested for case and accents, each field and no match.
- [x] `web/typescript/studio/ItemList.tsx` -- the field under the header (search glyph, "Search items", an accessible name, Clear while it holds text, Esc empties it and goes no further), rows filtered, "No matches"; `data-rows` counts the rows shown.
- [x] `web/typescript/MapStudio.tsx` -- asset names to the rows; entering Edit mode closes the View search's and Needs you's lists.
- [x] `e2e/tests/studio.spec.mjs` -- the matrix at 1366 and 1440 px as the map editor with properties docked (boxes for the toolbar, the switch and the zoom card); `drawing.spec.mjs` -- its field step types in the list's field.
- [x] `docs/contract.md`, `CHANGELOG.md` -- the top row, the hidden top bar, the list's search and its hooks; `E2E_DOCS=1` runs of the two specs rewrite the Edit-mode renders.

**Acceptance Criteria:**
- Given the dev Gateway as `mapeditor` at 1366 and 1440 px, when the matrix runs in `studio.spec.mjs`, then each row holds.
- Given the whole e2e suite on a fresh dev stack, when it runs, then every spec passes with its expectations kept.

## Implementation Notes

- Approval (owner, 2026-11-05): "B", in answer to "say B and I write the entry and start it now", taken as the plan's approval; the plan builds render B of the contact sheet as DESIGN.md draws it.
- Planner, 2026-11-05: the environment, commit and identity rules are entry 4's plan's (Docker started by hand after a restart, `ops/up.sh --fresh` before a whole-suite run, the two trailer lines, no em dashes, no model identifier, never a bare `git stash`, never a push).

## Plan Change Log

- 2026-11-05 (implementer): no change to the frozen intent. Readings and small additions, for the reviewer:
  - The View-mode lists close as the studio comes on, whatever brought it (`MapStudio.tsx` `applyTopBar` in `componentDidUpdate`, comparing `studioOn()` with its last value), not in `setEditMode` alone: the page's `editMode` write and the level arriving reach the same rule. `openedBy` is cleared with them, so Esc on a popup the View search opened before Edit mode never hands the focus to the hidden field. The search keeps its text (`SearchControl.close`), its list closed.
  - `web/typescript/camera.ts` (not in the Code Map, one line): the camera padding takes the toolbar's float (the toolbar and its pill) where the top-left corner is empty, so a row pick in Edit mode still centres below the top row, as it centred below the top bar before; View mode reads the top bar as before.
  - The field sits inside the list header after the title row (and after a save problem's row), the header's rule under it, as key screen 4 draws it. Esc with text empties it and stops there; Esc in the empty field goes on to the root and closes Details as before (EXPERIENCE.md Properties panel). The text is `ItemList`'s own state, so it starts empty whenever the list mounts (entering Edit mode, the rail's Items after Kinds or Layers).
  - The matrix's chip row simulates a lost connection with the client's own `__client.simulateLostConnection` (as `connection.spec.mjs` does, its "Simulated disconnect" console errors filtered for that test only). The "list open on entry" row presses the switch from a script for the search's list, since a real click blurs the field and closes the list on its own; the Needs you list is closed by the real click's path.
  - Measured on the dev stack with the properties panel docked: the toolbar is 348 px wide and ends 48 px before the Editing switch at 1366 px (718 px of map), 63 px at 1440 px (748 px); the chip's top is the inset plus the toolbar, the gap and the pill, plus 10 px. `drawing.spec.mjs`'s ground spots stay where entry 4 moved them (still under the toolbar and its pill); its field step types in the list's field. `docs/platform-checks.md`'s entry 4 row on the toolbar's row points at the new contract paragraph, and `docs/architecture.md`'s module table names the list's search.
  - After the first whole-suite run (a follow-up commit): as the studio comes on, an element of the hidden top bar holding the focus gives it up, so a key typed after the page's prop turned Edit mode on cannot open a list behind the bar (the spec types one and sees nothing open); the field is 36 px tall so its Clear keeps the 32 px mouse target (DESIGN.md target-mouse), which the spec checks.
- 2026-11-05 (implementer, verification): `tsc --noEmit` clean and 351 Jest tests green; `./gradlew clean build --offline` BUILD SUCCESSFUL; `check-contract-versions.sh` OK at 0.4.0. Whole suite on a fresh dev stack at commit 9584995: 135 passed, 7 skipped, 1 failed, the review 390 px light-theme test with "No Connection to Gateway" (the known flake), which passed rerun alone. After the follow-up (commit b148a6b), `ops/up.sh --fresh` and the whole suite again: 136 passed, 7 skipped, 0 failed in 26.7 min. `E2E_DOCS=1` runs of `studio.spec.mjs` and `drawing.spec.mjs` (18 passed) rewrote the Edit-mode renders. Left for the owner: comparing the renders with key screen 4.

## Review Triage Log

Quick lens, 2026-11-05: 6 findings; high 0, medium 2, low 4, false 0, maybe-false 0.

| Finding | Verdict | Evidence | Route |
| --- | --- | --- | --- |
| Below about 1280 px with Details docked the toolbar on the top row covers the Editing switch (`mapstudio.css` `.mapstudio-toolbar-float` at the map inset) | medium | Below 1440 px the rail, list and panel are fixed widths (648 px), so the map is 376 px at 1024 px; the 348 px toolbar centred there spans the switch, both at z-index 6 with the toolbar later in the DOM. Entry 4's second row cleared it. DESIGN.md gives those widths the list collapse, which is entry 7's and not built | patch: below 1280 px the toolbar keeps entry 4's row under the switch until entry 7's collapse, with a 1200 px check |
| Hiding the Needs you bar in Edit mode changes alarm presentation and is not flagged for ER-27 (CLAUDE.md alarm changes; handoff-epic-4.md: ER-27 review of alarm presentation is the owner's) | medium | `epic-editing.md` names only the marker and the distance rows for ER-27; neither the CHANGELOG nor the contract paragraph flags the hidden summary. The editor still sees the states as list badges and markers; View mode is unchanged | patch: flagged in the CHANGELOG, the contract paragraph and `docs/review-er27.md`'s record for the owner's ER-27 review |
| The stylesheet's top bar rule has no 768 px guard, so a window shrunk below 768 px in Edit mode loses View mode's bar until the next update (`mapstudio.css`) | low | `phoneWidth()` is read only on a render; the ResizeObserver calls no setState; the 767 px block already hides the studio for that stale window, and the new rule adds the bar to what vanishes | patch: the rule scoped to 768 px and wider |
| The drawing spec's field step no longer exercises the map container's field guard (`editing.ts` `inField`), which has no unit test | low | The list's field is in the dock, outside `.mapstudio-map`, so its keys reach neither the capture listener nor Terra Draw's canvas; the step passes with the guard deleted; the guard's comments still name the search field | patch: the guard unit tested where it can be, its comments corrected |
| "No matches" is a `role="status"` element created already holding its text, which many screen readers do not announce (`ItemList.tsx`) | low | The region mounts with the text in the same commit; the View search uses a persistent region (`.mapstudio-search-status`) | patch: a region always mounted, only its text changing |
| `docs/platform-checks.md` "The toolbar's row" cites entry 4's renders for entry 21's 48 px figure | low | The evidence cell still reads "(the renders above)" | patch: cite `studio.spec.mjs` and the `mapstudio-studio-top-row-*.png` renders |

After the patches (coordinator, 2026-11-05): the six patches verified on the patched tree: `tsc` clean, 353 Jest tests green, Gradle build green offline, the contract check OK at 0.4.0, no em dashes, and the whole e2e suite on a fresh dev stack 137 passed, 7 skipped, 0 failed in 28.8 min. Nothing deferred.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` -- expected: BUILD SUCCESSFUL.
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK at 0.4.0.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: green (the review 390 px flake may fail once; rerun it alone).

**Manual checks (if no CLI):**
- The owner compares the rewritten Edit-mode renders with key screen 4.
