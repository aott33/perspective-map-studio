import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ItemState } from '../live';
import {
    ARROW_IMAGE, CHIP_IMAGE, DISC_CENTER, DOT_IMAGE, MARKER_IMAGE, MARKER_TOKENS, MarkerColors, RANK_ALARM, RANK_COMMS_LOST, RANK_NORMAL,
    RANK_SELECTED, RANK_STALE, badgeImageId, chipOffsetEm, dotImageId, imageFor, labelRank, lineLook, lineProperties, lineWeight,
    markerImageId, markerProperties, markerSpec, markerSvg, parseImageId, parseSprite, stateWord, textWidthPx
} from '../markers';

const COLORS: MarkerColors = {
    disc: 'rgb(255, 255, 255)', glyph: 'rgb(30, 30, 30)', halo: 'rgb(250, 250, 250)', textSecondary: 'rgb(120, 120, 120)',
    line: 'rgb(90, 90, 90)', chipEdge: 'rgb(150, 150, 150)', selection: 'rgb(20, 80, 200)',
    commsLost: 'rgb(125, 60, 189)', alarm: ['rgb(200, 0, 0)', 'rgb(173, 95, 0)', 'rgb(50, 114, 217)'], font: 'Inter, sans-serif'
};

const NORMAL: ItemState = { commsLost: false, stale: false, alarm: null, iconKpi: { key: 'pressure', text: '412 psi', stale: false }, badge: 'normal' };
const LOST: ItemState = { commsLost: true, stale: true, alarm: null, iconKpi: { key: 'pressure', text: '412 psi', stale: true }, badge: 'comms-lost' };
const STALE: ItemState = { commsLost: false, stale: true, alarm: null, iconKpi: { key: 'pressure', text: '412 psi', stale: true }, badge: 'stale' };
const ALARM: ItemState = { commsLost: false, stale: false, alarm: { priority: 1, unacked: true, active: 1, stale: false }, iconKpi: null, badge: 'alarm' };

/** The sprite as the build writes it (web/scripts/icons.mjs), from the committed sources. */
function sprite(): Record<string, ReturnType<typeof parseSprite>[string]> {
    const src = path.join(__dirname, '..', '..', 'icons', 'src');
    const ids = ['well-pad', 'point', 'comms-lost', 'stale', 'alarm-1-unacknowledged', 'alarm-1-acknowledged', 'alarm-3'];
    const text = '<svg xmlns="http://www.w3.org/2000/svg">\n' + ids.map((id) => {
        const svg = readFileSync(path.join(src, id + '.svg'), 'utf8').trim();
        return svg.replace(/^<svg\b([^>]*)>/, (_m, attrs) => '<symbol id="ms-' + id + '"' + attrs.replace(/\s*xmlns="[^"]*"/, '') + '>')
            .replace(/<\/svg>\s*$/, '</symbol>');
    }).join('\n') + '\n</svg>';
    return parseSprite(text);
}

const allowedPaints = (svg: string): void => {
    const paints = svg.match(/(?:fill|stroke)="([^"]*)"/g) || [];
    const allowed = new Set(['none', 'currentColor', COLORS.disc, COLORS.glyph, COLORS.halo, COLORS.line, COLORS.chipEdge, COLORS.selection,
        COLORS.commsLost, ...COLORS.alarm]);
    for (const p of paints) {
        expect(allowed.has(p.replace(/^(?:fill|stroke)="/, '').replace(/"$/, ''))).toBe(true);
    }
};

describe('marker properties and image ids (epic 3 entries 5 and 7)', () => {
    test('a normal point names the disc image with its glyph; no KPI text or word is in the id', () => {
        const props = markerProperties('p1', 'Point 1', 'pad', 'well-pad', NORMAL, { labelRank: 10 });
        expect(props).toMatchObject({ id: 'p1', name: 'Point 1', kind: 'pad', state: 'normal', word: '', kpi: '412 psi', kpiStale: false,
            members: 1, memberIds: '', selected: false });
        expect(parseImageId(props.marker)).toEqual({ kind: 'marker', spec: { icon: 'well-pad', look: 'normal', badge: '', priority: 0, solid: false, selected: false } });
        expect(props.marker).not.toContain('psi');
        expect(props.dotMid).toBe(dotImageId(11, false));
        expect(props.dotSmall).toBe(dotImageId(7, false));
        expect(props.rank).toBe(RANK_NORMAL + 89);
        expect(markerProperties('p1', 'Point 1', 'pad', '', NORMAL).marker).toContain('"point"');
    });

    test('comms lost: the comms-lost badge, the word Comms lost, the stale KPI, the marker at every zoom', () => {
        const spec = markerSpec('well-pad', LOST);
        expect(spec).toEqual({ icon: 'well-pad', look: 'comms-lost', badge: 'comms-lost', priority: 0, solid: false, selected: false });
        expect(parseImageId(markerImageId(spec))).toEqual({ kind: 'marker', spec });
        const props = markerProperties('p1', 'Point 1', 'pad', 'well-pad', LOST);
        expect(props).toMatchObject({ word: 'Comms lost', kpi: '412 psi', kpiStale: true, state: 'comms-lost', rank: RANK_COMMS_LOST });
        expect(props.dotMid).toBe(props.marker);
        expect(props.dotSmall).toBe(props.marker);
        expect(stateWord(STALE)).toBe('Stale');
        expect(stateWord(NORMAL)).toBe('');
    });

    test('an alarm: solid when unacknowledged, hollow when acknowledged, priority 3 the one square glyph', () => {
        expect(markerSpec('well-pad', ALARM)).toMatchObject({ badge: 'alarm-1-unacknowledged', priority: 1, solid: true });
        const acked: ItemState = { ...ALARM, alarm: { priority: 2, unacked: false, active: 1, stale: false } };
        expect(markerSpec('well-pad', acked)).toMatchObject({ badge: 'alarm-2-acknowledged', priority: 2, solid: false });
        const low: ItemState = { ...ALARM, alarm: { priority: 3, unacked: true, active: 1, stale: false } };
        expect(markerSpec('well-pad', low)).toMatchObject({ badge: 'alarm-3', priority: 3, solid: true });
        // An alarm over comms lost: the alarm badge, the comms-lost look and word stay.
        const both: ItemState = { ...LOST, alarm: ALARM.alarm, badge: 'alarm' };
        expect(markerSpec('well-pad', both)).toMatchObject({ look: 'comms-lost', badge: 'alarm-1-unacknowledged' });
        expect(markerProperties('p1', 'P', 'pad', 'well-pad', both).word).toBe('Comms lost');
    });

    test('the rank: selected, alarms by priority, comms lost, stale, then the kind list label rank', () => {
        expect(labelRank(ALARM, 0, true)).toBe(RANK_SELECTED);
        expect(labelRank(ALARM, 0, false)).toBe(RANK_ALARM);
        expect(labelRank({ ...ALARM, alarm: { priority: 2, unacked: true, active: 1, stale: false } }, 0, false)).toBe(1);
        expect(labelRank(LOST, 99, false)).toBe(RANK_COMMS_LOST);
        expect(labelRank(STALE, 99, false)).toBe(RANK_STALE);
        expect(labelRank(NORMAL, 10, false)).toBe(94);
        expect(labelRank(NORMAL, 0, false)).toBe(104);
        expect(labelRank(NORMAL, 500, false)).toBe(RANK_NORMAL);
        expect(labelRank(NORMAL, -3, false)).toBe(104);
    });

    test('a shared marker carries its members and no KPI; a selected one its ring', () => {
        const props = markerProperties('shared:a,b', 'A and B', 'pad', 'well-pad', STALE, { members: ['a', 'b'], selected: true });
        expect(props).toMatchObject({ members: 2, memberIds: 'a,b', kpi: '', word: 'Stale', selected: true, rank: RANK_SELECTED });
        expect(parseImageId(props.marker)).toMatchObject({ kind: 'marker', spec: { selected: true } });
        expect(markerProperties('p', 'P', 'pad', 'well-pad', NORMAL, { selected: true }).dotMid).toBe(dotImageId(11, true));
    });

    test('the chip sits right of the name by an estimate of its width', () => {
        expect(textWidthPx('P21', 12)).toBeCloseTo((0.68 + 0.57 + 0.57) * 12, 5);
        expect(textWidthPx('Mesa well', 12)).toBeGreaterThan(textWidthPx('P21', 12));
        expect(chipOffsetEm('P21')).toBeCloseTo((textWidthPx('P21', 12) / 2 + 4 + 5) / 11, 5);
    });

    test('ids that are not ours are refused; the dot, badge, chip and arrow ids parse', () => {
        expect(parseImageId('ms:marker:["x"]')).toBeNull();
        expect(parseImageId('ms:marker:nope')).toBeNull();
        expect(parseImageId('other')).toBeNull();
        expect(parseImageId('ms:marker:["well-pad","odd","",0,false,false]')).toBeNull();
        expect(parseImageId('ms:dot:[0,false]')).toBeNull();
        expect(parseImageId(dotImageId(11, true))).toEqual({ kind: 'dot', size: 11, selected: true });
        expect(parseImageId(badgeImageId('alarm-2-acknowledged', 2, false))).toEqual({ kind: 'badge', badge: 'alarm-2-acknowledged', priority: 2, solid: false });
        expect(parseImageId('ms:badge:["",0,false]')).toBeNull();
        expect(parseImageId(CHIP_IMAGE)).toEqual({ kind: 'chip' });
        expect(parseImageId(ARROW_IMAGE)).toEqual({ kind: 'arrow' });
    });
});

describe('line looks (DESIGN.md map-line)', () => {
    test('weight by pipe size with an instrument on the line, thin and neutral without', () => {
        expect(lineWeight(2)).toBe(3);
        expect(lineWeight(4)).toBe(3);
        expect(lineWeight(6)).toBe(4);
        expect(lineWeight(8)).toBe(4);
        expect(lineWeight(10)).toBe(6);
        expect(lineWeight('12')).toBe(6);
        expect(lineWeight(undefined)).toBe(3);
        expect(lineWeight('x')).toBe(3);
        expect(lineLook(NORMAL, 6, true)).toEqual({ weight: 4, hue: '', dashed: false, badge: '', priority: 0, solid: false });
        expect(lineLook(NORMAL, 6, false)).toMatchObject({ weight: 2, hue: '', dashed: false });
    });

    test('hue only from alarms with the badge at the midpoint; dashed for comms lost or stale', () => {
        const alarm2: ItemState = { ...ALARM, alarm: { priority: 2, unacked: true, active: 2, stale: false } };
        expect(lineLook(alarm2, 10, true)).toEqual({ weight: 6, hue: 'alarm-2', dashed: false, badge: 'alarm-2-unacknowledged', priority: 2, solid: true });
        expect(lineLook(LOST, 10, true)).toMatchObject({ hue: '', dashed: true, badge: '' });
        expect(lineLook(STALE, 10, true)).toMatchObject({ hue: '', dashed: true });
        const props = lineProperties('l', 'L', 'line', lineLook(alarm2, 10, true), COLORS, true);
        expect(props).toEqual({ id: 'l', name: 'L', kind: 'line', weight: 6, color: COLORS.alarm[1], hue: 'alarm-2', dashed: false, selected: true });
        expect(lineProperties('l', 'L', 'line', lineLook(LOST, 10, true), COLORS, false).color).toBe(COLORS.line);
    });
});

describe('marker images', () => {
    const symbols = sprite();

    test('the sprite parses to symbols with their root attributes and shapes', () => {
        expect(Object.keys(symbols).sort()).toEqual(['alarm-1-acknowledged', 'alarm-1-unacknowledged', 'alarm-3', 'comms-lost', 'point', 'stale', 'well-pad']);
        expect(symbols['well-pad'].attributes).toContain('stroke="currentColor"');
        expect(symbols['well-pad'].attributes).not.toContain('id=');
        expect(symbols['well-pad'].inner).toContain('<rect');
    });

    test('a marker image holds the disc, the glyph and the badge, no text but the digit, only token values', () => {
        const normal = markerSvg(markerSpec('well-pad', NORMAL), symbols, COLORS);
        expect(normal.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="' + MARKER_IMAGE.width + '" height="' + MARKER_IMAGE.height + '"')).toBe(true);
        expect(normal).toContain('<rect');
        expect(normal).not.toContain('<text');
        expect(normal).not.toContain('psi');
        expect(normal).not.toContain('stroke-dasharray');
        expect(normal).not.toContain(COLORS.commsLost);
        expect(normal).not.toContain(COLORS.alarm[0]);
        expect(normal).not.toContain(COLORS.selection);
        allowedPaints(normal);

        const lost = markerSvg(markerSpec('well-pad', LOST), symbols, COLORS);
        expect(lost).toContain('stroke-dasharray');
        expect(lost).toContain(COLORS.commsLost);
        expect(lost).not.toContain('Comms lost');
        expect(lost).toContain('M3 3l18 18');

        const alarm = markerSvg(markerSpec('well-pad', ALARM), symbols, COLORS);
        expect(alarm).toContain('fill="' + COLORS.alarm[0] + '"');
        expect(alarm).toContain('>1</text>');
        expect(alarm).toContain('M12 2.5l10 18h-20z');
        const acked = markerSvg(markerSpec('well-pad', { ...ALARM, alarm: { priority: 1, unacked: false, active: 1, stale: false } }), symbols, COLORS);
        expect(acked).toContain('stroke="' + COLORS.alarm[0] + '" stroke-width="2"');
        expect(acked).not.toContain('r="9" fill="' + COLORS.alarm[0] + '"');

        const selected = markerSvg(markerSpec('well-pad', NORMAL, true), symbols, COLORS);
        expect(selected).toContain('stroke="' + COLORS.selection + '"');

        // An unknown kind glyph falls back to the point glyph; a missing badge glyph draws the disc alone.
        const unknown = markerSvg(markerSpec('nope', NORMAL), symbols, COLORS);
        expect(unknown).toContain(symbols.point.inner.slice(0, 20));
        expect(markerSvg(markerSpec('well-pad', LOST), {}, COLORS)).toContain('stroke-dasharray');
        expect(DISC_CENTER).toEqual([28, 30]);
    });

    test('the dot, the badge, the chip and the arrow images', () => {
        const dot = imageFor(dotImageId(11, false), symbols, COLORS)!;
        expect(dot).toMatchObject({ width: DOT_IMAGE, height: DOT_IMAGE });
        expect(dot.svg).toContain('r="5.5"');
        expect(dot.svg).not.toContain(COLORS.selection);
        expect(imageFor(dotImageId(7, true), symbols, COLORS)!.svg).toContain(COLORS.selection);
        allowedPaints(dot.svg);

        const badge = imageFor(badgeImageId('alarm-3', 3, true), symbols, COLORS)!;
        expect(badge).toMatchObject({ width: 40, height: 24 });
        expect(badge.svg).toContain('>3</text>');
        expect(badge.svg).toContain(COLORS.alarm[2]);

        const chip = imageFor(CHIP_IMAGE, symbols, COLORS)!;
        expect(chip).toMatchObject({ width: 20, height: 20, content: [6, 6, 14, 14], stretchX: [[6, 14]], stretchY: [[6, 14]] });
        expect(chip.svg).toContain(COLORS.chipEdge);
        allowedPaints(chip.svg);

        const arrow = imageFor(ARROW_IMAGE, symbols, COLORS)!;
        expect(arrow.svg).toContain(COLORS.selection);
        allowedPaints(arrow.svg);
        expect(imageFor('other', symbols, COLORS)).toBeNull();
    });

    test('the tokens the colours come from fall back to Perspective variables, never literals', () => {
        expect(MARKER_TOKENS.commsLost).toEqual(['--mapstudio-comms-lost', '--qual-1']);
        expect(MARKER_TOKENS.alarm1[1]).toBe('--error');
        expect(MARKER_TOKENS.selection).toEqual(['--callToAction']);
        for (const tokens of Object.values(MARKER_TOKENS)) {
            for (const t of tokens) {
                expect(t.startsWith('--')).toBe(true);
            }
        }
    });
});
