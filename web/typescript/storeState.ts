/**
 * The map store's state as this browser knows it (epic 2 story 5): ready, read
 * only (a newer schema or a standby Gateway; the reason in plain words), or
 * unavailable. Pure, unit tested in node; the component writes it to
 * `data-store-state` on the map container and shows the reason.
 */

import { ErrorCodes, MapLoadReplyBody } from './contract';
import { ErrorBody } from './messages';

export type StoreStatus = 'unknown' | 'ready' | 'read-only' | 'unavailable';

export interface StoreState {
    status: StoreStatus;
    /** The Gateway's words: the read-only or unavailable reason; '' when ready or unknown. */
    reason: string;
}

export const STORE_UNKNOWN: StoreState = { status: 'unknown', reason: '' };

/** The state a map.load reply says. */
export function storeStateFromLoad(body: MapLoadReplyBody): StoreState {
    return body.readOnly ? { status: 'read-only', reason: body.readOnly } : { status: 'ready', reason: '' };
}

/**
 * The state after an error reply to map.load or edits.apply: store-unreachable
 * makes it unavailable, read-only makes it read only (a Gateway that became a
 * standby after the map loaded); any other code leaves it as it was.
 */
export function storeStateFromError(current: StoreState, error: ErrorBody): StoreState {
    if (error.code === ErrorCodes.STORE_UNREACHABLE) {
        return { status: 'unavailable', reason: error.message };
    }
    if (error.code === ErrorCodes.READ_ONLY) {
        return { status: 'read-only', reason: error.message };
    }
    return current;
}

/** The value of `data-store-state`: '' until map.load answers. */
export function storeStateAttribute(state: StoreState): string {
    return state.status === 'unknown' ? '' : state.status;
}

/** The status line under the map, or '' when nothing needs saying. */
export function storeStatusText(state: StoreState): string {
    switch (state.status) {
        case 'read-only':
            return 'Map store: read only. ' + state.reason;
        case 'unavailable':
            return 'Map store: ' + state.reason;
        default:
            return '';
    }
}
