# Hand-off: after release 0.3.0, before epic 4

Written 2026-11-03 at the end of the session that refined and built epic 3 (epic-viewing) and released Map Studio 0.3.0. Read this first; the facts are in the repo, this note only says where.

## State

- **Released:** v0.3.0 (signed, published 2026-11-03): https://github.com/aott33/perspective-map-studio/releases/tag/v0.3.0. SHA-256 `dc1475b83c3ecf742047963ec02381cd68c54bf780cbd4599879417d6aa69c11`, certificate as the README. `ops/release-smoke.sh 0.3.0` passed on `inductiveautomation/ignition:8.3.9` (`docs/platform-checks.md`, epic 3 entry 13). Published notes: `_bmad-output/initiative-flowmap/tickets/epic-viewing/release-notes-0.3.0.md`.
- **Epic 3 is built** (entries 1 to 9, 11 to 15; entry 10 dropped), plus the owner's review notes (backlog story 10, items 1 to 32 and re-test findings R1 to R7) and the ER-27 engineering review, passed with changes (`docs/review-er27.md`). Merged in PRs #21 to #33.
- **Not yet on `main`:** this branch (`ccr-e1048b93-r2p8l4`) holds the gap review write-up (R48 to R59, epic 8 `epic-live-field`, backlog stories 14 and 16 to 26, `_bmad-output/initiative-flowmap/gap-review-2026-11-03.md`), the release record and this hand-off. Open one docs pull request for it first.
- **Template:** stays on Map Studio 0.1.0 until the cut-over (owner, 2026-10-28; epic 7).

## Next

1. **The docs pull request** above (docs only; CI's fast jobs).
2. **Backlog story 15, faster CI** (owner, 2026-11-03): the e2e suite split into 2 or 3 parallel shards, run when a pull request is ready for review, on `main` and on demand; the fast jobs on every push. With it, the release smoke fix: `ops/release-smoke.sh` picks the template image `ign-og/ignition:8.3.9-modules` when present, which already bakes Map Studio in, so the Gateway stops with a duplicate module id; `--keep` must keep a failed stack; the logs hint must name the container.
3. **Epic 4, epic-editing** (`_bmad-output/initiative-flowmap/tickets/epic-editing/`): not refined. It is the biggest epic (R10, R11, R14 to R24, R38, R40, R41, R44 to R52). Refine it with the owner, then plan and build in its `tickets.toml` order. Check first, early: whether the Gateway's tag browse works for the Kinds screen's tag browser (an open question in the epic). R48 to R52 (the map's selection and viewport to the page, events, you-are-here, Directions, nearest to me) came from the gap review and are small.
4. After epic 4, in `tickets.toml` order: import and export (5), live field (8, new), phone (6), template cut-over (7). Estimate at epic 3's pace: about 4 to 5 weeks to the cut-over including review rounds.

## How the owner works

- Andy Ott (aott33). Usually answers "agree with all recommendations, start building". Give a recommendation, not a survey; short answers, plain words, tables for results.
- Tests on a local stack (WSL, Docker) with a playbook; keep test lists short (`docs/test-retest-0.3.0.md` is the model: about 25 minutes, only what changed and what automation cannot see). Record every note the owner sends in the playbook and the review notes file, with item numbers.
- Wants renders before and after for anything visible, and contact sheets for choices.
- Steps that are always the owner's: merging, tagging, approving the `release` environment, publishing, ER-27 review of alarm presentation, the template's module lock (at the cut-over).
- Subagents: Fable is fine again (owner, 2026-11-03); pin the model explicitly. Work in worktrees, one port each, commit often (container restarts stop agents).

## Lessons from epic 3

- The release smoke: download draft assets with `gh release download` (a draft's URLs give "Not Found" to `curl`), and run the smoke with `--image inductiveautomation/ignition:8.3.9` until story 15 fixes the default.
- CI's Playwright job runs about 32 minutes; its limit is 45. Pushing to a branch cancels a running CI: batch pushes while CI runs.
- A Gateway restart drops the showcase's stale state on memory tags; the showcase pages now restore it on open (item 10).
- The owner's local repo once had empty git object files (WSL): `find .git/objects -type f -empty -delete && git fetch origin` repaired it.

## Rules

As in `_bmad-output/handoff-epic-3.md` "Rules" and "The cloud container", and the CLAUDE.md files: no em dashes, no model identifiers in commits or files, the commit trailers, no secrets or `.modl` in git, no writes to a live Gateway without the owner's confirmation, no bare `git stash`.

## Start the new session with

> Read `_bmad-output/handoff-epic-4.md`, open the docs pull request it names, then refine epic 4 (epic-editing) with me.
