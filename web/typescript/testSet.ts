import type { Feature, FeatureCollection } from 'geojson';
import { SCALE_VIEW, buildScaleSet } from './scaleData';
import { TEST_LINE, TEST_POINTS } from './testData';

/** The test data a map draws, chosen from the spike-only `testSet` prop (story 7). */
export interface TestData {
    name: 'tracer' | 'scale30';
    points: FeatureCollection;
    lines: FeatureCollection | Feature;
    center: [number, number];
    zoom: number;
}

/** 'scale30' gives the 30-pad stand-in; anything else gives the tracer's data. */
export function selectTestData(testSet: string): TestData {
    if (testSet === 'scale30') {
        const set = buildScaleSet();
        return {
            name: 'scale30',
            points: set.pads,
            lines: set.lines,
            center: SCALE_VIEW.center,
            zoom: SCALE_VIEW.zoom
        };
    }
    return {
        name: 'tracer',
        points: TEST_POINTS,
        lines: TEST_LINE.feature,
        center: TEST_LINE.center,
        zoom: TEST_LINE.zoom
    };
}
