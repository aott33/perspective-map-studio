import { readMapLoadReply } from '../contract';
import {
    STORE_UNKNOWN, storeStateAttribute, storeStateFromError, storeStateFromLoad, storeStatusText
} from '../storeState';

describe('the map store state (epic 2 story 5)', () => {
    test('map.load.reply: ready, or read only with the reason', () => {
        const ready = readMapLoadReply({ level: 'full', seq: 0, items: [], readOnly: null });
        expect(ready).not.toBeNull();
        expect(ready && ready.readOnly).toBeUndefined();
        expect(storeStateFromLoad(ready!)).toEqual({ status: 'ready', reason: '' });

        const reason = 'This Gateway is the standby of a redundant pair; saving is off here.';
        const readOnly = readMapLoadReply({ level: 'full', seq: 2, items: [], readOnly: reason });
        expect(storeStateFromLoad(readOnly!)).toEqual({ status: 'read-only', reason });
        expect(storeStateAttribute(storeStateFromLoad(readOnly!))).toBe('read-only');
        expect(storeStatusText(storeStateFromLoad(readOnly!))).toBe('Map store: read only. ' + reason);
    });

    test('an older Gateway without readOnly reads as ready', () => {
        expect(storeStateFromLoad(readMapLoadReply({ level: 'none', seq: 0, items: [] })!).status).toBe('ready');
    });

    test('errors: store-unreachable is unavailable, read-only is read only, others keep the state', () => {
        const unavailable = storeStateFromError(STORE_UNKNOWN, { code: 'store-unreachable', message: 'The map store is unavailable.' });
        expect(storeStateAttribute(unavailable)).toBe('unavailable');
        expect(storeStatusText(unavailable)).toBe('Map store: The map store is unavailable.');
        const ready = { status: 'ready' as const, reason: '' };
        expect(storeStateFromError(ready, { code: 'read-only', message: 'saving is off' }))
            .toEqual({ status: 'read-only', reason: 'saving is off' });
        expect(storeStateFromError(ready, { code: 'role', message: 'no role' })).toBe(ready);
    });

    test('nothing is said before map.load answers or when ready', () => {
        expect(storeStateAttribute(STORE_UNKNOWN)).toBe('');
        expect(storeStatusText(STORE_UNKNOWN)).toBe('');
        expect(storeStatusText({ status: 'ready', reason: '' })).toBe('');
    });
});
