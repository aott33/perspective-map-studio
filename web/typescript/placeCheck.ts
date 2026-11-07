/**
 * The place check (epic 4 entry 27; EXPERIENCE.md Place a point, Properties panel; DESIGN.md Properties panel; docs/place-check.md):
 * where a point's latitude and longitude land, in words, for the place line under Location in Details, from data the module
 * serves and the browser loads on first use. Offline: the data is a static file made once from Natural Earth (public domain)
 * and GeoNames (CC BY 4.0) by `web/scripts/place-data.mjs`, copied beside the bundle and served at /res/mapstudio/places.json;
 * no position is ever sent anywhere, and the file is fetched once per page, when Details first shows a point (a kept promise).
 *
 * In the US the county in the data's own words, the state and the country ("Lea County, New Mexico, US"); elsewhere the nearest
 * town within 50 km, the state or province and the country ("Near Grande Prairie, Alberta, CA"), or the state or province and
 * the country alone; offshore the sea, then "off" the nearest state or province within 200 km ("Gulf of Mexico, off Louisiana,
 * US"), or the sea alone ("North Atlantic Ocean"), an unnamed channel by its shore ("Off British Columbia, CA"); a point the land's
 * and the sea's 1:10 million outlines leave in neither takes the nearer within 2 km (`SEAM_KM`); "No place found here" only where no
 * area and no sea is found. A point within
 * 1 km of a county or state line names the neighbour ("Lea County (near the Texas line), New Mexico, US"). A latitude past 90 or
 * below -90 whose swap is in range reads "Latitude and longitude look swapped", and a pair in no area (no land and no sea) whose swap
 * lands in one "Latitude and longitude may be swapped"; a point in a sea reads its sea. Never on a line or an area. Pure apart from the loader; unit tested in node with a
 * small fixture.
 */

/** Where the module serves the place data (web/assets/place/places.json, copied by webpack.config.js; docs/place-check.md). */
export const PLACES_URL = '/res/mapstudio/places.json';
export const PLACES_FORMAT = 'mapstudio-places';
export const PLACES_VERSION = 1;

/** The place line's tooltip: the sources, as their licences ask. */
export const PLACE_CREDIT = 'Places: Natural Earth, GeoNames (CC BY 4.0)';
export const PLACE_LOADING = 'Looking up the place...';
export const PLACE_UNAVAILABLE = 'The place check is not available';
export const PLACE_NONE = 'No place found here';
export const LOOK_SWAPPED = 'Latitude and longitude look swapped';
export const MAY_BE_SWAPPED = 'Latitude and longitude may be swapped';

/** The nearest town is named within this distance; offshore, the nearest state or province; a line names its neighbour. */
export const TOWN_KM = 50;
export const OFF_KM = 200;
export const LINE_KM = 1;

/** Kilometres per degree of latitude (a sphere of the mean radius, 6371.0088 km): ample for 1 to 200 km. */
const KM_PER_DEGREE = 111.195;

/** One polygon layer as the browser keeps it: the arcs once, each feature's references to them, and its words. */
export interface PlaceLayer {
    /** Degrees per stored unit. */
    quantum: number;
    /** Every arc's points, x then y, in stored units (longitude and latitude over `quantum`). */
    xy: Int32Array;
    /** Arc `a`'s points are `xy[2 * start[a]]` up to `xy[2 * start[a + 1]]`. */
    start: Uint32Array;
    /** Arc `a`'s box: west, south, east, north at `4 * a`. */
    arcBox: Int32Array;
    /** Feature `f`'s arc references, `refs[refStart[f]]` up to `refs[refStart[f + 1]]`: the arc's index, or `~index` walked backwards. */
    refs: Int32Array;
    refStart: Uint32Array;
    /** Feature `f`'s box at `4 * f`. */
    box: Int32Array;
    /** The features using arc `a`, `users[userStart[a]]` up to `users[userStart[a + 1]]` (a shared border has two). */
    users: Int32Array;
    userStart: Uint32Array;
    names: string[];
}

export interface PlaceTowns {
    names: string[];
    lat: Float64Array;
    lng: Float64Array;
    /** Town indices by latitude, south first, with their latitudes: a band is found by a binary search. */
    byLat: Uint32Array;
    sortedLat: Float64Array;
}

export interface PlaceData {
    admin1: PlaceLayer;
    /** The ISO country code of each admin-1 area (or its country's name where Natural Earth gives no code). */
    countries: string[];
    counties: PlaceLayer;
    /** Each county's state: an admin-1 area's index, or -1 when the data does not say (read by the point's area then). */
    states: Int32Array;
    marine: PlaceLayer;
    towns: PlaceTowns;
    credit: string;
}

/** A place in the US (a county), elsewhere on land (a state or province), offshore (a sea), or none. */
export type PointPlace =
    | { kind: 'county'; county: string; state: string; country: string; near: string }
    | { kind: 'land'; town: string; state: string; country: string; near: string }
    | { kind: 'sea'; sea: string; off: { state: string; country: string } | null }
    | { kind: 'none' };

// ---------------------------------------------------------------------------------------------------------------------------
// Reading the file (docs/place-check.md, "The file"): numbers as base64url characters, 5 bits each, low bits first, the 32 bit set
// on every character but a number's last; a signed number zigzagged first (0, -1, 1, -2 ...).

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const CODE = new Int8Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) {
    CODE[ALPHABET.charCodeAt(i)] = i;
}

/** The numbers of one encoded string, read in order. */
export class NumberReader {
    private at = 0;

    constructor(private readonly text: string) {}

    uint(): number {
        let n = 0;
        let scale = 1;
        for (;;) {
            if (this.at >= this.text.length) {
                throw new Error('the place data ends inside a number');
            }
            const ch = this.text.charCodeAt(this.at++);
            const c = ch < 128 ? CODE[ch] : -1;
            if (c < 0) {
                throw new Error('the place data holds a character that is not a number');
            }
            n += (c & 31) * scale;
            if (c < 32) {
                return n;
            }
            scale *= 32;
        }
    }

    int(): number {
        const z = this.uint();
        return z % 2 === 0 ? z / 2 : -(z + 1) / 2;
    }

    done(): boolean {
        return this.at >= this.text.length;
    }
}

function record(v: unknown, what: string): Record<string, unknown> {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
        throw new Error('the place data has no ' + what);
    }
    return v as Record<string, unknown>;
}

function text(v: unknown, what: string): string {
    if (typeof v !== 'string') {
        throw new Error('the place data has no ' + what);
    }
    return v;
}

function strings(v: unknown, what: string): string[] {
    if (!Array.isArray(v) || v.some((s) => typeof s !== 'string')) {
        throw new Error('the place data has no ' + what);
    }
    return v as string[];
}

/** One layer from its two strings and its names (arcs: per arc its point count and points; rings: per feature its rings' references). */
export function decodeLayer(arcsText: string, ringsText: string, names: string[], quantum: number): PlaceLayer {
    // The arcs: first counted, then read into one array.
    const counts: number[] = [];
    const coords: number[] = [];
    const arcs = new NumberReader(arcsText);
    let x = 0;
    let y = 0;
    while (!arcs.done()) {
        const n = arcs.uint();
        counts.push(n);
        for (let i = 0; i < n; i++) {
            x += arcs.int();
            y += arcs.int();
            coords.push(x, y);
        }
    }
    const arcCount = counts.length;
    const start = new Uint32Array(arcCount + 1);
    for (let a = 0; a < arcCount; a++) {
        start[a + 1] = start[a] + counts[a];
    }
    const xy = Int32Array.from(coords);
    const arcBox = new Int32Array(4 * arcCount);
    for (let a = 0; a < arcCount; a++) {
        let w = Infinity;
        let s = Infinity;
        let e = -Infinity;
        let n = -Infinity;
        for (let p = start[a]; p < start[a + 1]; p++) {
            const px = xy[2 * p];
            const py = xy[2 * p + 1];
            w = Math.min(w, px);
            e = Math.max(e, px);
            s = Math.min(s, py);
            n = Math.max(n, py);
        }
        arcBox.set(counts[a] > 0 ? [w, s, e, n] : [0, 0, -1, -1], 4 * a);
    }
    // The rings: a feature's references, its rings run together (the crossing parity needs only the arcs).
    const rings = new NumberReader(ringsText);
    const refList: number[] = [];
    const refStart = new Uint32Array(names.length + 1);
    let prev = 0;
    for (let f = 0; f < names.length; f++) {
        const ringCount = rings.uint();
        for (let r = 0; r < ringCount; r++) {
            const refCount = rings.uint();
            for (let i = 0; i < refCount; i++) {
                const v = rings.uint();
                const back = v % 2;
                const z = (v - back) / 2;
                const index = prev + (z % 2 === 0 ? z / 2 : -(z + 1) / 2);
                if (index < 0 || index >= arcCount) {
                    throw new Error('the place data names an arc it does not hold');
                }
                refList.push(back ? ~index : index);
                prev = index;
            }
        }
        refStart[f + 1] = refList.length;
    }
    if (!rings.done()) {
        throw new Error('the place data has more features than names');
    }
    const refs = Int32Array.from(refList);
    const box = new Int32Array(4 * names.length);
    const useCount = new Uint32Array(arcCount);
    for (let f = 0; f < names.length; f++) {
        let w = Infinity;
        let s = Infinity;
        let e = -Infinity;
        let n = -Infinity;
        for (let i = refStart[f]; i < refStart[f + 1]; i++) {
            const a = refs[i] < 0 ? ~refs[i] : refs[i];
            useCount[a]++;
            if (arcBox[4 * a + 2] >= arcBox[4 * a]) {
                w = Math.min(w, arcBox[4 * a]);
                s = Math.min(s, arcBox[4 * a + 1]);
                e = Math.max(e, arcBox[4 * a + 2]);
                n = Math.max(n, arcBox[4 * a + 3]);
            }
        }
        box.set(e >= w ? [w, s, e, n] : [0, 0, -1, -1], 4 * f);
    }
    const userStart = new Uint32Array(arcCount + 1);
    for (let a = 0; a < arcCount; a++) {
        userStart[a + 1] = userStart[a] + useCount[a];
    }
    const users = new Int32Array(userStart[arcCount]);
    const filled = new Uint32Array(arcCount);
    for (let f = 0; f < names.length; f++) {
        for (let i = refStart[f]; i < refStart[f + 1]; i++) {
            const a = refs[i] < 0 ? ~refs[i] : refs[i];
            users[userStart[a] + filled[a]++] = f;
        }
    }
    return { quantum, xy, start, arcBox, refs, refStart, box, users, userStart, names };
}

/** The towns from their names ("|" between them) and their points (each the difference from the one before, in `quantum` units from -180, -90). */
export function decodeTowns(namesText: string, pointsText: string, quantum: number): PlaceTowns {
    const names = namesText === '' ? [] : namesText.split('|');
    const lat = new Float64Array(names.length);
    const lng = new Float64Array(names.length);
    const points = new NumberReader(pointsText);
    let x = 0;
    let y = 0;
    for (let i = 0; i < names.length; i++) {
        x += points.int();
        y += points.int();
        lng[i] = x * quantum - 180;
        lat[i] = y * quantum - 90;
    }
    if (!points.done()) {
        throw new Error('the place data has more town points than names');
    }
    const order = Array.from({ length: names.length }, (_, i) => i).sort((a, b) => lat[a] - lat[b]);
    const byLat = Uint32Array.from(order);
    const sortedLat = Float64Array.from(order.map((i) => lat[i]));
    return { names, lat, lng, byLat, sortedLat };
}

/** The served file read into the lookups' form; a file that does not read as one throws, saying why. */
export function decodePlaces(json: unknown): PlaceData {
    const file = record(json, 'header');
    if (file.format !== PLACES_FORMAT || file.version !== PLACES_VERSION) {
        throw new Error('the place data is not ' + PLACES_FORMAT + ' version ' + PLACES_VERSION);
    }
    const settings = record(file.settings, 'settings');
    const quantum = Number(settings.quantum);
    const townQuantum = Number(settings.townQuantum);
    if (!(quantum > 0) || !(townQuantum > 0)) {
        throw new Error('the place data has no quantum');
    }
    const layer = (key: string): [Record<string, unknown>, PlaceLayer] => {
        const l = record(file[key], key + ' layer');
        return [l, decodeLayer(text(l.arcs, key + ' arcs'), text(l.rings, key + ' rings'), strings(l.names, key + ' names'), quantum)];
    };
    const [admin1Record, admin1] = layer('admin1');
    const [countyRecord, counties] = layer('counties');
    const [, marine] = layer('marine');
    const countries = strings(admin1Record.countries, 'admin1 countries');
    const stateList = countyRecord.states;
    if (countries.length !== admin1.names.length || !Array.isArray(stateList) || stateList.length !== counties.names.length
        || stateList.some((s) => typeof s !== 'number' || s < -1 || s >= admin1.names.length)) {
        throw new Error('the place data\'s countries or county states do not match its areas');
    }
    const townRecord = record(file.towns, 'towns');
    const towns = decodeTowns(text(townRecord.names, 'town names'), text(townRecord.points, 'town points'), townQuantum);
    return { admin1, countries, counties, states: Int32Array.from(stateList as number[]), marine, towns,
        credit: typeof file.credit === 'string' ? file.credit : PLACE_CREDIT };
}

// ---------------------------------------------------------------------------------------------------------------------------
// The lookups.

/** Whether the point (stored units) is inside feature `f`: an even count of crossings to its east is outside. */
export function contains(layer: PlaceLayer, f: number, px: number, py: number): boolean {
    const { box, refs, refStart, arcBox, start, xy } = layer;
    if (px < box[4 * f] || px > box[4 * f + 2] || py < box[4 * f + 1] || py > box[4 * f + 3]) {
        return false;
    }
    let inside = false;
    for (let i = refStart[f]; i < refStart[f + 1]; i++) {
        const a = refs[i] < 0 ? ~refs[i] : refs[i];
        if (py < arcBox[4 * a + 1] || py > arcBox[4 * a + 3] || px > arcBox[4 * a + 2]) {
            continue;
        }
        for (let p = start[a] + 1; p < start[a + 1]; p++) {
            const x1 = xy[2 * p - 2];
            const y1 = xy[2 * p - 1];
            const x2 = xy[2 * p];
            const y2 = xy[2 * p + 1];
            if ((y1 > py) !== (y2 > py) && px < x1 + (py - y1) * (x2 - x1) / (y2 - y1)) {
                inside = !inside;
            }
        }
    }
    return inside;
}

/** The features containing the point, first to last. */
function containing(layer: PlaceLayer, px: number, py: number): number[] {
    const found: number[] = [];
    for (let f = 0; f < layer.names.length; f++) {
        if (contains(layer, f, px, py)) {
            found.push(f);
        }
    }
    return found;
}

/** The scales from stored units to kilometres east and north at a latitude. */
function scales(layer: PlaceLayer, lat: number): [number, number] {
    const ky = KM_PER_DEGREE * layer.quantum;
    return [ky * Math.max(Math.cos(lat * Math.PI / 180), 0.01), ky];
}

/** Kilometres from the point to a box (0 inside it). */
function boxKm(b: Int32Array, i: number, px: number, py: number, kx: number, ky: number): number {
    const dx = Math.max(0, b[i] - px, px - b[i + 2]) * kx;
    const dy = Math.max(0, b[i + 1] - py, py - b[i + 3]) * ky;
    return Math.sqrt(dx * dx + dy * dy);
}

/** Kilometres from the point to arc `a`, or `limit` when it is not nearer than that. */
function arcKm(layer: PlaceLayer, a: number, px: number, py: number, kx: number, ky: number, limit: number): number {
    if (layer.arcBox[4 * a + 2] < layer.arcBox[4 * a] || boxKm(layer.arcBox, 4 * a, px, py, kx, ky) >= limit) {
        return limit;
    }
    const { start, xy } = layer;
    let best = limit;
    for (let p = start[a]; p < start[a + 1]; p++) {
        const x2 = (xy[2 * p] - px) * kx;
        const y2 = (xy[2 * p + 1] - py) * ky;
        if (p === start[a]) {
            best = Math.min(best, Math.sqrt(x2 * x2 + y2 * y2));
            continue;
        }
        const x1 = (xy[2 * p - 2] - px) * kx;
        const y1 = (xy[2 * p - 1] - py) * ky;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = dx * dx + dy * dy;
        const t = len > 0 ? Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / len)) : 0;
        const cx = x1 + t * dx;
        const cy = y1 + t * dy;
        best = Math.min(best, Math.sqrt(cx * cx + cy * cy));
    }
    return best;
}

/**
 * The nearest neighbour of feature `f` across a line within `limit` km: the other feature on the nearest arc `f` shares, of those
 * `accept` takes; -1 when none is that near. The coast is an arc with one feature, so it names no neighbour.
 */
export function nearNeighbour(layer: PlaceLayer, f: number, lat: number, px: number, py: number, limit: number,
    accept: (g: number) => boolean): { feature: number; km: number } {
    const [kx, ky] = scales(layer, lat);
    let best = { feature: -1, km: limit };
    for (let i = layer.refStart[f]; i < layer.refStart[f + 1]; i++) {
        const a = layer.refs[i] < 0 ? ~layer.refs[i] : layer.refs[i];
        let other = -1;
        for (let u = layer.userStart[a]; u < layer.userStart[a + 1]; u++) {
            const g = layer.users[u];
            if (g !== f && accept(g)) {
                other = g;
                break;
            }
        }
        if (other < 0) {
            continue;
        }
        const km = arcKm(layer, a, px, py, kx, ky, best.km);
        if (km < best.km) {
            best = { feature: other, km };
        }
    }
    return best;
}

/** The feature whose outline is nearest the point within `limit` km, or -1. */
export function nearestFeature(layer: PlaceLayer, lat: number, px: number, py: number, limit: number): { feature: number; km: number } {
    const [kx, ky] = scales(layer, lat);
    const candidates: Array<[number, number]> = [];
    for (let f = 0; f < layer.names.length; f++) {
        if (layer.box[4 * f + 2] >= layer.box[4 * f]) {
            const km = boxKm(layer.box, 4 * f, px, py, kx, ky);
            if (km < limit) {
                candidates.push([km, f]);
            }
        }
    }
    candidates.sort((a, b) => a[0] - b[0]);
    let best = { feature: -1, km: limit };
    for (const [boxDistance, f] of candidates) {
        if (boxDistance >= best.km) {
            break;
        }
        for (let i = layer.refStart[f]; i < layer.refStart[f + 1]; i++) {
            const a = layer.refs[i] < 0 ? ~layer.refs[i] : layer.refs[i];
            const km = arcKm(layer, a, px, py, kx, ky, best.km);
            if (km < best.km) {
                best = { feature: f, km };
            }
        }
    }
    return best;
}

/** Great-circle kilometres between two points. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const r = Math.PI / 180;
    const dLat = (lat2 - lat1) * r;
    const dLng = (lng2 - lng1) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The nearest town within `limit` km, or -1. */
export function nearestTown(towns: PlaceTowns, lat: number, lng: number, limit: number): number {
    const band = limit / KM_PER_DEGREE;
    let lo = 0;
    let hi = towns.sortedLat.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (towns.sortedLat[mid] < lat - band) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    let best = -1;
    let bestKm = limit;
    for (let k = lo; k < towns.sortedLat.length && towns.sortedLat[k] <= lat + band; k++) {
        const i = towns.byLat[k];
        const km = distanceKm(lat, lng, towns.lat[i], towns.lng[i]);
        if (km <= bestKm) {
            best = i;
            bestKm = km;
        }
    }
    return best;
}

/**
 * Where the land's and the sea's outlines leave a point in neither (a delta, an inland bay, a fjord: Natural Earth draws the two at
 * 1:10 million, apart by up to a kilometre or two), the nearer of the land and the sea within this distance holds it.
 */
export const SEAM_KM = 2;

/** A county's place: its state (the county's own, else the area holding the point), the country, and a line within 1 km. */
function countyPlace(data: PlaceData, county: number, lat: number, px: number, py: number): PointPlace {
    const { admin1, counties } = data;
    let state = data.states[county];
    if (state < 0) {
        const area = containing(admin1, px, py)[0];
        state = area !== undefined ? area : -1;
    }
    const stateOf = (c: number): number => data.states[c];
    const stateName = (s: number): string => (s >= 0 ? admin1.names[s] : '');
    // A state line wins over a county line: across the county's own line into another state, or across the state's own line
    // (a country's border too); then a county line within the state.
    const byCounty = nearNeighbour(counties, county, lat, px, py, LINE_KM, (g) => stateOf(g) >= 0 && stateOf(g) !== state);
    const byState = state >= 0
        ? nearNeighbour(admin1, state, lat, px, py, LINE_KM, (g) => admin1.names[g] !== '' && admin1.names[g] !== admin1.names[state])
        : { feature: -1, km: LINE_KM };
    let near = '';
    if (byCounty.feature >= 0 && (byState.feature < 0 || byCounty.km <= byState.km)) {
        near = stateName(stateOf(byCounty.feature));
    } else if (byState.feature >= 0) {
        near = stateName(byState.feature);
    } else {
        const line = nearNeighbour(counties, county, lat, px, py, LINE_KM, (g) => stateOf(g) === state
            && counties.names[g] !== counties.names[county]);
        near = line.feature >= 0 ? counties.names[line.feature] : '';
    }
    return { kind: 'county', county: counties.names[county], state: stateName(state), country: state >= 0 ? data.countries[state] : '', near };
}

/** A state's or province's place: the nearest town within 50 km, the country, and a line within 1 km. */
function areaPlace(data: PlaceData, area: number, lat: number, lng: number, px: number, py: number): PointPlace {
    const { admin1 } = data;
    const town = nearestTown(data.towns, lat, lng, TOWN_KM);
    const line = nearNeighbour(admin1, area, lat, px, py, LINE_KM, (g) => admin1.names[g] !== '' && admin1.names[g] !== admin1.names[area]);
    return { kind: 'land', town: town >= 0 ? data.towns.names[town] : '', state: admin1.names[area], country: data.countries[area],
        near: line.feature >= 0 ? admin1.names[line.feature] : '' };
}

/** A sea's place: its name ('' for an unnamed channel), then the nearest state or province within 200 km. */
function seaPlace(data: PlaceData, sea: number, lat: number, px: number, py: number): PointPlace {
    const off = nearestFeature(data.admin1, lat, px, py, OFF_KM);
    const place: PointPlace = { kind: 'sea', sea: data.marine.names[sea],
        off: off.feature >= 0 ? { state: data.admin1.names[off.feature], country: data.countries[off.feature] } : null };
    return place.sea === '' && place.off === null ? { kind: 'none' } : place;
}

/** The place at a latitude and longitude in range: a county in the US, else an area, else a sea, else the seam's nearer, else none. */
export function lookUp(data: PlaceData, lat: number, lng: number): PointPlace {
    const q = data.admin1.quantum;
    const px = lng / q;
    const py = lat / q;
    const { admin1, counties, marine } = data;

    const county = containing(counties, px, py)[0];
    if (county !== undefined) {
        return countyPlace(data, county, lat, px, py);
    }
    const area = containing(admin1, px, py)[0];
    if (area !== undefined) {
        return areaPlace(data, area, lat, lng, px, py);
    }
    // Offshore: the smallest sea holding the point (a bay inside its sea), a named one before an unnamed channel.
    let sea = -1;
    let seaRank = Infinity;
    for (const m of containing(marine, px, py)) {
        const b = marine.box;
        const rank = (b[4 * m + 2] - b[4 * m]) * (b[4 * m + 3] - b[4 * m + 1]) + (marine.names[m] === '' ? 1e18 : 0);
        if (rank < seaRank) {
            sea = m;
            seaRank = rank;
        }
    }
    if (sea >= 0) {
        return seaPlace(data, sea, lat, px, py);
    }
    // In neither: the nearer of the land (a county in the US first) and the sea within SEAM_KM.
    const nearCounty = nearestFeature(counties, lat, px, py, SEAM_KM);
    const nearArea = nearCounty.feature < 0 ? nearestFeature(admin1, lat, px, py, SEAM_KM) : { feature: -1, km: SEAM_KM };
    const nearSea = nearestFeature(marine, lat, px, py, SEAM_KM);
    const landKm = nearCounty.feature >= 0 ? nearCounty.km : nearArea.km;
    if ((nearCounty.feature >= 0 || nearArea.feature >= 0) && (nearSea.feature < 0 || landKm <= nearSea.km)) {
        return nearCounty.feature >= 0 ? countyPlace(data, nearCounty.feature, lat, px, py) : areaPlace(data, nearArea.feature, lat, lng, px, py);
    }
    return nearSea.feature >= 0 ? seaPlace(data, nearSea.feature, lat, px, py) : { kind: 'none' };
}

function join(parts: string[]): string {
    return parts.filter((p) => p !== '').join(', ');
}

function nearWords(near: string): string {
    return near !== '' ? ' (near the ' + near + ' line)' : '';
}

/** The place line's words for a place. */
export function placeWords(place: PointPlace): string {
    switch (place.kind) {
        case 'county':
            // A county named as its state (the District of Columbia, a US Virgin Island) says the name once.
            return join([place.county + nearWords(place.near), place.state !== place.county ? place.state : '', place.country]);
        case 'land':
            return join([place.town !== '' ? 'Near ' + place.town : '', place.state !== '' ? place.state + nearWords(place.near) : '', place.country]);
        case 'sea':
            if (!place.off) {
                return place.sea;
            }
            return place.sea !== '' ? place.sea + ', off ' + join([place.off.state, place.off.country]) : 'Off ' + join([place.off.state, place.off.country]);
        default:
            return PLACE_NONE;
    }
}


/** A typed or stored pair checked: swapped, out of range, waiting for the data, maybe swapped, or its place. */
export type PairCheck =
    | { state: 'swapped' }
    | { state: 'out-of-range' }
    | { state: 'waiting' }
    | { state: 'maybe-swapped'; place: PointPlace }
    | { state: 'place'; place: PointPlace };

const lookups = new WeakMap<PlaceData, Map<string, PointPlace>>();

/** `lookUp`, kept for the last pairs asked (the panel draws again on every live value). */
export function lookUpKept(data: PlaceData, lat: number, lng: number): PointPlace {
    let kept = lookups.get(data);
    if (!kept) {
        kept = new Map();
        lookups.set(data, kept);
    }
    const key = lat + ',' + lng;
    const found = kept.get(key);
    if (found) {
        return found;
    }
    const place = lookUp(data, lat, lng);
    if (kept.size >= 64) {
        // The oldest goes (a Map keeps the order its keys were set in), so the last 64 stay.
        kept.delete(kept.keys().next().value as string);
    }
    kept.set(key, place);
    return place;
}

/**
 * The swap rules and the place: a latitude past 90 or below -90 whose swap is in range looks swapped; any other pair out of range is
 * out of range (flagged as before entry 27); a pair in range waits for the data, then is maybe swapped when it lands in no area (no
 * land and no sea, after the 2 km seam: "No place found here") and its swap lands in one, a sea included, else its place. A point in
 * a sea reads its sea, whatever its swap.
 */
export function checkPair(data: PlaceData | null, lat: number, lng: number): PairCheck {
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return Math.abs(lat) > 90 && Math.abs(lat) <= 180 && Math.abs(lng) <= 90 ? { state: 'swapped' } : { state: 'out-of-range' };
    }
    if (!data) {
        return { state: 'waiting' };
    }
    const place = lookUpKept(data, lat, lng);
    if (place.kind === 'none' && Math.abs(lng) <= 90 && lookUpKept(data, lng, lat).kind !== 'none') {
        return { state: 'maybe-swapped', place };
    }
    return { state: 'place', place };
}

/** How the place data stands on this page. */
export interface PlaceStatus {
    state: 'idle' | 'loading' | 'ready' | 'failed';
    data: PlaceData | null;
}

/** What the place line shows, and its state for the e2e suite and the stylesheet (`data-place`). */
export interface PlaceLine {
    state: 'swapped' | 'out-of-range' | 'loading' | 'unavailable' | 'maybe-swapped' | 'none' | 'found';
    text: string;
}

/** The place line for a pair: the swap flag, nothing when out of range (the hint says so), the loading or failure words, or the place. */
export function placeLine(status: PlaceStatus, lat: number, lng: number): PlaceLine {
    const check = checkPair(status.state === 'ready' ? status.data : null, lat, lng);
    switch (check.state) {
        case 'swapped':
            return { state: 'swapped', text: LOOK_SWAPPED };
        case 'out-of-range':
            return { state: 'out-of-range', text: '' };
        case 'waiting':
            return status.state === 'failed' ? { state: 'unavailable', text: PLACE_UNAVAILABLE } : { state: 'loading', text: PLACE_LOADING };
        case 'maybe-swapped':
            return { state: 'maybe-swapped', text: MAY_BE_SWAPPED };
        default:
            return check.place.kind === 'none' ? { state: 'none', text: PLACE_NONE } : { state: 'found', text: placeWords(check.place) };
    }
}

/** The place data for a page: its status now, and the load, asked for once (the promise is kept, a failure too). */
export interface PlaceSource {
    status(): PlaceStatus;
    load(): Promise<PlaceStatus>;
}

export function createPlaceSource(fetchJson: () => Promise<unknown>): PlaceSource {
    let status: PlaceStatus = { state: 'idle', data: null };
    let promise: Promise<PlaceStatus> | null = null;
    return {
        status: () => status,
        load: () => {
            if (!promise) {
                status = { state: 'loading', data: null };
                promise = Promise.resolve()
                    .then(fetchJson)
                    .then((json) => {
                        status = { state: 'ready', data: decodePlaces(json) };
                        return status;
                    })
                    .catch((err: unknown) => {
                        console.warn('[MapStudio] The place check is not available: ' + (err instanceof Error ? err.message : String(err)));
                        status = { state: 'failed', data: null };
                        return status;
                    });
            }
            return promise;
        }
    };
}

/** The served file, as JSON; a refusal or a missing file is a failure. */
export function fetchPlaces(): Promise<unknown> {
    return fetch(PLACES_URL, { credentials: 'same-origin' }).then((response) => {
        if (!response.ok) {
            throw new Error(PLACES_URL + ' answered ' + response.status);
        }
        return response.json();
    });
}

/** This page's place data: nothing is fetched until Details first shows a point's location (PropertiesPanel). */
export const PLACES: PlaceSource = createPlaceSource(fetchPlaces);
