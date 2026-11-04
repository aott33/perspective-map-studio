import * as React from 'react';
import { GLYPH_PATHS, GlyphName } from '../controls';

/**
 * A chrome glyph of the studio's surfaces (epic 4 entry 2) as a React element: the same path data the
 * map's controls draw (controls.ts), on a 24 px grid with a 2 px stroke in `currentColor` (DESIGN.md
 * Icons), hidden from assistive technology since its button carries the words.
 */
export function ChromeGlyph(props: { name: GlyphName; className?: string; size?: number }): React.ReactElement {
    const size = props.size || 20;
    return (
        <svg className={props.className || 'mapstudio-ctrl-glyph'} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
            <path d={GLYPH_PATHS[props.name]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
