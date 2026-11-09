// The page's window on the map, both ways (epic 4 entry 14, contract 0.4.0; the plan's I/O matrix): on the component itself
// (MapStudio with its selection.tsx and camera.ts paths), its libraries stubbed as in editClick.test.ts. An id the page writes to
// selectedItem does what a click on that item does: in View mode a point centred with its popup and one onItemSelected carrying
// `mapItem`, a member of a shared marker with its popup at the shared marker, a line fitted with its line popup at its middle's
// segment; in Edit mode Details open, no popup. Null clears the selection and closes the popup; an id not on the map clears it
// with one warning naming it. The component's own write coming back is ignored, a value set before the items load is applied
// once they load and wins over the remembered place's selection, a value written while a tool is in hand waits for the tool to
// go down (the latest write wins), and the table-and-map loop settles with one onItemSelected and one camera move. The viewport
// prop and onViewportChanged carry the same object, from the first settle on and once per move end. The delegate fires
// onPopupOpen and onPopupClose beside popup.open and popup.close. The pure helpers (pageEvents.ts) first.

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
            component: unknown;
            fired: unknown[] = [];

            constructor(component: unknown) {
                this.component = component;
            }

            notify(): void {
                // The component's redraw; nothing to draw here.
            }

            fireEvent(_name: string, message: unknown): void {
                this.fired.push(message);
            }
        },
        PageStore: { instanceKeyFor: (): string => 'key' }
    };
}, { virtual: true });

import { AbstractUIElementStore } from '@inductiveautomation/perspective-client';
import { Kind } from '../adapters';
import * as basemapLayer from '../basemapLayer';
import * as cameraModule from '../camera';
import { applyRestore, publishViewport, RESTORE_WAIT_MS, VIEWPORT_SETTLE_MS } from '../camera';
import * as editingModule from '../editing';
import * as itemsLayer from '../itemsLayer';
import { MapItemRecord } from '../contract';
import { LIVE_INITIAL, KindDisplay } from '../live';
import { LAYER_ITEM_MARKERS } from '../mapLayers';
import { MapStudio, MapStudioState } from '../MapStudio';
import { MapStudioStoreDelegate } from '../MapStudioStoreDelegate';
import { MESSAGE_EVENT, MessageTypes } from '../messages';
import {
    ECHO_EXPIRY_MS, ECHO_LIMIT, EchoGuard, ITEM_SELECTED_EVENT, POPUP_CLOSE_EVENT, POPUP_OPEN_EVENT, SELECTION_CHANGED_EVENT, VIEWPORT_CHANGED_EVENT, echoGuard,
    firePageEvent, noteWrite, pageId, takeEcho, viewportKey, viewportOf, writePageProp
} from '../pageEvents';
import { Place } from '../place';
import { applyPageSelection, readMountSelection, readPageSelection } from '../selection';
import { pickTool } from '../studio';

describe('the pure helpers (pageEvents.ts)', () => {
    test('the viewport: the centre and the corners to 6 decimals, the zoom to 2, the same place the same key', () => {
        const v = viewportOf({ lng: -104.97500049, lat: 39.75000051 }, 15.004, { west: -105.0123456789, south: 39.7, east: -104.9, north: 39.8 });
        expect(v).toEqual({ center: [-104.975, 39.750001], zoom: 15, bounds: [[-105.012346, 39.7], [-104.9, 39.8]] });
        expect(viewportKey(v)).toBe(viewportKey(viewportOf({ lng: -104.975, lat: 39.750001 }, 15, { west: -105.012346, south: 39.7, east: -104.9, north: 39.8 })));
    });

    test('pageId: an id, or null for null, an empty text or anything not a text', () => {
        expect(pageId('p14')).toBe('p14');
        expect(pageId('')).toBeNull();
        expect(pageId(null)).toBeNull();
        expect(pageId(undefined)).toBeNull();
        expect(pageId(14)).toBeNull();
    });

    test('the echo guard: a write is noted unless it is the value last written; its echo drops it and every earlier one', () => {
        const keys = (g: EchoGuard): string[] => g.pending.map((p) => p.key);
        let g = noteWrite(echoGuard(null), 'ctb1', 0);
        expect(keys(g)).toEqual(['ctb1']);
        // The page wrote P14 (read as the page's: the value last written), and the component publishes it: no change comes back.
        const page = takeEcho(g, 'p14', 10);
        expect(page.echo).toBe(false);
        expect(keys(noteWrite(page.guard, 'p14', 20))).toEqual(['ctb1']);
        // Compared with the value last written, not the prop delivered: A, then null before a sync, are both noted.
        g = noteWrite(noteWrite(echoGuard(null), 'a', 0), null, 5);
        expect(keys(g)).toEqual(['a', '']);
        // Writes of A, B and A again come back as one change to A: everything through the last A goes.
        g = noteWrite(noteWrite(noteWrite(echoGuard(null), 'a', 0), 'b', 1), 'a', 2);
        const once = takeEcho(g, 'a', 3);
        expect(once.echo).toBe(true);
        expect(keys(once.guard)).toEqual([]);
        // ... so a later B is the page's.
        expect(takeEcho(once.guard, 'b', 4).echo).toBe(false);
        // A note expires: a write whose echo never came does not swallow the page's write of the same id after it.
        expect(takeEcho(noteWrite(echoGuard(null), 'a', 0), 'a', ECHO_EXPIRY_MS - 1).echo).toBe(true);
        expect(takeEcho(noteWrite(echoGuard(null), 'a', 0), 'a', ECHO_EXPIRY_MS).echo).toBe(false);
        // A value the component never wrote is the page's.
        expect(takeEcho(noteWrite(echoGuard(null), 'ctb1', 0), 'nope', 1).echo).toBe(false);
        // Never more than ECHO_LIMIT waiting, the oldest first to go.
        let many = echoGuard(null);
        for (let i = 0; i < ECHO_LIMIT + 3; i++) {
            many = noteWrite(many, 'id' + i, i);
        }
        expect(many.pending.length).toBe(ECHO_LIMIT);
        expect(many.pending[0].key).toBe('id3');
    });

    test('a write or a fire that fails is one warning and nothing else', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        expect(writePageProp({ write: (): void => { throw new Error('closed'); } }, 'viewport', {})).toBe(false);
        expect(firePageEvent({ fireComponentEvent: (): void => { throw new Error('gone'); } }, 'onPopupOpen', {})).toBe(false);
        expect(firePageEvent(undefined, 'onPopupClose', {})).toBe(false);
        expect(warn.mock.calls.map((c) => c[0])).toEqual([
            '[MapStudio] The viewport prop could not be written: closed',
            '[MapStudio] The onPopupOpen event could not be fired: gone',
            '[MapStudio] The onPopupClose event could not be fired: the component has no component events'
        ]);
        warn.mockRestore();
    });
});

const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] };
const LINE: Kind = { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [] };
const FENCE: Kind = { id: 'fence', name: 'Geofence', geometry: 'line', icon: 'geofence', labelRank: 1, fields: [], area: true };
const TAP: Kind = { id: 'tap', name: 'Pressure tap', geometry: 'point', icon: 'pressure-tap', labelRank: 2, fields: [], instrument: true };
const CTB1: [number, number] = [-105.012, 39.7262];
const BEND: [number, number] = [-105.009441, 39.720791];
const SWD1: [number, number] = [-104.983671, 39.715476];
const P14: [number, number] = [-104.975, 39.75];
/** Where the shared marker of Shared A and Shared B is drawn (their centroid). */
const SHARED_AT: [number, number] = [-104.9649125, 39.757];
const FENCE_RING: Array<[number, number]> = [[-104.996, 39.734], [-104.988, 39.734], [-104.988, 39.73], [-104.996, 39.73]];

function point(id: string, name: string, at: [number, number], kind = 'pad'): MapItemRecord {
    return { id, kind, name, geometry: { type: 'Point', coordinates: at }, properties: {}, assetId: null, overrides: {}, ends: null,
        attachment: null, version: 3, deleted: false };
}

const ITEMS: MapItemRecord[] = [
    point('ctb1', 'CTB1', CTB1), point('p14', 'Point 2', P14), point('swd1', 'SWD1', SWD1),
    point('sa', 'Shared A', [-104.965, 39.757]), point('sb', 'Shared B', [-104.964825, 39.757]),
    { id: 'lswd', kind: 'line', name: 'L-SWD', geometry: { type: 'LineString', coordinates: [CTB1, BEND, SWD1] }, properties: {}, assetId: null,
        overrides: {}, ends: { start: { itemId: 'ctb1' }, end: { itemId: 'swd1' } }, attachment: null, version: 2, deleted: false },
    // PT-1 at 1,143 m and PT-2 at 2,841 m along the 2,922 m line: its middle (1,461 m) falls between them.
    { ...point('pt1', 'PT-1', [-105.003761, 39.71962], 'tap'), attachment: { lineId: 'lswd', distanceM: 1143 } },
    { ...point('pt2', 'PT-2', [-104.984586, 39.715665], 'tap'), attachment: { lineId: 'lswd', distanceM: 2841 } },
    { id: 'fence', kind: 'fence', name: 'North fence', geometry: { type: 'LineString', coordinates: FENCE_RING }, properties: {}, assetId: null,
        overrides: {}, ends: null, attachment: null, version: 1, deleted: false }
];

/** A kind display with a custom popup view: every kind opens a popup in View mode; the tap's measures (its icon KPI). */
function display(kindId: string): KindDisplay {
    const kpis = kindId === 'tap' ? [{ key: 'pressure', label: 'Pressure', unit: 'psi', icon: true, on: true }] : [];
    return { kindId, comms: false, kpis, alarms: { on: false, count: false, summary: false }, link: '', popupView: { path: 'Popups/X', params: {} } };
}

const PAGE_W = 1366;
const MAP_H = 700;
const PX_PER_DEG = 10000;

interface Harness {
    ms: MapStudio;
    /** The props the component wrote, in order. */
    props: Array<[string, unknown]>;
    /** The component events it fired, in order. */
    events: Array<[string, Record<string, unknown>]>;
    popupOpen: Array<[string, unknown]>;
    popupClose: string[];
    pointClick: string[];
    /** The camera moves asked of the map (jumpTo, easeTo, fitBounds), in order. */
    moves: string[];
    state(): MapStudioState;
    /** The page writes `selectedItem` (a Perspective prop change): read and applied as componentDidUpdate does. */
    pageWrites(id: unknown): void;
    /**
     * The component's own selectedItem writes come back as prop changes (the next sync): each in order, or with `coalesce` as one
     * change to the value Perspective's tree holds now, or none when it holds the value the component last saw.
     */
    syncEchoes(coalesce?: boolean): void;
    /** A marker clicked on the map. */
    clickMarker(id: string, name: string, at: [number, number]): void;
    /** The ground clicked: nothing under the pointer. */
    clickGround(): void;
    /** The map moved: its centre and zoom now, then MapLibre's moveend. */
    moveTo(center: [number, number], zoom: number): void;
    /** The delegate's state changed (the items arrived, a batch): componentDidUpdate's page selection step. */
    update(): void;
    /** From now on setState queues its updates, as React batches them inside componentDidUpdate, until `flush`. */
    defer(): void;
    /** Apply the queued updates in order (React's next render), then run componentDidUpdate for it; setState applies at once again. */
    flush(): void;
    /** The page writes props (a Perspective prop change), and the component's componentDidUpdate runs for it. */
    pageWritesProps(next: Record<string, unknown>): void;
}

interface HarnessOptions {
    editMode?: boolean;
    /** The delegate before map.load answered: no items, load state loading, no full batch. */
    loading?: boolean;
    /** selectedItem as the component mounts. */
    selectedItem?: string | null;
    /** The remembered place as the component mounts (camera.ts rememberedPlace). */
    restore?: Place | null;
}

function harness(options: HarnessOptions = {}): Harness {
    const props: Array<[string, unknown]> = [];
    const events: Array<[string, Record<string, unknown>]> = [];
    const popupOpen: Array<[string, unknown]> = [];
    const popupClose: string[] = [];
    const pointClick: string[] = [];
    const moves: string[] = [];
    // Perspective's tree: the value it holds now (the component's writes and the page's), and the component's writes that changed
    // it, to come back on the next sync; the prop the component reads (`ms.props.props.selectedItem`) lags until then.
    let tree: unknown = options.selectedItem || null;
    const echoes: unknown[] = [];
    const store = {
        delegate: {
            sendPointClick: (id: string): void => { pointClick.push(id); },
            sendPopupOpen: (id: string, segment: unknown = null): void => { popupOpen.push([id, segment]); },
            sendPopupClose: (id: string): void => { popupClose.push(id); }
        },
        props: {
            write: (key: string, value: unknown): void => {
                props.push([key, value]);
                if (key === 'selectedItem' && value !== tree) {
                    tree = value;
                    echoes.push(value);
                }
            }
        },
        componentEvents: { fireComponentEvent: (name: string, payload: Record<string, unknown>): void => { events.push([name, payload]); } }
    };
    const loaded = !options.loading;
    const delegate = {
        level: 'full', items: loaded ? ITEMS : [], editing: 'on', load: { state: loaded ? 'loaded' : 'loading', message: '' }, unsaved: [],
        itemsRevision: loaded ? 1 : 0,
        live: { ...LIVE_INITIAL, fulls: loaded ? 1 : 0, display: { pad: display('pad'), line: display('line'), fence: display('fence'), tap: display('tap') } },
        lists: { kinds: [PAD, LINE, FENCE, TAP], assets: [], assetNames: {} }
    };
    const initial = { props: { editMode: !!options.editMode, startingArea: {}, previewStyles: false, selectedItem: options.selectedItem || null }, store, delegate };
    const ms = new MapStudio(initial as unknown as ConstructorParameters<typeof MapStudio>[0]);
    const setProps = (next: unknown): void => { (ms as unknown as { props: unknown }).props = next; };
    const attrs: Record<string, string> = {};
    const container = {
        getBoundingClientRect: () => ({ left: 0, top: 60, width: PAGE_W, height: MAP_H }),
        clientWidth: PAGE_W,
        clientHeight: MAP_H,
        setAttribute: (name: string, value: string): void => { attrs[name] = value; },
        getAttribute: (name: string): string | null => (name in attrs ? attrs[name] : null),
        querySelector: (): null => null,
        parentElement: null
    };
    ms.mapContainer = container as unknown as HTMLDivElement;
    let deferred = false;
    const queued: Array<[unknown, (() => void) | undefined]> = [];
    const apply = (update: unknown, callback?: () => void): void => {
        const next = typeof update === 'function' ? (update as (prev: MapStudioState) => Partial<MapStudioState> | null)(ms.state) : update;
        if (next) {
            ms.state = { ...ms.state, ...(next as Partial<MapStudioState>) };
        }
        ms.publishSelection();
        if (callback) {
            callback();
        }
    };
    (ms as unknown as { setState: (update: unknown, callback?: () => void) => void }).setState = (update: unknown, callback?: () => void): void => {
        if (deferred) {
            queued.push([update, callback]);
            return;
        }
        apply(update, callback);
    };
    let center: [number, number] = [-105.0, 39.73];
    let zoom = 12;
    let hit: unknown[] = [];
    const project = (lngLat: [number, number] | { lng: number; lat: number }): { x: number; y: number } => {
        const [lng, lat] = Array.isArray(lngLat) ? lngLat : [lngLat.lng, lngLat.lat];
        return { x: (lng - center[0]) * PX_PER_DEG + PAGE_W / 2, y: (center[1] - lat) * PX_PER_DEG + MAP_H / 2 };
    };
    const map = {
        queryRenderedFeatures: (_at: unknown, opts: { layers: string[] }): unknown[] => (opts.layers[0] === LAYER_ITEM_MARKERS ? hit : []),
        project,
        resize: (): void => undefined,
        panBy: (): void => undefined,
        getCanvas: () => ({ focus: (): void => undefined }),
        getContainer: () => container,
        getZoom: (): number => zoom,
        getCenter: () => ({ lng: center[0], lat: center[1] }),
        getBounds: () => ({
            getWest: (): number => center[0] - PAGE_W / 2 / PX_PER_DEG, getEast: (): number => center[0] + PAGE_W / 2 / PX_PER_DEG,
            getSouth: (): number => center[1] - MAP_H / 2 / PX_PER_DEG, getNorth: (): number => center[1] + MAP_H / 2 / PX_PER_DEG
        }),
        jumpTo: (opts: { center: [number, number]; zoom?: number }): void => {
            center = opts.center;
            zoom = opts.zoom !== undefined ? opts.zoom : zoom;
            moves.push('jumpTo ' + center.join(',') + ' z' + zoom);
        },
        easeTo: (opts: { center: [number, number] }): void => {
            center = opts.center;
            moves.push('easeTo ' + center.join(','));
        },
        fitBounds: (b: [[number, number], [number, number]]): void => {
            center = [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2];
            moves.push('fitBounds ' + b.map((c) => c.join(',')).join(' '));
        }
    };
    ms.map = map as unknown as MapStudio['map'];
    ms.itemsReady = true;
    ms.popup = fakePopup() as unknown as MapStudio['popup'];
    ms.popup!.on('close', ms.onPopupClosed);
    if (options.restore) {
        ms.restore = options.restore;
    }
    // As componentDidMount reads it, right after the remembered place.
    readMountSelection(ms);
    const update = (): void => {
        applyPageSelection(ms);
        applyRestore(ms);
    };
    return {
        ms, props, events, popupOpen, popupClose, pointClick, moves,
        state: () => ms.state,
        pageWrites: (id: unknown): void => {
            const prev = ms.props.props.selectedItem;
            tree = id;
            setProps({ ...ms.props, props: { ...ms.props.props, selectedItem: id } });
            readPageSelection(ms, prev);
            update();
        },
        syncEchoes: (coalesce = false): void => {
            const values = coalesce ? [tree] : echoes.slice();
            echoes.length = 0;
            for (const value of values) {
                const prev = ms.props.props.selectedItem;
                if (value === prev) {
                    continue;
                }
                setProps({ ...ms.props, props: { ...ms.props.props, selectedItem: value } });
                readPageSelection(ms, prev);
                update();
            }
        },
        clickMarker: (id: string, name: string, at: [number, number]): void => {
            hit = [{ geometry: { type: 'Point', coordinates: at }, properties: { id, kind: 'pad', name, members: 1, memberIds: '' } }];
            const p = project(at);
            (ms as unknown as { onMapClick: (ev: unknown) => void }).onMapClick({ point: { x: p.x, y: p.y }, lngLat: { lng: at[0], lat: at[1] } });
        },
        clickGround: (): void => {
            hit = [];
            (ms as unknown as { onMapClick: (ev: unknown) => void }).onMapClick({ point: { x: 1, y: 1 }, lngLat: { lng: -105.05, lat: 39.7 } });
        },
        moveTo: (c: [number, number], z: number): void => {
            center = c;
            zoom = z;
            publishViewport(ms, ms.map!);
        },
        update: (): void => {
            setProps({ ...ms.props, delegate: { ...delegate, items: ITEMS, load: { state: 'loaded', message: '' }, itemsRevision: 1,
                live: { ...delegate.live, fulls: 1 } } });
            update();
        },
        defer: (): void => { deferred = true; },
        flush: (): void => {
            const prev = ms.props;
            deferred = false;
            for (const [u, cb] of queued.splice(0)) {
                apply(u, cb);
            }
            ms.componentDidUpdate(prev);
        },
        pageWritesProps: (next: Record<string, unknown>): void => {
            const prev = ms.props;
            setProps({ ...ms.props, props: { ...ms.props.props, ...next } });
            ms.componentDidUpdate(prev);
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

/** The onItemSelected events fired: the payload's map item id, or null when cleared. */
function selectedEvents(h: Harness): Array<string | null> {
    return h.events.filter(([name]) => name === ITEM_SELECTED_EVENT).map(([, p]) => {
        expect(Object.keys(p)).toEqual(['mapItem']);
        return p.mapItem === null ? null : (p.mapItem as { id: string }).id;
    });
}

let warn: jest.SpyInstance;

beforeAll(() => {
    (global as unknown as { window: unknown }).window = { innerWidth: PAGE_W };
});

afterAll(() => {
    delete (global as unknown as { window?: unknown }).window;
});

beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('selectedItem written by the page, in View mode', () => {
    test('a point: selected and centred at zoom 15 with its popup, the point click sent, one onItemSelected carrying mapItem', () => {
        const h = harness();
        h.pageWrites('p14');
        expect(h.state().selected).toEqual({ id: 'p14', kind: 'point' });
        expect(h.state().popup).not.toBeNull();
        expect(h.state().popup!.point.id).toBe('p14');
        expect(h.ms.popup!.isOpen()).toBe(true);
        expect(h.moves).toEqual(['jumpTo ' + P14.join(',') + ' z15']);
        expect(h.popupOpen).toEqual([['p14', null]]);
        expect(h.pointClick).toEqual(['p14']);
        expect(selectedEvents(h)).toEqual(['p14']);
        const mapItem = h.events[0][1].mapItem as Record<string, unknown>;
        expect(mapItem).toMatchObject({ id: 'p14', name: 'Point 2', kind: 'pad', assetId: null });
        // The prop already holds the id the page wrote: the component's write changes nothing and is not awaited back.
        expect(h.ms.selectedEcho.pending).toEqual([]);
        expect(warn).not.toHaveBeenCalled();
    });

    test('a member of a shared marker: its own popup at the shared marker', () => {
        const h = harness();
        h.ms.anchors = { sa: SHARED_AT, sb: SHARED_AT };
        h.pageWrites('sb');
        expect(h.state().selected).toEqual({ id: 'sb', kind: 'point' });
        expect(h.state().popup!.point.id).toBe('sb');
        expect(h.state().popup!.lngLat).toEqual(SHARED_AT);
        expect(h.moves).toEqual(['jumpTo ' + SHARED_AT.join(',') + ' z15']);
    });

    test('a line: fitted, then its line popup at its middle, at the segment there; onPopupOpen\'s segment is that one', () => {
        const h = harness();
        h.pageWrites('lswd');
        expect(h.moves.length).toBe(1);
        expect(h.moves[0]).toMatch(/^fitBounds /);
        expect(h.state().selected).toEqual({ id: 'lswd', kind: 'line', segment: { fromId: 'pt1', toId: 'pt2' } });
        expect(h.state().popup!.line).toBe(true);
        expect(h.state().popup!.segment).toEqual({ fromId: 'pt1', toId: 'pt2' });
        expect(h.popupOpen).toEqual([['lswd', { fromId: 'pt1', toId: 'pt2' }]]);
        expect(selectedEvents(h)).toEqual(['lswd']);
    });

    test('an area: fitted and selected, no popup (a View-mode click on one opens nothing)', () => {
        const h = harness();
        h.pageWrites('fence');
        expect(h.moves[0]).toMatch(/^fitBounds /);
        expect(h.state().selected).toEqual({ id: 'fence', kind: 'line', segment: null });
        expect(h.state().popup).toBeNull();
        expect(h.popupOpen).toEqual([]);
    });

    test('an id not on the map clears the selection with one warning naming it; null then closes nothing more', () => {
        const h = harness();
        h.pageWrites('p14');
        h.pageWrites('nope');
        expect(h.state().selected).toBeNull();
        expect(h.state().popup).toBeNull();
        expect(h.popupClose).toEqual(['p14']);
        expect(warn.mock.calls.map((c) => c[0])).toEqual(['[MapStudio] The page selected nope, which is not on the map: the selection was cleared.']);
        expect(selectedEvents(h)).toEqual(['p14', null]);
        // The component wrote null; its echo comes back and is left out.
        h.syncEchoes();
        expect(h.ms.pageSelection).toBeNull();
        h.pageWrites(null);
        expect(h.state().selected).toBeNull();
        expect(selectedEvents(h)).toEqual(['p14', null]);
        expect(warn).toHaveBeenCalledTimes(1);
    });

    test('null clears the selection and closes the popup, telling the Gateway', () => {
        const h = harness();
        h.pageWrites('p14');
        h.pageWrites(null);
        expect(h.state().selected).toBeNull();
        expect(h.state().popup).toBeNull();
        expect(h.ms.popup!.isOpen()).toBe(false);
        expect(h.popupClose).toEqual(['p14']);
        expect(selectedEvents(h)).toEqual(['p14', null]);
    });

    test('the component\'s own write coming back is ignored, also when two clicks come before one sync', () => {
        const h = harness();
        h.clickMarker('ctb1', 'CTB1', CTB1);
        h.clickMarker('p14', 'Point 2', P14);
        expect(h.ms.selectedEcho.pending.map((p) => p.key)).toEqual(['ctb1', 'p14']);
        h.syncEchoes();
        expect(h.ms.selectedEcho.pending).toEqual([]);
        expect(h.ms.pageSelection).toBeNull();
        expect(h.state().selected).toEqual({ id: 'p14', kind: 'point' });
        // No camera move: the clicks moved nothing and nothing was applied from the echoes.
        expect(h.moves).toEqual([]);
        expect(selectedEvents(h)).toEqual(['ctb1', 'p14']);
    });

    test('clicks on A, B and A again before one sync come back as one change to A: nothing stale is left, the table\'s B applied', () => {
        const h = harness();
        h.clickMarker('ctb1', 'CTB1', CTB1);
        h.clickMarker('p14', 'Point 2', P14);
        h.clickMarker('ctb1', 'CTB1', CTB1);
        h.syncEchoes(true);
        expect(h.ms.selectedEcho.pending).toEqual([]);
        expect(h.ms.pageSelection).toBeNull();
        expect(h.state().selected).toEqual({ id: 'ctb1', kind: 'point' });
        // The table chooses P14 at once: the page's, applied.
        h.pageWrites('p14');
        expect(h.state().selected).toEqual({ id: 'p14', kind: 'point' });
        expect(h.moves).toEqual(['jumpTo ' + P14.join(',') + ' z15']);
    });

    test('a click on A, then the ground, before a sync: no change comes back; once the notes expire the table\'s A is applied', () => {
        const h = harness();
        h.clickMarker('ctb1', 'CTB1', CTB1);
        h.clickGround();
        expect(h.state().selected).toBeNull();
        expect(h.ms.selectedEcho.pending.map((p) => p.key)).toEqual(['ctb1', '']);
        // Perspective's tree holds null again, as the component last saw it: nothing comes back.
        h.syncEchoes(true);
        expect(h.ms.selectedEcho.pending.map((p) => p.key)).toEqual(['ctb1', '']);
        jest.advanceTimersByTime(ECHO_EXPIRY_MS);
        h.pageWrites('ctb1');
        expect(h.state().selected).toEqual({ id: 'ctb1', kind: 'point' });
        expect(h.state().popup!.point.id).toBe('ctb1');
        expect(h.ms.selectedEcho.pending).toEqual([]);
    });

    test('a click on A, then the ground, each coming back in order: both echoes taken, and the table\'s A applied at once', () => {
        const h = harness();
        h.clickMarker('ctb1', 'CTB1', CTB1);
        h.clickGround();
        expect(h.state().selected).toBeNull();
        h.syncEchoes();
        expect(h.ms.selectedEcho.pending).toEqual([]);
        expect(h.ms.pageSelection).toBeNull();
        h.pageWrites('ctb1');
        expect(h.state().selected).toEqual({ id: 'ctb1', kind: 'point' });
    });

    test('the table and the map answering each other settle with one onItemSelected and one camera move', () => {
        const h = harness();
        // The table's row writes P14; the map's onItemSelected selects the row; the row writes P14 again (no prop change).
        h.pageWrites('p14');
        h.syncEchoes();
        h.pageWrites('p14');
        h.syncEchoes();
        expect(selectedEvents(h)).toEqual(['p14']);
        expect(h.moves.length).toBe(1);
        expect(h.popupOpen).toEqual([['p14', null]]);
    });

    test('a value set before the items load is applied once they load, and wins over the remembered place\'s selection', () => {
        const remembered: Place = { center: CTB1, zoom: 16, selected: { id: 'ctb1', kind: 'point', segment: null }, popup: true, popupAt: null };
        const h = harness({ loading: true, selectedItem: 'p14', restore: remembered });
        expect(h.ms.restore).toBeNull();
        expect(h.ms.pageSelection).toEqual({ id: 'p14', since: expect.any(Number) });
        // Its echo from the Gateway session: no change.
        h.pageWrites('p14');
        expect(h.state().selected).toBeNull();
        h.update();
        expect(h.state().selected).toEqual({ id: 'p14', kind: 'point' });
        expect(h.state().popup!.point.id).toBe('p14');
        expect(h.popupOpen).toEqual([['p14', null]]);
        expect(selectedEvents(h)).toEqual(['p14']);
    });

    test('a page write while the items load replaces a remembered selection not yet put back', () => {
        const remembered: Place = { center: CTB1, zoom: 16, selected: { id: 'ctb1', kind: 'point', segment: null }, popup: true, popupAt: null };
        const h = harness({ loading: true, restore: remembered });
        expect(h.ms.restore).not.toBeNull();
        h.pageWrites('lswd');
        expect(h.ms.restore).toBeNull();
        h.update();
        expect(h.state().selected).toEqual({ id: 'lswd', kind: 'line', segment: { fromId: 'pt1', toId: 'pt2' } });
    });

    test('a value at mount equal to the remembered selection is the page\'s too: chosen as a click does, the camera going to it', () => {
        const remembered: Place = { center: CTB1, zoom: 13, selected: { id: 'ctb1', kind: 'point', segment: null }, popup: true, popupAt: null };
        const h = harness({ loading: true, selectedItem: 'ctb1', restore: remembered });
        expect(h.ms.pageSelection).toEqual({ id: 'ctb1', since: expect.any(Number) });
        expect(h.ms.restore).toBeNull();
        h.update();
        expect(h.state().selected).toEqual({ id: 'ctb1', kind: 'point' });
        expect(h.state().popup!.point.id).toBe('ctb1');
        expect(h.moves).toEqual(['jumpTo ' + CTB1.join(',') + ' z15']);
        expect(selectedEvents(h)).toEqual(['ctb1']);
    });

    test('a value the page set waits for the first full batch, not past the restore\'s wait', () => {
        const h = harness();
        (h.ms as unknown as { props: unknown }).props = { ...h.ms.props, delegate: { ...h.ms.props.delegate!, live: { ...h.ms.props.delegate!.live, fulls: 0 } } };
        h.pageWrites('p14');
        expect(h.state().selected).toBeNull();
        jest.setSystemTime(Date.now() + RESTORE_WAIT_MS + 1);
        applyPageSelection(h.ms);
        expect(h.state().selected).toEqual({ id: 'p14', kind: 'point' });
    });
});

describe('selectedItem written by the page, in Edit mode', () => {
    test('a point: selected with Details open, no popup, no popup.open, the map eased to it', () => {
        const h = harness({ editMode: true });
        expect(h.ms.studioOn()).toBe(true);
        h.pageWrites('ctb1');
        expect(h.state().selected).toEqual({ id: 'ctb1', kind: 'point' });
        expect(h.state().panel).toBe('ctb1');
        expect(h.state().popup).toBeNull();
        expect(h.ms.popup!.isOpen()).toBe(false);
        expect(h.popupOpen).toEqual([]);
        expect(h.moves).toEqual(['easeTo ' + CTB1.join(',')]);
        expect(selectedEvents(h)).toEqual(['ctb1']);
    });

    test('a line: selected with Details, fitted, no line popup', () => {
        const h = harness({ editMode: true });
        h.pageWrites('lswd');
        expect(h.state().selected).toEqual({ id: 'lswd', kind: 'line', segment: null });
        expect(h.state().panel).toBe('lswd');
        expect(h.state().popup).toBeNull();
        expect(h.popupOpen).toEqual([]);
        expect(h.moves[0]).toMatch(/^fitBounds /);
    });

    test('with a tool in hand the write waits, the drawing untouched; the latest is applied when the tool goes down', () => {
        const h = harness({ editMode: true });
        const drawing = { tool: 'line' as const, featureId: 7, vertices: [CTB1, BEND] as Array<[number, number]>, snaps: [null, null], reason: '' };
        h.ms.state = { ...h.ms.state, studio: pickTool(h.ms.state.studio, 'line', null), drawing };
        h.pageWrites('p14');
        h.pageWrites('ctb1');
        expect(h.state().selected).toBeNull();
        expect(h.state().drawing).toBe(drawing);
        expect(h.state().studio.tool).toBe('line');
        expect(h.moves).toEqual([]);
        expect(selectedEvents(h)).toEqual([]);
        // The tool put down (Esc, Select): the next update applies the page's latest choice.
        h.ms.state = { ...h.ms.state, ...h.ms.toolState(h.ms.state, null, null) };
        applyPageSelection(h.ms);
        expect(h.state().selected).toEqual({ id: 'ctb1', kind: 'point' });
        expect(h.state().panel).toBe('ctb1');
        expect(selectedEvents(h)).toEqual(['ctb1']);
    });

    test('null closes Details', () => {
        const h = harness({ editMode: true });
        h.pageWrites('ctb1');
        h.pageWrites(null);
        expect(h.state().selected).toBeNull();
        expect(h.state().panel).toBeNull();
    });

    test('editMode and selectedItem written together: the item is chosen once Edit mode is in force, with Details and no popup', () => {
        // componentDidUpdate's other steps (the layers, the tools, the starting area) have nothing to do here.
        jest.spyOn(basemapLayer, 'applyBasemap').mockImplementation(() => undefined);
        jest.spyOn(itemsLayer, 'drawItems').mockImplementation(() => undefined);
        jest.spyOn(itemsLayer, 'dropQueuedFeatures').mockImplementation(() => undefined);
        jest.spyOn(editingModule, 'applyEditing').mockImplementation(() => undefined);
        jest.spyOn(editingModule, 'applyHandles').mockImplementation(() => undefined);
        jest.spyOn(cameraModule, 'applyStartingArea').mockImplementation(() => undefined);
        const h = harness();
        (h.ms.map as unknown as { addControl: () => void }).addControl = (): void => undefined;
        expect(h.ms.studioOn()).toBe(false);
        // As React does inside componentDidUpdate: the mode's setState lands on the next render.
        h.defer();
        h.pageWritesProps({ editMode: true, selectedItem: 'ctb1' });
        expect(h.state().selected).toBeNull();
        expect(h.state().popup).toBeNull();
        expect(h.popupOpen).toEqual([]);
        h.flush();
        expect(h.ms.studioOn()).toBe(true);
        expect(h.state().selected).toEqual({ id: 'ctb1', kind: 'point' });
        expect(h.state().panel).toBe('ctb1');
        expect(h.state().popup).toBeNull();
        expect(h.popupOpen).toEqual([]);
        expect(h.moves).toEqual(['easeTo ' + CTB1.join(',')]);
    });
});

describe('the viewport prop and onViewportChanged', () => {
    const written = (h: Harness): unknown[] => h.props.filter(([key]) => key === 'viewport').map(([, v]) => v);
    const fired = (h: Harness): unknown[] => h.events.filter(([name]) => name === VIEWPORT_CHANGED_EVENT).map(([, v]) => v);

    test('nothing before the map first settles; then the same object written and fired once the moves settle, if it changed', () => {
        const h = harness();
        h.moveTo([-104.98, 39.74], 13);
        jest.advanceTimersByTime(VIEWPORT_SETTLE_MS);
        expect(written(h)).toEqual([]);
        publishViewport(h.ms, h.ms.map!, true);
        expect(written(h).length).toBe(1);
        // A pan: one write once it has settled, none before.
        h.moveTo([-104.97, 39.75], 14.256);
        jest.advanceTimersByTime(VIEWPORT_SETTLE_MS - 1);
        expect(written(h).length).toBe(1);
        jest.advanceTimersByTime(1);
        expect(written(h).length).toBe(2);
        // A move end that leaves the same view writes nothing.
        h.moveTo([-104.97, 39.75], 14.256);
        jest.advanceTimersByTime(VIEWPORT_SETTLE_MS);
        expect(written(h).length).toBe(2);
        expect(fired(h)).toEqual(written(h));
        expect(written(h)[1]).toEqual({ center: [-104.97, 39.75], zoom: 14.26, bounds: [[-105.0383, 39.715], [-104.9017, 39.785]] });
        expect(h.ms.mapContainer!.getAttribute('data-viewport')).toBe(JSON.stringify(written(h)[1]));
    });

    test('a burst of move ends (a continuous resize, one per frame) gives one write and one event, of where it settled', () => {
        const h = harness();
        publishViewport(h.ms, h.ms.map!, true);
        for (let i = 1; i <= 30; i++) {
            h.moveTo([-104.98 + i * 0.0001, 39.74], 13);
            jest.advanceTimersByTime(16);
        }
        expect(written(h).length).toBe(1);
        jest.advanceTimersByTime(VIEWPORT_SETTLE_MS);
        expect(written(h).length).toBe(2);
        expect(fired(h).length).toBe(2);
        expect((written(h)[1] as { center: number[] }).center).toEqual([-104.977, 39.74]);
        jest.advanceTimersByTime(VIEWPORT_SETTLE_MS * 5);
        expect(written(h).length).toBe(2);
    });
});

describe('onPopupOpen and onPopupClose beside popup.open and popup.close (the delegate)', () => {
    test('each message sent to the Gateway is told to the page: a line\'s segment, null for a point, the close by id', () => {
        const fired: Array<[string, unknown]> = [];
        const store = { componentEvents: { fireComponentEvent: (name: string, payload: unknown): void => { fired.push([name, payload]); } } };
        const delegate = new MapStudioStoreDelegate(store as unknown as AbstractUIElementStore);
        try {
            delegate.sendPopupOpen('lswd', { fromId: 'pt1', toId: 'pt2' });
            delegate.sendPopupOpen('lswd', { fromId: 'ctb1', toId: 'pt1' });
            delegate.sendPopupOpen('p14');
            delegate.sendPopupClose('p14');
            expect(fired).toEqual([
                [POPUP_OPEN_EVENT, { itemId: 'lswd', segment: { fromId: 'pt1', toId: 'pt2' } }],
                [POPUP_OPEN_EVENT, { itemId: 'lswd', segment: { fromId: 'ctb1', toId: 'pt1' } }],
                [POPUP_OPEN_EVENT, { itemId: 'p14', segment: null }],
                [POPUP_CLOSE_EVENT, { itemId: 'p14' }]
            ]);
            const sent = (delegate as unknown as { fired: Array<{ type: string }> }).fired.map((m) => m.type);
            expect(sent).toEqual([MessageTypes.POPUP_OPEN, MessageTypes.POPUP_OPEN, MessageTypes.POPUP_OPEN, MessageTypes.POPUP_CLOSE]);
            expect(MESSAGE_EVENT).toBe('mapstudio.message');
        } finally {
            delegate.stopReplay();
        }
    });

    test('a store with no component events: the Gateway is still told, one warning per event and nothing else', () => {
        const delegate = new MapStudioStoreDelegate({} as unknown as AbstractUIElementStore);
        try {
            delegate.sendPopupOpen('p14');
            delegate.sendPopupClose('p14');
            expect((delegate as unknown as { fired: unknown[] }).fired.length).toBe(2);
            expect(warn).toHaveBeenCalledTimes(2);
        } finally {
            delegate.stopReplay();
        }
    });
});

describe('onSelectionChanged (entry 8)', () => {
    test('the event name matches MapStudioComponent.EVENT_SELECTION_CHANGED', () => {
        expect(SELECTION_CHANGED_EVENT).toBe('onSelectionChanged');
    });
});
