/**
 * Theme tokens (AD-11). Every colour the map draws comes from the host
 * project's Perspective theme, read as a CSS custom property from the
 * component's root element. MapLibre paint cannot take `var()`, so the
 * computed value is read once when the map is created. When a token is not
 * defined (no theme loaded) the colour is left transparent, never invented.
 */
export function themeColor(root: Element | undefined | null, token: string): string {
    if (!root || typeof getComputedStyle !== 'function') {
        return 'transparent';
    }
    const value = getComputedStyle(root).getPropertyValue(token).trim();
    return value !== '' ? value : 'transparent';
}

/** A colour in the `#rrggbb` form Terra Draw's styles accept. */
export type HexColor = `#${string}`;

const HEX6 = /^#([0-9a-f]{6})$/i;
const HEX3 = /^#([0-9a-f]{3})$/i;
const RGB = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/i;

function channel(n: number): string {
    const clamped = Math.max(0, Math.min(255, n));
    return (clamped < 16 ? '0' : '') + clamped.toString(16);
}

/**
 * Converts a computed CSS colour to `#rrggbb`: `#rgb`, `#rrggbb`, `rgb(r, g, b)`
 * and `rgba(r, g, b, a)` (alpha dropped) are accepted; anything else, including
 * '' and 'transparent', gives null. Terra Draw takes hex colours only, while the
 * browser reports computed custom properties as the author wrote them.
 */
export function toHexColor(value: string | null | undefined): HexColor | null {
    if (!value) {
        return null;
    }
    const v = value.trim();
    const six = HEX6.exec(v);
    if (six) {
        return ('#' + six[1].toLowerCase()) as HexColor;
    }
    const three = HEX3.exec(v);
    if (three) {
        const [r, g, b] = three[1].toLowerCase().split('');
        return ('#' + r + r + g + g + b + b) as HexColor;
    }
    const rgb = RGB.exec(v);
    if (rgb) {
        return ('#' + channel(+rgb[1]) + channel(+rgb[2]) + channel(+rgb[3])) as HexColor;
    }
    return null;
}

/** Token lists already warned about, so a missing token logs once. */
const warned: { [tokens: string]: boolean } = {};

/**
 * The first token in `tokens` that resolves on `root` to a colour `toHexColor`
 * accepts, for Terra Draw's styles. With none, returns null and warns once per
 * token list, so the caller leaves the style key unset rather than inventing a
 * colour.
 */
export function drawColor(root: Element | undefined | null, tokens: string[]): HexColor | null {
    for (const token of tokens) {
        const hex = toHexColor(themeColor(root, token));
        if (hex) {
            return hex;
        }
    }
    const key = tokens.join(',');
    if (!warned[key]) {
        warned[key] = true;
        console.warn('[MapStudio] No theme colour found for ' + tokens.join(', ') + '; the drawing tool keeps its library default.');
    }
    return null;
}
