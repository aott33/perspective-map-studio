// The tag browser's pure parts (epic 4 entry 13b; DESIGN.md Tag browser): the rows the tree shows from the folders answered, the
// folders it asks for, what each key does (B7), what is a pick for each value (B4, B5), the note's words and what "Use this tag"
// saves (B2, B3, B12), the For line, the type column, the provider select and a provider that does not answer (B9, B10).
import { Kind } from '../adapters';
import { TagChild } from '../messages';
import {
    BrowseAnswers, EMPTY_WORDS, FolderAnswer, LOADING_WORDS, PickAnswer, TRUNCATED_WORDS, TagFor, TreeState, ancestors, assetFolderOf, assetProblem, browseKey, canPick,
    cardNote, isItemTarget,
    chooseProvider, closeFolder, focusRow, foldersToAsk, forLine, keyAction, needsProviders, openFolder, outsideAsset, pickProblem, providerOptions, readTagFor, rootProblem,
    rowsInView, shownProvider, splitFullPath, startState, toAssetFolder, typeWord, useText
} from '../tagBrowser';

const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] };
const PROVIDERS = [{ name: 'default', isDefault: true }, { name: 'Site2', isDefault: false }, { name: 'System', isDefault: false }];

function child(path: string, type: TagChild['type'], dataType: string | null = null, hasChildren = type !== 'tag'): TagChild {
    return { name: path.slice(path.lastIndexOf('/') + 1).replace(/^\[.*\]/, ''), path, type, dataType, hasChildren };
}
const loaded = (children: TagChild[], truncated = false): FolderAnswer => ({ state: 'loaded', children, truncated });

const MESA = child('[default]Mesa', 'folder');
const PLANT = child('[default]Plant', 'folder');
const P12 = child('[default]Mesa/P12', 'udt-instance');
const P14 = child('[default]Mesa/P14', 'udt-instance');
const P15 = child('[default]Mesa/P15', 'folder');
const COMMS = child('[default]Mesa/P14/Comms', 'tag', 'Boolean');
const PRESSURE = child('[default]Mesa/P14/Pressure', 'tag', 'Float8');
const AMBIENT = child('[default]Plant/AmbientTemp', 'tag', 'Float8');
const TYPES = child('[default]_types_', 'udt-type');

/** The dev tags as the card has them once it opened at Mesa/P14. */
const OPENED: BrowseAnswers = {
    providers: PROVIDERS,
    folders: {
        [browseKey('default', '')]: loaded([MESA, PLANT]),
        [browseKey('default', 'Mesa')]: loaded([P12, P14, P15]),
        [browseKey('default', 'Mesa/P14')]: loaded([COMMS, PRESSURE])
    },
    picks: {}
};
const ASSET = assetFolderOf({ name: 'Point 2', folder: '[default]Mesa/P14' });
const START = startState(ASSET);
const ids = (state: TreeState, answers: BrowseAnswers = OPENED): string[] => rowsInView(state, answers, ASSET).map((r) => r.id);

describe('paths and keys', () => {
    test('a full path splits into its provider and what follows; anything else does not', () => {
        expect(splitFullPath('[default]Mesa/P14')).toEqual({ provider: 'default', folder: 'Mesa/P14' });
        expect(splitFullPath('[Site2]')).toEqual({ provider: 'Site2', folder: '' });
        expect(splitFullPath('[default]/Mesa/P14/')).toEqual({ provider: 'default', folder: 'Mesa/P14' });
        expect(splitFullPath('{asset.path}/X')).toBeNull();
        expect(splitFullPath('Mesa/P14')).toBeNull();
    });

    test('a folder is kept without letter case, the default provider under no name until it has one', () => {
        expect(browseKey('Default', 'Mesa/P14')).toBe(browseKey('default', 'mesa/p14'));
        expect(browseKey(null, '')).toBe('\n');
        expect(ancestors('Mesa/P14/Lease')).toEqual(['Mesa', 'Mesa/P14', 'Mesa/P14/Lease']);
        expect(ancestors('')).toEqual([]);
    });

    test('the asset folder is the preview item\'s base path; none with no preview item or a base path that is not full', () => {
        expect(ASSET).toEqual({ name: 'Point 2', provider: 'default', folder: 'Mesa/P14' });
        expect(assetFolderOf(null)).toBeNull();
        expect(assetFolderOf({ name: 'P99', folder: 'Mesa/P99' })).toBeNull();
    });
});

describe('the tree in view (B1, B8)', () => {
    test('B1: it opens at the asset folder, opened and marked, its rows guided, the keyboard on it', () => {
        expect(START).toEqual({ provider: 'default', open: ['mesa', 'mesa/p14'], focus: 'mesa/p14', picked: null });
        const rows = rowsInView(START, OPENED, ASSET);
        expect(rows.map((r) => [r.id, r.depth, r.open, r.assetFolder, r.guided])).toEqual([
            ['mesa', 0, true, false, false],
            ['mesa/p12', 1, false, false, false],
            ['mesa/p14', 1, true, true, false],
            ['mesa/p14/comms', 2, false, false, true],
            ['mesa/p14/pressure', 2, false, false, true],
            ['mesa/p15', 1, false, false, false],
            ['plant', 0, false, false, false]]);
        expect(rows[4].node).toBe(PRESSURE);
        expect(rows.map((r) => r.opens)).toEqual([true, true, true, false, false, true, true]);
        expect(focusRow(rows, START.focus)!.id).toBe('mesa/p14');
    });

    test('every level above the asset folder is asked at once, each once, in the spelling it was given', () => {
        expect(foldersToAsk(START, { providers: [], folders: {}, picks: {} }, ASSET)).toEqual(['', 'Mesa', 'Mesa/P14']);
        expect(foldersToAsk(START, OPENED, ASSET)).toEqual([]);
        expect(foldersToAsk(openFolder(START, 'plant'), OPENED, ASSET)).toEqual(['Plant']);
        // With no preview item: the default provider's top level alone.
        expect(foldersToAsk(startState(null), { providers: [], folders: {}, picks: {} })).toEqual(['']);
    });

    test('B8: a folder being opened shows Loading under it, the rest as it was; an empty one says so', () => {
        const opening = openFolder(START, 'plant');
        const rows = rowsInView(opening, { ...OPENED, folders: { ...OPENED.folders, [browseKey('default', 'Plant')]: { state: 'loading' } } }, ASSET);
        const aside = rows[rows.length - 1];
        expect([aside.kind, aside.words, aside.depth, aside.parent, aside.folder]).toEqual(['loading', LOADING_WORDS, 1, 'plant', 'Plant']);
        expect(rows.filter((r) => r.kind === 'node')).toHaveLength(7);
        const empty = rowsInView(opening, { ...OPENED, folders: { ...OPENED.folders, [browseKey('default', 'Plant')]: loaded([]) } }, ASSET);
        expect([empty[empty.length - 1].kind, empty[empty.length - 1].words]).toEqual(['empty', EMPTY_WORDS]);
        // A folder with nothing in it still opens (the Gateway says it has no children): its chevron shows what is in it.
        const spare = child('[Site2]Yard/Spare', 'folder', null, false);
        const site2: BrowseAnswers = { providers: PROVIDERS, picks: {}, folders: { [browseKey('Site2', '')]: loaded([spare]) } };
        expect(rowsInView({ provider: 'Site2', open: [], focus: null, picked: null }, site2, ASSET)[0].opens).toBe(true);
    });

    test('a folder cut short ends in the row that says so; one that failed shows the Gateway\'s words under it', () => {
        const cut = rowsInView(START, { ...OPENED, folders: { ...OPENED.folders, [browseKey('default', 'Mesa/P14')]: loaded([COMMS], true) } }, ASSET);
        expect(cut.map((r) => r.kind)).toEqual(['node', 'node', 'node', 'node', 'truncated', 'node', 'node']);
        expect(cut[4].words).toBe(TRUNCATED_WORDS);
        expect(cut[4].guided).toBe(true);
        const gone = rowsInView(openFolder(START, 'mesa/p15'), { ...OPENED, folders: { ...OPENED.folders,
            [browseKey('default', 'Mesa/P15')]: { state: 'failed', code: 'invalid', message: 'The folder Mesa/P15 was not found in tag provider default.' } } }, ASSET);
        const failed = gone.find((r) => r.kind === 'failed')!;
        expect([failed.words, failed.code, failed.parent]).toEqual(['The folder Mesa/P15 was not found in tag provider default.', 'invalid', 'mesa/p15']);
    });

    test('decision 8: an asset folder the Gateway does not have is no asset folder; its words are the note\'s', () => {
        const lease = assetFolderOf({ name: 'P14 lease', folder: '[default]Mesa/P14/Lease' });
        const answers: BrowseAnswers = { ...OPENED, folders: { ...OPENED.folders,
            [browseKey('default', 'Mesa/P14/Lease')]: { state: 'failed', code: 'invalid', message: 'The folder Mesa/P14/Lease was not found in tag provider default.' } } };
        expect(assetProblem(answers, lease)).toBe('The folder Mesa/P14/Lease was not found in tag provider default.');
        expect(assetProblem(OPENED, ASSET)).toBe('');
        const top: TreeState = { provider: 'default', open: [], focus: null, picked: null };
        expect(rowsInView(top, answers, lease).map((r) => [r.id, r.assetFolder])).toEqual([['mesa', false], ['plant', false]]);
        expect(outsideAsset(top, lease)).toBe(true);
    });
});

describe('the keyboard (B7)', () => {
    const rows = rowsInView(START, OPENED, ASSET);

    test('Up and Down move, Home and End go to the ends, and the ends hold', () => {
        expect(keyAction(rows, 'mesa/p14', 'ArrowDown')).toEqual({ type: 'focus', id: 'mesa/p14/comms' });
        expect(keyAction(rows, 'mesa/p14', 'ArrowUp')).toEqual({ type: 'focus', id: 'mesa/p12' });
        expect(keyAction(rows, 'mesa/p14', 'Home')).toEqual({ type: 'focus', id: 'mesa' });
        expect(keyAction(rows, 'mesa/p14', 'End')).toEqual({ type: 'focus', id: 'plant' });
        expect(keyAction(rows, 'mesa', 'ArrowUp')).toBeNull();
        expect(keyAction(rows, 'plant', 'ArrowDown')).toBeNull();
        // A row that left the view: the first row stands in.
        expect(keyAction(rows, 'gone', 'ArrowDown')).toEqual({ type: 'focus', id: 'mesa/p12' });
    });

    test('Right opens a closed folder and steps into an open one; Left closes an open one and goes to the parent', () => {
        expect(keyAction(rows, 'plant', 'ArrowRight')).toMatchObject({ type: 'open', row: { id: 'plant' } });
        expect(keyAction(rows, 'mesa/p14', 'ArrowRight')).toEqual({ type: 'focus', id: 'mesa/p14/comms' });
        expect(keyAction(rows, 'mesa/p14/pressure', 'ArrowRight')).toBeNull();
        expect(keyAction(rows, 'mesa/p14', 'ArrowLeft')).toMatchObject({ type: 'close', row: { id: 'mesa/p14' } });
        expect(keyAction(rows, 'mesa/p14/pressure', 'ArrowLeft')).toEqual({ type: 'focus', id: 'mesa/p14' });
        expect(keyAction(rows, 'mesa/p12', 'ArrowLeft')).toEqual({ type: 'focus', id: 'mesa' });
        expect(keyAction(rows, 'plant', 'ArrowLeft')).toBeNull();
    });

    test('Enter or Space picks the row; any other key is not the tree\'s', () => {
        expect(keyAction(rows, 'mesa/p14/pressure', 'Enter')).toMatchObject({ type: 'pick', row: { node: PRESSURE } });
        expect(keyAction(rows, 'mesa/p14', ' ')).toMatchObject({ type: 'pick', row: { node: P14 } });
        expect(keyAction(rows, 'mesa/p14', 'a')).toBeNull();
        expect(keyAction([], null, 'ArrowDown')).toBeNull();
    });

    test('the rows that only say something are stepped over; a failed folder is stood on and Enter asks again, but not for a role', () => {
        const answers = (code: string): BrowseAnswers => ({ ...OPENED, folders: { ...OPENED.folders,
            [browseKey('default', 'Mesa/P14')]: { state: 'loading' },
            [browseKey('default', 'Plant')]: { state: 'failed', code, message: 'No.' } } });
        const view = rowsInView(openFolder(START, 'plant'), answers('tags-unavailable'), ASSET);
        expect(view.map((r) => r.kind)).toEqual(['node', 'node', 'node', 'loading', 'node', 'node', 'failed']);
        expect(keyAction(view, 'mesa/p14', 'ArrowDown')).toEqual({ type: 'focus', id: 'mesa/p15' });
        expect(keyAction(view, 'plant', 'ArrowDown')).toEqual({ type: 'focus', id: 'plant\nfailed' });
        expect(keyAction(view, 'plant\nfailed', 'Enter')).toMatchObject({ type: 'retry', row: { folder: 'Plant' } });
        expect(keyAction(view, 'plant\nfailed', 'ArrowLeft')).toEqual({ type: 'focus', id: 'plant' });
        const refused = rowsInView(openFolder(START, 'plant'), answers('role'), ASSET);
        expect(keyAction(refused, 'plant\nfailed', 'Enter')).toBeNull();
    });

    test('a folder closed takes the keyboard up to it; opened, it joins the open ones once', () => {
        expect(closeFolder({ ...START, focus: 'mesa/p14/pressure' }, 'mesa')).toMatchObject({ open: ['mesa/p14'], focus: 'mesa' });
        expect(closeFolder({ ...START, focus: 'plant' }, 'mesa/p14')).toMatchObject({ open: ['mesa'], focus: 'plant' });
        expect(openFolder(START, 'mesa')).toBe(START);
        expect(ids(closeFolder(START, 'mesa'))).toEqual(['mesa', 'plant']);
    });
});

describe('the provider (B6, B9, B10)', () => {
    test('the default first and marked; the one shown is kept while the Gateway no longer lists it', () => {
        expect(providerOptions([{ name: 'A', isDefault: false }, { name: 'default', isDefault: true }], 'default').map((p) => p.name)).toEqual(['default', 'A']);
        expect(providerOptions([{ name: 'default', isDefault: true }], 'Site2')).toEqual([{ name: 'default', isDefault: true }, { name: 'Site2', isDefault: false }]);
        expect(providerOptions([], null)).toEqual([]);
    });

    test('the default provider is shown under its name once the Gateway gave it', () => {
        const start = startState(null);
        expect(shownProvider(start, { providers: [], folders: {}, picks: {} })).toBeNull();
        expect(shownProvider(start, OPENED)).toBe('default');
        expect(shownProvider({ ...start, provider: 'site2' }, OPENED)).toBe('Site2');
    });

    test('B6: another provider shows its top level with nothing open or picked; the folder button returns to the asset folder', () => {
        const site2 = chooseProvider({ ...START, picked: PRESSURE }, 'Site2');
        expect(site2).toEqual({ provider: 'Site2', open: [], focus: null, picked: null });
        expect(chooseProvider(START, 'DEFAULT')).toBe(START);
        expect(outsideAsset(site2, ASSET)).toBe(true);
        expect(outsideAsset(START, ASSET)).toBe(false);
        expect(outsideAsset(closeFolder(START, 'mesa'), ASSET)).toBe(true);
        expect(outsideAsset(START, null)).toBe(false);
        expect(toAssetFolder(site2, ASSET!)).toEqual({ provider: 'default', open: ['mesa', 'mesa/p14'], focus: 'mesa/p14', picked: null });
        expect(toAssetFolder(openFolder(closeFolder(START, 'mesa'), 'plant'), ASSET!).open).toEqual(['mesa/p14', 'plant', 'mesa']);
    });

    test('B9: a provider that does not answer replaces the tree with its name, the sentence and Try again', () => {
        const words = 'The tag provider Site2 is on this Gateway but does not answer; it is stopped or faulted. Start it on the Gateway\'s tag provider page.';
        const answers: BrowseAnswers = { providers: PROVIDERS, picks: {}, folders: { [browseKey('Site2', '')]: { state: 'failed', code: 'tags-unavailable', message: words } } };
        const site2: TreeState = { provider: 'Site2', open: [], focus: null, picked: null };
        expect(rootProblem(site2, answers)).toEqual({ title: 'Can\'t browse Site2', words, retry: true, code: 'tags-unavailable' });
        expect(rowsInView(site2, answers, ASSET)).toEqual([]);
        expect(rootProblem(START, OPENED)).toBeNull();
        const late: BrowseAnswers = { providers: [], picks: {}, folders: { [browseKey(null, '')]: { state: 'failed', code: 'timeout', message: 'The Gateway did not answer in time.' } } };
        expect(rootProblem(startState(null), late)).toEqual({ title: 'Can\'t browse the default provider',
            words: 'The Gateway did not answer in time. Try again.', retry: true, code: 'timeout' });
        // With another provider in the select, the sentence offers it.
        const slow: BrowseAnswers = { providers: PROVIDERS, picks: {}, folders: { [browseKey('Site2', '')]: { state: 'failed', code: 'timeout', message: 'The Gateway did not answer in time.' } } };
        expect(rootProblem(site2, slow)!.words).toBe('The Gateway did not answer in time. Try again, or pick another provider.');
    });

    test('the opening ask failed with no provider known: the default provider is asked once, so the select has the others', () => {
        const failed: FolderAnswer = { state: 'failed', code: 'tags-unavailable', message: 'Stopped.' };
        const opening: BrowseAnswers = { providers: [], picks: {}, folders: { [browseKey('default', '')]: failed } };
        expect(needsProviders(START, opening)).toBe(true);
        // Asked: not again, whatever it answers.
        expect(needsProviders(START, { ...opening, folders: { ...opening.folders, [browseKey(null, '')]: { state: 'loading' } } })).toBe(false);
        expect(needsProviders(START, { ...opening, folders: { ...opening.folders, [browseKey(null, '')]: failed } })).toBe(false);
        // Providers known, the top level not failed, or the default provider itself the one that failed: nothing more to ask.
        expect(needsProviders(START, { ...opening, providers: PROVIDERS })).toBe(false);
        expect(needsProviders(START, OPENED)).toBe(false);
        expect(needsProviders(startState(null), { providers: [], picks: {}, folders: { [browseKey(null, '')]: failed } })).toBe(false);
        // Its reply fills the select: the failing provider stays shown, the others are offered.
        expect(providerOptions(PROVIDERS, 'Gone').map((p) => p.name)).toEqual(['default', 'Site2', 'System', 'Gone']);
    });

    test('B10: a refused role is the Gateway\'s words with no Try again; an invalid ask its words with one', () => {
        const refused = (code: string, message: string): BrowseAnswers => ({ providers: [], picks: {}, folders: { [browseKey('default', '')]: { state: 'failed', code, message } } });
        expect(rootProblem(START, refused('role', 'Browsing tags needs a full editing role. Ask for a Map Studio editing role.')))
            .toEqual({ title: '', words: 'Browsing tags needs a full editing role. Ask for a Map Studio editing role.', retry: false, code: 'role' });
        expect(rootProblem(START, refused('invalid', 'There is no tag provider named default on this Gateway.')))
            .toMatchObject({ title: '', retry: true });
    });
});

describe('what is a pick (B4, B5)', () => {
    test('a tag is a pick for any value; a folder or a UDT instance for Alarms only', () => {
        for (const part of ['kpi', 'comms', 'alarms'] as const) {
            expect(canPick(PRESSURE, part)).toBe(true);
            expect(canPick(TYPES, part)).toBe(false);
        }
        expect(canPick(P15, 'kpi')).toBe(false);
        expect(canPick(P14, 'comms')).toBe(false);
        expect(canPick(P15, 'alarms')).toBe(true);
        expect(canPick(P14, 'alarms')).toBe(true);
    });

    test('B4: a folder picked where only a tag will do says so; B5: the button reads Use this folder', () => {
        expect(pickProblem(P15, 'kpi')).toBe('Pick a tag, not a folder.');
        expect(pickProblem(P14, 'comms')).toBe('Pick a tag, not a folder.');
        expect(pickProblem(PRESSURE, 'kpi')).toBe('');
        expect(pickProblem(P14, 'alarms')).toBe('');
        expect(pickProblem(TYPES, 'alarms')).toBe('Pick a tag or a folder.');
        expect(pickProblem(child('[default]X', 'other'), 'kpi')).toBe('Pick a tag.');
        expect(useText(null, 'kpi')).toBe('Use this tag');
        expect(useText(P15, 'kpi')).toBe('Use this tag');
        expect(useText(P14, 'alarms')).toBe('Use this folder');
        expect(useText(P15, 'alarms')).toBe('Use this folder');
        expect(useText(PRESSURE, 'alarms')).toBe('Use this tag');
    });
});

describe('the words', () => {
    test('the For line names the value and the kind', () => {
        expect(forLine({ part: 'kpi', index: 2 }, PAD)).toBe('For: Key value 2 of the Well pad kind');
        expect(forLine({ part: 'comms' }, PAD)).toBe('For: Comms of the Well pad kind');
        expect(forLine({ part: 'alarms' }, PAD)).toBe('For: Alarms of the Well pad kind');
    });

    test('entry 13c: the For lines of the style rule, a popup param, an override and an item\'s own rule', () => {
        expect(forLine({ part: 'rule' }, PAD)).toBe('For: Style rule of the Well pad kind');
        expect(forLine({ part: 'param', name: 'wellId' }, PAD)).toBe('For: Popup param wellId of the Well pad kind');
        expect(forLine({ part: 'param', name: '' }, PAD)).toBe('For: A new popup param of the Well pad kind');
        expect(forLine({ part: 'override', name: 'Casing pressure', item: 'P14' }, PAD)).toBe('For: Casing pressure on P14 only - an override');
        expect(forLine({ part: 'ownRule', item: 'P14' }, PAD)).toBe('For: Style rule of P14 only');
    });

    test('entry 13c: the button reads Use for P14 on an item\'s target; a folder is a pick for Alarms only, an override of it too', () => {
        expect(useText(null, { part: 'override', item: 'P14' })).toBe('Use for P14');
        expect(useText(PRESSURE, { part: 'ownRule', item: 'P14' })).toBe('Use for P14');
        expect(useText(PRESSURE, { part: 'rule' })).toBe('Use this tag');
        expect(useText(MESA, { part: 'param', name: 'x' })).toBe('Use this tag');
        expect((['rule', 'param', 'ownRule', 'override'] as const).map((part) => canPick(MESA, { part }))).toEqual([false, false, false, false]);
        expect(canPick(MESA, { part: 'override', folders: true })).toBe(true);
        expect(pickProblem(MESA, { part: 'rule' })).toBe('Pick a tag, not a folder.');
        expect(isItemTarget({ part: 'override' }) && isItemTarget({ part: 'ownRule' }) && !isItemTarget({ part: 'param' })).toBe(true);
    });

    describe('entry 13c: a typed path and the newer targets', () => {
        const typedNote = (over: Partial<Parameters<typeof cardNote>[0]>) =>
            cardNote({ kind: PAD, part: 'kpi', asset: ASSET, picked: null, pick: undefined, assetProblem: '', ...over });
        const inside: PickAnswer = { state: 'answered', path: '{asset.path}/Pressure', relative: true, n: 4, m: 5, failing: ['Point 3'], failingMore: 0 };

        test('C7, C8: a typed path waits for the Gateway and then reads as a pick does', () => {
            expect(typedNote({ typed: '[default]Mesa/P14/Pressure' })).toMatchObject({ text: 'Checking...', save: null });
            expect(typedNote({ typed: '[default]Mesa/P14/Pressure', pick: inside })).toEqual({
                tone: 'plain', title: '', text: 'Inside Point 2\'s asset folder - saved for every well pad as', path: '{asset.path}/Pressure',
                resolve: { text: 'Resolves for 4 of 5 well pads. Not for Point 3.', warning: true }, save: '{asset.path}/Pressure' });
            expect(typedNote({ typed: '{asset.path}/Pressure', pick: inside }).save).toBe('{asset.path}/Pressure');
            expect(typedNote({ typed: '[default]Plant/AmbientTemp', pick: { state: 'answered', path: '[default]Plant/AmbientTemp', relative: false } })).toMatchObject({
                tone: 'shared', title: 'Same tag for every well pad', save: '[default]Plant/AmbientTemp',
                text: 'AmbientTemp is outside Point 2\'s asset folder, so it is saved as the full path and every well pad shows this one tag.' });
        });

        test('C9: the Gateway\'s refusal of a typed path shows its own words; any other failure says the check failed', () => {
            expect(typedNote({ typed: '[default]Mesa//P14', pick: { state: 'failed', code: 'invalid', message: 'The Gateway\'s words.' } }))
                .toEqual({ tone: 'warning', title: '', text: 'The Gateway\'s words.', path: '', resolve: null, save: null });
            expect(typedNote({ typed: '[default]Mesa/P14', pick: { state: 'failed', code: 'timeout', message: 'the Gateway did not answer in time.' } }).text)
                .toBe('Could not check this path: the Gateway did not answer in time.');
        });

        test('typed text replaces the pick in the note; an emptied field is nothing picked', () => {
            expect(typedNote({ typed: '[default]Mesa/P14/Pressure', picked: P15, pick: inside }).save).toBe('{asset.path}/Pressure');
            expect(typedNote({ typed: '' }).text).toMatch(/^Opened at Point 2's asset folder/);
        });

        test('with no linked item nothing is asked: the full-path check answers a typed path', () => {
            expect(typedNote({ asset: null, typed: '[default]Plant/AmbientTemp' })).toMatchObject({ tone: 'shared', save: '[default]Plant/AmbientTemp' });
            expect(typedNote({ asset: null, typed: 'Plant/AmbientTemp' })).toMatchObject({ tone: 'warning', save: null,
                text: 'Plant/AmbientTemp is not a tag path; use a full path such as [default]Shared/GasPrice.' });
            expect(typedNote({ asset: null, typed: '{asset.path}/Pressure' })).toMatchObject({ tone: 'warning', save: null,
                text: 'No well pad is linked to an asset, so {asset.path}/Pressure cannot be checked here. Type a full path such as [default]Shared/GasPrice.' });
        });

        test('C1 to C3: the style rule and a popup param convert as a key value does, each with its own shared-tag sentence', () => {
            const outside: PickAnswer = { state: 'answered', path: '[default]Plant/AmbientTemp', relative: false };
            expect(typedNote({ part: 'rule', target: { part: 'rule' }, picked: PRESSURE, pick: inside }).save).toBe('{asset.path}/Pressure');
            expect(typedNote({ part: 'rule', target: { part: 'rule' }, picked: AMBIENT, pick: outside }).text)
                .toBe('AmbientTemp is outside Point 2\'s asset folder, so it is saved as the full path and every well pad\'s rule reads this one tag.');
            expect(typedNote({ part: 'param', target: { part: 'param', name: 'wellId' }, picked: PRESSURE, pick: inside }).save).toBe('{asset.path}/Pressure');
            expect(typedNote({ part: 'param', target: { part: 'param', name: 'wellId' }, picked: AMBIENT, pick: outside })).toMatchObject({
                save: '[default]Plant/AmbientTemp',
                text: 'AmbientTemp is outside Point 2\'s asset folder, so it is saved as the full path and every well pad\'s popup view gets this one path.' });
        });

        test('C4 to C6, C8: one item\'s pick is its full path at once, with no answer waited for', () => {
            const target = { part: 'override' as const, name: 'Casing pressure', item: 'P14' };
            const item = assetFolderOf({ name: 'P14', folder: '[default]Mesa/P14' });
            const of = (over: Partial<Parameters<typeof cardNote>[0]>) =>
                cardNote({ kind: PAD, part: 'override', target, asset: item, picked: null, pick: undefined, assetProblem: '', ...over });
            expect(of({ picked: PRESSURE })).toEqual({ tone: 'plain', title: '', text: 'Saved for P14 only, as the full path', path: '[default]Mesa/P14/Pressure',
                resolve: null, save: '[default]Mesa/P14/Pressure', override: true });
            expect(of({ picked: P15 })).toMatchObject({ text: 'Pick a tag, not a folder.', save: null });
            expect(of({}).text).toBe('Opened at P14\'s asset folder. A pick is saved for P14 only, as the full path.');
            expect(of({ asset: null }).text).toBe('P14 is not linked to an asset with a tag folder, so the tree starts at the top. A pick is saved for P14 only, as the full path.');
            expect(of({ asset: null, picked: AMBIENT }).save).toBe('[default]Plant/AmbientTemp');
            expect(of({ assetProblem: 'The folder Mesa/P14 was not found in tag provider default.' }).text)
                .toBe('The folder Mesa/P14 was not found in tag provider default. P14\'s asset folder could not be opened, so the tree starts at the top. A pick is saved for P14 only, as the full path.');
            expect(of({ typed: '{asset.path}/Pressure' })).toEqual({ tone: 'warning', title: '', path: '', resolve: null, save: null,
                text: 'an override\'s tag path is a full path such as [default]Mesa/P12/Pressure, not {asset.path}/Pressure.' });
            expect(of({ typed: '[default]Mesa//P14' }).text).toBe('[default]Mesa//P14 has an empty part between two /; a tag path has a name between every two /.');
            expect(of({ typed: '[default]Mesa/P14/Casing' })).toMatchObject({ save: '[default]Mesa/P14/Casing', override: true });
            expect(of({ part: 'ownRule', target: { part: 'ownRule', item: 'P14' }, picked: PRESSURE }).save).toBe('[default]Mesa/P14/Pressure');
        });
    });

    test('the type column says what the Gateway sent', () => {
        expect((['tag', 'folder', 'udt-instance', 'udt-type', 'other'] as const).map(typeWord)).toEqual(['Tag', 'Folder', 'UDT instance', 'UDT type', 'Other']);
    });

    const note = (over: Partial<Parameters<typeof cardNote>[0]>) => cardNote({ kind: PAD, part: 'kpi', asset: ASSET, picked: null, pick: undefined, assetProblem: '', ...over });

    test('with nothing picked the note says where the card opened, and nothing can be used', () => {
        expect(note({})).toEqual({ tone: 'plain', title: '', path: '', resolve: null, save: null,
            text: 'Opened at Point 2\'s asset folder, the preview item. A tag in it is saved for every well pad as {asset.path}/.... Go up to pick a tag anywhere else.' });
        expect(note({ assetProblem: 'The folder Mesa/P14/Lease was not found in tag provider default.' }).text)
            .toBe('The folder Mesa/P14/Lease was not found in tag provider default. Point 2\'s asset folder could not be opened, so the tree starts at the top.');
        expect(note({ asset: null }).text)
            .toBe('No well pad is linked to an asset, so there is no asset folder to open. A pick is saved as the full path, the same tag for every well pad.');
    });

    test('B4: a folder picked for a key value is no pick', () => {
        expect(note({ picked: P15 })).toMatchObject({ tone: 'plain', text: 'Pick a tag, not a folder.', save: null });
    });

    test('the button waits for the Gateway\'s answer; a failed check is said and saves nothing', () => {
        expect(note({ picked: PRESSURE })).toMatchObject({ text: 'Checking...', save: null });
        expect(note({ picked: PRESSURE, pick: { state: 'asking' } })).toMatchObject({ text: 'Checking...', save: null });
        expect(note({ picked: PRESSURE, pick: { state: 'failed', message: 'the Gateway did not answer in time.' } }))
            .toMatchObject({ tone: 'warning', text: 'Could not check this path: the Gateway did not answer in time.', save: null });
    });

    test('B2: a pick inside the asset folder is the Gateway\'s {asset.path} form with what it resolves for', () => {
        expect(note({ picked: PRESSURE, pick: { state: 'answered', path: '{asset.path}/Pressure', relative: true, n: 4, m: 5, failing: ['Point 3'], failingMore: 0 } }))
            .toEqual({ tone: 'plain', title: '', text: 'Inside Point 2\'s asset folder - saved for every well pad as', path: '{asset.path}/Pressure',
                resolve: { text: 'Resolves for 4 of 5 well pads. Not for Point 3.', warning: true }, save: '{asset.path}/Pressure' });
        expect(note({ picked: COMMS, pick: { state: 'answered', path: '{asset.path}/Comms', relative: true, n: 5, m: 5 } }).resolve)
            .toEqual({ text: 'Resolves for 5 of 5 well pads', warning: false });
    });

    test('B3: a pick outside it is the shared-tag note with the full path', () => {
        expect(note({ picked: AMBIENT, pick: { state: 'answered', path: '[default]Plant/AmbientTemp', relative: false } }))
            .toEqual({ tone: 'shared', title: 'Same tag for every well pad', path: '[default]Plant/AmbientTemp', resolve: null, save: '[default]Plant/AmbientTemp',
                text: 'AmbientTemp is outside Point 2\'s asset folder, so it is saved as the full path and every well pad shows this one tag.' });
    });

    test('B5: the asset folder itself picked for Alarms is {asset.path}; a folder outside it says what every item shows', () => {
        expect(note({ part: 'alarms', picked: P14, pick: { state: 'answered', path: '{asset.path}', relative: true, n: 4, m: 5, failing: ['Point 3'], failingMore: 0 } }))
            .toMatchObject({ path: '{asset.path}', save: '{asset.path}' });
        expect(note({ part: 'alarms', picked: P15, pick: { state: 'answered', path: '[default]Mesa/P15', relative: false } }).text)
            .toBe('P15 is outside Point 2\'s asset folder, so it is saved as the full path and every well pad shows the alarms below it.');
    });

    test('B12: with no preview item nothing is asked and a pick is its full path', () => {
        expect(note({ asset: null, picked: AMBIENT })).toEqual({ tone: 'shared', title: 'Same tag for every well pad', path: '[default]Plant/AmbientTemp',
            resolve: null, save: '[default]Plant/AmbientTemp', text: 'No well pad is linked to an asset, so it is saved as the full path.' });
        expect(note({ asset: null, picked: MESA })).toMatchObject({ text: 'Pick a tag, not a folder.', save: null });
    });

    test('a preview item whose asset\'s base path is no tag path: the note says so, and a pick is its full path with nothing asked', () => {
        expect(assetFolderOf({ name: 'Pad 99', folder: 'Mesa/P99' })).toBeNull();
        expect(note({ asset: null, noFolder: 'Pad 99' }).text)
            .toBe('Pad 99\'s asset has no tag folder to open, so the tree starts at the top. A pick is saved as the full path, the same tag for every well pad.');
        expect(note({ asset: null, noFolder: 'Pad 99', picked: AMBIENT })).toEqual({ tone: 'shared', title: 'Same tag for every well pad',
            path: '[default]Plant/AmbientTemp', resolve: null, save: '[default]Plant/AmbientTemp',
            text: 'Pad 99\'s asset has no tag folder, so it is saved as the full path.' });
    });
});

describe('the tag buttons\' ids', () => {
    test('a button names the comms or alarms path, a stored key value by its key, or a new row by its id', () => {
        expect(readTagFor(TagFor.comms)).toEqual({ part: 'comms' });
        expect(readTagFor(TagFor.alarms)).toEqual({ part: 'alarms' });
        expect(readTagFor(TagFor.kpi('pressure'))).toEqual({ part: 'kpi', key: 'pressure' });
        expect(readTagFor(TagFor.newRow('r3'))).toEqual({ part: 'new', rowId: 'r3' });
        expect(readTagFor('link')).toBeNull();
    });

    test('entry 13c: the style rule, a param by its name, a new param by its row, an override by its row and the own rule', () => {
        expect(readTagFor(TagFor.rule)).toEqual({ part: 'rule' });
        expect(readTagFor(TagFor.param('wellId'))).toEqual({ part: 'param', name: 'wellId' });
        expect(readTagFor(TagFor.newParam('p2'))).toEqual({ part: 'newParam', rowId: 'p2' });
        expect(readTagFor(TagFor.override('kpi:pressure'))).toEqual({ part: 'override', row: 'kpi:pressure' });
        expect(readTagFor(TagFor.override('alarms'))).toEqual({ part: 'override', row: 'alarms' });
        expect(readTagFor(TagFor.ownRule)).toEqual({ part: 'ownRule' });
    });
});
