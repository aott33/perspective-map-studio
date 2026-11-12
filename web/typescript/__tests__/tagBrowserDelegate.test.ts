// The tag browser's lookups in the store delegate (epic 4 entry 13b): one tags.browse per folder asked, each once, the answer
// kept under the key it was asked by and under the Gateway's own spelling (B1); a refusal and no answer in 15 s kept per provider
// and folder, asked again only on Try again (B8 to B10); a pick's tags.resolve with the path as the Gateway gave it; everything
// dropped when the card closes; and nothing sent for anyone but a full editor. Driven as the Gateway would answer.

jest.mock('@inductiveautomation/perspective-client', () => ({
    ComponentStoreDelegate: class {
        component: unknown;
        fired: unknown[] = [];
        notified = 0;

        constructor(component: unknown) {
            this.component = component;
        }

        notify(): void {
            this.notified++;
        }

        fireEvent(_name: string, message: unknown): void {
            this.fired.push(message);
        }
    }
}), { virtual: true });

import { AbstractUIElementStore } from '@inductiveautomation/perspective-client';
import { MESSAGE_EVENT, MessageTypes } from '../messages';
import { BROWSE_GONE_MAX, BROWSE_TIMEOUT_MS, MapStudioStoreDelegate, RESOLVE_TIMEOUT_MS } from '../MapStudioStoreDelegate';
import { NO_BROWSE, browseKey } from '../tagBrowser';

const KINDS = [{ id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] }];
const PROVIDERS = [{ name: 'default', isDefault: true }, { name: 'Site2', isDefault: false }];
const PRESSURE = { name: 'Pressure', path: '[default]Mesa/P14/Pressure', type: 'tag', dataType: 'Float8', hasChildren: false };
const MESA = { name: 'Mesa', path: '[default]Mesa', type: 'folder', dataType: null, hasChildren: true };

type Fired = { id: string; type: string; body: Record<string, unknown> };

let delegate: MapStudioStoreDelegate;

function ofType(type: string): Fired[] {
    return (delegate as unknown as { fired: Fired[] }).fired.filter((m) => m.type === type);
}

function lastOf(type: string): Fired {
    const all = ofType(type);
    return all[all.length - 1];
}

function reply(type: string, id: string, body: unknown): void {
    delegate.handleEvent(MESSAGE_EVENT, { v: 1, type, id, body });
}

function browse() {
    return delegate.mapStateToProps().browse;
}

function load(level: string): void {
    delegate = new MapStudioStoreDelegate({} as unknown as AbstractUIElementStore);
    delegate.sendMapLoad();
    reply(MessageTypes.MAP_LOAD_REPLY, lastOf(MessageTypes.MAP_LOAD).id, { level, seq: 7, items: [], kinds: KINDS, kindSetups: [], user: 'someone' });
}

beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    load('full');
});

afterEach(() => {
    delegate.stopReplay();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('tags.browse, one per folder opened (B1, B8)', () => {
    test('B1: a folder is asked once and is loading until its answer, which is kept with the providers', () => {
        expect(browse()).toBe(NO_BROWSE);
        delegate.askBrowse('default', 'Mesa/P14');
        delegate.askBrowse('default', 'Mesa/P14');
        delegate.askBrowse('Default', 'mesa/p14');
        const asks = ofType(MessageTypes.TAGS_BROWSE);
        expect(asks.map((m) => m.body)).toEqual([{ provider: 'default', folder: 'Mesa/P14' }]);
        expect(browse().folders[browseKey('default', 'Mesa/P14')]).toEqual({ state: 'loading' });
        reply(MessageTypes.TAGS_BROWSE_REPLY, asks[0].id, { provider: 'default', folder: 'Mesa/P14', providers: PROVIDERS, children: [PRESSURE], truncated: false });
        expect(browse().folders[browseKey('default', 'Mesa/P14')]).toEqual({ state: 'loaded', children: [PRESSURE], truncated: false });
        expect(browse().providers).toEqual(PROVIDERS);
        // Kept while the card is open: asked again, nothing is sent.
        delegate.askBrowse('default', 'Mesa/P14');
        expect(ofType(MessageTypes.TAGS_BROWSE)).toHaveLength(1);
        // The point click's reply line is not touched by these replies.
        expect(delegate.mapStateToProps().lastReply).toBe('');
    });

    test('the default provider is asked for without its name; its answer is kept under the name the Gateway gave too', () => {
        delegate.askBrowse(null, '');
        const ask = lastOf(MessageTypes.TAGS_BROWSE);
        expect(ask.body).toEqual({});
        reply(MessageTypes.TAGS_BROWSE_REPLY, ask.id, { provider: 'default', folder: '', providers: PROVIDERS, children: [MESA], truncated: false });
        expect(browse().folders[browseKey(null, '')]).toEqual({ state: 'loaded', children: [MESA], truncated: false });
        expect(browse().folders[browseKey('default', '')]).toBe(browse().folders[browseKey(null, '')]);
        delegate.askBrowse('default', '');
        expect(ofType(MessageTypes.TAGS_BROWSE)).toHaveLength(1);
    });

    test('a folder cut short says so', () => {
        delegate.askBrowse('default', 'Big');
        reply(MessageTypes.TAGS_BROWSE_REPLY, lastOf(MessageTypes.TAGS_BROWSE).id, { provider: 'default', folder: 'Big', providers: PROVIDERS, children: [PRESSURE], truncated: true });
        expect(browse().folders[browseKey('default', 'Big')]).toMatchObject({ state: 'loaded', truncated: true });
    });
});

describe('refusals and no answer (B9, B10)', () => {
    const STOPPED = 'The tag provider Site2 is on this Gateway but does not answer; it is stopped or faulted. Start it on the Gateway\'s tag provider page.';

    test('B9: a stopped provider is kept as failed with the Gateway\'s words; only Try again asks once more, and then it lists', () => {
        delegate.askBrowse('Site2', '');
        const first = lastOf(MessageTypes.TAGS_BROWSE);
        reply(MessageTypes.ERROR, first.id, { code: 'tags-unavailable', message: STOPPED });
        expect(browse().folders[browseKey('Site2', '')]).toEqual({ state: 'failed', code: 'tags-unavailable', message: STOPPED });
        delegate.askBrowse('Site2', '');
        expect(ofType(MessageTypes.TAGS_BROWSE)).toHaveLength(1);
        delegate.askBrowse('Site2', '', true);
        expect(ofType(MessageTypes.TAGS_BROWSE)).toHaveLength(2);
        expect(browse().folders[browseKey('Site2', '')]).toEqual({ state: 'loading' });
        reply(MessageTypes.TAGS_BROWSE_REPLY, lastOf(MessageTypes.TAGS_BROWSE).id, { provider: 'Site2', folder: '', providers: PROVIDERS, children: [], truncated: false });
        expect(browse().folders[browseKey('Site2', '')]).toEqual({ state: 'loaded', children: [], truncated: false });
    });

    test('B10: a refused role and a folder that is gone keep the Gateway\'s words under the folder asked', () => {
        delegate.askBrowse('default', 'Mesa/Nope');
        reply(MessageTypes.ERROR, lastOf(MessageTypes.TAGS_BROWSE).id, { code: 'invalid', message: 'The folder Mesa/Nope was not found in tag provider default.' });
        delegate.askBrowse('default', '');
        reply(MessageTypes.ERROR, lastOf(MessageTypes.TAGS_BROWSE).id, { code: 'role', message: 'Browsing tags needs a full editing role. Ask for a Map Studio editing role.' });
        expect(browse().folders[browseKey('default', 'Mesa/Nope')]).toEqual({ state: 'failed', code: 'invalid', message: 'The folder Mesa/Nope was not found in tag provider default.' });
        expect(browse().folders[browseKey('default', '')]).toMatchObject({ state: 'failed', code: 'role' });
        expect(delegate.mapStateToProps().lastReply).toBe('');
    });

    test('no answer in 15 s is a failure in words; the late answer is dropped', () => {
        delegate.askBrowse('default', '');
        const ask = lastOf(MessageTypes.TAGS_BROWSE);
        jest.advanceTimersByTime(BROWSE_TIMEOUT_MS - 1);
        expect(browse().folders[browseKey('default', '')]).toEqual({ state: 'loading' });
        jest.advanceTimersByTime(1);
        expect(browse().folders[browseKey('default', '')]).toEqual({ state: 'failed', code: 'timeout', message: 'The Gateway did not answer in time.' });
        reply(MessageTypes.TAGS_BROWSE_REPLY, ask.id, { provider: 'default', folder: '', providers: PROVIDERS, children: [MESA], truncated: false });
        expect(browse().folders[browseKey('default', '')]).toMatchObject({ state: 'failed', code: 'timeout' });
    });
});

describe('the pick\'s tags.resolve', () => {
    test('a picked path is asked with the preview item\'s asset, once; the answer is the path to save and what it resolves for', () => {
        delegate.askPick('pad', 'P14', '[default]Mesa/P14/Pressure');
        delegate.askPick('pad', 'P14', '[default]Mesa/P14/Pressure');
        const asks = ofType(MessageTypes.TAGS_RESOLVE);
        expect(asks.map((m) => m.body)).toEqual([{ kindId: 'pad', assetId: 'P14', path: '[default]Mesa/P14/Pressure' }]);
        expect(browse().picks['[default]Mesa/P14/Pressure']).toEqual({ state: 'asking' });
        reply(MessageTypes.TAGS_RESOLVE_REPLY, asks[0].id, { path: '{asset.path}/Pressure', relative: true, n: 4, m: 5,
            failing: [{ id: 'i3', name: 'Point 3' }], failingMore: 0 });
        expect(browse().picks['[default]Mesa/P14/Pressure']).toEqual({ state: 'answered', path: '{asset.path}/Pressure', relative: true, n: 4, m: 5,
            failing: ['Point 3'], failingMore: 0 });
        // The Kinds screen's own resolve notes are another list: nothing of the pick is kept there.
        expect(delegate.mapStateToProps().resolves).toEqual({});
    });

    test('a path outside the asset folder comes back as it is; a failed check is asked again when the row is picked again', () => {
        delegate.askPick('pad', 'P14', '[default]Plant/AmbientTemp');
        reply(MessageTypes.TAGS_RESOLVE_REPLY, lastOf(MessageTypes.TAGS_RESOLVE).id, { path: '[default]Plant/AmbientTemp', relative: false });
        expect(browse().picks['[default]Plant/AmbientTemp']).toEqual({ state: 'answered', path: '[default]Plant/AmbientTemp', relative: false });
        delegate.askPick('pad', 'P14', '[Site2]Yard/WindSpeed');
        reply(MessageTypes.ERROR, lastOf(MessageTypes.TAGS_RESOLVE).id, { code: 'tags-unavailable', message: 'The tag system did not answer.' });
        expect(browse().picks['[Site2]Yard/WindSpeed']).toEqual({ state: 'failed', message: 'The tag system did not answer.' });
        delegate.askPick('pad', 'P14', '[Site2]Yard/WindSpeed');
        expect(ofType(MessageTypes.TAGS_RESOLVE)).toHaveLength(3);
        jest.advanceTimersByTime(RESOLVE_TIMEOUT_MS);
        expect(browse().picks['[Site2]Yard/WindSpeed']).toEqual({ state: 'failed', message: 'the Gateway did not answer in time.' });
    });

    test('the Kinds screen\'s resolve notes are answered as before while a pick is asked', () => {
        delegate.askResolve('pad', 'P14', ['{asset.path}/Flow']);
        delegate.askPick('pad', 'P14', '[default]Mesa/P14/Flow');
        const [note, pick] = ofType(MessageTypes.TAGS_RESOLVE);
        reply(MessageTypes.TAGS_RESOLVE_REPLY, note.id, { path: '{asset.path}/Flow', relative: true, n: 5, m: 5 });
        expect(Object.values(delegate.mapStateToProps().resolves)).toEqual([{ state: 'resolved', n: 5, m: 5 }]);
        expect(browse().picks['[default]Mesa/P14/Flow']).toEqual({ state: 'asking' });
        reply(MessageTypes.TAGS_RESOLVE_REPLY, pick.id, { path: '{asset.path}/Flow', relative: true, n: 5, m: 5 });
        expect(browse().picks['[default]Mesa/P14/Flow']).toMatchObject({ state: 'answered', path: '{asset.path}/Flow' });
    });
});

describe('the card closes', () => {
    test('every answer goes, and the answers still on their way are dropped without a word', () => {
        delegate.askBrowse('default', '');
        const done = lastOf(MessageTypes.TAGS_BROWSE);
        reply(MessageTypes.TAGS_BROWSE_REPLY, done.id, { provider: 'default', folder: '', providers: PROVIDERS, children: [MESA], truncated: false });
        delegate.askBrowse('default', 'Mesa');
        delegate.askPick('pad', 'P14', '[default]Mesa/P14/Pressure');
        const late = lastOf(MessageTypes.TAGS_BROWSE);
        const latePick = lastOf(MessageTypes.TAGS_RESOLVE);
        delegate.closeBrowse();
        expect(browse()).toBe(NO_BROWSE);
        reply(MessageTypes.TAGS_BROWSE_REPLY, late.id, { provider: 'default', folder: 'Mesa', providers: PROVIDERS, children: [], truncated: false });
        reply(MessageTypes.ERROR, latePick.id, { code: 'tags-unavailable', message: 'Late.' });
        jest.advanceTimersByTime(BROWSE_TIMEOUT_MS + RESOLVE_TIMEOUT_MS);
        expect(browse()).toBe(NO_BROWSE);
        expect(delegate.mapStateToProps().lastReply).toBe('');
        expect(delegate.mapStateToProps().resolves).toEqual({});
        // Opened again, the folder is asked again.
        delegate.askBrowse('default', '');
        expect(ofType(MessageTypes.TAGS_BROWSE)).toHaveLength(3);
    });

    test('the asks given up on are kept to a small number and go with the component', () => {
        const gone = (): Set<string> => (delegate as unknown as { browseGone: Set<string> }).browseGone;
        for (let i = 0; i < BROWSE_GONE_MAX + 10; i++) {
            delegate.askBrowse('default', 'F' + i);
        }
        const first = ofType(MessageTypes.TAGS_BROWSE)[0].id;
        delegate.closeBrowse();
        expect(gone().size).toBe(BROWSE_GONE_MAX);
        expect(gone().has(first)).toBe(false);
        expect(gone().has(lastOf(MessageTypes.TAGS_BROWSE).id)).toBe(true);
        delegate.stopReplay();
        expect(gone().size).toBe(0);
    });

    test('closing a card that asked nothing draws nothing again', () => {
        const before = (delegate as unknown as { notified: number }).notified;
        delegate.closeBrowse();
        expect((delegate as unknown as { notified: number }).notified).toBe(before);
    });
});

describe('only a full editor asks', () => {
    test.each(['none', 'phone'])('at level %s no tags.browse and no pick is sent', (level) => {
        load(level);
        delegate.askBrowse(null, '');
        delegate.askBrowse('default', 'Mesa');
        delegate.askPick('pad', 'P14', '[default]Mesa/P14/Pressure');
        expect(ofType(MessageTypes.TAGS_BROWSE)).toEqual([]);
        expect(ofType(MessageTypes.TAGS_RESOLVE)).toEqual([]);
        expect(browse()).toBe(NO_BROWSE);
    });

    test('before map.load has answered nothing is sent; a full editor whose reload fails goes on asking', () => {
        delegate = new MapStudioStoreDelegate({} as unknown as AbstractUIElementStore);
        delegate.askBrowse(null, '');
        expect(ofType(MessageTypes.TAGS_BROWSE)).toEqual([]);
        load('full');
        delegate.sendMapLoad();
        reply(MessageTypes.ERROR, lastOf(MessageTypes.MAP_LOAD).id, { code: 'store-unreachable', message: 'The map store is unavailable.' });
        expect(delegate.mapStateToProps().level).toBeNull();
        delegate.askBrowse('default', 'Mesa');
        expect(ofType(MessageTypes.TAGS_BROWSE).map((m) => m.body)).toEqual([{ provider: 'default', folder: 'Mesa' }]);
    });
});
