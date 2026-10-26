# Review - Verification lens (Map Studio architecture spine)

Date: 2026-10-26. Reviewed: architecture-map-studio.md and .memlog.md. Method: compared each committed decision and Stack row with the memlog's confirmed entries, then spot-checked unconfirmed claims on the web (results below; several fetches were inconclusive).

## Verdict

Mostly sound. The memlog confirms the core versions with sources (Ignition 8.3.10, io.ia.sdk.modl 0.5.0, perspective-client 2.x, maplibre-gl, terra-draw, turf). The spine gets three things wrong or leaves them open: some memlog caveats are lost, a few stack rows are unconfirmed, and the Mustry layout is not cited. None blocks the spike; two should be fixed in the spine text before it is final.

## Findings

### V1 (medium) - Stack row asserts what the memlog marks unconfirmed
- Stack lists `maplibre-gl 6.16.0` with `terra-draw-maplibre-gl-adapter 1.5.0`. The memlog says adapter peer range is `>=4` and v6 testing is unconfirmed. My web check found no source for adapter compatibility with maplibre-gl 6 either (only that v6 is ESM-only). The spine's "or the newest the Perspective toolchain builds" hedges the version but not the adapter pairing; AD-10 and the browser layer depend on this pairing.
- Also unreconciled: the 6.16.0 and 1.38.0/1.5.0 numbers were taken from the npm registry on the same day, but the one search result I saw for the adapter showed 1.2.3 (stale mirror, not contradictory). Re-run `npm view` in the spike and record the output.
- Action: mark the pair "unverified together" in the Stack table; make the spike's first task a build plus one draw/snap test on React 16.14, TS 4.9, webpack 5 (the open question already exists, but should gate the Stack row). Plan the fallback pin (maplibre-gl 4.x or 5.x) now, since the peer range allows it.

### V2 (medium) - Mustry layout (ops/, e2e/) is not shown as confirmed
- The Structural Seed copies `e2e/` and `ops/` and AD-13 uses "Mustry's e2e suite as the model". The memlog confirms only Mustry's package.json, plugin and versions. I could not fetch the Mustry repo (my guessed URL returned 404), so I cannot confirm either directory. The ops/ and e2e/ folders are the spine's own choice, which is fine, but the sources should not imply Mustry validates them.
- Action: either cite the Mustry repo path that shows these folders or state they are Map Studio's own layout. Cheap to do in the spike.

### V3 (medium) - Satellite decision rests on docs read, not terms read
- Confirmed by me: Mapbox's own "Use Mapbox APIs in MapLibre GL JS" guide shows `mapbox.satellite` through the Raster Tiles API (`api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90`, 256px tiles), so the technical approach and the memlog's per-tile billing note are consistent. Not confirmed: whether the Product Terms allow use in MapLibre on client SCADA sites. The spine marks AD-12 [ADOPTED] while the same file lists this as an open question.
- Action: change AD-12 status to adopted-pending-terms, or move the satellite part out of ADOPTED until the owner has read the terms. Also state the billing numbers (750,000 free, 0.25 USD per 1,000) are dated 2026-10-26 and should be rechecked at release; they are pricing and change.
- Minor: the Raster Tiles API serves JPEG tiles with 12 hour max-age; this matters for the "stale" wording nowhere, but the offline-tiles deferral should not promise caching beyond that.

### V4 (low) - "PostgreSQL as supported by the host's Ignition version" is a non-version
- AD-3 commits to PostgreSQL only, and the Stack row defers to Ignition. I found no IA support matrix for 8.3 in search (only 8.3.10 release notes showing PostgreSQL connection defaults `autosave=always` and `cleanupSavepoints=true`, via a forum post). Those defaults matter: autosave=always changes statement and savepoint behaviour inside the AD-2 transaction, and the migration code should be tested with them.
- Action: record the minimum PostgreSQL version and bundled JDBC driver in the spike, from IA's 8.3 system requirements page, and test migrations with the 8.3.10 defaults. State a tested minimum in the Stack.

### V5 (low) - Playwright left "set in the spike"
- Acceptable, but verifiable now: the best result I found lists 1.62.1 stable (npm mirror, early Aug 2026, 1.63 alpha builds); the same sources note 1.60 caused integration breakage for some users. Not confirmed on the npm page itself.
- Action: pin the exact version in the spike and record it; use `npm view playwright version` at that time.

### V6 (low) - Items asserted as fact but in the unverified bucket
These are correctly flagged open, but the spine's AD text reads as settled in places: AD-6 (Java subscriptions reach Alarm Metrics: open), AD-5 (custom project resource type: open, with fallback), AD-7 custom popup view embedding (open). The memlog rule says every Perspective client/SDK claim stays unverified until checked on a live 8.3 Gateway and recorded in claude-ignition-skills. Suggest each AD that depends on an open question names it ("depends on spike S-n") so a reader cannot take it as verified.

### V7 (info) - Things checked and fine
- Java 17, Ignition 8.3.10 (2026-10-06), io.ia.sdk.modl 0.5.0, node-gradle 7.1.0/Node 22, perspective-client 2.x with React 16.14.0 and TS 4.9: confirmed in the memlog with sources (not rechecked by me, no contradicting evidence found).
- maplibre-gl 6 exists and is ESM-only (OpenStreetMap dependency bump to 6.0.0, July 2026), consistent with the memlog.
- No technology named in the spine appears dead or replaced; deck.gl is correctly deferred.

## Not verified by me
Mustry module layout, adapter-with-maplibre-6 compatibility, Mapbox Product Terms, IA's PostgreSQL support matrix, current exact npm versions. All need the spike or the owner.

Sources: https://docs.mapbox.com/help/dive-deeper/mapbox-in-maplibre/ ; https://docs.mapbox.com/api/maps/raster-tiles/ ; https://lists.openstreetmap.org/pipermail/rails-dev/2026-July/051237.html ; https://forum.inductiveautomation.com/t/ignition-8-3-10-is-available-for-download/117365 ; https://releasealert.dev/npmjs/_/playwright
