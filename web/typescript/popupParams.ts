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
