import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ItemState } from '../live';
import {
    DISC_CENTER, IMAGE_HEIGHT, IMAGE_WIDTH, MARKER_TOKENS, MarkerColors, markerImageId, markerProperties, markerSpec,
    markerSvg, parseImageId, parseSprite
} from '../markers';

const COLORS: MarkerColors = {
    disc: 'rgb(255, 255, 255)', glyph: 'rgb(30, 30, 30)', halo: 'rgb(250, 250, 250)',
    commsLost: 'rgb(125, 60, 189)', alarm: ['rgb(200, 0, 0)', 'rgb(173, 95, 0)', 'rgb(50, 114, 217)'], font: 'Inter, sans-serif'
};

const NORMAL: ItemState = { commsLost: false, stale: false, alarm: null, iconKpi: { key: 'pressure', text: '412 psi', stale: false }, badge: 'normal' };
const LOST: ItemState = { commsLost: true, stale: true, alarm: null, iconKpi: { key: 'pressure', text: '412 psi', stale: true }, badge: 'comms-lost' };
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

describe('marker properties and image ids (epic 3 entry 5)', () => {
    test('a normal point names the disc image with its glyph and KPI; the state is normal', () => {
        const props = markerProperties('p1', 'Point 1', 'pad', 'well-pad', NORMAL);
        expect(props).toMatchObject({ id: 'p1', name: 'Point 1', kind: 'pad', state: 'normal' });
        expect(parseImageId(props.marker)).toEqual({ icon: 'well-pad', look: 'normal', badge: '', priority: 0, solid: false, kpi: '412 psi', word: '' });
        expect(markerProperties('p1', 'Point 1', 'pad', '', NORMAL).marker).toContain('"point"');
    });

    test('comms lost: the comms-lost badge, the word and the stale KPI', () => {
        const spec = markerSpec('well-pad', LOST);
        expect(spec).toEqual({ icon: 'well-pad', look: 'comms-lost', badge: 'comms-lost', priority: 0, solid: false,
            kpi: 'Stale - 412 psi', word: 'Comms lost' });
        expect(parseImageId(markerImageId(spec))).toEqual(spec);
    });

    test('an alarm: solid when unacknowledged, hollow when acknowledged, priority 3 the one square glyph', () => {
        expect(markerSpec('well-pad', ALARM)).toMatchObject({ badge: 'alarm-1-unacknowledged', priority: 1, solid: true, word: '' });
        const acked: ItemState = { ...ALARM, alarm: { priority: 2, unacked: false, active: 1, stale: false } };
        expect(markerSpec('well-pad', acked)).toMatchObject({ badge: 'alarm-2-acknowledged', priority: 2, solid: false });
        const low: ItemState = { ...ALARM, alarm: { priority: 3, unacked: true, active: 1, stale: false } };
        expect(markerSpec('well-pad', low)).toMatchObject({ badge: 'alarm-3', priority: 3, solid: true });
        // An alarm over comms lost: the alarm badge, the comms-lost look and word stay.
        const both: ItemState = { ...LOST, alarm: ALARM.alarm, badge: 'alarm' };
        expect(markerSpec('well-pad', both)).toMatchObject({ look: 'comms-lost', badge: 'alarm-1-unacknowledged', word: 'Comms lost' });
    });

    test('ids that are not ours are refused', () => {
        expect(parseImageId('ms:marker:["x"]')).toBeNull();
        expect(parseImageId('ms:marker:nope')).toBeNull();
        expect(parseImageId('other')).toBeNull();
        expect(parseImageId('ms:marker:["well-pad","odd","",0,false,"",""]')).toBeNull();
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

    test('an image holds only token values and the glyphs its state needs', () => {
        const normal = markerSvg(markerSpec('well-pad', NORMAL), symbols, COLORS);
        expect(normal.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="' + IMAGE_WIDTH + '" height="' + IMAGE_HEIGHT + '"')).toBe(true);
        expect(normal).toContain('<rect');
        expect(normal).toContain('412 psi');
        expect(normal).not.toContain('stroke-dasharray');
        expect(normal).not.toContain(COLORS.commsLost);
        expect(normal).not.toContain(COLORS.alarm[0]);
        // No colour literal of the module's own: every fill and stroke is one of the given values.
        const paints = normal.match(/(?:fill|stroke)="([^"]*)"/g) || [];
        const allowed = new Set(['none', 'currentColor', COLORS.disc, COLORS.glyph, COLORS.halo, COLORS.commsLost, ...COLORS.alarm]);
        for (const p of paints) {
            expect(allowed.has(p.replace(/^(?:fill|stroke)="/, '').replace(/"$/, ''))).toBe(true);
        }

        const lost = markerSvg(markerSpec('well-pad', LOST), symbols, COLORS);
        expect(lost).toContain('stroke-dasharray');
        expect(lost).toContain(COLORS.commsLost);
        expect(lost).toContain('Comms lost');
        expect(lost).toContain('Stale - 412 psi');
        expect(lost).toContain('M3 3l18 18');

        const alarm = markerSvg(markerSpec('well-pad', ALARM), symbols, COLORS);
        expect(alarm).toContain('fill="' + COLORS.alarm[0] + '"');
        expect(alarm).toContain('>1</text>');
        expect(alarm).toContain('M12 2.5l10 18h-20z');
        const acked = markerSvg(markerSpec('well-pad', { ...ALARM, alarm: { priority: 1, unacked: false, active: 1, stale: false } }), symbols, COLORS);
        expect(acked).toContain('stroke="' + COLORS.alarm[0] + '" stroke-width="2"');
        expect(acked).not.toContain('r="9" fill="' + COLORS.alarm[0] + '"');

        // An unknown kind glyph falls back to the point glyph; a missing badge glyph draws the disc alone.
        const unknown = markerSvg(markerSpec('nope', NORMAL), symbols, COLORS);
        expect(unknown).toContain(symbols.point.inner.slice(0, 20));
        expect(markerSvg(markerSpec('well-pad', LOST), {}, COLORS)).toContain('stroke-dasharray');
        expect(DISC_CENTER).toEqual([80, 22]);
    });

    test('the tokens the colours come from fall back to Perspective variables, never literals', () => {
        expect(MARKER_TOKENS.commsLost).toEqual(['--mapstudio-comms-lost', '--qual-1']);
        expect(MARKER_TOKENS.alarm1[1]).toBe('--error');
        for (const tokens of Object.values(MARKER_TOKENS)) {
            for (const t of tokens) {
                expect(t.startsWith('--')).toBe(true);
            }
        }
    });
});
