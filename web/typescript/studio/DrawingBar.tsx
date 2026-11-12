import * as React from 'react';
import { Kind } from '../adapters';
import {
    Drawing, INSTRUMENT_HINT, PLACE_HINT, barTitle, canFinish, endSnap, finishHint, instrumentTitle, isDrawingTool, noKindText, problemText,
    progressText, snapIndicatorText, startSnap
} from '../drawing';
import { DistanceUnits, exactDistanceText, typedUnitLabel } from '../geometry';
import { Glyph } from '../popupParts';
import { StudioTool } from '../studio';
import { ChromeGlyph } from './ChromeGlyph';
import { toolGlyph } from './DrawToolbar';

/**
 * The drawing bar (epic 4 entries 4 and 23; DESIGN.md Drawing bar, EXPERIENCE.md Drawing bar and Snap): a floating bar
 * bottom-centre while any tool is in hand, the one place Edit mode talks (owner, 2026-11-05: no mode pill, no toast, no
 * status box). It shows the kind's glyph and the tool named in words ("New gathering line", "New well pad"). For the
 * Line and Area tools: the progress ("2 points - 700 m - start floating", or "start snapped to CTB1"; before the first
 * vertex, where to click), the indicator "Snap to CTB1 - click to connect" only while Snap is on and a target is within
 * reach of the pointer (the toolbar's magnet says on or off; entry 23 dropped the "Snap on" and "Snap off" words), then
 * what keeps it from finishing in plain words ("A line needs two points", "The edges cross - Backspace removes the last
 * point") or the finish hint, and Cancel (Esc) and Finish, inert until the drawing is valid. For the Point tool: "Click
 * the map, then drag to fine-tune" and Done, which puts the tool down as Esc does. Each button names its key on hover and to
 * assistive technology (entry 25: "Cancel (Esc)", "Finish (Enter)", "Done (Esc)"; `aria-keyshortcuts`); an off Finish says why. With no kind for the tool in the kind
 * list, that is the problem it says. Its attributes are what the e2e suite reads.
 */
export interface DrawingBarProps {
    tool: StudioTool;
    /** The line or area in progress, or null while no vertex is placed yet (always null for the Point tool). */
    drawing: Drawing | null;
    /** The kind the tool adds, or null when the kind list has none for the tool. */
    kind: Kind | null;
    snap: boolean;
    /** The name of the target within reach of the pointer, or ''. */
    snapHint: string;
    /** The units in force (entry 20a): the progress's length is written in them. */
    units: DistanceUnits;
    onCancel: () => void;
    onFinish: () => void;
    /** The Point tool's Done: the tool put down, as Esc. */
    onDone: () => void;
}

function BarGlyph(props: { tool: StudioTool; kind: Kind | null }): React.ReactElement {
    return (
        <span className="mapstudio-drawing-glyph">
            {props.kind && props.kind.icon !== ''
                ? <Glyph id={props.kind.icon} className="mapstudio-drawing-kind-glyph" size={18} />
                : <ChromeGlyph name={toolGlyph(props.tool)} size={18} />}
        </span>
    );
}

export function DrawingBar(props: DrawingBarProps): React.ReactElement {
    const { drawing, kind, tool } = props;
    const missing = kind === null ? noKindText(tool) : '';
    if (!isDrawingTool(tool)) {
        // The Point tool (entry 23): the kind, how to place it, and Done.
        return (
            <div className="mapstudio-drawing-bar mapstudio-drawing-bar--point" role="group" aria-label="Adding a point" data-tool={tool}
                 data-points="0" data-valid="false" data-reason={missing}>
                <BarGlyph tool={tool} kind={kind} />
                <span className="mapstudio-drawing-words">
                    <span className="mapstudio-drawing-title">{barTitle(tool, kind)}</span>
                    {missing !== ''
                        ? <span className="mapstudio-drawing-hint mapstudio-drawing-hint--problem">{missing}</span>
                        : <span className="mapstudio-drawing-hint">{PLACE_HINT}</span>}
                </span>
                <button type="button" className="mapstudio-button mapstudio-button--primary mapstudio-drawing-done" title="Done (Esc)"
                        aria-keyshortcuts="Escape" onClick={props.onDone}>Done</button>
            </div>
        );
    }
    // With no kind for the tool nothing would be saved: that is the problem, and Finish stays inert.
    const valid = missing === '' && drawing !== null && canFinish(drawing);
    const problem = missing !== '' ? missing : drawing ? problemText(drawing) : '';
    const start = drawing ? startSnap(drawing) : null;
    const end = drawing ? endSnap(drawing) : null;
    const target = props.snap && props.snapHint !== '';
    const hint = problem !== '' ? problem : drawing ? finishHint(tool) : '';
    return (
        <div className="mapstudio-drawing-bar" role="group" aria-label="Drawing" data-tool={tool} data-points={String(drawing ? drawing.vertices.length : 0)}
             data-valid={valid ? 'true' : 'false'} data-reason={problem} data-snap={props.snap ? 'on' : 'off'} data-snap-target={props.snap ? props.snapHint : ''}
             data-snap-start={start ? start.name : ''} data-snap-end={end ? end.name : ''}>
            <BarGlyph tool={tool} kind={kind} />
            <span className="mapstudio-drawing-words">
                <span className="mapstudio-drawing-title">{barTitle(tool, kind)}</span>
                <span className="mapstudio-drawing-progress">{drawing ? progressText(drawing, props.units) : 'Click the map to add the first point'}</span>
                {target ? (
                    // Only while a target is within reach (entry 23): the toolbar's magnet says whether Snap is on.
                    <span className="mapstudio-drawing-snap mapstudio-drawing-snap--target" data-state="target">{snapIndicatorText(props.snapHint)}</span>
                ) : null}
                {hint !== '' ? (
                    <span className={'mapstudio-drawing-hint' + (problem !== '' ? ' mapstudio-drawing-hint--problem' : '')}>{hint}</span>
                ) : null}
            </span>
            <button type="button" className="mapstudio-button mapstudio-drawing-cancel" title="Cancel (Esc)" aria-keyshortcuts="Escape"
                    onClick={props.onCancel}>Cancel</button>
            <button type="button" className="mapstudio-button mapstudio-button--primary mapstudio-drawing-finish" disabled={!valid}
                    title={valid ? 'Finish (Enter)' : problem || 'Click the map to add points'} aria-keyshortcuts="Enter"
                    onClick={props.onFinish}>Finish</button>
        </div>
    );
}

/**
 * The drawing bar while an instrument is placed (epic 4 entry 9; EXPERIENCE.md Instruments and Drawing bar): Add an instrument in a
 * line's Details armed its kind, and the bar is the one place that talks. "New tap on L-SWD - click the line or type its distance",
 * a distance field in the units in force with the line's length beside it ("of 2,936 m", "of 9,633 ft"), Place (Enter in the field too) and Cancel (Esc). A
 * click off the line or a distance outside it is refused here in words (`problem`), nothing saved. The field takes the focus when
 * the bar opens, so the placement works from the keyboard alone; Esc in it puts the placement down. Its attributes are what the e2e
 * suite reads.
 */
export interface InstrumentBarProps {
    kind: Kind;
    lineId: string;
    lineName: string;
    lengthM: number;
    /** The units in force (entry 20a): the field's unit, the length beside it and a bare typed number are in them. */
    units: DistanceUnits;
    /** Why the last click or typed distance was refused, in words; '' when none. */
    problem: string;
    onPlace: (text: string) => void;
    onCancel: () => void;
}

export function InstrumentBar(props: InstrumentBarProps): React.ReactElement {
    const { kind, lineName, problem } = props;
    const [text, setText] = React.useState('');
    const field = React.useRef<HTMLInputElement>(null);
    React.useEffect(() => {
        if (field.current) {
            field.current.focus();
        }
    }, [props.lineId, kind.id]);
    const title = instrumentTitle(kind.name, lineName);
    const fieldId = 'mapstudio-instrument-distance';
    const problemId = fieldId + '-problem';
    const onKey = (ev: React.KeyboardEvent<HTMLInputElement>): void => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            props.onPlace(text);
        } else if (ev.key === 'Escape') {
            // The field's Esc puts the placement down here: the map's and the component's Esc never see it (one press, one step).
            ev.preventDefault();
            ev.stopPropagation();
            props.onCancel();
        }
    };
    return (
        <div className="mapstudio-drawing-bar mapstudio-drawing-bar--instrument" role="group" aria-label={title} data-tool="instrument"
             data-kind={kind.id} data-line-id={props.lineId} data-reason={problem}>
            <span className="mapstudio-drawing-glyph">
                {kind.icon !== '' ? <Glyph id={kind.icon} className="mapstudio-drawing-kind-glyph" size={18} /> : <ChromeGlyph name="pin" size={18} />}
            </span>
            <span className="mapstudio-drawing-words" aria-live="polite">
                <span className="mapstudio-drawing-title">{title + ' - ' + INSTRUMENT_HINT}</span>
                {problem !== '' ? <span id={problemId} className="mapstudio-drawing-hint mapstudio-drawing-hint--problem">{problem}</span> : null}
            </span>
            <span className="mapstudio-instrument-place">
                <label className="mapstudio-visually-hidden" htmlFor={fieldId}>Distance along {lineName} ({typedUnitLabel(props.units)})</label>
                <input id={fieldId} ref={field} className="mapstudio-input mapstudio-instrument-distance" type="text" inputMode="decimal" value={text}
                       placeholder={props.units.system === 'us' ? 'Feet' : 'Metres'} aria-invalid={problem !== ''} aria-describedby={problem !== '' ? problemId : undefined}
                       onChange={(ev) => setText(ev.target.value)} onKeyDown={onKey} />
                <span className="mapstudio-instrument-length">of {exactDistanceText(props.lengthM, props.units)}</span>
            </span>
            <button type="button" className="mapstudio-button mapstudio-drawing-cancel" title="Cancel (Esc)" aria-keyshortcuts="Escape"
                    onClick={props.onCancel}>Cancel</button>
            <button type="button" className="mapstudio-button mapstudio-button--primary mapstudio-instrument-place-button" title="Place (Enter)"
                    aria-keyshortcuts="Enter" onClick={() => props.onPlace(text)}>Place</button>
        </div>
    );
}
