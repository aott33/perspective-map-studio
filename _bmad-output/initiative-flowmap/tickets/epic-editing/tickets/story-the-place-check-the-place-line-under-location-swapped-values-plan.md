---
title: "The place check: the place line under Location, swapped values flagged, Zoom to location"
type: 'feature'
ticket: '27'
created: '2026-11-07'
status: 'draft'
baseline_revision: '0430d46adaebe24248213c9003e7917ffbd60e59'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/EXPERIENCE.md', '{project-root}/_bmad-output/initiative-flowmap/ux-map-studio/DESIGN.md']
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A point's typed latitude and longitude give no sign of where they land: a pad typed into the wrong county, or with its two numbers swapped, saves without a word, and Details cannot move the map to the point.

**Approach:** Decisions (owner, 2026-11-03: an offline place check from Natural Earth and GeoNames within 5 MB on the wire; 2026-11-06, "Split, and A"). Details' Location row shows a place line from data the module serves and the browser loads on first use: in the US the county, the state and the country, elsewhere the nearest town, the state or province and the country; swapped or out-of-range values are flagged in words; Zoom to location moves the map to the point.

## Boundaries & Constraints

**Always:** The place line sits under Latitude and Longitude for a point item, in the secondary text colour, and follows the stored point and a typed pair once both read as numbers: "Lea County, New Mexico, US" (a US county from Natural Earth's US counties, the state from its admin-1 boundaries, the ISO country code); outside the US "Near Grande Prairie, Alberta, CA" (the nearest GeoNames town within 50 km, then the state or province and the country), or the state or province and the country alone when no town is that near; "No place found here" over water or outside the data; "Looking up the place..." while the data loads, and "The place check is not available" if it fails to load, never blocking a save. A latitude past 90 or below -90 whose swap is in range reads "Latitude and longitude look swapped"; a pair in no area whose swap lands in one reads "Latitude and longitude may be swapped"; out of range otherwise is flagged as today. The words have a tooltip naming the sources ("Places: Natural Earth, GeoNames (CC BY 4.0)"). Zoom to location, beside Move, moves the map to the stored point at zoom 15 or more, the selection and Details kept and the point in view. The data is made once by a script in the repository (downloads Natural Earth's admin-1 and US counties and GeoNames' towns, simplifies, writes one file with its sources, versions and SHA-256s), committed, copied by the web build into `/res/mapstudio/`, fetched once per page when Details first shows a location, never in `MapStudio.js`; the bytes the Gateway sends for it are at most 5 MB. Builds and CI stay offline: nothing downloads at build time. NOTICE credits Natural Earth (public domain) and GeoNames (CC BY 4.0). Colours from theme tokens; no em dashes.

**Never:** Send a position to any service. A place check on a line or an area. Change the Gateway's Java, `common/`, a message, a prop or the contract version. A shipped library that is not permissively licensed (the simplifier is a dev dependency only). Delete a test or weaken its expectation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| US county | A pad typed 32.7, -103.1 | "Lea County, New Mexico, US" | No error expected |
| Elsewhere | 55.17, -118.8 | "Near Grande Prairie, Alberta, CA" | No error expected |
| Swapped | -103.1, 32.7 | "Latitude and longitude look swapped"; nothing saved until it reads | No error expected |
| Water | 30.0, -40.0 | "No place found here" | No error expected |
| Zoom | Zoom to location on CTB1 | The map at CTB1, zoom 15 or more, Details open | No error expected |
| First use | The editor opened, no Details yet; then CTB1's Details | No place request before; one after, at most 5 MB as served | Data missing: "The place check is not available", the form still saves |

</frozen-after-approval>

## Code Map

- `web/typescript/studio/PropertiesPanel.tsx` -- the Location row (Move, `.mapstudio-field-lat`, `.mapstudio-field-lng`, the hint; `readCoordinate` 110 flags out of range; drafts `{name, lat, lng}`); the place line goes under the hint, Zoom to location beside Move; entry 6's field rows follow Location (DESIGN.md order); do not change Move, the footer delete or entry 6's fields.
- `web/typescript/MapStudio.tsx` -- `renderPanel` (about 1231) passes the panel's props and callbacks; Zoom to location reuses the camera (`camera.ts` `cameraPadding`, the row select's `easeTo` in `onRowSelect`); entry 26's keep-in-view lives in `selection.tsx` (`intoView`, `popupPlacement.ts`).
- A new `web/typescript/placeCheck.ts` -- the lazy loader (one fetch per page, a promise kept), point-in-polygon for counties and admin-1, the nearest town, the words, the swap rules; pure functions tested in Jest with a small fixture, never the whole file.
- `web/scripts/` -- `icons.mjs` and `glyphs.mjs` are the precedent for a generator script; a new `place-data.mjs` (`npm run place-data`, by hand) with the simplifier as a dev dependency; its output committed under `web/assets/place/` with a sources manifest.
- `web/webpack.config.js` (46-53) -- the `CopyPlugin` that copies the MapLibre worker into `build/generated-resources/mounted/`; the place file is copied the same way, as `.json` (`.mjs` is served with no content type). `web/build.gradle.kts` packs `mounted/` into the module; the Gateway serves it at `/res/mapstudio/` (`MapStudioGatewayHook` 129-137). `mapLayers.ts` 70-72 is the URL precedent.
- `NOTICE` -- third-party blocks; `web/scripts/icons.mjs` `checkNotice` (217-244, tested in `__tests__/icons.test.ts` 152-173) checks the Tabler lines only: add the two data blocks without breaking them.
- e2e: `e2e/tests/details.spec.mjs` (entry 6) and its helpers; the place request read from the page's network (`page.on('request')` or `response`), its bytes from the response as served.
- Docs: `docs/contract.md` (the item form paragraph), `docs/kinds-and-assets.md` or a short `docs/place-check.md` (the data, its sources, how to regenerate), `CHANGELOG.md` 0.4.0.

## Tasks & Acceptance

**Execution:**
- [ ] `web/scripts/place-data.mjs`, `web/package.json`, `web/assets/place/` -- the generator, run once, its output and manifest committed -- the data offline and reproducible.
- [ ] `web/webpack.config.js` -- the file copied into `mounted/` -- served by the module, out of the bundle.
- [ ] `web/typescript/placeCheck.ts` and Jest -- loader, lookups, words, swap rules -- one tested place.
- [ ] `web/typescript/studio/PropertiesPanel.tsx`, `MapStudio.tsx`, `mapstudio.css` -- the place line, its tooltip, Zoom to location -- the matrix in the form.
- [ ] `e2e/tests/details.spec.mjs` -- the matrix at 1366 px as `mapeditor`; a render of the place line under `E2E_DOCS=1`.
- [ ] `NOTICE`, `docs/contract.md`, the data's doc, `CHANGELOG.md`.

**Acceptance Criteria:**
- Given the dev Gateway as `mapeditor` at 1366 px, when the matrix runs, then each row holds.
- Given the whole e2e suite on a fresh dev stack, when it runs, then every spec passes.

## Implementation Notes

- Planner, 2026-11-07: the environment, commit and identity rules are entry 4's plan's (Docker started by hand after a container restart, `ops/up.sh --fresh` before a whole-suite run with nothing else against the stack, the two trailer lines from the session's attribution reminder, `git commit --only` your paths, no em dashes, no model identifier, never a bare `git stash`, never a push). Commit at each working milestone. Natural Earth (naciscdn.org) and GeoNames (download.geonames.org) were reachable from this container on 2026-11-06. Whether the Gateway compresses `/res/` files is unchecked: measure the bytes it sends for the place file.

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` -- expected: BUILD SUCCESSFUL, with no network use.
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK at 0.4.0.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: green (the review 390 px flake may fail once; rerun it alone).
