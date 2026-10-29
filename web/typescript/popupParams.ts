/**
 * Pure helpers for the point popup (AD-7): the custom popup view's params and the page links
 * filled from the clicked map item (epic 3 entry 8), the view's mount path, and the card's size
 * rules. No MapLibre or React import, so this module is unit tested in node.
 */

import { ItemValues, LiveValue } from './live';
import { ItemView, fill } from './placeholders';

/** One instrument of a line's map item object (AD-7, epic 3 entry 2), in order along the line. */
export interface PopupInstrument {
    id: string;
    name: string;
    kind: string;
    distanceM: number;
    /** The instrument's values from the last batch (comms, kpis, alarms, style), or null before the first. */
    liveValues: unknown;
}

/** The map item the popup is opened for, as the component knows it when it opens. */
export interface PopupPoint {
    id: string;
    name: string;
    /** The map item's kind id; '' when unknown. */
    kind?: string;
    /** A line's instruments in order (entry 2); absent on a point. */
    instruments?: PopupInstrument[];
    /** The segment a line's popup opened at (entry 2); absent on a point or when the click named none. */
    segment?: { fromId: string; toId: string } | null;
    /** The linked asset's id, or null (epic 3 entry 8). */
    assetId?: string | null;
    /** The map item's properties (the kind's fields). */
    properties?: Record<string, unknown>;
}

/** Author-set parameters, filled, as the view receives them. */
export type AuthorParams = Record<string, unknown>;

/** The one parameter object every popup view receives, beside the kind setup's params. */
export const MAP_ITEM_PARAM = 'mapItem';

/**
 * Mount path of the embedded view, below the component's own mount path, the
 * way the built-in Map derives its custom controls' mount paths.
 */
export function popupMountPath(viewMountPath: string, addressPathString: string): string {
    return viewMountPath + '$' + addressPathString + '[popup]';
}

/** What the placeholders fill from: the clicked map item and, once the popup detail arrived, its asset's base path. */
export function popupItemView(point: PopupPoint, basePath: string | null): ItemView {
    return {
        itemId: point.id,
        itemName: point.name,
        assetId: point.assetId === undefined ? null : point.assetId,
        assetPath: basePath,
        properties: point.properties || {}
    };
}

/**
 * The kind setup's params filled from the item (AD-7): a literal as it is, one placeholder or
 * `{asset.path}/<suffix>` by `fill`. A param whose placeholder has no value (no asset, a property
 * not set) is left out, so the view sees its own default (entry 8 decision; the backlog story on
 * empty values may change it). Never throws.
 */
export function fillParams(params: Record<string, string> | null | undefined, item: ItemView): AuthorParams {
    const out: AuthorParams = {};
    if (!params) {
        return out;
    }
    for (const name of Object.keys(params)) {
        if (name === MAP_ITEM_PARAM) {
            continue;
        }
        const value = fill(params[name], item);
        if (value !== null) {
            out[name] = value;
        }
    }
    return out;
}

/**
 * A page link (the kind setup's `link`, the setup's `alarmPage`) filled from the item, or null when
 * the template is empty, a placeholder has no value (the icon is then hidden, R8), or the filled
 * path is not a Perspective page path (one leading `/`, never `//` or `/\`; a property's value can
 * hold anything, docs/kind-setup.md).
 */
export function fillLink(template: string | null | undefined, item: ItemView): string | null {
    if (!template) {
        return null;
    }
    const filled = fill(template, item);
    if (filled === null || !filled.startsWith('/') || filled.startsWith('//') || filled.startsWith('/\\')) {
        return null;
    }
    return filled;
}

/** The live values a custom popup view receives in `mapItem` (AD-7): the slots as the batch carries them. */
export interface MapItemValues {
    comms: LiveValue | null;
    kpis: Record<string, LiveValue>;
    alarms: LiveValue | null;
}

/**
 * The parameters passed to the popup view: the kind setup's filled params with the map item object
 * under `mapItem` (AD-7: the record's id, name, kind, assetId and properties, plus `basePath`,
 * `alarmsPath` and its live values, which the component re-renders as pushes arrive). `mapItem`
 * always wins over a param of the same name, so the view can rely on its shape.
 */
export function popupViewParams(filled: AuthorParams | null | undefined, point: PopupPoint,
                                detail: { basePath: string | null; alarmsPath: string | null } | null,
                                values: ItemValues | undefined): AuthorParams {
    const params: AuthorParams = {};
    if (filled && typeof filled === 'object') {
        Object.keys(filled).forEach((key) => {
            params[key] = filled[key];
        });
    }
    const live: MapItemValues = {
        comms: values && values.comms ? values.comms : null,
        kpis: values ? values.kpis : {},
        alarms: values && values.alarms ? values.alarms : null
    };
    const mapItem: Record<string, unknown> = {
        id: point.id,
        name: point.name,
        kind: point.kind || '',
        assetId: point.assetId === undefined ? null : point.assetId,
        properties: point.properties || {},
        basePath: detail ? detail.basePath : null,
        alarmsPath: detail ? detail.alarmsPath : null,
        values: live
    };
    if (point.instruments) {
        // A line's map item object carries its ordered instruments and the open segment (AD-7, entry 2).
        mapItem.instruments = point.instruments.map((i) => ({ ...i }));
        mapItem.segment = point.segment ? { fromId: point.segment.fromId, toId: point.segment.toId } : null;
    }
    params[MAP_ITEM_PARAM] = mapItem;
    return params;
}

/** View states (ViewStateType values) that mean the project view cannot be shown. */
const FAILED_STATES = ['notFound', 'error', 'access-denied'];

/** True when a view state reported by Perspective's View means "fall back to the default popup". */
export function isFailedViewState(state: string): boolean {
    return FAILED_STATES.indexOf(state) !== -1;
}

/** The popup card's width (DESIGN.md popup-width, D1) and its tallest (popup-max-height), in px. */
export const POPUP_WIDTH_PX = 320;
export const POPUP_MAX_HEIGHT_PX = 480;
/** The narrowest the card gets beside a point at the map's edge. */
export const POPUP_MIN_PX = 220;
/** The line popup's width (DESIGN.md line-popup-width; decision D1 keeps it at 350 px). */
export const LINE_POPUP_PX = 350;
/** Margin kept between the popup and the map's edge, in px. */
const POPUP_EDGE_PX = 16;
/** The card keeps this much of the map free above and below (P3: min(480, map - 64)). */
const POPUP_HEIGHT_MARGIN_PX = 64;
/** A line popup card is never clamped below this: the header and a few rows (entry 2). */
const POPUP_MIN_HEIGHT_PX = 120;
/** Below this map width the popup is a bottom sheet (DESIGN.md Phone, EXPERIENCE.md Bottom sheet). */
export const SHEET_BELOW_PX = 768;

/**
 * The popup's max-width (a CSS length) for a point at `x` px in a map `width` px wide, so a popup
 * opened near a phone's edge stays inside the map: the card's width (`maxPx`, the point card's 320
 * or the line popup's 350) when it fits centred on the point, else the room beside the point down to
 * the narrowest the popup gets, never wider than the map less a margin each side.
 */
export function popupMaxWidth(x: number, width: number, maxPx: number = POPUP_WIDTH_PX): string {
    const room = Math.max(0, width - 2 * POPUP_EDGE_PX);
    const centred = 2 * Math.min(x, width - x) - POPUP_EDGE_PX;
    const px = Math.min(maxPx, room, Math.max(POPUP_MIN_PX, Math.floor(centred)));
    return Math.max(px, Math.min(POPUP_MIN_PX, room)) + 'px';
}

/** Where the line popup goes and how tall it may be (entry 2; the popup review's P3 and P7). */
export interface PopupPlacement {
    /** MapLibre's anchor: `bottom` puts the card above the point, `top` below it. */
    anchor: 'top' | 'bottom';
    /** The card's max-height in px: the stylesheet's 480, the map less 64, or the room on the chosen side. */
    maxHeight: number;
}

/**
 * The line popup's placement for a point `y` px down a map `height` px tall, a card whose content is
 * `cardHeight` px tall and MapLibre's tip `offset`: above the point when the card fits there (the
 * review's preferred side, so the line stays in view), else below when it fits there, else the side
 * with more room, the card clamped to that room so it never leaves the map (its body scrolls) and
 * never taller than 480 px or the map less 64 px.
 */
export function linePopupPlacement(y: number, height: number, cardHeight: number, offset: number): PopupPlacement {
    const above = Math.floor(y - offset - POPUP_EDGE_PX);
    const below = Math.floor(height - y - offset - POPUP_EDGE_PX);
    const cap = Math.min(POPUP_MAX_HEIGHT_PX, height - POPUP_HEIGHT_MARGIN_PX);
    const wanted = Math.min(cardHeight, cap);
    const anchor: 'top' | 'bottom' = wanted <= above ? 'bottom' : wanted <= below ? 'top' : above >= below ? 'bottom' : 'top';
    const room = anchor === 'bottom' ? above : below;
    return { anchor, maxHeight: Math.max(POPUP_MIN_HEIGHT_PX, Math.min(cap, room)) };
}

/** The card's max-height in px for a map `height` px tall: 480, or the map less 64, never under 160. */
export function popupMaxHeight(height: number): number {
    return Math.max(160, Math.min(POPUP_MAX_HEIGHT_PX, Math.floor(height) - POPUP_HEIGHT_MARGIN_PX));
}

/** True when a map `width` px wide shows its popups as bottom sheets. */
export function isSheetWidth(width: number): boolean {
    return width < SHEET_BELOW_PX;
}
