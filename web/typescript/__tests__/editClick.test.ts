// In Edit mode a click selects and opens Details, no popup (epic 4 entry 26, the owner's choice A; EXPERIENCE.md Select): on the
// component itself (MapStudio with its selection.tsx and editing.ts paths), its libraries stubbed. In Edit mode (level `full`, 768 px
// and wider) a marker click selects the point with Details open and sends the point click round trip but no popup.open; a line
// click selects the line with Details and no line popup; a shared marker still opens its pick list, whose row selects and opens
// Details; the restore of a remembered popup opens Details. The Edit switch turned on closes an open popup (popup.close sent) or
// pick list. Esc with the Line or the Point tool in hand puts it down and Details stays (the map container's capture listener
// marks the press handled, so the component's own Esc skips it); a second Esc closes Details. View mode's clicks open the popups
// as before.

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
import { LAYER_ITEM_MARKERS } from '../mapLayers';
import { MapStudio, MapStudioState } from '../MapStudio';
import { applyRestore } from '../camera';
import { fromProps, pickTool } from '../studio';

const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] };
const LINE: Kind = { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [] };
const CTB1: [number, number] = [-105.012, 39.7262];
const BEND: [number, number] = [-105.009441, 39.720791];
const SWD1: [number, number] = [-104.983671, 39.715476];
const P14: [number, number] = [-104.97, 39.74];

function point(id: string, name: string, at: [number, number]): MapItemRecord {
    return { id, kind: 'pad', name, geometry: { type: 'Point', coordinates: at }, properties: {}, assetId: null, overrides: {}, ends: null,
        attachment: null, version: 3, deleted: false };
}

const ITEMS: MapItemRecord[] = [
    point('ctb1', 'CTB1', CTB1), point('p14', 'P14', P14), point('a', 'Pad A', SWD1), point('b', 'Pad B', SWD1),
    { id: 'lswd', kind: 'line', name: 'L-SWD', geometry: { type: 'LineString', coordinates: [CTB1, BEND, SWD1] }, properties: {}, assetId: null,
        overrides: {}, ends: null, attachment: null, version: 2, deleted: false }
];

/** A kind display with a custom popup view: both kinds would open a popup in View mode. */
function display(kindId: string): KindDisplay {
    return { kindId, comms: false, kpis: [], alarms: { on: false, count: false, summary: false }, link: '', popupView: { path: 'Popups/X', params: {} } };
}

interface Sent {
    pointClick: string[];
    popupOpen: string[];
    popupClose: string[];
    props: Array<[string, unknown]>;
}

/** What a MapLibre click on the map hits: the marker or line features `queryRenderedFeatures` returns, by layer. */
interface Hit {
    markers?: unknown[];
    lines?: unknown[];
}

interface Harness {
    ms: MapStudio;
    sent: Sent;
    /** The component's state after every update so far (setState applies at once here, as outside React's batching). */
    state(): MapStudioState;
    /** A click on the map at the place the map's stub reports as hit. */
    click(hit: Hit): void;
    /** The MapLibre popup as open (a card or the pick list shown in it): its remove fires the close event, as MapLibre's does. */
    openCard(): void;
}

function harness(editMode: boolean): Harness {
    const sent: Sent = { pointClick: [], popupOpen: [], popupClose: [], props: [] };
    const store = {
        delegate: {
            sendPointClick: (id: string): void => { sent.pointClick.push(id); },
            sendPopupOpen: (id: string): void => { sent.popupOpen.push(id); },
            sendPopupClose: (id: string): void => { sent.popupClose.push(id); }
        },
        props: { write: (key: string, value: unknown): void => { sent.props.push([key, value]); } }
    };
    const delegate = {
        level: 'full', items: ITEMS, editing: 'on', load: { state: 'loaded', message: '' }, unsaved: [], itemsRevision: 1,
        live: { ...LIVE_INITIAL, fulls: 1, display: { pad: display('pad'), line: display('line') } },
        lists: { kinds: [PAD, LINE], assets: [], assetNames: {} }
    };
    const props = { props: { editMode, startingArea: {}, previewStyles: false, selectedItem: null }, store, delegate } as unknown as
        ConstructorParameters<typeof MapStudio>[0];
    const ms = new MapStudio(props);
    // setState applied at once, as React does outside its own handlers (a MapLibre or native listener); the after-render callbacks
    // place a card in the DOM, which there is none of here.
    (ms as unknown as { setState: (update: unknown) => void }).setState = (update: unknown): void => {
        const next = typeof update === 'function' ? (update as (prev: MapStudioState) => Partial<MapStudioState> | null)(ms.state) : update;
        if (next) {
            ms.state = { ...ms.state, ...(next as Partial<MapStudioState>) };
        }
    };
    let hit: Hit = {};
    ms.map = {
        queryRenderedFeatures: (_at: unknown, opts: { layers: string[] }): unknown[] =>
            (opts.layers[0] === LAYER_ITEM_MARKERS ? hit.markers || [] : hit.lines || []),
        project: (): { x: number; y: number } => ({ x: 100, y: 100 }),
        getCanvas: () => ({ focus: (): void => undefined }),
        getContainer: () => ({ clientWidth: 1038, clientHeight: 700 })
    } as unknown as MapStudio['map'];
    return {
        ms, sent,
        state: () => ms.state,
        click: (h: Hit): void => {
            hit = h;
            (ms as unknown as { onMapClick: (ev: unknown) => void }).onMapClick({ point: { x: 100, y: 100 }, lngLat: { lng: CTB1[0], lat: CTB1[1] } });
        },
        openCard: (): void => {
            let open = true;
            ms.popup = {
                isOpen: (): boolean => open,
                remove: (): void => {
                    open = false;
                    ms.onPopupClosed();
                }
            } as unknown as MapStudio['popup'];
        }
    };
}

/** A marker feature as MapLibre gives it (the item's id, kind and name, a shared marker's members). */
function marker(id: string, name: string, at: [number, number], members: string[] = []): unknown {
    return { geometry: { type: 'Point', coordinates: at },
        properties: { id, kind: 'pad', name, members: members.length || 1, memberIds: members.join(',') } };
}

const LINE_HIT: Hit = { lines: [{ geometry: { type: 'LineString', coordinates: [CTB1, BEND] }, properties: { id: 'lswd', from: 'ctb1', to: 'x' } }] };

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
        h.click({ markers: [marker('ctb1', 'CTB1', CTB1)] });
        expect(h.state().selected).toEqual({ id: 'ctb1', kind: 'point' });
        expect(h.state().panel).toBe('ctb1');
        expect(h.state().popup).toBeNull();
        expect(h.state().pick).toBeNull();
        expect(h.sent.popupOpen).toEqual([]);
        expect(h.sent.pointClick).toEqual(['ctb1']);
    });

    test('a line: L-SWD selected with Details open (its handles are the selection\'s, entry 5), no line popup and no popup.open', () => {
        const h = harness(true);
        h.click(LINE_HIT);
        expect(h.state().selected).toEqual({ id: 'lswd', kind: 'line', segment: null });
        expect(h.state().panel).toBe('lswd');
        expect(h.state().popup).toBeNull();
        expect(h.sent.popupOpen).toEqual([]);
    });

    test('a click on another item moves Details to it; the ground clears the selection and closes Details, as today', () => {
        const h = harness(true);
        h.click({ markers: [marker('ctb1', 'CTB1', CTB1)] });
        h.click(LINE_HIT);
        expect(h.state().panel).toBe('lswd');
        h.click({});
        expect(h.state().selected).toBeNull();
        expect(h.state().panel).toBeNull();
        expect(h.sent.popupOpen).toEqual([]);
        expect(h.sent.popupClose).toEqual([]);
    });

    test('a shared spot still opens its pick list; a row selects that item and opens Details, no popup, the point click sent', () => {
        const h = harness(true);
        h.click({ markers: [marker('a', 'Pad A', SWD1, ['a', 'b'])] });
        expect(h.state().pick).not.toBeNull();
        expect(h.state().pick!.rows.map((r) => r.id)).toEqual(['a', 'b']);
        expect(h.state().popup).toBeNull();
        // The pick list shows in the MapLibre popup: the row's choice closes it.
        h.openCard();
        h.ms.onPick('b');
        expect(h.state().pick).toBeNull();
        expect(h.state().popup).toBeNull();
        expect(h.state().selected).toEqual({ id: 'b', kind: 'point' });
        expect(h.state().panel).toBe('b');
        expect(h.ms.popup!.isOpen()).toBe(false);
        expect(h.sent.popupOpen).toEqual([]);
        expect(h.sent.pointClick).toEqual(['b']);
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
});

describe('the Edit switch turned on closes an open popup or pick list (entry 26)', () => {
    test('P14\'s popup open in View mode: the switch on closes it and tells the Gateway with popup.close', () => {
        const h = harness(false);
        expect(h.ms.studioOn()).toBe(false);
        h.click({ markers: [marker('p14', 'P14', P14)] });
        expect(h.state().popup && h.state().popup!.point.id).toBe('p14');
        expect(h.sent.popupOpen).toEqual(['p14']);
        h.openCard();
        h.ms.onEditSwitch(true);
        expect(h.state().studio.mode).toBe('edit');
        expect(h.ms.studioOn()).toBe(true);
        expect(h.state().popup).toBeNull();
        expect(h.ms.popup!.isOpen()).toBe(false);
        expect(h.sent.popupClose).toEqual(['p14']);
        expect(h.sent.props).toEqual([['editMode', true]]);
    });

    test('a pick list open in View mode: the switch on closes it; with nothing open nothing is sent', () => {
        const h = harness(false);
        h.click({ markers: [marker('a', 'Pad A', SWD1, ['a', 'b'])] });
        expect(h.state().pick).not.toBeNull();
        h.openCard();
        h.ms.onEditSwitch(true);
        expect(h.state().pick).toBeNull();
        expect(h.sent.popupClose).toEqual([]);
        const quiet = harness(false);
        quiet.ms.onEditSwitch(true);
        expect(quiet.state().studio.mode).toBe('edit');
        expect(quiet.sent.popupClose).toEqual([]);
    });
});

describe('Esc with a tool in hand puts it down and nothing else (entry 26, deferred from entry 25)', () => {
    /** L-SWD in Details and the tool in hand, as the toolbar leaves it. */
    function withTool(tool: 'line' | 'area' | 'point'): Harness {
        const h = harness(true);
        h.click(LINE_HIT);
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
        h.click(LINE_HIT);
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
        h.click({ markers: [marker('ctb1', 'CTB1', CTB1)] });
        expect(h.state().popup && h.state().popup!.point.id).toBe('ctb1');
        expect(h.state().popup!.line).toBe(false);
        expect(h.state().panel).toBeNull();
        expect(h.sent.popupOpen).toEqual(['ctb1']);
        expect(h.sent.pointClick).toEqual(['ctb1']);
        h.click(LINE_HIT);
        expect(h.state().popup && h.state().popup!.point.id).toBe('lswd');
        expect(h.state().popup!.line).toBe(true);
        expect(h.state().panel).toBeNull();
        expect(h.sent.popupOpen).toEqual(['ctb1', 'lswd']);
    });

    test('Esc in View mode closes the open popup, as before', () => {
        const h = harness(false);
        h.click({ markers: [marker('ctb1', 'CTB1', CTB1)] });
        h.openCard();
        escape(h.ms);
        expect(h.state().popup).toBeNull();
        expect(h.sent.popupClose).toEqual(['ctb1']);
    });
});
