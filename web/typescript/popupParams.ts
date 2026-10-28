/**
 * Pure helpers for the point popup that renders a project view by path (AD-7).
 * No MapLibre or React import, so this module is unit tested in node.
 */

/** The point record the popup view receives as its `mapItem` parameter. */
export interface PopupPoint {
    id: string;
    name: string;
    /** The map item's kind id (epic 3 entry 5: the default popup reads its display); '' when unknown. */
    kind?: string;
}

/** Author-set parameters from the `popupView.params` prop. */
export type AuthorParams = Record<string, unknown>;

/** The one parameter object every popup view receives, beside the author's params. */
export const MAP_ITEM_PARAM = 'mapItem';

/**
 * Mount path of the embedded view, below the component's own mount path, the
 * way the built-in Map derives its custom controls' mount paths.
 */
export function popupMountPath(viewMountPath: string, addressPathString: string): string {
    return viewMountPath + '$' + addressPathString + '[popup]';
}

/**
 * The parameters passed to the popup view: the author's params with the
 * point record under `mapItem`. `mapItem` always wins over an author key of
 * the same name, so the view can rely on its shape.
 */
export function popupViewParams(authorParams: AuthorParams | null | undefined, point: PopupPoint): AuthorParams {
    const params: AuthorParams = {};
    if (authorParams && typeof authorParams === 'object') {
        Object.keys(authorParams).forEach((key) => {
            params[key] = authorParams[key];
        });
    }
    params[MAP_ITEM_PARAM] = { id: point.id, name: point.name };
    return params;
}

/** View states (ViewStateType values) that mean the project view cannot be shown. */
const FAILED_STATES = ['notFound', 'error', 'access-denied'];

/** True when a view state reported by Perspective's View means "fall back to the text popup". */
export function isFailedViewState(state: string): boolean {
    return FAILED_STATES.indexOf(state) !== -1;
}

/** The text popup shown when no view path is set or the view failed. */
export function fallbackText(point: PopupPoint): string {
    return point.name ? point.id + ' - ' + point.name : point.id;
}

/** The default popup's widest (its stylesheet max-width) and narrowest (min-width) in px. */
export const POPUP_MAX_PX = 320;
export const POPUP_MIN_PX = 220;
/** Margin kept between the popup and the map's edge, in px. */
const POPUP_EDGE_PX = 16;

/**
 * The popup's max-width (a CSS length) for a point at `x` px in a map `width` px wide, so a popup
 * opened near a phone's edge stays inside the map: the width that fits centred on the point, or the
 * narrowest the popup gets (MapLibre then anchors it beside the point), never wider than the
 * stylesheet's widest or the map less a margin each side.
 */
export function popupMaxWidth(x: number, width: number): string {
    const room = Math.max(0, width - 2 * POPUP_EDGE_PX);
    const centred = 2 * Math.min(x, width - x) - POPUP_EDGE_PX;
    const px = Math.min(POPUP_MAX_PX, room, Math.max(POPUP_MIN_PX, Math.floor(centred)));
    return Math.max(px, Math.min(POPUP_MIN_PX, room)) + 'px';
}
