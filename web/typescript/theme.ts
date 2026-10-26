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
