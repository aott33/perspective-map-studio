---
title: "You are here and Locate me from the page's geolocation binding"
type: 'feature'
ticket: '15'
created: '2026-11-07'
status: 'built'
baseline_revision: '7ebffc92a6a11b76fef0a40334bbe53372c95064'
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

**Problem:** A phone user in the field cannot see where they stand on the map, so finding the nearest pad means reading the map against the landscape; the page has the device's position in `session.props.geolocation` but no way to give it to the map.

**Approach:** Decisions (owner, 2026-11-03: R50 as a prop in the session property's own shape, the module reading nothing of the session and asking the browser for nothing; 2026-11-06, entry 3: the marker in the theme's qual-1, "You are here" in the legend, Locate me last in the zoom card, off with its reason in words; 2026-11-07, "Approved" on the planner's picks, then "Go with recommendations" after the implementer found a browser's `permissionGranted` stays null: an unbound prop shows Locate me off with "location is off for this session", the marker sits above areas and lines and below point markers, and it works in both modes). A `userLocation` prop in the closed list, the marker drawn from it, Locate me moving the map to it, contract 0.4.0 and a `/locate` dev page.

## Boundaries & Constraints

**Always:** `userLocation` takes `session.props.geolocation`'s shape in one binding: `{enabled, permissionGranted, options, data: {latitude, longitude, accuracy, altitude, heading, speed, timestamp}}`, every key optional and extra keys tolerated. A position is known when `enabled` is true, `permissionGranted` is not false (null counts: a browser session leaves it null on 8.3.10, only the mobile app sets it; owner, 2026-11-07, "Go with recommendations") and `data` has finite latitude in [-90, 90] and longitude in [-180, 180]. With a position, the marker draws as DESIGN.md `components.you-are-here`: a 14 px dot in `--qual-1` with a 2 px white ring, over an accuracy circle at the map's scale (the `accuracy` metres as a true circle on the ground, `--qual-1` at 14% fill with a 1 px `--qual-1` edge; none when accuracy is missing or not positive), and a heading wedge from the dot when `heading` is a finite number, turning with the map; above areas and lines, below point markers and the popup; no label; it follows each new position without moving the map; it repaints on a theme change. It is never a map item: not clickable, not in the list, Needs you, search, the store, a batch or `system.mapstudio.getMap`. With a position the legend's States end with the dot and "You are here" (in Edit mode on the rail's Legend tab too). Locate me is the zoom card's last button (after Return), a navigation-arrow glyph; with a position it centres the map on it at zoom 15 or the current zoom if closer, as Zoom to location eases; without one it is faded and inert, its `title` and accessible description: "Locate me - location is off for this session" (prop null or `enabled` not true), "Locate me - location permission not granted" (`permissionGranted` false), "Locate me - no location fix yet" (no valid `data`); with a position, "Locate me". Both modes, 1366 and 390 px (44 px target on the phone). A malformed value is treated by the same rules, never thrown. No em dashes; Ignition files pass ignition-lint.

**Never:** Read `session.props` or the client store's location in the component (entry 2's `data-client-location` diagnostic goes), or call `navigator.geolocation` or the Permissions API anywhere in `web/`. Follow the user (no tracking mode), draw distances, Directions or Nearest (entry 16). Change `gateway/` or `designer/` main code, a message to the Gateway, or a test's expectation beyond adding the new prop and page to lists that enumerate them.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fix | /locate, a plain browser granting (`permissionGranted` null) or the app (true), position near CTB1, accuracy 40, no heading | Dot with ring and a 40 m circle at CTB1; legend row; Locate me active | No error expected |
| Locate me | The map panned away, Locate me pressed | Map centred on the position, zoom at least 15 | No error expected |
| Heading | The same with heading 90 | Wedge pointing east, turning with the map's bearing | No error expected |
| Moves | The position changes | Marker moves; the camera stays | No error expected |
| Denied | `permissionGranted` false (the mobile app's refusal) | No marker, no legend row; Locate me off, "location permission not granted" | No error expected |
| Off | `enabled` false (or the prop unbound, null; a browser's refusal turns `enabled` off) | No marker; Locate me off, "location is off for this session" | No error expected |
| No fix | Enabled and granted, `data` empty or latitude 999 | No marker; "no location fix yet" | No error expected |
| Not an item | A position on the map | Not in the list, Needs you, search; a click on it selects nothing | No error expected |
| Phone | The Fix row at 390 px | Marker drawn, Locate me a 44 px target, legend sheet row | No error expected |

</frozen-after-approval>

## Code Map

- `common/src/main/resources/mapstudio.props.json` -- add `userLocation` after `viewport` (object or null, default null, nested schema for the known keys, `additionalProperties` allowed, description naming the one binding); `MapStudioComponentTest.java:97` key order and 103-112 shape checks gain it. No Java change otherwise.
- `web/typescript/MapStudio.tsx` -- `MapStudioProps` (86-109) and `getPropsReducer` (1497-1504) read `userLocation` as an object; `componentDidUpdate` (about 460) compares `prevProps` and redraws; layers are added in `map.on('load')` (354-388); `onZoomToLocation` (934) is the model for Locate me (`fitKey = null`, `easeTo` with `camera.cameraPadding`, `publishFit`); `applyTheme` (437) repaints.
- New `web/typescript/userLocation.ts` -- pure: parse the prop to `{state: 'off' | 'denied' | 'nofix' | 'fix', position?, accuracy?, heading?}` and the hover words; the accuracy circle polygon (64 vertices, metres on the ground); style after `startingArea.ts`.
- `web/typescript/mapLayers.ts` -- source and layer ids (26 on), add a `you-are-here` source with the circle fill, its edge, the ring and dot (circle layers) and the wedge (a symbol from an image added with `map.addImage`, `icon-rotate` from heading, `icon-rotation-alignment: map`), inserted above lines and areas and below the point markers; `THEME_TOKENS` (141) gains `--qual-1`; `applyThemePaint` (548) repaints it. Never add these layers to the click or hover query lists.
- `web/typescript/theme.ts:8` `themeColor` reads tokens (MapLibre takes no `var()` or `color-mix`; the 14% is a `fill-opacity`).
- `web/typescript/ZoomControl.ts` -- add Locate me after Return (`button()` 48-61 sets `title` and `aria-label`; add `aria-description` for the reason) and a `setLocate(state)`; constructor gains `onLocate`; built at `viewControls.ts:53`. `controls.ts:17` `GLYPH_PATHS` gains `navigate` (currentColor, no fill, as `controls.test.ts` requires).
- `web/typescript/legend.ts` (`STATE_ROWS` 86-93, `legendKey` 117, `sameLegendKey` 176) and `LegendControl.ts` (`renderKey` 441-452) -- a "You are here" row only with a position, its sample an inline SVG dot and ring (`svgEl` 45); the Edit-mode rail's Legend tab uses the same key.
- `web/typescript/mapstudio.css` -- the disabled Locate me look as Return's, the sample's colours from `--qual-1`.
- Dev project: `ops/project/com.inductiveautomation.perspective/page-config/config.json` gains `/locate` -> `MapStudioLocate`; new `views/MapStudioLocate/` (the map with `userLocation` bound to `{session.props.geolocation}`, a startup script setting `session.props.geolocation.enabled = True`, an "Location off" toggle writing it, a label showing the bound value for the suite). `designer/src/test/.../ProjectResourcesTest.java:69` and `ProjectListsTest.java:39` list the pages: add `/locate`.
- e2e: new `e2e/tests/locate.spec.mjs` with `fixtures.mjs` (`openMap`, `view`, `shot`), `context.grantPermissions(['geolocation'])` and `context.setGeolocation(...)` for the real path; 1366 and 390 px blocks as `events.spec.mjs:187,459`.
- Docs: `docs/contract.md` line 3 and the props table (143-155); `docs/platform-checks.md` "Epic 4 entry 15" (whether a page script can turn `enabled` on, and whether a browser position reaches the binding on 8.3.10); `docs/development.md` (the page); `CHANGELOG.md` 0.4.0; `docs/test-playbook-0.4.0.md` a section "You are here and Locate me".

## Tasks & Acceptance

**Execution:**
- [x] `common/` schema and its test -- the prop declared and documented.
- [x] `web/typescript/userLocation.ts` + `__tests__/userLocation.test.ts` -- every matrix input parsed, the words, the circle.
- [x] `mapLayers.ts`, `MapStudio.tsx`, `ZoomControl.ts`, `controls.ts`, `viewControls.ts`, `legend.ts`, `LegendControl.ts`, `mapstudio.css` + Jest (legend key with and without a position, zoom card state words) -- the marker, the legend row and Locate me.
- [x] `web/typescript/__tests__/noGeolocation.test.ts` -- fails if any `web/typescript` source (tests excluded) names `navigator.geolocation`, `getCurrentPosition`, `watchPosition` or `permissions.query`.
- [x] `ops/project/` -- `/locate`, ignition-lint clean; the two Designer tests list it.
- [x] `e2e/tests/locate.spec.mjs` -- the matrix at 1366 and 390 px with a mocked position, screenshots for the owner.
- [x] Docs, CHANGELOG and the playbook section.

**Acceptance Criteria:**
- Given the dev Gateway as `mapeditor` and a browser granting a mocked position, when `/locate` opens, then the matrix holds at 1366 and 390 px.
- Given a fresh dev stack, when the whole e2e suite runs, then every spec passes (the known review 390 px flake may fail once and pass rerun alone).

## Implementation Notes

- Planner, 2026-11-07: the environment, commit and identity rules are entry 14's plan's (Docker started by hand after a container restart, `ops/up.sh --fresh` before a whole-suite run with nothing else against the stack, the two trailer lines from the session's attribution reminder, `git commit --only` your paths, no em dashes, no model identifier, never a bare `git stash`, never a push). Commit at each working milestone. ignition-lint: `pip install ignition-lint-toolkit` in a scratch venv, then `ignition-lint --files <view.json or code.py>`; zero errors and warnings, naming hints recorded.
- Planner: if `session.props.geolocation` cannot be turned on from the page or the mocked position does not reach it on 8.3.10, record it in `docs/platform-checks.md`, turn it on in the project's session props instead, and stop to report if the binding still gets nothing; do not read the store instead.

- Approval (owner, 2026-11-07): "Approved" with the planner's three picks (unbound prop shows Locate me off; marker below point markers; both modes), written into the Approach; the plan, over size, kept whole.

## Plan Change Log

- 2026-11-07 (implementer): the code. `userLocation.ts` reads the prop into `{state, position, accuracy, heading}` (a heading wrapped to 0 to 360), gives Locate me's words, the accuracy ring (64 vertices by the great-circle destination formula, closed, longitudes wrapped) and the wedge image's RGBA pixels (a 64 px cone pointing north, reaching 30 px, drawn in the token's colour; transparent while the token resolves to no colour, so the missing image resolver is never asked). `mapLayers.ts` adds the source `mapstudio-you-are-here` and the layers `mapstudio-you-accuracy-fill`, `-accuracy-edge`, `mapstudio-you-wedge` (symbol, `icon-rotate` from the heading, `icon-rotation-alignment: map`) and `mapstudio-you-dot` (one circle layer: a 7 px radius in `--qual-1` with a 2 px white stroke) after the unsaved layers and before the text layers, so the marker sits above areas, lines and the unsaved items and below the point text, markers and arrow; `--qual-1` joins `THEME_TOKENS` and `applyThemePaint` repaints the three paints and updates the wedge image in place. `MapStudio.tsx` `applyUserLocation` (mount, map load and every `componentDidUpdate`) draws the marker, sets Locate me and the legend's row from one reading, keyed so an equal value does nothing; `onLocate` eases as `onZoomToLocation` does with `LOCATE_ZOOM` (15, the search's chosen point zoom). Locate me is inert with `aria-disabled` (still focusable, so its reason is read) rather than `disabled`, and styled as Return disabled. The legend's key gains an optional `you` (present only when true, so a key without a position equals the keys built before); `LegendControl.setYouAreHere` and `legendKey`'s fourth argument set it. `data-you-are-here`, `-at`, `-accuracy`, `-heading` and `-drawn` are on the map for the suite.
- 2026-11-07 (implementer): the platform. On 8.3.10 a page script turns `session.props.geolocation.enabled` on and the browser's position reaches the binding, but a browser session's `permissionGranted` stays null after a position arrives (the client writes it only from the Perspective mobile app's `native/gpsPermission` message, and false on any watch error, which also turns `enabled` off; a script may not write `data` or `permissionGranted`). By the frozen rule a plain browser therefore shows no marker and Locate me reads "permission not granted"; a browser's refusal reads Off. Recorded in `docs/platform-checks.md`, "Epic 4 entry 15"; the rule was not changed (human-owned intent): the owner decides whether a position with `permissionGranted` null counts. Nothing went into the project's session props, since the page's script works.
- 2026-11-07 (implementer): the suite. `locate.spec.mjs` stands in for the mobile app's grant through the client's own bridge (`window.__webInterface.submitData({type: 'native/gpsPermission', data: {granted}})`), gives a heading through CDP's `Emulation.setGeolocationOverride`, makes No fix a watch that never answers (an init script), and moves the position with the location turned off and on around it (Chromium fails a running watch when its override changes, POSITION_UNAVAILABLE). A further test checks the plain browser's path as it is (position with `permissionGranted` null: "permission not granted"; a refusal: Off). The dev page's "Write geolocation" control was dropped once the Gateway refused a script's write to those keys. ignition-lint was not run: installing `ignition-lint-toolkit` was refused in this session's sandbox, so `MapStudioLocate/view.json` is unlinted (its scripts follow `/events`' pattern, each in a try with `java.lang.Throwable` and `Exception`).
- 2026-11-07 (implementer): verified. `cd web && npx tsc --noEmit && npm test`: clean, 594 tests in 58 suites (565 before). `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks`: BUILD SUCCESSFUL, 520 JVM tests, none failed (`MapStudioComponentTest` 4 of 4 with `userLocation`; `ProjectListsTest` and `ProjectResourcesTest` with `/locate`); the container had lost its JDK 17, reinstalled with apt (`openjdk-17-jdk-headless`). `bash scripts/ci/check-contract-versions.sh`: OK at 0.4.0. `ops/up.sh --fresh` then the whole e2e suite: 210 passed, 7 skipped (the opt-in ones), none failed, in 42.0 min; `locate.spec.mjs` 10 of 10 among them. ignition-lint: not run (see above).
- 2026-11-07 (implementer, after the owner's decision "Go with recommendations"): `readUserLocation` now treats `permissionGranted` null or absent as granted and only `false` as denied, so a plain browser shows the marker; the unit tests, `locate.spec.mjs` (the plain-browser test expects the marker, an active Locate me and the legend row; the bridge's grant and refusal kept; the browser's refusal still Off), the prop's description, `docs/contract.md`, `docs/platform-checks.md` (the open question closed), `CHANGELOG.md` and the playbook follow. Entry 2's `clientLocationWords` and `data-client-location` are removed from `MapStudio.tsx`, and their check from `studio.spec.mjs`. Verified: `tsc` clean, Jest 596 in 58 suites, `:common:test` green, and on the stack (Docker restarted by hand, `ops/up.sh`) `locate.spec.mjs` and `studio.spec.mjs` 30 of 30.
- 2026-11-07 (implementer, after the coordinator's review): `userLocation.enabled` and `permissionGranted` take a boolean or null in the schema (a browser binds null), asserted in `MapStudioComponentTest`; the `/locate` Location off script is in the same try as the startup's; the legend draws the you-are-here row only at the end of the fixed States (`legend.ts` `showsYouRow`), so a fix before the items load opens no section holding it alone; the map publishes `data-you-wedge` (the wedge's evaluated rotation and its alignment), and `locate.spec.mjs`'s Heading test checks `90|map` and its Not an item test checks the Needs you bar's label is the same with the marker drawn and with the location off. Verified: `tsc` clean, Jest `legend`, `userLocation` and `youAreHere` 33 of 33, `:common:test` green, `locate.spec.mjs` 10 of 10 on the stack (the first `ops/up.sh` build failed once on `SetupLookupsTest` `aHungSecretProviderHoldsOneThreadAndNeverTheOtherLists`, a timing test in `gateway/` untouched here, and passed on the rerun).

## Review Triage Log

Quick lens, 2026-11-07: 6 findings; high 0, medium 1, low 3, false 2.

| Finding | Verdict | Evidence | Route |
| --- | --- | --- | --- |
| `permissionGranted` and `enabled` typed boolean only, while the prescribed binding gives null in every browser session | medium | `mapstudio.props.json` `userLocation.properties`: both `"boolean"`; the data leaves allow null; platform-checks records null in a browser | patch: both `["boolean","null"]`, the component test asserting it |
| ignition-lint never run on `MapStudioLocate/view.json` | false | Run by the orchestrator, ignition-lint-toolkit in a scratch venv: 0 errors, 0 warnings, 6 naming hints (the dev views' lower camel case names) | rejected |
| The `locationOff` onChange script writes the session prop with no try, against the plan's claim | low | `view.json` `props.selected.onChange`: a bare write; onStartup has the try | patch: the same try and log as onStartup |
| Before the items load, a fix opens a States section holding only "You are here" | low | `LegendControl.ts` 453 opens States on `key.you` alone; `EMPTY_KEY.states` is empty until `drawItems` | patch: States opens only with its rows, the you row at its end |
| The 390 px block covers only Fix, Locate me, the sheet and Off | false | The matrix's Phone row is "The Fix row at 390 px"; the 390 px test covers it (marker, 44 px Locate me, the sheet's row) | rejected |
| The Heading test never checks the wedge's direction or map alignment; Not an item names a Needs you check it never makes | low | `locate.spec.mjs` 180-193 reads only `data-you-heading` and the drawn count; 299-336 has no Needs you assertion | patch: assert the rotation and alignment, and the Needs you counts |

Outcome, 2026-11-07: the four patches applied (9dd65a4) and verified by the orchestrator: `tsc` clean, Jest 597 passed in 58 suites, `./gradlew clean build --offline --rerun-tasks` green, the contract check OK at 0.4.0, ignition-lint on `MapStudioLocate/view.json` 0 errors, 0 warnings, 6 naming hints, and `ops/up.sh --fresh` with the whole e2e suite: 210 passed, 7 skipped, 0 failed in 43.6 min (`locate.spec.mjs` 10 of 10). The marker's look goes to entry 18's ER-27 review; a real phone and the Perspective mobile app are the owner's playbook check.

## Design Notes

The accuracy circle is a GeoJSON polygon rather than a circle layer, so it stays true at every zoom and latitude without a zoom expression. The wedge is an image rotated by MapLibre, so the map's bearing turns it for free. One parser decides marker, legend row and button together, so the three never disagree.

## Verification

**Commands:**
- `cd web && npx tsc --noEmit && npx jest` -- expected: clean.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks` -- expected: BUILD SUCCESSFUL.
- `bash scripts/ci/check-contract-versions.sh` -- expected: OK at 0.4.0.
- `ignition-lint --files` on the new view -- expected: zero errors and warnings.
- `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` -- expected: green (the review 390 px flake may fail once; rerun it alone).
