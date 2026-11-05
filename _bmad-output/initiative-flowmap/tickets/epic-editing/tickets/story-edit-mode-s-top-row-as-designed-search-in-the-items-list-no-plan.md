---
title: "Edit mode's top row as designed: search in the Items list, no Needs you over the map, the toolbar beside the Editing switch"
type: 'feature'
ticket: '21'
created: '2026-11-05'
status: 'in-progress'
baseline_revision: 'fb9ea5ef9723d114a881b03a75baa34a4e525e5d'
route: 'full'
route_source: 'auto'
risk: 'low'
review: ''
review_source: ''
lenses_ran: []
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
- [ ] `web/typescript/mapstudio.css` -- the top bar hidden under `.mapstudio--editing`; the toolbar at the map inset; the chip under the pill; the field's style from tokens.
- [ ] `web/typescript/itemList.ts` + `__tests__/itemList.test.ts` -- `ListRow` gains the asset name; a pure row filter (name, kind name, asset name; order kept; empty query keeps all), tested for case and accents, each field and no match.
- [ ] `web/typescript/studio/ItemList.tsx` -- the field under the header (search glyph, "Search items", an accessible name, Clear while it holds text, Esc empties it and goes no further), rows filtered, "No matches"; `data-rows` counts the rows shown.
- [ ] `web/typescript/MapStudio.tsx` -- asset names to the rows; entering Edit mode closes the View search's and Needs you's lists.
- [ ] `e2e/tests/studio.spec.mjs` -- the matrix at 1366 and 1440 px as the map editor with properties docked (boxes for the toolbar, the switch and the zoom card); `drawing.spec.mjs` -- its field step types in the list's field.
- [ ] `docs/contract.md`, `CHANGELOG.md` -- the top row, the hidden top bar, the list's search and its hooks; `E2E_DOCS=1` runs of the two specs rewrite the Edit-mode renders.

**Acceptance Criteria:**
- Given the dev Gateway as `mapeditor` at 1366 and 1440 px, when the matrix runs in `studio.spec.mjs`, then each row holds.
- Given the whole e2e suite on a fresh dev stack, when it runs, then every spec passes with its expectations kept.

## Implementation Notes

- Approval (owner, 2026-11-05): "B", in answer to "say B and I write the entry and start it now", taken as the plan's approval; the plan builds render B of the contact sheet as DESIGN.md draws it.
- Planner, 2026-11-05: the environment, commit and identity rules are entry 4's plan's (Docker started by hand after a restart, `ops/up.sh --fresh` before a whole-suite run, the two trailer lines, no em dashes, no model identifier, never a bare `git stash`, never a push).

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` -- expected: BUILD SUCCESSFUL.
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK at 0.4.0.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: green (the review 390 px flake may fail once; rerun it alone).

**Manual checks (if no CLI):**
- The owner compares the rewritten Edit-mode renders with key screen 4.
