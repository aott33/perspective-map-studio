/**
 * The page's window on the map (epic 4 entries 2 and 14, contract 0.4.0; MapStudioComponent.java declares the events): the
 * four component events' names, the `viewport` object the component writes and fires, the try-guarded prop write and event
 * fire every path shares, and the echo guard that tells the component's own `selectedItem` write coming back from a value the
 * page wrote. Pure: unit tested in node (pageEvents.test.ts).
 */

import { round6 } from './geometry';

/** Fired on every selection change with `{mapItem}` (MapStudioComponent.EVENT_ITEM_SELECTED). */
export const ITEM_SELECTED_EVENT = 'onItemSelected';
/** Fired when the map first settles and at every move end with the viewport object (EVENT_VIEWPORT_CHANGED). */
export const VIEWPORT_CHANGED_EVENT = 'onViewportChanged';
/** Fired wherever the Gateway is told popup.open, with `{itemId, segment}` (EVENT_POPUP_OPEN). */
export const POPUP_OPEN_EVENT = 'onPopupOpen';
/** Fired wherever the Gateway is told popup.close, with `{itemId}` (EVENT_POPUP_CLOSE). */
export const POPUP_CLOSE_EVENT = 'onPopupClose';

/** Where the map is looking (the `viewport` prop and `onViewportChanged`): WGS 84, the centre and the corners to 6 decimals. */
export interface Viewport {
    center: [number, number];
    zoom: number;
    /** [[west, south], [east, north]]. */
    bounds: [[number, number], [number, number]];
}

/** The viewport of a camera: its centre, its zoom (to 2 decimals, as `data-zoom` reads it) and its visible bounds. */
export function viewportOf(center: { lng: number; lat: number }, zoom: number,
                           bounds: { west: number; south: number; east: number; north: number }): Viewport {
    return {
        center: [round6(center.lng), round6(center.lat)],
        zoom: Math.round(zoom * 100) / 100,
        bounds: [[round6(bounds.west), round6(bounds.south)], [round6(bounds.east), round6(bounds.north)]]
    };
}

/** One viewport as text, so the same place written twice in a row is written and fired once. */
export function viewportKey(viewport: Viewport): string {
    return JSON.stringify(viewport);
}

/** The page's `selectedItem` as the component reads it: an id, or null for null, an empty text or anything not a text. */
export function pageId(value: unknown): string | null {
    return typeof value === 'string' && value !== '' ? value : null;
}

/** What the echo guard keeps of a value: the id, '' for null. */
function echoKey(id: string | null): string {
    return id === null ? '' : id;
}

/** How many writes of the component's own the guard keeps waiting for their echo, at most (the oldest go first). */
export const ECHO_LIMIT = 16;

/**
 * The component is about to write `id` to `selectedItem` while the prop holds `propNow`: the writes whose echo is still to come
 * (`pending`, oldest first) with this one added, unless the prop already holds it (then nothing comes back).
 */
export function noteWrite(pending: string[], id: string | null, propNow: string | null): string[] {
    if (id === propNow) {
        return pending;
    }
    const next = pending.concat(echoKey(id));
    return next.length > ECHO_LIMIT ? next.slice(next.length - ECHO_LIMIT) : next;
}

/**
 * The prop changed to `id`: the component's own write coming back (`echo`, that write and every earlier one dropped from the
 * pending, since props arrive in order and a later write may be the only one seen), or a value the page wrote.
 */
export function takeEcho(pending: string[], id: string | null): { echo: boolean; pending: string[] } {
    const i = pending.indexOf(echoKey(id));
    return i < 0 ? { echo: false, pending } : { echo: true, pending: pending.slice(i + 1) };
}

/** A write to the component's property tree, as Perspective's `PropertyTree` takes it. */
export interface PropWriter {
    write(path: string, value: unknown): void;
}

/** The component's events, as Perspective's `ComponentEvents` fires them. */
export interface EventFirer {
    fireComponentEvent(eventName: string, eventObject: Record<string, unknown>): void;
}

/** Write one prop through the component's property tree; a failure is one console warning and nothing else. */
export function writePageProp(props: PropWriter | null | undefined, key: string, value: unknown): boolean {
    try {
        if (!props || typeof props.write !== 'function') {
            throw new Error('the component has no property tree');
        }
        props.write(key, value);
        return true;
    } catch (err) {
        console.warn('[MapStudio] The ' + key + ' prop could not be written: ' + (err instanceof Error ? err.message : String(err)));
        return false;
    }
}

/** Fire one component event for the page's event scripts; a failure is one console warning and nothing else. */
export function firePageEvent(events: EventFirer | null | undefined, name: string, payload: Record<string, unknown>): boolean {
    try {
        if (!events || typeof events.fireComponentEvent !== 'function') {
            throw new Error('the component has no component events');
        }
        events.fireComponentEvent(name, payload);
        return true;
    } catch (err) {
        console.warn('[MapStudio] The ' + name + ' event could not be fired: ' + (err instanceof Error ? err.message : String(err)));
        return false;
    }
}
