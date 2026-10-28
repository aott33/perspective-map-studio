/**
 * The point markers' look (DESIGN.md, map marker and alarm glyph usage; epic 3 entry 5), pure:
 * the feature properties the marker layer reads, the image id a marker state names, and the SVG
 * the image is drawn from. The rasterising (an Image, a canvas, `map.addImage`) is MapStudio.tsx's;
 * everything here runs in node for the tests.
 *
 * One image per distinct marker state: the neutral disc with the kind glyph (a dashed ring in the
 * comms-lost token or the neutral token for comms lost and stale), the state badge top-right
 * (the alarm glyph on a solid disc in the priority hue when unacknowledged, on a hollow disc when
 * acknowledged; the comms-lost or stale glyph), the priority digit beside the badge, and under the
 * disc the icon KPI's text and the state word. Text is drawn into the image because the blank
 * style has no glyph source for MapLibre's text layers (labels are entry 7's).
 *
 * Colours are theme tokens read from the component root (theme.ts), never literals: the comms-lost
 * hue is the token `--mapstudio-comms-lost` (plan decision 6), the alarm hues `--mapstudio-alarm-1`
 * to `-3`; the disc, the glyph, the text and the halo are the neutral tokens.
 */

import { ItemState } from './live';

/** The theme colours a marker image needs, read once from the component root. */
export interface MarkerColors {
    /** The disc fill (`--container`). */
    disc: string;
    /** The glyph, the text and the neutral ring (`--label`). */
    glyph: string;
    /** The halo round the disc and the text (`--containerRoot`). */
    halo: string;
    /** The comms-lost token. */
    commsLost: string;
    /** The three alarm priority tokens. */
    alarm: [string, string, string];
    /** The host theme's font family, for the text in the image. */
    font: string;
}

/** The CSS custom properties the colours come from, in the order tried (the first that resolves wins). */
export const MARKER_TOKENS = {
    disc: ['--container'],
    glyph: ['--label', '--neutral-70'],
    halo: ['--containerRoot'],
    commsLost: ['--mapstudio-comms-lost', '--qual-1'],
    alarm1: ['--mapstudio-alarm-1', '--error'],
    alarm2: ['--mapstudio-alarm-2', '--warning'],
    alarm3: ['--mapstudio-alarm-3', '--info']
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
    /** The KPI line under the disc, or ''. */
    kpi: string;
    /** The state word under the KPI ('Comms lost', 'Stale'), or ''. */
    word: string;
}

/** The properties of a point feature that the marker layer reads. */
export interface MarkerProperties {
    id: string;
    name: string;
    kind: string;
    /** The marker image id. */
    marker: string;
    /** 'alarm', 'comms-lost', 'stale' or 'normal' (tests read it). */
    state: string;
}

export const IMAGE_PREFIX = 'ms:marker:';
/** The image: the disc area on top, then two text lines. */
export const IMAGE_WIDTH = 160;
export const DISC_AREA = 44;
export const LINE_HEIGHT = 15;
export const IMAGE_HEIGHT = DISC_AREA + 2 * LINE_HEIGHT;
/** The disc's centre in the image (the point the marker is anchored at). */
export const DISC_CENTER: [number, number] = [IMAGE_WIDTH / 2, DISC_AREA / 2];

/** The marker spec for one point from its icon id and its live state. */
export function markerSpec(icon: string, state: ItemState): MarkerSpec {
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
    const word = state.commsLost ? 'Comms lost' : state.stale ? 'Stale' : '';
    const kpi = state.iconKpi ? (state.iconKpi.stale ? 'Stale - ' : '') + state.iconKpi.text : '';
    return { icon: icon || 'point', look, badge, priority, solid, kpi, word };
}

export function markerImageId(spec: MarkerSpec): string {
    return IMAGE_PREFIX + JSON.stringify([spec.icon, spec.look, spec.badge, spec.priority, spec.solid, spec.kpi, spec.word]);
}

/** The feature properties for one point. */
export function markerProperties(id: string, name: string, kind: string, icon: string, state: ItemState): MarkerProperties {
    return { id, name, kind, marker: markerImageId(markerSpec(icon, state)), state: state.badge };
}

/** The spec an image id names, or null when it is not one of ours. */
export function parseImageId(id: string): MarkerSpec | null {
    if (!id.startsWith(IMAGE_PREFIX)) {
        return null;
    }
    try {
        const parts = JSON.parse(id.substring(IMAGE_PREFIX.length));
        if (!Array.isArray(parts) || parts.length !== 7 || typeof parts[0] !== 'string') {
            return null;
        }
        const look = parts[1];
        if (look !== 'normal' && look !== 'comms-lost' && look !== 'stale') {
            return null;
        }
        return {
            icon: parts[0], look, badge: String(parts[2]), priority: Number(parts[3]) || 0, solid: parts[4] === true,
            kpi: String(parts[5]), word: String(parts[6])
        };
    } catch (err) {
        return null;
    }
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

/**
 * The SVG text of one marker image (`IMAGE_WIDTH` by `IMAGE_HEIGHT` px): the disc centred at
 * `DISC_CENTER`, the badge at its top-right, the digit beside the badge, the KPI line and the word
 * below. A missing kind glyph falls back to `point`. Every colour is a token value passed in.
 */
export function markerSvg(spec: MarkerSpec, symbols: Record<string, SpriteSymbol>, colors: MarkerColors): string {
    const [cx, cy] = DISC_CENTER;
    const r = 14;
    const hue = spec.look === 'comms-lost' ? colors.commsLost : colors.glyph;
    let disc = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${esc(colors.disc)}" stroke="${esc(colors.halo)}" stroke-width="2"/>`;
    if (spec.look !== 'normal') {
        disc += `<circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="none" stroke="${esc(hue)}" stroke-width="2" stroke-dasharray="3 3"/>`;
    }
    const kind = glyphAt(symbols[spec.icon] || symbols.point, cx - 9, cy - 9, 18, hue);
    let badge = '';
    let digit = '';
    if (spec.badge) {
        const bx = cx + 11;
        const by = cy - 11;
        const alarm = spec.priority >= 1 && spec.priority <= 3;
        const badgeHue = alarm ? colors.alarm[spec.priority - 1] : spec.badge === 'comms-lost' ? colors.commsLost : colors.glyph;
        if (alarm && spec.solid) {
            badge = `<circle cx="${bx}" cy="${by}" r="9" fill="${esc(badgeHue)}" stroke="${esc(colors.halo)}" stroke-width="1.5"/>`
                + glyphAt(symbols[spec.badge], bx - 6, by - 6, 12, colors.disc);
        } else {
            badge = `<circle cx="${bx}" cy="${by}" r="8.5" fill="${esc(colors.disc)}" stroke="${esc(badgeHue)}" stroke-width="2"/>`
                + glyphAt(symbols[spec.badge], bx - 6, by - 6, 12, badgeHue);
        }
        if (alarm) {
            digit = `<text x="${bx + 11}" y="${by + 4.5}" font-family="${esc(colors.font)}" font-size="12" font-weight="700" fill="${esc(badgeHue)}" stroke="${esc(colors.halo)}" stroke-width="3" paint-order="stroke" text-anchor="start">${spec.priority}</text>`;
        }
    }
    const line = (text: string, y: number, color: string, weight: string): string => text === '' ? ''
        : `<text x="${cx}" y="${y}" font-family="${esc(colors.font)}" font-size="12" font-weight="${weight}" fill="${esc(color)}" stroke="${esc(colors.halo)}" stroke-width="3" paint-order="stroke" text-anchor="middle">${esc(text)}</text>`;
    const kpi = line(spec.kpi, DISC_AREA + 11, colors.glyph, '600');
    const word = line(spec.word, DISC_AREA + 11 + LINE_HEIGHT, spec.look === 'comms-lost' ? colors.commsLost : colors.glyph, '500');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" viewBox="0 0 ${IMAGE_WIDTH} ${IMAGE_HEIGHT}">`
        + disc + kind + badge + digit + kpi + word + '</svg>';
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
