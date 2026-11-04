import * as React from 'react';
import { Kind } from '../adapters';
import {
    Drawing, DrawingTool, canFinish, endSnap, finishHint, newItemText, problemText, progressText, snapIndicatorText, snapToggleText, startSnap
} from '../drawing';
import { Glyph } from '../popupParts';
import { ChromeGlyph } from './ChromeGlyph';
import { toolGlyph } from './DrawToolbar';

/**
 * The drawing bar (epic 4 entry 4; DESIGN.md Drawing bar, EXPERIENCE.md Drawing bar and Snap): a floating bar
 * bottom-centre while the Line or Area tool is in hand, with the kind's glyph, "New pipeline", the progress ("2
 * points - 0.7 km - start floating", or "start snapped to CTB1"; before the first vertex, where to click), the
 * snapping state (the indicator "Snap to CTB1 - click to connect" while a target is within reach of the pointer,
 * so it names the target before the first vertex too, else "Snap on" or "Snap off"), then what keeps it from
 * finishing in plain words ("A line needs two points", "The edges cross - Backspace removes the last point") or
 * the finish hint, and Cancel (Esc) and Finish, inert until the drawing is valid. Its attributes are what the
 * e2e suite reads.
 */
export interface DrawingBarProps {
    tool: DrawingTool;
    /** The drawing in progress, or null while no vertex is placed yet. */
    drawing: Drawing | null;
    /** The kind the drawing saves as, or null when the kind list has none for the tool. */
    kind: Kind | null;
    snap: boolean;
    /** The name of the target within reach of the pointer, or ''. */
    snapHint: string;
    onCancel: () => void;
    onFinish: () => void;
}

export function DrawingBar(props: DrawingBarProps): React.ReactElement {
    const { drawing, kind, tool } = props;
    const valid = drawing !== null && canFinish(drawing);
    const problem = drawing ? problemText(drawing) : '';
    const start = drawing ? startSnap(drawing) : null;
    const end = drawing ? endSnap(drawing) : null;
    const target = props.snap && props.snapHint !== '';
    const snapWords = target ? snapIndicatorText(props.snapHint) : snapToggleText(props.snap);
    const hint = drawing ? (problem !== '' ? problem : finishHint(tool)) : '';
    return (
        <div className="mapstudio-drawing-bar" role="group" aria-label="Drawing" data-tool={tool} data-points={String(drawing ? drawing.vertices.length : 0)}
             data-valid={valid ? 'true' : 'false'} data-reason={problem} data-snap={props.snap ? 'on' : 'off'} data-snap-target={props.snap ? props.snapHint : ''}
             data-snap-start={start ? start.name : ''} data-snap-end={end ? end.name : ''}>
            <span className="mapstudio-drawing-glyph">
                {kind && kind.icon !== '' ? <Glyph id={kind.icon} className="mapstudio-drawing-kind-glyph" size={18} /> : <ChromeGlyph name={toolGlyph(tool)} size={18} />}
            </span>
            <span className="mapstudio-drawing-words">
                <span className="mapstudio-drawing-title">{kind ? newItemText(kind.name) : tool === 'area' ? 'New area' : 'New line'}</span>
                <span className="mapstudio-drawing-progress">{drawing ? progressText(drawing) : 'Click the map to add the first point'}</span>
                <span className={'mapstudio-drawing-snap' + (target ? ' mapstudio-drawing-snap--target' : '')}
                      data-state={props.snap ? (target ? 'target' : 'on') : 'off'}>{snapWords}</span>
                {hint !== '' ? (
                    <span className={'mapstudio-drawing-hint' + (problem !== '' ? ' mapstudio-drawing-hint--problem' : '')}>{hint}</span>
                ) : null}
            </span>
            <button type="button" className="mapstudio-button mapstudio-drawing-cancel" title="Cancel (Esc)" onClick={props.onCancel}>Cancel</button>
            <button type="button" className="mapstudio-button mapstudio-button--primary mapstudio-drawing-finish" disabled={!valid}
                    title={valid ? 'Finish (Enter)' : problem || 'Click the map to add points'} onClick={props.onFinish}>Finish</button>
        </div>
    );
}
