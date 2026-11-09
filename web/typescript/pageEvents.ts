/**
 * The page's window on the map (epic 4 entries 2, 14 and 8, contract 0.4.0; MapStudioComponent.java declares the events): the
 * five component events' names, the `viewport` object the component writes and fires, the try-guarded prop write and event
 * fire every path shares, and the echo guard that tells the component's own `selectedItem` write coming back from a value the
 * page wrote. Pure: unit tested in node (pageEvents.test.ts).
 */

import { round6 } from './geometry';

/** Fired on every selection change with `{mapItem}` (MapStudioComponent.EVENT_ITEM_SELECTED). */
export const ITEM_SELECTED_EVENT = 'onItemSelected';
/**
 * Fired once per change of the selected set with `{mapItems}`, the AD-7 objects in joining order (epic 4 entry 8,
 * MapStudioComponent.EVENT_SELECTION_CHANGED); beside the read-only `selectedItems` prop, the ids in the same order.
 */
export const SELECTION_CHANGED_EVENT = 'onSelectionChanged';
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
 * How long a write of the component's own waits for its echo (ms): a sync brings it back well within this, and a write whose
 * echo never comes (Perspective coalesced it away: A then null before a sync leaves the prop as it was) goes, so nothing stale
 * outlives a sync and later swallows the page's own write of the same id.
 */
export const ECHO_EXPIRY_MS = 1500;

/**
 * The echo guard of `selectedItem`: the component's own writes whose echo has not come back yet, oldest first, each with when
 * it was written, and the value last written to the prop as far as the component knows (its own last write, or the page's last
 * value it read), which a write is compared with: writing the value the prop already holds changes nothing, so nothing comes back.
 */
export interface EchoGuard {
    pending: Array<{ key: string; at: number }>;
    last: string | null;
}

/** A guard with nothing pending, the prop holding `value`. */
export function echoGuard(value: string | null): EchoGuard {
    return { pending: [], last: value };
}

/** The pending writes still waiting at `now`. */
function unexpired(guard: EchoGuard, now: number): EchoGuard['pending'] {
    return guard.pending.filter((p) => now - p.at < ECHO_EXPIRY_MS);
}

/** The component is about to write `id` to `selectedItem` at `now`: noted, unless it is the value last written (no change comes back). */
export function noteWrite(guard: EchoGuard, id: string | null, now: number): EchoGuard {
    const pending = unexpired(guard, now);
    if (id === guard.last) {
        return { pending, last: id };
    }
    const next = pending.concat({ key: echoKey(id), at: now });
    return { pending: next.length > ECHO_LIMIT ? next.slice(next.length - ECHO_LIMIT) : next, last: id };
}

/**
 * The prop changed to `id` at `now`: the component's own write coming back (`echo`), which drops every pending write through the
 * last one of that value (writes of A, B and A again before one sync come back as one change to A), or a value the page wrote,
 * which is then the value last written.
 */
export function takeEcho(guard: EchoGuard, id: string | null, now: number): { echo: boolean; guard: EchoGuard } {
    const pending = unexpired(guard, now);
    const key = echoKey(id);
    let i = -1;
    for (let j = pending.length - 1; j >= 0; j--) {
        if (pending[j].key === key) {
            i = j;
            break;
        }
    }
    return i < 0 ? { echo: false, guard: { pending, last: id } } : { echo: true, guard: { pending: pending.slice(i + 1), last: guard.last } };
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
