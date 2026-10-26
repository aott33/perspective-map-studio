import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

/**
 * The 30-pad scale set (story 7, spike only): a deterministic stand-in for the
 * template's own 30-pad set, which is not available to this repository. Thirty
 * pads on a jittered 6 by 5 grid, each joined to its nearest gathering station
 * (three stations) by a line with one bend. Seeded, so every run draws the same
 * map. Replaced by the map store in epic-map-store-and-data.
 */

export type PadProps = { id: string; name: string };

export const PAD_COUNT = 30;
export const STATIONS: Array<[number, number]> = [
    [-105.07, 39.7250],
    [-104.9725, 39.7445],
    [-104.88, 39.7650]
];

/** The starting view for the scale set: all 30 pads inside a 1440 by 860 px map. */
export const SCALE_VIEW: { center: [number, number]; zoom: number } = {
    center: [-104.9725, 39.7445],
    zoom: 12
};

const COLUMNS = 6;
const ROWS = 5;
const HALF_WIDTH_DEG = 0.11;
const HALF_HEIGHT_DEG = 0.05;

/** mulberry32: a small seeded generator, so the set never changes between runs. */
function seeded(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function padId(n: number): string {
    return 'pad-' + (n < 10 ? '0' : '') + n;
}

/** The 30 pad coordinates and the 30 lines, in id order. */
export function buildScaleSet(): {
    pads: FeatureCollection<Point, PadProps>;
    lines: FeatureCollection<LineString, { id: string }>;
} {
    const rand = seeded(30);
    const cellW = (2 * HALF_WIDTH_DEG) / COLUMNS;
    const cellH = (2 * HALF_HEIGHT_DEG) / ROWS;
    const pads: Array<Feature<Point, PadProps>> = [];
    const lines: Array<Feature<LineString, { id: string }>> = [];
    for (let i = 0; i < PAD_COUNT; i++) {
        const col = i % COLUMNS;
        const row = Math.floor(i / COLUMNS);
        // Jitter stays inside the middle 60 % of the cell, so pads never touch.
        const lng = SCALE_VIEW.center[0] - HALF_WIDTH_DEG + (col + 0.2 + 0.6 * rand()) * cellW;
        const lat = SCALE_VIEW.center[1] - HALF_HEIGHT_DEG + (row + 0.2 + 0.6 * rand()) * cellH;
        const id = padId(i + 1);
        pads.push({
            type: 'Feature',
            id: i + 1,
            properties: { id, name: 'Pad ' + (i + 1) },
            geometry: { type: 'Point', coordinates: [lng, lat] }
        });
        let best = STATIONS[0];
        let bestD = Infinity;
        for (const s of STATIONS) {
            const d = (s[0] - lng) * (s[0] - lng) + (s[1] - lat) * (s[1] - lat);
            if (d < bestD) {
                bestD = d;
                best = s;
            }
        }
        const bend: [number, number] = [(lng + best[0]) / 2, lat + (best[1] - lat) * 0.25];
        lines.push({
            type: 'Feature',
            properties: { id: 'line-' + id },
            geometry: { type: 'LineString', coordinates: [[lng, lat], bend, best] }
        });
    }
    return {
        pads: { type: 'FeatureCollection', features: pads },
        lines: { type: 'FeatureCollection', features: lines }
    };
}
