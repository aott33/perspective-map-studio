# Value styles and area tints

Every look a style rule can give a map item, and every tint an area can take, in both Perspective themes (epic 3 entry 1; initiative R40, prd FR-38 and FR-39, architecture AD-11 and AD-16). Entry 12 takes this page to the engineering review (ER-27) with the alarm priority tokens and the `comms-lost` token, so the hues named here are stand-ins: each is a theme token the host project may redefine, with a Perspective variable as its fallback, and no colour literal is in the module's styles or in any stored rule. How a rule is written and evaluated: [kind-setup.md](kind-setup.md), "Style rules as the map evaluates them".

Labels: **[live 8.3.10]** seen on the `ops/` dev Gateway (Ignition 8.3.10) by `e2e/tests/styles.spec.mjs`, which takes the screenshots below from the dev page `/styles`; **[build]** unit tested in node (`web/typescript/__tests__/markers.test.ts`, `stylePreview.test.ts`); **[ER-27]** for the engineering review.

## The rule

A state is said twice (DESIGN.md: a word or glyph as well as any hue), and a normal item shows no hue. Alarm state draws over a value style, and both draw over an area's tint. A stale source (no value yet, a bad quality, comms lost) drops the value style: the item draws only as stale, with the stale or comms-lost glyph and word, until a fresh value arrives **[live 8.3.10]**.

## Presets

The closed list is `common/.../contract/StylePresets.java` (`normal`, `attention`, `warning`, `fault`, `dimmed` for every kind; `solid`, `dashed`, `dotted` for line kinds). The dev page `/styles` draws every preset in the palettes under the kind previews (the component's `previewStyles` prop):

| Preset | Point | Line | Word | Token and fallback |
| --- | --- | --- | --- | --- |
| `normal` | the neutral disc, glyph and 1.5 px ring | the pipeline grey, solid | none | `--neutral-60` (the line and dot) |
| `attention` | a 3 px ring, no hue | the line in the token, solid | "Attention" | `--mapstudio-attention`, falling back to `--neutral-90` (then `--label`) |
| `warning` | a 2.5 px ring in the token | the line in the token | "Warning" | `--mapstudio-warning`, falling back to `--warning` |
| `fault` | a 2.5 px ring in the token | the line in the token | "Fault" | `--mapstudio-fault`, falling back to `--error` |
| `dimmed` | the disc and glyph at 45 % with a dashed neutral ring | the line at 45 % | "Out of service" | none (a fade) |
| `solid` | not a point preset | solid, the pipeline grey | none | none |
| `dashed` | not a point preset | dashes 2.5 and 2 line widths | none | none |
| `dotted` | not a point preset | round dots every 2.2 line widths | none | none |

The word sits in the state chip beside the name (a point) or in the line's name chip at its midpoint, in the map's text, as "Stale" and "Comms lost" do; the alarm badge and digit draw over any ring. A line's weight is not a preset: 2 px with no instrument on it, else 3, 4 or 6 px by its `diameter` ([contract.md](contract.md), "What the map draws").

Stand-in hues to review **[ER-27]**: `fault` falls back to the same `--error` as alarm priority 1 and `warning` to the same `--warning` as priority 2; the ring and the word tell them from the alarm badge and its digit, but the review may want the presets on hues of their own. `attention` is no hue at all (DESIGN.md: a heavier outline plus the word).

## Area tints

Six tints, `tint-1` to `tint-6`, for area kinds only (a line kind with `area: true`): an area draws as a closed fill at 22 % opacity and a 1.5 px outline at 80 % in its tint, so the wash stays low in saturation over any basemap; a point or a line never takes one, and a category with no tint (or no `areaTints`) draws the neutral area look in the pipeline grey. The tokens fall back to Perspective's qualitative palette, chosen to avoid the comms-lost purple (`--qual-1`) and the error red:

| Tint | Token | Fallback | Light theme value | Dark theme value |
| --- | --- | --- | --- | --- |
| `tint-1` | `--mapstudio-tint-1` | `--qual-3` | #086962 (teal) | #08827A |
| `tint-2` | `--mapstudio-tint-2` | `--qual-7` | #038537 (green) | #46E385 |
| `tint-3` | `--mapstudio-tint-3` | `--qual-2` | #229AD6 (sky) | #53BAED |
| `tint-4` | `--mapstudio-tint-4` | `--qual-9` | #ED5393 (pink) | #ED5393 |
| `tint-5` | `--mapstudio-tint-5` | `--qual-10` | #CF7911 (amber) | #E89C3F |
| `tint-6` | `--mapstudio-tint-6` | `--qual-8` | #114599 (navy) | #5691F0 |

The values are what Perspective's bundled `light` and `dark` themes define for the fallbacks (read from the 8.3.10 Perspective themes, for this page only; the module never holds them). To review **[ER-27]**: `tint-5` is in the warning family and `tint-3` and `tint-6` in the info family of alarm priority 3; at 22 % the wash is far from the alarm hues, but the review may pick other palette entries or a host theme may define the six tokens itself.

## The preview

The kind setup screen (epic-editing) embeds `StylePreview` (exported by the bundle as `MapStudio.StylePreview`, beside `PresetPalette` and `TintPalette`): one tile per case of a rule with the case's words ("When the value is 2", "When the value is 50 to 200", "When the expression gives warning"), the look the map draws for that preset (the marker image's own SVG for a point kind, a line sample for a line kind) and the preset's word; for an area kind one swatch per category tint. It draws with the same code as the map (`web/typescript/markers.ts`), from the sprite and the theme tokens of the component it sits in **[build]**.

## In both themes

From the dev stack's `/styles` page (the seeded pad States rule, the line Bands rule and the geofence tints, then the palettes), light and dark **[live 8.3.10]**:

- [The preview, light theme, 1440 px](screenshots/mapstudio-styles-preview-light-1440.png)
- [The preview, dark theme, 1440 px](screenshots/mapstudio-styles-preview-dark-1440.png)
- [The map with a warning marker, an attention line and the two tinted geofences, 1440 px](screenshots/mapstudio-styles-1440.png)
- [The preview on a phone, 390 px](screenshots/mapstudio-styles-390.png)

A contrast check of each ring, line and wash against the basemaps and surfaces (3:1, prd NFR-3) is entry 12's, against the host theme.
