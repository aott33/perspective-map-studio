import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RuleDisplay } from '../live';
import { MarkerColors, PRESET_WORDS } from '../markers';
import { PresetPalette, StylePreview, TintPalette, caseWords, presetSampleSvg, sourceWords } from '../StylePreview';

const COLORS: MarkerColors = {
    disc: 'rgb(255, 255, 255)', glyph: 'rgb(30, 30, 30)', halo: 'rgb(250, 250, 250)', textSecondary: 'rgb(120, 120, 120)',
    line: 'rgb(90, 90, 90)', chipEdge: 'rgb(150, 150, 150)', selection: 'rgb(20, 80, 200)',
    commsLost: 'rgb(125, 60, 189)', alarm: ['rgb(200, 0, 0)', 'rgb(173, 95, 0)', 'rgb(50, 114, 217)'], font: 'Inter, sans-serif',
    attention: 'rgb(50, 50, 50)', warning: 'rgb(173, 95, 1)', fault: 'rgb(200, 0, 1)',
    tints: ['rgb(8, 105, 98)', 'rgb(3, 133, 55)', 'rgb(34, 154, 214)', 'rgb(237, 83, 147)', 'rgb(207, 121, 17)', 'rgb(17, 69, 153)']
};
const PAD = { id: 'pad', name: 'Well pad', geometry: 'point' as const, icon: 'well-pad' };
const LINE = { id: 'line', name: 'Gathering line', geometry: 'line' as const, icon: 'pipeline' };
const STATES: RuleDisplay = { type: 'states', source: 'tag', cases: [
    { label: '1', preset: 'attention' }, { label: '2', preset: 'warning' }, { label: '3', preset: 'fault' }, { label: '4', preset: 'dimmed' }] };
const BANDS: RuleDisplay = { type: 'bands', source: 'kpi:flow', cases: [
    { label: 'below 50', preset: 'normal' }, { label: '50 to 200', preset: 'attention' }, { label: '200 and above', preset: 'fault' }] };

const count = (html: string, re: RegExp): number => (html.match(re) || []).length;

describe('the style preview (epic 3 entry 1)', () => {
    test('one tile per case of a States rule on a point, each with the case words, the marker in its preset and the word', () => {
        const html = renderToStaticMarkup(React.createElement(StylePreview, { kind: PAD, rule: STATES, symbols: {}, colors: COLORS }));
        expect(html).toContain('data-kind="pad"');
        expect(html).toContain('data-cases="4"');
        expect(count(html, /class="mapstudio-style-tile"/g)).toBe(4);
        expect(html).toContain('States on a tag');
        expect(html).toContain('When the value is 2');
        for (const c of STATES.cases) {
            expect(html).toContain('data-preset="' + c.preset + '"');
            expect(html).toContain(PRESET_WORDS[c.preset]);
        }
        // The tiles draw the marker image's own SVG: the warning ring in its token, the dimmed fade.
        expect(html).toContain('stroke="' + COLORS.warning + '" stroke-width="2.5"');
        expect(html).toContain('opacity="0.45"');
        expect(html).not.toContain('<text');
    });

    test('a Bands rule on a line draws line samples; an expression lists the presets it names; no rule draws no tile', () => {
        const html = renderToStaticMarkup(React.createElement(StylePreview, { kind: LINE, rule: BANDS, symbols: {}, colors: COLORS }));
        expect(html).toContain('Bands on the key value flow');
        expect(html).toContain('When the value is 50 to 200');
        expect(count(html, /mapstudio-style-sample--line/g)).toBe(3);
        expect(html).toContain('stroke="' + COLORS.fault + '"');
        const expression: RuleDisplay = { type: 'expression', source: 'tag', cases: [{ label: 'warning', preset: 'warning' }] };
        const e = renderToStaticMarkup(React.createElement(StylePreview, { kind: PAD, rule: expression, symbols: {}, colors: COLORS }));
        expect(e).toContain('When the expression gives warning');
        expect(e).toContain('data-cases="1"');
        const none = renderToStaticMarkup(React.createElement(StylePreview, { kind: PAD, symbols: {}, colors: COLORS }));
        expect(none).toContain('data-cases="0"');
        expect(none).not.toContain('mapstudio-style-tile');
        const instruments: RuleDisplay = { type: 'instruments', source: 'instruments', cases: [] };
        expect(renderToStaticMarkup(React.createElement(StylePreview, { kind: LINE, rule: instruments, symbols: {}, colors: COLORS })))
            .toContain('worst of its end instruments');
    });

    test('area tints draw one swatch per category; the palettes draw every preset and tint', () => {
        const tints = { property: 'operator', tints: [{ category: 'North', tint: 'tint-1' as const }, { category: 'South', tint: 'tint-4' as const }] };
        const html = renderToStaticMarkup(React.createElement(StylePreview, { kind: { ...LINE, id: 'geofence', area: true }, tints, symbols: {}, colors: COLORS }));
        expect(html).toContain('data-tints="2"');
        expect(html).toContain('Tint by operator');
        expect(html).toContain('data-tint="tint-4"');
        expect(html).toContain('fill="' + COLORS.tints[3] + '"');
        const points = renderToStaticMarkup(React.createElement(PresetPalette, { geometry: 'point', icon: 'well-pad', symbols: {}, colors: COLORS }));
        expect(count(points, /class="mapstudio-style-tile"/g)).toBe(5);
        const lines = renderToStaticMarkup(React.createElement(PresetPalette, { geometry: 'line', icon: 'pipeline', symbols: {}, colors: COLORS }));
        expect(count(lines, /class="mapstudio-style-tile"/g)).toBe(8);
        expect(lines).toContain('data-preset="dotted"');
        const palette = renderToStaticMarkup(React.createElement(TintPalette, { colors: COLORS }));
        expect(count(palette, /class="mapstudio-style-tile"/g)).toBe(7);
        expect(palette).toContain('no tint');
        // No colour literal: every paint is a token value handed in.
        const paints = (points + lines + palette).match(/(?:fill|stroke)="([^"]*)"/g) || [];
        const allowed = new Set(['none', 'currentColor', COLORS.disc, COLORS.glyph, COLORS.halo, COLORS.line, COLORS.chipEdge,
            COLORS.attention, COLORS.warning, COLORS.fault, ...COLORS.tints]);
        for (const p of paints) {
            expect(allowed.has(p.replace(/^(?:fill|stroke)="/, '').replace(/"$/, ''))).toBe(true);
        }
    });

    test('the words and the samples are pure', () => {
        expect(sourceWords(STATES)).toBe('a tag');
        expect(sourceWords(BANDS)).toBe('the key value flow');
        expect(caseWords(BANDS, '50 to 200')).toBe('When the value is 50 to 200');
        expect(presetSampleSvg(PAD, 'attention', {}, COLORS)).toContain('stroke-width="3"');
        expect(presetSampleSvg(LINE, 'dashed', {}, COLORS)).toContain('stroke-dasharray');
    });
});
