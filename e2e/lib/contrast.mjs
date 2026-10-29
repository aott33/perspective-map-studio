// The contrast check of the hue tokens (epic 3 entry 12, R16; prd NFR-3; DESIGN.md Colors: every
// non-text mark that carries state reaches 3:1 against the basemap and the panel in both themes,
// WCAG 2.1 success criterion 1.4.11, non-text contrast). Pure: the relative luminance and contrast
// ratio of WCAG 2.1, alpha compositing for the marks drawn at an opacity, and the list of every
// state mark the map draws with the token it draws in and the surfaces it is seen against.
// e2e/tests/review.spec.mjs reads the tokens' computed values from the showcase page in each theme
// and checks every mark with these; docs/review-er27.md carries the result table. Unit tested in
// contrast.test.mjs.

/** sRGB channel (0 to 255) to linear light (WCAG 2.1, relative luminance). */
export function linear(channel) {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** A computed CSS colour (`#rrggbb`, `#rgb`, `rgb(r, g, b)` or `rgba(...)`) to [r, g, b, a]. */
export function parseColor(value) {
    const v = String(value || '').trim();
    let m = /^#([0-9a-f]{6})$/i.exec(v);
    if (m) {
        return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
    }
    m = /^#([0-9a-f]{3})$/i.exec(v);
    if (m) {
        return [...m[1]].map((h) => parseInt(h + h, 16)).concat([1]);
    }
    m = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i.exec(v);
    if (m) {
        const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
        return [Number(m[1]), Number(m[2]), Number(m[3]), a];
    }
    throw new Error('Not a computed colour: ' + JSON.stringify(value));
}

/** The `#RRGGBB` form of [r, g, b]. */
export function hex([r, g, b]) {
    return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** Relative luminance of a colour (WCAG 2.1). */
export function luminance(color) {
    const [r, g, b] = parseColor(color);
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** The contrast ratio of two colours, 1 to 21 (WCAG 2.1). */
export function contrastRatio(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `color` drawn at `opacity` over `background`, as the viewer sees it: the composited `#RRGGBB`. */
export function over(color, opacity, background) {
    const f = parseColor(color);
    const g = parseColor(background);
    return hex([0, 1, 2].map((i) => opacity * f[i] + (1 - opacity) * g[i]));
}

/**
 * The light raster sample: the land colour of the standard OpenStreetMap style (openstreetmap-carto,
 * `@land-color` in style.mss), the lightest ground a tile shows in either theme. The e2e suite's tile
 * stub is a flat test colour, so the sample is this constant, not a pixel of a committed screenshot.
 */
export const OSM_LAND = '#F2EFE9';

/** The three surfaces a mark is checked against: the blank map, the panel surface and the light raster. */
export const SURFACES = ['blank', 'panel', 'raster'];

/** The smallest ratio a state mark may have (WCAG 2.1, 1.4.11). */
export const MINIMUM = 3;

/**
 * The tokens the check reads from the component root, with the surface each gives (the rest are marks).
 * The surfaces: `--mapstudio-blank` (the blank basemap and the halo of every marker, badge, text and
 * line) and `--mapstudio-surface` (the panel surface, the popup, the chip fill and every marker's disc).
 */
export const TOKENS = {
    blank: '--mapstudio-blank',
    panel: '--mapstudio-surface',
    commsLost: '--mapstudio-comms-lost',
    alarm1: '--mapstudio-alarm-1',
    alarm2: '--mapstudio-alarm-2',
    alarm3: '--mapstudio-alarm-3',
    attention: '--mapstudio-attention',
    warning: '--mapstudio-warning',
    fault: '--mapstudio-fault',
    tint1: '--mapstudio-tint-1',
    tint2: '--mapstudio-tint-2',
    tint3: '--mapstudio-tint-3',
    tint4: '--mapstudio-tint-4',
    tint5: '--mapstudio-tint-5',
    tint6: '--mapstudio-tint-6',
    label: '--label',
    textSecondary: '--label--disabled',
    line: '--neutral-60',
    lateral: '--neutral-50',
    selection: '--callToAction'
};

/**
 * Every mark the map draws that carries state, with the token it draws in, how it is drawn, the
 * surfaces it is seen against and its opacity there (`state: true` marks must reach MINIMUM on
 * every surface in `surfaces`; the others are informational: a category tint, a normal look, text,
 * which the words beside them or the text contrast rule cover). A mark drawn on the marker's halo
 * disc or inside the disc is checked against the blank and the panel only: the raster never shows
 * through them. A line is seen against its halo: since entry 12 every line draws over a halo in the
 * blank-map token, one pixel each side, as the markers do (markers.ts LINE_HALO_WIDTH), so a line's
 * counted surface is `blank` (the halo and the blank map) and `raster` in `also` is the look the
 * halo was added for, the line on a light tile before the halo, reported but not counted.
 */
export const MARKS = [
    { id: 'alarm-1-glyph', words: 'Priority 1 alarm glyph and digit (badge on the halo disc; the Needs you bar, the legend, the popup on the panel)', token: 'alarm1', state: true, surfaces: ['blank', 'panel'] },
    { id: 'alarm-2-glyph', words: 'Priority 2 alarm glyph and digit', token: 'alarm2', state: true, surfaces: ['blank', 'panel'] },
    { id: 'alarm-3-glyph', words: 'Priority 3 alarm glyph (the outlined square) and digit', token: 'alarm3', state: true, surfaces: ['blank', 'panel'] },
    { id: 'alarm-1-line', words: 'Line in the priority 1 hue (over its halo)', token: 'alarm1', state: true, surfaces: ['blank'], also: ['raster'] },
    { id: 'alarm-2-line', words: 'Line in the priority 2 hue', token: 'alarm2', state: true, surfaces: ['blank'], also: ['raster'] },
    { id: 'alarm-3-line', words: 'Line in the priority 3 hue', token: 'alarm3', state: true, surfaces: ['blank'], also: ['raster'] },
    { id: 'comms-lost-glyph', words: 'Comms lost: the kind glyph in the disc, the badge on the halo disc, the Needs you and legend glyphs', token: 'commsLost', state: true, surfaces: ['blank', 'panel'] },
    { id: 'comms-lost-ring', words: 'Comms lost: the 2 px dashed ring inside the disc', token: 'commsLost', state: true, surfaces: ['panel', 'blank'] },
    { id: 'stale-glyph', words: 'Stale: the glyph in the text colour (badge, Needs you, legend)', token: 'label', state: true, surfaces: ['blank', 'panel'] },
    { id: 'stale-ring', words: 'Stale: the 1.5 px dashed neutral ring inside the disc', token: 'line', state: true, surfaces: ['panel', 'blank'] },
    { id: 'dashed-line', words: 'Dashed line: no data, comms lost or stale (the pipeline tone)', token: 'line', state: true, surfaces: ['blank'], also: ['raster'] },
    { id: 'attention-ring', words: 'Attention preset: the 3 px neutral outline', token: 'attention', state: true, surfaces: ['panel', 'blank'] },
    { id: 'attention-line', words: 'Attention preset on a line', token: 'attention', state: true, surfaces: ['blank'], also: ['raster'] },
    { id: 'warning-ring', words: 'Warning preset: the 2.5 px ring', token: 'warning', state: true, surfaces: ['panel', 'blank'] },
    { id: 'warning-line', words: 'Warning preset on a line', token: 'warning', state: true, surfaces: ['blank'], also: ['raster'] },
    { id: 'fault-ring', words: 'Fault preset: the 2.5 px ring', token: 'fault', state: true, surfaces: ['panel', 'blank'] },
    { id: 'fault-line', words: 'Fault preset on a line', token: 'fault', state: true, surfaces: ['blank'], also: ['raster'] },
    { id: 'chip-word', words: 'The state chip\'s word ("Stale", "Comms lost", a preset\'s word) on the chip fill', token: 'label', state: true, surfaces: ['panel'] },
    { id: 'selection-ring', words: 'The selection ring, casing and flow arrow', token: 'selection', state: false, surfaces: ['blank', 'raster'] },
    { id: 'pipeline', words: 'A normal pipeline (no state)', token: 'line', state: false, surfaces: ['blank', 'raster'] },
    { id: 'lateral', words: 'A lateral or untinted area outline (no state)', token: 'lateral', state: false, surfaces: ['blank', 'raster'] },
    { id: 'name', words: 'An item\'s name (text on its halo)', token: 'label', state: false, surfaces: ['blank'] },
    { id: 'tint-1', words: 'Area tint 1 outline at 80 % (a category, not a state)', token: 'tint1', state: false, opacity: 0.8, surfaces: ['blank', 'raster'] },
    { id: 'tint-2', words: 'Area tint 2 outline at 80 %', token: 'tint2', state: false, opacity: 0.8, surfaces: ['blank', 'raster'] },
    { id: 'tint-3', words: 'Area tint 3 outline at 80 %', token: 'tint3', state: false, opacity: 0.8, surfaces: ['blank', 'raster'] },
    { id: 'tint-4', words: 'Area tint 4 outline at 80 %', token: 'tint4', state: false, opacity: 0.8, surfaces: ['blank', 'raster'] },
    { id: 'tint-5', words: 'Area tint 5 outline at 80 %', token: 'tint5', state: false, opacity: 0.8, surfaces: ['blank', 'raster'] },
    { id: 'tint-6', words: 'Area tint 6 outline at 80 %', token: 'tint6', state: false, opacity: 0.8, surfaces: ['blank', 'raster'] }
];

/**
 * The check of one theme: `values` maps each key of TOKENS to its computed colour. Returns
 * {surfaces: {blank, panel, raster}, marks: [{id, words, state, token, color, ratios: {surface: ratio}, counted: {surface: bool}, pass}]}
 * where `pass` is false when a state mark is under MINIMUM on a counted surface.
 */
export function checkTheme(values) {
    const surfaces = { blank: hex(parseColor(values.blank)), panel: hex(parseColor(values.panel)), raster: OSM_LAND };
    const marks = MARKS.map((mark) => {
        const color = hex(parseColor(values[mark.token]));
        const ratios = {};
        const counted = {};
        let pass = true;
        for (const surface of [...mark.surfaces, ...(mark.also || [])]) {
            const seen = mark.opacity === undefined ? color : over(color, mark.opacity, surfaces[surface]);
            const ratio = Math.round(contrastRatio(seen, surfaces[surface]) * 100) / 100;
            ratios[surface] = ratio;
            counted[surface] = mark.state && mark.surfaces.includes(surface);
            if (counted[surface] && ratio < MINIMUM) {
                pass = false;
            }
        }
        return { id: mark.id, words: mark.words, state: mark.state, token: TOKENS[mark.token], color, ratios, counted, pass };
    });
    return { surfaces, marks };
}

/** The marks of a checked theme that miss: state marks under MINIMUM on a surface. */
export function misses(result) {
    return result.marks.filter((m) => !m.pass);
}

/** The result of one theme as a Markdown table (docs/review-er27.md). */
export function markdownTable(theme, result) {
    const lines = ['| Mark | Token | ' + theme + ' value | Blank map ' + result.surfaces.blank + ' | Panel ' + result.surfaces.panel
        + ' | Light raster ' + result.surfaces.raster + ' | State mark |', '| --- | --- | --- | --- | --- | --- | --- |'];
    for (const m of result.marks) {
        const cell = (s) => m.ratios[s] === undefined ? '-' : m.ratios[s].toFixed(2) + (m.counted[s] ? (m.ratios[s] >= MINIMUM ? ' pass' : ' MISS') : '');
        lines.push('| ' + m.words + ' | `' + m.token + '` | ' + m.color + ' | ' + cell('blank') + ' | ' + cell('panel') + ' | ' + cell('raster')
            + ' | ' + (m.state ? 'yes' : 'no') + ' |');
    }
    return lines.join('\n');
}
