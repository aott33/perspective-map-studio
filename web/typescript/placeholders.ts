/**
 * The closed placeholder list of a kind setup and its fill, browser side (AD-7, epic 2
 * story 9). Mirrors common/.../contract/Placeholders.java, which the Gateway validates
 * with; both test the same vectors. Pure, unit tested in node; epic-viewing fills with it.
 */

export const ITEM_ID = '{item.id}';
export const ITEM_NAME = '{item.name}';
export const ASSET_ID = '{asset.id}';
export const ASSET_PATH = '{asset.path}';
/** `{item.properties.X}`: this prefix, a form field key, then "}". */
export const PROPERTY_PREFIX = '{item.properties.';

/** What a placeholder is filled from: one map item and its asset (null when it has none). */
export interface ItemView {
    itemId: string;
    itemName: string;
    assetId: string | null;
    assetPath: string | null;
    properties: Record<string, unknown>;
}

function valueOf(p: string, item: ItemView): string | null {
    switch (p) {
        case ITEM_ID:
            return item.itemId;
        case ITEM_NAME:
            return item.itemName;
        case ASSET_ID:
            return item.assetId;
        case ASSET_PATH:
            return item.assetPath;
        default:
            break;
    }
    if (!p.startsWith(PROPERTY_PREFIX) || !item.properties) {
        return null;
    }
    const v = item.properties[p.substring(PROPERTY_PREFIX.length, p.length - 1)];
    if (typeof v === 'string' || typeof v === 'boolean') {
        return String(v);
    }
    if (typeof v === 'number' && isFinite(v)) {
        return String(v);
    }
    return null;
}

/**
 * `template` with every placeholder filled from `item`, or null when one has no value (no
 * asset, a property not set or not a plain value) or the template has an unknown
 * placeholder or a brace with no partner. Never throws. `{asset.path}/Pressure` for pad P12
 * whose base path is `[default]Mesa/P12` gives `[default]Mesa/P12/Pressure`.
 */
export function fill(template: string | null | undefined, item: ItemView | null | undefined): string | null {
    if (typeof template !== 'string' || !item) {
        return null;
    }
    let out = '';
    let i = 0;
    while (i < template.length) {
        const c = template.charAt(i);
        if (c === '}') {
            return null;
        }
        if (c !== '{') {
            out += c;
            i++;
            continue;
        }
        const end = template.indexOf('}', i);
        if (end < 0) {
            return null;
        }
        const value = valueOf(template.substring(i, end + 1), item);
        if (value === null) {
            return null;
        }
        out += value;
        i = end + 1;
    }
    return out;
}

/** True for `{asset.path}/` and a non-empty suffix with no braces: a tag path below the item's asset. */
export function isAssetRelative(path: string): boolean {
    const prefix = ASSET_PATH + '/';
    if (!path.startsWith(prefix) || path.length === prefix.length) {
        return false;
    }
    const suffix = path.substring(prefix.length);
    return suffix.indexOf('{') < 0 && suffix.indexOf('}') < 0 && suffix.trim() !== '';
}
