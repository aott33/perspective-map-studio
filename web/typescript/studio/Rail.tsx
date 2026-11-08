import * as React from 'react';
import { StudioSurface } from '../studio';
import { ChromeGlyph } from './ChromeGlyph';

/**
 * The mode rail (epic 4 entry 2; DESIGN.md mode-rail, EXPERIENCE.md Mode rail): View, Items, Kinds
 * and Layers stacked, each a glyph over a tiny label; the active surface takes the hover surface and
 * bold text. View leaves Edit mode; the others switch the surface and keep the map and the selection.
 * Import is epic 5's. Rendered by MapStudio beside the map in Edit mode at level `full`.
 *
 * Below 1280 px (entry 7c, `collapsed`) the list is not docked and Items is the button that opens it over the map: it says so
 * with `aria-expanded`, and reads active only while the list is open; Items again closes it.
 */
export interface RailProps {
    surface: StudioSurface;
    onView: () => void;
    onSurface: (surface: StudioSurface) => void;
    /** Below 1280 px: the list is not docked (entry 7c). */
    collapsed?: boolean;
    /** The collapsed list open over the map. */
    listOpen?: boolean;
}

export function Rail(props: RailProps): React.ReactElement {
    const item = (key: StudioSurface, label: string, glyph: 'list' | 'kinds' | 'layers'): React.ReactElement => {
        const opens = key === 'items' && !!props.collapsed;
        const active = props.surface === key && (!opens || !!props.listOpen);
        return (
            <button type="button" key={key} className={'mapstudio-rail-item' + (active ? ' mapstudio-rail-item--active' : '')}
                    data-surface={key} aria-pressed={opens ? undefined : active} aria-expanded={opens ? active : undefined}
                    title={opens ? (active ? 'Items - close the list' : 'Items - open the list') : label} onClick={() => props.onSurface(key)}>
                <ChromeGlyph name={glyph} className="mapstudio-rail-glyph" />
                <span className="mapstudio-rail-label">{label}</span>
            </button>
        );
    };
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
