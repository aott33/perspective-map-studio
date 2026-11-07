import {
    CIRCLE_VERTICES, LOCATE_WORDS, LOCATE_ZOOM, NO_LOCATION, WEDGE_SIZE, YOU_ARE_HERE_WORDS, accuracyRing, locateWords, readUserLocation,
    userLocationKey, wedgePixels, youAreHereFeatures
} from '../userLocation';
import { CHOSEN_POINT_ZOOM } from '../search';

/** Near CTB1 on the dev map (the /locate page's mocked position). */
const LAT = 32.5;
const LNG = -103.5;

function geo(over: Record<string, unknown> = {}, data: Record<string, unknown> | null = {}): Record<string, unknown> {
    return { enabled: true, permissionGranted: true, options: { enableHighAccuracy: true },
        data: data === null ? null : { latitude: LAT, longitude: LNG, accuracy: 40, altitude: null, heading: null, speed: null,
            timestamp: 1730000000000, ...data }, ...over };
}

/** Metres between two points on the sphere the ring is drawn on (haversine). */
function metres(a: [number, number], b: [number, number]): number {
    const r = Math.PI / 180;
    const dLat = (b[1] - a[1]) * r;
    const dLng = (b[0] - a[0]) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
}

describe('the userLocation prop (epic 4 entry 15)', () => {
    test('Fix: enabled, granted and a valid position near CTB1 with accuracy 40 and no heading', () => {
        const loc = readUserLocation(geo());
        expect(loc).toEqual({ state: 'fix', position: [LNG, LAT], accuracy: 40 });
        expect(locateWords(loc.state)).toBe('Locate me');
    });

    test('Heading: a finite heading is kept, wrapped to 0 to 360', () => {
        expect(readUserLocation(geo({}, { heading: 90 })).heading).toBe(90);
        expect(readUserLocation(geo({}, { heading: -90 })).heading).toBe(270);
        expect(readUserLocation(geo({}, { heading: 450 })).heading).toBe(90);
        expect(readUserLocation(geo({}, { heading: 'east' })).heading).toBeUndefined();
        expect(readUserLocation(geo({}, { heading: NaN })).heading).toBeUndefined();
    });

    test('Off: the prop unbound (null or undefined) or enabled not true', () => {
        for (const raw of [null, undefined, geo({ enabled: false }), geo({ enabled: 'true' }), geo({ enabled: undefined })]) {
            expect(readUserLocation(raw)).toEqual(NO_LOCATION);
        }
        expect(locateWords('off')).toBe('Locate me - location is off for this session');
    });

    test('Denied: enabled but permission not granted', () => {
        for (const raw of [geo({ permissionGranted: false }), geo({ permissionGranted: undefined }), geo({ permissionGranted: 1 })]) {
            expect(readUserLocation(raw)).toEqual({ state: 'denied' });
        }
        expect(locateWords('denied')).toBe('Locate me - location permission not granted');
    });

    test('No fix: data empty, missing, out of range or not numbers', () => {
        const bad: Array<Record<string, unknown> | null> = [
            null, {}, { latitude: 999 }, { latitude: -91 }, { longitude: 181 }, { latitude: '32.5' }, { longitude: null },
            { latitude: Infinity }
        ];
        for (const data of bad) {
            expect(readUserLocation(geo({ data }))).toEqual({ state: 'nofix' });
        }
        expect(readUserLocation(geo({ data: [] }))).toEqual({ state: 'nofix' });
        expect(readUserLocation(geo({}, { latitude: 999 }))).toEqual({ state: 'nofix' });
        expect(readUserLocation({ enabled: true, permissionGranted: true })).toEqual({ state: 'nofix' });
        expect(locateWords('nofix')).toBe('Locate me - no location fix yet');
    });

    test('the edges of the ranges are a fix', () => {
        expect(readUserLocation(geo({}, { latitude: 90, longitude: 180 })).state).toBe('fix');
        expect(readUserLocation(geo({}, { latitude: -90, longitude: -180 })).state).toBe('fix');
    });

    test('a malformed value is read by the same rules, never thrown; extra keys are tolerated', () => {
        for (const raw of [42, 'on', [], true, { enabled: true, permissionGranted: true, data: 'here' }]) {
            expect(() => readUserLocation(raw)).not.toThrow();
        }
        expect(readUserLocation(geo({ extra: { nested: 1 } }, { extra: 'x' })).state).toBe('fix');
    });

    test('an accuracy missing, zero, negative or not a number draws no circle', () => {
        for (const accuracy of [undefined, null, 0, -5, 'wide', NaN]) {
            const loc = readUserLocation(geo({}, { accuracy }));
            expect(loc.state).toBe('fix');
            expect(loc.accuracy).toBeUndefined();
            expect(youAreHereFeatures(loc).features.map((f) => f.properties.part)).toEqual(['dot']);
        }
    });

    test('the key changes with the position, accuracy and heading, and not otherwise', () => {
        const a = userLocationKey(readUserLocation(geo()));
        expect(userLocationKey(readUserLocation(geo({ options: null }, { speed: 3, timestamp: 2 })))).toBe(a);
        expect(userLocationKey(readUserLocation(geo({}, { latitude: LAT + 0.001 })))).not.toBe(a);
        expect(userLocationKey(readUserLocation(geo({}, { accuracy: 41 })))).not.toBe(a);
        expect(userLocationKey(readUserLocation(geo({}, { heading: 1 })))).not.toBe(a);
        expect(userLocationKey(NO_LOCATION)).toBe('off');
        expect(userLocationKey({ state: 'denied' })).toBe('denied');
    });

    test('the words have no em dash, and Locate me zooms as Zoom to location', () => {
        for (const words of [...Object.values(LOCATE_WORDS), YOU_ARE_HERE_WORDS]) {
            expect(words).not.toContain('\u2014');
        }
        expect(LOCATE_ZOOM).toBe(CHOSEN_POINT_ZOOM);
    });
});

describe('the marker\'s features and the accuracy circle (epic 4 entry 15)', () => {
    test('a fix gives the circle under the dot; the dot carries the heading only when there is one', () => {
        const plain = youAreHereFeatures(readUserLocation(geo()));
        expect(plain.features.map((f) => f.properties.part)).toEqual(['accuracy', 'dot']);
        expect(plain.features[1].properties.heading).toBeUndefined();
        expect(plain.features[1].geometry).toEqual({ type: 'Point', coordinates: [LNG, LAT] });
        const heading = youAreHereFeatures(readUserLocation(geo({}, { heading: 90 })));
        expect(heading.features[1].properties.heading).toBe(90);
    });

    test('no fix, denied and off draw nothing', () => {
        for (const raw of [null, geo({ enabled: false }), geo({ permissionGranted: false }), geo({}, { latitude: 999 })]) {
            expect(youAreHereFeatures(readUserLocation(raw)).features).toEqual([]);
        }
    });

    test('the ring is closed, has 64 vertices and every one lies the accuracy away on the ground', () => {
        const ring = accuracyRing([LNG, LAT], 40);
        expect(CIRCLE_VERTICES).toBe(64);
        expect(ring).toHaveLength(65);
        expect(ring[64]).toEqual(ring[0]);
        for (const p of ring) {
            expect(Math.abs(metres([LNG, LAT], p) - 40)).toBeLessThan(0.01);
        }
        // North first: the same longitude, a higher latitude.
        expect(ring[0][0]).toBeCloseTo(LNG, 9);
        expect(ring[0][1]).toBeGreaterThan(LAT);
    });

    test('the ring stays true at a high latitude (wider in longitude) and wraps at the antimeridian', () => {
        const north = accuracyRing([20, 70], 1000);
        const east = north[16];
        expect(Math.abs(metres([20, 70], east) - 1000)).toBeLessThan(0.5);
        expect(east[0] - 20).toBeGreaterThan(0.02);
        for (const p of accuracyRing([179.9999, 0], 100)) {
            expect(p[0]).toBeGreaterThanOrEqual(-180);
            expect(p[0]).toBeLessThanOrEqual(180);
        }
    });
});

describe('the heading wedge image (epic 4 entry 15)', () => {
    test('a cone from the centre pointing up, in the colour given, empty below the centre', () => {
        const px = wedgePixels([10, 20, 30]);
        expect(px).toHaveLength(WEDGE_SIZE * WEDGE_SIZE * 4);
        const at = (x: number, y: number): number[] => Array.from(px.slice((y * WEDGE_SIZE + x) * 4, (y * WEDGE_SIZE + x) * 4 + 4));
        const c = WEDGE_SIZE / 2;
        const above = at(c, c - 6);
        expect(above.slice(0, 3)).toEqual([10, 20, 30]);
        expect(above[3]).toBeGreaterThan(100);
        expect(at(c, c + 6)[3]).toBe(0);
        // Outside the cone's half angle, beside the centre.
        expect(at(c + 10, c - 2)[3]).toBe(0);
        // Past its reach.
        expect(at(c, 0)[3]).toBe(0);
    });
});
