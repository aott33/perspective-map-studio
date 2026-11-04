import * as React from 'react';
import { StudioSurface } from '../studio';
import { ChromeGlyph } from './ChromeGlyph';

/**
 * The mode rail (epic 4 entry 2; DESIGN.md mode-rail, EXPERIENCE.md Mode rail): View, Items, Kinds
 * and Layers stacked, each a glyph over a tiny label; the active surface takes the hover surface and
 * bold text. View leaves Edit mode; the others switch the surface and keep the map and the selection.
 * Import is epic 5's. Rendered by MapStudio beside the map in Edit mode at level `full`.
 */
export function Rail(props: { surface: StudioSurface; onView: () => void; onSurface: (surface: StudioSurface) => void }): React.ReactElement {
    const item = (key: StudioSurface, label: string, glyph: 'list' | 'kinds' | 'layers'): React.ReactElement => (
        <button type="button" key={key} className={'mapstudio-rail-item' + (props.surface === key ? ' mapstudio-rail-item--active' : '')}
                data-surface={key} aria-pressed={props.surface === key} title={label} onClick={() => props.onSurface(key)}>
            <ChromeGlyph name={glyph} className="mapstudio-rail-glyph" />
            <span className="mapstudio-rail-label">{label}</span>
        </button>
    );
    return (
        <nav className="mapstudio-rail" aria-label="Map studio">
            <button type="button" className="mapstudio-rail-item" data-surface="view" title="View the map" onClick={props.onView}>
                <ChromeGlyph name="eye" className="mapstudio-rail-glyph" />
                <span className="mapstudio-rail-label">View</span>
            </button>
            {item('items', 'Items', 'list')}
            {item('kinds', 'Kinds', 'kinds')}
            {item('layers', 'Layers', 'layers')}
        </nav>
    );
}
