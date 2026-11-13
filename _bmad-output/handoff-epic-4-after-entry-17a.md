# Hand-off: epic 4 in progress, after entry 17a

Read `handoff-epic-4-after-entry-19a.md` too: its sections "How an entry is built", "Learned this session" and "For entry 18" still hold and are not repeated here.

## State

Branch `claude/festive-gates-ji0y4s`, head `df138db` when this note was written. All built entries passed the whole e2e suite on a fresh stack before their commit.

| Entry | What | Commit | Suite |
|---|---|---|---|
| 19b | built earlier this session | (see `git log`) | passed |
| 20a | the units shown: one formatter behind every distance | `fa50f0f` | 336 passed, 0 failed (second run; the first had one timing flake, `tracer.spec.mjs:24`, not seen again) |
| 20b | the Units row of the Layers tab | `bd7315e` | passed |
| 17a | the sweep: one home for repeated helpers, shared e2e fixtures, no behaviour change | `df138db` | 337 passed, 9 skipped, 0 failed |

## Next: the owner's answer on 17b's findings, then 18

- **17b is built** (after this note was first written): the keyboard and contrast pass of Edit mode is `e2e/tests/keyboard.spec.mjs`, its record is `docs/platform-checks.md` "Epic 4 entry 17", the hand checks are playbook 8w. Whole suite: 352 passed, 9 skipped, 0 failed.
- **It found failures and fixed none.** Seven candidate entries were put to the owner (the record's last list). Recommended: one small entry before the release for Esc from a toolbar button, the map's focus ring, focus lost to the page body, and targets under 24 px; the rest (no key places a point, arrow keys on tabs, toolbar, rail and menu, faint pressed and hover fills) as known limits in the release notes. **The owner agreed (2026-11-13):** the four small fixes are entry 21, plan drafted in `story-keyboard-fixes-plan-21.md` (status `draft`, six picks pending); **it is built only after the owner's hand testing, on the owner's word**. The other three go into entry 18's release notes as known limits. The spec pins today's failures (`KNOWN_FAILURES`, `KNOWN_MISSES`): a fix must take its line out of the pin.
- "Esc in a Details field saves the typed text" was already fixed in entry 6; it is marked resolved.
- **18** (release 0.4.0): needs the owner for the Designer event check, the 30-minute test, the bundle-size decision (about 25% over 0.1.0 against a 10% limit), the tag and the signing.

## Open with the owner

Everything in the earlier note's list, plus:

- **One behaviour bug the sweep could not take** (`_bmad-output/deferred-work.md`): an undo pressed while a save is in flight. It needs its own entry if wanted before 0.4.0.
- **The test hook ships in the bundle** (owner's decision of 2026-10-26). It could be compiled out of release builds; recommended to leave unless the ER-27 review objects.
- **20a, told to the owner, not changed:** lists say "1 km" not "1.0 km"; a metric field shows "1143" where US shows "3,750"; the scale bar keeps its own labels; Needs you and the phone sheet under US were not tested live.
- **20b:** matrix rows U8 to U10 are unit tested only; the hand check is playbook 8v.
- **The owner plans to test by hand:** playbook sections 8u and 8v cover entries 20a and 20b.

## Learned this session

- A stuck-looking single e2e failure that passes alone: run the whole suite again on a fresh stack before the commit; do not commit on a one-test re-run.
- A contact sheet composed with `setContent` cannot load `file://` images: embed them as base64 data URIs.
- Docker stopped twice more; the restart recipe in the earlier note works.

## Start the new session with

> Work on the branch `claude/festive-gates-ji0y4s` (push only to it). Read `_bmad-output/handoff-epic-4-after-entry-17a.md` first, in full, and the note it points to, then continue epic 4 with the bmad-build skill and the quick review (`--set workflow.review=quick`), starting with entry 21 (its plan is drafted and waits for the owner's, Andy's, word after hand testing), then entry 18: investigate, write each plan, and present it at the checkpoint for approval before implementing. Run subagents on this session's own model (do not override it to another model). Keep `docs/test-playbook-0.4.0.md` growing as entries land. Never name a competitor's product or vendor in the repository, and push code only after the full test run passes.
