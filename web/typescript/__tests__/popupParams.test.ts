import {
    MAP_ITEM_PARAM,
    fallbackText,
    isFailedViewState,
    linePopupPlacement,
    popupMaxWidth,
    popupMountPath,
    popupViewParams
} from '../popupParams';

const P1 = { id: 'p1', name: 'Point 1' };

describe('popupMountPath', () => {
    test('hangs below the component address the way the built-in Map does', () => {
        expect(popupMountPath('P', '0.1')).toBe('P$0.1[popup]');
    });
});

describe('popupViewParams', () => {
    test('passes the point as mapItem beside the author params', () => {
        expect(popupViewParams({ source: 'dev' }, P1)).toEqual({
            source: 'dev',
            mapItem: { id: 'p1', name: 'Point 1' }
        });
    });

    test('mapItem wins over an author key of the same name', () => {
        const params = popupViewParams({ [MAP_ITEM_PARAM]: 'nope', other: 1 }, P1);
        expect(params.mapItem).toEqual({ id: 'p1', name: 'Point 1' });
        expect(params.other).toBe(1);
    });

    test('an empty, null or undefined author object gives mapItem alone', () => {
        expect(popupViewParams({}, P1)).toEqual({ mapItem: { id: 'p1', name: 'Point 1' } });
        expect(popupViewParams(null, P1)).toEqual({ mapItem: { id: 'p1', name: 'Point 1' } });
        expect(popupViewParams(undefined, P1)).toEqual({ mapItem: { id: 'p1', name: 'Point 1' } });
    });

    test('does not change the author object', () => {
        const author = { source: 'dev' };
        popupViewParams(author, P1);
        expect(author).toEqual({ source: 'dev' });
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

describe('fallbackText', () => {
    test('shows the id and the name', () => {
        expect(fallbackText(P1)).toBe('p1 - Point 1');
    });

    test('shows the id alone without a name', () => {
        expect(fallbackText({ id: 'p9', name: '' })).toBe('p9');
    });
});

describe('popupMaxWidth', () => {
    test('is the stylesheet widest on a desktop map', () => {
        expect(popupMaxWidth(700, 1440)).toBe('320px');
    });

    test('fits centred on a point left of a phone map centre', () => {
        // Point 1 at the tracer view on a 390 px phone: 2 * 143 - 16 = 270 px, centred, stays inside.
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

describe('linePopupPlacement', () => {
    it('puts the card above the point when it fits there', () => {
        expect(linePopupPlacement(600, 850, 440, 22)).toEqual({ anchor: 'bottom', maxHeight: 480 });
    });
    it('puts it below when only that side has the room', () => {
        expect(linePopupPlacement(200, 850, 440, 22)).toEqual({ anchor: 'top', maxHeight: 480 });
    });
    it('clamps it to the larger side when neither fits, so it never leaves the map', () => {
        expect(linePopupPlacement(235, 471, 460, 22)).toEqual({ anchor: 'top', maxHeight: 198 });
        expect(linePopupPlacement(240, 471, 460, 22)).toEqual({ anchor: 'bottom', maxHeight: 202 });
    });
    it('never exceeds 480 px or the map less 64 px', () => {
        expect(linePopupPlacement(600, 2000, 900, 22).maxHeight).toBe(480);
        expect(linePopupPlacement(300, 400, 900, 22).maxHeight).toBe(262);
    });
    it('keeps a floor for a point hard against an edge', () => {
        expect(linePopupPlacement(5, 300, 460, 22)).toEqual({ anchor: 'top', maxHeight: 236 });
        expect(linePopupPlacement(5, 100, 460, 22).maxHeight).toBe(120);
    });
});
