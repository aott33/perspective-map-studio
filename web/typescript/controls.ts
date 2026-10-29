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
    close: 'M6 6l12 12M18 6L6 18'
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
