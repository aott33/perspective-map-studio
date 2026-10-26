import { PAD_COUNT, SCALE_VIEW, buildScaleSet } from '../scaleData';

describe('buildScaleSet', () => {
    const set = buildScaleSet();

    test('has 30 pads with unique ids and one line each', () => {
        expect(PAD_COUNT).toBe(30);
        expect(set.pads.features).toHaveLength(30);
        expect(set.lines.features).toHaveLength(30);
        const ids = new Set(set.pads.features.map((f) => f.properties.id));
        expect(ids.size).toBe(30);
        expect(set.pads.features[0].properties.id).toBe('pad-01');
        expect(set.pads.features[29].properties.id).toBe('pad-30');
    });

    test('is deterministic', () => {
        expect(JSON.stringify(buildScaleSet())).toBe(JSON.stringify(set));
    });

    test('every pad is inside the starting 1440 by 860 px view', () => {
        // Web Mercator at SCALE_VIEW.zoom, the formula MapLibre uses.
        const scale = 512 * Math.pow(2, SCALE_VIEW.zoom);
        const proj = ([lng, lat]: number[]): [number, number] => {
            const rad = (lat * Math.PI) / 180;
            return [
                ((lng + 180) / 360) * scale,
                ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale
            ];
        };
        const [cx, cy] = proj(SCALE_VIEW.center);
        for (const f of set.pads.features) {
            const [x, y] = proj(f.geometry.coordinates);
            expect(Math.abs(x - cx)).toBeLessThan(720);
            expect(Math.abs(y - cy)).toBeLessThan(430);
        }
    });

    test('each line starts at its pad', () => {
        set.pads.features.forEach((pad, i) => {
            expect(set.lines.features[i].geometry.coordinates[0]).toEqual(pad.geometry.coordinates);
        });
    });
});
