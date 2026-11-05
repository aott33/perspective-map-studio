/**
 * The View-mode controls' pure parts (epic 3 entry 14, DESIGN.md zoom-control and legend): the zoom
 * level's words and the chrome glyphs the zoom card and the Legend button draw. The glyphs are on a
 * 24 px grid with a 2 px stroke in `currentColor` (DESIGN.md, Icons), so they take the control's text
 * colour from the theme and carry no colour of their own (AD-11). Unit tested in node.
 */

/** The zoom level as the card shows it between plus and minus: "z 15" (the nearest whole level). */
export function zoomLevelText(zoom: number): string {
    if (!Number.isFinite(zoom)) {
        return 'z ?';
    }
    return 'z ' + Math.round(zoom);
}

/** The chrome glyphs: SVG path data on a 24 px grid, stroked, no fill. */
export const GLYPH_PATHS = {
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    /** Fit: four corner brackets, as the mockups' zoom card draws it. */
    fit: 'M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4',
    /** Return: a target ring round a dot, re-centring on the selected item. */
    return: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10',
    /** Layers: the legend's glyph (DESIGN.md: a "Legend" button with a layers glyph). */
    layers: 'M12 4l8 4.5-8 4.5-8-4.5L12 4zM4 13l8 4.5 8-4.5M4 16.5L12 21l8-4.5',
    /** Search: a lens and its handle (DESIGN.md search-field, entry 9). */
    search: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13M15.5 15.5L20 20',
    /** Close: the Clear button of the search field. */
    close: 'M6 6l12 12M18 6L6 18',
    /** Chevron: the Needs you bar's open and close mark (entry 3), and the toolbar's Undo history (epic 4 entry 23). */
    chevron: 'M6 9l6 6 6-6',
    /** The studio's chrome (epic 4 entry 2; DESIGN.md Icons: UI chrome glyphs, one style, 24 px grid, 2 px stroke). */
    /** Eye: View on the rail and the Edit switch off ("Edit map"). */
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
    /** List: Items on the rail. */
    list: 'M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01',
    /** Kinds: a tag, on the rail and the Edit switch on ("Editing"). */
    kinds: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V4a1 1 0 0 1 1-1h9l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
    /** Pointer: the Select tool. */
    pointer: 'M5 3l14 8-6 1.5-1.5 6z',
    /** Pin: the Point tool. */
    pin: 'M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 11a2 2 0 1 0 0-4a2 2 0 1 0 0 4',
    /** Line: the Line tool. */
    line: 'M3 18l5-9 5 6 8-11',
    /** Area: the Area tool, an open ring of vertices (entry 4). */
    area: 'M5 8l7-4 7 5-2 8-9 3-5-5z M5 8h.01M12 4h.01M19 9h.01M17 17h.01M8 20h.01',
    /** Magnet: the Snap toggle (DESIGN.md Floating draw toolbar; entry 4). */
    magnet: 'M6 3v9a6 6 0 0 0 12 0V3M6 3h4v9a2 2 0 0 0 4 0V3h4M6 7h4M14 7h4',
    /** Undo and Redo: an arrow curling back, and forward. */
    undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
    redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
    /**
     * Cloud: a cloud struck through, the top-centre chip's glyph for a problem with the map store or the edits kept here
     * (epic 4 entry 24; DESIGN.md Icons names the cloud among the chrome glyphs). No alarm shape: no triangle, circle or square.
     */
    cloud: 'M7 18.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.6 9.3a4.6 4.6 0 0 1-.6 9.2zM4 4l16 16'
} as const;

export type GlyphName = keyof typeof GLYPH_PATHS;

/** One glyph as inline SVG markup, hidden from assistive technology (the button's label carries the words). */
export function glyphSvg(name: GlyphName, className: string): string {
    return '<svg class="' + className + '" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">'
        + '<path d="' + GLYPH_PATHS[name] + '" fill="none" stroke="currentColor" stroke-width="2" '
        + 'stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

/** The return glyph's ring needs a fill-free dot: the dot is a second element. */
export function returnGlyphSvg(className: string): string {
    return '<svg class="' + className + '" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">'
        + '<path d="' + GLYPH_PATHS.return + '" fill="none" stroke="currentColor" stroke-width="2" '
        + 'stroke-linecap="round" stroke-linejoin="round"/>'
        + '<circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>';
}
