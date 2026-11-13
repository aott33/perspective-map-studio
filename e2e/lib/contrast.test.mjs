// Unit tests of the contrast check (epic 3 entry 12; the studio's parts, epic 4 entry 17b): node --test lib/

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    MARKS, MINIMUM, OSM_LAND, STUDIO_PARTS, TOKENS, checkParts, checkTheme, contrastRatio, flatten, groupParts, hex, luminance, markdownTable, misses, over,
    parseColor, partMisses, partsTable, quietColor
} from './contrast.mjs';

test('colours parse from hex and rgb() forms; anything else is refused', () => {
    assert.deepEqual(parseColor('#F4F4F4'), [244, 244, 244, 1]);
    assert.deepEqual(parseColor('#abc'), [170, 187, 204, 1]);
    assert.deepEqual(parseColor('rgb(12, 123, 179)'), [12, 123, 179, 1]);
    assert.deepEqual(parseColor('rgba(12, 123, 179, 0.5)'), [12, 123, 179, 0.5]);
    assert.equal(hex(parseColor('rgb(12, 123, 179)')), '#0C7BB3');
    assert.throws(() => parseColor('transparent'));
    assert.throws(() => parseColor(''));
});

test('the WCAG numbers: black on white is 21, white on white 1, the luminance of mid grey', () => {
    assert.equal(Math.round(contrastRatio('#000000', '#FFFFFF') * 100) / 100, 21);
    assert.equal(contrastRatio('#FFFFFF', '#FFFFFF'), 1);
    assert.ok(Math.abs(luminance('#767676') - 0.181) < 0.002);
    // Perspective's light theme: purple-70 against the blank map (the figure docs/review-er27.md quotes).
    assert.equal(Math.round(contrastRatio('#7D3CBD', '#F4F4F4') * 100) / 100, 5.87);
});

test('a mark drawn at an opacity is checked as composited over its surface', () => {
    assert.equal(over('#000000', 0.5, '#FFFFFF'), '#808080');
    assert.equal(over('#086962', 1, '#F4F4F4'), '#086962');
    assert.ok(contrastRatio(over('#086962', 0.8, '#F4F4F4'), '#F4F4F4') < contrastRatio('#086962', '#F4F4F4'));
});

/** Perspective 8.3.10's bundled light theme, as the tokens of mapstudio.css resolve there. */
const LIGHT = {
    blank: '#F4F4F4', panel: '#FAFAFA', commsLost: '#B01355', alarm1: '#DE1B1B', alarm2: '#AD5F00', alarm3: '#3272D9',
    attention: '#323232', warning: '#AD5F00', fault: '#DE1B1B', tint1: '#086962', tint2: '#038537', tint3: '#229AD6', tint4: '#114599',
    tint5: '#CF7911', tint6: '#21C2B7', label: '#323232', textSecondary: '#767676', line: '#767676', lateral: '#A1A1A1', selection: '#0C7BB3'
};
/** The bundled dark theme. */
const DARK = {
    blank: '#323232', panel: '#161616', commsLost: '#F78BB8', alarm1: '#F55353', alarm2: '#CF7911', alarm3: '#5691F0',
    attention: '#F4F4F4', warning: '#CF7911', fault: '#F55353', tint1: '#08827A', tint2: '#46E385', tint3: '#53BAED', tint4: '#5691F0',
    tint5: '#E89C3F', tint6: '#21C2B7', label: '#F4F4F4', textSecondary: '#A1A1A1', line: '#A1A1A1', lateral: '#767676', selection: '#229AD6'
};

test('every state mark passes 3:1 on its surfaces in both bundled themes; the result table names each', () => {
    for (const [theme, values] of [['light', LIGHT], ['dark', DARK]]) {
        const result = checkTheme(values);
        assert.equal(result.surfaces.raster, OSM_LAND);
        assert.deepEqual(misses(result).map((m) => m.id), [], theme + ' misses');
        assert.equal(result.marks.length, MARKS.length);
        const table = markdownTable(theme, result);
        assert.ok(table.includes('| Priority 1 alarm glyph'));
        assert.ok(table.includes(' pass |') && !table.includes(' MISS'));
        for (const mark of result.marks) {
            assert.ok(Object.values(TOKENS).includes(mark.token));
            for (const ratio of Object.values(mark.ratios)) {
                assert.ok(ratio >= 1 && ratio <= 21);
            }
        }
    }
});

test('purple-60 on the dark map is the miss that moved comms lost to the magenta family', () => {
    const result = checkTheme({ ...DARK, commsLost: '#9656D6' });
    assert.deepEqual(misses(result).map((m) => m.id), ['comms-lost-glyph', 'comms-lost-ring']);
    assert.ok(result.marks.find((m) => m.id === 'comms-lost-glyph').ratios.blank < MINIMUM);
    assert.ok(markdownTable('dark', result).includes(' MISS'));
});

test('a value the browser cannot give fails the check instead of passing it', () => {
    assert.throws(() => checkTheme({ ...LIGHT, alarm1: '' }));
});

test('the quiet OpenStreetMap paint (item 25) is applied to the raster sample as MapLibre draws it, and every state mark still passes', () => {
    // No paint: the sample is the land colour itself.
    assert.equal(quietColor(OSM_LAND, {}), OSM_LAND);
    // Brightness alone lifts the darks: black at min 0.3 is #4D4D4D, white stays white.
    assert.equal(quietColor('#000000', { 'raster-brightness-min': 0.3 }), '#4D4D4D');
    assert.equal(quietColor('#FFFFFF', { 'raster-brightness-min': 0.3 }), '#FFFFFF');
    // Saturation -1 is grey (the channel average); contrast -1 is mid grey.
    assert.equal(quietColor('#FF0000', { 'raster-saturation': -1 }), '#555555');
    assert.equal(quietColor('#FF0000', { 'raster-contrast': -1 }), '#808080');
    const paint = { 'raster-saturation': -0.55, 'raster-contrast': -0.2, 'raster-brightness-min': 0.3 };
    const quiet = quietColor(OSM_LAND, paint);
    assert.notEqual(quiet, OSM_LAND);
    for (const [theme, values] of [['light', LIGHT], ['dark', DARK]]) {
        const result = checkTheme(values, paint);
        assert.equal(result.surfaces.raster, quiet);
        assert.deepEqual(misses(result).map((m) => m.id), [], theme + ' misses over the quiet tile');
    }
});

// ---- The studio's own parts (epic 4 entry 17b) ----

const WHITE = [250, 250, 250, 1];

test('colour layers flatten top down over an opaque ground; a ground that is not opaque is refused', () => {
    assert.equal(flatten([[12, 123, 179, 1]]), '#0C7BB3');
    assert.equal(flatten([[0, 0, 0, 0.5], [255, 255, 255, 1]]), '#808080');
    // Two tints over the ground: each drawn over what is under it.
    assert.equal(flatten([[0, 0, 0, 0.5], [0, 0, 0, 0.5], [255, 255, 255, 1]]), over('#000000', 0.5, '#808080'));
    // A layer above an opaque one hides nothing of it but itself.
    assert.equal(flatten([[0, 0, 0, 0], [50, 50, 50, 1]]), '#323232');
    assert.throws(() => flatten([[0, 0, 0, 0.5]]));
    assert.throws(() => flatten([]));
});

test('a studio part is checked at 3:1 against its surface; a faint fill misses and an inactive glyph is not counted', () => {
    const rows = checkParts([
        { part: 'focus-ring', where: 'Rail: Items', surface: [WHITE], marks: [{ what: 'ring', layers: [[12, 123, 179, 1]] }] },
        { part: 'hover', where: 'Toolbar: Point', surface: [WHITE], marks: [{ what: 'fill', layers: [[0, 0, 0, 0.06], WHITE] }] },
        { part: 'toolbar-glyph-off', where: 'Toolbar: Undo', surface: [WHITE], marks: [{ what: 'glyph', layers: [[200, 200, 200, 1]] }] }
    ]);
    assert.deepEqual(rows.map((r) => [r.part, r.pass, r.counted]), [['focus-ring', true, true], ['hover', false, true], ['toolbar-glyph-off', true, false]]);
    assert.equal(rows[0].ratio, Math.round(contrastRatio('#0C7BB3', '#FAFAFA') * 100) / 100);
    assert.ok(rows[1].ratio < MINIMUM && rows[2].ratio < MINIMUM);
    assert.deepEqual(partMisses(rows).map((r) => r.where), ['Toolbar: Point']);
    const table = partsTable('light', rows);
    assert.ok(table.includes(' pass | Rail: Items |') && table.includes(' MISS | Toolbar: Point |') && table.includes('(not counted) | Toolbar: Undo |'));
});

test('a state with several marks is seen by its strongest: a faint fill with a strong edge passes, named by the edge', () => {
    const [row] = checkParts([{ part: 'pressed', where: 'Layers: None', surface: [WHITE],
        marks: [{ what: 'fill', layers: [[12, 123, 179, 0.1], WHITE] }, { what: 'edge', layers: [[12, 123, 179, 1]] }] }]);
    assert.equal(row.mark, 'edge');
    assert.equal(row.color, '#0C7BB3');
    assert.equal(row.pass, true);
});

test('readings alike are one line of the table, their places joined; an unknown part or a reading with no mark is refused', () => {
    const ring = (where) => ({ part: 'focus-ring', where, surface: [WHITE], marks: [{ what: 'ring', layers: [[12, 123, 179, 1]] }] });
    const rows = checkParts(['a', 'b', 'c', 'd', 'e', 'a'].map(ring));
    const groups = groupParts(rows);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].where, ['a', 'b', 'c', 'd', 'e']);
    assert.ok(partsTable('dark', rows, 2).includes('| a; b; and 3 more |'));
    assert.throws(() => checkParts([{ part: 'glow', where: 'x', surface: [WHITE], marks: [{ what: 'ring', layers: [WHITE] }] }]));
    assert.throws(() => checkParts([{ part: 'hover', where: 'x', surface: [WHITE], marks: [] }]));
    assert.ok(STUDIO_PARTS.every((p) => p.words !== '' && typeof p.counted === 'boolean'));
});
