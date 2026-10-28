/**
 * The map markers' look (DESIGN.md: map marker, state word chip, alarm glyph usage, map line;
 * epic 3 entries 5 and 7), pure: the feature properties the symbol layers read, the image ids a
 * marker state names, the SVG each image is drawn from, the label text and its rank, and a line's
 * weight, hue and dash. The rasterising (an Image, a canvas, `map.addImage`) is MapStudio.tsx's;
 * everything here runs in node for the tests.
 *
 * Images hold no text (entry 7, UX review M1): the marker image is the neutral disc with the kind
 * glyph, the ring look (dashed for comms lost and stale), the state badge top-right and the
 * priority digit, one image per icon, look, badge and selection; a normal item below zoom 14 is a
 * dot in a 44 px image, so its hit area stays; the chip is a 9-slice box the state word is set in;
 * the arrow is the flow arrow of the selected line. The name, the state word ("Stale", "Comms
 * lost", decision D5) and the icon KPI are symbol-layer text in the bundled glyphs (NotoSans-SemiBold,
 * NotoSans-Medium; web/scripts/glyphs.mjs) with a halo, colliding and giving way by `rank`.
 *
 * Colours are theme tokens read from the component root (theme.ts), never literals: the comms-lost
 * hue is `--mapstudio-comms-lost`, the alarm hues `--mapstudio-alarm-1` to `-3`, the selection
 * `--callToAction`; the disc, the glyph, the text, the halo, the dot and the lines are neutral tokens.
 *
 * Value styles (epic 3 entry 1, AD-11): a style rule's preset draws on the marker as its ring
 * (`attention` a heavier neutral ring, `warning` and `fault` a ring in their tokens, `dimmed` the
 * disc faded with a dashed neutral ring) with the preset's word in the chip, never colour alone;
 * comms lost and stale replace the ring (the Gateway drops the style meanwhile) and the alarm badge
 * draws over any of them. A line takes the hue, the word, the `dashed` and `dotted` patterns and the
 * `dimmed` fade; an area its category tint (`--mapstudio-tint-1` to `-6`); every token stands in
 * until entry 12 reviews the hues (docs/styles.md).
 */

import advances from '../fonts/advances.json';
import { ItemState, PointPreset, Preset, Tint, itemPreset } from './live';

/** The theme colours the images and the text layers need, read once from the component root. */
export interface MarkerColors {
    /** The disc and chip fill (`--container`). */
    disc: string;
    /** The glyph, the text and the neutral ring (`--label`). */
    glyph: string;
    /** The halo round the disc and the text (`--containerRoot`). */
    halo: string;
    /** Secondary text: a stale KPI (`--label--disabled`). */
    textSecondary: string;
    /** The dot below zoom 14 and the pipeline grey (`--neutral-60`). */
    line: string;
    /** The chip's edge (`--neutral-50`). */
    chipEdge: string;
    /** The selection ring, casing and arrow (`--callToAction`). */
    selection: string;
    /** The comms-lost token. */
    commsLost: string;
    /** The three alarm priority tokens. */
    alarm: [string, string, string];
    /** The host theme's font family (the digit in the badge image). */
    font: string;
    /** The attention preset's ring (`--mapstudio-attention`, no hue: a heavier neutral). */
    attention: string;
    /** The warning preset's token. */
    warning: string;
    /** The fault preset's token. */
    fault: string;
    /** The six area tints, `tint-1` to `tint-6`. */
    tints: [string, string, string, string, string, string];
}

/** The presets a point draws on its marker, each with its word (said beside the name, never colour alone). */
export const PRESET_WORDS: Record<Preset, string> = {
    'normal': '', 'attention': 'Attention', 'warning': 'Warning', 'fault': 'Fault', 'dimmed': 'Out of service',
    'solid': '', 'dashed': '', 'dotted': ''
};

/** The preset a point draws: a line preset on a point reads as normal. */
export function pointPreset(preset: Preset): PointPreset {
    return preset === 'attention' || preset === 'warning' || preset === 'fault' || preset === 'dimmed' ? preset : 'normal';
}

/** The token value of a preset's hue, or '' for the neutral ones (normal, dimmed and the line patterns). */
export function presetColor(preset: Preset, colors: MarkerColors): string {
    return preset === 'attention' ? colors.attention : preset === 'warning' ? colors.warning : preset === 'fault' ? colors.fault : '';
}

/** The token value of a tint. */
export function tintColor(tint: Tint, colors: MarkerColors): string {
    return colors.tints[Number(tint.substring('tint-'.length)) - 1] || '';
}

/** The dimmed preset's opacity (DESIGN.md: faded and dashed). */
export const DIMMED_OPACITY = 0.45;
/** The area fill's and outline's opacity: a low-saturation wash of the tint token, the outline firmer. */
export const AREA_FILL_OPACITY = 0.22;
export const AREA_LINE_OPACITY = 0.8;
export const AREA_LINE_WIDTH = 1.5;

/** The CSS custom properties the colours come from, in the order tried (the first that resolves wins). */
export const MARKER_TOKENS = {
    disc: ['--container'],
    glyph: ['--label', '--neutral-70'],
    halo: ['--containerRoot'],
    textSecondary: ['--label--disabled', '--neutral-70'],
    line: ['--neutral-60', '--label'],
    chipEdge: ['--neutral-50', '--border'],
    selection: ['--callToAction'],
    commsLost: ['--mapstudio-comms-lost', '--qual-1'],
    alarm1: ['--mapstudio-alarm-1', '--error'],
    alarm2: ['--mapstudio-alarm-2', '--warning'],
    alarm3: ['--mapstudio-alarm-3', '--info'],
    attention: ['--mapstudio-attention', '--neutral-90', '--label'],
    warning: ['--mapstudio-warning', '--warning'],
    fault: ['--mapstudio-fault', '--error'],
    tint1: ['--mapstudio-tint-1', '--qual-3'],
    tint2: ['--mapstudio-tint-2', '--qual-7'],
    tint3: ['--mapstudio-tint-3', '--qual-2'],
    tint4: ['--mapstudio-tint-4', '--qual-9'],
    tint5: ['--mapstudio-tint-5', '--qual-10'],
    tint6: ['--mapstudio-tint-6', '--qual-8']
} as const;

export type MarkerLook = 'normal' | 'comms-lost' | 'stale';

/** One marker's state, the image id's content. */
export interface MarkerSpec {
    icon: string;
    look: MarkerLook;
    /** The badge glyph: `alarm-<p>-unacknowledged`, `alarm-<p>-acknowledged`, `alarm-3`, `comms-lost`, `stale` or ''. */
    badge: string;
    /** The alarm priority 1 to 3, 0 for no alarm. */
    priority: number;
    /** Unacknowledged draws the solid badge; acknowledged the hollow one. */
    solid: boolean;
    /** The selection ring outside a gap. */
    selected: boolean;
    /** The value style's preset on the ring (entry 1); normal while the look is comms lost or stale. */
    preset: PointPreset;
}

/** The properties of a point feature that the marker and label layers read. */
export interface MarkerProperties {
    id: string;
    name: string;
    kind: string;
    /** The marker image id (the disc with the glyph and the badge). */
    marker: string;
    /** The image from zoom 12 to 14: the 11 px dot for a normal item, the marker for an abnormal one. */
    dotMid: string;
    /** The image below zoom 12: the 7 px dot for a normal item, the marker for an abnormal one. */
    dotSmall: string;
    /** 'alarm', 'comms-lost', 'stale' or 'normal' (tests read it). */
    state: string;
    /** The label's rank: lower is placed first (alarm, comms lost, stale, then the kind list's label rank). */
    rank: number;
    /** The state chip's word ('Comms lost', 'Stale'), or ''. */
    word: string;
    /** The icon KPI's text with its unit, or ''. */
    kpi: string;
    kpiStale: boolean;
    /** The chip text's offset right of the point, in ems of the chip's text size: half the name plus the gap and the chip's padding. */
    chipOffset: number;
    /** How many map items this marker stands for (2 or more for a shared marker). */
    members: number;
    /** The member ids of a shared marker, comma separated ('' for one item). */
    memberIds: string;
    selected: boolean;
}

/** The image ids' prefixes. */
export const IMAGE_PREFIX = 'ms:marker:';
export const DOT_PREFIX = 'ms:dot:';
export const BADGE_PREFIX = 'ms:badge:';
export const CHIP_IMAGE = 'ms:chip';
export const ARROW_IMAGE = 'ms:arrow';

/**
 * The marker image: the disc at DISC_CENTER with room for the badge top-right and the digit beside
 * it, and no more: the image's box is what the labels keep clear of (icons are placed first), so
 * it is kept tight, the disc 20 px from the left edge and the digit's room on the right.
 */
export const MARKER_IMAGE = { width: 56, height: 46 };
/** The disc's centre in the marker image (the point the marker is anchored at) and its radius. */
export const DISC_CENTER: [number, number] = [20, 23];
export const DISC_RADIUS = 17;
/** The dot images: the dot centred in a 44 px square, the template's hit area. */
export const DOT_IMAGE = 44;
export const DOT_MID = 11;
export const DOT_SMALL = 7;
/** The badge image (a line's midpoint glyph): the badge and the digit. */
export const BADGE_IMAGE = { width: 40, height: 24 };
/**
 * The chip: a 9-slice box, stretched round the word (icon-text-fit). MapLibre grows a 9-slice
 * icon's collision box by the image's border outside `content`, so the content area is the whole
 * image but one pixel (the rounded corners stay in CHIP_PADDING's side room) and the box stays the
 * word's box plus the padding.
 */
export const CHIP_IMAGE_SIZE = 20;
export const CHIP_CONTENT: [number, number, number, number] = [1, 1, 19, 19];
export const CHIP_STRETCH: [number, number] = [6, 14];
export const CHIP_PADDING: [number, number, number, number] = [2, 5, 2, 5];
export const ARROW_IMAGE_SIZE = 22;

/** The zoom bands (DESIGN.md map-marker, R3, decisions D4): the disc and name from 14, the KPI from 15, the mid dot from 12. */
export const ZOOM_NAME = 14;
export const ZOOM_KPI = 15;
export const ZOOM_DOT = 12;
/** The text sizes (DESIGN.md typography: map-label 12/600, state-word 11/500, the KPI at 90 %). */
export const NAME_SIZE = 12;
export const CHIP_SIZE = 11;
export const KPI_SIZE = 11;
export const HALO_WIDTH = 2;
/**
 * The name's top below the point: clear of the marker image's bottom edge (MARKER_IMAGE.height -
 * DISC_CENTER[1]), the text padding and one more pixel, since a touching box counts as a collision.
 */
export const TEXT_PADDING = 1;
export const NAME_TOP_PX = MARKER_IMAGE.height - DISC_CENTER[1] + TEXT_PADDING + 3;
/** A line's name chip below its midpoint, in ems of CHIP_SIZE: under the line, and under the badge when the line has one. */
export const LINE_CHIP_OFFSET_EM = 1.4;
export const LINE_CHIP_OFFSET_BADGE_EM = 2.1;
/** The KPI's top below the point: under the name's box (its line height of 1.2 em at NAME_SIZE, the padding and a gap). */
export const KPI_TOP_PX = NAME_TOP_PX + 18;
/** The gap between the name's text and the chip's text: the name box's padding, the chip's left padding, its 1 px border and 2 px clear. */
export const CHIP_GAP_PX = 9;
/** The font stacks of the bundled glyphs (web/fonts/sources.json). */
export const FONT_NAME = 'NotoSans-SemiBold';
export const FONT_CHIP = 'NotoSans-Medium';

/** The rank of the label: the selected item first, then the states, then the kind list's label rank (higher keeps its label longer). */
export const RANK_SELECTED = -1;
export const RANK_ALARM = 0;
export const RANK_COMMS_LOST = 3;
export const RANK_STALE = 4;
/** A value style other than normal (fault, warning, attention) keeps its label ahead of normal items. */
export const RANK_STYLE = 5;
export const RANK_NORMAL = 5;
export const LABEL_RANK_MAX = 99;

export function labelRank(state: ItemState, kindLabelRank: number, selected: boolean): number {
    if (selected) {
        return RANK_SELECTED;
    }
    if (state.alarm) {
        return RANK_ALARM + state.alarm.priority - 1;
    }
    if (state.commsLost) {
        return RANK_COMMS_LOST;
    }
    if (state.stale) {
        return RANK_STALE;
    }
    const preset = itemPreset(state);
    if (preset === 'fault' || preset === 'warning' || preset === 'attention') {
        return RANK_STYLE;
    }
    const rank = Math.max(0, Math.min(LABEL_RANK_MAX, Math.round(kindLabelRank) || 0));
    return RANK_NORMAL + (LABEL_RANK_MAX - rank);
}

/** The marker spec for one point from its icon id, its live state and whether it is selected. */
export function markerSpec(icon: string, state: ItemState, selected = false): MarkerSpec {
    const look: MarkerLook = state.commsLost ? 'comms-lost' : state.stale ? 'stale' : 'normal';
    let badge = '';
    let priority = 0;
    let solid = false;
    if (state.alarm) {
        priority = state.alarm.priority;
        solid = state.alarm.unacked;
        badge = priority === 3 ? 'alarm-3' : 'alarm-' + priority + (solid ? '-unacknowledged' : '-acknowledged');
    } else if (state.commsLost) {
        badge = 'comms-lost';
    } else if (state.stale) {
        badge = 'stale';
    }
    // The value style draws only on a fresh item: comms lost and stale replace it (the Gateway drops it too).
    const preset = look === 'normal' ? pointPreset(itemPreset(state)) : 'normal';
    return { icon: icon || 'point', look, badge, priority, solid, selected, preset };
}

export function markerImageId(spec: MarkerSpec): string {
    return IMAGE_PREFIX + JSON.stringify([spec.icon, spec.look, spec.badge, spec.priority, spec.solid, spec.selected, spec.preset]);
}

export function dotImageId(size: number, selected: boolean): string {
    return DOT_PREFIX + JSON.stringify([size, selected]);
}

export function badgeImageId(badge: string, priority: number, solid: boolean): string {
    return BADGE_PREFIX + JSON.stringify([badge, priority, solid]);
}

/**
 * The state word the chip shows beside the name (decision D5: the short form; the popup says the
 * rest): comms lost, stale, else the value style's word (entry 1; the style is dropped while stale).
 */
export function stateWord(state: ItemState): string {
    return state.commsLost ? 'Comms lost' : state.stale ? 'Stale' : PRESET_WORDS[itemPreset(state)];
}

/** The bundled fonts' ASCII advances at 24 px (web/fonts/advances.json, kept in step with the fonts by glyphs.mjs --check). */
const ADVANCES = advances as { size: number; stacks: Record<string, Record<string, number>> };
/** The advance of a character outside ASCII, in ems. */
const ADVANCE_OTHER_EM = 0.6;

/**
 * A text's width in px at a size, as MapLibre shapes it from the bundled glyphs (the sum of the
 * rounded advances, no letter spacing), for the chip's place beside the name and the e2e overlap
 * check; a character outside ASCII counts ADVANCE_OTHER_EM.
 */
export function textWidthPx(text: string, sizePx: number, font: string = FONT_NAME): number {
    const table = ADVANCES.stacks[font] || ADVANCES.stacks[FONT_NAME] || {};
    let units = 0;
    for (const ch of text) {
        const advance = table[ch];
        units += typeof advance === 'number' ? advance : ADVANCE_OTHER_EM * ADVANCES.size;
    }
    return (units * sizePx) / ADVANCES.size;
}

/** The chip text's offset in ems of CHIP_SIZE: half the name, the gap and the chip's left padding. */
export function chipOffsetEm(name: string): number {
    return (textWidthPx(name, NAME_SIZE) / 2 + CHIP_GAP_PX + CHIP_PADDING[1]) / CHIP_SIZE;
}

/** The feature properties for one point (or a shared marker, `members` 2 or more). */
export function markerProperties(id: string, name: string, kind: string, icon: string, state: ItemState,
                                 options: { labelRank?: number; selected?: boolean; members?: string[] } = {}): MarkerProperties {
    const selected = options.selected === true;
    const spec = markerSpec(icon, state, selected);
    const marker = markerImageId(spec);
    const abnormal = state.badge !== 'normal';
    const members = options.members && options.members.length > 1 ? options.members : [];
    return {
        id, name, kind, marker,
        dotMid: abnormal ? marker : dotImageId(DOT_MID, selected),
        dotSmall: abnormal ? marker : dotImageId(DOT_SMALL, selected),
        state: state.badge,
        rank: labelRank(state, options.labelRank || 0, selected),
        word: stateWord(state),
        // The KPI line only for an item with a live value (UX review M4): a shared marker and a slot with no value show none.
        kpi: members.length > 0 || !state.iconKpi || !state.iconKpi.hasValue ? '' : state.iconKpi.text,
        kpiStale: !!state.iconKpi && state.iconKpi.stale,
        chipOffset: chipOffsetEm(name),
        members: Math.max(1, members.length),
        memberIds: members.join(','),
        selected
    };
}

/**
 * The line's look (DESIGN.md map-line; entry 7 decision 4, entry 1): weight by pipe size, hue from
 * the line's alarm, else from its value style (`attention`, `warning`, `fault`); dashed for no data,
 * comms lost or the `dashed` preset; dotted for the `dotted` preset; faded for `dimmed`.
 */
export interface LineLook {
    /** 3, 4 or 6 px by pipe size with an instrument on the line; 2 px (untapped) without. */
    weight: number;
    /** 'alarm-1' to 'alarm-3', 'attention', 'warning', 'fault', or '' for the pipeline grey. */
    hue: string;
    dashed: boolean;
    /** The `dotted` preset (never with dashed: a stale line dashes). */
    dotted: boolean;
    /** The `dimmed` preset: the line at DIMMED_OPACITY. */
    dimmed: boolean;
    /** The badge at the midpoint (an alarm), or ''. */
    badge: string;
    priority: number;
    solid: boolean;
}

export const LINE_WEIGHTS: [number, number, number] = [3, 4, 6];
export const LINE_UNTAPPED = 2;

/** The weight for a pipe size in inches: 3 px up to 4 in, 4 px up to 8 in, 6 px above; 3 px when unknown. */
export function lineWeight(sizeIn: unknown): number {
    const n = typeof sizeIn === 'number' ? sizeIn : typeof sizeIn === 'string' ? Number(sizeIn) : NaN;
    if (!isFinite(n) || n <= 0) {
        return LINE_WEIGHTS[0];
    }
    return n <= 4 ? LINE_WEIGHTS[0] : n <= 8 ? LINE_WEIGHTS[1] : LINE_WEIGHTS[2];
}

/**
 * A line's look from its state (its own kind setup's slots), its pipe size and whether an instrument
 * sits on it. Without an instrument the whole line is one untapped segment (2 px); a state still draws.
 */
export function lineLook(state: ItemState, sizeIn: unknown, hasInstruments: boolean): LineLook {
    const weight = hasInstruments ? lineWeight(sizeIn) : LINE_UNTAPPED;
    const spec = markerSpec('', state);
    // No data is a comms or value slot with no value yet, which the Gateway reports stale; a stale
    // line drops its value style (the Gateway sends normal then).
    const stale = state.commsLost || state.stale;
    const preset: Preset = stale ? 'normal' : itemPreset(state);
    const styleHue = preset === 'attention' || preset === 'warning' || preset === 'fault' ? preset : '';
    return {
        weight,
        hue: state.alarm ? 'alarm-' + state.alarm.priority : styleHue,
        dashed: stale || preset === 'dashed',
        dotted: !stale && preset === 'dotted',
        dimmed: preset === 'dimmed',
        badge: state.alarm ? spec.badge : '',
        priority: spec.priority,
        solid: spec.solid
    };
}

/** The properties of a line feature the line layers read. */
export interface LineProperties {
    id: string;
    name: string;
    kind: string;
    weight: number;
    /** The resolved colour (a token value), for the data-driven line-color. */
    color: string;
    hue: string;
    dashed: boolean;
    dotted: boolean;
    dimmed: boolean;
    selected: boolean;
}

export function lineProperties(id: string, name: string, kind: string, look: LineLook, colors: MarkerColors, selected: boolean): LineProperties {
    const color = look.hue === 'alarm-1' ? colors.alarm[0] : look.hue === 'alarm-2' ? colors.alarm[1]
        : look.hue === 'alarm-3' ? colors.alarm[2] : look.hue === 'attention' ? colors.attention
        : look.hue === 'warning' ? colors.warning : look.hue === 'fault' ? colors.fault : colors.line;
    return { id, name, kind, weight: look.weight, color, hue: look.hue, dashed: look.dashed, dotted: look.dotted,
        dimmed: look.dimmed, selected };
}

/** The properties of an area feature (a line kind with `area: true`), its fill and outline from its tint. */
export interface AreaProperties {
    id: string;
    name: string;
    kind: string;
    /** The tint name, or '' for the neutral area look. */
    tint: string;
    /** The resolved fill and outline colour: the tint's token value, or the neutral line token. */
    color: string;
    selected: boolean;
}

export function areaProperties(id: string, name: string, kind: string, tint: Tint | null, colors: MarkerColors, selected: boolean): AreaProperties {
    return { id, name, kind, tint: tint || '', color: tint ? tintColor(tint, colors) || colors.line : colors.line, selected };
}

/** What an image id names. */
export type ImageSpec =
    | { kind: 'marker'; spec: MarkerSpec }
    | { kind: 'dot'; size: number; selected: boolean }
    | { kind: 'badge'; badge: string; priority: number; solid: boolean }
    | { kind: 'chip' }
    | { kind: 'arrow' };

/** The spec an image id names, or null when it is not one of ours. */
export function parseImageId(id: string): ImageSpec | null {
    if (id === CHIP_IMAGE) {
        return { kind: 'chip' };
    }
    if (id === ARROW_IMAGE) {
        return { kind: 'arrow' };
    }
    const parts = (prefix: string): unknown[] | null => {
        if (!id.startsWith(prefix)) {
            return null;
        }
        try {
            const parsed = JSON.parse(id.substring(prefix.length));
            return Array.isArray(parsed) ? parsed : null;
        } catch (err) {
            return null;
        }
    };
    const marker = parts(IMAGE_PREFIX);
    if (marker) {
        if (marker.length !== 7 || typeof marker[0] !== 'string') {
            return null;
        }
        const look = marker[1];
        if (look !== 'normal' && look !== 'comms-lost' && look !== 'stale') {
            return null;
        }
        const preset = marker[6];
        if (preset !== 'normal' && preset !== 'attention' && preset !== 'warning' && preset !== 'fault' && preset !== 'dimmed') {
            return null;
        }
        return {
            kind: 'marker',
            spec: { icon: marker[0], look, badge: String(marker[2]), priority: Number(marker[3]) || 0, solid: marker[4] === true,
                selected: marker[5] === true, preset }
        };
    }
    const dot = parts(DOT_PREFIX);
    if (dot) {
        const size = Number(dot[0]);
        if (dot.length !== 2 || !(size > 0)) {
            return null;
        }
        return { kind: 'dot', size, selected: dot[1] === true };
    }
    const badge = parts(BADGE_PREFIX);
    if (badge) {
        if (badge.length !== 3 || typeof badge[0] !== 'string' || badge[0] === '') {
            return null;
        }
        return { kind: 'badge', badge: badge[0], priority: Number(badge[1]) || 0, solid: badge[2] === true };
    }
    return null;
}

/** The symbol's inner markup and its root attributes, as the sprite holds them. */
export interface SpriteSymbol {
    /** The root attributes of the icon (fill, stroke, stroke-width, ...), without id, xmlns and viewBox. */
    attributes: string;
    inner: string;
}

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function glyphAt(s: SpriteSymbol | undefined, x: number, y: number, size: number, color: string): string {
    if (!s) {
        return '';
    }
    const scale = size / 24;
    return `<g transform="translate(${x} ${y}) scale(${scale})" color="${esc(color)}"><svg ${s.attributes} width="24" height="24" viewBox="0 0 24 24">${s.inner}</svg></g>`;
}

/** The badge (the state glyph on its disc) and the digit, drawn with the badge's centre at (bx, by). */
function badgeAt(badge: string, priority: number, solid: boolean, bx: number, by: number, symbols: Record<string, SpriteSymbol>,
                 colors: MarkerColors): string {
    if (!badge) {
        return '';
    }
    const alarm = priority >= 1 && priority <= 3;
    const hue = alarm ? colors.alarm[priority - 1] : badge === 'comms-lost' ? colors.commsLost : colors.glyph;
    let out: string;
    if (alarm && solid) {
        out = `<circle cx="${bx}" cy="${by}" r="9" fill="${esc(hue)}" stroke="${esc(colors.halo)}" stroke-width="1.5"/>`
            + glyphAt(symbols[badge], bx - 6, by - 6, 12, colors.disc);
    } else {
        out = `<circle cx="${bx}" cy="${by}" r="8.5" fill="${esc(colors.disc)}" stroke="${esc(hue)}" stroke-width="2"/>`
            + glyphAt(symbols[badge], bx - 6, by - 6, 12, hue);
    }
    if (alarm) {
        out += `<text x="${bx + 11}" y="${by + 4.5}" font-family="${esc(colors.font)}" font-size="12" font-weight="700" fill="${esc(hue)}" stroke="${esc(colors.halo)}" stroke-width="3" paint-order="stroke" text-anchor="start">${priority}</text>`;
    }
    return out;
}

function svg(width: number, height: number, body: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
}

/**
 * The SVG text of one marker image (MARKER_IMAGE): the disc centred at DISC_CENTER with a 2 px halo,
 * a dashed ring for comms lost (in the comms-lost token) and stale (neutral), the kind glyph, the
 * badge at the top-right with the digit beside it, and the selection ring outside a gap. A missing
 * kind glyph falls back to `point`. Every colour is a token value passed in; no text but the digit.
 */
export function markerSvg(spec: MarkerSpec, symbols: Record<string, SpriteSymbol>, colors: MarkerColors): string {
    const [cx, cy] = DISC_CENTER;
    const r = DISC_RADIUS;
    const hue = spec.look === 'comms-lost' ? colors.commsLost : colors.glyph;
    const preset = spec.look === 'normal' ? spec.preset : 'normal';
    let body = '';
    if (spec.selected) {
        body += `<circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="none" stroke="${esc(colors.selection)}" stroke-width="2"/>`;
    }
    // The dimmed preset fades the disc and its glyph (DESIGN.md: faded and dashed); the badge stays full.
    let disc = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${esc(colors.disc)}" stroke="${esc(colors.halo)}" stroke-width="${HALO_WIDTH}"/>`;
    if (spec.look !== 'normal') {
        disc += `<circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="none" stroke="${esc(hue)}" stroke-width="2" stroke-dasharray="3 3"/>`;
    } else if (preset === 'attention') {
        disc += `<circle cx="${cx}" cy="${cy}" r="${r - 1.5}" fill="none" stroke="${esc(colors.attention)}" stroke-width="3"/>`;
    } else if (preset === 'warning' || preset === 'fault') {
        disc += `<circle cx="${cx}" cy="${cy}" r="${r - 1.25}" fill="none" stroke="${esc(presetColor(preset, colors))}" stroke-width="2.5"/>`;
    } else if (preset === 'dimmed') {
        disc += `<circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="none" stroke="${esc(colors.line)}" stroke-width="1.5" stroke-dasharray="2 2"/>`;
    } else {
        disc += `<circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="none" stroke="${esc(colors.line)}" stroke-width="1.5"/>`;
    }
    disc += glyphAt(symbols[spec.icon] || symbols.point, cx - 10, cy - 10, 20, hue);
    body += preset === 'dimmed' ? `<g opacity="${DIMMED_OPACITY}">${disc}</g>` : disc;
    body += badgeAt(spec.badge, spec.priority, spec.solid, cx + 13, cy - 13, symbols, colors);
    return svg(MARKER_IMAGE.width, MARKER_IMAGE.height, body);
}

/** The line patterns the layers use, in units of the line width: dashed 8 6 (DESIGN.md) at the untapped weight, dotted round dots. */
export const LINE_DASH: [number, number] = [2.5, 2];
export const LINE_DOT: [number, number] = [0.01, 2.2];

/**
 * A line sample for the preview (StylePreview): a 64 by 16 px line in the preset's look, the hue
 * (an alarm never draws here), the dash or dots, the fade. Only token values.
 */
export function lineSampleSvg(preset: Preset, colors: MarkerColors): string {
    const look = lineLook({ commsLost: false, stale: false, alarm: null, iconKpi: null, badge: 'normal', preset }, 6, true);
    const color = look.hue === 'attention' ? colors.attention : look.hue === 'warning' ? colors.warning
        : look.hue === 'fault' ? colors.fault : colors.line;
    const w = look.weight;
    const dash = look.dashed ? ` stroke-dasharray="${LINE_DASH[0] * w} ${LINE_DASH[1] * w}"`
        : look.dotted ? ` stroke-dasharray="${LINE_DOT[0] * w} ${LINE_DOT[1] * w}" stroke-linecap="round"` : '';
    const opacity = look.dimmed ? ` opacity="${DIMMED_OPACITY}"` : '';
    return svg(64, 16, `<path d="M4 8 L60 8" fill="none" stroke="${esc(color)}" stroke-width="${w}"${dash}${opacity}/>`);
}

/** A tint swatch for the preview: the area fill and outline look in a 64 by 32 px box. */
export function tintSampleSvg(tint: Tint | null, colors: MarkerColors): string {
    const color = tint ? tintColor(tint, colors) || colors.line : colors.line;
    return svg(64, 32, `<rect x="2" y="2" width="60" height="28" rx="3" fill="${esc(color)}" fill-opacity="${AREA_FILL_OPACITY}"`
        + ` stroke="${esc(color)}" stroke-opacity="${AREA_LINE_OPACITY}" stroke-width="${AREA_LINE_WIDTH}"/>`);
}

/** A normal item below zoom 14: a dot of `size` px in the DOT_IMAGE square, with the halo and the selection ring. */
export function dotSvg(size: number, selected: boolean, colors: MarkerColors): string {
    const c = DOT_IMAGE / 2;
    const r = size / 2;
    let body = '';
    if (selected) {
        body += `<circle cx="${c}" cy="${c}" r="${r + 5}" fill="none" stroke="${esc(colors.selection)}" stroke-width="2"/>`;
    }
    body += `<circle cx="${c}" cy="${c}" r="${r}" fill="${esc(colors.line)}" stroke="${esc(colors.halo)}" stroke-width="${HALO_WIDTH}"/>`;
    return svg(DOT_IMAGE, DOT_IMAGE, body);
}

/** A line's midpoint badge with its digit (BADGE_IMAGE), the badge's centre at (12, 12). */
export function badgeSvg(badge: string, priority: number, solid: boolean, symbols: Record<string, SpriteSymbol>, colors: MarkerColors): string {
    return svg(BADGE_IMAGE.width, BADGE_IMAGE.height, badgeAt(badge, priority, solid, 12, 12, symbols, colors));
}

/** The chip box: the panel fill, a 1 px edge, 3 px corners, over a 1 px halo; sliced at CHIP_CONTENT. */
export function chipSvg(colors: MarkerColors): string {
    const s = CHIP_IMAGE_SIZE;
    return svg(s, s,
        `<rect x="1" y="1" width="${s - 2}" height="${s - 2}" rx="4" fill="none" stroke="${esc(colors.halo)}" stroke-width="2"/>`
        + `<rect x="1.5" y="1.5" width="${s - 3}" height="${s - 3}" rx="3" fill="${esc(colors.disc)}" stroke="${esc(colors.chipEdge)}" stroke-width="1"/>`);
}

/** The flow arrow of the selected line: a chevron pointing up (rotated along the line's bearing), in the selection token with a halo. */
export function arrowSvg(colors: MarkerColors): string {
    const s = ARROW_IMAGE_SIZE;
    const path = `M${s / 2} 3 L${s - 4} ${s - 6} L${s / 2} ${s - 10} L4 ${s - 6} Z`;
    return svg(s, s,
        `<path d="${path}" fill="${esc(colors.halo)}" stroke="${esc(colors.halo)}" stroke-width="4" stroke-linejoin="round"/>`
        + `<path d="${path}" fill="${esc(colors.selection)}" stroke="none"/>`);
}

/** The SVG, size and (for the chip) the 9-slice metadata of any image id of ours; null for an id that is not. */
export function imageFor(id: string, symbols: Record<string, SpriteSymbol>, colors: MarkerColors):
    { svg: string; width: number; height: number; content?: [number, number, number, number]; stretchX?: Array<[number, number]>; stretchY?: Array<[number, number]> } | null {
    const parsed = parseImageId(id);
    if (!parsed) {
        return null;
    }
    switch (parsed.kind) {
        case 'marker':
            return { svg: markerSvg(parsed.spec, symbols, colors), width: MARKER_IMAGE.width, height: MARKER_IMAGE.height };
        case 'dot':
            return { svg: dotSvg(parsed.size, parsed.selected, colors), width: DOT_IMAGE, height: DOT_IMAGE };
        case 'badge':
            return { svg: badgeSvg(parsed.badge, parsed.priority, parsed.solid, symbols, colors), width: BADGE_IMAGE.width, height: BADGE_IMAGE.height };
        case 'chip':
            return {
                svg: chipSvg(colors), width: CHIP_IMAGE_SIZE, height: CHIP_IMAGE_SIZE, content: CHIP_CONTENT,
                stretchX: [CHIP_STRETCH], stretchY: [CHIP_STRETCH]
            };
        case 'arrow':
            return { svg: arrowSvg(colors), width: ARROW_IMAGE_SIZE, height: ARROW_IMAGE_SIZE };
        default:
            return null;
    }
}

/** The symbols of the served sprite (`<symbol id="ms-<id>" ...>inner</symbol>`), by icon id. Pure. */
export function parseSprite(text: string): Record<string, SpriteSymbol> {
    const out: Record<string, SpriteSymbol> = {};
    const re = /<symbol\s+([^>]*)>([\s\S]*?)<\/symbol>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        const attrs = m[1];
        const idMatch = /\bid="ms-([^"]+)"/.exec(attrs);
        if (!idMatch) {
            continue;
        }
        const attributes = attrs
            .replace(/\bid="[^"]*"/, '')
            .replace(/\bviewBox="[^"]*"/, '')
            .replace(/\bxmlns="[^"]*"/, '')
            .trim();
        out[idMatch[1]] = { attributes, inner: m[2].trim() };
    }
    return out;
}
