/**
 * The you-are-here marker and Locate me (epic 4 entry 15; DESIGN.md you-are-here, zoom-control; EXPERIENCE.md You are
 * here, Locate me): the `userLocation` prop, bound by the page to `{session.props.geolocation}` and taken in that
 * shape, read into one state that decides the marker, the legend's row and the button together, so the three never
 * disagree; the button's words for each state; the accuracy circle as a polygon on the ground; and the heading wedge's
 * image. The component reads nothing of the session and asks the browser for nothing: the page's binding is the one
 * source. Pure, unit tested in node.
 */

import { isRecord } from './json';

/** Off (no prop, or the session's location not enabled), denied (permission refused), no fix yet, or a fix. */
export type LocationState = 'off' | 'denied' | 'nofix' | 'fix';

export interface UserLocation {
    state: LocationState;
    /** `[lng, lat]`, with a fix only. */
    position?: [number, number];
    /** Metres, with a fix and a positive finite accuracy only. */
    accuracy?: number;
    /** Degrees clockwise from north, 0 to 360, with a fix and a finite heading only. */
    heading?: number;
}

export const NO_LOCATION: UserLocation = { state: 'off' };

function finite(value: unknown): value is number {
    return typeof value === 'number' && isFinite(value);
}

/**
 * The prop read by the rules of the plan: a position is known when `enabled` is true, `permissionGranted` is not false
 * (null or absent counts: a browser session leaves it null on 8.3.10, only the Perspective mobile app sets it; owner,
 * 2026-11-07) and `data` holds a finite latitude in [-90, 90] and longitude in [-180, 180]. Every key is optional, extra keys are
 * ignored and a malformed value is read by the same rules, never thrown.
 */
export function readUserLocation(raw: unknown): UserLocation {
    if (!isRecord(raw) || raw.enabled !== true) {
        return NO_LOCATION;
    }
    if (raw.permissionGranted === false) {
        return { state: 'denied' };
    }
    const data = isRecord(raw.data) ? raw.data : null;
    if (!data || !finite(data.latitude) || !finite(data.longitude) || data.latitude < -90 || data.latitude > 90
        || data.longitude < -180 || data.longitude > 180) {
        return { state: 'nofix' };
    }
    const fix: UserLocation = { state: 'fix', position: [data.longitude, data.latitude] };
    if (finite(data.accuracy) && data.accuracy > 0) {
        fix.accuracy = data.accuracy;
    }
    if (finite(data.heading)) {
        fix.heading = ((data.heading % 360) + 360) % 360;
    }
    return fix;
}

/** A stable key for a read location, so a re-render with the same value draws nothing again. */
export function userLocationKey(loc: UserLocation): string {
    if (loc.state !== 'fix' || !loc.position) {
        return loc.state;
    }
    return 'fix:' + loc.position.join(',') + ':' + (loc.accuracy === undefined ? '' : loc.accuracy)
        + ':' + (loc.heading === undefined ? '' : loc.heading);
}

/** Locate me's name, and its `title` and accessible description for each state (EXPERIENCE.md Locate me). */
export const LOCATE_LABEL = 'Locate me';
export const LOCATE_WORDS: Record<LocationState, string> = {
    off: 'Locate me - location is off for this session',
    denied: 'Locate me - location permission not granted',
    nofix: 'Locate me - no location fix yet',
    fix: 'Locate me'
};

/** The words for a state: its hover text and accessible description. */
export function locateWords(state: LocationState): string {
    return LOCATE_WORDS[state];
}

/** The legend row's words (DESIGN.md legend: the you-are-here dot and "You are here"). */
export const YOU_ARE_HERE_WORDS = 'You are here';

/** The zoom Locate me moves to, at least (as Zoom to location: the search's chosen point zoom). */
export const LOCATE_ZOOM = 15;

/** The accuracy circle's vertices. */
export const CIRCLE_VERTICES = 64;
/** The mean Earth radius, in metres (the circle is drawn on a sphere; at a pad's scale the error is far below a pixel). */
const EARTH_RADIUS_M = 6371008.8;

/**
 * The accuracy circle as a closed GeoJSON ring of `vertices` points (the first repeated last): `metres` from
 * `[lng, lat]` on the ground in every direction, by the great-circle destination formula, so the circle stays true at
 * every zoom and latitude without a zoom expression. Longitudes are wrapped to [-180, 180].
 */
export function accuracyRing(center: [number, number], metres: number, vertices = CIRCLE_VERTICES): Array<[number, number]> {
    const toRad = Math.PI / 180;
    const lat1 = center[1] * toRad;
    const lng1 = center[0] * toRad;
    const d = metres / EARTH_RADIUS_M;
    const ring: Array<[number, number]> = [];
    for (let i = 0; i < vertices; i++) {
        const bearing = (i / vertices) * 2 * Math.PI;
        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing));
        const lng2 = lng1 + Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
        let lng = lng2 / toRad;
        lng = ((lng + 540) % 360) - 180;
        ring.push([lng, lat2 / toRad]);
    }
    ring.push(ring[0]);
    return ring;
}

interface YouFeature {
    type: 'Feature';
    properties: { part: 'accuracy' | 'dot'; heading?: number };
    geometry: { type: 'Polygon'; coordinates: Array<Array<[number, number]>> } | { type: 'Point'; coordinates: [number, number] };
}

export interface YouFeatures {
    type: 'FeatureCollection';
    features: YouFeature[];
}

/**
 * The marker's features: with a fix, the accuracy circle (when the accuracy is known) and the dot, which carries the
 * heading when the device gives one (the wedge layer filters on it); nothing otherwise.
 */
export function youAreHereFeatures(loc: UserLocation): YouFeatures {
    const features: YouFeature[] = [];
    if (loc.state === 'fix' && loc.position) {
        if (loc.accuracy !== undefined) {
            features.push({ type: 'Feature', properties: { part: 'accuracy' },
                geometry: { type: 'Polygon', coordinates: [accuracyRing(loc.position, loc.accuracy)] } });
        }
        const props: YouFeature['properties'] = { part: 'dot' };
        if (loc.heading !== undefined) {
            props.heading = loc.heading;
        }
        features.push({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: loc.position } });
    }
    return { type: 'FeatureCollection', features };
}

/** The wedge image's side, in px, and its apex at the centre (the dot's), pointing north before MapLibre turns it. */
export const WEDGE_SIZE = 64;
/** The wedge's half angle, in degrees, and its reach from the centre, in px. */
const WEDGE_HALF_ANGLE = 30;
const WEDGE_REACH = 30;
/** The wedge's opacity: firm at the dot, fading to its reach. */
const WEDGE_ALPHA = 0.85;

/**
 * The heading wedge as RGBA pixels (`map.addImage` takes `{width, height, data}`), in the colour given as `[r, g, b]`:
 * a cone from the centre pointing up, WEDGE_HALF_ANGLE each side, fading out to WEDGE_REACH, its edge softened over a
 * pixel. Premultiplied alpha is not used (MapLibre's addImage takes straight RGBA).
 */
export function wedgePixels(rgb: [number, number, number], size = WEDGE_SIZE): Uint8Array {
    const data = new Uint8Array(size * size * 4);
    const c = size / 2;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = x + 0.5 - c;
            const dy = c - (y + 0.5);
            const r = Math.sqrt(dx * dx + dy * dy);
            if (r > WEDGE_REACH || dy <= 0) {
                continue;
            }
            const angle = Math.abs(Math.atan2(dx, dy)) * 180 / Math.PI;
            const edge = Math.max(0, Math.min(1, WEDGE_HALF_ANGLE - angle + 0.5));
            const fade = 1 - r / WEDGE_REACH;
            const alpha = Math.round(255 * WEDGE_ALPHA * edge * Math.min(1, fade * 1.6));
            if (alpha <= 0) {
                continue;
            }
            const i = (y * size + x) * 4;
            data[i] = rgb[0];
            data[i + 1] = rgb[1];
            data[i + 2] = rgb[2];
            data[i + 3] = alpha;
        }
    }
    return data;
}
