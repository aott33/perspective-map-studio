import * as React from 'react';
import { ListRow } from '../itemList';
import { alarmGlyphId } from '../live';
import { Glyph } from '../popupParts';
import { SaveState } from '../save';
import { saveStatusWords } from '../save';
import { ChromeGlyph } from './ChromeGlyph';

/**
 * The docked list panel (epic 4 entry 2; DESIGN.md Panel header, list-row, state-badge; EXPERIENCE.md
 * Item list, Save status, Undo and Redo): the header with the map's name, Undo and Redo naming their
 * step, and the save status; then one flat list of every live map item, by name, each row the kind
 * glyph, the name and the live state badge (the alarm glyph with its digit, Comms lost, Stale,
 * Unlinked). A row click selects the item and pans the map to it (the component's `onSelect`). The
 * grouping, Sort by, Filter, the search and the footer are entry 7's; checkboxes are entry 8's.
 */
export interface ItemListProps {
    title: string;
    rows: ListRow[];
    selectedId: string | null;
    save: SaveState;
    /** "Undo: add Well pad", or '' with nothing to undo (the button is then disabled). */
    undoLabel: string;
    redoLabel: string;
    onSelect: (id: string) => void;
    onUndo: () => void;
    onRedo: () => void;
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

export function ItemList(props: ItemListProps): React.ReactElement {
    const save = props.save;
    const problem = save.state === 'refused' || save.state === 'unsent';
    return (
        <section className="mapstudio-dock mapstudio-dock--items" aria-label="Items">
            <header className="mapstudio-dock-header">
                <div className="mapstudio-dock-title-row">
                    <h2 className="mapstudio-dock-title">{props.title}</h2>
                    <button type="button" className="mapstudio-dock-button mapstudio-undo" disabled={props.undoLabel === ''}
                            title={props.undoLabel || 'Nothing to undo'} aria-label={props.undoLabel || 'Undo'} data-step={props.undoLabel}
                            onClick={props.onUndo}>
                        <ChromeGlyph name="undo" />
                    </button>
                    <button type="button" className="mapstudio-dock-button mapstudio-redo" disabled={props.redoLabel === ''}
                            title={props.redoLabel || 'Nothing to redo'} aria-label={props.redoLabel || 'Redo'} data-step={props.redoLabel}
                            onClick={props.onRedo}>
                        <ChromeGlyph name="redo" />
                    </button>
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
            </header>
            <div className="mapstudio-list" role="list" data-rows={String(props.rows.length)}>
                {props.rows.length === 0 ? <div className="mapstudio-list-empty">No items yet - items you add are listed here.</div> : null}
                {props.rows.map((row) => (
                    <button type="button" key={row.id} role="listitem"
                            className={'mapstudio-list-row' + (props.selectedId === row.id ? ' mapstudio-list-row--selected' : '')}
                            data-item-id={row.id} data-kind={row.kindId} data-state={row.badge} aria-current={props.selectedId === row.id ? 'true' : undefined}
                            title={row.name + ' - ' + row.kindName + (row.words ? ' - ' + row.words : '')}
                            onClick={() => props.onSelect(row.id)}>
                        {row.icon !== '' ? <Glyph id={row.icon} className="mapstudio-list-kind-glyph" size={18} /> : <span className="mapstudio-list-kind-glyph" />}
                        <span className="mapstudio-list-name">{row.name}</span>
                        <Badge row={row} />
                    </button>
                ))}
            </div>
        </section>
    );
}
