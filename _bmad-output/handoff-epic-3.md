# Hand-off: after release 0.2.0, before epic 3

Written 2026-10-28 at the end of the session that built epic 2 (epic-map-store-and-data) and released Map Studio 0.2.0. Read this first; the facts below are in the repo, this note only says where.

## State

- **Released:** v0.2.0 (signed, published 2026-10-28): https://github.com/aott33/perspective-map-studio/releases/tag/v0.2.0. Epic 2 is built: stories 1 to 17 (story 13 is the release).
- **Post-release rehearsal** on the template's test stack with the published module: results in `docs/template-install.md` ("0.2.0 release") and `docs/platform-checks.md` (story 13 and story 17 template rows), all passed: the lock entry verified, the template's `local.sh` and `stack.sh` passed with Map Studio 0.2.0 ACTIVE, a line saved in one browser showed in a second in 54 ms and survived a Gateway restart with its actor recorded, refused saves wrote nothing, and `module_version` reads `0.2.0`.
- **Working version:** `0.3.0-SNAPSHOT` (`build.gradle.kts`).
- **Repository:** renamed from `aott33/perspective-flowmap` to **`aott33/perspective-map-studio`**. Use the new name for every GitHub call (the old one only redirects git).

## Next

1. **The template pull request (left for this session).** Add v0.2.0 to `ign-scada-template`'s module lock and open a **draft** pull request on the owner's go. Never edit `/home/user/ign-scada-template` itself: clone it, branch `map-studio-0.2.0`, then `python3 -I scripts/modules/modl.py check --write`, `fetch`, `inspect`, `verify-lock`; check the lock's `sha256` equals the release's `.sha256` and `certSha256` equals the README's `Signing certificate SHA-256` line (`scripts/ci/modl-verify.sh <file> <fingerprint> 0.2.0`); add the template's `docs/modules.md` row and history line and the Tabler Icons (MIT) entry in `THIRD_PARTY_NOTICES.md`. The template's own CI runs `local.sh` and the stack; do not repeat them. The session needs `aott33/ign-scada-template` added with push access. The previous session's scratch clone is gone with its container; its entry, made by `modl.py check --write` and verified (`verify-lock` ok, 6 signatures, none bad):

   ```
   id com.aoindustrial.perspective.mapstudio, name Map Studio, version 0.2.0, requiredIgnitionVersion 8.3.0,
   file Map-Studio-0.2.0.modl, url https://github.com/aott33/perspective-map-studio/releases/download/v0.2.0/Map-Studio-0.2.0.modl,
   sha256 0cfa5c26190e04e84751ef825d020fbc006556748d1d4a1bbb66b2f25e0730ba,
   certSha256 8F:93:FD:5C:B8:D9:C7:9B:E4:14:FD:EC:84:CF:21:26:A2:AC:39:F3:DA:3F:C9:0D:F8:08:0E:EA:5C:4D:38:3D,
   licence Apache-2.0, upstream github aott33/perspective-map-studio, asset Map-Studio-.*\.modl, tag v0.2.0
   ```
2. **Epic 3, epic-viewing** (`_bmad-output/initiative-flowmap/tickets/epic-viewing/`): not refined yet. Refine it, then plan and build in its `tickets/tickets.toml` order. **Entry 4, "Shorter release checks", is first** (owner, 2026-10-28): `ops/release-smoke.sh`, `ops/perf.sh --only`, checks by release type in `RELEASING.md`.
3. Decisions already taken for epic 3, in `epic-viewing.md` Notes: **comms lost gets a colour on the map** (owner, 2026-10-28; its own theme token, never an alarm hue, badge and words kept; settle whether stale follows and whether the template's cards change to match; back to engineering review ER-27 with the epic's hue tokens); the popup, tag path and bottom sheet decisions of 2026-10-27. The open question on the style rule expression language is settled at refinement (`_bmad-output/backlog/spike-style-rule-expression-language.md`).

## Open items to know

All in `_bmad-output/deferred-work.md` (entries without a `resolved:` line). The ones that touch epic 3 or the next release:

- **Performance, 0.2.1 entry.** The template-stack run (`docs/perf/0.2.0-template.json`, on the same 4-CPU agent box, not a laptop) missed `edits.apply` with 10 editors again: 50 ops p95 1,905.7 ms, and 1 op p95 384.0 ms (a pass on the dev run). The box was 99.5 to 99.8% busy; the same streams from one page gave p95 288.2 ms. Settle it with a run on a bigger machine before deciding whether 0.2.1 needs a write-path change. `ops/perf.sh --target template` needs a `mapeditor` user in role `MapEditor` on the test Gateway, which its header does not say.
- A second browser tab does not resend another tab's queued edit on its own timer (goes to epic-editing). The post-release rehearsal confirmed it (shown in the second tab after 9 ms, replayed only after that tab's next `map.load`).
- Live checks the sweep could not make (`onShutdown`, a redundant pair, a slow tag system, the least-privilege runtime role saving a kind setup).
- The two tag path rules that disagree (`Placeholders.checkTagPath`).
- Backlog: demos (oil and gas, solar, water; the `map-studio-examples` repo; solar and water need icon sets), reference layers, popup parameter overrides.

## How the owner works

- Andy Ott (aott33). Usually answers "agree with all recommendations, start building". Give a recommendation, not a survey. Short answers; plain words; tables for results.
- Wants: a professional UI that matches the Ignition Designer in the Designer (plain Swing controls, the Designer theme, no custom-looking widgets) and the project theme in Perspective; speed through parallel agents but with care about credits; undecided ideas go to the backlog.
- Steps that are always the owner's: merging, tagging, approving the `release` environment, publishing a release, engineering review (ER-27) of anything that changes alarm presentation, a template pull request's go.
- One pull request per story (or per release), CI green before asking to merge.

## Rules (also in CLAUDE.md files)

- No em dashes anywhere; use " - ".
- No model identifiers in commits, pull requests or files. Commit trailers: `Co-Authored-By` and `Claude-Session` as the session's attribution reminder gives them.
- Never commit a `.modl`, key, password, token or scratch project. Secrets are read inside containers or from env, never printed.
- Never write to a live Gateway without the owner's confirmation. The local dev and test stacks are disposable, but prefer committed, reviewed scripts over ad hoc API writes (an ad hoc identity provider fix through the REST API was flagged by the security check in the 0.2.0 rehearsal).
- Never bare `git stash` (the stash is shared between worktrees). Agents work in their own git worktrees under `.claude/worktrees/`; an agent must not switch another worktree's branch.

## The cloud container

- **Docker stops when the container restarts.** Start it with `service docker start` (an `ulimit` warning is harmless) and wait for `docker info`. Keep the images `ign-og/ignition:8.3.9-modules` (the template's), `inductiveautomation/ignition:8.3.10` and `postgres:16-alpine`.
- **A restart stops background agents and workflows.** Commit work in progress at each milestone; after a restart check each worktree's `git status` and resume.
- **Disk is tight** (about 250 GB volume, a few GB free). Before a stack or perf run check `df -h /`; clean `build/`, `node_modules` and stopped containers of finished worktrees. The shell safety check blocks `rm -rf "$d"/...`; use `"${d:?}"/...` or literal paths.
- **Dev stack:** `ops/up.sh` (build, stage, start; `--fresh`, `--no-build`), `ops/down.sh`, `ops/psql.sh`, `ops/scan.sh`; settings in the git-ignored `.env` (`MAPSTUDIO_CONTAINER`, `GATEWAY_HTTP_PORT`, `IGNITION_UID`, `IGNITION_GID`).
- **Checks before a pull request:** `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline`; `cd web && npx tsc --noEmit && npx jest`; `cd e2e && npm ci && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test`; `bash scripts/ci/check-contract-versions.sh`.

## Where things are

- Plans and tickets: `_bmad-output/initiative-flowmap/` (initiative, PRD, architecture, UX spines `ux-map-studio/DESIGN.md` and `EXPERIENCE.md`, tickets per epic with `tickets.toml` in build order and a `-plan.md` per built story).
- Evidence of every live check: `docs/platform-checks.md`. Performance records: `docs/perf/`. Release process: `RELEASING.md`, `CHANGELOG.md`. Template install: `docs/template-install.md`.

## Start the new session with

> Read `_bmad-output/handoff-epic-3.md`, then open the template's 0.2.0 module-lock pull request as a draft, and refine epic 3 (epic-viewing) starting with entry 4.
