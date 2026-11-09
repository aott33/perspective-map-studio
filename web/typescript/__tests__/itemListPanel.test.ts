// The Items list panel as designed (epic 4 entry 7a; EXPERIENCE.md Item list, DESIGN.md list-row, group-header, filter-chip):
// Sort by and Filter in the header, the kind chips behind Filter (the button naming the chosen kind), group headers, the All
// normal divider, children indented with "on P14", and the footer's Add item and "N unlinked" with its clear. Rendered with
// react-dom/server from the component's own state, as shortcuts.test.ts renders it.
import { renderToStaticMarkup } from 'react-dom/server';
import { Asset, Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { ListRow, groupIds, groupRows, listRows } from '../itemList';
import { LIVE_INITIAL } from '../live';
import { ItemList, ItemListProps, newListView } from '../studio/ItemList';

const noop = (): void => undefined;
const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] };
const LINE: Kind = { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [] };
const ASSETS: Asset[] = [
    { id: 'P14', name: 'Pad 14', kind: 'pad', basePath: '[default]Mesa/P14' },
    { id: 'P14-2H', name: 'P14-2H', kind: 'pad', basePath: '[default]Mesa/P14/P14-2H' },
    { id: 'LSWD', name: 'L-SWD', kind: 'line', basePath: '[default]Mesa/Lines/LSWD' }
];

function item(id: string, name: string, kind: string, assetId: string | null): MapItemRecord {
    return { id, kind, name, geometry: kind === 'line' ? { type: 'LineString', coordinates: [[0, 0], [1, 1]] } : { type: 'Point', coordinates: [0, 0] },
        properties: {}, assetId, overrides: {}, ends: null, attachment: null, version: 1, deleted: false };
}

const ROWS: ListRow[] = listRows([item('p14', 'P14', 'pad', 'P14'), item('w', 'P14-2H', 'pad', 'P14-2H'), item('l', 'L-SWD', 'line', 'LSWD'),
    item('s1', 'Scale 1', 'pad', null), item('s2', 'Scale 2', 'pad', null)], [PAD, LINE], LIVE_INITIAL,
ASSETS.map((a) => ({ id: a.id, name: a.name })), true, { assets: ASSETS });

function render(state: Record<string, unknown> = {}, props: Partial<ItemListProps> = {}): string {
    const list = new ItemList({ title: 'Map', rows: ROWS, selectedId: null, save: { state: 'idle' }, saveWords: '', problems: [], unsaved: [],
        records: [], level: 'full', sending: [], justAdded: [], onAddItem: noop, addDisabled: false, onSelect: noop, onRetry: noop,
        onDiscard: noop, ...props });
    list.state = { ...list.state, ...state };
    return renderToStaticMarkup(list.render());
}

describe('the Items list panel (entry 7a)', () => {
    test('Sort by is a select of the five sorts, Needs attention first and chosen; Filter is closed and says Filter', () => {
        const html = render();
        expect(html).toContain('<span class="mapstudio-list-sort-label">Sort by</span>');
        expect(Array.from(html.matchAll(/<option[^>]*value="(\w+)"/g)).map((m) => m[1])).toEqual(['attention', 'place', 'kind', 'name', 'changed']);
        expect(html).toMatch(/<option selected="" value="attention">|<option value="attention" selected="">/);
        expect(html).toContain('>Needs attention</option>');
        expect(html).toContain('>Last changed</option>');
        expect(html).toMatch(/mapstudio-list-filter"[^>]*aria-expanded="false"/);
        expect(html).toContain('<span class="mapstudio-list-filter-words">Filter</span>');
        expect(html).not.toContain('mapstudio-list-chips');
    });

    test('Filter opens the kind chips with their counts; the chosen one is pressed and named on the button', () => {
        const open = render({ chipsOpen: true });
        expect(open).toContain('aria-label="Filter by kind"');
        expect(open.match(/class="mapstudio-kind-chip[^"]*"[^>]*>[^<]+</g)!.map((c) => c.replace(/.*>/, '').replace('<', ''))).toEqual([
            'All 5', 'Gathering line 1', 'Well pad 4']);
        const chosen = render({ chipsOpen: true, kind: 'line' });
        expect(chosen).toContain('class="mapstudio-kind-chip mapstudio-kind-chip--on" aria-pressed="true" data-kind="line"');
        expect(chosen).toContain('<span class="mapstudio-list-filter-words">Gathering line</span>');
        expect(chosen).toContain('data-rows="1"');
        // A kind no longer on the map reads as All.
        expect(render({ kind: 'tank' })).toContain('<span class="mapstudio-list-filter-words">Filter</span>');
    });

    test('the groups: the field header, a child indented with on P14, Field-wide, Not linked', () => {
        const html = render();
        expect(html).toContain('<span class="mapstudio-list-group-label">MESA FIELD</span>');
        expect(html).toContain('mapstudio-list-group mapstudio-list-group--sub');
        expect(html).toContain('>Field-wide</span>');
        expect(html).toContain('>Not linked</span>');
        expect(html).toMatch(/mapstudio-list-item mapstudio-list-item--child"><button[^>]*data-item-id="w"[^>]*data-depth="1"/);
        expect(html).toContain('<span class="mapstudio-list-note">on P14</span>');
        expect(html).toContain('data-rows="5"');
        expect(html.match(/data-item-id="(\w+)"/g)).toEqual(['data-item-id="p14"', 'data-item-id="w"', 'data-item-id="l"',
            'data-item-id="s1"', 'data-item-id="s2"']);
    });

    test('Just added heads the list', () => {
        expect(render({}, { justAdded: ['s2'] }).match(/data-item-id="(\w+)"/)![0]).toBe('data-item-id="s2"');
        expect(render({}, { justAdded: ['s2'] })).toContain('>Just added</span>');
    });

    test('the footer: Add item, and N unlinked keeping the Not linked rows until its clear', () => {
        const html = render();
        expect(html).toContain('<span>Add item</span>');
        expect(html).toContain('aria-pressed="false" data-count="2"');
        expect(html).toContain('>2 unlinked</button>');
        expect(html).not.toContain('mapstudio-list-unlinked-clear');
        const only = render({ unlinkedOnly: true });
        expect(only).toContain('aria-pressed="true" data-count="2"');
        expect(only).toContain('aria-label="Clear the unlinked filter"');
        expect(only).toContain('data-rows="2"');
        // Nothing unlinked: no button, and a pressed filter left over keeps every row.
        const linked = ROWS.filter((r) => r.assetPath !== null);
        const none = render({ unlinkedOnly: true }, { rows: linked });
        expect(none).not.toContain('mapstudio-list-unlinked');
        expect(none).toContain('data-rows="3"');
        expect(render({}, { addDisabled: true })).toMatch(/mapstudio-list-add" disabled=""/);
    });

    test('an empty map says so, grouped by place', () => {
        expect(render({}, { rows: [] })).toContain('No items yet - Items you add or import are listed here, grouped by place.');
    });
});

describe('the list\'s view held by the component (entry 7c\'s review)', () => {
    /** A list as mounted with the held view (never mounted here: its setState is React's no-op, the held view is what counts). */
    function mount(view: ReturnType<typeof newListView>): ItemList {
        return new ItemList({ title: 'Map', rows: ROWS, selectedId: null, save: { state: 'idle' }, saveWords: '', problems: [], unsaved: [],
            records: [], level: 'full', sending: [], justAdded: [], onAddItem: noop, addDisabled: false, onSelect: noop, onRetry: noop,
            onDiscard: noop, view });
    }

    test('Sort by Name, a kind chosen and text typed, a row chosen (the list closed), reopened: still Name, the kind and the text', () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const view = newListView();
        const first = mount(view) as unknown as Record<string, (ev: unknown) => void>;
        first.onSort({ target: { value: 'name' } });
        first.onChip('line');
        first.onQuery({ target: { value: 'swd' } });
        expect(view).toEqual({ query: 'swd', sort: 'name', kind: 'line', chipsOpen: false, unlinkedOnly: false });
        // The list over the map closed on the row's choice and opened again (or the docked one after the 1280 px crossing): a new mount.
        const again = mount(view);
        expect(again.state).toEqual(view);
        const html = renderToStaticMarkup(again.render());
        expect(html).toMatch(/<option selected="" value="name">|<option value="name" selected="">/);
        expect(html).toContain('value="swd"');
        expect(html).toContain('<span class="mapstudio-list-filter-words">Gathering line</span>');
        // Without a held view a mount starts fresh, as before.
        expect(new ItemList({ ...again.props, view: undefined }).state).toEqual(newListView());
        jest.restoreAllMocks();
    });
});

describe('selecting several in the list (entry 8)', () => {
    const several = { selectedIds: ['p14', 's1'], selectedId: 's1', onToggle: noop, onSelectRows: noop };

    test('each row starts with a checkbox, ticked and in the selected look while in the set; the current item is aria-current', () => {
        const html = render({}, several);
        expect(html.match(/<input type="checkbox"/g)).toHaveLength(5);
        expect(html).toMatch(/<input type="checkbox" class="mapstudio-list-check" checked=""[^>]*data-item-id="p14"[^>]*aria-label="Select P14"/);
        expect(html).toMatch(/<input type="checkbox" class="mapstudio-list-check" data-item-id="w"/);
        expect(html).toMatch(/class="mapstudio-list-row mapstudio-list-row--selected" data-item-id="p14"/);
        expect(html).toMatch(/class="mapstudio-list-row mapstudio-list-row--selected" data-item-id="s1"[^>]*aria-current="true"/);
        expect(html).not.toMatch(/data-item-id="p14"[^>]*aria-current/);
        // Without the set's callbacks (the list as before) there are no checkboxes and no Select all.
        expect(render()).not.toContain('type="checkbox"');
        expect(render()).not.toContain('Select all');
    });

    test('"Select all in MESA FIELD" under the field header, "Select all in group" on the other group headers', () => {
        const html = render({}, several);
        expect(html).toContain('<li class="mapstudio-list-select-all-row" role="presentation" data-group="h:field:Mesa">'
            + '<button type="button" class="mapstudio-list-select-all" data-group="h:field:Mesa">Select all in MESA FIELD</button></li>');
        expect(html).toContain('data-group="h:not-linked">Select all in group</button>');
        expect(html).toContain('data-group="h:wide:Mesa">Select all in group</button>');
        expect(html).not.toContain('Select all in filter');
    });

    test('"Select all in filter" above the list while a kind filter, the unlinked filter or a search is on', () => {
        expect(render({ kind: 'line' }, several)).toContain('>Select all in filter</button>');
        expect(render({ unlinkedOnly: true }, several)).toContain('>Select all in filter</button>');
        expect(render({ query: 'Scale' }, several)).toContain('>Select all in filter</button>');
        expect(render({ query: 'nothing like it' }, several)).not.toContain('Select all in filter');
    });

    test('a group\'s rows as shown: a field\'s down to the next field or group, Field-wide included; another group\'s to the next header', () => {
        const items = groupRows(ROWS, { sort: 'attention', kind: null, query: '', justAdded: [], unlinkedOnly: false, now: new Date() });
        expect(groupIds(items, 'h:field:Mesa')).toEqual(['p14', 'w', 'l']);
        expect(groupIds(items, 'h:wide:Mesa')).toEqual(['l']);
        expect(groupIds(items, 'h:not-linked')).toEqual(['s1', 's2']);
        expect(groupIds(items, 'h:nope')).toEqual([]);
        // A search for the well shows P14 only as its context: never taken.
        const searched = groupRows(ROWS, { sort: 'attention', kind: null, query: '2H', justAdded: [], unlinkedOnly: false, now: new Date() });
        expect(groupIds(searched, 'h:field:Mesa')).toEqual(['w']);
    });
});
