import { LiveValue } from '../live';
import {
    MAP_ITEM_PARAM,
    fillLink,
    fillParams,
    isFailedViewState,
    isSheetWidth,
    popupItemView,
    popupMaxHeight,
    popupMaxWidth,
    popupMountPath,
    popupViewParams
} from '../popupParams';

const P1 = { id: 'p1', name: 'Point 1', kind: 'pad', assetId: 'P12', properties: { operator: 'Acme', wells: 12 } };
const ITEM = popupItemView(P1, '[default]Mesa/P12');
const NO_ASSET = popupItemView({ id: 'p9', name: 'Pad 9', kind: 'pad', assetId: null, properties: {} }, null);
const good = (value: unknown): LiveValue => ({ value, quality: 'Good', t: null, stale: false, reason: '' });

describe('popupMountPath', () => {
    test('hangs below the component address the way the built-in Map does', () => {
        expect(popupMountPath('P', '0.1')).toBe('P$0.1[popup]');
    });
});

describe('popupItemView', () => {
    test('is the item and its base path, with null for a missing asset or properties', () => {
        expect(ITEM).toEqual({ itemId: 'p1', itemName: 'Point 1', assetId: 'P12', assetPath: '[default]Mesa/P12',
            properties: { operator: 'Acme', wells: 12 } });
        expect(popupItemView({ id: 'x', name: 'X' }, null)).toEqual({ itemId: 'x', itemName: 'X', assetId: null, assetPath: null, properties: {} });
    });
});

describe('fillParams (AD-7, epic 3 entry 8)', () => {
    test('a literal, one placeholder and {asset.path}/<suffix> fill from the item', () => {
        expect(fillParams({ area: 'Mesa', padName: '{item.name}', tagPath: '{asset.path}', pressure: '{asset.path}/Pressure',
            op: '{item.properties.operator}', wells: '{item.properties.wells}' }, ITEM))
            .toEqual({ area: 'Mesa', padName: 'Point 1', tagPath: '[default]Mesa/P12', pressure: '[default]Mesa/P12/Pressure',
                op: 'Acme', wells: '12' });
    });

    test('a param whose placeholder has no value is left out; mapItem is never an author param', () => {
        expect(fillParams({ padName: '{item.name}', pressure: '{asset.path}/Pressure', op: '{item.properties.operator}' }, NO_ASSET))
            .toEqual({ padName: 'Pad 9' });
        expect(fillParams({ [MAP_ITEM_PARAM]: 'nope', a: 'b' }, ITEM)).toEqual({ a: 'b' });
        expect(fillParams(null, ITEM)).toEqual({});
        expect(fillParams(undefined, ITEM)).toEqual({});
    });

    test('does not change the template object', () => {
        const params = { padName: '{item.name}' };
        fillParams(params, ITEM);
        expect(params).toEqual({ padName: '{item.name}' });
    });
});

describe('fillLink (R8)', () => {
    test('fills a page path from the item', () => {
        expect(fillLink('/pad/{item.name}', ITEM)).toBe('/pad/Point 1');
        expect(fillLink('/alarms/{asset.id}', ITEM)).toBe('/alarms/P12');
    });

    test('is null, so the icon hides, with no template, a placeholder with no value, or a filled path that is not a page path', () => {
        expect(fillLink('', ITEM)).toBeNull();
        expect(fillLink(null, ITEM)).toBeNull();
        expect(fillLink(undefined, ITEM)).toBeNull();
        expect(fillLink('/pad/{asset.id}', NO_ASSET)).toBeNull();
        expect(fillLink('/pad/{item.properties.nope}', ITEM)).toBeNull();
        const tricky = popupItemView({ id: 'p1', name: 'Point 1', assetId: null, properties: { page: '//evil.example/x' } }, null);
        expect(fillLink('{item.properties.page}', tricky)).toBeNull();
        expect(fillLink('{item.properties.page}', popupItemView({ id: 'p1', name: 'x', assetId: null, properties: { page: 'pad' } }, null))).toBeNull();
    });
});

describe('popupViewParams', () => {
    test('passes the map item object as mapItem beside the filled params', () => {
        const values = { id: 'p1', comms: good(true), kpis: { pressure: good(412) }, alarms: good({ active: 0, unacked: 0, priority: 0 }), problems: [] };
        expect(popupViewParams({ padName: 'Point 1' }, P1, { basePath: '[default]Mesa/P12', alarmsPath: '[default]Mesa/P12' }, values)).toEqual({
            padName: 'Point 1',
            mapItem: {
                id: 'p1', name: 'Point 1', kind: 'pad', assetId: 'P12', properties: { operator: 'Acme', wells: 12 },
                basePath: '[default]Mesa/P12', alarmsPath: '[default]Mesa/P12',
                values: { comms: good(true), kpis: { pressure: good(412) }, alarms: good({ active: 0, unacked: 0, priority: 0 }) }
            }
        });
    });

    test('mapItem wins over a param of the same name; no detail and no values give nulls', () => {
        const params = popupViewParams({ [MAP_ITEM_PARAM]: 'nope', other: 1 }, { id: 'p1', name: 'Point 1' }, null, undefined);
        expect(params.other).toBe(1);
        expect(params.mapItem).toEqual({ id: 'p1', name: 'Point 1', kind: '', assetId: null, properties: {}, basePath: null, alarmsPath: null,
            values: { comms: null, kpis: {}, alarms: null } });
        expect(popupViewParams(null, { id: 'p1', name: 'Point 1' }, null, undefined).mapItem).toBeDefined();
    });
});

describe('isFailedViewState', () => {
    test('notFound, error and access-denied fall back', () => {
        expect(isFailedViewState('notFound')).toBe(true);
        expect(isFailedViewState('error')).toBe(true);
        expect(isFailedViewState('access-denied')).toBe(true);
    });

    test('loading, notSpecified and valid do not', () => {
        expect(isFailedViewState('loading')).toBe(false);
        expect(isFailedViewState('notSpecified')).toBe(false);
        expect(isFailedViewState('valid')).toBe(false);
    });
});

describe('popupMaxWidth', () => {
    test('is the card width (popup-width 320, D1) on a desktop map', () => {
        expect(popupMaxWidth(700, 1440)).toBe('320px');
    });

    test('fits centred on a point left of a narrow map centre', () => {
        expect(popupMaxWidth(143, 390)).toBe('270px');
    });

    test('never narrower than the narrowest, so MapLibre anchors it beside a point at the edge', () => {
        expect(popupMaxWidth(30, 390)).toBe('220px');
        expect(popupMaxWidth(380, 390)).toBe('220px');
    });

    test('never wider than the map less a margin each side', () => {
        expect(popupMaxWidth(150, 300)).toBe('268px');
        expect(popupMaxWidth(100, 200)).toBe('168px');
    });
});

describe('popupMaxHeight (popup-max-height 480, D1; P3)', () => {
    test('is 480 on a tall map, the map less 64 on a short one, never under 160', () => {
        expect(popupMaxHeight(900)).toBe(480);
        expect(popupMaxHeight(544)).toBe(480);
        expect(popupMaxHeight(400)).toBe(336);
        expect(popupMaxHeight(100)).toBe(160);
    });
});

describe('isSheetWidth', () => {
    test('below 768 px the popup is a bottom sheet', () => {
        expect(isSheetWidth(390)).toBe(true);
        expect(isSheetWidth(767)).toBe(true);
        expect(isSheetWidth(768)).toBe(false);
        expect(isSheetWidth(1440)).toBe(false);
    });
});
