---
title: "Release 0.3.0 on the template's test stack"
type: 'chore'
ticket: '13'
created: '2026-11-03'
status: 'built'
baseline_revision: 'bd64cc0'
route: 'full'
route_source: 'invocation'
risk: 'medium'
review: 'none'
review_source: 'invocation'
context:
  - '{project-root}/RELEASING.md'
  - '{project-root}/docs/template-install.md'
  - '{project-root}/docs/perf/README.md'
  - '{project-root}/_bmad-output/initiative-flowmap/tickets/epic-viewing/epic-viewing.md'
---

# Release 0.3.0 on the template's test stack (epic-viewing entry 13)

## Intent

The epic's release by RELEASING.md's checks for a minor release: one rehearsal on the template's test stack with a throwaway-signed build and the field simulator's live tags (scratch clone, never pushed), the owner's laptop reading of R11, the owner's Mapbox decision recorded, the CHANGELOG ready for the tag and a release notes draft; then (owner) the tag, the approval and publish, and `ops/release-smoke.sh 0.3.0`.

Verify (tickets.toml): on the template's test stack with the field simulator, a pad's alarm draws on the map and its popup reaches the pad's page in two clicks; a normal field shows no hue; `ops/release-smoke.sh 0.3.0` passes against the published release (owner step, after the tag).

## Decisions (2026-11-03, the coordinator's brief; the session is unattended)

1. **Perf run: none.** RELEASING.md runs `ops/perf.sh` before a minor tag only when the write path, the map store or the browser bundle changed. 0.3.0 changed the browser bundle (live values, labels, glyphs) and not the write path or the store. The measures the bundle touches are `bundle`, `open-to-drawn` and `frame-rate`; on the 4-CPU agent box frame-rate is software WebGL and says nothing about R11, which the owner's laptop reading answers (60.0 fps, below). The bundle size and open-to-drawn were not re-measured here **[not verified]**; the owner may run `ops/perf.sh --only bundle,open-to-drawn` on the laptop before the tag.
2. **The R11 reading** is recorded in `docs/perf/README.md`, "Frame rate on a laptop, release to release (R11)", the place the next release adds its own row.
3. **The Mapbox terms confirmation** is the owner's decision of 2026-11-03 in the epic's Notes (the client's own account and token, the logo and attribution shown); the logo moved bottom-right in the re-test (coordinator's task 7, same day).
4. **The rehearsal's scratch project** lives inside the stack worktree's `projects/Upstream` (never committed in either repository): Map Studio's popup link is a page path of the same project, so the two-click check to the template's `/pad/:field/:pad` page needs the map in Upstream itself. The template's generators own `projects/Upstream`, so this overlay exists only in the throwaway stack.
5. **The template stack ran on port 9101** (`TEST_GW_PORT`, the session's assigned port; the simulator API on 9102, the feedback stub on 9103) while this session's dev stack was down.

## Results (2026-11-03)

- **Rehearsal: passed.** Throwaway-signed 0.3.0 through the template's lock on its 8.3.9 test stack: `test stack: PASS`; `module_version` 0.3.0; the field simulator's live values on a scratch map inside `Upstream`: the three sites Ignition had in alarm drawn in alarm and every other site and well neutral, P12's flare pilot out drawn 44 s after the fault, its popup reaching `/pad/Mesa/P12` in two clicks, the bottom sheet at 390 px, comms lost on the P12 wells within 50 s of the RTU going offline; no Map Studio warning, no browser error. Records: `docs/template-install.md` "0.3.0 rehearsal", `docs/platform-checks.md` "Epic 3 entry 13", screenshots `docs/screenshots/template-0.3.0-rehearsal-*.png`.
- **R11:** the owner's laptop reading, 60.0 fps (the display's ceiling), recorded in `docs/perf/README.md`.
- **Release prep:** CHANGELOG `## 0.3.0` ready for the tag (no "Unreleased", the requirements line, the stories); `check-release-version.sh 0.3.0` and `check-contract-versions.sh` pass; the release notes draft `release-notes-0.3.0.md` beside the epic.
- **Owner steps left (hitl):** merge, tag `v0.3.0` on `main`, approve the `release` environment, fill the two TAG DAY values in the notes draft (the `.sha256` asset; confirm the certificate line), `modl-verify.sh` the draft's asset, publish, then `ops/release-smoke.sh 0.3.0`.
