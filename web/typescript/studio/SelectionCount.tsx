import * as React from 'react';
import { ChromeGlyph } from './ChromeGlyph';
import { deleteButton } from './PropertiesPanel';

/** The count's words (DESIGN.md Properties panel, the owner's pick of 2026-11-08): "3 selected". */
export function countText(count: number): string {
    return count + ' selected';
}

export interface SelectionCountProps {
    /** How many items are selected (two or more). */
    count: number;
    /** How many of them are saved on the map, so Delete can take them (an item never saved is not deleted). */
    deletable: number;
    /** The store unreachable: Delete paused, as the toolbar is. */
    paused: boolean;
    /** The Point, Line or Area tool in hand, or a drawing in progress: no delete then. */
    toolInHand: boolean;
    onClear: () => void;
    onDelete: () => void;
}

/**
 * The properties panel with several items selected (epic 4 entry 8; DESIGN.md Properties panel: "With several items selected the
 * header reads the count in title typography ("3 selected") with a Clear button"; EXPERIENCE.md Properties panel, Multi-select): the
 * count, Clear and the footer's Delete, nothing else (no fields, no tabs; the bulk form is epic-import-export's). Docked where Details
 * docks. Clear empties the set and closes the panel; Delete deletes them all as one batch and one undo step, named on hover as the
 * single item's is ("Delete (Del)"), off with the reason while paused, while a tool is in hand or when none of them is saved yet.
 */
export function SelectionCount(props: SelectionCountProps): React.ReactElement {
    const remove = deleteButton(props.paused, props.deletable === 0, props.toolInHand, true);
    const words = countText(props.count);
    return (
        <section className="mapstudio-panel mapstudio-panel--several" aria-label={words} data-selected-count={String(props.count)}>
            <header className="mapstudio-panel-header mapstudio-several-header">
                <h2 className="mapstudio-several-count" role="status">{words}</h2>
                <button type="button" className="mapstudio-button mapstudio-several-clear" title="Clear the selection (Esc)"
                        aria-keyshortcuts="Escape" onClick={props.onClear}>Clear</button>
            </header>
            <div className="mapstudio-panel-body mapstudio-several-body" />
            <footer className="mapstudio-panel-footer">
                <button type="button" className="mapstudio-dock-button mapstudio-panel-delete" disabled={remove.off !== ''} title={remove.title}
                        aria-label={'Delete ' + props.deletable + ' items'} aria-keyshortcuts={remove.key ? 'Delete' : undefined}
                        data-off={remove.off} onClick={props.onDelete}>
                    <ChromeGlyph name="trash" />
                </button>
            </footer>
        </section>
    );
}
