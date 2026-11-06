// In Edit mode a click selects and opens Details, no popup (epic 4 entry 26, the owner's choice A; EXPERIENCE.md Select): on the
// component itself (MapStudio with its selection.tsx, editing.ts and camera.ts paths), its libraries stubbed. In Edit mode (level
// `full`, 768 px and wider) a marker click selects the point with Details open and sends the point click round trip but no
// popup.open; a line click selects the line with Details and no line popup; an area click selects the area with Details; a shared
// marker still opens its pick list, whose row selects and opens Details; the restore of a remembered popup opens Details. As
// Details docks the stage narrows and the map is panned by the clicked place's shift with no animation, so every item keeps its
// place on the page; an item the panel then covers is brought into view inside the camera padding; a click while Details is
// open moves nothing. The Edit switch turned on closes an open popup (popup.close sent) or pick list and keeps the selection, so
// the page sees no change. Esc with the Line, Area or Point tool in hand puts it down and Details stays (the map container's
// capture listener marks the press handled, so the component's own Esc skips it); a second Esc closes Details. View mode's clicks
// open the popups as before.

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
        ComponentStoreDelegate: class {
            notify(): void {
                // The component's redraw; nothing to draw here.
            }
        },
        PageStore: { instanceKeyFor: (): string => 'key' }
    };
}, { virtual: true });

import * as React from 'react';
import { Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { LIVE_INITIAL, KindDisplay } from '../live';
import { LAYER_AREA_FILL, LAYER_ITEM_LINES, LAYER_ITEM_MARKERS } from '../mapLayers';
import { MapStudio, MapStudioState } from '../MapStudio';
import { applyRestore } from '../camera';
import { fromProps, pickTool } from '../studio';

const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] };
const LINE: Kind = { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [] };
const FENCE: Kind = { id: 'fence', name: 'Geofence', geometry: 'line', icon: 'geofence', labelRank: 1, fields: [], area: true };
/** A measuring instrument's kind (its icon KPI on): a line carrying one opens its popup at the clicked segment (features.ts). */
const TAP: Kind = { id: 'tap', name: 'Pressure tap', geometry: 'point', icon: 'pressure-tap', labelRank: 2, fields: [], instrument: true };
const CTB1: [number, number] = [-105.012, 39.7262];
const BEND: [number, number] = [-105.009441, 39.720791];
const SWD1: [number, number] = [-104.983671, 39.715476];
const P14: [number, number] = [-104.97, 39.74];
/** West of the others: at 100 px into the 1038 px stage, under the panel's strip once Details docks. */
const WEST: [number, number] = [-105.0419, 39.73];
const FENCE_RING: Array<[number, number]> = [[-104.996, 39.734], [-104.988, 39.734], [-104.988, 39.73], [-104.996, 39.73]];

function point(id: string, name: string, at: [number, number]): MapItemRecord {
    return { id, kind: 'pad', name, geometry: { type: 'Point', coordinates: at }, properties: {}, assetId: null, overrides: {}, ends: null,
        attachment: null, version: 3, deleted: false };
}

const ITEMS: MapItemRecord[] = [
    point('ctb1', 'CTB1', CTB1), point('p14', 'P14', P14), point('a', 'Pad A', SWD1), point('b', 'Pad B', SWD1), point('w1', 'West pad', WEST),
    { id: 'lswd', kind: 'line', name: 'L-SWD', geometry: { type: 'LineString', coordinates: [CTB1, BEND, SWD1] }, properties: {}, assetId: null,
        overrides: {}, ends: null, attachment: null, version: 2, deleted: false },
    { id: 'pt1', kind: 'tap', name: 'PT-1', geometry: { type: 'Point', coordinates: [-105.0115, 39.7252] }, properties: {}, assetId: null,
        overrides: {}, ends: null, attachment: { lineId: 'lswd', distanceM: 120 }, version: 1, deleted: false },
    { id: 'fence', kind: 'fence', name: 'North fence', geometry: { type: 'LineString', coordinates: FENCE_RING }, properties: {}, assetId: null,
        overrides: {}, ends: null, attachment: null, version: 1, deleted: false }
];

/** A kind display with a custom popup view: every kind would open a popup in View mode; the tap's measures (its icon KPI). */
function display(kindId: string): KindDisplay {
    const kpis = kindId === 'tap' ? [{ key: 'pressure', label: 'Pressure', unit: 'psi', icon: true, on: true }] : [];
    return { kindId, comms: false, kpis, alarms: { on: false, count: false, summary: false }, link: '', popupView: { path: 'Popups/X', params: {} } };
}

// The page at 1366 px: the rail and the list docked left of the stage in Edit mode, the properties panel between them and the
// stage when Details is open (DESIGN.md spacing); the map 700 px tall under a 60 px header.
const PAGE_W = 1366;
const DOCK = 72 + 256;
const PANEL = 320;
const MAP_TOP = 60;
const MAP_H = 700;
/** The fake map's scale: pixels per degree, both ways. */
const PX_PER_DEG = 10000;

interface Sent {
    pointClick: string[];
    popupOpen: string[];
    popupClose: string[];
    /** The props the component wrote (editMode, selectedItem) in order. */
    props: Array<[string, unknown]>;
}

/** What a MapLibre click on the map hits: the marker, line or area features `queryRenderedFeatures` returns, by layer. */
interface Hit {
    markers?: unknown[];
    lines?: unknown[];
    areas?: unknown[];
}

interface Pan {
    offset: [number, number];
    animate: boolean;
}

interface Harness {
    ms: MapStudio;
    sent: Sent;
    /** The component's state after every update so far (setState applies at once here, as outside React's batching). */
    state(): MapStudioState;
    /** A click on the map at a place (a page pixel there), the map's stub reporting `hit` under it. */
    click(hit: Hit, at?: [number, number]): void;
    /** Where a place is on the page now: the map's box on the page plus the place's pixel in the map. */
    page(lngLat: [number, number]): [number, number];
    /** The pans asked of the map, in order. */
    pans: Pan[];
    /** The first layer of every `queryRenderedFeatures` asked, in order. */
    queried: string[];
    /** The map's own size (MapLibre's transform), which follows its container on resize only. */
    size(): [number, number];
}

function harness(editMode: boolean): Harness {
    const sent: Sent = { pointClick: [], popupOpen: [], popupClose: [], props: [] };
    const store = {
        delegate: {
            sendPointClick: (id: string): void => { sent.pointClick.push(id); },
            sendPopupOpen: (id: string): void => { sent.popupOpen.push(id); },
            sendPopupClose: (id: string): void => { sent.popupClose.push(id); }
        },
        props: { write: (key: string, value: unknown): void => { sent.props.push([key, value]); } },
        componentEvents: { fireComponentEvent: (): void => undefined }
    };
    const delegate = {
        level: 'full', items: ITEMS, editing: 'on', load: { state: 'loaded', message: '' }, unsaved: [], itemsRevision: 1,
        live: { ...LIVE_INITIAL, fulls: 1, display: { pad: display('pad'), line: display('line'), fence: display('fence'), tap: display('tap') } },
        lists: { kinds: [PAD, LINE, FENCE, TAP], assets: [], assetNames: {} }
    };
    const props = { props: { editMode, startingArea: {}, previewStyles: false, selectedItem: null }, store, delegate } as unknown as
        ConstructorParameters<typeof MapStudio>[0];
    const ms = new MapStudio(props);
    // The stage on the page: the map's box beside the docked studio, narrower while Details is open for the selected item.
    const box = (): { left: number; top: number; width: number; height: number } => {
        const docked = ms.studioOn();
        const details = docked && ms.state.panel !== null && ms.state.selected !== null && ms.state.selected.id === ms.state.panel;
        const left = docked ? DOCK + (details ? PANEL : 0) : 0;
        return { left, top: MAP_TOP, width: PAGE_W - left, height: MAP_H };
    };
    const attrs: Record<string, string> = {};
    const container = {
        getBoundingClientRect: () => box(),
        get clientWidth(): number { return box().width; },
        get clientHeight(): number { return box().height; },
        setAttribute: (name: string, value: string): void => { attrs[name] = value; },
        getAttribute: (name: string): string | null => (name in attrs ? attrs[name] : null),
        querySelector: (): null => null,
        parentElement: null
    };
    ms.mapContainer = container as unknown as HTMLDivElement;
    // setState applied at once, as React does outside its own handlers (a MapLibre or native listener): the redraw publishes the
    // selection to the page (itemsLayer.ts drawItems), then the after-render callback runs.
    (ms as unknown as { setState: (update: unknown, callback?: () => void) => void }).setState = (update: unknown, callback?: () => void): void => {
        const next = typeof update === 'function' ? (update as (prev: MapStudioState) => Partial<MapStudioState> | null)(ms.state) : update;
        if (next) {
            ms.state = { ...ms.state, ...(next as Partial<MapStudioState>) };
        }
        ms.publishSelection();
        if (callback) {
            callback();
        }
    };
    // A map at a fixed scale: its centre, its size as MapLibre's transform holds it (its container's at the last resize), the pans.
    let center: [number, number] = [-105.0, 39.73];
    let size: [number, number] = [box().width, box().height];
    const pans: Pan[] = [];
    const queried: string[] = [];
    const project = (lngLat: [number, number] | { lng: number; lat: number }): { x: number; y: number } => {
        const [lng, lat] = Array.isArray(lngLat) ? lngLat : [lngLat.lng, lngLat.lat];
        return { x: (lng - center[0]) * PX_PER_DEG + size[0] / 2, y: (center[1] - lat) * PX_PER_DEG + size[1] / 2 };
    };
    let hit: Hit = {};
    ms.map = {
        queryRenderedFeatures: (_at: unknown, opts: { layers: string[] }): unknown[] => {
            queried.push(opts.layers[0]);
            return opts.layers[0] === LAYER_ITEM_MARKERS ? hit.markers || [] : opts.layers[0] === LAYER_ITEM_LINES ? hit.lines || []
                : hit.areas || [];
        },
        project,
        // MapLibre's resize keeps the centre and takes the container's size.
        resize: (): void => { size = [box().width, box().height]; },
        // panBy moves the camera by the offset: the content moves by minus it.
        panBy: (offset: [number, number], opts?: { animate?: boolean }): void => {
            center = [center[0] + offset[0] / PX_PER_DEG, center[1] - offset[1] / PX_PER_DEG];
            pans.push({ offset: [offset[0], offset[1]], animate: !(opts && opts.animate === false) });
        },
        getCanvas: () => ({ focus: (): void => undefined }),
        getContainer: () => container
    } as unknown as MapStudio['map'];
    ms.popup = fakePopup() as unknown as MapStudio['popup'];
    ms.popup!.on('close', ms.onPopupClosed);
    const page = (lngLat: [number, number]): [number, number] => {
        const p = project(lngLat);
        return [box().left + p.x, box().top + p.y];
    };
    return {
        ms, sent, pans, queried,
        state: () => ms.state,
        page,
        size: () => size,
        click: (h: Hit, at: [number, number] = CTB1): void => {
            hit = h;
            const p = project(at);
            (ms as unknown as { onMapClick: (ev: unknown) => void }).onMapClick({ point: { x: p.x, y: p.y }, lngLat: { lng: at[0], lat: at[1] } });
        }
    };
}

/** MapLibre's popup as the component uses it: opened by addTo, its remove firing the close event, its listeners on and off. */
function fakePopup(): unknown {
    let open = false;
    const listeners: Array<() => void> = [];
    const popup = {
        options: {},
        isOpen: (): boolean => open,
        setMaxWidth: (): unknown => popup,
        setLngLat: (): unknown => popup,
        addTo: (): unknown => {
            open = true;
            return popup;
        },
        remove: (): unknown => {
            open = false;
            listeners.slice().forEach((l) => l());
            return popup;
        },
        on: (_type: string, l: () => void): unknown => {
            listeners.push(l);
            return popup;
        },
        off: (_type: string, l: () => void): unknown => {
            const i = listeners.indexOf(l);
            if (i >= 0) {
                listeners.splice(i, 1);
            }
            return popup;
        }
    };
    return popup;
}

/** A marker feature as MapLibre gives it (the item's id, kind and name, a shared marker's members). */
function marker(id: string, name: string, at: [number, number], members: string[] = []): unknown {
    return { geometry: { type: 'Point', coordinates: at },
        properties: { id, kind: 'pad', name, members: members.length || 1, memberIds: members.join(',') } };
}

/** L-SWD's first segment, from its start to PT-1 (a line with a measuring instrument is one feature per segment, features.ts). */
const LINE_HIT: Hit = { lines: [{ geometry: { type: 'LineString', coordinates: [CTB1, BEND] }, properties: { id: 'lswd', from: 'start', to: 'pt1' } }] };
/** Inside the North fence's fill (an area is a closed ring of its line kind, features.ts `areas`). */
const FENCE_AT: [number, number] = [-104.992, 39.732];
const FENCE_HIT: Hit = { areas: [{ geometry: { type: 'Polygon', coordinates: [FENCE_RING.concat([FENCE_RING[0]])] }, properties: { id: 'fence' } }] };

/** A native keydown on the map container: its preventDefault marks it handled, as the browser's does. */
function nativeEscape(): KeyboardEvent {
    const ev = { key: 'Escape', target: null, defaultPrevented: false } as unknown as KeyboardEvent & { defaultPrevented: boolean };
    (ev as unknown as { preventDefault: () => void }).preventDefault = (): void => { (ev as { defaultPrevented: boolean }).defaultPrevented = true; };
    return ev;
}

/** The component's own keydown for the same press: React's event copies `defaultPrevented` from the native one. */
function rootKey(ms: MapStudio, native: KeyboardEvent): void {
    const synthetic = { key: native.key, target: null, defaultPrevented: native.defaultPrevented, ctrlKey: false, metaKey: false, altKey: false,
        shiftKey: false, preventDefault: (): void => undefined } as unknown as React.KeyboardEvent<HTMLDivElement>;
    (ms as unknown as { onRootKeyDown: (ev: React.KeyboardEvent<HTMLDivElement>) => void }).onRootKeyDown(synthetic);
}

/** One Esc as the browser delivers it: the map container's capture listener first, then the component's keydown. */
function escape(ms: MapStudio): void {
    const native = nativeEscape();
    ms.onKeyDown(native);
    rootKey(ms, native);
}

/** Two page pixels the same, to a thousandth of a pixel. */
function samePixel(a: [number, number], b: [number, number]): void {
    expect(a[0]).toBeCloseTo(b[0], 3);
    expect(a[1]).toBeCloseTo(b[1], 3);
}

/** The `selectedItem` values the component wrote to the page, in order. */
function pageSelections(sent: Sent): unknown[] {
    return sent.props.filter(([key]) => key === 'selectedItem').map(([, value]) => value);
}

beforeAll(() => {
    // The viewport's width, as the sheet and phone checks read it (popupParams.ts sheetBasisWidth): a 1366 px laptop.
    (global as unknown as { window: unknown }).window = { innerWidth: PAGE_W };
});

afterAll(() => {
    delete (global as unknown as { window?: unknown }).window;
});

beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'debug').mockImplementation(() => undefined);
});

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('in Edit mode a click selects and opens Details, no popup (entry 26)', () => {
    test('a point: CTB1 selected with Details open, no popup and no popup.open; the point click round trip still goes', () => {
        const h = harness(true);
        expect(h.ms.studioOn()).toBe(true);
        h.click({ markers: [marker('ctb1', 'CTB1', CTB1)] }, CTB1);
        expect(h.state().selected).toEqual({ id: 'ctb1', kind: 'point' });
        expect(h.state().panel).toBe('ctb1');
        expect(h.state().popup).toBeNull();
        expect(h.state().pick).toBeNull();
        expect(h.ms.popup!.isOpen()).toBe(false);
        expect(h.sent.popupOpen).toEqual([]);
        expect(h.sent.pointClick).toEqual(['ctb1']);
        expect(pageSelections(h.sent)).toEqual(['ctb1']);
    });

    test('a line: L-SWD selected with Details open (its handles are the selection\'s, entry 5), no line popup and no popup.open', () => {
        const h = harness(true);
        h.click(LINE_HIT, BEND);
        expect(h.state().selected).toEqual({ id: 'lswd', kind: 'line', segment: null });
        expect(h.state().panel).toBe('lswd');
        expect(h.state().popup).toBeNull();
        expect(h.sent.popupOpen).toEqual([]);
    });

    test('an area: the North fence, under no marker and no line, selected with Details open as a line is, no popup', () => {
        const h = harness(true);
        h.click(FENCE_HIT, FENCE_AT);
        // Queried after the markers and the lines, which are drawn over it.
        expect(h.queried).toEqual([LAYER_ITEM_MARKERS, LAYER_ITEM_LINES, LAYER_AREA_FILL]);
        expect(h.state().selected).toEqual({ id: 'fence', kind: 'line', segment: null });
        expect(h.state().panel).toBe('fence');
        expect(h.state().popup).toBeNull();
        expect(h.sent.popupOpen).toEqual([]);
        expect(h.sent.pointClick).toEqual([]);
        expect(pageSelections(h.sent)).toEqual(['fence']);
    });

    test('a click on another item moves Details to it; the ground clears the selection and closes Details, as today', () => {
        const h = harness(true);
        h.click({ markers: [marker('ctb1', 'CTB1', CTB1)] }, CTB1);
        h.click(LINE_HIT, BEND);
        expect(h.state().panel).toBe('lswd');
        h.click(FENCE_HIT, FENCE_AT);
        expect(h.state().panel).toBe('fence');
        h.click({}, FENCE_AT);
        expect(h.state().selected).toBeNull();
        expect(h.state().panel).toBeNull();
        expect(h.sent.popupOpen).toEqual([]);
        expect(h.sent.popupClose).toEqual([]);
        expect(pageSelections(h.sent)).toEqual(['ctb1', 'lswd', 'fence', null]);
    });

    test('a shared spot still opens its pick list; a row selects that item and opens Details, no popup, the point click sent', () => {
        const h = harness(true);
        h.click({ markers: [marker('a', 'Pad A', SWD1, ['a', 'b'])] }, SWD1);
        expect(h.state().pick).not.toBeNull();
        expect(h.state().pick!.rows.map((r) => r.id)).toEqual(['a', 'b']);
        expect(h.state().popup).toBeNull();
        // The pick list shows in the MapLibre popup: the row's choice closes it.
        expect(h.ms.popup!.isOpen()).toBe(true);
        h.ms.onPick('b');
        expect(h.state().pick).toBeNull();
        expect(h.state().popup).toBeNull();
        expect(h.state().selected).toEqual({ id: 'b', kind: 'point' });
        expect(h.state().panel).toBe('b');
        expect(h.ms.popup!.isOpen()).toBe(false);
        expect(h.sent.popupOpen).toEqual([]);
        expect(h.sent.pointClick).toEqual(['b']);
    });

    test('with Details open, a shared spot\'s pick list keeps the selection and Details: nothing moves; Esc closes the list alone', () => {
        const h = harness(true);
        h.click({ markers: [marker('ctb1', 'CTB1', CTB1)] }, CTB1);
        expect(h.state().panel).toBe('ctb1');
        expect(h.pans.length).toBe(1);
        const shared = h.page(SWD1);
        h.click({ markers: [marker('a', 'Pad A', SWD1, ['a', 'b'])] }, SWD1);
        expect(h.state().pick!.rows.map((r) => r.id)).toEqual(['a', 'b']);
        expect(h.state().selected).toEqual({ id: 'ctb1', kind: 'point' });
        expect(h.state().panel).toBe('ctb1');
        expect(h.ms.popup!.isOpen()).toBe(true);
        expect(h.pans.length).toBe(1);
        samePixel(h.page(SWD1), shared);
        // Esc closes the pick list, one step: CTB1 stays in Details.
        escape(h.ms);
        expect(h.state().pick).toBeNull();
        expect(h.state().selected).toEqual({ id: 'ctb1', kind: 'point' });
        expect(h.state().panel).toBe('ctb1');
        // Again, and a row: Details moves to that pad, nothing docks, nothing moves; the page saw no selection cleared.
        h.click({ markers: [marker('a', 'Pad A', SWD1, ['a', 'b'])] }, SWD1);
        h.ms.onPick('b');
        expect(h.state().pick).toBeNull();
        expect(h.state().selected).toEqual({ id: 'b', kind: 'point' });
        expect(h.state().panel).toBe('b');
        expect(h.pans.length).toBe(1);
        samePixel(h.page(SWD1), shared);
        expect(pageSelections(h.sent)).toEqual(['ctb1', 'b']);
        expect(h.sent.popupOpen).toEqual([]);
    });

    test('a remembered popup restored in Edit mode opens Details instead, for a point and for a line', () => {
        for (const [sel, at] of [[{ id: 'p14', kind: 'point', segment: null }, null], [{ id: 'lswd', kind: 'line', segment: null }, BEND]] as const) {
            const h = harness(true);
            h.ms.itemsReady = true;
            h.ms.restore = { center: P14, zoom: 14, selected: sel, popup: true, popupAt: at };
            h.ms.restoreSince = Date.now();
            applyRestore(h.ms);
            expect(h.state().selected && h.state().selected!.id).toBe(sel.id);
            expect(h.state().panel).toBe(sel.id);
            expect(h.state().popup).toBeNull();
            expect(h.sent.popupOpen).toEqual([]);
        }
    });

    test('View mode\'s area click is a click on the ground, as before: the selection goes and no area is asked for', () => {
        const h = harness(false);
        h.click({ markers: [marker('ctb1', 'CTB1', CTB1)] }, CTB1);
        h.ms.closePopup();
        h.click({ markers: [marker('ctb1', 'CTB1', CTB1)] }, CTB1);
        expect(h.state().selected).toEqual({ id: 'ctb1', kind: 'point' });
        h.queried.length = 0;
        h.click(FENCE_HIT, FENCE_AT);
        expect(h.queried).toEqual([LAYER_ITEM_MARKERS, LAYER_ITEM_LINES]);
        expect(h.state().selected).toBeNull();
        expect(h.state().panel).toBeNull();
    });
});

describe('the clicked item keeps its place on the page as Details docks (entry 26, the plan\'s Design Notes)', () => {
    test('CTB1 clicked: the stage narrows by the panel, the map takes its size and pans by the shift, with no animation', () => {
        const h = harness(true);
        const ctb1 = h.page(CTB1);
        const p14 = h.page(P14);
        const swd1 = h.page(SWD1);
        expect(h.size()).toEqual([PAGE_W - DOCK, MAP_H]);
        h.click({ markers: [marker('ctb1', 'CTB1', CTB1)] }, CTB1);
        expect(h.state().panel).toBe('ctb1');
        // The stage is 320 px narrower and MapLibre has its size; with the centre kept every item would be 160 px right.
        expect(h.size()).toEqual([PAGE_W - DOCK - PANEL, MAP_H]);
        expect(h.pans).toEqual([{ offset: [PANEL / 2, 0], animate: false }]);
        // So the clicked pad is still under the pointer, and every other item where it was: a press there drags it.
        samePixel(h.page(CTB1), ctb1);
        samePixel(h.page(P14), p14);
        samePixel(h.page(SWD1), swd1);
    });

    test('a click while Details is open docks nothing and moves nothing; the ground closing Details does not pan either', () => {
        const h = harness(true);
        h.click({ markers: [marker('ctb1', 'CTB1', CTB1)] }, CTB1);
        expect(h.pans.length).toBe(1);
        const p14 = h.page(P14);
        h.click({ markers: [marker('p14', 'P14', P14)] }, P14);
        expect(h.state().panel).toBe('p14');
        h.click(LINE_HIT, BEND);
        expect(h.state().panel).toBe('lswd');
        expect(h.pans.length).toBe(1);
        samePixel(h.page(P14), p14);
        h.click({}, P14);
        expect(h.state().panel).toBeNull();
        expect(h.pans.length).toBe(1);
    });

    test('a line, an area and a pick list\'s row keep their place too: the spot clicked, the shared marker', () => {
        for (const [hit, at] of [[LINE_HIT, BEND], [FENCE_HIT, FENCE_AT]] as const) {
            const h = harness(true);
            const before = h.page(at);
            h.click(hit, at);
            expect(h.state().panel).not.toBeNull();
            expect(h.pans).toEqual([{ offset: [PANEL / 2, 0], animate: false }]);
            samePixel(h.page(at), before);
        }
        const h = harness(true);
        h.click({ markers: [marker('a', 'Pad A', SWD1, ['a', 'b'])] }, SWD1);
        const shared = h.page(SWD1);
        expect(h.pans).toEqual([]);
        h.ms.onPick('b');
        expect(h.state().panel).toBe('b');
        expect(h.pans).toEqual([{ offset: [PANEL / 2, 0], animate: false }]);
        samePixel(h.page(SWD1), shared);
    });

    test('an item the docked panel would cover is brought into view, just enough, inside the camera padding, animated', () => {
        const h = harness(true);
        const before = h.page(WEST);
        // 100 px into the stage: under the panel's 320 px strip once Details docks.
        expect(before[0] - DOCK).toBeCloseTo(100, 3);
        h.click({ markers: [marker('w1', 'West pad', WEST)] }, WEST);
        expect(h.state().panel).toBe('w1');
        expect(h.pans.length).toBe(2);
        expect(h.pans[0]).toEqual({ offset: [PANEL / 2, 0], animate: false });
        // Then 48 px inside the stage's left edge (no camera padding on that side), the height untouched.
        expect(h.pans[1].animate).toBe(true);
        expect(h.pans[1].offset[1]).toBe(0);
        const after = h.ms.map!.project(WEST);
        expect(after.x).toBeCloseTo(48, 3);
        expect(h.page(WEST)[1]).toBeCloseTo(before[1], 3);
    });

    test('a popup restored in Edit mode from a centre saved for a wider map: P14 outside the stage is brought into view', () => {
        const h = harness(true);
        // The camera came back where a 1366 px View-mode map had it: P14 1200 px in, past the 1038 px stage's right edge.
        h.ms.map!.panBy([-381, 0]);
        h.pans.length = 0;
        expect(h.ms.map!.project(P14).x).toBeCloseTo(1200, 3);
        h.ms.itemsReady = true;
        h.ms.restore = { center: P14, zoom: 14, selected: { id: 'p14', kind: 'point', segment: null }, popup: true, popupAt: null };
        h.ms.restoreSince = Date.now();
        applyRestore(h.ms);
        expect(h.state().panel).toBe('p14');
        expect(h.state().popup).toBeNull();
        // The stage's shift first, with no animation, then just into view: 48 px inside the right edge (no padding there).
        expect(h.pans.length).toBe(2);
        expect(h.pans[0]).toEqual({ offset: [PANEL / 2, 0], animate: false });
        expect(h.pans[1].animate).toBe(true);
        expect(h.ms.map!.project(P14).x).toBeCloseTo(PAGE_W - DOCK - PANEL - 48, 3);
    });

    test('View mode: a click opens the card and pans nothing for Details, which never docks', () => {
        const h = harness(false);
        const ctb1 = h.page(CTB1);
        h.click({ markers: [marker('ctb1', 'CTB1', CTB1)] }, CTB1);
        expect(h.state().popup && h.state().popup!.point.id).toBe('ctb1');
        expect(h.pans).toEqual([]);
        samePixel(h.page(CTB1), ctb1);
    });
});

describe('the Edit switch turned on closes an open popup or pick list and keeps the selection (entry 26)', () => {
    test('P14\'s popup open in View mode: the switch on closes it, tells the Gateway with popup.close, P14 stays selected', () => {
        const h = harness(false);
        expect(h.ms.studioOn()).toBe(false);
        h.click({ markers: [marker('p14', 'P14', P14)] }, P14);
        expect(h.state().popup && h.state().popup!.point.id).toBe('p14');
        expect(h.ms.popup!.isOpen()).toBe(true);
        expect(h.sent.popupOpen).toEqual(['p14']);
        h.ms.onEditSwitch(true);
        expect(h.state().studio.mode).toBe('edit');
        expect(h.ms.studioOn()).toBe(true);
        expect(h.state().popup).toBeNull();
        expect(h.ms.popup!.isOpen()).toBe(false);
        expect(h.sent.popupClose).toEqual(['p14']);
        // The selection kept: P14 selected, with no Details opened for it, and the page told nothing new (no selectedItem null).
        expect(h.state().selected).toEqual({ id: 'p14', kind: 'point' });
        expect(h.state().panel).toBeNull();
        expect(h.state().studio.selected).toEqual(['p14']);
        expect(h.sent.props).toEqual([['selectedItem', 'p14'], ['editMode', true]]);
    });

    test('L-SWD\'s line popup open at a segment: the switch on keeps the line selected, without the popup\'s segment', () => {
        const h = harness(false);
        h.click(LINE_HIT, BEND);
        expect(h.state().popup && h.state().popup!.line).toBe(true);
        expect(h.state().selected).toEqual({ id: 'lswd', kind: 'line', segment: { fromId: 'start', toId: 'pt1' } });
        h.ms.onEditSwitch(true);
        expect(h.state().popup).toBeNull();
        expect(h.sent.popupClose).toEqual(['lswd']);
        expect(h.state().selected).toEqual({ id: 'lswd', kind: 'line', segment: null });
        expect(pageSelections(h.sent)).toEqual(['lswd']);
    });

    test('Details kept from an earlier Edit-mode session: CTB1\'s popup in View mode, the switch on, CTB1 selected with no Details', () => {
        const h = harness(true);
        h.click({ markers: [marker('ctb1', 'CTB1', CTB1)] }, CTB1);
        expect(h.state().panel).toBe('ctb1');
        // Leaving keeps the selection and the panel's id; a View-mode click on the same item keeps it too.
        h.ms.onEditSwitch(false);
        expect(h.ms.studioOn()).toBe(false);
        h.click({ markers: [marker('ctb1', 'CTB1', CTB1)] }, CTB1);
        expect(h.state().popup && h.state().popup!.point.id).toBe('ctb1');
        expect(h.state().panel).toBe('ctb1');
        h.ms.onEditSwitch(true);
        expect(h.ms.studioOn()).toBe(true);
        expect(h.state().popup).toBeNull();
        expect(h.sent.popupClose).toEqual(['ctb1']);
        expect(h.state().selected).toEqual({ id: 'ctb1', kind: 'point' });
        expect(h.state().panel).toBeNull();
        expect(pageSelections(h.sent)).toEqual(['ctb1']);
    });

    test('a pick list open in View mode: the switch on closes it; with nothing open nothing is sent', () => {
        const h = harness(false);
        h.click({ markers: [marker('a', 'Pad A', SWD1, ['a', 'b'])] }, SWD1);
        expect(h.state().pick).not.toBeNull();
        expect(h.ms.popup!.isOpen()).toBe(true);
        h.ms.onEditSwitch(true);
        expect(h.state().pick).toBeNull();
        expect(h.ms.popup!.isOpen()).toBe(false);
        expect(h.sent.popupClose).toEqual([]);
        const quiet = harness(false);
        quiet.ms.onEditSwitch(true);
        expect(quiet.state().studio.mode).toBe('edit');
        expect(quiet.sent.popupClose).toEqual([]);
        expect(quiet.sent.props).toEqual([['editMode', true]]);
    });
});

describe('Esc with a tool in hand puts it down and nothing else (entry 26, deferred from entry 25)', () => {
    /** L-SWD in Details and the tool in hand, as the toolbar leaves it. */
    function withTool(tool: 'line' | 'area' | 'point'): Harness {
        const h = harness(true);
        h.click(LINE_HIT, BEND);
        expect(h.state().panel).toBe('lswd');
        h.ms.setState((prev) => ({ studio: pickTool(prev.studio, tool, null) }));
        expect(h.state().studio.tool).toBe(tool);
        return h;
    }

    test('the Line tool: the first Esc puts it down with Select in hand and Details open; the second closes Details', () => {
        const h = withTool('line');
        const native = nativeEscape();
        h.ms.onKeyDown(native);
        // Marked handled on the map container, so the component's own keydown for the same press does nothing more.
        expect(native.defaultPrevented).toBe(true);
        rootKey(h.ms, native);
        expect(h.state().studio.tool).toBeNull();
        expect(h.state().drawing).toBeNull();
        expect(h.state().selected).toEqual({ id: 'lswd', kind: 'line', segment: null });
        expect(h.state().panel).toBe('lswd');
        escape(h.ms);
        expect(h.state().panel).toBeNull();
        expect(h.state().selected).toBeNull();
    });

    test('the Area and the Point tool: the same, one press one step', () => {
        for (const tool of ['area', 'point'] as const) {
            const h = withTool(tool);
            escape(h.ms);
            expect(h.state().studio.tool).toBeNull();
            expect(h.state().panel).toBe('lswd');
            escape(h.ms);
            expect(h.state().panel).toBeNull();
        }
    });

    test('with no tool in hand the map container leaves Esc alone and the component\'s Esc closes Details, as before', () => {
        const h = harness(true);
        h.click(LINE_HIT, BEND);
        const native = nativeEscape();
        h.ms.onKeyDown(native);
        expect(native.defaultPrevented).toBe(false);
        rootKey(h.ms, native);
        expect(h.state().panel).toBeNull();
    });
});

describe('View mode is unchanged', () => {
    test('a point click opens its popup (popup.open sent, no Details), a line click its line popup, the point click sent', () => {
        const h = harness(false);
        expect(h.state().studio).toEqual(fromProps(false));
        h.click({ markers: [marker('ctb1', 'CTB1', CTB1)] }, CTB1);
        expect(h.state().popup && h.state().popup!.point.id).toBe('ctb1');
        expect(h.state().popup!.line).toBe(false);
        expect(h.state().panel).toBeNull();
        expect(h.sent.popupOpen).toEqual(['ctb1']);
        expect(h.sent.pointClick).toEqual(['ctb1']);
        h.click(LINE_HIT, BEND);
        expect(h.state().popup && h.state().popup!.point.id).toBe('lswd');
        expect(h.state().popup!.line).toBe(true);
        expect(h.state().panel).toBeNull();
        expect(h.sent.popupOpen).toEqual(['ctb1', 'lswd']);
    });

    test('Esc in View mode closes the open popup, as before', () => {
        const h = harness(false);
        h.click({ markers: [marker('ctb1', 'CTB1', CTB1)] }, CTB1);
        expect(h.ms.popup!.isOpen()).toBe(true);
        escape(h.ms);
        expect(h.state().popup).toBeNull();
        expect(h.state().selected).toBeNull();
        expect(h.sent.popupClose).toEqual(['ctb1']);
    });
});
