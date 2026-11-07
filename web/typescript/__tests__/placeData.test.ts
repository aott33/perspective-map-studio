// The place check's data maker (epic 4 entry 27; web/scripts/place-data.mjs, docs/place-check.md), run as a child process as the
// icon gate's test does: its encoders read back by placeCheck.ts's decoder (the two sides of the file's format agree), the words it
// takes from each source (a US state's own name, the county in the data's own word, a sea's English name where the name is in
// capitals, the towns it keeps), and the offline --check of a file against its manifest and the 5 MB limit, on small fixtures in a
// temp folder (npm test runs the same check on the committed file).
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { decodeLayer, decodeTowns } from '../placeCheck';

const webDir = path.resolve(__dirname, '..', '..');
const script = path.join(webDir, 'scripts', 'place-data.mjs');

function run(args: string[]): { status: number | null; out: string } {
    const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

/** The script's exports run on `input` in a child process (ES module), the result as JSON. */
function withScript(body: string, input: unknown): unknown {
    const code = `import * as s from ${JSON.stringify('file://' + script)};\n`
        + `const input = JSON.parse(process.argv[1]);\nconst result = (() => { ${body} })();\nprocess.stdout.write(JSON.stringify(result));`;
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', code, JSON.stringify(input)], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(r.stderr);
    }
    return JSON.parse(r.stdout);
}

describe('the encoders, read back by placeCheck.ts', () => {
    test('a topology as mapshaper writes it: the arcs rounded to 0.0001 degree, repeats dropped, and each feature\'s references', () => {
        const topo = {
            arcs: [[[-103.00004, 31], [-109, 31], [-109, 31.00001], [-109, 37], [-103, 37]], [[-103, 37], [-103, 31]],
                [[-103, 37], [-97, 37], [-97, 31], [-103, 31]]],
            objects: { in: { geometries: [
                { type: 'Polygon', arcs: [[0, 1]], properties: { name: 'New Mexico' } },
                { type: 'MultiPolygon', arcs: [[[2, -2]]], properties: { name: 'Texas' } },
                { type: null, properties: { name: 'Empty' } }
            ] } }
        };
        const encoded = withScript('return s.encodeTopology(input, "in");', topo) as {
            arcs: string; rings: string; arcCount: number; vertices: number; properties: Array<{ name: string }>;
        };
        expect(encoded.arcCount).toBe(3);
        // -109, 31.00001 rounds to -109, 31 and is dropped as a repeat.
        expect(encoded.vertices).toBe(10);
        expect(encoded.properties.map((p) => p.name)).toEqual(['New Mexico', 'Texas', 'Empty']);
        const layer = decodeLayer(encoded.arcs, encoded.rings, ['New Mexico', 'Texas', 'Empty'], 0.0001);
        expect(Array.from(layer.start)).toEqual([0, 4, 6, 10]);
        expect(Array.from(layer.xy.slice(0, 8))).toEqual([-1030000, 310000, -1090000, 310000, -1090000, 370000, -1030000, 370000]);
        expect(Array.from(layer.refs)).toEqual([0, 1, 2, ~1]);
        expect(Array.from(layer.refStart)).toEqual([0, 2, 4, 4]);
        expect(Array.from(layer.box.slice(0, 4))).toEqual([-1090000, 310000, -1030000, 370000]);
    });

    test('the towns: names with "|" between them, points read back to 0.001 degree, near ones next to each other', () => {
        const list = [{ name: 'Grande Prairie', lat: 55.16667, lng: -118.80271 }, { name: 'Sydney', lat: -33.86785, lng: 151.20732 },
            { name: 'Beaverlodge', lat: 55.2, lng: -119.43 }];
        const encoded = withScript('return s.encodeTowns(input);', list) as { names: string; points: string; count: number };
        expect(encoded.count).toBe(3);
        const towns = decodeTowns(encoded.names, encoded.points, 0.001);
        expect([...towns.names].sort()).toEqual(['Beaverlodge', 'Grande Prairie', 'Sydney']);
        const at = towns.names.indexOf('Sydney');
        expect(towns.lat[at]).toBeCloseTo(-33.868, 3);
        expect(towns.lng[at]).toBeCloseTo(151.207, 3);
        // Z-order: the two Alberta towns sit together, Sydney apart.
        expect(Math.abs(towns.names.indexOf('Grande Prairie') - towns.names.indexOf('Beaverlodge'))).toBe(1);
    });
});

describe('the words from each source', () => {
    test('an admin-1 area: the English name, a US state its own (DC is not "Washington"); its ISO code, else its country\'s name', () => {
        const r = withScript('return input.map((p) => [s.admin1Name(p), s.admin1Country(p)]);', [
            { name: 'Bayern', name_en: 'Bavaria', iso_a2: 'DE', admin: 'Germany' },
            { name: 'District of Columbia', name_en: 'Washington', iso_a2: 'US', admin: 'United States of America' },
            { name: 'Somaliland', name_en: 'Somaliland', iso_a2: '-1', admin: 'Somaliland' },
            { name: 'Primor\'ye', name_en: '', iso_a2: 'RU', admin: 'Russia' }
        ]);
        expect(r).toEqual([['Bavaria', 'DE'], ['District of Columbia', 'US'], ['Somaliland', 'Somaliland'], ['Primor\'ye', 'RU']]);
    });

    test('a county in the data\'s own word; a sea by its English name where its name is in capitals', () => {
        const r = withScript('return [input.counties.map(s.countyName), input.seas.map(s.seaName)];', {
            counties: [{ NAME: 'Lafourche', NAME_ALT: 'Lafourche Parish', TYPE_EN: 'Parish' }, { NAME: 'North Slope', NAME_ALT: 'North Slope Borough' },
                { NAME: 'Saint Croix', NAME_ALT: '', TYPE_EN: '(County Equivalent)' }],
            seas: [{ name: 'INDIAN OCEAN', name_en: 'Indian Ocean' }, { name: 'North Atlantic Ocean', name_en: 'Atlantic Ocean' }, { name: '', name_en: '' }]
        });
        expect(r).toEqual([['Lafourche Parish', 'North Slope Borough', 'Saint Croix County Equivalent'], ['Indian Ocean', 'North Atlantic Ocean', '']]);
    });

    test('the towns kept: populated places outside the US, PR and VI, not a section of a town, an abandoned or a historical one', () => {
        const row = (name: string, code: string, country: string): string => ['1', name, name, '', '55.1', '-118.8', 'P', code, country,
            '', '', '', '', '', '6000'].join('\t');
        const text = [row('Grande Prairie', 'PPL', 'CA'), row('Hobbs', 'PPL', 'US'), row('San Juan', 'PPLC', 'PR'), row('Old Town', 'PPLX', 'CA'),
            row('Gone', 'PPLQ', 'CA'), row('A|B', 'PPLA', 'MX'), ''].join('\n');
        const r = withScript('return s.readTowns(input);', text) as { towns: Array<{ name: string }>; renamed: number };
        expect(r.towns.map((t) => t.name)).toEqual(['Grande Prairie', 'A/B']);
        expect(r.renamed).toBe(1);
    });
});

describe('--check, offline', () => {
    function folder(data: string, manifest: (bytes: number, sha: string) => object): string {
        const dir = mkdtempSync(path.join(tmpdir(), 'ms-places-'));
        writeFileSync(path.join(dir, 'places.json'), data);
        const bytes = Buffer.byteLength(data);
        writeFileSync(path.join(dir, 'sources.json'), JSON.stringify(manifest(bytes, createHash('sha256').update(data).digest('hex'))));
        return dir;
    }

    const sha = 'a'.repeat(64);
    const sources = ['admin1', 'counties', 'marine', 'towns'].map((id) => ({ id, url: 'https://example.invalid/' + id, licence: 'x', version: '1', sha256: sha }));
    const layer = { arcs: '', rings: '', names: [] };
    const good = JSON.stringify({ format: 'mapstudio-places', version: 1, credit: 'Places: Natural Earth, GeoNames (CC BY 4.0)', sources,
        settings: {}, admin1: layer, counties: layer, marine: layer, towns: { names: '', points: '' } }) + '\n';

    test('a file that matches its manifest passes', () => {
        const dir = folder(good, (bytes, hash) => ({ bytes, sha256: hash }));
        try {
            const r = run(['--check', '--out', dir]);
            expect(r.out).toBe('');
            expect(r.status).toBe(0);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test('a file changed since its manifest, without the credit, or missing a source fails, saying why', () => {
        const changed = folder(good.replace('"version":1', '"version":2'), (bytes) => ({ bytes, sha256: 'b'.repeat(64) }));
        const noCredit = folder(good.replace('Places: Natural Earth, GeoNames (CC BY 4.0)', 'Places'), (bytes, hash) => ({ bytes, sha256: hash }));
        const noTowns = folder(good.replace(/,\{"id":"towns"[^}]*\}/, ''), (bytes, hash) => ({ bytes, sha256: hash }));
        try {
            const a = run(['--check', '--out', changed]);
            expect(a.status).toBe(1);
            expect(a.out).toContain('does not match the SHA-256 in sources.json');
            expect(a.out).toContain('is not mapstudio-places version 1');
            const b = run(['--check', '--out', noCredit]);
            expect(b.status).toBe(1);
            expect(b.out).toContain('does not carry the credit');
            const c = run(['--check', '--out', noTowns]);
            expect(c.status).toBe(1);
            expect(c.out).toContain('names the sources admin1,counties,marine, not admin1,counties,marine,towns');
        } finally {
            for (const dir of [changed, noCredit, noTowns]) {
                rmSync(dir, { recursive: true, force: true });
            }
        }
    });

    test('a file over 5 MB fails, and so does a folder without the file', () => {
        const big = folder(good.replace('"settings":{}', '"settings":{"pad":"' + 'x'.repeat(5_000_000) + '"}'), (bytes, hash) => ({ bytes, sha256: hash }));
        const empty = mkdtempSync(path.join(tmpdir(), 'ms-places-'));
        try {
            const a = run(['--check', '--out', big]);
            expect(a.status).toBe(1);
            expect(a.out).toMatch(/places\.json is \d+ bytes, over the 5000000 byte limit/);
            const b = run(['--check', '--out', empty]);
            expect(b.status).toBe(1);
            expect(b.out).toContain('npm run place-data makes them');
        } finally {
            rmSync(big, { recursive: true, force: true });
            rmSync(empty, { recursive: true, force: true });
        }
    });
});
