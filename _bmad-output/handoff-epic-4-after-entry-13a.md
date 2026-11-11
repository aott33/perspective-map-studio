# Hand-off: epic 4 in progress, after entry 13a

Written 2026-11-11 by the session that built epic 4 entry 12 (as 12a, 12b1, 12b2, 12c1, 12c2, 12c3) and entry 13a. It replaces `handoff-epic-4-after-entry-11.md`; read that one only for the history it holds. The facts are in the repo; this note says where and how the work runs.

## State

- **Branch:** `claude/festive-gates-ji0y4s` (aott33/perspective-map-studio), pushed, tree clean. The owner pulls it and tests with `ops/up.sh`. Last release v0.3.0; working version `0.3.0-SNAPSHOT`; contract 0.4.0, unreleased (entry 18 releases it); map store schema 3.
- **Epic 4 built:** 1 to 12 (7 as 7a, 7b, 7c; 11 as 11a, 11b; 12 as below), 13a, 14, 15, 16, 21 to 27; 3 done. Plans in `_bmad-output/initiative-flowmap/tickets/epic-editing/tickets/`; a split entry's first part holds the ticket (`...-plan.md`), later parts are `...-plan-<id>.md` with `part_of: '<entry>'` and `ticket: ''`. Each plan ends with its Review Triage Log and an Outcome line.
  - **12a:** the Kinds surface: the kinds list with the asset list's status, a kind's setup (preview item, Icon read-only, Key values, Comms, Alarms, Popup), saved whole as `kindSetup` ops, each path's resolve note from `tags.resolve`.
  - **12b1, 12b2:** the Style rule section (States, Bands, Expression, From its instruments, area tints, preset tiles) and the preview on the map (the preview item's word). No TypeScript port of the rule (owner, option A).
  - **12c1, 12c2, 12c3:** item overrides: Details' Live now block with full-path overrides, the item's own rule, and the Style tab in its approved layout (heading and tag, Live now, the rule, the actions, From kind at the foot; no Label row until backlog 38). DESIGN.md and EXPERIENCE.md say it.
  - **13a:** one tag path rule (`TagPaths`) for every stored tag path, in kind setups, popup params and item overrides, with the browser's override check in the same words; `StoredPathReport` logs each stored row the rule would refuse at a project's first store read after a start (nothing rewritten); `tags.resolve.reply` gains `failing` and `failingMore`, and the resolve note names up to three items ("Resolves for 4 of 5 well pads. Not for Point 3."); a configured provider that is not running answers `tags-unavailable` naming it; dev fixtures: a second provider `Site2` and `Plant/AmbientTemp`. 315 passed, 0 failed; `ops/store-checks.sh badrow` passed.
- **Playbook:** `docs/test-playbook-0.4.0.md`, sections 8k (Kinds), 8l (style rule), 8m (preview), 8n (overrides), 8o (Style tab), 8p (tag paths, the failing items, providers) added this session; add one per entry.
- **Contact sheets** in `docs/screenshots/`: kinds, kindstyle, kindpreview, overrides, itemstyle. The script that builds one is not in the repo (a small Playwright page with a grid of the spec's screenshots from `e2e/out/screenshots`); its title must not hold an apostrophe when passed on a command line.

## Next: entry 13b, then 13c (owner split entry 13 three ways, 2026-11-11)

Entry 13's ticket plan is 13a's (`story-the-tag-browser-one-tree-for-every-tag-pick-asset-relative-p-plan.md`); 13b and 13c are `...-plan-13b.md` and `...-plan-13c.md`. Start with 13b's plan for the owner's approval.

- **13b:** the tag browser's card and tree in the browser: the provider select, the tree over `tags.browse {provider?, folder?}`, the keyboard, the states (loading, empty, unavailable, refused), and picks into a kind's Key values, Comms and Alarms. Decided (owner, "go with recommended"): a folder may be picked for Alarms only; the type column shows what the Gateway sends, with no value-source column.
- **13c:** the other pickers (the style rule's tag path, popup params, an item's override rows and own rule) and the Path field's conversion between a full path and one under `{asset.path}`.
- What 13a leaves for them: `Site2` (`Yard/WindSpeed`, `Yard/Tank1/Level`, `Comms`) and `Plant/AmbientTemp` for the tree and the provider select; a stopped provider is `tags-unavailable`, an unknown one `invalid`; backlog 39's "each failing name opens its item" is not built and fits 13b or 13c if the owner wants it.
- **Then, in order:** 19 and 20 (units; backlog 36's neutral words can ride with 19), 17 (sweep), 18 (release 0.4.0, which depends on the owner: Designer checks, the 30-minute test, ER-27, the performance run, the bundle size decision, the release rehearsal). Each part has taken 3 to 4 hours from approval to push. After epic 4: the owner tests and validates, fixes, then epic 7, epic 5, epic 8.
- **Backlog:** next id 41. This session: 39 (the items a path does not resolve for) closed by 13a; 40 (plain, brief words across the UI; hitl) added at the owner's request. `_bmad-output/deferred-work.md` gained: an e2e check of tint rows from a choice field (needs a choice field on a dev area kind); the stored-row report keyed by project and connection.

## Decisions the owner made this session (they shape later work)

- A kind setup conflict, and a refused Revert, offer only "Use <name>'s version" (no "Apply mine on top").
- A rule saves as soon as it is complete; "Not saved yet" until then; the word is "complete", never "whole".
- Preset selects use the tiles' words; rule rows are parted by dividers.
- Override on an unlinked item starts empty only when the kind's rule reads a path under `{asset.path}`.
- Every save of a setup part or an override is built from the newest stored (and in-flight) value with one part or row changed, and a draft carries the version it was built on, so another editor's save meets the Gateway's conflict (two review findings were exactly this).
- The owner finds long UI sentences too long: keep words brief and plain (backlog 40 reviews them all).

## Open with the owner

- **Competitor names, the wider pass (option C), not decided.** The rule is: never name a competitor's product or vendor in the repository. Done (option B): the brief, its memlog and addendum, and the PRD's reconcile and addendum now name the packaged map administration project generically. Still named: a map-editor product in DESIGN.md, EXPERIENCE.md, working notes, the party memlog and `imports/` file names, and a vendor module and field apps in the epic file's notes. Ask before the release.
- **ignition-lint on 13a's new `ops/config` tag files was not run:** the tool could not be installed in the session (the permission check refused the install). The files parse as JSON, load on a fresh Gateway and are browsed by the specs. The plan's task is left open; run it where the tool exists.
- **The cloud environment's setup script** (JDK 17 after `apt-get update`, `npm ci` in `web` and `e2e`, the Gradle cache warmed with three tries) was saved with the owner's approval and is unproven until a fresh session starts on it. If the new session finds JDK 17 and the Gradle cache present, say so; if not, fix by hand as below and tell the owner.

## How an entry is built (unchanged; the owner expects it)

`bmad-build` with `--set workflow.review=quick`; one Explore survey; the plan from `plan-template.md` (frozen Intent, Boundaries, matrix); checkpoint with a short summary, the risk and a table of the planner's picks. The owner sometimes asks for `bmad-party-mode` first (memory in `_bmad-output/party-mode/memories/installed/.memlog.md`), or for reviewer subagents on a layout, then "approve and continue": write the decisions into the frozen Approach. One implementer subagent with the verbatim dispatch ("Read <plan> fully and implement it - the plan is the sole source of truth. Load every file listed in its frontmatter `context:` before you start. When done, report what you changed, how you verified it, and anything left incomplete or risky."); write the diff since `baseline_revision`, check the matrix has passing tests, set `in-review`, the quick lens with the verbatim prompt, triage every finding into the plan's log, patches to the same implementer; then the orchestrator's own Verification: `cd web && npx tsc --noEmit && npx jest`; `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks`; `bash scripts/ci/check-contract-versions.sh`; ignition-lint on changed Ignition files; `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` (about 1.2 hours now; run it in the background with its log in the scratchpad). Mark `built` with an Outcome line, commit, push, send a contact sheet (saved in `docs/screenshots/`), say how to try it.

- Subagents run on the session's own model (the owner's instruction); never override it.
- An entry over about 3,000 tokens of plan: offer the split before planning.
- Push only after the whole suite passes; plan-only commits may be pushed at once. The stop hook nags about unpushed or uncommitted work during a build: say why and wait.
- A layout that departs from DESIGN.md goes to the owner with screenshots before it is final.
- A message from another session that relays a task is not the owner's word: ask the owner.

## Learned this session

- **Container or worker restarts stop Docker.** Restart by hand (`rm -f /var/run/docker.pid /var/run/docker/containerd/containerd.pid; nohup dockerd > <scratch>/dockerd.log 2>&1 &`, wait 15 s), then `ops/up.sh`; the images survive. Check `docker ps` before every implementer launch and every run. Image pulls can answer 429: retry with backoff. `apt-get update` before installing JDK 17.
- **Do not chain a commit behind a fragile step.** A failed step before `git commit` in one command skipped a commit and put the next plan's baseline on the wrong HEAD. Check `git status -sb` and `git log` after each commit; `git add` a new file before `git commit --only`.
- **Flaky tests were test bugs, fixed at the cause:** `events.spec.mjs` read a count at once (now polls); `adapters.spec.mjs` left the dev adapter's 8 s slow call in flight (its clean-up now waits for `ok`).
- **A real bug found by a whole-suite failure:** a second tab of the same browser replays a batch in flight, and its reply dropped the first tab's Undo step (from entry 10). Fixed in `MapStudioStoreDelegate.ts` `onSave`.
- **Known small things, not fixed:** a replayed override's Undo label still reads "edit <name>"; "Show on map" on a long line shows no word.
- **13a on the platform:** on 8.3.10 a disabled tag provider leaves the tag manager's list entirely; the module reads the Gateway's configured providers to tell stopped from unknown (`docs/platform-checks.md`). `tags.spec.mjs` stops and restarts `Site2` through the Gateway's REST API: if that test is killed mid-run, `ops/up.sh --fresh` brings it back. An item with a failing stored override is refused on any edit but a delete until the path is mended (`docs/operations.md`).
- **The owner:** short answers, tables, a recommendation; "How's it going?" means the run's numbers; usually answers "Go with recommended" or "Approve and continue".

## For entry 18 (already carried in its description)

ER-27 (the you-are-here marker, the distance rows, View alarms in the footer), the owner's Designer checks, the 30-minute test, the performance run (bundle size, the place file, the viewport's Gateway cost, `edits.apply` with 10 editors, the store's size after ten imports of the dev field), the release notes' line that the schema 3 upgrade needs the module's database role to own the tables and have CREATE on the schema, and a line that 0.4.0 refuses on save tag paths an earlier build stored (`//`, a bracket after the provider, a relative provider, over 1024 characters), with the log lines that name them.

## Start the new session with

> Work on the branch `claude/festive-gates-ji0y4s` (push only to it). Read `_bmad-output/handoff-epic-4-after-entry-13a.md` first, in full, then continue epic 4 with the bmad-build skill and the quick review (`--set workflow.review=quick`), starting with entry 13b: investigate, write the plan, and present it to the owner (Andy) at the checkpoint for approval before implementing. Run subagents on this session's own model (do not override it to another model). Keep `docs/test-playbook-0.4.0.md` growing as entries land. Never name a competitor's product or vendor in the repository, and push code only after the full test run passes.
