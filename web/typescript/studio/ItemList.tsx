import * as React from 'react';
import { LIST_SEARCH_LABEL, LIST_SEARCH_PLACEHOLDER, ListRow, filterRows } from '../itemList';
import { alarmGlyphId } from '../live';
import { Glyph } from '../popupParts';
import { SaveState } from '../save';
import { saveStatusWords } from '../save';
import { NO_MATCHES } from '../search';
import { ChromeGlyph } from './ChromeGlyph';

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
 * The text is the list's own: it starts empty each time the list mounts (entering Edit mode, the rail's Items).
 * The grouping, Sort by, the Filter chips and the footer are entry 7's; checkboxes are entry 8's.
 */
export interface ItemListProps {
    title: string;
    rows: ListRow[];
    selectedId: string | null;
    save: SaveState;
    onSelect: (id: string) => void;
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
        return <span className="mapstudio-badge mapstudio-badge--unlinked" data-badge="unlinked">{row.words}</span>;
    }
    return (
        <span className={'mapstudio-badge mapstudio-badge--' + row.badge} data-badge={row.badge}>
            <Glyph id={row.badge === 'comms-lost' ? 'comms-lost' : 'stale'} className={'mapstudio-badge-glyph mapstudio-badge-glyph--' + row.badge} size={14} />
            <span className="mapstudio-badge-word">{row.words}</span>
        </span>
    );
}

interface ItemListState {
    /** The Search items field's text, as typed. */
    query: string;
}

export class ItemList extends React.Component<ItemListProps, ItemListState> {
    state: ItemListState = { query: '' };

    private readonly input = React.createRef<HTMLInputElement>();
    private readonly listId = 'mapstudio-item-list-' + Math.random().toString(36).slice(2, 8);

    private onQuery = (ev: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({ query: ev.target.value });
    };

    /** Esc empties the field and goes no further: the root's Esc (closing Details) never sees it. With no text it goes on. */
    private onQueryKey = (ev: React.KeyboardEvent<HTMLInputElement>): void => {
        if (ev.key === 'Escape' && this.state.query !== '') {
            ev.preventDefault();
            ev.stopPropagation();
            this.setState({ query: '' });
        }
    };

    /** Clear empties the field; the focus goes back into it. */
    private onClear = (): void => {
        this.setState({ query: '' });
        if (this.input.current) {
            this.input.current.focus();
        }
    };

    render(): React.ReactElement {
        const props = this.props;
        const save = props.save;
        const problem = save.state === 'refused' || save.state === 'unsent';
        const query = this.state.query;
        const shown = filterRows(props.rows, query);
        const noMatches = props.rows.length > 0 && shown.length === 0;
        return (
            <section className="mapstudio-dock mapstudio-dock--items" aria-label="Items">
                <header className="mapstudio-dock-header">
                    <div className="mapstudio-dock-title-row">
                        <h2 className="mapstudio-dock-title">{props.title}</h2>
                        {problem ? null : (
                            <span className={'mapstudio-panel-save mapstudio-panel-save--' + save.state} role="status" data-save-state={save.state}>
                                {saveStatusWords(save)}
                            </span>
                        )}
                    </div>
                    {problem ? (
                        // A save problem moves the status to its own full-width row under the title, so the words fit (DESIGN.md Panel header).
                        <div className={'mapstudio-panel-save mapstudio-panel-save--row mapstudio-panel-save--' + save.state} role="status"
                             data-save-state={save.state} data-code={save.code}>
                            {saveStatusWords(save)}
                        </div>
                    ) : null}
                    <div className="mapstudio-list-search" role="search" aria-label="Items list">
                        <ChromeGlyph name="search" className="mapstudio-list-search-glyph" size={16} />
                        <input ref={this.input} type="text" className="mapstudio-input mapstudio-list-search-input"
                               placeholder={LIST_SEARCH_PLACEHOLDER} aria-label={LIST_SEARCH_LABEL} aria-controls={this.listId}
                               autoComplete="off" spellCheck={false} value={query} onChange={this.onQuery} onKeyDown={this.onQueryKey} />
                        {query !== '' ? (
                            // Only while there is text, so a hidden button never counts as a target (as the View-mode field's Clear).
                            <button type="button" className="mapstudio-dock-button mapstudio-list-search-clear" title="Clear the search"
                                    aria-label="Clear the search" onClick={this.onClear}>
                                <ChromeGlyph name="close" size={16} />
                            </button>
                        ) : null}
                    </div>
                </header>
                {props.rows.length === 0 ? <div className="mapstudio-list-empty">No items yet - items you add are listed here.</div> : null}
                {noMatches ? <div className="mapstudio-list-empty mapstudio-list-empty--search" data-empty="search">{NO_MATCHES}</div> : null}
                {/* One polite live region, always mounted and visually hidden, so a screen reader hears "No matches" when it comes. */}
                <div className="mapstudio-visually-hidden mapstudio-list-status" role="status" aria-live="polite">{noMatches ? NO_MATCHES : ''}</div>
                <ul id={this.listId} className="mapstudio-list" data-rows={String(shown.length)}>
                    {shown.map((row) => (
                        // A list item holding the button, so assistive technology hears both the list and a button (R14).
                        <li key={row.id} className="mapstudio-list-item">
                            <button type="button"
                                    className={'mapstudio-list-row' + (props.selectedId === row.id ? ' mapstudio-list-row--selected' : '')}
                                    data-item-id={row.id} data-kind={row.kindId} data-state={row.badge} aria-current={props.selectedId === row.id ? 'true' : undefined}
                                    title={row.name + ' - ' + row.kindName + (row.words ? ' - ' + row.words : '')}
                                    onClick={() => props.onSelect(row.id)}>
                                {row.icon !== '' ? <Glyph id={row.icon} className="mapstudio-list-kind-glyph" size={18} /> : <span className="mapstudio-list-kind-glyph" />}
                                <span className="mapstudio-list-name">{row.name}</span>
                                <Badge row={row} />
                            </button>
                        </li>
                    ))}
                </ul>
            </section>
        );
    }
}
