import * as React from 'react';
import { Kind } from '../adapters';
import { snapTitle } from '../drawing';
import { Glyph } from '../popupParts';
import { StudioTool, kindButtons, toolOf } from '../studio';
import { UndoStack, busyText, redoLabel, undoHistory, undoLabel } from '../undoStack';
import { ChromeGlyph } from './ChromeGlyph';
import { PAUSED_TEXT, UndoGroup } from './UndoGroup';

/**
 * The floating draw toolbar (epic 4 entries 2, 4 and 23; DESIGN.md draw-toolbar, EXPERIENCE.md Floating draw toolbar,
 * Snap, Undo and Redo): top-centre over the map, in groups divided by thin rules: Select; the kind buttons (the kind
 * list's first kinds, up to three, each drawing its kind at once); the generic Point, Line and Area tools (the kind
 * picked in the form after); Snap, the magnet glyph alone (off by default), tinted when on and saying on or off on hover;
 * then Undo with the chevron opening its history, and Redo, each naming its step on hover (UndoGroup, entry 23). The
 * active tool is tinted in the selection token and named on hover and to assistive technology (its title, its label and
 * `aria-pressed`); the mode pill that named it in words under the toolbar left Edit mode with entry 23 (owner,
 * 2026-11-05): while a tool is in hand the drawing bar says it. While the map store is unreachable the toolbar fades and
 * takes no input (`paused`), every button saying so on hover. Box select, the lasso and the instrument tool are entries 8 and 9.
 */
/** Select's hover text (epic 4 entry 8; DESIGN.md Floating draw toolbar): its ways to select several. */
export const SELECT_TITLE = 'Select (Shift-drag for a box, Shift+Alt-drag for a lasso)';

export interface DrawToolbarProps {
    tool: StudioTool | null;
    /** The kind a kind button fixed (its id), or null for a generic tool. */
    toolKind: string | null;
    /** The project's kind list; the toolbar takes its first kinds as the buttons. */
    kinds: Kind[];
    snap: boolean;
    paused: boolean;
    /** This session's undo stack (undoStack.ts): Undo's and Redo's steps and the history. */
    undo: UndoStack;
    /** A tool's or a field's edit is being saved (the delegate's `editInFlight`): Undo, Redo and the history wait, "Saving...". */
    editInFlight?: boolean;
    onSelect: () => void;
    onTool: (tool: StudioTool, kindId: string | null) => void;
    onSnap: () => void;
    onUndo: () => void;
    onRedo: () => void;
    /** A history row chosen: undo that many steps, the newest first, one at a time. */
    onUndoTo: (count: number) => void;
    /** The clock the history's times are read against; Date.now unless a test fixes it. */
    now?: () => number;
}

/** The chrome glyph of a tool. */
export function toolGlyph(tool: StudioTool | null): 'pointer' | 'pin' | 'line' | 'area' {
    return tool === 'point' ? 'pin' : tool === 'line' ? 'line' : tool === 'area' ? 'area' : 'pointer';
}

/** What a tool does, for the button's accessible name. */
function toolWords(tool: StudioTool): string {
    return tool === 'point' ? 'add a point by clicking the map' : tool === 'line' ? 'draw a line, click to add points' : 'draw an area, click to add points';
}

export function DrawToolbar(props: DrawToolbarProps): React.ReactElement {
    const buttons = kindButtons(props.kinds);
    // Undo and Redo wait, saying why, while a reverse or an edit is in flight (entry 23): no step is named meanwhile.
    const busy = busyText(props.undo, !!props.editInFlight);
    const generic = (tool: StudioTool, name: string): React.ReactElement => {
        const active = props.tool === tool && props.toolKind === null;
        return (
            <button type="button" key={tool} className={'mapstudio-tool mapstudio-tool--' + tool + (active ? ' mapstudio-tool--active' : '')}
                    aria-pressed={active} title={props.paused ? PAUSED_TEXT : name} aria-label={name + ': ' + toolWords(tool)} disabled={props.paused}
                    data-tool={tool} onClick={active ? props.onSelect : () => props.onTool(tool, null)}>
                <ChromeGlyph name={toolGlyph(tool)} />
            </button>
        );
    };
    return (
        <div className={'mapstudio-toolbar-float' + (props.paused ? ' mapstudio-toolbar-float--paused' : '')} data-tool={props.tool || 'select'}
             data-tool-kind={props.toolKind || ''}>
            <div className="mapstudio-toolbar" role="toolbar" aria-label={props.paused ? 'Drawing tools - ' + PAUSED_TEXT : 'Drawing tools'}
                 data-paused={props.paused ? 'true' : 'false'}>
                <button type="button" className={'mapstudio-tool mapstudio-tool--select' + (props.tool === null ? ' mapstudio-tool--active' : '')}
                        aria-pressed={props.tool === null} title={props.paused ? PAUSED_TEXT : SELECT_TITLE} aria-label="Select" disabled={props.paused}
                        aria-keyshortcuts="Escape" onClick={props.onSelect}>
                    <ChromeGlyph name="pointer" />
                </button>
                {buttons.length > 0 ? <span className="mapstudio-toolbar-divider" aria-hidden="true" /> : null}
                {buttons.map((kind) => {
                    const tool = toolOf(kind);
                    const active = props.tool === tool && props.toolKind === kind.id;
                    return (
                        <button type="button" key={kind.id} className={'mapstudio-tool mapstudio-tool--kind' + (active ? ' mapstudio-tool--active' : '')}
                                aria-pressed={active} title={props.paused ? PAUSED_TEXT : kind.name} aria-label={kind.name + ': ' + toolWords(tool)}
                                disabled={props.paused}
                                data-kind={kind.id} data-tool={tool} onClick={active ? props.onSelect : () => props.onTool(tool, kind.id)}>
                            {kind.icon !== '' ? <Glyph id={kind.icon} className="mapstudio-tool-kind-glyph" size={20} /> : <ChromeGlyph name={toolGlyph(tool)} />}
                        </button>
                    );
                })}
                <span className="mapstudio-toolbar-divider" aria-hidden="true" />
                {generic('point', 'Point')}
                {generic('line', 'Line')}
                {generic('area', 'Area')}
                <span className="mapstudio-toolbar-divider" aria-hidden="true" />
                <button type="button" className={'mapstudio-tool mapstudio-tool--snap' + (props.snap ? ' mapstudio-tool--active' : '')}
                        aria-pressed={props.snap} title={props.paused ? PAUSED_TEXT : snapTitle(props.snap)} aria-label="Snap" disabled={props.paused}
                        data-snap={props.snap ? 'on' : 'off'} onClick={props.onSnap}>
                    <ChromeGlyph name="magnet" />
                </button>
                <span className="mapstudio-toolbar-divider" aria-hidden="true" />
                <UndoGroup undoLabel={busy !== '' ? '' : undoLabel(props.undo)}
                           redoLabel={busy !== '' ? '' : redoLabel(props.undo)}
                           history={undoHistory(props.undo)}
                           busy={busy}
                           paused={props.paused}
                           onUndo={props.onUndo}
                           onRedo={props.onRedo}
                           onUndoTo={props.onUndoTo}
                           now={props.now} />
            </div>
        </div>
    );
}
