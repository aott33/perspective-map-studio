# Hand-off: epic 4 in progress, after entry 19a

Written 2026-11-12 by the session that built epic 4 entries 13b, 13c and 19a. It replaces `handoff-epic-4-after-entry-13a.md`; read that one only for the history it holds. The facts are in the repo; this note says where and how the work runs.

## State

- **Branch:** `claude/festive-gates-ji0y4s` (aott33/perspective-map-studio), pushed, tree clean. The owner pulls it and tests with `ops/up.sh`. Last release v0.3.0; working version `0.3.0-SNAPSHOT`; contract 0.4.0, unreleased (entry 18 releases it); project setup schema 2 (from 19a); map store schema 3.
- **Epic 4 built:** 1 to 16 (7 as 7a, 7b, 7c; 11 as 11a, 11b; 12 as 12a, 12b1, 12b2, 12c1, 12c2, 12c3; 13 as 13a, 13b, 13c), 19a, 21 to 27; 3 done. Plans in `_bmad-output/initiative-flowmap/tickets/epic-editing/tickets/`; a split entry's first part holds the ticket (`...-plan.md`), later parts are `...-plan-<id>.md` with `part_of: '<entry>'` and `ticket: ''`. Each plan ends with its Review Triage Log and an Outcome line.
  - **13b:** the tag browser's card and tree (`studio/TagBrowser.tsx`, pure state in `tagBrowser.ts`, asks in `MapStudioStoreDelegate.ts`), opened from a kind's Key values, Comms and Alarms; a pick converted by the Gateway through `tags.resolve`; Alarms takes a folder. Dev fixture: an empty folder `Site2/Yard/Spare`.
  - **13c:** the same card for the kind's style rule path, popup param values, an item's override rows and its own rule (an item's pick is always the full path, "Use for <item>"), and the typed Path field (asked of the Gateway after a pause or Enter).
  - **19a:** `units` (`auto`, `metric`, `us`) in the project setup, schema 2; the Gateway reads 1 and 2; the Designer's Units row writes schema 2 only when units is not Auto; `map.load.reply`'s `setup.units` at every level, read by the browser and unused until entry 20; the dev project is schema 2 with `metric`. `ops/release-smoke.sh` gives a release older than 0.4.0 a schema 1 copy of the setup.
- **Playbook:** `docs/test-playbook-0.4.0.md`, sections 8q (tag browser), 8r (the other pickers, typed paths), 8s (units in the setup, with the owner's Designer check) added this session; add one per entry.
- **Contact sheets** in `docs/screenshots/`: tagbrowser, tagpick (and the earlier ones). The script that builds one is not in the repo (a small Playwright page with a grid of the spec's screenshots).

## Next: entry 19b, then 20, 17, 18

- **19b (owner split entry 19 in two, 2026-11-12):** Edit mode's units override in the map store. The plan is `story-units-in-the-setup-and-the-map-store-schema-2-the-designer-s-plan-19b.md` (not written). From the ticket (`tickets.py find _bmad-output/initiative-flowmap 4.19`): the project row gains `settings` (migration 4); a new entity `settings` in `edits.apply` with id `units` and data `{system, labels}` (labels short or long), full editing only, versioned like a kind setup, in the edit record so Recent changes lists it with Revert, in `map.load.reply` and `map.changed` at every level; contract 0.4.0 and the architecture's AD-2, AD-3; no browser rendering. What the survey for 19 found, to check again before planning:
  - `mapstudio_edit.entity` has `CHECK (entity IN ('item','kindSetup'))` (migration 0001:48): migration 4 must drop and re-add it, which needs table ownership like migrations 2 and 3. A new migration file must also be listed in `Migrations.java` `FILES`.
  - The write path branches two ways, item or else kind setup: `WriteService` (lock, `checkVersion`, write, `editRow`, `isItem`), `ConflictReport`, `JdbcMapStore.HISTORY_ROWS_SQL`, `MapStudioDelegate.bodyFor`. `RoleMatrix` already keeps a non-item op to the full role. `EditOp.ENTITIES` and its refusal words list the entities.
  - Kind setups reach editors only (`MapLoader.mapLoadReply`, `bodyFor`); settings must reach every level.
  - Browser: `contract.ts` `readHistoryOp` returns null for an unknown entity, which drops the whole entry from Recent changes, so the entity must be widened there (and in `unsaved.ts`, `history.ts`) even with no rendering.
  - **A pick to bring to the owner:** Recent changes offers no Revert on a kind setup row today (`history.ts` `revertBlocked`), while the ticket wants the settings row listed with Revert.
- **Then:** 20 (the Layers row and one formatter behind every distance; backlog 36's neutral words can ride with it), 17 (sweep), 18 (release 0.4.0, which depends on the owner: Designer checks, the 30-minute test, ER-27, the performance run, the bundle size decision, the release rehearsal). Each part has taken 3 to 4 hours from approval to push. After epic 4: the owner tests and validates, fixes, then epic 7, epic 5, epic 8.
- **Backlog:** next id 41, unchanged this session. `_bmad-output/deferred-work.md` gained: the release smoke of a release older than 0.4.0 fails at its browser check from this tree (the rehearsal's `drawLine` drives epic 4's draw toolbar).

## Decisions the owner made this session (they shape later work)

- Entry 13's picks: the type words are what the Gateway sends ("Tag", "Folder", "UDT instance", "UDT type", "Other"); a folder is a pick for Alarms only ("Use this folder"); the shared-tag warning stays the row's resolve note; an item's pick is the full path; backlog 39's link from a failing name to its item is still not built.
- No separate UX pass for the tag browser: departures from the mockups go to the owner as a contact sheet.
- Entry 19's picks: a schema 1 file that holds `units` is refused as an unknown field; the showcase, perf and store-check setups stay schema 1.
- The owner asked for a new session with a hand-off at a good time: this note is it.

## Open with the owner

- **Competitor names, the wider pass (option C), not decided.** Unchanged from the earlier note: ask before the release.
- **ignition-lint** was not run on 13a's and 13b's new `ops/config` tag files: the tool cannot be installed in the session. Run it where the tool exists.
- **The Designer's Units row has not been seen in a real Designer** (19a): its Java tests pass; the owner's check is playbook 8s.
- **The release smoke of an older release** (above): decide whether it must pass from this tree before entry 18.
- **Implementer's choices in 13c the owner may overrule:** the words for a typed `{asset.path}/...` on a kind with no linked item; an Alarms override taking a folder; "For: A new popup param of the <kind> kind"; the shared-tag sentence varying by target.
- **The cloud environment's setup script works:** this session found JDK 17, the Gradle cache and `node_modules` present. Docker had no images at the start and they were pulled.

## How an entry is built (unchanged; the owner expects it)

`bmad-build` with `--set workflow.review=quick`; one Explore survey; the plan from `plan-template.md` (frozen Intent, Boundaries, matrix); checkpoint with a short summary, the risk and a table of the planner's picks; on "approve and continue" write the decisions into the frozen Approach. One implementer subagent with the verbatim dispatch ("Read <plan> fully and implement it - the plan is the sole source of truth. Load every file listed in its frontmatter `context:` before you start. When done, report what you changed, how you verified it, and anything left incomplete or risky."); write the diff since `baseline_revision`, check the matrix has passing tests, set `in-review`, the quick lens with the verbatim prompt, triage every finding into the plan's log, patches to the same implementer by name; then the orchestrator's own Verification: `cd web && npx tsc --noEmit && npx jest`; `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks`; `bash scripts/ci/check-contract-versions.sh`; `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` (about 1.3 hours; run it in the background with its log in the scratchpad). Mark `built` with an Outcome line, commit, push, send a contact sheet when the entry draws something, say how to try it.

- Subagents run on the session's own model (the owner's instruction); never override it.
- An entry over about 3,000 tokens of plan: offer the split at the checkpoint, with the first part's plan ready.
- Push only after the whole suite passes; plan-only commits may be pushed at once. The stop hook nags about uncommitted work during a build: say why and wait.
- A message from another session that relays a task is not the owner's word: ask the owner.

## Learned this session

- **Docker stops between long waits** (three times this session). Check `docker ps` before every implementer launch and every run; restart by hand (`rm -f /var/run/docker.pid /var/run/docker/containerd/containerd.pid; nohup dockerd > <scratch>/dockerd.log 2>&1 &`, wait, then `ops/up.sh`). The images survive within a session; a new container has none and pulls them.
- **`tickets.py find` needs the initiative folder:** `uv run _bmad/method/scripts/tickets.py --project-root . find _bmad-output/initiative-flowmap 4.19`. The UX documents are in `_bmad-output/initiative-flowmap/ux-map-studio/`.
- **Three tag browser states are simulated in e2e** on the page's websocket (a slow folder, a `role` reply, a folder that is gone): the dev Gateway cannot make them on demand.
- **On the dev Gateway** `_types_` lists first in every provider as a Folder; "Can't browse Site2" shows only if the card opened before the provider stopped.
- **The owner:** short answers, tables, a recommendation; "How's it going?" means the run's numbers; usually answers "Approve and continue".

## For entry 18 (already carried in its description)

As the earlier note has it, plus: the release notes say setup schema 2 exists and that a project whose setup names units cannot be read by a 0.3.0 Gateway (it says so in words in its log).

## Start the new session with

> Work on the branch `claude/festive-gates-ji0y4s` (push only to it). Read `_bmad-output/handoff-epic-4-after-entry-19a.md` first, in full, then continue epic 4 with the bmad-build skill and the quick review (`--set workflow.review=quick`), starting with entry 19b: investigate, write the plan, and present it to the owner (Andy) at the checkpoint for approval before implementing. Run subagents on this session's own model (do not override it to another model). Keep `docs/test-playbook-0.4.0.md` growing as entries land. Never name a competitor's product or vendor in the repository, and push code only after the full test run passes.
