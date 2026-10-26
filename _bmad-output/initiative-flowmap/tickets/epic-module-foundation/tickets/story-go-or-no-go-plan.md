---
title: 'Go or no-go'
type: 'chore'
ticket: '9'
created: '2026-10-26'
status: 'in-progress'
baseline_revision: '6d866163cf3af000c7970c14905c9f4bdd28f218'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: [_bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md]
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The spike's answers and measures are spread over `docs/platform-checks.md`, `docs/spike-measures.json`, `docs/template-install.md` and eight story plans; the owner has no one page to decide go or no-go on, and the platform facts the spike verified are not yet in claude-ignition-skills (epic R3, R7; initiative constraint NFR-7).

**Approach:** Write `docs/spike-report.md`, a short decision document: one table of every platform question and measure with answer, evidence link, label (measured, stand-in, unverified) and the fallback it had; then short sections for the owner-pending items, the built-in Map fallback, what a go commits epic 2 to, and the risks carried forward. Land the verified platform facts in a fresh scratch clone of claude-ignition-skills (new `ignition-dev/references/module-sdk.md`, lines in the files that own each topic, a dated `docs/verification.md` entry), committed on a branch and not pushed. Nothing the owner has not yet supplied is guessed: those cells read PENDING OWNER.

## Boundaries & Constraints

**Always:** Every answer in the report links the section of `docs/platform-checks.md`, `docs/template-install.md` or `docs/spike-measures.json` that carries its evidence, and carries that section's label. The five owner items (headed frame-rate run, Designer autocomplete, `CHECK setup-modified` on v0.1.0, Mapbox terms, the decision and its date) stay PENDING OWNER. The skills clone follows its CLAUDE.md: each reference file defines the labels it uses, a finding lands in the owning reference file and in a `Finding | Where it went` row, `python3 scripts/check_skills.py` passes, no em dash anywhere, `VERSION` bumped in the same change. Commit messages carry the two trailer lines the session set.

**Never:** No push of either repository. No git in the shared `/home/user/claude-ignition-skills` checkout. No new measurement, no code change in the module, no edit to any other story's section of `docs/platform-checks.md`. No owner-pending fact in the skills repo (autocomplete, `onResourcesModified`, the headed frame rate, the Gateway-side view stop, the Mapbox terms). No value from a throwaway certificate or any secret.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Platform question answered live | Story 2, 3, 4, 6 sections with `[live 8.3.10]` or `[live 8.3.9]` | Row with answer Yes, the link, the label and the fallback it would have taken | No error expected |
| Measure recorded as stand-in | `valueBatch` in `docs/spike-measures.json` (`label: stand-in`) | Row labelled stand-in, with what fixes it (a real `values.batch`, epic-viewing) | Never presented as measured |
| Owner has not supplied the evidence | NFR-1 headed run, Designer checks, Mapbox terms, the decision | Cell reads PENDING OWNER with the exact command or step the owner runs | Never a guessed value or date |
| Fact is owner-pending | Any of the five | Left out of the skills repo entirely | The report names it instead |

</frozen-after-approval>

## Code Map

- `docs/platform-checks.md` -- the record: Story 2 (toolchain pins, line 7), Story 3 (five CHECK lines and the answers table, line 49; the drafted skills table, line 113), Story 4 (view by path, line 125; the Gateway-side view stop `[unverified]`, line 147), Story 7 (measures, line 167), Story 8 (sweep, owner leftovers, line 231). Read only.
- `docs/spike-measures.json` -- bundle, frame rate (software WebGL, 7.5 to 13.1 fps), value batch stand-in, wire round trip (261 and 327 bytes), phone probes (7 of 9). Read only.
- `docs/template-install.md` -- v0.1.0 through the template's lock, loads on 8.3.9, PKCS#7 DER finding. Read only.
- `_bmad-output/deferred-work.md` -- the carried risks: view stop, headed run, `testSet`, `values.batch` stand-in, signature verification, Designer checks, CI linters. Read only.
- `_bmad-output/initiative-flowmap/architecture-map-studio/architecture-map-studio.md` -- AD-5, AD-6, AD-7, AD-12 (owner's Mapbox item), AD-18, AD-21; the open questions (line 305). Read only.
- Git history -- hours to a green build: story 1 plan drafted `ae6d133` 04:40 UTC, first green tracer commit `c8d3ca4` 05:38 UTC, owner's fresh-clone build the same morning (`0633e4b`); stories 1 to 8 merged 04:31 to 19:06 UTC on 2026-10-26.
- `docs/spike-report.md` -- new, the decision document.
- Scratch clone of claude-ignition-skills (the session scratchpad, branch `ccr-3c8b84b9-f1vbsm`, equal to `origin/main` at `954021b`): new `.claude/skills/ignition-dev/references/module-sdk.md`; `ignition-dev/SKILL.md` names it (checker rule 5); `ignition-ui/references/perspective-components.md` (Alarm Metrics by Java subscription; View by path); `ignition-config/references/docker.md` (core manifest, `attributes.uuid`, seed by copy, transient `Driver$1`, PKCS#7 DER); `ignition-config/references/file-layout.md` (custom project resource row); `ignition-architect/references/system-architectures.md` (a Valid connection says nothing about rights); `ignition-dev/references/validation-workflow.md` (frames readable text on 8.3.10); `docs/verification.md` (sixty-fourth entry); `.claude/skills/VERSION` (`v8.3.9-27`).
- Labels: the skills repo lists no `[live 8.3.10]`; each file defines its labels in its own Labels paragraph, so every touched file gets a `[live 8.3.10]` definition pointing at `aott33/perspective-map-studio` `docs/platform-checks.md`.

## Tasks & Acceptance

**Execution:**
- [ ] `docs/spike-report.md` -- write the table (one row per platform question and measure) and the sections: pending owner, the built-in Map fallback, what a go commits epic 2 to, risks carried forward, the decision block -- the owner's one page.
- [ ] Scratch clone: `ignition-dev/references/module-sdk.md` -- new file with the Story 3 facts (Alarm Metrics subscription, `getProjectScriptManager`, `initializeScriptManager`, custom project resource lifecycle, `SRConnection` and SQLState 42501), the Story 4 facts (View by path, portal, failed states), the Story 2 pins, the Story 6 facts (PKCS#7 DER, loads on 8.3.9) and the Story 7 wire fact -- the reference file the Story 3 table targeted.
- [ ] Scratch clone: the owning files named in the Code Map -- one line or row each, each file's Labels paragraph extended -- a finding lands where its topic lives.
- [ ] Scratch clone: `docs/verification.md`, `.claude/skills/VERSION` -- the dated entry with its `Finding | Where it went` table; revision bump -- the repo's rule for a batch.
- [ ] Scratch clone: `python3 scripts/check_skills.py`, then one commit on `ccr-3c8b84b9-f1vbsm` with the trailers -- not pushed.
- [ ] `README.md` -- Tests and proof: the one-time `npx playwright install chromium` step and that a headed run is not a GPU run -- what the owner's run showed.
- [ ] Worktree: commit this plan, `docs/spike-report.md` and `README.md` -- not pushed.

**Acceptance Criteria:**
- Given the report, when the owner reads its table, then every platform question of epic R3 and every measure of prd 6.4 has a row with an answer, a link to its evidence section, a label and the fallback it had, and the five owner items read PENDING OWNER.
- Given the scratch clone, when `python3 scripts/check_skills.py` runs, then it prints `0 problem(s) found`, and `git log origin/main..HEAD` shows one commit with both trailers and `git status` is clean.
- Given the skills diff, when searched for autocomplete, `onResourcesModified`, a frame rate, the view stop or Mapbox, then nothing is stated as verified.

## Implementation Notes

- Status set to `in-progress` on the coordinator's instruction (the owner asked for the draft); the plan's own approval and the go or no-go are both the owner's and are pending. Nothing here is final.
- Hours to a green build is compiled from commit timestamps (about one hour of session time from the story 1 plan to the first green tracer commit; eight stories merged within one UTC day), labelled "from commits" rather than measured, because no clock was kept.
- New evidence mid-draft (coordinator, 2026-10-26): the owner's headed `E2E_HEADED=1 npm test` (22-CPU Linux machine, 10 of 10) is recorded in the report as a third frame-rate data point: still SwiftShader, every run at a 33.3 ms interval (about 30 fps, a 30 Hz cap likely, unverified), phone 7 of 9 and bundle unchanged. A second coordinator message the same day added the owner's GPU reading (Windows Chrome 156 with acceleration on, Intel Arc Pro integrated GPU, 60 Hz display, 60.0 fps on `/scale` by DevTools Frame Rendering Stats, labelled "owner, measured by eye"): NFR-1 is met for the stand-in with its limits and is no longer PENDING OWNER; the earlier 30 fps was WSLg's SwiftShader cadence and a Windows Chrome with acceleration off. Four owner items remained. A third message added the owner's Designer check (2026-10-26, current `main`, Script Console): `system.mapstudio.` autocompletes `echo(text)` and `ping()` with signature, description and parameters, labelled "owner, seen in the Designer"; recorded in the report, in `docs/platform-checks.md` (story 3, where it was marked not verified; a coordinator-directed exception to "a story edits only its own section") and in the skills clone (`module-sdk.md`, a new `[owner, seen in the Designer]` label; a new commit on top, since the branch had been pushed). Three owner items remain: `CHECK setup-modified`, the Mapbox terms, the decision and its date. `README.md` (Tests and proof) gained the `npx playwright install chromium` line and the headed-is-not-GPU note. The owner's `measures.json` is not committed as `docs/spike-measures.json`.
- `[live 8.3.10]` is not a label the skills repo lists; it is defined per file, as the repo's CLAUDE.md asks, naming the Map Studio spike as its source. `VERSION` is bumped to `v8.3.9-27` (a revision, not a reset to 8.3.10: the repo's own verifications stay on 8.3.9; the owner may prefer a reset, Open Question 1).

## Plan Change Log

## Review Triage Log

## Design Notes

The report is written for a reader who decides in five minutes: one table first, prose after, every claim a link. The skills entries keep the Story 3 table's targets, add a fallback-shaped sentence where the spike had one, and leave the five owner items only in the report so the skills never carry an unverified claim as a rule.

## Open Questions

1. `VERSION` in the skills repo: bump the revision (`v8.3.9-27`, drafted) or reset for the new Ignition version (`v8.3.10-1`, the README's rule for "a new Ignition version") although the rest of the repo's verifications ran on 8.3.9?
2. Does the owner want the skills commit opened as a pull request from this branch (it is drafted, not pushed), and after it merges, vendored into `ign-scada-template` and `home-ignition` as the repo's rule says?

## Verification

**Commands:**
- `cd <scratch clone> && python3 scripts/check_skills.py` -- expected: `0 problem(s) found`
- `grep -rnP '\xE2\x80\x94' docs/spike-report.md <this plan>` and the same over the skills diff -- expected: nothing
- `git -C <scratch clone> log --format='%B' origin/main..HEAD` -- expected: one commit, both trailer lines
- `grep -n "PENDING OWNER" docs/spike-report.md` -- expected: the five owner items and the decision block

**Manual checks (if no CLI):**
- Owner reads the report's table against `docs/platform-checks.md` and fills the PENDING OWNER cells, then writes the decision and its date.
