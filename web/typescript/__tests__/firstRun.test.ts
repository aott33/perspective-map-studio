// The first-run checklist and the viewer's note (epic 4 entry 7b; DESIGN.md first-run-checklist, EXPERIENCE.md First-run
// checklist): when each shows, what is done, the kept flags (null-safe), the card's words, and the kind setups held live
// from map.load.reply and map.changed (changes.ts). The card is rendered with react-dom/server, as itemListPanel.test.ts does.
import { renderToStaticMarkup } from 'react-dom/server';
import { MapChangedBody, applyKindSetup, onChanged, onLoad, CHANGES_INITIAL } from '../changes';
import { NO_HOST_LISTS } from '../adapters';
import { KindSetupRecord } from '../contract';
import {
    FIRST_RUN_NONE, FirstRunFacts, checklistShows, checklistTitle, doneText, firstRunKey, keepFlag, kindsHelp, readKept, stepsDone,
    viewerNoteShows
} from '../firstRun';
import { FirstRunChecklist, FirstRunChecklistProps } from '../studio/FirstRunChecklist';
import { KeyValueStore } from '../unsaved';

const EMPTY_EDIT: FirstRunFacts = { studioOn: true, loaded: true, itemCount: 0, toolInHand: false, kept: FIRST_RUN_NONE };

function memoryStore(): KeyValueStore & { data: Record<string, string> } {
    const data: Record<string, string> = {};
    return {
        data,
        getItem: (k) => (k in data ? data[k] : null),
        setItem: (k, v) => { data[k] = v; },
        removeItem: (k) => { delete data[k]; }
    };
}

describe('when the card and the note show', () => {
    test('the card: Edit mode, an empty loaded map, not hidden, no tool in hand', () => {
        expect(checklistShows(EMPTY_EDIT)).toBe(true);
        expect(checklistShows({ ...EMPTY_EDIT, studioOn: false })).toBe(false);
        expect(checklistShows({ ...EMPTY_EDIT, loaded: false })).toBe(false);
        expect(checklistShows({ ...EMPTY_EDIT, itemCount: 1 })).toBe(false);
        expect(checklistShows({ ...EMPTY_EDIT, toolInHand: true })).toBe(false);
        expect(checklistShows({ ...EMPTY_EDIT, kept: { hidden: true, viewed: false } })).toBe(false);
    });

    test('the note: View mode on an empty loaded map, never in Edit mode, gone once an item exists', () => {
        expect(viewerNoteShows({ studioOn: false, loaded: true, itemCount: 0 })).toBe(true);
        expect(viewerNoteShows({ studioOn: true, loaded: true, itemCount: 0 })).toBe(false);
        expect(viewerNoteShows({ studioOn: false, loaded: false, itemCount: 0 })).toBe(false);
        expect(viewerNoteShows({ studioOn: false, loaded: true, itemCount: 3 })).toBe(false);
    });
});

describe('the steps and the words', () => {
    test('step 1 from the kind setups, step 2 from the items, step 3 from the kept flag', () => {
        expect(stepsDone(0, 0, FIRST_RUN_NONE)).toEqual([false, false, false]);
        expect(stepsDone(2, 0, FIRST_RUN_NONE)).toEqual([true, false, false]);
        expect(stepsDone(0, 1, { hidden: false, viewed: true })).toEqual([false, true, true]);
        expect(doneText([false, false, false])).toBe('0 of 3 done');
        expect(doneText([true, false, true])).toBe('2 of 3 done');
    });

    test('the title names the project; step 1 counts the kinds', () => {
        expect(checklistTitle('mapstudio-empty')).toBe('Get mapstudio-empty on the map');
        expect(kindsHelp(7)).toBe('Choose icons, key values, comms and alarms for the 7 kinds this project defines.');
        expect(kindsHelp(1)).toContain('for the 1 kind this project defines.');
    });
});

describe('the kept flags, per project and user', () => {
    test('kept and read back, one flag keeping the other', () => {
        const store = memoryStore();
        const key = firstRunKey('mapstudio-empty', 'mapeditor');
        expect(key).toBe('mapstudio.firstrun.v1:mapstudio-empty:mapeditor');
        expect(readKept(store, key)).toEqual(FIRST_RUN_NONE);
        expect(keepFlag(store, key, 'viewed')).toEqual({ hidden: false, viewed: true });
        expect(keepFlag(store, key, 'hidden')).toEqual({ hidden: true, viewed: true });
        expect(readKept(store, key)).toEqual({ hidden: true, viewed: true });
        expect(readKept(store, firstRunKey('mapstudio-empty', 'other'))).toEqual(FIRST_RUN_NONE);
    });

    test('null-safe: no storage, no key, a refusing store or junk keep nothing and throw nothing', () => {
        expect(readKept(null, 'k')).toEqual(FIRST_RUN_NONE);
        expect(readKept(memoryStore(), null)).toEqual(FIRST_RUN_NONE);
        expect(keepFlag(null, 'k', 'hidden')).toEqual({ hidden: true, viewed: false });
        const refusing: KeyValueStore = {
            getItem: () => { throw new Error('denied'); },
            setItem: () => { throw new Error('denied'); },
            removeItem: () => undefined
        };
        expect(readKept(refusing, 'k')).toEqual(FIRST_RUN_NONE);
        expect(keepFlag(refusing, 'k', 'viewed')).toEqual({ hidden: false, viewed: true });
        const junk = memoryStore();
        junk.data.k = '{not json';
        expect(readKept(junk, 'k')).toEqual(FIRST_RUN_NONE);
        junk.data.k = '"text"';
        expect(readKept(junk, 'k')).toEqual(FIRST_RUN_NONE);
    });
});

describe('the card as drawn', () => {
    const noop = (): void => undefined;
    function render(props: Partial<FirstRunChecklistProps> = {}): string {
        return renderToStaticMarkup(FirstRunChecklist({ project: 'Mesa', kindCount: 7, done: [false, false, false], addDisabled: false,
            onOpenKinds: noop, onAddItem: noop, onOpenView: noop, onHide: noop, ...props }));
    }

    test('title, subline, three steps with their buttons, the count and Hide checklist; no em dash', () => {
        const html = render();
        expect(html).toContain('Get Mesa on the map');
        expect(html).toContain('Three steps. Edits save as you go.');
        expect(html).toContain('Set up your kinds');
        expect(html).toContain('for the 7 kinds this project defines.');
        expect(html).toContain('Open Kinds');
        expect(html).toContain('Add or import items');
        expect(html).toContain('Click a kind in the toolbar and click the map. Importing a CSV, KML or GeoJSON file comes later.');
        expect(html).toContain('Add an item');
        expect(html).toContain('Check the operator view');
        expect(html).toContain('See the map the way operators will, with live values.');
        expect(html).toContain('Open view mode');
        expect(html).toContain('0 of 3 done');
        expect(html).toContain('Hide checklist');
        expect(html).toMatch(/mapstudio-button--primary[^"]*"[^>]*>Open Kinds/);
        expect(html).toContain('mapstudio-button--ghost');
        expect(html).not.toContain('—');
        expect(html).not.toContain('role="dialog"');
    });

    test('a done step shows a check in its ring and says so; the count follows', () => {
        const html = render({ done: [true, false, true] });
        expect(html).toContain('data-step="1" data-done="true"');
        expect(html).toContain('data-step="2" data-done="false"');
        expect(html).toContain('mapstudio-firstrun-check');
        expect(html).toContain('(done)');
        expect(html).toContain('2 of 3 done');
    });

    test('Add an item is off while editing is paused', () => {
        expect(render({ addDisabled: true })).toMatch(/disabled="">Add an item/);
    });
});

describe('the kind setups held live (changes.ts)', () => {
    const setup = (kindId: string, version: number, deleted = false): KindSetupRecord => ({ kindId, setup: { icon: 'x' }, version, deleted });
    const body = (seq: number, ...records: Array<Record<string, unknown>>): MapChangedBody => ({
        seq, batchId: 'b' + seq, actor: 'script',
        ops: records.map((r) => ({ op: 'update', entity: 'kindSetup', id: String(r.kindId), version: Number(r.version), record: r }))
    });

    test('map.load.reply\'s kind setups are held, deleted ones left out; none for a viewer', () => {
        const s = onLoad(CHANGES_INITIAL, { level: 'full', seq: 3, items: [], lists: NO_HOST_LISTS, kindSetups: [setup('pad', 2), setup('line', 4, true)] });
        expect(s.state.kindSetups.map((k) => k.kindId)).toEqual(['pad']);
        expect(onLoad(CHANGES_INITIAL, { level: 'none', seq: 3, items: [], lists: NO_HOST_LISTS }).state.kindSetups).toEqual([]);
    });

    test('a map.changed kind setup op is applied by the version rule; a delete drops it', () => {
        let state = onLoad(CHANGES_INITIAL, { level: 'full', seq: 1, items: [], lists: NO_HOST_LISTS, kindSetups: [] }).state;
        let step = onChanged(state, body(2, setup('pad', 1) as unknown as Record<string, unknown>));
        expect(step.action).toBe('apply');
        state = step.state;
        expect(state.kindSetups).toHaveLength(1);
        step = onChanged(state, body(3, setup('pad', 2, true) as unknown as Record<string, unknown>));
        expect(step.state.kindSetups).toEqual([]);
        expect(step.state.seq).toBe(3);
    });

    test('an older version or a record without its setup (a viewer\'s) changes nothing', () => {
        const held = [setup('pad', 3)];
        expect(applyKindSetup(held, setup('pad', 2))).toBe(held);
        expect(applyKindSetup(held, { kindId: 'pad', version: 9, deleted: false })).toBe(held);
        expect(applyKindSetup(held, setup('pad', 4))).toEqual([setup('pad', 4)]);
    });
});
