import * as React from 'react';
import { GeometryPick, deleteOffText, geometryHint, geometryTitle, splitOffText } from '../drawing';

/**
 * The geometry bar (epic 4 entry 5; EXPERIENCE.md Change geometry and Drawing bar, the owner's mocks 2 and 3 of 2026-11-06): the
 * drawing bar's sibling bottom-centre while a point of the selected line or area is chosen, or Move waits for a click. It is
 * then the one place Edit mode talks; with nothing chosen nothing does. A chosen point: "Point 2 of 3 on L-SWD", "Drag it to
 * move it, or use Move", then Move, Split here (an inner point of a line only) and Delete point (never below two points for a
 * line or three for an area), each off with the reason as its title. Move pressed: "Moving point 2 of L-SWD" (or "Moving CTB1"
 * for a point item's Move from Details), "Click the new place on the map - Esc to cancel" and Cancel. While an edit of the
 * item is being saved the actions wait. Move swaps its buttons, so the focus that was on them (or lost with them) moves to
 * Cancel while Move waits and back to Move after, keeping Esc and Enter in the component. Its attributes are what the e2e
 * suite reads.
 */
export interface GeometryBarProps {
    pick: GeometryPick;
    /** The item's name, and its point count for a line or an area (1 for a point item). */
    name: string;
    vertexCount: number;
    area: boolean;
    /** An edit is being saved: the actions wait for it, so a shape is never built on a record about to change. */
    busy: boolean;
    onMove: () => void;
    onCancel: () => void;
    onSplit: () => void;
    onDelete: () => void;
}

export function GeometryBar(props: GeometryBarProps): React.ReactElement {
    const { pick, name, vertexCount, area, busy } = props;
    const bar = React.useRef<HTMLDivElement>(null);
    const wasMoving = React.useRef(pick.moving);
    React.useEffect(() => {
        if (wasMoving.current === pick.moving) {
            return;
        }
        wasMoving.current = pick.moving;
        const el = bar.current;
        const active = typeof document !== 'undefined' ? document.activeElement : null;
        if (!el || (active && active !== document.body && !el.contains(active))) {
            // The focus is elsewhere (the map after its click, a field): it stays there.
            return;
        }
        const next = el.querySelector(pick.moving ? '.mapstudio-geometry-cancel' : '.mapstudio-geometry-move') as HTMLButtonElement | null;
        if (next) {
            next.focus();
        }
    });
    const title = geometryTitle(pick, name, vertexCount);
    const index = pick.index;
    const split = index === null ? 'A point item has no split' : splitOffText(vertexCount, index, area);
    const remove = deleteOffText(vertexCount, area);
    const waiting = busy ? 'Saving...' : '';
    return (
        <div ref={bar} className="mapstudio-geometry-bar" role="group" aria-label={title} data-item-id={pick.itemId} data-point={index === null ? '' : String(index)}
             data-moving={pick.moving ? 'true' : 'false'} data-busy={busy ? 'true' : 'false'}>
            <span className="mapstudio-drawing-words" aria-live="polite">
                <span className="mapstudio-drawing-title mapstudio-geometry-title">{title}</span>
                <span className="mapstudio-drawing-hint mapstudio-geometry-hint">{geometryHint(pick)}</span>
            </span>
            {pick.moving ? (
                <button type="button" className="mapstudio-button mapstudio-geometry-cancel" title="Cancel (Esc)" onClick={props.onCancel}>Cancel</button>
            ) : (
                <>
                    <button type="button" className="mapstudio-button mapstudio-geometry-move" disabled={busy}
                            title={waiting || 'Move: click the new place on the map'} onClick={props.onMove}>Move</button>
                    <button type="button" className="mapstudio-button mapstudio-geometry-split" disabled={busy || split !== ''}
                            title={waiting || split || 'Split the line here into two lines'} onClick={props.onSplit}>Split here</button>
                    <button type="button" className="mapstudio-button mapstudio-geometry-delete" disabled={busy || remove !== ''}
                            title={waiting || remove || 'Delete this point'} onClick={props.onDelete}>Delete point</button>
                </>
            )}
        </div>
    );
}
