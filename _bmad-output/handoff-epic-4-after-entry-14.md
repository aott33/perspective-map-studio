# Hand-off: epic 4 in progress, after entry 14

Written 2026-11-07 at the end of the session that built epic 4 (epic-editing) entries 1 to 6, 21 to 27 and 14. Read this first; the facts are in the repo, this note says where and how the work runs.

## State

- **Branch:** `claude/festive-gates-ji0y4s` (aott33/perspective-map-studio), pushed. The owner pulls it and tests with `ops/up.sh`. Last release: v0.3.0. Working version `0.3.0-SNAPSHOT` in `build.gradle.kts`; the contract is 0.4.0, unreleased (entry 18 releases it).
- **Epic 4 built** (each plan's status `built`, `_bmad-output/initiative-flowmap/tickets/epic-editing/tickets/*-plan.md`): 1, 2, 4, 21, 22, 23, 24, 5, 25, 26, 6, 27, 14; entry 3 (the UX workshop) done. The owner tested 1 to 26 on the dev stack ("easy and intuitive to use").
- **Owner's test playbook:** `docs/test-playbook-0.4.0.md`, built so far; add a section as each entry lands; entry 18 finishes it.

## Next

1. **Epic 4 in `tickets.toml` order:** 15 (you are here, Locate me), 16 (Directions opening the route, Nearest, distances), then 7, 8, 9, 10, 11, 12, 13, 19, 20, 17 (sweep), 18 (release 0.4.0). `uv run .claude/skills/bmad-agent-po/scripts/tickets.py status _bmad-output/initiative-flowmap/tickets/epic-editing` lists them.
2. **After epic 4** (owner, 2026-11-06): epic-import-export (5), then epic-template-cutover (7), then epic-live-field (8). Phone editing is parked (backlog story 30); epic-phone (6) is dropped.

## How an entry is built (the rhythm the owner expects)

1. The owner says "start entry N". Invoke `bmad-build` with `--set workflow.review=quick` (the quick lens is pinned for every entry). Resolve the entry with `uv run _bmad/method/scripts/tickets.py --project-root . find _bmad-output/initiative-flowmap/tickets/epic-editing <id>`.
2. Survey the code with one Explore subagent (a compact code map), then write the plan from `plan-template.md` (frozen Intent, Boundaries and the I/O matrix; Code Map; Tasks; Verification). Plans run 1,600 to 2,400 tokens; the owner keeps them whole.
3. Checkpoint: present a short summary, the risk and any question with your pick. The owner often asks for `bmad-party-mode` first (the room: Mary, John, Sofia, Sally, Winston, Amelia, Smithy; its memory in `_bmad-output/party-mode/memories/installed/.memlog.md`), then "Approved". Write the room's decisions into the plan before approval.
4. One implementer subagent (model opus) with exactly: "Read <plan> fully and implement it - the plan is the sole source of truth. Load every file listed in its frontmatter `context:` before you start. When done, report what you changed, how you verified it, and anything left incomplete or risky."
5. Stage the diff since `baseline_revision` (leave out big data files), check each matrix row has a passing test, set `in-review`, run the quick lens subagent with the verbatim prompt, triage every finding into the plan's Review Triage Log, send patches to the same implementer (SendMessage), then re-run the plan's whole Verification yourself: `cd web && npx tsc --noEmit && npx jest`; `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew clean build --offline --rerun-tasks`; `bash scripts/ci/check-contract-versions.sh`; `ops/up.sh --fresh` then `cd e2e && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test -- --trace off` with nothing else against the stack.
6. Mark `built` with an Outcome line in the triage log, commit, push, send the owner a render (contact sheet) and how to try it.

## How the owner works

- Andy Ott (aott33). Short plain answers, tables for results, a recommendation rather than a survey; "I'm good with your recommendations" is common. Asks "how's it going?" often: answer with the run's numbers.
- A layout that departs from DESIGN.md is rendered for the owner and decided before it is built (owner's rule, 2026-11-05).
- **Never name a competitor's product or vendor in the repository**; feature reviews record features only (owner, 2026-11-07). `gap-review-2026-11-07.md` is the model.
- Undecided ideas go to the backlog (`_bmad-output/backlog/`, next id 36). The owner wants the module open-sourced after the template runs on it (backlog 35); docs on Docusaurus with an AI guide and a PDF in the module (backlog 27); the backlog moves to GitHub Issues at the public release.
- Steps that are always the owner's: merging, tagging, publishing a release, the engineering review (ER-27), the Designer check, the 30-minute test.

## Rules

- No em dashes anywhere; use " - ". No model identifiers in files, commits or pull requests. Commit trailers as the session's attribution reminder gives them.
- `git commit --only <paths>` when an implementer works in the same tree; never a bare `git stash`. Push only after the full test run passes, so the owner never pulls untested work (the stop hook will nag about an implementer's uncommitted files; explain and wait).
- Ignition files changed (views, scripts) pass ignition-lint: `python3 -m venv <scratch>/il-venv && <scratch>/il-venv/bin/pip install -q ignition-lint-toolkit`, then `ignition-lint --files <file>`; zero errors and warnings, naming hints recorded.
- Never write to a live Gateway without the owner's confirmation; never commit a `.modl`, key, token or password (the Mapbox token lives in the git-ignored `ops/secrets/map_token`).

## The cloud container

- **Restarts are frequent.** They stop Docker and every background agent and command. Docker: `rm -f /var/run/docker.pid /var/run/docker/containerd/containerd.pid; nohup dockerd > <scratch>/dockerd.log 2>&1 &`, wait for `docker info`, then `ops/up.sh --no-build` (or `--fresh` before a whole-suite run). Re-launch a stopped review or run; the repository and committed work survive.
- Run mocks and single specs with `--output=<scratch>/pw-out` so they never share `e2e/out/results` with a running suite.

## For entry 18 (the release), already carried in its description

The ER-27 review (the you-are-here marker, the distances on Needs you rows, View alarms moved into the popup's footer, plus Needs you hidden in Edit mode and the legend's key in Layers); the owner's Designer check of the map's four events; the 30-minute test; the performance run with: the bundle likely about 25% over 0.1.0 against a 10% limit (re-base the limit or load the studio's code on the first Edit), the place file served uncompressed (4.7 MB, 3.1 MB gzipped) with no cache headers, the viewport's Gateway cost with 20 sessions panning, and 0.2.0's `edits.apply` with 10 editors.

## Open items

- **The review 390 px flake** (`review.spec.mjs:301`, "No Connection to Gateway" in its snapshot) now fails in either theme in most whole-suite runs; it passes rerun alone. Worth fixing early (the sweep, or sooner).
- `_bmad-output/deferred-work.md`: 36 entries, 17 resolved. For entry 7: the map shifts about 160 px when Details docks after a Point tool placement and when Details closes. Others: an edit saved while an undo is in flight, a held split not opening its new part.

## Start the new session with

> Read `_bmad-output/handoff-epic-4-after-entry-14.md`, then build epic 4 entry 15 (you are here and Locate me) with bmad-build and the quick review, presenting the plan to the owner at the checkpoint.
