/**
 * The legend's pure part (epic 3 entry 3, R14; prd FR-41; DESIGN.md legend; EXPERIENCE.md Legend):
 * the key of every glyph and line look the map draws, in the map's own words, built from the loaded
 * items, the kind list and the kind display; and the Lines and Names toggles' memory for the browser
 * session. The kinds listed are the ones with a live item on the map, in the kind list's order; the
 * state and line rows are fixed; the value styles show only when a kind setup has a style rule and
 * the area tints only when one has them. Colours are never named here: each row carries a token
 * class the stylesheet resolves (AD-11). Unit tested in node.
 */

import { Kind } from './adapters';
import { MapItemRecord } from './contract';
import { KindDisplay, Preset, Tint } from './live';
import { PRESET_WORDS } from './markers';

export interface LegendKindRow {
    id: string;
    name: string;
    icon: string;
    /** How the kind draws: a point marker, a line, or an area. */
    draw: 'point' | 'line' | 'area';
}

/** A state row: the badge glyph as the marker draws it (solid in the priority's token, hollow when acknowledged). */
export interface LegendStateRow {
    /** The sprite symbol id. */
    glyph: string;
    /** The token class: `alarm-1`, `alarm-2`, `alarm-3`, `comms-lost` or `stale`. */
    token: string;
    solid: boolean;
    words: string;
}

/** A line look row: the sample's weight, dash and token. */
export interface LegendLineRow {
    weight: number;
    dashed: boolean;
    /** The token class: `line` (the pipeline grey), `lateral` (the thin untapped line) or `alarm-1`. */
    token: string;
    words: string;
}

/** A value style row: the preset and its word, drawn as the point ring and the chip word are. */
export interface LegendStyleRow {
    preset: Preset;
    words: string;
}

/** An area tint row: the category and its tint (null for the neutral look). */
export interface LegendTintRow {
    kindName: string;
    category: string;
    tint: Tint | null;
}

export interface LegendKey {
    kinds: LegendKindRow[];
    states: LegendStateRow[];
    lines: LegendLineRow[];
    styles: LegendStyleRow[];
    tints: LegendTintRow[];
}

/** The note under the toggles (DESIGN.md legend, the zoom 14 rule). */
export const ZOOM_NOTE = 'Below zoom 14 sites show as dots';

/** The state rows, fixed: the alarm glyphs by priority and acknowledgement, comms lost and stale (DESIGN.md alarm-glyph). */
export const STATE_ROWS: LegendStateRow[] = [
    { glyph: 'alarm-1-unacknowledged', token: 'alarm-1', solid: true, words: 'Priority 1 alarm, digit beside' },
    { glyph: 'alarm-2-unacknowledged', token: 'alarm-2', solid: true, words: 'Priority 2 alarm' },
    { glyph: 'alarm-3', token: 'alarm-3', solid: false, words: 'Priority 3 alarm' },
    { glyph: 'alarm-1-acknowledged', token: 'alarm-1', solid: false, words: 'Acknowledged' },
    { glyph: 'comms-lost', token: 'comms-lost', solid: false, words: 'Comms lost' },
    { glyph: 'stale', token: 'stale', solid: false, words: 'Stale value' }
];

/** The line rows, fixed (DESIGN.md map-line): weight by size, thin without instruments, dashed, the alarm hue. */
export const LINE_ROWS: LegendLineRow[] = [
    { weight: 4, dashed: false, token: 'line', words: 'Pipeline, weight by size' },
    { weight: 2, dashed: false, token: 'lateral', words: 'Thin: no instruments' },
    { weight: 4, dashed: true, token: 'line', words: 'Dashed: no data or comms lost' },
    { weight: 4, dashed: false, token: 'alarm-1', words: 'Hue: the highest alarm' }
];

/** The value styles a style rule may draw on a point (the line patterns are looks, not states). */
export const STYLE_ROWS: LegendStyleRow[] = [
    { preset: 'attention', words: PRESET_WORDS.attention },
    { preset: 'warning', words: PRESET_WORDS.warning },
    { preset: 'fault', words: PRESET_WORDS.fault },
    { preset: 'dimmed', words: PRESET_WORDS.dimmed }
];

/** The key for the loaded map. Pure. */
export function legendKey(items: readonly MapItemRecord[], kinds: readonly Kind[], display: Readonly<Record<string, KindDisplay>>): LegendKey {
    const inUse = new Set<string>();
    for (const item of items) {
        if (!item.deleted) {
            inUse.add(item.kind);
        }
    }
    const kindRows: LegendKindRow[] = [];
    let anyRule = false;
    const tints: LegendTintRow[] = [];
    for (const kind of kinds) {
        if (!inUse.has(kind.id)) {
            continue;
        }
        kindRows.push({
            id: kind.id, name: kind.name, icon: kind.icon,
            draw: kind.geometry === 'point' ? 'point' : kind.area ? 'area' : 'line'
        });
        const d = display[kind.id];
        if (d && d.styleRule) {
            anyRule = true;
        }
        if (d && d.areaTints && d.areaTints.tints.length > 0) {
            for (const t of d.areaTints.tints) {
                tints.push({ kindName: kind.name, category: t.category, tint: t.tint });
            }
            tints.push({ kindName: kind.name, category: 'No category', tint: null });
        }
    }
    return { kinds: kindRows, states: STATE_ROWS, lines: LINE_ROWS, styles: anyRule ? STYLE_ROWS : [], tints };
}

export type LegendToggle = 'lines' | 'names';

/** The session storage keys the toggles are remembered under (per browser session, EXPERIENCE.md Legend). */
export const TOGGLE_KEYS: Record<LegendToggle, string> = { lines: 'mapstudio.legend.lines.v1', names: 'mapstudio.legend.names.v1' };

/** A store with the two methods the toggles use (sessionStorage, or a stand-in in tests). */
export interface ToggleStore {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

/** `sessionStorage`, or null when the browser refuses it (a private window, blocked site data). */
export function sessionStore(): ToggleStore | null {
    try {
        return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
    } catch (err) {
        return null;
    }
}

/** The remembered state of a toggle: on unless the store says 'off'. */
export function readToggle(store: ToggleStore | null, toggle: LegendToggle): boolean {
    try {
        return !store || store.getItem(TOGGLE_KEYS[toggle]) !== 'off';
    } catch (err) {
        return true;
    }
}

/** Remember a toggle for the session; a refusing store is ignored. */
export function writeToggle(store: ToggleStore | null, toggle: LegendToggle, on: boolean): void {
    try {
        if (store) {
            store.setItem(TOGGLE_KEYS[toggle], on ? 'on' : 'off');
        }
    } catch (err) {
        // A browser that refuses storage keeps the toggles for the page only.
    }
}
