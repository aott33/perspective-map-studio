// The place check (epic 4 entry 27, R13; EXPERIENCE.md Place a point; docs/place-check.md): the file's text read back, the lookups (a
// county with its state and country, an area with the nearest town, a sea "off" the nearest state or province, the neighbour across
// a line within 1 km), the words, the swap rules, the loader that fetches once per page, and the place line in Details with Zoom to
// location beside Move. A small fixture made here in the file's format (squares named after the matrix's places), never the
// committed file.
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import {
    LOOK_SWAPPED, MAY_BE_SWAPPED, PLACES_URL, PLACE_CREDIT, PLACE_LOADING, PLACE_NONE, PLACE_UNAVAILABLE, PlaceData, PlaceSource, PlaceStatus,
    NumberReader, checkPair, createPlaceSource, decodePlaces, lookUp, lookUpKept, placeLine, placeWords
} from '../placeCheck';
import { PropertiesPanel, PropertiesPanelProps, ZOOM_TO_TEXT, ZOOM_TO_TITLE, readsAsNumber } from '../studio/PropertiesPanel';

// ---------------------------------------------------------------------------------------------------------------------------------
// The fixture, written as web/scripts/place-data.mjs writes the file.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const QUANTUM = 0.0001;
const TOWN_QUANTUM = 0.001;

function uint(n: number, out: string[]): void {
    while (n >= 32) {
        out.push(ALPHABET[32 + (n % 32)]);
        n = Math.floor(n / 32);
    }
    out.push(ALPHABET[n]);
}

function int(v: number, out: string[]): void {
    uint(v >= 0 ? v * 2 : -v * 2 - 1, out);
}

type Arc = Array<[number, number]>;

/** A layer: its arcs (longitude, latitude) and each feature's rings of arc references (~i walks arc i backwards). */
function layer(arcs: Arc[], features: number[][][], names: string[]): { arcs: string; rings: string; names: string[] } {
    const a: string[] = [];
    let px = 0;
    let py = 0;
    for (const arc of arcs) {
        uint(arc.length, a);
        for (const [lng, lat] of arc) {
            const x = Math.round(lng / QUANTUM);
            const y = Math.round(lat / QUANTUM);
            int(x - px, a);
            int(y - py, a);
            px = x;
            py = y;
        }
    }
    const r: string[] = [];
    let prev = 0;
    for (const rings of features) {
        uint(rings.length, r);
        for (const ring of rings) {
            uint(ring.length, r);
            for (const ref of ring) {
                const index = ref < 0 ? ~ref : ref;
                const d = index - prev;
                uint((d >= 0 ? d * 2 : -d * 2 - 1) * 2 + (ref < 0 ? 1 : 0), r);
                prev = index;
            }
        }
    }
    return { arcs: a.join(''), rings: r.join(''), names };
}

/** A closed square from west, south to east, north. */
function square(w: number, s: number, e: number, n: number): Arc {
    return [[w, s], [e, s], [e, n], [w, n], [w, s]];
}

function towns(list: Array<[string, number, number]>): { names: string; points: string } {
    const p: string[] = [];
    let px = 0;
    let py = 0;
    for (const [, lat, lng] of list) {
        const x = Math.round((lng + 180) / TOWN_QUANTUM);
        const y = Math.round((lat + 90) / TOWN_QUANTUM);
        int(x - px, p);
        int(y - py, p);
        px = x;
        py = y;
    }
    return { names: list.map(([name]) => name).join('|'), points: p.join('') };
}

// New Mexico and Texas share the line x = -103, Alberta and British Columbia x = -120; Louisiana's south edge is its coast.
const ADMIN1 = layer([
    [[-103, 31], [-109, 31], [-109, 37], [-103, 37]],
    [[-103, 37], [-103, 31]],
    [[-103, 37], [-97, 37], [-97, 31], [-103, 31]],
    [[-120, 49], [-110, 49], [-110, 60], [-120, 60]],
    [[-120, 60], [-120, 49]],
    [[-120, 60], [-130, 60], [-130, 49], [-120, 49]],
    square(-94, 29, -89, 33),
    square(10, 40, 20, 50),
    square(50.75, 24.5, 51.65, 26.15),
    square(25, 50, 28.5, 52)
], [[[0, 1]], [[2, ~1]], [[3, 4]], [[5, ~4]], [[6]], [[7]], [[8]], [[9]]],
['New Mexico', 'Texas', 'Alberta', 'British Columbia', 'Louisiana', 'Testland', 'Qatar', 'Rivne']);

// Lea County between Eddy County (same state, x = -104) and Andrews County (Texas, x = -103); Lafourche Parish on the coast.
const COUNTIES = layer([
    [[-104, 32], [-103, 32]],
    [[-103, 32], [-103, 33]],
    [[-103, 33], [-104, 33]],
    [[-104, 33], [-104, 32]],
    [[-104, 32], [-105, 32], [-105, 33], [-104, 33]],
    [[-103, 33], [-102, 33], [-102, 32], [-103, 32]],
    square(-91, 29, -90, 30)
], [[[0, 1, 2, 3]], [[4, 3]], [[5, 1]], [[6]]], ['Lea County', 'Eddy County', 'Andrews County', 'Lafourche Parish']);

// The Gulf with a bay inside it, the Atlantic, an unnamed channel west of British Columbia, a sea whose swap is Testland, and the
// Persian Gulf round Qatar, whose swap is Rivne in Ukraine.
const MARINE = layer([square(-98, 18, -80, 29), square(-80, 0, -10, 60), square(-135, 50, -130, 55), square(-92, 28, -91, 29), square(40, 10, 50, 20),
    square(48, 24, 56, 30)],
[[[0]], [[1]], [[2]], [[3]], [[4]], [[5]]], ['Gulf of Mexico', 'North Atlantic Ocean', '', 'Test Bay', 'Test Sea', 'Persian Gulf']);

const FILE = {
    format: 'mapstudio-places',
    version: 1,
    credit: PLACE_CREDIT,
    sources: [],
    settings: { quantum: QUANTUM, townQuantum: TOWN_QUANTUM },
    admin1: { ...ADMIN1, countries: ['US', 'US', 'CA', 'CA', 'US', 'XX', 'QA', 'UA'] },
    counties: { ...COUNTIES, states: [0, 0, 1, 4] },
    marine: MARINE,
    towns: towns([['Grande Prairie', 55.17, -118.8], ['Edmonton', 53.55, -113.49], ['Far Town', 59.5, -111.0]])
};

const DATA: PlaceData = decodePlaces(FILE);
const READY: PlaceStatus = { state: 'ready', data: DATA };

const words = (lat: number, lng: number): string => placeWords(lookUp(DATA, lat, lng));

describe('the file read back', () => {
    test('numbers: 5 bits a character, low first, zigzagged when signed', () => {
        const out: string[] = [];
        for (const v of [0, -1, 1, 15, -16, 16, 1000, -123456]) {
            int(v, out);
        }
        const r = new NumberReader(out.join(''));
        expect([0, -1, 1, 15, -16, 16, 1000, -123456].map(() => r.int())).toEqual([0, -1, 1, 15, -16, 16, 1000, -123456]);
        expect(r.done()).toBe(true);
        expect(() => new NumberReader('g').uint()).toThrow('ends inside a number');
        expect(() => new NumberReader('*').uint()).toThrow('not a number');
    });

    test('the layers, their names and the towns; a shared line has both its areas as users', () => {
        expect(DATA.admin1.names).toHaveLength(8);
        expect(DATA.counties.names).toEqual(['Lea County', 'Eddy County', 'Andrews County', 'Lafourche Parish']);
        expect(Array.from(DATA.states)).toEqual([0, 0, 1, 4]);
        expect(DATA.towns.names).toEqual(['Grande Prairie', 'Edmonton', 'Far Town']);
        expect(DATA.towns.lat[0]).toBeCloseTo(55.17, 6);
        expect(DATA.towns.lng[0]).toBeCloseTo(-118.8, 6);
        const shared = 1;
        const { users, userStart } = DATA.admin1;
        expect(Array.from(users.slice(userStart[shared], userStart[shared + 1])).sort()).toEqual([0, 1]);
        expect(DATA.credit).toBe(PLACE_CREDIT);
    });

    test('a file of another format, a missing layer or an arc it does not hold is refused, saying why', () => {
        expect(() => decodePlaces({ ...FILE, version: 2 })).toThrow('not mapstudio-places version 1');
        expect(() => decodePlaces({ ...FILE, marine: undefined })).toThrow('no marine layer');
        expect(() => decodePlaces({ ...FILE, counties: { ...FILE.counties, states: [0, 0, 1] } })).toThrow('do not match');
        const out: string[] = [];
        uint(1, out);
        uint(1, out);
        uint(99 * 4, out);
        expect(() => decodePlaces({ ...FILE, marine: { ...MARINE, rings: out.join(''), names: ['x'] } })).toThrow('an arc it does not hold');
    });
});

describe('the lookups and their words (the matrix)', () => {
    test('a US county with its state and the country: "Lea County, New Mexico, US"; "Lafourche Parish, Louisiana, US"', () => {
        expect(lookUp(DATA, 32.7, -103.1)).toEqual({ kind: 'county', county: 'Lea County', state: 'New Mexico', country: 'US', near: '' });
        expect(words(32.7, -103.1)).toBe('Lea County, New Mexico, US');
        expect(words(29.64, -90.54)).toBe('Lafourche Parish, Louisiana, US');
    });

    test('within 1 km of a state line its neighbour is named; a county line within the state names the county', () => {
        // 0.007 degrees at 32.5 N is about 0.66 km.
        expect(words(32.5, -103.007)).toBe('Lea County (near the Texas line), New Mexico, US');
        expect(words(32.5, -103.993)).toBe('Lea County (near the Eddy County line), New Mexico, US');
        // 0.02 degrees is about 1.9 km: no neighbour.
        expect(words(32.5, -103.02)).toBe('Lea County, New Mexico, US');
    });

    test('elsewhere the nearest town within 50 km, the state or province and the country; a line names the neighbour', () => {
        expect(words(55.17, -118.8)).toBe('Near Grande Prairie, Alberta, CA');
        expect(words(53.6, -113.5)).toBe('Near Edmonton, Alberta, CA');
        // No town within 50 km: the province and the country alone.
        expect(words(58.0, -115.0)).toBe('Alberta, CA');
        // 0.01 degrees at 55.17 N is about 0.64 km from British Columbia; Grande Prairie is 76 km away.
        expect(words(55.17, -119.99)).toBe('Alberta (near the British Columbia line), CA');
    });

    test('offshore the sea, "off" the nearest state or province within 200 km, or the sea alone; a bay before its sea', () => {
        expect(words(28.5, -90.5)).toBe('Gulf of Mexico, off Louisiana, US');
        expect(words(28.5, -91.5)).toBe('Test Bay, off Louisiana, US');
        expect(words(30.0, -40.0)).toBe('North Atlantic Ocean');
        expect(lookUp(DATA, 30.0, -40.0)).toEqual({ kind: 'sea', sea: 'North Atlantic Ocean', off: null });
        // An unnamed channel reads by its shore; with none within 200 km, nothing is found.
        expect(words(52, -132)).toBe('Off British Columbia, CA');
        expect(words(52, -134)).toBe(PLACE_NONE);
    });

    test('where land and sea leave a point in neither, the nearer within 2 km holds it; else "No place found here"', () => {
        // 0.01 degrees west of Louisiana's edge (about 0.97 km), outside every area and sea.
        expect(words(29.5, -94.01)).toBe('Louisiana, US');
        expect(words(29.5, -94.05)).toBe(PLACE_NONE);
        expect(words(0, 100)).toBe(PLACE_NONE);
    });

    test('a county named as its state says the name once: "District of Columbia, US"', () => {
        expect(placeWords({ kind: 'county', county: 'District of Columbia', state: 'District of Columbia', country: 'US', near: '' }))
            .toBe('District of Columbia, US');
        expect(placeWords({ kind: 'county', county: 'Saint Croix', state: 'Saint Croix', country: 'VI', near: '' })).toBe('Saint Croix, VI');
        expect(placeWords({ kind: 'county', county: 'District of Columbia', state: 'District of Columbia', country: 'US', near: 'Maryland' }))
            .toBe('District of Columbia (near the Maryland line), US');
    });

    test('a pair asked again is answered from the kept lookups; the last 64 are kept, the oldest going first', () => {
        // Data of its own, so the lookups the other tests kept do not count.
        const data = decodePlaces(FILE);
        const first = lookUpKept(data, 32.7, -103.1);
        expect(lookUpKept(data, 32.7, -103.1)).toBe(first);
        const kept = [];
        for (let i = 1; i <= 63; i++) {
            kept.push(lookUpKept(data, 58, -115 + i * 0.01));
        }
        // 64 kept: the first is still there.
        expect(lookUpKept(data, 32.7, -103.1)).toBe(first);
        // A 65th pair pushes out the oldest, the first, and keeps the other 63.
        lookUpKept(data, 58, -100);
        expect(lookUpKept(data, 58, -114.99)).toBe(kept[0]);
        expect(lookUpKept(data, 58, -115 + 63 * 0.01)).toBe(kept[62]);
        expect(lookUpKept(data, 32.7, -103.1)).not.toBe(first);
    });
});

describe('the swap rules', () => {
    test('a latitude past 90 or below -90 whose swap is in range looks swapped, data or not', () => {
        expect(checkPair(DATA, -103.1, 32.7)).toEqual({ state: 'swapped' });
        expect(checkPair(null, -103.1, 32.7)).toEqual({ state: 'swapped' });
        expect(checkPair(null, 95, 20)).toEqual({ state: 'swapped' });
    });

    test('any other pair out of range is out of range, as before', () => {
        expect(checkPair(DATA, 95, 100)).toEqual({ state: 'out-of-range' });
        expect(checkPair(DATA, 32.7, 200)).toEqual({ state: 'out-of-range' });
        expect(checkPair(DATA, -200, 32.7)).toEqual({ state: 'out-of-range' });
    });

    test('a pair in no area (no land, no sea) whose swap lands in one may be swapped; one at sea reads its sea, whatever its swap', () => {
        // -89.5, 31 is nowhere; 31, -89.5 is in Louisiana. -40, 30 is nowhere too, and its swap 30, -40 in the Atlantic, a sea.
        expect(checkPair(DATA, -89.5, 31)).toEqual({ state: 'maybe-swapped', place: { kind: 'none' } });
        expect(checkPair(DATA, -40, 30)).toEqual({ state: 'maybe-swapped', place: { kind: 'none' } });
        // A Persian Gulf point: its swap, 51.5, 27, is in Rivne, but a sea is an area, so it reads its sea.
        expect(checkPair(DATA, 27.0, 51.5)).toEqual({ state: 'place', place: { kind: 'sea', sea: 'Persian Gulf', off: { state: 'Qatar', country: 'QA' } } });
        expect(placeWords(lookUp(DATA, 27.0, 51.5))).toBe('Persian Gulf, off Qatar, QA');
        // 15, 45 is in Test Sea, its swap in Testland: the sea.
        expect(checkPair(DATA, 15, 45)).toMatchObject({ state: 'place', place: { kind: 'sea', sea: 'Test Sea' } });
        expect(checkPair(DATA, 45, 15)).toMatchObject({ state: 'place', place: { kind: 'land', state: 'Testland' } });
        expect(checkPair(DATA, 30.0, -40.0)).toMatchObject({ state: 'place', place: { kind: 'sea' } });
        // Nowhere, and its swap nowhere: no place found.
        expect(checkPair(DATA, 5, 45)).toEqual({ state: 'place', place: { kind: 'none' } });
        expect(checkPair(null, 32.7, -103.1)).toEqual({ state: 'waiting' });
    });

    test('the place line: the words, the flags, nothing out of range, and the loading and failure words', () => {
        expect(placeLine(READY, 32.7, -103.1)).toEqual({ state: 'found', text: 'Lea County, New Mexico, US' });
        expect(placeLine(READY, -103.1, 32.7)).toEqual({ state: 'swapped', text: LOOK_SWAPPED });
        expect(placeLine(READY, -89.5, 31)).toEqual({ state: 'maybe-swapped', text: MAY_BE_SWAPPED });
        expect(placeLine(READY, 27.0, 51.5)).toEqual({ state: 'found', text: 'Persian Gulf, off Qatar, QA' });
        expect(placeLine(READY, 95, 100)).toEqual({ state: 'out-of-range', text: '' });
        expect(placeLine(READY, 0, 100)).toEqual({ state: 'none', text: PLACE_NONE });
        expect(placeLine({ state: 'idle', data: null }, 32.7, -103.1)).toEqual({ state: 'loading', text: PLACE_LOADING });
        expect(placeLine({ state: 'loading', data: null }, 32.7, -103.1)).toEqual({ state: 'loading', text: PLACE_LOADING });
        expect(placeLine({ state: 'failed', data: null }, 32.7, -103.1)).toEqual({ state: 'unavailable', text: PLACE_UNAVAILABLE });
        expect(placeLine({ state: 'failed', data: null }, -103.1, 32.7)).toEqual({ state: 'swapped', text: LOOK_SWAPPED });
    });
});

describe('the loader: one fetch per page, the promise kept', () => {
    test('nothing is fetched until it is asked; asked twice it fetches once; the status follows', async () => {
        const fetchJson = jest.fn(() => Promise.resolve(FILE as unknown));
        const source = createPlaceSource(fetchJson);
        expect(source.status().state).toBe('idle');
        expect(fetchJson).not.toHaveBeenCalled();
        const first = source.load();
        expect(source.status().state).toBe('loading');
        const second = source.load();
        expect(second).toBe(first);
        await first;
        expect(fetchJson).toHaveBeenCalledTimes(1);
        expect(source.status().state).toBe('ready');
        expect(source.status().data!.counties.names).toContain('Lea County');
        await source.load();
        expect(fetchJson).toHaveBeenCalledTimes(1);
    });

    test('a file that cannot be fetched or read fails once, with one console warning, and is not asked for again', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            const missing = jest.fn(() => Promise.reject(new Error(PLACES_URL + ' answered 404')));
            const source = createPlaceSource(missing);
            expect((await source.load()).state).toBe('failed');
            expect((await source.load()).state).toBe('failed');
            expect(missing).toHaveBeenCalledTimes(1);
            const broken = createPlaceSource(() => Promise.resolve({ format: 'other' } as unknown));
            expect((await broken.load()).state).toBe('failed');
            expect(warn).toHaveBeenCalledTimes(2);
            expect(String(warn.mock.calls[0][0])).toContain('The place check is not available');
        } finally {
            warn.mockRestore();
        }
    });
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The place line in Details, and Zoom to location beside Move.

const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] };
const LINE_KIND: Kind = { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [] };
const noop = (): void => undefined;

function fixed(status: PlaceStatus): PlaceSource & { loads: number } {
    const source = { loads: 0, status: () => status, load: () => {
        source.loads++;
        return Promise.resolve(status);
    } };
    return source;
}

function pad(lat: number, lng: number): MapItemRecord {
    return { id: 'p1', kind: 'pad', name: 'P31', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {}, assetId: null,
        overrides: {}, ends: null, attachment: null, version: 2, deleted: false };
}

function props(overrides: Partial<PropertiesPanelProps> = {}): PropertiesPanelProps {
    const item = overrides.item || pad(32.7, -103.1);
    return {
        item, kind: PAD, kinds: [PAD], assets: [], assetNames: [], assetStatus: null, items: [item], assetRows: [], kindStatus: null,
        saving: false, newest: item.properties, pending: false, paused: false, autoFocusName: false, onNameFocused: noop, onClose: noop,
        onRename: noop, onMove: noop, canMoveByClick: true, moving: false, onMoveStart: noop, onLink: noop, onKind: noop, onProperty: noop,
        onDelete: noop, toolInHand: false, delKey: true, places: fixed(READY), onZoomTo: noop, ...overrides
    };
}

function html(overrides: Partial<PropertiesPanelProps> = {}): string {
    return renderToStaticMarkup(React.createElement(PropertiesPanel, props(overrides)));
}

/** The panel's instance with its Latitude and Longitude drafts typed, drawn. */
function typed(lat: string, lng: string, overrides: Partial<PropertiesPanelProps> = {}): string {
    const inst = new PropertiesPanel(props(overrides));
    const raw = inst as unknown as { state: object };
    raw.state = { ...raw.state, lat, lng };
    return renderToStaticMarkup(inst.render());
}

function placeTag(markup: string): string {
    const at = markup.indexOf('class="mapstudio-field-place"');
    return at < 0 ? '' : markup.slice(markup.lastIndexOf('<', at), markup.indexOf('</span>', at) + 7);
}

describe('the place line under Location (entry 27)', () => {
    test('under the hint for a point, in its own element with the sources as its tooltip, Latitude and Longitude described by it', () => {
        const markup = html();
        const line = placeTag(markup);
        expect(line).toContain('>Lea County, New Mexico, US</span>');
        expect(line).toContain('data-place="found"');
        expect(line).toContain('title="' + PLACE_CREDIT + '"');
        expect(line).toContain('id="mapstudio-place-p1"');
        expect(markup.indexOf('mapstudio-field-hint')).toBeLessThan(markup.indexOf('mapstudio-field-place'));
        expect(markup.indexOf('mapstudio-field-place')).toBeLessThan(markup.indexOf('mapstudio-field--asset'));
        expect(markup).toMatch(/class="mapstudio-input mapstudio-field-lat"[^>]*aria-describedby="mapstudio-place-p1"/);
        expect(markup).toContain('data-place="found"><div class="mapstudio-field-label-row">');
    });

    test('the loading words while the data loads, the failure words if it failed; the fields stay as they are', () => {
        expect(placeTag(html({ places: fixed({ state: 'loading', data: null }) }))).toContain('>' + PLACE_LOADING + '<');
        const failed = html({ places: fixed({ state: 'failed', data: null }) });
        expect(placeTag(failed)).toContain('>' + PLACE_UNAVAILABLE + '<');
        expect(failed).not.toMatch(/mapstudio-field-lat"[^>]*disabled/);
    });

    test('a typed pair once both read as numbers, else the saved point', () => {
        expect(placeTag(typed('55.17', '-118.8'))).toContain('>Near Grande Prairie, Alberta, CA<');
        expect(placeTag(typed('', '-118.8'))).toContain('>Lea County, New Mexico, US<');
        expect(placeTag(typed('55.', '-118.8'))).toContain('>Near Grande Prairie, Alberta, CA<');
        expect(readsAsNumber(' -103.1 ')).toBe(-103.1);
        expect(readsAsNumber('-')).toBeNull();
        expect(readsAsNumber('')).toBeNull();
    });

    test('swapped: the place line says so and the hint keeps its instruction; out of range otherwise: the hint, no place line', () => {
        const swapped = typed('-103.1', '32.7');
        expect(placeTag(swapped)).toContain('data-place="swapped"');
        expect(placeTag(swapped)).toContain('>' + LOOK_SWAPPED + '<');
        expect(swapped).toContain('>Drag the pin to fine-tune, or type latitude and longitude.</span>');
        expect(swapped).toMatch(/mapstudio-field-lat"[^>]*aria-invalid="true"/);
        const out = typed('95', '100');
        expect(placeTag(out)).toBe('');
        expect(out).toContain('>Latitude is -90 to 90 and longitude -180 to 180.</span>');
        expect(out).toContain('data-place="out-of-range"');
        expect(placeTag(typed('-89.5', '31'))).toContain('>' + MAY_BE_SWAPPED + '<');
        expect(placeTag(typed('27', '51.5'))).toContain('>Persian Gulf, off Qatar, QA<');
    });

    test('Zoom to location beside Move, first, for a point; on while the fields are paused or the kind is unknown', () => {
        const markup = html();
        expect(markup).toContain('<span class="mapstudio-field-actions"><button type="button" class="mapstudio-button mapstudio-field-zoom" title="'
            + ZOOM_TO_TITLE + '">' + ZOOM_TO_TEXT + '</button><button type="button" class="mapstudio-button mapstudio-field-move"');
        expect(html({ paused: true })).toMatch(/mapstudio-field-zoom" title="[^"]*">/);
        expect(html({ kind: undefined })).toMatch(/mapstudio-field-zoom" title="[^"]*">/);
        // An instrument (no Move) keeps Zoom to location.
        const instrument = html({ canMoveByClick: false });
        expect(instrument).toContain('mapstudio-field-zoom');
        expect(instrument).not.toContain('mapstudio-field-move');
    });

    test('a line: no place line, no Zoom to location, and the data is never asked for', () => {
        const source = fixed({ state: 'idle', data: null });
        const line: MapItemRecord = { ...pad(0, 0), kind: 'line', geometry: { type: 'LineString', coordinates: [[-104, 39], [-103.9, 39.1]] } };
        const p = props({ item: line, kind: LINE_KIND, kinds: [LINE_KIND], places: source });
        const markup = renderToStaticMarkup(React.createElement(PropertiesPanel, p));
        expect(markup).not.toContain('mapstudio-field-place');
        expect(markup).not.toContain('mapstudio-field-zoom');
        new PropertiesPanel(p).componentDidMount();
        expect(source.loads).toBe(0);
    });

    test('a point asks for the data when the panel mounts, unless it is already in; the load settling draws the panel again', async () => {
        const idle = fixed({ state: 'idle', data: null });
        const inst = new PropertiesPanel(props({ places: idle }));
        const drawn = jest.spyOn(inst, 'forceUpdate').mockImplementation(() => undefined);
        inst.componentDidMount();
        expect(idle.loads).toBe(1);
        await Promise.resolve();
        await Promise.resolve();
        expect(drawn).toHaveBeenCalledTimes(1);
        const ready = fixed(READY);
        new PropertiesPanel(props({ places: ready })).componentDidMount();
        expect(ready.loads).toBe(0);
        // Unmounted before the load settles: nothing is drawn.
        const late = fixed({ state: 'loading', data: null });
        const gone = new PropertiesPanel(props({ places: late }));
        const notDrawn = jest.spyOn(gone, 'forceUpdate').mockImplementation(() => undefined);
        gone.componentDidMount();
        gone.componentWillUnmount();
        await Promise.resolve();
        await Promise.resolve();
        expect(notDrawn).not.toHaveBeenCalled();
    });
});
