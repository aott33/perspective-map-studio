import * as React from 'react';
import { Kind } from '../adapters';
import { snapToggleText } from '../drawing';
import { Glyph } from '../popupParts';
import { StudioTool, kindButtons, toolOf } from '../studio';
import { ChromeGlyph } from './ChromeGlyph';

/**
 * The floating draw toolbar and the mode pill (epic 4 entries 2 and 4; DESIGN.md draw-toolbar and mode-pill,
 * EXPERIENCE.md Floating draw toolbar, Mode pill and Snap): top-centre over the map, in groups divided by thin
 * rules: Select; the kind buttons (the kind list's first kinds, up to three, each drawing its kind at once);
 * the generic Point, Line and Area tools (the kind picked in the form after); and the Snap toggle with the
 * magnet glyph and "Snap off" or "Snap on" (off by default). The active tool is tinted in the selection token,
 * and under the toolbar the pill names the mode in words (FR-8). While the map store is unreachable the toolbar
 * fades and takes no input (`paused`). Box select, the lasso and the instrument tool are entries 8 and 9.
 */
export interface DrawToolbarProps {
    tool: StudioTool | null;
    /** The kind a kind button fixed (its id), or null for a generic tool. */
    toolKind: string | null;
    /** The project's kind list; the toolbar takes its first kinds as the buttons. */
    kinds: Kind[];
    snap: boolean;
    pill: string;
    paused: boolean;
    onSelect: () => void;
    onTool: (tool: StudioTool, kindId: string | null) => void;
    onSnap: () => void;
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
    const generic = (tool: StudioTool, name: string): React.ReactElement => {
        const active = props.tool === tool && props.toolKind === null;
        return (
            <button type="button" key={tool} className={'mapstudio-tool mapstudio-tool--' + tool + (active ? ' mapstudio-tool--active' : '')}
                    aria-pressed={active} title={name} aria-label={name + ': ' + toolWords(tool)} disabled={props.paused}
                    data-tool={tool} onClick={active ? props.onSelect : () => props.onTool(tool, null)}>
                <ChromeGlyph name={toolGlyph(tool)} />
            </button>
        );
    };
    return (
        <div className={'mapstudio-toolbar-float' + (props.paused ? ' mapstudio-toolbar-float--paused' : '')} data-tool={props.tool || 'select'}
             data-tool-kind={props.toolKind || ''}>
            <div className="mapstudio-toolbar" role="toolbar" aria-label="Drawing tools">
                <button type="button" className={'mapstudio-tool mapstudio-tool--select' + (props.tool === null ? ' mapstudio-tool--active' : '')}
                        aria-pressed={props.tool === null} title="Select" aria-label="Select" disabled={props.paused} onClick={props.onSelect}>
                    <ChromeGlyph name="pointer" />
                </button>
                {buttons.length > 0 ? <span className="mapstudio-toolbar-divider" aria-hidden="true" /> : null}
                {buttons.map((kind) => {
                    const tool = toolOf(kind);
                    const active = props.tool === tool && props.toolKind === kind.id;
                    return (
                        <button type="button" key={kind.id} className={'mapstudio-tool mapstudio-tool--kind' + (active ? ' mapstudio-tool--active' : '')}
                                aria-pressed={active} title={kind.name} aria-label={kind.name + ': ' + toolWords(tool)} disabled={props.paused}
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
                        aria-pressed={props.snap} title={props.snap ? 'Snap on: a vertex lands on the nearest item or vertex within reach' : 'Snap off'}
                        disabled={props.paused} data-snap={props.snap ? 'on' : 'off'} onClick={props.onSnap}>
                    <ChromeGlyph name="magnet" />
                    <span className="mapstudio-tool-word">{snapToggleText(props.snap)}</span>
                </button>
            </div>
            <div className="mapstudio-pill" role="status" data-tool={props.tool || 'select'}>
                <ChromeGlyph name={toolGlyph(props.tool)} className="mapstudio-pill-glyph" size={16} />
                <span className="mapstudio-pill-words">{props.paused ? 'Paused - the map store is unreachable' : props.pill}</span>
            </div>
        </div>
    );
}
