import { selectTestData } from '../testSet';

describe('selectTestData', () => {
    test('scale30 gives 30 pads and 30 lines', () => {
        const d = selectTestData('scale30');
        expect(d.name).toBe('scale30');
        expect(d.featureCount).toBe(60);
        expect(d.points.features).toHaveLength(30);
    });

    test('tracer, empty and unknown values give the tracer data', () => {
        for (const v of ['tracer', '', 'nope']) {
            const d = selectTestData(v);
            expect(d.name).toBe('tracer');
            expect(d.featureCount).toBe(4);
            expect(d.points.features).toHaveLength(3);
        }
    });
});
