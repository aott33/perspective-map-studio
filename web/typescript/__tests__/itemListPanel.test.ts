// The Items list panel as designed (epic 4 entry 7a; EXPERIENCE.md Item list, DESIGN.md list-row, group-header, filter-chip):
// Sort by and Filter in the header, the kind chips behind Filter (the button naming the chosen kind), group headers, the All
// normal divider, children indented with "on P14", and the footer's Add item and "N unlinked" with its clear. Rendered with
// react-dom/server from the component's own state, as shortcuts.test.ts renders it.
import { renderToStaticMarkup } from 'react-dom/server';
import { Asset, Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { ListRow, listRows } from '../itemList';
import { LIVE_INITIAL } from '../live';
import { ItemList, ItemListProps } from '../studio/ItemList';

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
