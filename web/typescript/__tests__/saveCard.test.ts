// The save problems' card (epic 4 entry 10, R26): the conflict kept on the queued entry with the records my ops started from,
// the other editor's change and mine in words, Apply mine on top's rebased batch, which card shows (unreachable, then the
// conflicts oldest first with "1 of 2", then busy), and the card's markup.
import { METRIC_UNITS } from '../geometry';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Kind } from '../adapters';
import { Conflict, EditBatch, MapItemRecord } from '../contract';
import { updateBatch } from '../save';
import {
    KeyValueStore, SaveCardData, UnsavedEntry, UnsavedQueue, clockText, compassWord, dismissKey, moveWords, onTopBatch, onTopBlockedText, readEntries,
    saveCardFor, storageKey, theirChangeText, yourChangeText
} from '../unsaved';
import { SaveCard, showEditsText, useTheirsText } from '../studio/SaveCard';

class FakeStore implements KeyValueStore {
    data = new Map<string, string>();
    getItem(key: string): string | null {
        return this.data.has(key) ? this.data.get(key) as string : null;
    }
    setItem(key: string, value: string): void {
        this.data.set(key, value);
    }
    removeItem(key: string): void {
        this.data.delete(key);
    }
}

const PAD: Kind = {
    id: 'pad', name: 'Well pad', geometry: 'point', icon: '', labelRank: 0,
    fields: [
        { key: 'labelPosition', label: 'label position', type: 'choice', required: false, choices: ['Left', 'Right'] },
        { key: 'gasRate', label: 'Gas rate', type: 'boolean', required: false, choices: [] },
        { key: 'road', label: 'Access road note', type: 'text', required: false, choices: [] }
    ]
};
const KINDS = [PAD];
const BUSY = 'Map Studio is busy with other map requests; nothing was saved. Try again in a moment.';
// 40 m north of P14 (a degree of latitude is about 111.2 km).
const P14_AT: [number, number] = [-103.8689, 32.2297];
const P14_NORTH: [number, number] = [-103.8689, 32.2297 + 40 / 111_195];
// 10:42 on the browser's own clock, whatever its zone.
const AT_1042 = new Date(2026, 10, 9, 10, 42, 0).toISOString();

function pad(over: Partial<MapItemRecord> = {}): MapItemRecord {
    return {
        id: 'p14', kind: 'pad', name: 'P14', geometry: { type: 'Point', coordinates: P14_AT }, properties: { road: 'Gate code' },
        assetId: null, overrides: {}, ends: null, attachment: null, version: 3, deleted: false, ...over
    };
}

function conflictOf(current: MapItemRecord | null, over: Partial<Conflict> = {}): Conflict {
    return { index: 0, entity: 'item', id: 'p14', baseVersion: 3, current, changedBy: 'Sam', changedAt: AT_1042, ...over };
}

/** My edit of P14 (label position Right, Gas rate on), refused for Sam's change. */
function mine(current: MapItemRecord | null, over: Partial<UnsavedEntry> = {}, batch?: EditBatch): UnsavedEntry {
    const b = batch || updateBatch('p14', 'batch-mine', 3, { properties: { road: 'Gate code', labelPosition: 'Right', gasRate: true } });
    return {
        batchId: b.batchId, batch: b, queuedAt: '2026-11-09T10:40:00Z', state: 'refused',
        reason: { code: 'conflict', message: 'P14 was changed by Sam at 10:42 UTC since you loaded it. Nothing in this save was written.', changedBy: 'Sam' },
        conflict: [conflictOf(current)], before: [pad()], ...over
    };
}

function busy(n: number): UnsavedEntry {
    const b = updateBatch('p14', 'batch-busy-' + n, 3, { properties: { road: 'Gate code', labelPosition: 'Right' } });
    return { batchId: b.batchId, batch: b, queuedAt: '2026-11-09T10:40:0' + n + 'Z', state: 'unsent', reason: { code: 'store-unreachable', message: BUSY },
        before: [pad()] };
}

function card(over: { unsaved: UnsavedEntry[]; paused?: boolean; dismissed?: string[] }): SaveCardData | null {
    return saveCardFor({ unsaved: over.unsaved, paused: !!over.paused, dismissed: over.dismissed || [], records: [pad()], kinds: KINDS, distanceUnits: METRIC_UNITS });
}

describe('the words', () => {
    test('a time on the browser\'s clock, a compass word and a move', () => {
        expect(clockText(AT_1042)).toBe('10:42');
        expect(clockText(null)).toBe('');
        expect(clockText('not a time')).toBe('');
        expect(compassWord(P14_AT, P14_NORTH)).toBe('north');
        expect(compassWord(P14_AT, [P14_AT[0] - 0.001, P14_AT[1] - 0.001])).toBe('south-west');
        expect(moveWords(P14_AT, P14_NORTH)).toBe('about 40 m north');
        expect(moveWords(P14_AT, P14_NORTH, { system: 'us', labels: 'short' })).toBe('about 130 ft north');
        expect(moveWords(P14_AT, P14_AT)).toBe('a little');
    });

    test('their change: a moved point as distance and compass word, the fields they changed, else changed at the time', () => {
        expect(theirChangeText(mine(pad({ version: 4, geometry: { type: 'Point', coordinates: P14_NORTH } })), KINDS))
            .toBe('Sam moved P14 about 40 m north at 10:42');
        expect(theirChangeText(mine(pad({ version: 4, name: 'P14 east', properties: { road: 'New gate', gasRate: false } })), KINDS))
            .toBe("Sam changed P14 east's name, Access road note and Gas rate at 10:42");
        expect(theirChangeText(mine(pad({ version: 4, geometry: { type: 'Point', coordinates: P14_NORTH }, assetId: 'a1' })), KINDS))
            .toBe('Sam moved P14 about 40 m north and changed its asset link at 10:42');
        // An entry queued before entry 10 has no `before`: the item and the time only.
        expect(theirChangeText(mine(pad({ version: 4 }), { before: undefined }), KINDS)).toBe('Sam changed P14 at 10:42');
        expect(theirChangeText(mine(pad({ version: 4 }), {}, undefined), KINDS)).toBe('Sam changed P14 at 10:42');
        expect(theirChangeText(mine(pad({ version: 4, deleted: true })), KINDS)).toBe('Sam deleted P14 at 10:42');
        expect(theirChangeText(mine(pad({ version: 4 }), { conflict: [conflictOf(pad({ version: 4 }), { changedBy: null, changedAt: null })],
            reason: { code: 'conflict', message: 'm' } }), KINDS)).toBe('Another editor changed P14');
    });

    test('my change: the fields I changed from where I started, the name first on the busy card; an add as Undo names it', () => {
        const entry = mine(pad({ version: 4 }));
        expect(yourChangeText(entry, [pad()], KINDS)).toBe('label position Right, Gas rate switched on');
        expect(yourChangeText(busy(1), [pad()], KINDS, METRIC_UNITS, true)).toBe('P14 label position Right');
        const moved = updateBatch('p14', 'b-move', 3, { geometry: { type: 'Point', coordinates: P14_NORTH } });
        expect(yourChangeText(mine(null, {}, moved), [pad()], KINDS)).toBe('moved about 40 m north');
        const create: EditBatch = { batchId: 'b-add', ops: [{ op: 'create', entity: 'item', id: 'p99', baseVersion: 0,
            data: { kind: 'pad', name: 'P99', geometry: { type: 'Point', coordinates: P14_AT } } }] };
        expect(yourChangeText(mine(null, { before: undefined }, create), [], KINDS)).toBe('Add P99');
    });
});

describe('an override in the cards\' words (entry 12c1)', () => {
    const labels = (kind: string, key: string) => (kind === 'pad' && key === 'pressure' ? 'Pressure' : undefined);
    const OVER = { kpis: [{ key: 'pressure', path: '[default]Mesa/P12/Pressure' }] };

    test('a key value is named by its label, from the lookup the card is given; by its key without one', () => {
        const batch = updateBatch('p14', 'batch-over', 3, { overrides: OVER });
        const entry = mine(pad({ version: 4, overrides: { kpis: [{ key: 'pressure', path: '[default]Mesa/P15/Pressure' }], comms: { path: '[default]c' } } }), {}, batch);
        expect(yourChangeText(entry, [pad()], KINDS, METRIC_UNITS, false, labels)).toBe('Pressure path [default]Mesa/P12/Pressure');
        expect(yourChangeText(entry, [pad()], KINDS)).toBe('pressure path [default]Mesa/P12/Pressure');
        expect(theirChangeText(entry, KINDS, METRIC_UNITS, [], labels)).toBe("Sam changed P14's comms path and Pressure path at 10:42");
        const shown = saveCardFor({ unsaved: [entry], paused: false, dismissed: [], records: [pad()], kinds: KINDS, distanceUnits: METRIC_UNITS, kpiLabel: labels });
        expect(shown && shown.kept).toBe('Your change, kept here and not saved: Pressure path [default]Mesa/P12/Pressure.');
        expect(shown && shown.text).toContain("Sam changed P14's comms path and Pressure path at 10:42");
    });
});

describe('Apply mine on top', () => {
    test('a new batch at the stored version: my keys merged onto theirs, the stored entry untouched', () => {
        const theirs = pad({ version: 4, properties: { road: 'New gate' } });
        const entry = mine(theirs);
        const batch = onTopBatch(entry, 'batch-new') as EditBatch;
        expect(batch.batchId).toBe('batch-new');
        expect(batch.ops).toEqual([{ op: 'update', entity: 'item', id: 'p14', baseVersion: 4,
            data: { properties: { road: 'New gate', labelPosition: 'Right', gasRate: true } } }]);
        expect(entry.batch.ops[0].baseVersion).toBe(3);
        // Without `before` my op's data goes as it is, at the stored version.
        const plain = onTopBatch(mine(theirs, { before: undefined }), 'b2') as EditBatch;
        expect(plain.ops[0]).toMatchObject({ baseVersion: 4, data: { properties: { road: 'Gate code', labelPosition: 'Right', gasRate: true } } });
    });

    test('not offered when they deleted it or my add met one that exists, with the reason in words', () => {
        const deleted = mine(pad({ version: 4, deleted: true }));
        expect(onTopBatch(deleted, 'x')).toBeNull();
        expect(onTopBlockedText(deleted)).toBe('It was deleted, so your change cannot go on top of it.');
        const create: EditBatch = { batchId: 'b-add', ops: [{ op: 'create', entity: 'item', id: 'p14', baseVersion: 0,
            data: { kind: 'pad', name: 'P14', geometry: { type: 'Point', coordinates: P14_AT } } }] };
        const exists = mine(pad({ version: 1 }), { before: undefined }, create);
        expect(onTopBatch(exists, 'x')).toBeNull();
        expect(onTopBlockedText(exists)).toBe('It already exists, so yours cannot be added again.');
        expect(theirChangeText(exists, KINDS)).toBe('Sam already added P14 at 10:42');
        expect(onTopBatch(mine(pad(), { conflict: [] }), 'x')).toBeNull();
    });

    test('not offered for a refused Revert (entry 12b1): the card has only "Use Sam\'s version", with no reason to give', () => {
        const revert = mine(pad({ version: 4 }), { revert: true });
        expect(onTopBatch(revert, 'x')).toBeNull();
        expect(onTopBlockedText(revert)).toBe('');
        const c = card({ unsaved: [revert] }) as SaveCardData;
        expect(c).toMatchObject({ kind: 'conflict', who: 'Sam', onTop: false, blocked: '' });
        const html = renderToStaticMarkup(React.createElement(SaveCard, { card: c, sending: false, belowChip: false, onUseTheirs: () => undefined,
            onApplyOnTop: () => undefined, onRetry: () => undefined, onRetryStore: () => undefined, onDiscard: () => undefined,
            onShowEdits: () => undefined, onClose: () => undefined }));
        expect(html).toContain('data-on-top="false"');
        expect(html).toContain('Use Sam&#x27;s version');
        expect(html).not.toContain('Apply mine on top');
    });
});

describe('which card shows', () => {
    test('unreachable first, then the conflicts oldest first with "1 of 2", then busy; Esc-closed ones are left out', () => {
        const a = mine(pad({ version: 4, geometry: { type: 'Point', coordinates: P14_NORTH } }), { batchId: 'a', batch: { ...mine(null).batch, batchId: 'a' } });
        const b = mine(pad({ version: 5 }), { batchId: 'b', batch: { ...mine(null).batch, batchId: 'b' } });
        const all = [busy(1), a, b];
        // The two conflicts are refused, waiting for a choice, not for the store: one edit saves when it is back.
        const unreachable = card({ unsaved: all.concat([busy(2)]), paused: true }) as SaveCardData;
        expect(unreachable).toMatchObject({ kind: 'unreachable', batchId: '', title: 'Store unreachable', count: 2, closeKey: '' });
        expect(unreachable.text).toBe('Map Studio cannot reach the map store. Your 2 edits are kept on this computer, not saved yet, and save when '
            + 'the store is back. Drawing and editing are paused; live values still update.');
        const first = card({ unsaved: all }) as SaveCardData;
        expect(first).toMatchObject({ kind: 'conflict', batchId: 'a', position: '1 of 2', who: 'Sam', onTop: true,
            title: "Not saved - conflict with Sam's change" });
        expect(first.text).toBe('Sam moved P14 about 40 m north at 10:42, while you were editing it.');
        expect(first.kept).toBe('Your change, kept here and not saved: label position Right, Gas rate switched on.');
        expect(first.closeKey).toBe(dismissKey(a));
        expect(card({ unsaved: all, dismissed: [dismissKey(a)] })).toMatchObject({ kind: 'conflict', batchId: 'b', position: '2 of 2' });
        const third = card({ unsaved: all, dismissed: [dismissKey(a), dismissKey(b)] }) as SaveCardData;
        expect(third).toMatchObject({ kind: 'busy', batchId: 'batch-busy-1', title: 'Not saved - Map Studio is busy', text: BUSY,
            kept: 'Your change, kept here: P14 label position Right.' });
        expect(card({ unsaved: all, dismissed: [dismissKey(a), dismissKey(b), dismissKey(busy(1))] })).toBeNull();
        expect(card({ unsaved: [] })).toBeNull();
        expect((card({ unsaved: [busy(1)], paused: true }) as SaveCardData).text).toContain('Your edit is kept');
    });

    test('a card closed with Esc comes back for a newer refusal of the same batch (R3: a fresh card for the newer change)', () => {
        const older = mine(pad({ version: 4 }));
        const closed = [dismissKey(older)];
        expect(card({ unsaved: [older], dismissed: closed })).toBeNull();
        const later = new Date(2026, 10, 9, 11, 5, 0).toISOString();
        const newer = mine(pad({ version: 5 }), { conflict: [conflictOf(pad({ version: 5 }), { changedAt: later })] });
        expect(dismissKey(newer)).not.toBe(dismissKey(older));
        expect(card({ unsaved: [newer], dismissed: closed })).toMatchObject({ kind: 'conflict', batchId: newer.batchId });
        // Busy after a conflict: a new code, a new card.
        const busyNow: UnsavedEntry = { ...older, state: 'unsent', reason: { code: 'store-unreachable', message: BUSY }, conflict: undefined };
        expect(card({ unsaved: [busyNow], dismissed: closed })).toMatchObject({ kind: 'busy', batchId: older.batchId });
    });

    test('a conflict queued before entry 10 (no conflict kept): who and the item, and Apply mine on top withheld with the reason', () => {
        const old = mine(null, { conflict: undefined });
        const c = card({ unsaved: [old] }) as SaveCardData;
        expect(c).toMatchObject({ kind: 'conflict', onTop: false });
        expect(c.text).toBe('Sam changed P14 since you loaded it. The stored version was not kept with this edit, so it cannot go on top.');
        expect(onTopBlockedText(old)).not.toBe('');
    });

    test('my delete meeting their delete: "deleted", and Apply mine on top withheld', () => {
        const del: EditBatch = { batchId: 'b-del', ops: [{ op: 'delete', entity: 'item', id: 'p14', baseVersion: 3 }] };
        const entry = mine(pad({ version: 4, deleted: true }), {}, del);
        expect(onTopBatch(entry, 'x')).toBeNull();
        const c = card({ unsaved: [entry] }) as SaveCardData;
        expect(c.onTop).toBe(false);
        expect(c.text).toBe('Sam deleted P14 at 10:42. It was deleted, so your change cannot go on top of it.');
    });

    test('a deleted item offers only Use theirs, the reason in the sentence', () => {
        const c = card({ unsaved: [mine(pad({ version: 4, deleted: true }))] }) as SaveCardData;
        expect(c).toMatchObject({ kind: 'conflict', onTop: false, position: '' });
        expect(c.text).toBe('Sam deleted P14 at 10:42. It was deleted, so your change cannot go on top of it.');
    });
});

describe('the queue keeps the conflict and the before records', () => {
    test('written at enqueue and at the refusal, read back after a reload; another reason drops the conflict', () => {
        const store = new FakeStore();
        const key = storageKey('mapstudio-dev', 'mapeditor');
        const q = new UnsavedQueue(store, () => undefined);
        q.setKey(key);
        const batch = updateBatch('p14', 'batch-1', 3, { name: 'P14b' });
        q.enqueue(batch, new Date('2026-11-09T10:40:00Z'), [pad()]);
        q.failed('batch-1', { code: 'conflict', message: 'm', changedBy: 'Sam' }, [conflictOf(pad({ version: 4 }))]);
        const [read] = readEntries(store.getItem(key));
        expect(read.before).toEqual([pad()]);
        expect(read.conflict).toEqual([conflictOf(pad({ version: 4 }))]);
        q.failed('batch-1', { code: 'timeout', message: 'no answer' });
        expect(readEntries(store.getItem(key))[0].conflict).toBeUndefined();
        // An entry written before entry 10 stays valid with neither.
        const old = readEntries(JSON.stringify([{ batchId: 'o', batch: { ...batch, batchId: 'o' }, queuedAt: 'x', state: 'unsent' }]));
        expect(old).toHaveLength(1);
        expect(old[0].before).toBeUndefined();
        expect(old[0].conflict).toBeUndefined();
    });
});

describe('the card', () => {
    const noop = (): void => undefined;
    function render(c: SaveCardData, sending = false): string {
        return renderToStaticMarkup(React.createElement(SaveCard, {
            card: c, sending, belowChip: false, onUseTheirs: noop, onApplyOnTop: noop, onRetry: noop, onRetryStore: noop, onDiscard: noop,
            onShowEdits: noop, onClose: noop
        }));
    }

    test('conflict: an alert with its hooks, the words, Use Sam\'s version and Apply mine on top', () => {
        const html = render(card({ unsaved: [mine(pad({ version: 4, geometry: { type: 'Point', coordinates: P14_NORTH } }))] }) as SaveCardData);
        expect(html).toContain('role="alert"');
        expect(html).toContain('data-card="conflict"');
        expect(html).toContain('data-batch-id="batch-mine"');
        expect(html).toContain('aria-keyshortcuts="Escape"');
        expect(html).toContain('Sam moved P14 about 40 m north at 10:42, while you were editing it.');
        expect(html).toContain('>Use Sam&#x27;s version</button>');
        expect(html).toContain('>Apply mine on top</button>');
        expect(html).not.toContain('\u2014');
        const blocked = render(card({ unsaved: [mine(pad({ version: 4, deleted: true }))] }) as SaveCardData);
        expect(blocked).not.toContain('Apply mine on top');
    });

    test('unreachable: Try again and Show my N edits, not closed by Esc; busy: Discard off while it is being sent', () => {
        const u = render(card({ unsaved: [busy(1), busy(2)], paused: true }) as SaveCardData);
        expect(u).toContain('data-card="unreachable"');
        expect(u).toContain('>Try again</button>');
        expect(u).toContain('>Show my 2 edits</button>');
        expect(u).not.toContain('aria-keyshortcuts');
        const b = render(card({ unsaved: [busy(1)] }) as SaveCardData, true);
        expect(b).toContain('data-card="busy"');
        expect(b).toMatch(/<button type="button" class="mapstudio-button mapstudio-save-card-discard" disabled=""[^>]*>Discard my change<\/button>/);
        expect(showEditsText(1)).toBe('Show my edit');
        expect(useTheirsText('')).toBe('Use their version');
    });
});
