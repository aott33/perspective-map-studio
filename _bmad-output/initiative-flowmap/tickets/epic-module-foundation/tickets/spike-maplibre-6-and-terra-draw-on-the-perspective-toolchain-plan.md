---
title: 'MapLibre 6 and Terra Draw on the Perspective toolchain'
type: 'feature'
ticket: '2'
created: '2026-10-26'
status: done
baseline_revision: '0fba47cdb46cd4c75b7c24055d7b1489d41f834c'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The architecture pins maplibre-gl 6.16.0 with terra-draw 1.38.0 and terra-draw-maplibre-gl-adapter 1.5.0, but nobody has built or run that trio under Perspective's toolchain (React 16.14, TypeScript 4.9, webpack 5) on a live 8.3 Gateway; every editing epic rests on it (R3, architecture open question).

**Approach:** Add Terra Draw and its MapLibre adapter to the tracer component behind a "Draw a line" toggle, draw one line with it on the dev Gateway's tracer view, prove it headlessly, and record the MapLibre version that works with the reason. If 6.16.0 fails to build or run, step down to the newest MapLibre that works and pin it.

## Boundaries & Constraints

**Always:** Exact pins in `web/package.json`; the story 1 behaviour stays (three points, one line, point click round trip, no console error); every colour from a theme token, converted to the hex Terra Draw needs, never a literal (AD-11); the mode is named in words plus a glyph (R10); the dev Gateway runs as `MAPSTUDIO_CONTAINER=ms-s2` on `GATEWAY_HTTP_PORT=9102` from the worktree's git-ignored `.env`; no em dashes; the record states the pinned version, what was tried and why.

**Never:** no saving, undo, snapping, select or edit modes, phone editing, Terra Draw on the Gateway side, new Gateway messages, basemaps; no change to `ign-scada-template` or to `common/`, `gateway/` or `designer/`; no hand-edited Terra Draw styles beyond the line and its vertices; no `.modl` in git.

**Decisions (owner, 2026-10-26):** The plan stays whole (about 1900 tokens, one goal). The platform answer is recorded in this repository only, in the shared file `docs/platform-checks.md` under the section "Story 2 - MapLibre 6 and Terra Draw"; stories 3 and 4 add their own sections to that file, so this story writes only its section. `claude-ignition-skills` is not edited; story 9 does that. Unverified claims are marked as such.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Toggle on | Click "Draw a line" while off | Terra Draw mode `linestring`; button shows the mode is on; status text "Drawing a line: click to add points, Enter to finish" | No error expected |
| Draw a line | Two map clicks, then Enter | One LineString in Terra Draw's store; status text "Line drawn with 2 points"; mode returns to off | No error expected |
| Cancel | Escape while drawing | No feature stored; status text back to "Click a point." | No error expected |
| Point click while off | Click a test point | `point.click` round trip as in story 1 | No error expected |
| Token missing | A theme token resolves to '' or a non-colour | Line style falls back to a neutral token in this order: `--label`, `--neutral-70`; never a literal | Logged once at warn `[MapStudio]` |
| Build fails on 6.16.0 | webpack or tsc error, or a runtime error in the browser | Step down: newest 5.x that passes the same acceptance; record each attempt | Each failure recorded with its message |

</frozen-after-approval>

## Code Map

Evidence (2026-10-26): typescript 4.9.5 with the project's `tsconfig` options type-checks `maplibre-gl@6.16.0`, `terra-draw@1.38.0` and `terra-draw-maplibre-gl-adapter@1.5.0` together (exit 0; no TypeScript 5 syntax in their `.d.ts`). Both Terra Draw packages ship ESM plus `.cjs`, so Jest's commonjs config works. Adapter peers: `terra-draw ^1.0.0`, `maplibre-gl >=4`; it reads `map.version` and gates dash arrays on `>= 5.8.0`. Terra Draw styles are `HexColor` only and its defaults are literals (`#3f97e0`, `#ffffff`), so every style key of the line mode must be set from tokens. Unproven: the webpack bundle and the live Gateway.

- `web/package.json`, `web/package-lock.json` -- add the two Terra Draw packages; `maplibre-gl` stays 6.16.0 unless the fallback rule fires.
- `web/webpack.config.js` -- externals, worker copy and `ignoreWarnings` stay; change only what the bundle needs, and record it.
- `web/typescript/MapStudio.tsx` -- map and layers created on `load`; `onPointClick` sends the envelope; `render` shows `.mapstudio-reply`. Terra Draw starts after `load` in mode `static`; the toggle switches `linestring` and back; `finish` and Escape update state shown in the reply box.
- `web/typescript/theme.ts` -- `themeColor(root, token)` returns the computed value or `transparent`; add `toHexColor` and a token fallback chain.
- `web/typescript/mapstudio.css` -- tokens only; style the toggle button inside `.maplibregl-ctrl-group`.
- `web/typescript/__tests__/messages.test.ts` -- Jest in node with `tsconfig.test.json`; the new tests follow it.
- `ops/screenshot.mjs` -- Playwright, software WebGL, Web Mercator `project()`, fails on any console error; extend with the draw sequence; `--url` selects the Gateway.
- `ops/lib.sh`, `ops/docker-compose.yml` -- already read `MAPSTUDIO_CONTAINER` and `GATEWAY_HTTP_PORT` from `.env`; no change.
- `docs/platform-checks.md` (new; one section per spike story), `NOTICE`, `README.md` -- where the pin and Terra Draw (MIT) are recorded.
- Story 1 plan (`story-tracer-...-plan.md`) -- worker served as `.js`, colours read once at mount, `ACCEPT_MODULE_*` acceptance; build on it, do not repeat it.

## Tasks & Acceptance

**Execution:**
- [x] `.env` (git-ignored) -- `MAPSTUDIO_CONTAINER=ms-s2`, `GATEWAY_HTTP_PORT=9102` -- this worktree's own dev Gateway beside the others.
- [x] `web/package.json`, `web/package-lock.json` -- add the two Terra Draw packages, exact versions -- the pins under test.
- [x] `web/typescript/theme.ts` -- `toHexColor(value)` (hex, rgb, rgba in; `#rrggbb` or `null` out) and `drawColor(root, tokens[])` returning the first token that converts -- Terra Draw takes hex only, the project takes tokens only.
- [x] `web/typescript/MapStudio.tsx` -- `TerraDraw` with the MapLibre adapter and `TerraDrawLineStringMode` styled from tokens; a `DrawControl` (`IControl`, one button, "Draw a line" plus a glyph, `aria-pressed`) in the top-right group; mode and status in component state; dispose in `componentWillUnmount` -- the line drawn on the live view.
- [x] `web/typescript/mapstudio.css` -- the button's states from tokens -- AD-11.
- [x] `web/typescript/__tests__/theme.test.ts` -- `toHexColor` (hex, rgb, rgba, '', nonsense) and the status text of each matrix row -- the matrix as unit tests.
- [x] `ops/screenshot.mjs` -- after the point click: press the toggle, click two map spots, press Enter, wait for "Line drawn with 2 points", capture -- headless proof at 1440 and 390 px.
- [x] `ops/up.sh` with the `.env` above, then `node ops/screenshot.mjs --url http://localhost:9102` -- the live check; on failure apply the fallback rule and repeat.
- [x] `docs/platform-checks.md` (new, section "Story 2 - MapLibre 6 and Terra Draw" only), `NOTICE`, `README.md` -- the pinned versions, each attempt and why it failed, bundle size before and after (`MapStudio.js` under `web/build/generated-resources/mounted`); Terra Draw attribution; README points at the record -- the spike's record.

**Acceptance Criteria:**
- Given a fresh `./gradlew build`, when it runs, then the `.modl` is produced with Terra Draw in the bundle and `npm test` passes.
- Given the `ms-s2` Gateway at 1440 and 390 px, when the screenshot script runs, then both images show the three points, the story 1 line, the reply text and a second line drawn with Terra Draw, with no console error.
- Given the record in `docs/platform-checks.md`, when the owner reads it, then it names the pinned MapLibre, Terra Draw and adapter versions, each attempt that failed with its message, and the bundle size before and after.

## Implementation Notes

- Implemented directly in this session (no subagent tool available), 2026-10-26.
- Toolchain: `maplibre-gl` 6.16.0 + `terra-draw` 1.38.0 + `terra-draw-maplibre-gl-adapter` 1.5.0 built first time; the fallback rule never fired. `tsc --noEmit` clean; Jest 17 of 17 (8 story 1 message tests, 9 new in `theme.test.ts`); `./gradlew build` green in 1 m 43 s (warm cache); no webpack warning from either package.
- Code: `web/typescript/draw.ts` (pure state and status text), `DrawControl.tsx` (MapLibre `IControl` toggle, glyph plus the words "Draw a line", `aria-pressed`), `theme.ts` (`toHexColor`, `drawColor`), `MapStudio.tsx` (Terra Draw started after the map's `load`, idle in `static`, `linestring` from the toggle, `finish` reads the vertex count from `getSnapshotFeature`, Escape handled on the container in capture phase, point clicks ignored while drawing, the reply box shows the reply line and a second draw-status line with `data-drawing` and `data-line-points` for scripts).
- Theme tokens: a live probe of the 8.3.10 light theme showed `--callToActionText` and `--containerHover` do not exist; the toggle uses `--callToActionHighlight`, `--callToAction` and `--neutral-30`, all present (`--callToAction` `#0C7BB3`, `--label` `#323232`, `--neutral-70` `#5E5E5E`, `--containerRoot` `#FAFAFA`). Terra Draw's hex requirement is met from these through `toHexColor`.
- Dev Gateway: `ms-s2` on `127.0.0.1:9102` from the git-ignored `.env`; `ops/up.sh --fresh` commissioned it unattended with the new build; the log shows `Starting up module 'com.aoindustrial.perspective.mapstudio' v0.1.0` and `Registering the Map Studio component.`, no Map Studio warning or error.
- Screenshot script: `node ops/screenshot.mjs --url http://localhost:9102` clicks p1, cancels one drawing with Escape, then draws a 2-point line and presses Enter; it waits on the `data-*` attributes and fails on any console error. Draw offsets were chosen from the projected test point offsets (p1 -147,57; p2 -21,-59; p3 144,16 px from the centre).
- Record: `docs/platform-checks.md` (new, section "Story 2 - MapLibre 6 and Terra Draw") with the pins, attempts, measures and labels; bundle `MapStudio.js` 1,065,187 -> 1,167,484 bytes (+9.6 %), baseline measured by building the story 1 `web/` from `0fba47c` in the scratchpad with the same webpack settings. `NOTICE` and `README.md` updated; Terra Draw's copyright year is not stated because the npm packages ship no licence file.
- Second build after the live token probe and the two-line status box: Jest 17 of 17 (a `drawColor` test added for the token-missing row), `./gradlew build` 1 m 08 s, final `MapStudio.js` 1,167,572 bytes, `.modl` 482,316 bytes; `ops/up.sh` restarted `ms-s2` and the screenshot script passed again (exit 0) with the Escape cancel step. The acceptance criterion's "reply text and a second line" is why the box shows two lines instead of replacing the reply.
- Matrix audit: Toggle on, Draw a line and Cancel are covered by `theme.test.ts` (status text and state) and exercised live by `ops/screenshot.mjs` (`data-drawing`, `data-line-points`, `aria-pressed`); Point click while off by the story 1 delegate tests and the live click; Token missing by the `drawColor` and `toHexColor` tests; the "Build fails" row is a procedure that never triggered (recorded as attempt 1 in `docs/platform-checks.md`).

## Plan Change Log

## Review Triage Log

Pass 1 (quick lens, 2026-10-26, run context-free by the coordinator from the standalone prompt written beside this plan): high 0, medium 0, low 0, false 0, maybe-false 0. No findings: acceptance criteria met, boundaries followed, I/O matrix covered, no defects reported. Nothing patched, nothing deferred.

## Design Notes

Terra Draw owns the map's clicks while a drawing mode is on, so the component holds Terra Draw in `static` mode by default and only the toggle enters `linestring`; the story 1 point click keeps working when the toggle is off. The adapter draws its own `td-*` layers above the test layers, so nothing in the story 1 style changes. Fallback rule, in order: 6.16.0; if it fails to bundle or to run, the newest 5.x on npm; the adapter needs `>= 4` and uses `>= 5.8.0` for dash arrays, so no pin below 5.8.0 is acceptable without a note.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npm test` -- expected: no type errors; the story 1 tests and the new theme tests pass
- `./gradlew build` -- expected: `build/Map-Studio.unsigned.modl`; webpack reports Terra Draw in the bundle
- `ops/up.sh --fresh` with the worktree `.env` -- expected: `ms-s2` RUNNING on 9102, Map Studio started, no Map Studio warning or error in `ops/logs.sh`
- `node ops/screenshot.mjs --url http://localhost:9102` -- expected: two screenshots with the Terra Draw line and the reply text; exit 0

**Manual checks (if no CLI):**
- Owner reads the record and confirms it answers R3's toolchain question with the pinned versions and the reason.
