import * as React from 'react';
import { EditLevel, MapItemRecord } from '../contract';
import {
    LIST_SEARCH_LABEL, LIST_SEARCH_PLACEHOLDER, LIST_SORTS, ListEntry, ListHeader, ListItem, ListRow, ListSort, SELECT_ALL_IN_FILTER, entriesOf,
    groupIds, groupRows, kindChips, selectAllText, unlinkedCount, unlinkedLabel
} from '../itemList';
import { rangeIds } from '../studio';
import { alarmGlyphId } from '../live';
import { Glyph } from '../popupParts';
import { Problem } from '../problems';
import { SaveState } from '../save';
import { NO_MATCHES } from '../search';
import { UnsavedEntry } from '../unsaved';
import { ChromeGlyph } from './ChromeGlyph';
import { ProblemStatus } from './SaveStatus';

/**
 * The docked list panel (epic 4 entry 2; DESIGN.md Panel header, list-row, state-badge; EXPERIENCE.md
 * Item list, Save status): the header with the map's name and the save status (Undo and Redo are the
 * toolbar's since entry 23, owner 2026-11-05); then one flat list of every live map item, by name, each row the kind
 * glyph, the name and the live state badge (the alarm glyph with its digit, Comms lost, Stale,
 * Unlinked). A row click selects the item and pans the map to it (the component's `onSelect`).
 *
 * Under the header's title row the Search items field (entry 21, DESIGN.md key screen 4: the search leaves
 * the map in Edit mode and lives here): a search glyph, the placeholder "Search items", Clear while it holds
 * text; typing keeps the rows whose name, kind name or linked asset name holds the text, in the list's order
 * (itemList.ts `filterRows`), "No matches" with none; Esc in the field empties it and goes no further (the
 * Details panel and the selection stay). A filtered row is the same row button, so choosing it is a row click.
 * The text, with Sort by and the Filter, is the list's view, which the component holds (`view`, entry 7c): it starts empty as Edit
 * mode is entered and outlives the list's mounts (the rail's surfaces, the list over the map below 1280 px, the 1280 px crossing).
 *
 * Entry 7a (EXPERIENCE.md Item list; DESIGN.md list-row, group-header, filter-chip): beside the search, **Sort by** (a native
 * select: Needs attention, the default, Place, Kind, Name, Last changed) and a **Filter** button that opens the kind chips
 * ("All 11", "Well pad 3"), one chosen at a time, the button naming it; the rows laid out by itemList.ts `groupRows` under
 * group headers (`MESA FIELD` with "4 NEED ATTENTION", "Field-wide", "Not linked", "Just added", a kind), the "All normal"
 * divider, children indented 26 px with "on P14", Last changed's "Sam - Today 10:42". The footer: **Add item** (the toolbar's
 * generic Point tool) and "N unlinked" while N > 0, which keeps the Not linked rows alone until its clear. Sort, Filter and
 * the unlinked filter are the list's own, as the search text is. Below 1280 px (entry 7c) the same list opens over the map from the
 * rail's Items (`overlay`).
 *
 * Entry 8 (EXPERIENCE.md List row, Multi-select; DESIGN.md list-row): each row starts with a checkbox, which toggles the row in or
 * out of the selection without opening Details (`onToggle`); every row in the set takes the selected look. A plain row click selects
 * that one item alone as before; Shift-click selects the range from the last row clicked or ticked to it, in the order shown,
 * replacing the set (`onSelectRows`); "Select all in MESA FIELD" under each field header, "Select all in group" on each other group
 * header and, while a kind filter, the unlinked filter or a search is on, "Select all in filter" above the list replace the set with
 * those rows as shown. Context rows are never taken by a range or a Select all.
 *
 * The save status beside the title always says the save state (Saving..., Not saved while edits wait, else Saved); a
 * problem shows on its own row under the title (entry 24, owner 2026-11-05: the status box retired, its problems said
 * here in Edit mode; studio/SaveStatus.tsx `ProblemStatus`), and the edits waiting on that row open the list of them
 * under it, closed until asked for and closed again with Hide, Esc or the edits' going.
 */
export interface ItemListProps {
    title: string;
    rows: ListRow[];
    selectedId: string | null;
    /** The selected set in joining order (entry 8): each row in it is ticked and takes the selected look. */
    selectedIds?: readonly string[];
    /** A row's checkbox (entry 8): the row toggled in or out of the set, no Details. */
    onToggle?: (id: string) => void;
    /** A Shift-click range or a Select all (entry 8): the set replaced by these rows, in the order shown. */
    onSelectRows?: (ids: string[]) => void;
    save: SaveState;
    /** The words beside the title (problems.ts headerSaveWords). */
    saveWords: string;
    /** Edit mode's problems, worst first (problems.ts editProblems), on the row under the title. */
    problems: Problem[];
    /** The queued batches, the records that name their edits, the session's level for their words, and the ones being sent. */
    unsaved: UnsavedEntry[];
    records: MapItemRecord[];
    level: EditLevel | null;
    sending: string[];
    /** The items this session added, newest first (the delegate's `justAdded`). */
    justAdded: readonly string[];
    /** Add item (the footer): the toolbar's generic Point tool picked up; off while editing is paused. */
    onAddItem: () => void;
    addDisabled: boolean;
    onSelect: (id: string) => void;
    /**
     * Below 1280 px (entry 7c) the list is shown over the map's left edge, not docked: the same list whole, in a floating panel
     * (`mapstudio-dock--overlay`); the component closes it on a row choice.
     */
    overlay?: boolean;
    /**
     * The list's view (search text, Sort by, Filter kind, chips open, unlinked only) held by the component (entry 7c), so the docked
     * list and the list over the map share it and it outlives a close, a reopen and the 1280 px crossing; without it the list keeps
     * its own, starting fresh on each mount.
     */
    view?: ListView;
    onRetry: (batchId: string) => void;
    onDiscard: (batchId: string) => void;
    /** Bumped to open the waiting edits under the save status row (entry 10, "Show my 2 edits"; SaveStatus.tsx `openRequest`). */
    openWaiting?: number;
    onOpenHandled?: () => void;
}

function Badge(props: { row: ListRow }): React.ReactElement | null {
    const row = props.row;
    if (row.badge === 'normal') {
        return null;
    }
    if (row.badge === 'alarm' && row.alarm) {
        return (
            <span className="mapstudio-badge mapstudio-badge--alarm mapstudio-badge--p" data-badge="alarm" data-priority={String(row.alarm.priority)}
                  title={row.words + (row.alarm.unacked ? ', unacknowledged' : ', acknowledged')}>
                <Glyph id={alarmGlyphId(row.alarm.priority, row.alarm.unacked)} className={'mapstudio-badge-glyph mapstudio-badge-glyph--p' + row.alarm.priority} size={14} />
                <span className="mapstudio-badge-digit">{row.alarm.priority}</span>
                <span className="mapstudio-visually-hidden">{row.words}</span>
            </span>
        );
    }
    if (row.badge === 'unlinked') {
        return (
            <span className="mapstudio-badge mapstudio-badge--unlinked" data-badge="unlinked" title={row.reason !== '' ? row.reason : undefined}
                  data-reason={row.reason}>{row.words}</span>
        );
    }
    return (
        <span className={'mapstudio-badge mapstudio-badge--' + row.badge} data-badge={row.badge}>
            <Glyph id={row.badge === 'comms-lost' ? 'comms-lost' : 'stale'} className={'mapstudio-badge-glyph mapstudio-badge-glyph--' + row.badge} size={14} />
            <span className="mapstudio-badge-word">{row.words}</span>
        </span>
    );
}

/** The list's view, as the component holds it for every mount of the list (entry 7c): the same fields as the list's own state. */
export interface ListView {
    query: string;
    sort: ListSort;
    kind: string | null;
    chipsOpen: boolean;
    unlinkedOnly: boolean;
}

/** A fresh view: no search, Needs attention, every kind, the chips closed. */
export function newListView(): ListView {
    return { query: '', sort: 'attention', kind: null, chipsOpen: false, unlinkedOnly: false };
}

interface ItemListState {
    /** The Search items field's text, as typed. */
    query: string;
    sort: ListSort;
    /** The kind the Filter keeps, or null for All. */
    kind: string | null;
    /** Whether the Filter's chips are open. */
    chipsOpen: boolean;
    /** The footer's "N unlinked" pressed: the Not linked rows alone. */
    unlinkedOnly: boolean;
}

/**
 * A group header or the All normal divider, as a list item (presentation for the list's row count). With `onSelectAll` (entry 8) a
 * field's header is followed by its "Select all in MESA FIELD" line and any other group header carries "Select all in group".
 */
function Heading(props: { item: Exclude<ListItem, ListEntry>; onSelectAll?: (header: ListHeader) => void }): React.ReactElement {
    const item = props.item;
    if (item.type === 'divider') {
        return <li className="mapstudio-list-divider" role="presentation" data-divider="all-normal">{item.label}</li>;
    }
    const onSelectAll = props.onSelectAll;
    const field = item.key.indexOf('h:field:') === 0;
    const button = onSelectAll ? (
        <button type="button" className="mapstudio-list-select-all" data-group={item.key} onClick={() => onSelectAll(item)}>
            {selectAllText(item)}
        </button>
    ) : null;
    const header = (
        <li key={item.key} className={'mapstudio-list-group mapstudio-list-group--' + item.level} role="presentation" data-group={item.key}>
            <span className="mapstudio-list-group-label">{item.label}</span>
            {item.right !== '' ? <span className="mapstudio-list-group-right" data-attention={item.right}>{item.right}</span> : null}
            {!field ? button : null}
        </li>
    );
    if (!field || !button) {
        return header;
    }
    return (
        <React.Fragment>
            {header}
            <li className="mapstudio-list-select-all-row" role="presentation" data-group={item.key}>{button}</li>
        </React.Fragment>
    );
}

export class ItemList extends React.Component<ItemListProps, ItemListState> {
    state: ItemListState = this.props.view ? { ...this.props.view } : newListView();

    /** A change of the view: into the held view first (entry 7c), so the next mount of the list starts from it, then the state. */
    private update(patch: Partial<ListView>): void {
        if (this.props.view) {
            Object.assign(this.props.view, patch);
        }
        this.setState(patch as ItemListState);
    }

    private readonly input = React.createRef<HTMLInputElement>();
    /** The last row clicked or ticked (entry 8), where a Shift-click range starts. */
    private anchor: string | null = null;
    /** The layout last drawn, which a range and a Select all read in the order shown. */
    private shownItems: ListItem[] = [];

    /** The rows shown, in order, without the context rows (a range and a Select all never take one). */
    private shownIds(): string[] {
        return entriesOf(this.shownItems).filter((e) => !e.context).map((e) => e.row.id);
    }

    /** A row clicked: Shift-click selects the range from the anchor (entry 8); a plain click selects the one item, as before. */
    private onRowClick(ev: React.MouseEvent<HTMLButtonElement>, id: string): void {
        const props = this.props;
        if (ev.shiftKey && props.onSelectRows) {
            // A context row (shown only so a matching child reads under it) is never taken by a range, as by a Select all: a
            // Shift-click on one does nothing. A plain click on it selects it alone, as before.
            const order = this.shownIds();
            if (order.indexOf(id) < 0) {
                return;
            }
            const from = this.anchor !== null && order.indexOf(this.anchor) >= 0 ? this.anchor : props.selectedId;
            this.anchor = id;
            props.onSelectRows(rangeIds(order, from, id));
            return;
        }
        this.anchor = id;
        props.onSelect(id);
    }

    /** A row's checkbox (entry 8): toggled in or out of the set, and the anchor of a later Shift-click. */
    private onCheck(id: string): void {
        this.anchor = id;
        if (this.props.onToggle) {
            this.props.onToggle(id);
        }
    }

    /** A header's Select all (entry 8): the group's rows as shown replace the set. */
    private onSelectAll = (header: ListHeader): void => {
        if (this.props.onSelectRows) {
            const ids = groupIds(this.shownItems, header.key);
            this.anchor = ids.length > 0 ? ids[ids.length - 1] : this.anchor;
            this.props.onSelectRows(ids);
        }
    };

    /** Select all in filter (entry 8): every row shown replaces the set. */
    private onSelectFilter = (): void => {
        if (this.props.onSelectRows) {
            const ids = this.shownIds();
            this.anchor = ids.length > 0 ? ids[ids.length - 1] : this.anchor;
            this.props.onSelectRows(ids);
        }
    };
    private readonly listId = 'mapstudio-item-list-' + Math.random().toString(36).slice(2, 8);

    private onQuery = (ev: React.ChangeEvent<HTMLInputElement>): void => {
        this.update({ query: ev.target.value });
    };

    /** Esc empties the field and goes no further: the root's Esc (closing Details) never sees it. With no text it goes on. */
    private onQueryKey = (ev: React.KeyboardEvent<HTMLInputElement>): void => {
        if (ev.key === 'Escape' && this.state.query !== '') {
            ev.preventDefault();
            ev.stopPropagation();
            this.update({ query: '' });
        }
    };

    /** Clear empties the field; the focus goes back into it. */
    private onClear = (): void => {
        this.update({ query: '' });
        if (this.input.current) {
            this.input.current.focus();
        }
    };

    private onSort = (ev: React.ChangeEvent<HTMLSelectElement>): void => {
        this.update({ sort: ev.target.value as ListSort });
    };

    private onFilterButton = (): void => {
        this.update({ chipsOpen: !this.state.chipsOpen });
    };

    /** A chip chosen: its kind filters the list (All clears it); the chips stay open, so another can be chosen. */
    private onChip = (kind: string | null): void => {
        this.update({ kind });
    };

    private onUnlinked = (): void => {
        this.update({ unlinkedOnly: !this.state.unlinkedOnly });
    };

    private onClearUnlinked = (): void => {
        this.update({ unlinkedOnly: false });
    };

    /** One row: the kind glyph, the name with its second line ("on P14", "Sam - Today 10:42"), the badge. */
    private renderRow(item: ListEntry): React.ReactElement {
        const props = this.props;
        const row = item.row;
        const selected = props.selectedId === row.id;
        // In the set (entry 8): ticked and in the selected look; the current item (the last to join) is also aria-current.
        const inSet = selected || (!!props.selectedIds && props.selectedIds.indexOf(row.id) >= 0);
        return (
            // A list item holding the checkbox and the button, so assistive technology hears both the list and a button (R14).
            <li key={item.key} className={'mapstudio-list-item' + (item.depth > 0 ? ' mapstudio-list-item--child' : '')
                    + (props.onToggle ? ' mapstudio-list-item--check' : '') + (inSet ? ' mapstudio-list-item--selected' : '')}
                style={item.depth > 1 ? { paddingLeft: (item.depth * 26) + 'px' } : undefined}>
                {props.onToggle ? (
                    <input type="checkbox" className="mapstudio-list-check" checked={inSet} data-item-id={row.id}
                           aria-label={'Select ' + row.name} title={'Select ' + row.name + ' with others'}
                           onChange={() => this.onCheck(row.id)} />
                ) : null}
                <button type="button"
                        className={'mapstudio-list-row' + (inSet ? ' mapstudio-list-row--selected' : '')
                            + (item.context ? ' mapstudio-list-row--context' : '')}
                        data-item-id={row.id} data-kind={row.kindId} data-state={row.badge} data-depth={String(item.depth)}
                        aria-current={selected ? 'true' : undefined}
                        title={row.name + ' - ' + row.kindName + (row.words ? ' - ' + row.words : '') + (item.note ? ' - ' + item.note : '')}
                        onClick={(ev) => this.onRowClick(ev, row.id)}>
                    {row.icon !== '' ? <Glyph id={row.icon} className="mapstudio-list-kind-glyph" size={18} /> : <span className="mapstudio-list-kind-glyph" />}
                    <span className="mapstudio-list-text">
                        <span className="mapstudio-list-name">{row.name}</span>
                        {item.note !== '' ? <span className="mapstudio-list-note">{item.note}</span> : null}
                    </span>
                    <Badge row={row} />
                </button>
            </li>
        );
    }

    render(): React.ReactElement {
        const props = this.props;
        const save = props.save;
        const { query, sort, kind, chipsOpen } = this.state;
        const chips = kindChips(props.rows);
        // A filter on a kind no longer on the map keeps nothing: it reads as All again.
        const chosen = kind !== null && chips.some((c) => c.id === kind) ? kind : null;
        const unlinked = unlinkedCount(props.rows);
        const unlinkedOnly = this.state.unlinkedOnly && unlinked > 0;
        const items = groupRows(props.rows, { sort, kind: chosen, query, justAdded: props.justAdded, unlinkedOnly, now: new Date() });
        const shown = entriesOf(items);
        this.shownItems = items;
        // Select all in filter (entry 8): while a kind filter, the unlinked filter or a search narrows the rows shown.
        const filtered = chosen !== null || unlinkedOnly || query.trim() !== '';
        const selectAll = props.onSelectRows ? this.onSelectAll : undefined;
        const noMatches = props.rows.length > 0 && shown.length === 0;
        const chosenChip = chips.find((c) => c.id === chosen);
        const filterWords = chosen !== null && chosenChip ? chosenChip.label : 'Filter';
        return (
            <section className={'mapstudio-dock mapstudio-dock--items' + (props.overlay ? ' mapstudio-dock--overlay' : '')} aria-label="Items">
                <header className="mapstudio-dock-header">
                    <div className="mapstudio-dock-title-row">
                        <h2 className="mapstudio-dock-title">{props.title}</h2>
                        <span className={'mapstudio-panel-save mapstudio-panel-save--' + save.state} role="status" data-save-state={save.state}>
                            {props.saveWords}
                        </span>
                    </div>
                    <ProblemStatus save={save} problems={props.problems} unsaved={props.unsaved} records={props.records} level={props.level}
                                   sending={props.sending} onRetry={props.onRetry} onDiscard={props.onDiscard} openRequest={props.openWaiting}
                                   onOpenHandled={props.onOpenHandled} />
                    <div className="mapstudio-list-search" role="search" aria-label="Items list">
                        <ChromeGlyph name="search" className="mapstudio-list-search-glyph" size={16} />
                        <input ref={this.input} type="text" className="mapstudio-input mapstudio-list-search-input"
                               placeholder={LIST_SEARCH_PLACEHOLDER} aria-label={LIST_SEARCH_LABEL} aria-controls={this.listId}
                               autoComplete="off" spellCheck={false} value={query} onChange={this.onQuery} onKeyDown={this.onQueryKey} />
                        {query !== '' ? (
                            // Only while there is text, so a hidden button never counts as a target (as the View-mode field's Clear).
                            // Esc in the field empties it too, so Clear names the key (epic 4 entry 25's review).
                            <button type="button" className="mapstudio-dock-button mapstudio-list-search-clear" title="Clear the search (Esc)"
                                    aria-label="Clear the search" aria-keyshortcuts="Escape" onClick={this.onClear}>
                                <ChromeGlyph name="close" size={16} />
                            </button>
                        ) : null}
                    </div>
                    <div className="mapstudio-list-tools">
                        <label className="mapstudio-list-sort">
                            <span className="mapstudio-list-sort-label">Sort by</span>
                            <select className="mapstudio-input mapstudio-list-sort-select" value={sort} onChange={this.onSort} aria-controls={this.listId}>
                                {LIST_SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                            </select>
                        </label>
                        <button type="button" className={'mapstudio-button mapstudio-list-filter' + (chosen !== null ? ' mapstudio-list-filter--on' : '')}
                                aria-expanded={chipsOpen} aria-controls={this.listId + '-chips'} data-kind={chosen || ''}
                                title={chosen !== null ? 'Filter: ' + filterWords : 'Filter by kind'} onClick={this.onFilterButton}>
                            <span className="mapstudio-list-filter-words">{filterWords}</span>
                            <ChromeGlyph name="chevron" className="mapstudio-list-filter-chevron" size={14} />
                        </button>
                    </div>
                    {chipsOpen ? (
                        <div id={this.listId + '-chips'} className="mapstudio-list-chips" role="group" aria-label="Filter by kind">
                            {chips.map((c) => (
                                <button key={c.id === null ? '*' : c.id} type="button"
                                        className={'mapstudio-kind-chip' + (c.id === chosen ? ' mapstudio-kind-chip--on' : '')}
                                        aria-pressed={c.id === chosen} data-kind={c.id === null ? '' : c.id} onClick={() => this.onChip(c.id)}>
                                    {c.label + ' ' + c.count}
                                </button>
                            ))}
                        </div>
                    ) : null}
                </header>
                {props.rows.length === 0 ? (
                    <div className="mapstudio-list-empty">No items yet - Items you add or import are listed here, grouped by place.</div>
                ) : null}
                {noMatches ? <div className="mapstudio-list-empty mapstudio-list-empty--search" data-empty="search">{NO_MATCHES}</div> : null}
                {/* One polite live region, always mounted and visually hidden, so a screen reader hears "No matches" when it comes. */}
                <div className="mapstudio-visually-hidden mapstudio-list-status" role="status" aria-live="polite">{noMatches ? NO_MATCHES : ''}</div>
                {filtered && props.onSelectRows && shown.some((e) => !e.context) ? (
                    <div className="mapstudio-list-filter-all">
                        <button type="button" className="mapstudio-list-select-all mapstudio-list-select-filter" onClick={this.onSelectFilter}>
                            {SELECT_ALL_IN_FILTER}
                        </button>
                    </div>
                ) : null}
                <ul id={this.listId} className="mapstudio-list" data-rows={String(shown.length)} data-sort={sort}>
                    {items.map((item) => item.type === 'row' ? this.renderRow(item) : <Heading key={item.key} item={item} onSelectAll={selectAll} />)}
                </ul>
                <footer className="mapstudio-list-footer">
                    <button type="button" className="mapstudio-button mapstudio-list-add" disabled={props.addDisabled}
                            title="Add item - click the map to place it (the Point tool)" onClick={props.onAddItem}>
                        <ChromeGlyph name="plus" size={16} />
                        <span>Add item</span>
                    </button>
                    {unlinked > 0 ? (
                        <span className="mapstudio-list-unlinked-group">
                            <button type="button" className={'mapstudio-button mapstudio-list-unlinked' + (unlinkedOnly ? ' mapstudio-list-unlinked--on' : '')}
                                    aria-pressed={unlinkedOnly} data-count={String(unlinked)}
                                    title={unlinkedOnly ? 'Showing the unlinked items only' : 'Show the unlinked items only'} onClick={this.onUnlinked}>
                                {unlinkedLabel(unlinked)}
                            </button>
                            {unlinkedOnly ? (
                                <button type="button" className="mapstudio-dock-button mapstudio-list-unlinked-clear" title="Show every item"
                                        aria-label="Clear the unlinked filter" onClick={this.onClearUnlinked}>
                                    <ChromeGlyph name="close" size={16} />
                                </button>
                            ) : null}
                        </span>
                    ) : null}
                </footer>
            </section>
        );
    }
}
