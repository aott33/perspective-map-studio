// The item list's sources in the store delegate (epic 4 entry 7a): map.load's `changed` (who last changed each item and when,
// phone and full only), this session's own saves setting it (the session user, now), and Just added: the items this session's
// tools add, newest first, an add undone leaving it. The delegate is driven as the Gateway would, as in deleteItem.test.ts.

jest.mock('@inductiveautomation/perspective-client', () => ({
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
    }
}), { virtual: true });

import { AbstractUIElementStore } from '@inductiveautomation/perspective-client';
import { Kind } from '../adapters';
import { EditBatch, readChanged, readMapLoadReply } from '../contract';
import { MESSAGE_EVENT, MessageTypes } from '../messages';
import { MapStudioStoreDelegate } from '../MapStudioStoreDelegate';

const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] };
const LINE: Kind = { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 0, fields: [] };
const OTHER = '99999999-9999-4999-8999-999999999999';

interface Sent {
    id: string;
    type: string;
    body: EditBatch;
}

let delegate: MapStudioStoreDelegate;
let seq = 0;

function fired(): Sent[] {
    return (delegate as unknown as { fired: Sent[] }).fired;
}

function last(): Sent {
    const all = fired().filter((m) => m.type === MessageTypes.EDITS_APPLY);
    return all[all.length - 1];
}

function save(message: Sent): void {
    seq++;
    delegate.handleEvent(MESSAGE_EVENT, {
        v: 1, type: MessageTypes.EDITS_APPLY_REPLY, id: message.id,
        body: { batchId: message.body.batchId, seq, results: message.body.ops.map((op) => ({ entity: op.entity, id: op.id, version: op.baseVersion + 1 })) }
    });
}

function load(body: Record<string, unknown>): void {
    delegate.sendMapLoad();
    const loads = fired().filter((m) => m.type === MessageTypes.MAP_LOAD);
    delegate.handleEvent(MESSAGE_EVENT, { v: 1, type: MessageTypes.MAP_LOAD_REPLY, id: loads[loads.length - 1].id,
        body: { level: 'full', seq: 0, items: [], ...body } });
}

beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-08T10:42:07.512Z'));
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    delegate = new MapStudioStoreDelegate({} as unknown as AbstractUIElementStore);
});

afterEach(() => {
    delegate.stopReplay();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('map.load.reply changed (contract 0.4.0)', () => {
    test('read as {itemId: {actor, at}}, malformed entries left out; absent when not sent', () => {
        expect(readChanged({ a: { actor: 'sam', at: '2026-11-08T10:42:00Z' }, b: { actor: 1, at: 'x' }, c: { actor: 'x', at: 'nonsense' },
            d: 'no' })).toEqual({ a: { actor: 'sam', at: '2026-11-08T10:42:00Z' } });
        expect(readChanged(undefined)).toBeNull();
        expect(readChanged([])).toBeNull();
        expect(readMapLoadReply({ level: 'none', seq: 0, items: [] })!.changed).toBeUndefined();
        expect(readMapLoadReply({ level: 'full', seq: 0, items: [], changed: { a: { actor: 'sam', at: '2026-11-08T10:42:00Z' } } })!.changed)
            .toEqual({ a: { actor: 'sam', at: '2026-11-08T10:42:00Z' } });
    });
});

describe('the delegate keeps changed and Just added (entry 7a)', () => {
    test('changed comes from map.load, and this session\'s saves set it to the session user, now, to the second', () => {
        expect(delegate.mapStateToProps().changed).toEqual({});
        load({ user: 'mapeditor', changed: { [OTHER]: { actor: 'sam', at: '2026-11-07T09:15:00Z' } } });
        expect(delegate.mapStateToProps().changed).toEqual({ [OTHER]: { actor: 'sam', at: '2026-11-07T09:15:00Z' } });
        const pad = delegate.createPoint([-103.5, 31.9], PAD);
        expect(delegate.mapStateToProps().changed[pad]).toBeUndefined();
        save(last());
        expect(delegate.mapStateToProps().changed[pad]).toEqual({ actor: 'mapeditor', at: '2026-11-08T10:42:07Z' });
        // A reload takes the Gateway's word again (another editor's changes as of that load).
        load({ changed: {} });
        expect(delegate.mapStateToProps().changed).toEqual({});
    });

    test('each add heads Just added, newest first; undoing an add leaves it; a reload of the page starts empty', () => {
        load({ user: 'mapeditor' });
        const pad = delegate.createPoint([-103.5, 31.9], PAD);
        save(last());
        const line = delegate.createLine([[-103.5, 31.9], [-103.4, 31.95]], LINE, null);
        save(last());
        expect(delegate.mapStateToProps().justAdded).toEqual([line, pad]);
        // An edit of an added item keeps it where it is.
        delegate.renameItem(pad, 'P31');
        save(last());
        expect(delegate.mapStateToProps().justAdded).toEqual([line, pad]);
        delegate.undo();
        save(last());
        delegate.undo();
        save(last());
        expect(last().body.ops).toEqual([expect.objectContaining({ op: 'delete', id: line })]);
        expect(delegate.mapStateToProps().justAdded).toEqual([pad]);
        // Redo of the undone add creates the line again: it is back in Just added (entry 7a's review).
        delegate.redo();
        expect(last().body.ops).toEqual([expect.objectContaining({ op: 'create', id: line })]);
        save(last());
        expect(delegate.mapStateToProps().justAdded).toEqual([line, pad]);
        delegate.undo();
        save(last());
        expect(delegate.mapStateToProps().justAdded).toEqual([pad]);
        // A map.load (a gap, a reconnect) keeps the session's Just added: only the page's reload clears it.
        load({});
        expect(delegate.mapStateToProps().justAdded).toEqual([pad]);
        expect(new MapStudioStoreDelegate({} as unknown as AbstractUIElementStore).mapStateToProps().justAdded).toEqual([]);
    });
});
