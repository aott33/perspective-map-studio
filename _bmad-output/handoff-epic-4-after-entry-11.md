# Hand-off: epic 4 in progress, after entry 11

Written 2026-11-09 by the session that built epic 4 entries 10 and 11 (as 11a and 11b) and split entry 12. It replaces `handoff-epic-4-after-entry-9.md`; read that one only for the history it holds. The facts are in the repo; this note says where and how the work runs.

## State

- **Branch:** `claude/festive-gates-ji0y4s` (aott33/perspective-map-studio), pushed, tree clean. The owner pulls it and tests with `ops/up.sh`. Last release v0.3.0; working version `0.3.0-SNAPSHOT`; contract 0.4.0, unreleased (entry 18 releases it); **map store schema 3** since entry 11a.
- **Epic 4 built:** 1 to 11 (7 as 7a, 7b, 7c; 11 as 11a and 11b), 14, 15, 16, 21 to 27; 3 done. Plans in `_bmad-output/initiative-flowmap/tickets/epic-editing/tickets/`; a split entry's first part holds the ticket (`...-plan.md`), later parts are `...-plan-<id>.md` with `part_of: '<entry>'` and `ticket: ''`.
  - **Entry 10** (save problems): the conflict, store-unreachable and busy cards; a save answered store-unreachable pauses the tools until the store answers; the second tab's 15 s replay. 282 passed.
  - **Entry 11a** (Gateway): migration 0003 keeps each op's values before and after, and the item's name and kind, on `mapstudio_edit`; `edits.history {before?, limit?}` newest first in pages (50 entries, or fewer once a page reaches 1,000 ops; a batch never split); level `none` refused `role`. 288 passed; `ops/store-checks.sh upgrade` passed.
  - **Entry 11b** (browser): the rail's History surface (clock glyph, 340 px dock, the owner's option A), Recent changes with the next undo step, rows that expand to before and after, Revert as one undo step (waits while an edit of its items is in flight; refused with entry 10's conflict card when the item changed since); "Saved" opens it. A second dev map editor `mapeditor2` exists for two-editor specs: the owner runs `ops/up.sh` once after pulling so `.env` gets its password. 293 passed, 0 failed.
- **Playbook:** `docs/test-playbook-0.4.0.md`, sections 8h (save problems), 8i (the edit record), 8j (Recent changes) added this session; add one per entry.
- **Open question to the owner, unanswered:** a refused Revert shows entry 10's conflict card, which also offers "Apply mine on top" (it would force the revert over the newer change). Ask whether to hide it for a Revert; until then it stays.

## Next: entry 12, split by the owner (2026-11-09, "go with recommended")

- **12a first** (holds ticket 12, plan `story-the-kinds-screen-sections-the-preview-item-style-rules-and-t-plan.md`): the Kinds surface (replacing the placeholder in `web/typescript/MapStudio.tsx` `renderDock`) listing the project's kinds with the asset list's status in words; a kind's setup with the header (the preview item select, the override count) and the sections Icon (read-only from the adapter), Key values, Comms, Alarms, Popup (parts, link, custom popup view path and params in R39's three forms, the placeholder picker); saves as kindSetup ops through `edits.apply` with the Gateway's refusal words beside the field; each path's resolve note from `tags.resolve` (needs a production sender; it needs the preview item linked to an asset).
- **12b** (`...-plan-12b.md`): the Style rule section (States, Bands, Expression, a line's instruments, area tints, preset tiles). Decision: States and Bands preview live on the map through a TypeScript port of `common/.../contract/StyleRule.java` (shared test vectors); an Expression shows on the map only after it saves, with a note saying so.
- **12c** (`...-plan-12c.md`): per-item overrides: the Style tab, Details' Live now block with full-path overrides, Override with Reset, From kind.
- **Decisions for all of 12:** icon, size and label stay read-only (editable is backlog 38, a contract change); kind setup saves are not Undo steps (no Undo or Revert for them; Recent changes already lists them with no Revert, 11b).
- The survey of entry 12's code (where everything is) is summarised in this session's notes; re-survey with one Explore subagent before the 12a plan. Key facts found: the setup's parts are exactly `comms, kpis, alarms, link, popupView, styleRule, areaTints` (`KindSetup.java:38`); the validator `KindSetup.parse` and `Placeholders.checkParam` hold the refusal words; `writeKindSetup` in `WriteService.java` answers `invalid` as "Op N (id): part: words"; `delegate.kindSetups` is already live for editors; `sendBatch` and `undo.ts` are item-shaped; `StylePreview.tsx` has the preset tiles; `kindsetup.spec.mjs` saves setups through the test hook.
- **Then, in order:** 13 (tag browser), 19 and 20 (units; backlog 36's neutral words can ride with 19), 17 (sweep), 18 (release 0.4.0). After epic 4 (owner, 2026-11-08): the owner tests and validates, fixes, then epic 7 (the template cutover), epic 5 (import and export), epic 8.
- **Backlog:** next id 39. Added this session: 37 (the edit record's retention), 38 (icon, size and label editable).

## How an entry is built (unchanged; the owner expects it)

`bmad-build` with `--set workflow.review=quick`; one Explore survey; the plan from `plan-template.md` (frozen Intent, Boundaries, matrix); checkpoint with a short summary, the risk and a table of the planner's picks. The owner often asks for `bmad-party-mode` first (the room: Mary, John, Sofia, Sally, Winston, Amelia, Smithy; memory in `_bmad-output/party-mode/memories/installed/.memlog.md`), then "approve and continue": write the decisions into the frozen Approach. One implementer subagent with the verbatim dispatch ("Read <plan> fully and implement it - the plan is the sole source of truth. Load every file listed in its frontmatter `context:` before you start. When done, report what you changed, how you verified it, and anything left incomplete or risky."); stage the diff since `baseline_revision`, check the matrix has passing tests, set `in-review`, the quick lens with the verbatim prompt, triage every finding into the plan's log, patches to the same implementer; then the orchestrator's own Verification: `cd web && npx tsc --noEmit && npx jest`; `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks`; `bash scripts/ci/check-contract-versions.sh`; ignition-lint on changed Ignition files; `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` (about 60 minutes). Mark `built` with an Outcome line, commit, push, send a contact sheet (saved in `docs/screenshots/`), say how to try it.

- An entry over about 3,000 tokens of plan: offer the split before planning (the owner split 7, 11 and 12).
- Push only after the whole suite passes; plan-only commits may be pushed at once. The stop hook nags about unpushed or uncommitted work during a build: say why and wait.
- A layout that departs from DESIGN.md goes to the owner with screenshots before it is final (11b's dock width).

## Learned this session

- **A fresh container has nothing:** no Docker images, no JDK 17, no Gradle distribution or dependency cache. Fixes that worked: start `dockerd` by hand (`rm -f /var/run/docker.pid /var/run/docker/containerd/containerd.pid; nohup dockerd > <scratch>/dockerd.log 2>&1 &`), `docker pull postgres:16-alpine` and `inductiveautomation/ignition:8.3.10`; `apt-get install -y openjdk-17-jdk-headless`; the Gradle wrapper's zip with `curl` into `~/.gradle/wrapper/dists/gradle-9.8.0-bin/<hash>/` (delete the `.part` file); then one online `./gradlew clean build --rerun-tasks` to fill the cache (Maven Central answers 429 at times: retry with backoff), after which `--offline` works. Container restarts stop Docker again; images survive.
- **A shallow clone** may make the remote branch look unrelated: `git fetch --unshallow origin <branch>` before comparing.
- **Implementers cannot always run e2e:** a report that the suite did not run is unfinished work; get the stack up and send the failures back. Flaky tests were each a test bug (a disabled button as the Tab start; a second edit typed into a paused form); fix the cause, never skip.
- **No em dashes** includes tests that assert their absence: write `'—'`.
- **The owner:** short answers, tables, a recommendation; "How's it going?" means the run's numbers; prefers party mode before approving bigger plans; wants subagents run on the model the owner names (ask at the start of a session if unsure).

## For entry 18 (already carried in its description)

ER-27 (the you-are-here marker, the distance rows, View alarms in the footer), the owner's Designer checks, the 30-minute test, the performance run (bundle size, the place file, the viewport's Gateway cost, `edits.apply` with 10 editors, and now the store's size after ten imports of the dev field), and the release notes' line that the schema 3 upgrade needs the module's database role to own the tables and have CREATE on the schema.

## Start the new session with

> Read `_bmad-output/handoff-epic-4-after-entry-11.md` in full, then continue epic 4 with bmad-build and the quick review (`--set workflow.review=quick`), starting with entry 12a: investigate, write the plan, and present it to the owner (Andy) at the checkpoint for approval before implementing.
