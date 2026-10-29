import { GLYPH_PATHS, glyphSvg, returnGlyphSvg, zoomLevelText } from '../controls';

describe('the View-mode controls (epic 3 entry 14)', () => {
    test('the zoom level reads as the nearest whole level', () => {
        expect(zoomLevelText(15)).toBe('z 15');
        expect(zoomLevelText(14.6)).toBe('z 15');
        expect(zoomLevelText(12.4)).toBe('z 12');
        expect(zoomLevelText(0)).toBe('z 0');
        expect(zoomLevelText(NaN)).toBe('z ?');
    });

    test('every chrome glyph is a stroked path in currentColor with no colour of its own', () => {
        expect(Object.keys(GLYPH_PATHS)).toEqual(expect.arrayContaining(['search', 'close']));
        for (const name of Object.keys(GLYPH_PATHS) as Array<keyof typeof GLYPH_PATHS>) {
            const svg = glyphSvg(name, 'g');
            expect(svg).toContain('stroke="currentColor"');
            expect(svg).toContain('fill="none"');
            expect(svg).toContain('aria-hidden="true"');
            expect(svg).not.toMatch(/#[0-9a-f]{3,6}\b/i);
        }
        expect(returnGlyphSvg('g')).toContain('fill="currentColor"');
        expect(returnGlyphSvg('g')).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    });
});
