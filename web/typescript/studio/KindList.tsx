import * as React from 'react';
import { AdapterStatus, Kind } from '../adapters';
import { geometryWord, itemsText } from '../kindSetup';
import { Glyph } from '../popupParts';

/**
 * The Kinds list, the rail's Kinds surface in the left dock (epic 4 entry 12a; DESIGN.md Kind setup and key screen 6,
 * EXPERIENCE.md Kind setup): under the dock's header (its title, the save status and the save status row, as the other
 * surfaces) the note "Setup applies to every item of a kind. Items can override.", then one row per kind of the project's kind
 * list, in the list's order: its glyph, its name, its geometry in a word and how many map items it has. The list is read only:
 * no kind is added or removed here. A row is a button; the chosen kind's setup shows in the properties panel's place
 * (studio/KindSetupPanel.tsx). While the kind list or the asset list is not ok, its status message stands above the rows, in
 * the item form's words (the Gateway's own message).
 *
 * For tests: the dock `.mapstudio-kinds` (`data-surface="kinds"`, `data-rows`, `data-kind` the chosen kind), each row
 * `.mapstudio-kind-row[data-kind]` (`data-geometry`, `data-count`, `aria-current` on the chosen one), the note
 * `.mapstudio-kinds-note`, and a list's message `.mapstudio-kinds-status[data-list][data-status]`.
 */
export interface KindListProps {
    /** The dock's header (title, save status and the save status row), drawn by the component as for the other surfaces. */
    header: React.ReactNode;
    kinds: Kind[];
    /** How many live map items each kind has, by kind id. */
    counts: Record<string, number>;
    /** The kind whose setup shows, or null with no kind. */
    chosen: string | null;
    kindStatus: AdapterStatus | null;
    assetStatus: AdapterStatus | null;
    onChoose: (kindId: string) => void;
}

/** The note under the header (DESIGN.md key screen 6). */
export const KINDS_NOTE = 'Setup applies to every item of a kind. Items can override.';

/** A host list's message while the list is not ok, or '' (ok, or no status sent). */
export function listMessage(status: AdapterStatus | null): string {
    return status !== null && status.status !== 'ok' ? status.message : '';
}

export function KindList(props: KindListProps): React.ReactElement {
    const notes: Array<['kinds' | 'assets', AdapterStatus]> = [];
    if (props.kindStatus && listMessage(props.kindStatus) !== '') {
        notes.push(['kinds', props.kindStatus]);
    }
    if (props.assetStatus && listMessage(props.assetStatus) !== '') {
        notes.push(['assets', props.assetStatus]);
    }
    return (
        <section className="mapstudio-dock mapstudio-dock--kinds mapstudio-kinds" aria-label="Kinds" data-surface="kinds"
                 data-rows={String(props.kinds.length)} data-kind={props.chosen || ''}>
            {props.header}
            <div className="mapstudio-kinds-body">
                <div className="mapstudio-kinds-note">{KINDS_NOTE}</div>
                {notes.map(([list, status]) => (
                    <div key={list} className="mapstudio-kinds-status" role="status" data-list={list} data-status={status.status}>{status.message}</div>
                ))}
                {props.kinds.length === 0 ? (
                    <div className="mapstudio-kinds-empty">No kinds yet. Kinds come from the project's kind list.</div>
                ) : (
                    <ul className="mapstudio-kinds-list" aria-label="Kinds of this project">
                        {props.kinds.map((kind) => {
                            const count = props.counts[kind.id] || 0;
                            const chosen = kind.id === props.chosen;
                            return (
                                <li key={kind.id} className="mapstudio-list-item">
                                    <button type="button" className={'mapstudio-list-row mapstudio-kind-row' + (chosen ? ' mapstudio-list-row--selected' : '')}
                                            data-kind={kind.id} data-geometry={geometryWord(kind).toLowerCase()} data-count={String(count)}
                                            aria-current={chosen ? 'true' : undefined} onClick={() => props.onChoose(kind.id)}>
                                        {kind.icon !== '' ? <Glyph id={kind.icon} className="mapstudio-list-kind-glyph" size={18} />
                                            : <span className="mapstudio-list-kind-glyph" aria-hidden="true" />}
                                        <span className="mapstudio-kind-name">{kind.name}</span>
                                        <span className="mapstudio-kind-meta">{geometryWord(kind) + ' - ' + itemsText(count)}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </section>
    );
}
