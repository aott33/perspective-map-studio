---
title: 'Core oil and gas icon set'
type: 'feature'
ticket: '10'
created: '2026-10-26'
status: 'in-review'
baseline_revision: '7c119d866014add0df7ec988e47dd78b2662d068'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md'
  - '{project-root}/docs/architecture.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** FR-9 promises a core icon set for sixteen oil and gas kinds in one minimalist style, under a permissive licence, with nothing from OpenBridge (R9, NFR-10, NFR-11); the module ships none, so a kind list has nothing to name and epic-viewing has nothing to draw.

**Approach:** Adapt Tabler Icons outline (MIT, 24 px grid, 2 px round stroke) where a glyph fits and draw the missing oil and gas symbols new in the same grid and stroke; build them into one SVG symbol sprite plus a catalogue, served by the module, with sources, licence and NOTICE lines, a contact sheet for the owner, and an unknown-icon check in the kind list validator. Work in two phases: phase A (artwork, sprite, catalogue, contact sheet, docs, NOTICE) needs nothing from the map store and can be built now; phase B (the kind list check in `map.load`) starts only after story 3 is merged.

## Boundaries & Constraints

**Always:**
- Icon ids, kebab-case, closed list. Kind icons (the sixteen FR-9 kinds plus `swd` and `separator`, and the fallback `point`): `well-pad`, `wellhead`, `tank-battery`, `compressor-station`, `booster-station`, `meter-station`, `pig-trap` (launcher or receiver), `line-valve`, `tap`, `rtu` (RTU or comms tower), `swd`, `separator`, `pipeline`, `lateral`, `lease-road`, `geofence`, `region`, `site-footprint`, `point`. State glyphs: `comms-lost`, `stale`, `alarm-1-solid`, `alarm-1-hollow`, `alarm-2-solid`, `alarm-2-hollow`, `alarm-3-solid`, `alarm-3-hollow` (triangle 1 for Critical and High, circle 2 for Medium, square 3 for Low, the template's ER-27 shapes, drawn new).
- Seeds (Tabler 3.49.0 outline, modified): `meter-station` from `gauge`, `rtu` from `building-broadcast-tower`, `lease-road` from `road`, `geofence` from `fence`, `region` from `polygon`, `site-footprint` from `square-dashed`. Every other icon is drawn new for this module. Each seed is re-checked against the owner's look at review; a seed that does not fit is drawn new instead.
- Every glyph: `viewBox="0 0 24 24"`, `stroke="currentColor"` or `fill="currentColor"` only (kind glyphs are stroke only, `fill="none"`, `stroke-width="2"`, round caps and joins; a solid alarm shape fills with `currentColor`), no other colour, no text, no `<style>`, no external reference; legible at 16 px.
- The alarm glyphs are alarm presentation: flagged for engineering review before release (CLAUDE.md alarm rule, ER-27) in this plan, `docs/icons.md` and the contact sheet.
- Colour comes from theme tokens at draw time (AD-11): the sprite carries `currentColor` only; normal is the neutral token, never a hue.
- Line and area icons (`pipeline` to `site-footprint`) are for the tools, legend, search and popups; the map draws those kinds as styled lines and fills (FR-2), not as point icons.
- Every adapted file records its origin (set, version, source name, "modified") in a sources file; NOTICE carries Tabler's MIT copyright and permission notice.
- Sizes: drawn on the 24 px grid; the map rasterises at the device pixel ratio; a point icon's tap target is 44 px on touch and at least 24 px with a mouse (NFR-3), whatever the glyph's drawn size.
- Unverified claims (the Gateway's content types for `.svg`, `.json` and `.html` under `/res/mapstudio/`) are marked `[UNVERIFIED]` until seen on the dev Gateway.

**Never:**
- Anything copied, traced or derived from OpenBridge or the template's `upstream/*` icons; no icon set under CC BY-SA, GPL, AGPL or any attribution-share-alike licence; no Font Awesome.
- Fixed colours in the artwork, the sprite, the contact sheet's CSS (tokens only, with a stated stand-in for the page outside Perspective) or the catalogue.
- Drawing icons on the map, live values, state composition on the map or the kind setup UI (epic-viewing, epic-editing).
- A MapLibre SDF PNG sprite in this story (see Design Notes).

## Decisions (owner, 2026-10-26, relayed by the coordinator at checkpoint 1)

- State glyphs (comms lost, stale, alarm shapes by priority, solid and hollow) are drawn in this story's sprite; the alarm shapes are flagged for engineering review before release in this plan, `docs/icons.md` and the contact sheet.
- `swd` and `separator` are added: 19 kind icons (with `point`) plus the state glyphs. Wells by type stay assets inside a pad.
- Marker look, for epic-viewing (this story only provides the glyphs): a neutral dot when normal and the kind glyph from zoom 14 in, matching the template's reviewed map (FR-34, template docs/map.md section 5).
- The plan is kept whole (about 2,700 tokens, above the 1,600 target); phase B waits for story 3.
- Phase A's Gateway checks run on the worktree's own dev Gateway (`MAPSTUDIO_CONTAINER=ms-e2s10`, `GATEWAY_HTTP_PORT=9130`); story 1 owns the other `common/` contracts, so this story adds only the icon catalogue files there.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Known icon | kind `{id: "pad", icon: "well-pad"}` | kind accepted; adapter status ok | No error expected |
| Unknown icon | kind `{icon: "wel-pad"}` | kind still listed, drawn later with `point`; status names the kind and the icon in words | `map.load` status entry and one Gateway log line, `MapStudio.adapters` |
| No icon | kind with no `icon` | kind uses `point`; no warning | No error expected |
| Sprite drift | an SVG added or removed without updating the catalogue | build fails | `icons.mjs --check` exits non-zero naming the icon |
| Forbidden source | `sources.json` entry with a licence not on the allow list | build fails | the check names the entry |

</frozen-after-approval>

## Code Map

- `web/webpack.config.js` -- CopyPlugin already copies the MapLibre worker into `build/generated-resources/mounted`; add the built sprite, catalogue and contact sheet the same way so they are served at `/res/mapstudio/icons/`.
- `gateway/.../MapStudioGatewayHook.java` -- mounts `mounted/` at `/res/mapstudio/` (`getMountedResourceFolder`, `getMountPathAlias`); no change.
- `web/typescript/theme.ts` -- `themeColor` reads tokens (`--label`, `--neutral-70`, `--containerRoot`); the contact sheet uses the same tokens. Reuse, do not change.
- `common/src/main/resources/com/aoindustrial/perspective/mapstudio/common/` -- the catalogue lives here so Gateway and web read one file.
- `gateway/src/test/java/.../MapStudioDelegateTest.java` -- pattern for Gateway JUnit tests (common has no test source set).
- `e2e/tests/*.spec.mjs`, `e2e/playwright.config.mjs` -- Playwright pattern; `npm run docs` refreshes `docs/screenshots/`.
- `NOTICE` -- add the Tabler block; keep the OpenBridge sentence true.
- Phase B, after story 3: the kind list validator and `map.load` adapter status that story 3 adds in `gateway/` (file names come from story 3's plan Code Map once merged).
- Read only, do not copy: `ign-scada-template` `docs/map.md` sections 1 and 5 (44 px hit area, 2 px backdrop halo, IEC alarm shape with its digit as a label, comms icon with no hue, neutral dot) and its `upstream.svg` (OpenBridge-derived, forbidden as a source).

## Tasks & Acceptance

**Execution (phase A, now):**
- [x] `web/icons/src/*.svg` -- the 27 glyphs (19 kind icons, 8 state glyphs) to the rules above -- the one source of artwork.
- [x] `web/icons/sources.json` -- per icon: id, kind words, geometry (point, line, area), origin (`drawn` or `tabler:<name>@3.49.0`, modified), licence (`Apache-2.0` for drawn, `MIT` for Tabler) -- provenance kept beside the art.
- [x] `web/scripts/icons.mjs` -- Node, no dependencies: validates every SVG against the rules (viewBox, `currentColor` only, no text, style or href), the allow list of licences (`MIT`, `Apache-2.0`, `ISC`, `CC0-1.0`), sources-to-files match; writes `mapstudio-icons.svg` (one `<symbol id="ms-<id>">` each) and the contact sheet into the mounted output; `--check` verifies the committed catalogue matches -- one gate for drift and licence.
- [x] `common/src/main/resources/.../common/icons.json` -- catalogue `{version, icons: [{id, geometry, label}]}`, versioned with the public contract (NFR-8).
- [x] `common/src/main/java/.../common/IconCatalogue.java` -- loads `icons.json`; `contains(id)`, `ids()`, `FALLBACK = "point"`.
- [x] `web/icons/contact-sheet.html` -- every icon at 16, 24 and 44 px (44 px with its tap target outlined), on light and dark backgrounds, beside the state examples of Design Notes; colours from token custom properties with stand-in values declared once at the top.
- [x] `web/package.json`, `web/build.gradle.kts` -- `icons` script run before webpack; `icons:check` in `npm test`.
- [x] `web/typescript/__tests__/icons.test.ts` -- runs the checker; asserts 27 ids, each FR-9 kind covered, no colour literal in the sprite.
- [x] `gateway/src/test/java/.../IconCatalogueTest.java` -- loads the catalogue, known and unknown ids, fallback present.
- [x] `e2e/tests/icons.spec.mjs` -- opens `/res/mapstudio/icons/contact-sheet.html` and `mapstudio-icons.svg` on the dev Gateway, checks 200 and content type, screenshots `docs/screenshots/icons-contact-sheet.png` at 1440 and 390 px.
- [x] `docs/icons.md` -- the list (id, kind, geometry, origin, licence), the drawing rules for adding an icon, the state contract, the screenshot.
- [x] `NOTICE` -- Tabler Icons, MIT, `Copyright (c) 2020-2026 Paweł Kuna` (as in the 3.49.0 LICENSE) with the permission notice, naming the modified icons.

**Execution (phase B, after story 3 is merged, rebased on main):**
- [ ] story 3's kind list validator -- check each kind's `icon` against `IconCatalogue`; an unknown name adds a plain-words status entry ("Kind Pad names icon wel-pad, which Map Studio does not have; it shows as a plain point.") and one log line; a missing icon means `point`.
- [ ] story 3's adapter tests -- the unknown and missing cases of the matrix; the dev kind adapter names real icons.
- [ ] `docs/` kind list contract (story 3's page) -- the `icon` field names an id from `docs/icons.md`.

**Acceptance Criteria:**
- Given the dev Gateway with the built module, when a browser opens `/res/mapstudio/icons/contact-sheet.html`, then all 27 icons show at 16, 24 and 44 px in both themes and the screenshot is in `docs/icons.md`.
- Given the owner's review of the screenshot, when the owner approves the look, then the approval and its date are recorded in the plan's Implementation Notes (hitl).
- Given NOTICE and `sources.json`, when a reviewer compares them, then every Tabler-derived icon is named with its licence and no source is OpenBridge.
- Given a dev kind naming an unknown icon (phase B), when `map.load` runs, then its status reports the kind and the icon in words.

## Design Notes

Format: an SVG symbol sprite, not a MapLibre SDF sprite. SDF gives one colour plus a halo and needs a rasteriser and distance-field tool at build time; the SVG sprite keeps the art scalable and single-sourced, lets epic-viewing rasterise each glyph per state colour token at the device pixel ratio into `map.addImage` (non-SDF), and lets docs, tools and popups use the same `<use href="#ms-well-pad">`. Revisit SDF if 300-site rendering (NFR-1 later target) needs it.

State contract for epic-viewing (drawn on the contact sheet so the owner reviews one style; never colour alone, AD-11, FR-2):
- Normal: the kind glyph in the neutral token with a 2 px backdrop halo, inside a 44 px touch target.
- Comms lost: glyph dimmed, a comms-lost badge (top right) and the words "Comms lost" in the label or tip; the KPI shows as stale.
- Stale value: the KPI text marked with a stale glyph and the word "stale" in the tip; never shown as current.
- Alarm: the alarm shape of the highest priority, solid while unacknowledged, hollow once acknowledged, with the priority digit as a text label and the count where enabled; hue from the theme's alarm token.

## Verification

**Commands:**
- `cd web && node scripts/icons.mjs --check` -- expected: exit 0, 27 icons, licences allowed.
- `cd web && npx tsc --noEmit && npm test` -- expected: all Jest tests pass, including `icons.test.ts`.
- `./gradlew build` -- expected: module builds; `IconCatalogueTest` passes.
- `cd e2e && npm test -- icons.spec.mjs` and `npm run docs` -- expected: pass on the dev Gateway; screenshot written.

**Manual checks:**
- Owner opens the contact sheet on a laptop and a 390 px phone and approves the look (hitl).
- `grep -ri openbridge web/icons` finds nothing; NOTICE names Tabler and MIT.

## Implementation Notes

Phase A, 2026-10-26, implemented directly (no implementation subagent available in this session).

- 27 icons in `web/icons/src` (19 kind icons with `point`, 8 state glyphs); provenance in `web/icons/sources.json`; six adapted from Tabler 3.49.0 outline (MIT), the rest drawn new. The Tabler adaptations are attribute normalisation only, plus a building outline in `site-footprint`.
- Deviation: the contact sheet is generated by `web/scripts/icons.mjs` (sprite inlined, so it renders from a file, the stand-in server or the Gateway) instead of a hand-kept `web/icons/contact-sheet.html`; it carries stand-in token values once per theme panel, and the alarm tokens are `--ms-alarm-1..3` placeholders [UNVERIFIED] until epic-viewing settles the theme names.
- Deviation: `icons.mjs` runs after webpack (`npm run build`), not before, because webpack's `output.clean` empties `mounted/`. `npm test` runs `icons.mjs --check` before Jest; Gradle's webpack and jestTest tasks take `icons/`, `scripts/` and the catalogue as inputs.
- `IconCatalogue` (common) reads `icons.json` beside it with Ignition's Gson; its tests live in `gateway/src/test` (common has no test source set). Common additions are the catalogue files only, as agreed with story 1.
- Dev Gateway: not reachable. This box has no running Docker daemon to the sandbox, and starting containers outside the sandbox was refused, so `ops/up.sh` with `MAPSTUDIO_CONTAINER=ms-e2s10`, `GATEWAY_HTTP_PORT=9130` did not run. The Gateway's content types for `.svg`, `.json` and `.html` under `/res/mapstudio/` stay [UNVERIFIED]; the three content-type tests in `e2e/tests/icons.spec.mjs` did not run.
- Screenshots `docs/screenshots/icons-contact-sheet-1440.png` and `-390.png` were taken by `icons.spec.mjs` (`E2E_DOCS=1`, `--grep "contact sheet|catalogue"`) against a stand-in Node static server serving the built `mounted/` folder at `/res/mapstudio/` (not the Gateway); docs/icons.md says so.
- Verification run: `node scripts/icons.mjs --check` (27 icons, licences allowed); `npx tsc --noEmit` and `npm test` in `web/` (6 suites, 39 tests passed); `./gradlew build` (BUILD SUCCESSFUL; `IconCatalogueTest` 6 of 6, `MapStudioDelegateTest` 6 of 6; `mounted/icons/*` inside the web jar of the `.modl`); Playwright 3 of 6 icon tests against the stand-in, passed, no horizontal scroll at 390 px.
- Matrix audit: sprite drift and forbidden source are covered by `icons.test.ts` (ran, passed). Known, unknown and no icon are covered at the catalogue level by `IconCatalogueTest` (`resolve`, `contains`); their `map.load` status entry and log line are phase B, waiting for story 3.
- Owner review of the look (hitl): pending.

## Plan Change Log

## Review Triage Log
