# Hand-off: epic 4 in progress, after entry 9

Written 2026-11-09 by the session that built epic 4 entries 15, 16, 7 (as 7a, 7c, 7b), the flaky-test fix and 8, and started 9. It replaces `handoff-epic-4-after-entry-14.md`; read that one only for the history it holds. The facts are in the repo; this note says where and how the work runs.

## State

- **Branch:** `claude/festive-gates-ji0y4s` (aott33/perspective-map-studio), pushed. The owner pulls it and tests with `ops/up.sh`. Last release v0.3.0; working version `0.3.0-SNAPSHOT`; contract 0.4.0, unreleased (entry 18 releases it).
- **Epic 4 built:** 1 to 8 (7 as three plans: 7a the list `...-layout-plan.md` holds ticket 7, 7c and 7b are `...-plan-7c.md` and `...-plan-7b.md` with `part_of: '7'`), 14, 15, 16, 21 to 27; 3 done. Entry 9 (instruments) was being built when this note was written: check its plan's `status` and `## Review Triage Log`; if `in-progress` with commits after `70f6fa9`, resume at the review (step 4), else at implementation.
- **The flaky-test fix** (`_bmad-output/plan-fix-three-flaky-tests.md`, built): the e2e `view()` helper waits for the map to go idle, the Gateway setup lookups' thread race fixed, R4 (a) diagnostics in place. Three whole-suite runs in a row since were clean (260, 260, 272 passed, 0 failed). A failure now is real until shown otherwise.
- **Playbook:** `docs/test-playbook-0.4.0.md`, sections 8a to 8f added this session (Locate me, Directions, the item list, the layout, first run, selecting several); add one per entry.

## Next

1. **Epic 4 in order:** finish 9, then 10 (save problems), 11 (Recent changes, high, may split), 12 (the Kinds screen, high, will likely split), 13 (tag browser), 19 and 20 (units; backlog 36's neutral words can ride with 19's schema 2), 17 (sweep), 18 (release 0.4.0).
2. **Then (owner, 2026-11-08, `initiative-flowmap/.memlog.md`):** the owner tests and validates, fixes, then **epic 7, the template cutover** (Mesa moved into the map store by a one-off migration), then epic 5 (import and export), then epic 8.
3. **Backlog:** next id 37. Added this session: 36, industry-neutral words in the module's own text (owner: the oil and gas and the solar demos are the two demos).

## How an entry is built (unchanged; the owner expects it)

`bmad-build` with `--set workflow.review=quick`; one Explore survey; the plan from `plan-template.md` (frozen Intent, Boundaries, matrix); checkpoint with a short summary, the risk and a table of the planner's picks (the owner usually answers "Approved and continue" or "Go with recommendations": write the picks into the frozen Approach); one opus implementer with the verbatim dispatch; stage the diff, check the matrix has tests, the quick lens with the verbatim prompt, triage every finding into the plan's log, patches to the same implementer; then the orchestrator's own Verification: `cd web && npx tsc --noEmit && npx jest`; `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks`; `bash scripts/ci/check-contract-versions.sh`; ignition-lint on changed Ignition files; `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off`. Mark `built` with an Outcome line, commit, push, send a contact sheet (built from `e2e/out/screenshots`, saved in `docs/screenshots/`), say how to try it.

- An entry over about 3,000 tokens of plan: offer the split at step 1 (the owner chose to split 7).
- Push only after the whole suite passes; plan-only commits may be pushed at once. The stop hook nags about unpushed work during a build: say why and wait.

## Learned this session

- **"No Connection to Gateway" in a Playwright snapshot means nothing:** Perspective always renders that banner off-screen. Do not read it as a lost connection.
- **ignition-lint:** the implementer subagents cannot install it; the orchestrator can (`python3 -m venv <scratch>/il-venv && <scratch>/il-venv/bin/pip install -q ignition-lint-toolkit`). Run it yourself and log the result in the triage.
- **The empty dev project** `mapstudio-empty` (`/empty`) is the dev project folder mounted twice (Map Studio sets up only non-inheritable projects); `ops/up.sh` recreates an older Gateway container once to add the mount.
- **Container restarts** stop Docker every few hours: `rm -f /var/run/docker.pid /var/run/docker/containerd/containerd.pid; nohup dockerd > <scratch>/dockerd.log 2>&1 &`, then `docker info`.
- **Owner's preferences seen again:** short answers, tables, a recommendation; asks "How's it going?" (answer with the run's numbers); flaky tests are not acceptable (fix the cause, never skip); no competitor names in the repository; the template matters: estimates were asked for (about 2.5 to 3 weeks of sessions to the template on Map Studio as of 2026-11-08).

## For entry 18 (already carried)

ER-27 (the you-are-here marker, the distance rows, View alarms in the footer), the owner's Designer checks (the map's five events, `selectedItems`, the props list), the 30-minute test, and the performance run named in the earlier hand-off.

## Start the new session with

> Read `_bmad-output/handoff-epic-4-after-entry-9.md`, then continue epic 4 with bmad-build and the quick review, presenting each plan to the owner at the checkpoint.
