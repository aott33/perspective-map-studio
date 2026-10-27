# Pass 1 coverage gaps - Map Studio spines (draft, 2026-10-27)

Rubric walker Pass 1 (references/validate.md), run by the Finalize distiller on DESIGN.md and EXPERIENCE.md. No ticket for the UX work; journeys and requirements come from the PRD (UJ-1 to UJ-5, FR-1 to FR-40).

## 1. Flow coverage - adequate

- All five PRD journeys have a Key Flow with the PRD name verbatim, the named protagonist, numbered steps, a climax and a failure path.
- UJ-4 follows the owner's crosshair Move decision, not the PRD's long-press and drag (FR-27). The PRD needs to change, or the owner confirms (Open Question 1).
- UJ-1 step 6 (placing PT-1 as an instrument) and UJ-5 step 4 (line popup at a segment) are added from FR-40 ("Realizes UJ-1, UJ-5"); the PRD journey text does not yet mention instruments.
- No flow walks Export (FR-35), Recent changes with Revert, or the conflict card end to end. The conflict appears only as UJ-2's failure path.

## 2. Token completeness - deliberate deviation, plus three open values

- **Colours are not hex.** On purpose: the owner and AD-11 rule that Map Studio ships no colour, so every colour token is a host Perspective theme variable reference. The rubric would rate missing hex as critical. A reviewer should judge this against AD-11, not the generic rule. Light and dark come from the host theme, so there are no -dark pairs.
- `colors.alarm-2`, `colors.alarm-3` and `colors.area-tint` name no variable yet (Open Questions 5 and 6). `colors.alarm-1` = `var(--error)` is an [ASSUMPTION] carried over from the mock.
- The Perspective variable names (`--neutral-10` to `--neutral-90`, `--label`, `--container`, `--callToAction`, `--warning`, `--error`) are the mock's stand-ins. They are not checked against the 8.3 built-in themes.
- Contrast: the 3:1 non-text target is stated. It is not measured, because the values belong to the host theme; it goes to the ER-27 review.
- The elevation fallback shadow is described in prose only, with no token.
- `rounded.sheet` (16 px) is an [ASSUMPTION].
- Every `{path.to.token}` reference in both files resolves (checked mechanically).

## 3. Component coverage - adequate, with gaps

These have a visual spec in DESIGN.md but no row of their own in EXPERIENCE.md Component Patterns:
- zoom control (Fit and Return behaviour, FR-34)
- map marker, map line, state word chip and instrument marker (their behaviour sits in State Patterns)
- group header and filter chips (folded into the Item list row)
- panel header

These have no visual spec in DESIGN.md:
- item form asset picker and its unlinked list (FR-11, FR-20)
- the `?` shortcut panel (FR-18)
- the export dialog (FR-35)
- the shared-spot pick list (FR-34)
- the unknown-kind marker (FR-11)
- the duplicate-name underline and tooltip (FR-11)
- validation-while-drawing messages (FR-19)
- the phone Undo bar, beyond the shared toast
- the phone top bar (search plus Needs you, expanding)
- the Edit button in the bottom sheet

The FR-36 first-run tour (on a throwaway layer) is in neither file; it depends on Open Question 2.

## 4. State coverage - adequate, with gaps

- Busy or cold-load treatment is an [ASSUMPTION] (the spinner pattern); no skeletons are decided.
- The no-search-results wording is an [ASSUMPTION].
- The Needs you bar when nothing needs you is open (Open Question 8).
- Not covered:
  - the custom popup view missing, with its fallback message (FR-37)
  - the satellite basemap not configured, and where provider attribution sits (FR-32, AD-12)
  - a kind list that is empty or arrives without kinds
  - the Recent changes list when empty
  - an import that fails to save midway
  - the phone on patchy cellular (the unsaved queue applies, but no phone-specific treatment)
  - keyboard focus appearance in the panels and on the map

## 5. Visual reference coverage - thin

- Nothing is promoted to `mockups/` yet. The spines link `.working/` files directly: EXPERIENCE.md Information Architecture links all eight PNGs and `editor-directions.html`, and DESIGN.md Brand & Style links the two Direction A renders.
- The imports `atlist-1` to `atlist-4` are linked in DESIGN.md Brand & Style and in EXPERIENCE.md Inspiration, each saying what it shows.
- DESIGN.md Components does not link the Kinds and bulk renders at the matching components (the kind setup rows and the bulk form).
- "Spines win on conflict" is stated in both files. The rubric asks for once, so this is minor.
- Known conflicts between the mock and the memlog, where the spine follows the memlog:
  - Kinds section order: the mock puts the Style rule second.
  - Layers content: the mock has Show toggles and reference layers.
  - The phone edit entry.

## Owner decisions relayed during distillation, not yet in .memlog.md

- 2026-10-27: a line's look is per segment, drawn from the instruments at that segment's two ends.
- 2026-10-27: deleting a line deletes its instruments in the same save, and one undo restores both.

Both are applied in EXPERIENCE.md. They should be appended to the memlog (`memlog.py append --type decision`). The PRD (section 9, questions 9 and 10) and the architecture Deferred list should close them.
