import {
    MAP_ITEM_PARAM,
    fallbackText,
    isFailedViewState,
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
