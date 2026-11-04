import * as React from 'react';
import { StudioTool } from '../studio';
import { ChromeGlyph } from './ChromeGlyph';

/**
 * The floating draw toolbar and the mode pill (epic 4 entry 2; DESIGN.md draw-toolbar and mode-pill,
 * EXPERIENCE.md Floating draw toolbar and Mode pill): top-centre over the map, Select and the generic
 * Point tool (the kind buttons, Line, Area, Snap and the instrument tool are entries 4 and 9), the
 * active tool tinted in the selection token, and under it the pill naming the mode in words (FR-8).
 * While the map store is unreachable the toolbar fades and takes no input (`paused`).
 */
export function DrawToolbar(props: { tool: StudioTool | null; pill: string; paused: boolean; onSelect: () => void; onPoint: () => void }): React.ReactElement {
    const placing = props.tool === 'point';
    return (
        <div className={'mapstudio-toolbar-float' + (props.paused ? ' mapstudio-toolbar-float--paused' : '')} data-tool={props.tool || 'select'}>
            <div className="mapstudio-toolbar" role="toolbar" aria-label="Drawing tools">
                <button type="button" className={'mapstudio-tool mapstudio-tool--select' + (props.tool === null ? ' mapstudio-tool--active' : '')}
                        aria-pressed={props.tool === null} title="Select" aria-label="Select" disabled={props.paused} onClick={props.onSelect}>
                    <ChromeGlyph name="pointer" />
                </button>
                <span className="mapstudio-toolbar-divider" aria-hidden="true" />
                <button type="button" className={'mapstudio-tool mapstudio-tool--point' + (placing ? ' mapstudio-tool--active' : '')}
                        aria-pressed={placing} title="Point" aria-label="Point: add a point by clicking the map" disabled={props.paused}
                        onClick={placing ? props.onSelect : props.onPoint}>
                    <ChromeGlyph name="pin" />
                </button>
            </div>
            <div className="mapstudio-pill" role="status" data-tool={props.tool || 'select'}>
                <ChromeGlyph name={placing ? 'pin' : props.tool === 'line' ? 'pointer' : 'pointer'} className="mapstudio-pill-glyph" size={16} />
                <span className="mapstudio-pill-words">{props.paused ? 'Paused - the map store is unreachable' : props.pill}</span>
            </div>
        </div>
    );
}
