// You are here and Locate me on the component (epic 4 entry 15; the plan's I/O matrix): MapStudio reads the page's
// userLocation into one state that draws the marker, sets Locate me and puts the legend's row in or out together; the
// marker follows each new position without moving the camera; Locate me eases to the position at zoom 15 or the current
// zoom if closer; without a position nothing moves. Its libraries stubbed as in pageEvents.test.ts.

jest.mock('maplibre-gl', () => ({
    Popup: class {}, Map: class {}, AttributionControl: class {}, ScaleControl: class {}, setWorkerUrl: (): void => undefined
}), { virtual: true });
jest.mock('terra-draw', () => ({
    TerraDraw: class {}, TerraDrawLineStringMode: class {}, TerraDrawPolygonMode: class {}, TerraDrawPointMode: class {},
    TerraDrawSelectMode: class {}, ValidateNotSelfIntersecting: (): { valid: boolean } => ({ valid: true })
}), { virtual: true });
jest.mock('terra-draw-maplibre-gl-adapter', () => ({ TerraDrawMapLibreGLAdapter: class {} }), { virtual: true });
jest.mock('@inductiveautomation/perspective-client', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const react = require('react');
    return {
        Component: react.Component,
        ComponentStoreDelegate: class {},
        PageStore: { instanceKeyFor: (): string => 'key' }
    };
}, { virtual: true });

import { LOCATE_ZOOM } from '../userLocation';
import { SOURCE_YOU_ARE_HERE } from '../mapLayers';
import { MapStudio } from '../MapStudio';

interface Rig {
    ms: MapStudio;
    data: unknown[];
    moves: Array<{ center: [number, number]; zoom: number }>;
    locate: string[];
    legend: boolean[];
    attrs: Record<string, string>;
    setLocation(value: unknown): void;
    setZoom(z: number): void;
}

function rig(initial: unknown = null): Rig {
    const data: unknown[] = [];
    const moves: Array<{ center: [number, number]; zoom: number }> = [];
    const locate: string[] = [];
    const legend: boolean[] = [];
    const attrs: Record<string, string> = {};
    let zoom = 12;
    const props = { props: { editMode: false, startingArea: {}, previewStyles: false, selectedItem: null, userLocation: initial },
        store: { props: { write: (): void => undefined } }, delegate: null };
    const ms = new MapStudio(props as unknown as ConstructorParameters<typeof MapStudio>[0]);
    ms.mapContainer = {
        setAttribute: (name: string, value: string): void => { attrs[name] = value; },
        getAttribute: (name: string): string | null => (name in attrs ? attrs[name] : null),
        querySelector: (): null => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1366, height: 700 }),
        clientWidth: 1366, clientHeight: 700, parentElement: null
    } as unknown as HTMLDivElement;
    ms.map = {
        getSource: (id: string) => (id === SOURCE_YOU_ARE_HERE ? { setData: (d: unknown): void => { data.push(d); } } : undefined),
        getZoom: (): number => zoom,
        easeTo: (opts: { center: [number, number]; zoom: number }): void => { moves.push({ center: opts.center, zoom: opts.zoom }); },
        getContainer: () => ms.mapContainer
    } as unknown as MapStudio['map'];
    ms.zoomControl = { setLocate: (s: string): void => { locate.push(s); }, setFit: (): void => undefined } as unknown as MapStudio['zoomControl'];
    ms.legendControl = { setYouAreHere: (on: boolean): void => { legend.push(on); } } as unknown as MapStudio['legendControl'];
    ms.itemsReady = true;
    const apply = (): void => (ms as unknown as { applyUserLocation(): void }).applyUserLocation();
    apply();
    return {
        ms, data, moves, locate, legend, attrs,
        setLocation: (value: unknown): void => {
            (ms as unknown as { props: unknown }).props = { ...props, props: { ...props.props, userLocation: value } };
            apply();
        },
        setZoom: (z: number): void => { zoom = z; }
    };
}

function fix(lat: number, lng: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return { enabled: true, permissionGranted: true, data: { latitude: lat, longitude: lng, accuracy: 40, ...extra } };
}

type Features = { features: Array<{ properties: { part: string; heading?: number }; geometry: { coordinates: unknown } }> };

describe('you are here on the component (epic 4 entry 15)', () => {
    test('Off: the prop unbound draws no marker, Locate me off, no legend row', () => {
        const r = rig(null);
        expect((r.data[0] as Features).features).toEqual([]);
        expect(r.locate).toEqual(['off']);
        expect(r.legend).toEqual([false]);
        expect(r.attrs['data-you-are-here']).toBe('off');
    });

    test('Fix: the dot and the 40 m circle, the legend row, Locate me active; the same value again draws nothing', () => {
        const r = rig(fix(32.5, -103.5));
        const f = (r.data[0] as Features).features;
        expect(f.map((x) => x.properties.part)).toEqual(['accuracy', 'dot']);
        expect(f[1].geometry.coordinates).toEqual([-103.5, 32.5]);
        expect(r.locate).toEqual(['fix']);
        expect(r.legend).toEqual([true]);
        expect(r.attrs['data-you-at']).toBe('[-103.5,32.5]');
        expect(r.attrs['data-you-accuracy']).toBe('40');
        r.setLocation(fix(32.5, -103.5));
        expect(r.data).toHaveLength(1);
    });

    test('Moves: a new position moves the marker and leaves the camera', () => {
        const r = rig(fix(32.5, -103.5));
        r.setLocation(fix(32.501, -103.5));
        expect(r.data).toHaveLength(2);
        expect((r.data[1] as Features).features[1].geometry.coordinates).toEqual([-103.5, 32.501]);
        expect(r.moves).toEqual([]);
    });

    test('Heading: the dot carries it for the wedge', () => {
        const r = rig(fix(32.5, -103.5, { heading: 90 }));
        expect((r.data[0] as Features).features[1].properties.heading).toBe(90);
        expect(r.attrs['data-you-heading']).toBe('90');
    });

    test('Denied and no fix: the marker and the row go, Locate me says why', () => {
        const r = rig(fix(32.5, -103.5));
        r.setLocation({ enabled: true, permissionGranted: false });
        expect((r.data[1] as Features).features).toEqual([]);
        expect(r.locate).toEqual(['fix', 'denied']);
        expect(r.legend).toEqual([true, false]);
        r.setLocation({ enabled: true, permissionGranted: true, data: { latitude: 999, longitude: 0 } });
        expect(r.locate).toEqual(['fix', 'denied', 'nofix']);
    });

    test('Locate me: centred on the position at zoom 15, or the current zoom if closer; nothing without a position', () => {
        const r = rig(fix(32.5, -103.5));
        r.ms.onLocate();
        expect(r.moves).toEqual([{ center: [-103.5, 32.5], zoom: LOCATE_ZOOM }]);
        r.setZoom(17.5);
        r.ms.onLocate();
        expect(r.moves[1]).toEqual({ center: [-103.5, 32.5], zoom: 17.5 });
        r.setLocation({ enabled: false });
        r.ms.onLocate();
        expect(r.moves).toHaveLength(2);
    });

    test('before the layers exist the controls are set, and the marker is drawn once they are', () => {
        const r = rig(null);
        r.ms.itemsReady = false;
        r.setLocation(fix(32.5, -103.5));
        expect(r.data).toHaveLength(1);
        expect(r.locate).toEqual(['off', 'fix']);
        r.ms.itemsReady = true;
        (r.ms as unknown as { applyUserLocation(): void }).applyUserLocation();
        expect(r.data).toHaveLength(2);
    });
});
