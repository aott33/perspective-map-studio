import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

/**
 * Fixed test data for the tracer: three points and one line between the first two,
 * in GeoJSON (longitude before latitude, WGS 84). Replaced by the map store
 * in epic-map-store-and-data.
 */
const COORDS: Array<[number, number]> = [
    [-104.9903, 39.7392],
    [-104.9750, 39.7500],
    [-104.9550, 39.7430]
];

export const TEST_POINTS: FeatureCollection<Point, { id: string; name: string }> = {
    type: 'FeatureCollection',
    features: COORDS.map((c, i): Feature<Point, { id: string; name: string }> => ({
        type: 'Feature',
        id: i + 1,
        properties: { id: 'p' + (i + 1), name: 'Point ' + (i + 1) },
        geometry: { type: 'Point', coordinates: c }
    }))
};

export const TEST_LINE: {
    feature: Feature<LineString, { id: string }>;
    center: [number, number];
    zoom: number;
} = {
    feature: {
        type: 'Feature',
        properties: { id: 'l1' },
        geometry: { type: 'LineString', coordinates: COORDS.slice(0, 2) }
    },
    center: [-104.9725, 39.7445],
    zoom: 12.5
};
