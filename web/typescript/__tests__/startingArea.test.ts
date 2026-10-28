import { WORLD, readStartingArea, startingAreaKey } from '../startingArea';

describe('the starting area prop (epic 3 entry 6)', () => {
    test('a centre and zoom open there', () => {
        expect(readStartingArea({ center: { lng: -104.9725, lat: 39.7445 }, zoom: 12 }))
            .toEqual({ area: { kind: 'center', center: [-104.9725, 39.7445], zoom: 12 }, problem: null });
    });

    test('bounds win when all four are set and ordered', () => {
        const raw = { center: { lng: 1, lat: 2 }, zoom: 5, bounds: { west: -105, south: 39.7, east: -104.9, north: 39.8 } };
        expect(readStartingArea(raw)).toEqual({ area: { kind: 'bounds', bounds: [[-105, 39.7], [-104.9, 39.8]] }, problem: null });
    });

    test('null bounds (the schema default) mean the centre and zoom', () => {
        const raw = { center: { lng: 3, lat: 4 }, zoom: 7, bounds: { west: null, south: null, east: null, north: null } };
        expect(readStartingArea(raw)).toEqual({ area: { kind: 'center', center: [3, 4], zoom: 7 }, problem: null });
    });

    test('an unset prop is the whole world with no problem', () => {
        expect(readStartingArea(undefined)).toEqual({ area: WORLD, problem: null });
        expect(readStartingArea({})).toEqual({ area: WORLD, problem: null });
        expect(readStartingArea({ center: { lng: null, lat: null }, zoom: null })).toEqual({ area: WORLD, problem: null });
    });

    test('a bad value is the whole world with the problem in words', () => {
        expect(readStartingArea({ center: { lng: 0, lat: 95 }, zoom: 3 }).problem).toMatch(/latitude within -85 to 85/);
        expect(readStartingArea({ center: { lng: 0, lat: 0 }, zoom: 'x' }).problem).toMatch(/zoom must be a number from 0 to 24/);
        expect(readStartingArea({ center: { lng: 0, lat: 0 }, zoom: 30 }).area).toEqual(WORLD);
        expect(readStartingArea({ bounds: { west: 10, south: 0, east: 5, north: 1 } }).problem).toMatch(/west < east/);
        expect(readStartingArea({ bounds: { west: 1, south: 0, east: 5, north: null } }).problem).toMatch(/west < east/);
        expect(readStartingArea({ bounds: { west: -200, south: 0, east: 5, north: 1 } }).area).toEqual(WORLD);
        expect(readStartingArea('nope').problem).toBe('startingArea is not an object.');
    });

    test('the key tells two areas apart', () => {
        const a = readStartingArea({ center: { lng: 1, lat: 2 }, zoom: 3 }).area;
        const b = readStartingArea({ center: { lng: 1, lat: 2 }, zoom: 4 }).area;
        const c = readStartingArea({ bounds: { west: 0, south: 0, east: 1, north: 1 } }).area;
        expect(startingAreaKey(a)).not.toBe(startingAreaKey(b));
        expect(startingAreaKey(a)).not.toBe(startingAreaKey(c));
        expect(startingAreaKey(a)).toBe(startingAreaKey(readStartingArea({ center: { lng: 1, lat: 2 }, zoom: 3 }).area));
    });
});
