import { Place, PlaceStore, parsePlace, placeKey, readPlace, writePlace } from '../place';

/** sessionStorage in memory. */
function memory(): PlaceStore & { data: Record<string, string> } {
    const data: Record<string, string> = {};
    return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
}

const P14: Place = { center: [-104.93, 39.7], zoom: 15.5, selected: { id: 'p14', kind: 'point', segment: null }, popup: true, popupAt: null };

describe('the map\'s place for the browser session (owner re-test R4 (a))', () => {
    test('one key per project, page path and component', () => {
        const a = placeKey('mapstudio-showcase', '/data/perspective/client/mapstudio-showcase', 'root/MapStudio');
        expect(a).toBe('mapstudio.place.v1|mapstudio-showcase|/data/perspective/client/mapstudio-showcase|root/MapStudio');
        expect(placeKey('other', '/data/perspective/client/mapstudio-showcase', 'root/MapStudio')).not.toBe(a);
        expect(placeKey('mapstudio-showcase', '/data/perspective/client/mapstudio-showcase/dark', 'root/MapStudio')).not.toBe(a);
        expect(placeKey('mapstudio-showcase', '/data/perspective/client/mapstudio-showcase', 'root/MapStudio_0')).not.toBe(a);
        expect(placeKey(null, '/p', 'a')).toBe('mapstudio.place.v1||/p|a');
    });

    test('written and read back: the camera, the selected point and its open popup', () => {
        const store = memory();
        const key = placeKey('p', '/x', 'a');
        expect(readPlace(store, key)).toBeNull();
        writePlace(store, key, P14);
        expect(readPlace(store, key)).toEqual(P14);
    });

    test('a line keeps its segment and the place its popup opened at', () => {
        const store = memory();
        const line: Place = { center: [1, 2], zoom: 16, selected: { id: 'l', kind: 'line', segment: { fromId: 'a', toId: 'b' } },
            popup: true, popupAt: [1.001, 2.002] };
        writePlace(store, 'k', line);
        expect(readPlace(store, 'k')).toEqual(line);
    });

    test('no selection: the camera alone, no popup', () => {
        expect(parsePlace(JSON.stringify({ center: [1, 2], zoom: 3, selected: null, popup: true, popupAt: [1, 2] })))
            .toEqual({ center: [1, 2], zoom: 3, selected: null, popup: false, popupAt: null });
    });

    test('anything that does not read as a place is none, so the map opens on its starting area', () => {
        for (const raw of [null, '', 'not json', '[]', '{}', JSON.stringify({ center: [200, 0], zoom: 3 }),
            JSON.stringify({ center: [0, 0], zoom: 'x' }), JSON.stringify({ center: [0, 0], zoom: 30 }), JSON.stringify({ center: [0], zoom: 3 })]) {
            expect(parsePlace(raw)).toBeNull();
        }
        // A selection that does not read is dropped, the camera kept.
        expect(parsePlace(JSON.stringify({ center: [0, 0], zoom: 3, selected: { id: 5, kind: 'point' }, popup: true })))
            .toEqual({ center: [0, 0], zoom: 3, selected: null, popup: false, popupAt: null });
    });

    test('a store that refuses (a private window, blocked site data) keeps nothing and throws nothing', () => {
        const refusing: PlaceStore = {
            getItem: () => { throw new Error('SecurityError'); },
            setItem: () => { throw new Error('QuotaExceededError'); }
        };
        expect(() => writePlace(refusing, 'k', P14)).not.toThrow();
        expect(readPlace(refusing, 'k')).toBeNull();
        expect(readPlace(null, 'k')).toBeNull();
        expect(() => writePlace(null, 'k', P14)).not.toThrow();
    });
});
