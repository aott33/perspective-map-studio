# Platform checks

The spike's platform questions (epic-module-foundation R3), each answered on a live Ignition 8.3.10 Gateway with its evidence and the fallback taken where it failed. One section per spike story; a story edits only its own section. Story 9 compiles these into the go or no-go report and carries the answers into claude-ignition-skills.

Labels: **[live 8.3.10]** seen on the `ops/` dev Gateway (`inductiveautomation/ignition:8.3.10`); **[build]** seen in this repository's build or tests; **[npm metadata]** read from the package registry; **[unverified]** not checked here.

## Story 2 - MapLibre 6 and Terra Draw

**Question (architecture open question, Stack table):** does the Perspective toolchain (React 16.14, TypeScript 4.9, webpack 5) build and run maplibre-gl 6.16.0 with terra-draw and its MapLibre adapter?

**Answer:** yes, at the versions pinned below; no fallback was needed. Date: 2026-10-26.

| Package | Pinned | Reason |
| --- | --- | --- |
| `maplibre-gl` | 6.16.0 | The architecture's first choice built, bundled and ran; no step down was needed. |
| `terra-draw` | 1.38.0 | Newest release at the time; type-checks under TypeScript 4.9.5 and runs on the adapter. |
| `terra-draw-maplibre-gl-adapter` | 1.5.0 | Newest release; peers `terra-draw ^1.0.0`, `maplibre-gl >=4` **[npm metadata]**. |

Attempts, in order:

1. `maplibre-gl` 6.16.0 + `terra-draw` 1.38.0 + adapter 1.5.0 under TypeScript 4.9.5, webpack 5.101.3, React 16.14 externals **[build]**: `tsc --noEmit` clean, Jest 16 of 16, `./gradlew build` successful in 1 m 43 s on a warm cache, no webpack warning from either package (MapLibre's own "Critical dependency" warning stays ignored as in story 1). No failure, so no second attempt.

Facts that shaped the code:

- Both Terra Draw packages ship ESM (`exports.default` is `*.modern.js`) and a `.cjs` for `require` **[npm metadata]**; webpack 5 takes the ESM build and Jest's commonjs config (`tsconfig.test.json`) the `.cjs`, with no extra configuration **[build]**.
- Their `.d.ts` files use no TypeScript 5 syntax; `skipLibCheck: true` stays as in story 1 **[build]**.
- The adapter reads MapLibre's `map.version` getter and enables dash arrays only on MapLibre 5.8.0 or later **[npm metadata]**; the dashed style is not used by the line tool yet, so this branch is **[unverified]**.
- Terra Draw styles take hex colours only (`HexColor`), and its defaults are colour literals (`#3f97e0`, `#ffffff`). The component converts the theme tokens' computed values to hex (`web/typescript/theme.ts`, `toHexColor`, `drawColor`) and sets every style key the line tool draws, so AD-11 holds; a token that does not resolve leaves that key to the library default and logs one warning.
- Terra Draw owns the map's clicks while a drawing mode is on. The component keeps Terra Draw in `static` mode and enters `linestring` only from the "Draw a line" toggle; the story 1 point click is ignored while drawing.
- Terra Draw's adapter adds its own `td-*` GeoJSON sources and layers above the component's layers; the story 1 layers were not changed.

Measures:

| Measure | Story 1 (baseline `0fba47c`) | Story 2 | Delta |
| --- | --- | --- | --- |
| `MapStudio.js` (production, minified) | 1,065,187 bytes | 1,167,572 bytes | +102,385 bytes (+9.6 %) |
| `MapStudio.css` | 70,494 bytes | 70,976 bytes | +482 bytes |
| `maplibre-gl-worker.js` | 517,065 bytes | 517,065 bytes | 0 |
| `Map-Studio.unsigned.modl` | 456,998 bytes (the main checkout's story 1 build, read only) | 482,316 bytes | +25,318 bytes |

The baseline was measured by building the story 1 `web/` folder from commit `0fba47c` with the same webpack settings, outside the repository.

Live run **[live 8.3.10]** (dev Gateway `ms-s2`, fresh volume, module accepted unattended): the Gateway log shows the module starting and the component registering with no Map Studio warning or error. `node ops/screenshot.mjs` at 1440 x 900 and 390 x 844: the point click reply arrived, a one-vertex drawing cancelled with Escape left the tool off with nothing drawn, and a two-vertex line finished with Enter gave "Line drawn with 2 points"; no browser console error or page error in either viewport (the script fails on one). The toggle, the Escape cancel and the finished line were seen through the DOM attributes the component sets (`data-drawing`, `data-line-points`, `aria-pressed`) and in the screenshots.

Evidence: `docs/screenshots/mapstudio-dev-1440.png` and `docs/screenshots/mapstudio-dev-390.png` (point click reply and one line drawn with Terra Draw), written by `node ops/screenshot.mjs`, which fails on any browser console error.

Not covered here (later stories): frame rate, value batch size and phone breakage (story 7); saving, undo, snapping, select and edit modes (epic-editing).
