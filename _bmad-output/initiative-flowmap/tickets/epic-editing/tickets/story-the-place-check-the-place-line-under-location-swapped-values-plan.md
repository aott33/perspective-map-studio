---
title: "The place check: the place line under Location, swapped values flagged, Zoom to location"
type: 'feature'
ticket: '27'
created: '2026-11-07'
status: 'in-review'
baseline_revision: '0430d46adaebe24248213c9003e7917ffbd60e59'
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

**Problem:** A point's typed latitude and longitude give no sign of where they land: a pad typed into the wrong county, or with its two numbers swapped, saves without a word, and Details cannot move the map to the point.

**Approach:** Decisions (owner, 2026-11-03: an offline place check from Natural Earth and GeoNames within 5 MB on the wire; 2026-11-06, "Split, and A"; 2026-11-07 in the round table: offshore rigs are real, so the water is named, and border precision A, "I'm good with A"). Details' Location row shows a place line from data the module serves and the browser loads on first use: in the US the county, the state and the country, elsewhere the nearest town, the state or province and the country; swapped or out-of-range values are flagged in words; Zoom to location moves the map to the point.

## Boundaries & Constraints

**Always:** The place line sits under Latitude and Longitude for a point item, in the secondary text colour, and follows the stored point and a typed pair once both read as numbers: "Lea County, New Mexico, US" (a US county from Natural Earth's US counties with the data's own word, so "Lafourche Parish" and "North Slope Borough", the state from its admin-1 boundaries, the ISO country code); outside the US "Near Grande Prairie, Alberta, CA" (the nearest GeoNames town within 50 km, then the state or province and the country), or the state or province and the country alone when no town is that near; offshore, the sea from Natural Earth's marine polygons, then "off" the nearest state or province within 200 km ("Gulf of Mexico, off Louisiana, US"), or the sea alone past that ("North Atlantic Ocean"); "No place found here" only where no area and no sea is found; borders are simplified to at most about 100 m, and a point within 1 km of a county or state line adds the neighbour in words ("Lea County (near the Texas line), New Mexico, US"); "Looking up the place..." while the data loads, and "The place check is not available" if it fails to load, never blocking a save. A latitude past 90 or below -90 whose swap is in range reads "Latitude and longitude look swapped"; a pair in no area whose swap lands in one reads "Latitude and longitude may be swapped"; out of range otherwise is flagged as today. The words have a tooltip naming the sources ("Places: Natural Earth, GeoNames (CC BY 4.0)"). Zoom to location, beside Move, moves the map to the stored point at zoom 15 or more, the selection and Details kept and the point in view. The data is made once by a script in the repository (downloads Natural Earth's admin-1, US counties and marine polygons and GeoNames' towns, simplifies, writes one file with its sources, versions and SHA-256s), committed, copied by the web build into `/res/mapstudio/`, fetched once per page when Details first shows a location, never in `MapStudio.js`; the bytes the Gateway sends for it are at most 5 MB. Builds and CI stay offline: nothing downloads at build time. NOTICE credits Natural Earth (public domain) and GeoNames (CC BY 4.0). Colours from theme tokens; no em dashes.

**Never:** Send a position to any service. A place check on a line or an area. Change the Gateway's Java, `common/`, a message, a prop or the contract version. A shipped library that is not permissively licensed (the simplifier is a dev dependency only). Delete a test or weaken its expectation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| US county | A pad typed 32.7, -103.1 | "Lea County, New Mexico, US" | No error expected |
| Elsewhere | 55.17, -118.8 | "Near Grande Prairie, Alberta, CA" | No error expected |
| Swapped | -103.1, 32.7 | "Latitude and longitude look swapped"; nothing saved until it reads | No error expected |
| Parish | 29.64, -90.54 | "Lafourche Parish, Louisiana, US" | No error expected |
| Near a line | 32.5, -103.07 | "Lea County (near the Texas line), New Mexico, US" | No error expected |
| Offshore | 28.5, -90.5; then 30.0, -40.0 | "Gulf of Mexico, off Louisiana, US"; "North Atlantic Ocean" | No error expected |
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
- [x] `web/scripts/place-data.mjs`, `web/package.json`, `web/assets/place/` -- the generator, run once, its output and manifest committed -- the data offline and reproducible.
- [x] `web/webpack.config.js` -- the file copied into `mounted/` -- served by the module, out of the bundle.
- [x] `web/typescript/placeCheck.ts` and Jest -- loader, lookups, words, swap rules -- one tested place.
- [x] `web/typescript/studio/PropertiesPanel.tsx`, `MapStudio.tsx`, `mapstudio.css` -- the place line, its tooltip, Zoom to location -- the matrix in the form.
- [x] `e2e/tests/details.spec.mjs` -- the matrix at 1366 px as `mapeditor`; a render of the place line under `E2E_DOCS=1`.
- [x] `NOTICE`, `docs/contract.md`, the data's doc, `CHANGELOG.md`.

**Acceptance Criteria:**
- Given the dev Gateway as `mapeditor` at 1366 px, when the matrix runs, then each row holds.
- Given the whole e2e suite on a fresh dev stack, when it runs, then every spec passes.

## Implementation Notes

- Approval (owner, 2026-11-07): "Approved" after a round table on the plan (offshore water named, the data's own county word, border precision A); the plan, a little over size, kept whole; it went ready-for-dev and implementation started in this session.
- Planner, 2026-11-07: the environment, commit and identity rules are entry 4's plan's (Docker started by hand after a container restart, `ops/up.sh --fresh` before a whole-suite run with nothing else against the stack, the two trailer lines from the session's attribution reminder, `git commit --only` your paths, no em dashes, no model identifier, never a bare `git stash`, never a push). Commit at each working milestone. Natural Earth (naciscdn.org) and GeoNames (download.geonames.org) were reachable from this container on 2026-11-06. Whether the Gateway compresses `/res/` files is unchecked: measure the bytes it sends for the place file.

## Plan Change Log

- 2026-11-07 (implementer): the data. GeoNames' cities5000 (towns of 5,000 people or more) outside the US, Puerto Rico and the US Virgin Islands, whose points read their county, less the feature codes PPLX, PPLH, PPLQ, PPLW, PPLCH and PPLR: 57,461 towns; cities1000 would not fit beside the borders under 5 MB. Points rounded to 0.0001 degree (borders) and 0.001 degree (towns). The file is 4,664,353 bytes (borders' points 3.6 MB, towns 0.8 MB); the same sources give the same bytes. The simplifier is mapshaper 0.6.121 (MPL-2.0, released 2026-04-18, the last of 0.6, lighter than 0.7), pinned exactly as a dev dependency; it adds 216 packages to `web/package-lock.json` (no existing package moved), all dev only, installed by the build's `npm install` with the rest and never shipped. It simplifies each layer on its own topology (`-simplify dp interval=100 keep-shapes`), so neighbours share one line and no gap opens at a border. The file also carries the manifest's sources; `sources.json` beside it is the manifest. `node scripts/place-data.mjs --check` runs in `npm test` (as icons and glyphs do), offline.
- 2026-11-07 (implementer): the words from the data. An admin-1 area reads `name_en` (Natural Earth's English name: "Bavaria", "Quebec"), but a US state its `name`, because DC's `name_en` is "Washington"; the country is `iso_a2`, or the country's name for the 12 areas Natural Earth gives no code (Somaliland, Northern Cyprus). The county is `NAME_ALT`, the data's own words ("Lafourche Parish", "Juneau City and Borough", "Carson City"). Marine names in capitals ("INDIAN OCEAN", "SOUTHERN OCEAN") read their `name_en`. A US point's state is its county's (`REGION` matched to the admin-1 code `US-<REGION>`), so county and state never disagree at a border; the US Virgin Islands do not match and read the area holding the point.
- 2026-11-07 (implementer): the seam. A coastal scan of the made file (Louisiana, Texas, the Netherlands, Norway, British Columbia, the Persian Gulf, the North Sea at 0.02 degree) found 0.4 to 5 percent of the points in no area and no sea: deltas, inland bays and fjords between Natural Earth's land and sea outlines, nearly all within 2 km of both. Such a point takes the nearer of the land (a county first) and the sea within 2 km; "No place found here" only beyond (the frozen rule's "where no area and no sea is found", read as found within the data's own precision). After it the scan's gaps are 0 to 0.2 percent (fjord ends). The 11 unnamed marine polygons (channels of British Columbia, the Inside Passage, the Danish straits, the Philippines) read "Off British Columbia, CA", and "No place found here" with no shore within 200 km.
- 2026-11-07 (implementer): the lines. A state line wins over a county line; a county line within the state reads "Lea County (near the Eddy County line), New Mexico, US"; elsewhere the neighbour follows the state or province ("Alberta (near the British Columbia line), CA"); a country's border is a state line; a neighbour of the same name is not said (Latvia's municipalities). A line across the 180th meridian is not measured across it (docs/place-check.md, Limits).
- 2026-11-07 (implementer): the place line's states. The swap flags are the place line's words (the place check speaks there), in the text colour as a field's problem; for a swapped pair the hint keeps its instruction, and any other pair out of range keeps today's hint with no place line. "May be swapped" shows those words only. Zoom to location shows for every point item, an instrument too (which has no Move), and stays on while the fields are paused or the kind is unknown: it moves the map only. `places.json` is served at `/res/mapstudio/places.json`.
- 2026-11-07 (implementer): measured on the dev Gateway: it sends `places.json` as it is, 4,664,353 bytes of `application/json`, uncompressed even when the browser accepts gzip (gzip would be 3.1 MB), and with no cache headers, so every new page fetches it again when Details first shows a point. Within the 5 MB; recorded in docs/place-check.md.
- 2026-11-07 (implementer): tests. The two panel test helpers (`itemPanel.test.ts`, `shortcuts.test.ts`) gain the two new required props (an idle place source and `onZoomTo`); no expectation changed. In `details.spec.mjs` the missing-data test answers the file with a 404 and takes the browser's own "Failed to load resource" line (the case under test, exactly one) out of the console watcher for that test only; a typed latitude saves as the cursor moves to Longitude (entry 2's rule), so the matrix test waits for those saves to settle before it checks that a swapped pair sends nothing. `docs/development.md` names the new file and script.
- 2026-11-07 (implementer): verified. `cd web && npx tsc --noEmit && npm test`: clean, 535 Jest tests green (30 new: `placeCheck.test.ts`, `placeData.test.ts`), `place-data.mjs --check` OK. `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline`: BUILD SUCCESSFUL in 1 min 17 s with npm's registry pointed at a closed port (`npm_config_registry=http://127.0.0.1:9/`), so the build used no network; `places.json` lands in `mounted/` and `MapStudio.js` holds none of it (the place check's code adds about 11 KB minified). `bash scripts/ci/check-contract-versions.sh`: OK at 0.4.0. `ops/up.sh --fresh` then the whole e2e suite: 191 passed, 7 skipped (the opt-in ones), 0 failed in 38.3 min, `details.spec.mjs` 12 of 12 among them (the review 390 px flake did not show). The plan's matrix also held against the made file in node before the e2e run.

## Review Triage Log

Quick lens, 2026-11-07: 3 findings; high 0, medium 1, low 2.

| Finding | Verdict | Evidence | Route |
| --- | --- | --- | --- |
| An offshore point whose swap lands on land reads "may be swapped" and never gets its sea named, every time its Details opens (Persian Gulf, Qatar's North Field, the Caspian, offshore Angola and Congo) | medium | `placeCheck.ts` `checkPair` flags any pair not on land whose swap is on land; the frozen rule flags only "a pair in no area", and a sea is an area | patch: "may be swapped" only for a pair in no land and no sea area whose swap lands in one; a point in a sea reads its sea |
| Some US county lines are misspelt or awkward: seven Puerto Rico municipios lost a letter ("Mayagez"), the US Virgin Islands read "Saint Croix (County Equivalent), Saint Croix, VI", DC reads "District of Columbia, District of Columbia, US" | low | `place-data.mjs` `countyName` takes `NAME_ALT` unchecked; Natural Earth's `NAME_EN` is correct in those rows but not kept | patch: the generator takes the right name field, drops a parenthesised type and never repeats the state; the data regenerated |
| `docs/place-check.md` says the last 64 lookups are kept; the code clears the cache at 64, keeping one | low | `lookUpKept` calls `kept.clear()` | patch: the cache drops its oldest entry, keeping the last 64 as the doc says |

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline` -- expected: BUILD SUCCESSFUL, with no network use.
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK at 0.4.0.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test` -- expected: green (the review 390 px flake may fail once; rerun it alone).
