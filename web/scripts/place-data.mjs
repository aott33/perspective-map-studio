#!/usr/bin/env node
// The place check's data (epic 4 entry 27; docs/place-check.md): made once, by hand, from Natural Earth's
// admin-1 boundaries, US counties and marine polygons (public domain) and GeoNames' towns (CC BY 4.0), then
// committed under web/assets/place/, so builds and CI never download it. The web build copies places.json
// beside the bundle (webpack.config.js) and the Gateway serves it at /res/mapstudio/places.json; the browser
// fetches it once per page when Details first shows a point's location (web/typescript/placeCheck.ts).
//
//   npm run place-data                   download the sources (or reuse the cache), simplify the borders,
//                                        write web/assets/place/places.json and its manifest sources.json
//   node scripts/place-data.mjs --check  offline: the committed file against its manifest and the 5 MB
//                                        limit (npm test runs it)
//
// Options: --cache <dir> (default web/build/place-data; a source already there is reused, --refresh fetches
// it again), --out <dir> (default web/assets/place).
//
// The simplifier, mapshaper (MPL-2.0), is a dev dependency only: it is loaded when the data is made, and
// nothing of it is in the module. Borders are simplified with Douglas-Peucker at 100 m on the layer's own
// topology, so neighbours share one simplified line and no gap opens between them, then rounded to
// 0.0001 degree (about 11 m). The file's format is in docs/place-check.md; placeCheck.ts reads it.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const here = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(here, '..');

export const DEFAULTS = {
    cache: path.join(webDir, 'build', 'place-data'),
    out: path.join(webDir, 'assets', 'place')
};

/** The file the browser fetches, and its manifest (not served). */
export const DATA_FILE = 'places.json';
export const MANIFEST_FILE = 'sources.json';
export const FORMAT = 'mapstudio-places';
export const FORMAT_VERSION = 1;
/** The bytes the Gateway may send for the file (the owner, 2026-11-03: within 5 MB on the wire). */
export const MAX_BYTES = 5_000_000;
/** Douglas-Peucker tolerance in metres (border precision A, the owner, 2026-11-07). */
export const INTERVAL_M = 100;
/** Degrees per stored unit: borders, and towns (a town only has to be told within 50 km). */
export const QUANTUM = 0.0001;
export const TOWN_QUANTUM = 0.001;
/** The words the place line's tooltip carries; also in the file, so the credit travels with the data. */
export const CREDIT = 'Places: Natural Earth, GeoNames (CC BY 4.0)';
/** GeoNames feature codes that are not a town: a section of one, historical, abandoned, destroyed, religious. */
export const TOWN_CODES_LEFT_OUT = ['PPLX', 'PPLH', 'PPLQ', 'PPLW', 'PPLCH', 'PPLR'];
/** Countries whose points read their county (Natural Earth's US counties cover the states, DC, PR and VI). */
export const TOWN_COUNTRIES_LEFT_OUT = ['US', 'PR', 'VI'];

const NE = 'https://naciscdn.org/naturalearth/10m/';
export const SOURCES = [
    { id: 'admin1', title: 'Natural Earth 1:10m Admin 1 - States, Provinces', licence: 'Public domain',
        url: NE + 'cultural/ne_10m_admin_1_states_provinces.zip', layer: 'ne_10m_admin_1_states_provinces',
        fields: ['name', 'name_en', 'iso_a2', 'iso_3166_2', 'admin'] },
    { id: 'counties', title: 'Natural Earth 1:10m Admin 2 - Counties (US)', licence: 'Public domain',
        url: NE + 'cultural/ne_10m_admin_2_counties.zip', layer: 'ne_10m_admin_2_counties',
        fields: ['NAME', 'NAME_ALT', 'NAME_EN', 'TYPE_EN', 'REGION'] },
    { id: 'marine', title: 'Natural Earth 1:10m Marine Areas', licence: 'Public domain',
        url: NE + 'physical/ne_10m_geography_marine_polys.zip', layer: 'ne_10m_geography_marine_polys',
        fields: ['name', 'name_en'] },
    { id: 'towns', title: 'GeoNames cities5000 (populated places of 5,000 people or more)', licence: 'CC BY 4.0',
        url: 'https://download.geonames.org/export/dump/cities5000.zip', file: 'cities5000.txt' }
];

// ---------------------------------------------------------------------------------------------------------
// The text encoding (docs/place-check.md): numbers as base64url characters, 5 bits each, low bits first,
// the 32 bit set on every character but a number's last; a signed number zigzagged first (0, -1, 1, -2 ...).

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function writeUint(n, out) {
    if (!Number.isSafeInteger(n) || n < 0) throw new Error(`not a whole number of 0 or more: ${n}`);
    while (n >= 32) {
        out.push(ALPHABET[32 + (n % 32)]);
        n = Math.floor(n / 32);
    }
    out.push(ALPHABET[n]);
}

export function writeInt(v, out) {
    writeUint(v >= 0 ? v * 2 : -v * 2 - 1, out);
}

/**
 * One topology layer as text: `arcs` (per arc its point count, then each point's x and y in QUANTUM units as
 * the difference from the point before, across arcs, from 0,0), and `rings` (per feature its ring count, per
 * ring its arc count, per arc reference the zigzagged difference of its arc index from the one before, times
 * two, plus one when the arc is walked backwards). A feature's parts are flattened into one list of rings,
 * read even-odd.
 */
export function encodeTopology(topo, layer) {
    const arcs = [];
    let px = 0;
    let py = 0;
    let vertices = 0;
    for (const arc of topo.arcs) {
        const points = [];
        for (const [lng, lat] of arc) {
            const x = Math.round(lng / QUANTUM);
            const y = Math.round(lat / QUANTUM);
            const last = points[points.length - 1];
            if (!last || last[0] !== x || last[1] !== y) points.push([x, y]);
        }
        writeUint(points.length, arcs);
        for (const [x, y] of points) {
            writeInt(x - px, arcs);
            writeInt(y - py, arcs);
            px = x;
            py = y;
        }
        vertices += points.length;
    }
    const rings = [];
    let prev = 0;
    const geometries = topo.objects[layer].geometries;
    for (const g of geometries) {
        const list = g.type === 'Polygon' ? g.arcs : g.type === 'MultiPolygon' ? g.arcs.flat() : [];
        writeUint(list.length, rings);
        for (const ring of list) {
            writeUint(ring.length, rings);
            for (const ref of ring) {
                const index = ref < 0 ? ~ref : ref;
                const d = index - prev;
                writeUint((d >= 0 ? d * 2 : -d * 2 - 1) * 2 + (ref < 0 ? 1 : 0), rings);
                prev = index;
            }
        }
    }
    return { arcs: arcs.join(''), rings: rings.join(''), arcCount: topo.arcs.length, vertices,
        properties: geometries.map((g) => g.properties || {}) };
}

/** A Morton (Z-order) key, so towns near each other sit near each other in the list and their differences stay small. */
function morton(x, y) {
    let key = 0n;
    for (let bit = 0n; bit < 20n; bit++) {
        key |= ((BigInt(x) >> bit) & 1n) << (2n * bit);
        key |= ((BigInt(y) >> bit) & 1n) << (2n * bit + 1n);
    }
    return key;
}

/** The towns as text: names joined by "|", and per town its x and y in TOWN_QUANTUM units as the difference from the one before. */
export function encodeTowns(towns) {
    const rows = towns.map((t) => {
        const x = Math.round((t.lng + 180) / TOWN_QUANTUM);
        const y = Math.round((t.lat + 90) / TOWN_QUANTUM);
        return { name: t.name, x, y, key: morton(x, y) };
    });
    rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const points = [];
    let px = 0;
    let py = 0;
    for (const r of rows) {
        writeInt(r.x - px, points);
        writeInt(r.y - py, points);
        px = r.x;
        py = r.y;
    }
    return { names: rows.map((r) => r.name).join('|'), points: points.join(''), count: rows.length };
}

// ---------------------------------------------------------------------------------------------------------
// The sources: downloaded once into the cache, read from their zip files.

function sha256(buffer) {
    return createHash('sha256').update(buffer).digest('hex');
}

/** A zip file's entries by name (stored or deflated, no zip64: the sources are well under 4 GB). */
export function readZip(buffer) {
    let end = buffer.length - 22;
    while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end--;
    if (end < 0) throw new Error('not a zip file (no end of central directory)');
    const count = buffer.readUInt16LE(end + 10);
    let at = buffer.readUInt32LE(end + 16);
    const entries = new Map();
    for (let i = 0; i < count; i++) {
        if (buffer.readUInt32LE(at) !== 0x02014b50) throw new Error('bad zip central directory');
        const method = buffer.readUInt16LE(at + 10);
        const size = buffer.readUInt32LE(at + 20);
        const nameLength = buffer.readUInt16LE(at + 28);
        const extraLength = buffer.readUInt16LE(at + 30);
        const commentLength = buffer.readUInt16LE(at + 32);
        const local = buffer.readUInt32LE(at + 42);
        const name = buffer.toString('utf8', at + 46, at + 46 + nameLength);
        entries.set(name, () => {
            if (buffer.readUInt32LE(local) !== 0x04034b50) throw new Error(`bad zip entry ${name}`);
            const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
            const data = buffer.subarray(start, start + size);
            if (method === 0) return Buffer.from(data);
            if (method === 8) return zlib.inflateRawSync(data);
            throw new Error(`zip entry ${name} uses compression method ${method}`);
        });
        at += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
}

function entry(zip, name) {
    const read = zip.get(name);
    if (!read) throw new Error(`the zip has no ${name}`);
    return read();
}

/** A source from the cache, or downloaded into it: its bytes and what the manifest says of it. */
async function fetchSource(source, cacheDir, refresh) {
    mkdirSync(cacheDir, { recursive: true });
    const file = path.join(cacheDir, path.basename(new URL(source.url).pathname));
    const meta = file + '.meta.json';
    if (refresh || !existsSync(file) || !existsSync(meta)) {
        console.log(`place-data: downloading ${source.url}`);
        const response = await fetch(source.url);
        if (!response.ok) throw new Error(`${source.url} answered ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        writeFileSync(file, bytes);
        writeFileSync(meta, JSON.stringify({ lastModified: response.headers.get('last-modified'),
            retrieved: new Date().toISOString().slice(0, 10) }, null, 4) + '\n');
    } else {
        console.log(`place-data: reusing ${path.relative(webDir, file)}`);
    }
    const bytes = readFileSync(file);
    const { lastModified, retrieved } = JSON.parse(readFileSync(meta, 'utf8'));
    return { bytes, zip: readZip(bytes), info: { id: source.id, title: source.title, url: source.url, licence: source.licence,
        sha256: sha256(bytes), bytes: bytes.length, lastModified, retrieved } };
}

/** One Natural Earth layer simplified on its topology by mapshaper (loaded here only: a dev dependency). */
async function simplify(source, zip) {
    const require = createRequire(path.join(webDir, 'package.json'));
    const mapshaper = require('mapshaper');
    const input = {};
    for (const ext of ['shp', 'dbf', 'prj', 'cpg']) input['in.' + ext] = entry(zip, `${source.layer}.${ext}`);
    const commands = `-i in.shp -filter-fields ${source.fields.join(',')} -simplify dp interval=${INTERVAL_M} keep-shapes`
        + ' -o out.json format=topojson no-quantization';
    const out = await mapshaper.applyCommands(commands, input);
    return JSON.parse(out['out.json']);
}

// ---------------------------------------------------------------------------------------------------------
// The layers' words.

const ISO2 = /^[A-Z]{2}$/;

/** An admin-1 area's name as the place line says it: Natural Earth's English name, but a US state's own (its DC reads "Washington" in English). */
export function admin1Name(p) {
    const name = (p.name || '').trim();
    const en = (p.name_en || '').trim();
    return p.iso_a2 === 'US' ? name || en : en || name;
}

/** Its country as the place line says it: the ISO code, or the area's country name where Natural Earth gives none (Somaliland, Northern Cyprus). */
export function admin1Country(p) {
    return ISO2.test(p.iso_a2 || '') ? p.iso_a2 : (p.admin || '').trim();
}

/**
 * A county in the data's own words ("Lafourche Parish", "North Slope Borough", "Carson City"): `NAME_ALT`, its name spelt as
 * `NAME_EN` where `NAME` is `NAME_EN` with its accents or its other letters dropped (Puerto Rico's "Mayagez" is "Mayagüez", New
 * Hampshire's "Coos" is "Coös"), and without a type in brackets (the US Virgin Islands' "Saint Croix (County Equivalent)").
 */
export function countyName(p) {
    const name = (p.NAME || '').trim();
    const en = (p.NAME_EN || '').trim();
    const lost = en !== '' && en !== name && (en.normalize('NFD').replace(/[̀-ͯ]/g, '') === name || en.replace(/[^\x20-\x7e]/g, '') === name);
    let alt = (p.NAME_ALT || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    if (alt === '') {
        const type = (p.TYPE_EN || '').includes('(') ? '' : (p.TYPE_EN || '').trim();
        alt = [name, type].filter((s) => s !== '').join(' ');
    }
    return lost && alt.startsWith(name) ? en + alt.slice(name.length) : alt;
}

/** A sea's name: Natural Earth's, but its English name where the name is in capitals ("INDIAN OCEAN" reads "Indian Ocean"). */
export function seaName(p) {
    const name = (p.name || '').trim();
    const en = (p.name_en || '').trim();
    return name !== '' && name === name.toUpperCase() && en !== '' ? en : name;
}

/** The GeoNames rows that are towns, outside the countries whose points read their county. */
export function readTowns(text) {
    const towns = [];
    let renamed = 0;
    for (const line of text.split('\n')) {
        if (line === '') continue;
        const c = line.split('\t');
        if (c.length < 15 || c[6] !== 'P' || TOWN_CODES_LEFT_OUT.includes(c[7]) || TOWN_COUNTRIES_LEFT_OUT.includes(c[8])) continue;
        let name = c[1].trim();
        const lat = Number(c[4]);
        const lng = Number(c[5]);
        if (name === '' || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        if (name.includes('|')) {
            name = name.replace(/\|/g, '/');
            renamed++;
        }
        towns.push({ name, lat, lng });
    }
    return { towns, renamed };
}

// ---------------------------------------------------------------------------------------------------------

async function generate(options) {
    const fetched = {};
    for (const source of SOURCES) fetched[source.id] = await fetchSource(source, options.cache, options.refresh);
    const sources = [];
    const layers = {};
    const counts = {};
    for (const source of SOURCES.filter((s) => s.layer)) {
        const { zip, info } = fetched[source.id];
        info.version = entry(zip, `${source.layer}.VERSION.txt`).toString('utf8').trim();
        sources.push(info);
        console.log(`place-data: simplifying ${source.layer} ${info.version} at ${INTERVAL_M} m`);
        const topo = await simplify(source, zip);
        layers[source.id] = { topo, encoded: encodeTopology(topo, 'in') };
        counts[source.id] = { features: layers[source.id].encoded.properties.length, arcs: layers[source.id].encoded.arcCount,
            vertices: layers[source.id].encoded.vertices };
    }
    const admin1 = layers.admin1.encoded;
    const counties = layers.counties.encoded;
    const marine = layers.marine.encoded;
    const byCode = new Map();
    admin1.properties.forEach((p, i) => { if (p.iso_3166_2 && !byCode.has(p.iso_3166_2)) byCode.set(p.iso_3166_2, i); });
    const unmatched = new Set();
    const states = counties.properties.map((p) => {
        const i = byCode.get('US-' + p.REGION);
        if (i === undefined) unmatched.add(p.REGION);
        return i === undefined ? -1 : i;
    });
    if (unmatched.size > 0) console.log(`place-data: counties with no admin-1 code match (read by the point's area): ${[...unmatched].join(', ')}`);

    const townSource = SOURCES.find((s) => s.id === 'towns');
    const { zip: townZip, info: townInfo } = fetched.towns;
    townInfo.version = townInfo.lastModified ? 'export of ' + new Date(townInfo.lastModified).toISOString().slice(0, 10) : 'export of ' + townInfo.retrieved;
    sources.push(townInfo);
    const { towns, renamed } = readTowns(entry(townZip, townSource.file).toString('utf8'));
    if (renamed > 0) console.log(`place-data: ${renamed} town names had a "|", written as "/"`);
    const encodedTowns = encodeTowns(towns);
    counts.towns = encodedTowns.count;

    const settings = { intervalMeters: INTERVAL_M, quantum: QUANTUM, townQuantum: TOWN_QUANTUM, townKm: 50, offKm: 200, lineKm: 1,
        townCodesLeftOut: TOWN_CODES_LEFT_OUT, townCountriesLeftOut: TOWN_COUNTRIES_LEFT_OUT, simplifier: simplifierName() };
    const data = {
        format: FORMAT,
        version: FORMAT_VERSION,
        credit: CREDIT,
        sources,
        settings,
        admin1: { arcs: admin1.arcs, rings: admin1.rings, names: admin1.properties.map(admin1Name),
            countries: admin1.properties.map(admin1Country) },
        counties: { arcs: counties.arcs, rings: counties.rings, names: counties.properties.map(countyName), states },
        marine: { arcs: marine.arcs, rings: marine.rings, names: marine.properties.map(seaName) },
        towns: { names: encodedTowns.names, points: encodedTowns.points }
    };
    const text = JSON.stringify(data) + '\n';
    const bytes = Buffer.byteLength(text, 'utf8');
    mkdirSync(options.out, { recursive: true });
    writeFileSync(path.join(options.out, DATA_FILE), text);
    const manifest = { format: FORMAT, version: FORMAT_VERSION, file: DATA_FILE, bytes, sha256: sha256(Buffer.from(text, 'utf8')),
        maxBytes: MAX_BYTES, credit: CREDIT, settings, counts, sources: data.sources,
        made: 'web/scripts/place-data.mjs (npm run place-data); see docs/place-check.md' };
    writeFileSync(path.join(options.out, MANIFEST_FILE), JSON.stringify(manifest, null, 4) + '\n');
    console.log(`place-data: wrote ${path.relative(webDir, path.join(options.out, DATA_FILE))}, ${bytes} bytes`
        + ` (${counts.admin1.features} areas, ${counts.counties.features} counties, ${counts.marine.features} seas, ${counts.towns} towns)`);
    if (bytes > MAX_BYTES) {
        console.error(`place-data: ${bytes} bytes is over the ${MAX_BYTES} byte limit`);
        return 1;
    }
    return 0;
}

function simplifierName() {
    const require = createRequire(path.join(webDir, 'package.json'));
    return 'mapshaper ' + require('mapshaper/package.json').version + ` (Douglas-Peucker, interval=${INTERVAL_M} m, keep-shapes)`;
}

/** Problems with the committed file against its manifest; none when it holds. */
export function checkOutput(outDir) {
    const problems = [];
    const say = (m) => problems.push(`place-data: ${m}`);
    const dataPath = path.join(outDir, DATA_FILE);
    const manifestPath = path.join(outDir, MANIFEST_FILE);
    if (!existsSync(dataPath) || !existsSync(manifestPath)) {
        say(`${DATA_FILE} and ${MANIFEST_FILE} must both be in ${outDir} (npm run place-data makes them)`);
        return problems;
    }
    const bytes = readFileSync(dataPath);
    let manifest;
    try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch (err) {
        say(`${MANIFEST_FILE} is not JSON: ${err.message}`);
        return problems;
    }
    if (bytes.length > MAX_BYTES) say(`${DATA_FILE} is ${bytes.length} bytes, over the ${MAX_BYTES} byte limit`);
    if (manifest.bytes !== bytes.length) say(`${DATA_FILE} is ${bytes.length} bytes; ${MANIFEST_FILE} says ${manifest.bytes}`);
    if (manifest.sha256 !== sha256(bytes)) say(`${DATA_FILE} does not match the SHA-256 in ${MANIFEST_FILE}; make both with npm run place-data`);
    let data;
    try {
        data = JSON.parse(bytes.toString('utf8'));
    } catch (err) {
        say(`${DATA_FILE} is not JSON: ${err.message}`);
        return problems;
    }
    if (data.format !== FORMAT || data.version !== FORMAT_VERSION) say(`${DATA_FILE} is not ${FORMAT} version ${FORMAT_VERSION}`);
    if (data.credit !== CREDIT) say(`${DATA_FILE} does not carry the credit "${CREDIT}"`);
    const ids = (data.sources || []).map((s) => s.id).join(',');
    if (ids !== SOURCES.map((s) => s.id).join(',')) say(`${DATA_FILE} names the sources ${ids}, not ${SOURCES.map((s) => s.id).join(',')}`);
    for (const s of data.sources || []) {
        if (!/^[0-9a-f]{64}$/.test(s.sha256 || '') || !s.version || !s.url || !s.licence) say(`source ${s.id} lacks its url, licence, version or SHA-256`);
    }
    for (const layer of ['admin1', 'counties', 'marine']) {
        const l = data[layer];
        if (!l || typeof l.arcs !== 'string' || typeof l.rings !== 'string' || !Array.isArray(l.names)) say(`${DATA_FILE} has no ${layer} layer`);
    }
    if (!data.towns || typeof data.towns.names !== 'string' || typeof data.towns.points !== 'string') say(`${DATA_FILE} has no towns`);
    return problems;
}

function parseArgs(argv) {
    const options = { ...DEFAULTS, check: false, refresh: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--check') options.check = true;
        else if (a === '--refresh') options.refresh = true;
        else if (a === '--cache' || a === '--out') options[a.slice(2)] = path.resolve(argv[++i]);
        else throw new Error(`unknown option ${a}`);
    }
    return options;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.check) {
        const problems = checkOutput(options.out);
        for (const p of problems) console.error(p);
        return problems.length === 0 ? 0 : 1;
    }
    return generate(options);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().then((code) => process.exit(code), (err) => {
        console.error(`place-data: ${err.stack || err.message}`);
        process.exit(1);
    });
}
