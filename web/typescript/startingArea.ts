/**
 * The component's starting area (epic 3 entry 6, R1): the `startingArea` prop, read into either a
 * centre with a zoom or bounds to fit. Pure, unit tested in node; MapStudio.tsx hands the result to
 * MapLibre. Two components on one page may open on different areas and show the same map items.
 */

import { isRecord } from './json';

export type StartingArea =
    | { kind: 'center'; center: [number, number]; zoom: number }
    /** `[[west, south], [east, north]]`, fitted with FIT_PADDING_PX. */
    | { kind: 'bounds'; bounds: [[number, number], [number, number]] };

/** The whole world: what an unset or invalid prop opens on. */
export const WORLD: StartingArea = { kind: 'center', center: [0, 0], zoom: 1 };
/** The padding round fitted bounds, in px. */
export const FIT_PADDING_PX = 24;
const MAX_LAT = 85;
const MAX_ZOOM = 24;

function finite(value: unknown): value is number {
    return typeof value === 'number' && isFinite(value);
}

function lngOk(v: number): boolean {
    return v >= -180 && v <= 180;
}

function latOk(v: number): boolean {
    return v >= -MAX_LAT && v <= MAX_LAT;
}

/**
 * The starting area the prop names: bounds when all four are finite, in range, west < east and
 * south < north; else the centre at the zoom when they are in range; else `WORLD` with the reason
 * in `problem`. An absent `bounds` (or any null in it) means "use the centre and zoom", which is
 * the schema's default, so it is not a problem.
 */
export function readStartingArea(raw: unknown): { area: StartingArea; problem: string | null } {
    if (!isRecord(raw)) {
        return { area: WORLD, problem: raw === undefined || raw === null ? null : 'startingArea is not an object.' };
    }
    const b = isRecord(raw.bounds) ? raw.bounds : null;
    if (b && [b.west, b.south, b.east, b.north].some((v) => v !== null && v !== undefined)) {
        const { west, south, east, north } = b;
        if (finite(west) && finite(south) && finite(east) && finite(north)
            && lngOk(west) && lngOk(east) && latOk(south) && latOk(north) && west < east && south < north) {
            return { area: { kind: 'bounds', bounds: [[west, south], [east, north]] }, problem: null };
        }
        return { area: WORLD, problem: 'startingArea.bounds needs west < east and south < north, longitudes within '
            + '-180 to 180 and latitudes within -85 to 85; the map opens on the whole world.' };
    }
    const c = isRecord(raw.center) ? raw.center : {};
    const lng = c.lng === undefined || c.lng === null ? 0 : c.lng;
    const lat = c.lat === undefined || c.lat === null ? 0 : c.lat;
    const zoom = raw.zoom === undefined || raw.zoom === null ? 1 : raw.zoom;
    if (!finite(lng) || !finite(lat) || !lngOk(lng) || !latOk(lat)) {
        return { area: WORLD, problem: 'startingArea.center needs a longitude within -180 to 180 and a latitude '
            + 'within -85 to 85; the map opens on the whole world.' };
    }
    if (!finite(zoom) || zoom < 0 || zoom > MAX_ZOOM) {
        return { area: WORLD, problem: 'startingArea.zoom must be a number from 0 to 24; the map opens on the whole world.' };
    }
    return { area: { kind: 'center', center: [lng, lat], zoom }, problem: null };
}

/** A stable key for a starting area, so a changed prop is told from a re-render. */
export function startingAreaKey(area: StartingArea): string {
    return area.kind === 'center' ? 'c:' + area.center.join(',') + ':' + area.zoom : 'b:' + area.bounds.join(';');
}
