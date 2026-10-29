# Value styles and area tints

Every look a style rule can give a map item, and every tint an area can take, in both Perspective themes (epic 3 entry 1; initiative R40, prd FR-38 and FR-39, architecture AD-11 and AD-16). The hues are the tokens entry 12 chose and took to the engineering review (ER-27) with the alarm priority tokens and the `comms-lost` token ([review-er27.md](review-er27.md), sections 1 and 2: the contrast check and the reasons): each is a theme token the host project may redefine, with a Perspective variable as its fallback, and no colour literal is in the module's styles or in any stored rule. How a rule is written and evaluated: [kind-setup.md](kind-setup.md), "Style rules as the map evaluates them".

Labels: **[live 8.3.10]** seen on the `ops/` dev Gateway (Ignition 8.3.10) by `e2e/tests/styles.spec.mjs`, which takes the screenshots below from the dev page `/styles`; **[build]** unit tested in node (`web/typescript/__tests__/markers.test.ts`, `stylePreview.test.ts`); **[ER-27]** for the engineering review.

## The rule

A state is said twice (DESIGN.md: a word or glyph as well as any hue), and a normal item shows no hue. Alarm state draws over a value style, and both draw over an area's tint. A stale source (no value yet, a bad quality, comms lost) drops the value style: the item draws only as stale, with the stale or comms-lost glyph and word, until a fresh value arrives **[live 8.3.10]**.

## Presets

The closed list is `common/.../contract/StylePresets.java` (`normal`, `attention`, `warning`, `fault`, `dimmed` for every kind; `solid`, `dashed`, `dotted` for line kinds). The dev page `/styles` draws every preset in the palettes under the kind previews (the component's `previewStyles` prop):

| Preset | Point | Line | Word | Token and fallback |
| --- | --- | --- | --- | --- |
| `normal` | the neutral disc, glyph and 1.5 px ring (`--neutral-50` on a site, `--neutral-60` on an instrument; DESIGN.md map-marker and instrument-marker) | the pipeline grey, solid; an untapped line and a geofence outline in `--neutral-50` (DESIGN.md line-lateral) | none | `--neutral-60` (the line and dot) |
| `attention` | a 3 px ring, no hue | the line in the token, solid | "Attention" | `--mapstudio-attention`, falling back to `--neutral-90` (then `--label`) |
| `warning` | a 2.5 px ring in the token | the line in the token | "Warning" | `--mapstudio-warning`, falling back to `--warning` |
| `fault` | a 2.5 px ring in the token | the line in the token | "Fault" | `--mapstudio-fault`, falling back to `--error` |
| `dimmed` | the disc and glyph at 45 % with a dashed neutral ring | the line at 45 % | "Out of service" | none (a fade) |
| `solid` | not a point preset | solid, the pipeline grey | none | none |
| `dashed` | not a point preset | dashes 2.5 and 2 line widths | none | none |
| `dotted` | not a point preset | round dots every 2.2 line widths | none | none |

The word sits in the state chip beside the name (a point) or in the line's name chip at its midpoint, in the map's text, as "Stale" and "Comms lost" do; the alarm badge and digit draw over any ring. A line's weight is not a preset: 2 px with no instrument on it, else 3, 4 or 6 px by its `diameter` ([contract.md](contract.md), "What the map draws").

**Per segment (epic 3 entry 2).** A line whose rule is the instruments source (`{"instruments": "worst"}`) draws each segment between its measuring instruments in the look the Gateway graded for it: the worse of the two end instruments' presets in the hue and pattern above, `dashed` with the stale look when either end is stale, and the alarm hue with the segment's worse end alarm over both; the line's chip at the midpoint says the worst word over the segments ("L-SWD Stale"). The line's own alarm still colours the whole line. Lines without instruments, and lines with another rule, draw as one line ([instruments.md](instruments.md)).

Presets against alarms **[ER-27]**: `fault` falls back to the same `--error` as alarm priority 1 and `warning` to the same `--warning` as priority 2, because a Perspective theme has one error and one warning hue and the bundled palette has no free family left for two more (magenta and purple are comms lost's, blue is priority 3's). They are never confused: a preset is a ring round the disc and a word in the chip, an alarm the IEC glyph with its digit, and both draw when both apply ([review-er27.md](review-er27.md), section 1; the review may still ask for hues of their own). `attention` is no hue at all (DESIGN.md: a heavier outline plus the word).

## Area tints

Six tints, `tint-1` to `tint-6`, for area kinds only (a line kind with `area: true`): an area draws as a closed fill at 22 % opacity and a 1.5 px outline at 80 % in its tint, so the wash stays low in saturation over any basemap; a point or a line never takes one, and a category with no tint (or no `areaTints`) draws the neutral area look as a dashed outline in the lateral tone. The tokens fall back to Perspective's palette variables, from the families no state uses where the bundled palette has one (entry 12): none is magenta or purple (comms lost's family) or red (priority 1's):

| Tint | Token | Fallback | Light theme value | Dark theme value |
| --- | --- | --- | --- | --- |
| `tint-1` | `--mapstudio-tint-1` | `--qual-3` | #086962 (teal) | #08827A |
| `tint-2` | `--mapstudio-tint-2` | `--qual-7` | #038537 (green) | #46E385 |
| `tint-3` | `--mapstudio-tint-3` | `--qual-2` | #229AD6 (sky) | #53BAED |
| `tint-4` | `--mapstudio-tint-4` | `--qual-8` | #114599 (navy) | #5691F0 |
| `tint-5` | `--mapstudio-tint-5` | `--qual-10` | #CF7911 (sand) | #E89C3F |
| `tint-6` | `--mapstudio-tint-6` | `--div-12` | #21C2B7 (light teal) | #21C2B7 |

The values are what Perspective's bundled `light` and `dark` themes define for the fallbacks, read from the showcase page by the contrast check (`e2e/tests/review.spec.mjs`; the module never holds them). To review **[ER-27]**: `tint-5` (sand) is in the bronze family of alarm priority 2 and the warning preset, and `tint-4` (navy) in the blue family of priority 3 (in the dark theme the two fallbacks coincide, #5691F0); as drawn a 22 % wash with an 80 % outline is far from a glyph with a digit or a ring with a word, but the review may pick other entries or a host theme may define the six tokens itself. `tint-6` is a second teal at another lightness, the same value in both themes, because the bundled palette has five families no state uses.

## The preview

The kind setup screen (epic-editing) embeds `StylePreview` (exported by the bundle as `MapStudio.StylePreview`, beside `PresetPalette` and `TintPalette`): one tile per case of a rule with the case's words ("When the value is 2", "When the value is 50 to 200", "When the expression gives warning"), the look the map draws for that preset (the marker image's own SVG for a point kind, a line sample for a line kind) and the preset's word; for an area kind one swatch per category tint. It draws with the same code as the map (`web/typescript/markers.ts`), from the sprite and the theme tokens of the component it sits in **[build]**.

## In both themes

From the dev stack's `/styles` page (the seeded pad States rule, the line Bands rule and the geofence tints, then the palettes), light and dark **[live 8.3.10]**:

- [The preview, light theme, 1440 px](screenshots/mapstudio-styles-preview-light-1440.png)
- [The preview, dark theme, 1440 px](screenshots/mapstudio-styles-preview-dark-1440.png)
- [The map with a warning marker, an attention line and the two tinted geofences, 1440 px](screenshots/mapstudio-styles-1440.png)
- [The preview on a phone, 390 px](screenshots/mapstudio-styles-390.png)

The contrast check of each ring, line and wash against the blank map, the panel and a light raster sample (3:1 for every state mark, prd NFR-3; the tints reported, not counted) is entry 12's: [review-er27.md](review-er27.md), section 2, with the tables of both bundled themes.
