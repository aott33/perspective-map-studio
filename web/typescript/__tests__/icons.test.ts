// Story 2.10: the icon set's build and licence gate (web/scripts/icons.mjs),
// run as a child process so the test sees exactly what the build sees.
import { spawnSync } from 'child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

const webDir = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(webDir, '..');
const script = path.join(webDir, 'scripts', 'icons.mjs');
const srcDir = path.join(webDir, 'icons', 'src');
const sourcesFile = path.join(webDir, 'icons', 'sources.json');
const noticeFile = path.join(repoRoot, 'NOTICE');
const catalogueFile = path.join(repoRoot, 'common', 'src', 'main', 'resources', 'com', 'aoindustrial',
    'perspective', 'mapstudio', 'common', 'icons.json');

const ICON_COUNT = 28;
const FR9_AND_OWNER = ['well-pad', 'wellhead', 'tank-battery', 'compressor-station', 'booster-station',
    'meter-station', 'pig-trap', 'line-valve', 'tap', 'rtu', 'pipeline', 'lateral', 'lease-road', 'geofence',
    'region', 'site-footprint', 'swd', 'separator'];
const STATE_GLYPHS = ['alarm-1-acknowledged', 'alarm-1-rectified', 'alarm-1-unacknowledged', 'alarm-2-acknowledged',
    'alarm-2-rectified', 'alarm-2-unacknowledged', 'alarm-3', 'comms-lost', 'stale'];

const STROKED = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';

function icons(args: string[]): { status: number | null; out: string } {
    const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

interface Fixture { dir: string; args: string[]; out: string; }

/** A copy of the sources, SVGs, catalogue and NOTICE in a temp folder, for the failure cases. */
function fixture(): Fixture {
    const dir = mkdtempSync(path.join(tmpdir(), 'ms-icons-'));
    cpSync(srcDir, path.join(dir, 'src'), { recursive: true });
    cpSync(sourcesFile, path.join(dir, 'sources.json'));
    cpSync(catalogueFile, path.join(dir, 'icons.json'));
    cpSync(noticeFile, path.join(dir, 'NOTICE'));
    const out = path.join(dir, 'out');
    return {
        dir,
        out,
        args: ['--src', path.join(dir, 'src'), '--sources', path.join(dir, 'sources.json'),
            '--catalogue', path.join(dir, 'icons.json'), '--out', out, '--notice', path.join(dir, 'NOTICE')]
    };
}

/** Runs `change` on a fresh fixture, then the check; returns its result and removes the fixture. */
function checkAfter(change: (f: Fixture) => void): { status: number | null; out: string } {
    const f = fixture();
    try {
        change(f);
        return icons([...f.args, '--check']);
    } finally {
        rmSync(f.dir, { recursive: true, force: true });
    }
}

function writeIcon(f: Fixture, id: string, text: string): void {
    writeFileSync(path.join(f.dir, 'src', id + '.svg'), text);
}

function editSources(f: Fixture, edit: (sources: { icons: Array<Record<string, unknown>> }) => void): void {
    const file = path.join(f.dir, 'sources.json');
    const sources = JSON.parse(readFileSync(file, 'utf8'));
    edit(sources);
    writeFileSync(file, JSON.stringify(sources));
}

describe('icon set', () => {
    it('passes the check with the committed sources, catalogue and NOTICE', () => {
        const r = icons(['--check']);
        expect(r.out).toContain(`${ICON_COUNT} icons checked`);
        expect(r.status).toBe(0);
    });

    it('covers every FR-9 kind, the owner additions, the fallback and the ER-27 state glyphs', () => {
        const cat = JSON.parse(readFileSync(catalogueFile, 'utf8'));
        const ids = cat.icons.map((i: { id: string }) => i.id);
        expect(ids).toHaveLength(ICON_COUNT);
        for (const id of FR9_AND_OWNER) expect(ids).toContain(id);
        expect(cat.fallback).toBe('point');
        expect(cat.icons.filter((i: { group: string }) => i.group === 'state').map((i: { id: string }) => i.id).sort())
            .toEqual(STATE_GLYPHS);
    });

    it('builds a sprite with one symbol per icon and only currentColor or none as paint', () => {
        const f = fixture();
        try {
            const r = icons(f.args);
            expect(r.status).toBe(0);
            const sprite = readFileSync(path.join(f.out, 'mapstudio-icons.svg'), 'utf8');
            expect((sprite.match(/<symbol id="ms-/g) || []).length).toBe(ICON_COUNT);
            expect(sprite).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|url\s*\(|style|href/i);
            // Every paint value, quoted either way or unquoted, is on the allow list: no named colour.
            const paints = [...sprite.matchAll(/\b(fill|stroke|color)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/g)]
                .map((m) => m[2] ?? m[3] ?? m[4]);
            expect(paints.length).toBeGreaterThan(0);
            for (const p of paints) expect(['none', 'currentColor']).toContain(p);
            expect(sprite).not.toMatch(/openbridge|upstream/i);
            const sheet = readFileSync(path.join(f.out, 'contact-sheet.html'), 'utf8');
            for (const id of FR9_AND_OWNER) expect(sheet).toContain(`data-icon="${id}"`);
            expect(sheet).toContain('engineering review (ER-27) before release');
        } finally {
            rmSync(f.dir, { recursive: true, force: true });
        }
    });

    it('fails on sprite drift: an SVG without an entry, and an entry without an SVG', () => {
        const r = checkAfter((f) => {
            writeIcon(f, 'extra', readFileSync(path.join(srcDir, 'tap.svg'), 'utf8'));
            unlinkSync(path.join(f.dir, 'src', 'wellhead.svg'));
        });
        expect(r.status).toBe(1);
        expect(r.out).toContain('src/extra.svg has no entry');
        expect(r.out).toContain('wellhead has no src/wellhead.svg');
    });

    it('fails when the committed catalogue does not match the sources', () => {
        const r = checkAfter((f) => writeFileSync(path.join(f.dir, 'icons.json'), '{}\n'));
        expect(r.status).toBe(1);
        expect(r.out).toContain('does not match sources.json');
    });

    it('fails on a forbidden source or licence and names the entry', () => {
        const r = checkAfter((f) => editSources(f, (s) => {
            const tap = s.icons.find((e) => e.id === 'tap')!;
            tap.origin = 'tabler:git-merge@3.49.0';
            tap.licence = 'CC-BY-SA-4.0';
            tap.modified = 'none';
            s.icons.find((e) => e.id === 'well-pad')!.origin = 'openbridge:pad@1.0.1';
            s.icons.find((e) => e.id === 'wellhead')!.modified = 'traced from upstream.svg';
            s.icons.find((e) => e.id === 'swd')!.origin = 'upstream/water-google';
        }));
        expect(r.status).toBe(1);
        expect(r.out).toContain('tap licence "CC-BY-SA-4.0" is not on the allow list');
        expect(r.out).toContain('well-pad names a forbidden source');
        expect(r.out).toContain('wellhead names a forbidden source');
        expect(r.out).toContain('swd names a forbidden source');
    });

    it('fails on a Tabler origin at another release than the pinned 3.49.0', () => {
        const r = checkAfter((f) => editSources(f, (s) => {
            s.icons.find((e) => e.id === 'rtu')!.origin = 'tabler:building-broadcast-tower@3.50.0';
        }));
        expect(r.status).toBe(1);
        expect(r.out).toContain('rtu comes from tabler 3.50.0; only 3.49.0 is approved');
    });

    it('fails when NOTICE does not list exactly the adapted icons', () => {
        const missing = checkAfter((f) => {
            const file = path.join(f.dir, 'NOTICE');
            writeFileSync(file, readFileSync(file, 'utf8').replace('    region from polygon\n', ''));
        });
        expect(missing.status).toBe(1);
        expect(missing.out).toContain('NOTICE: does not list "region from polygon"');

        const extra = checkAfter((f) => {
            const file = path.join(f.dir, 'NOTICE');
            writeFileSync(file, readFileSync(file, 'utf8').replace('    region from polygon\n',
                '    region from polygon\n    tap from git-merge\n'));
        });
        expect(extra.status).toBe(1);
        expect(extra.out).toContain('NOTICE: lists "tap from git-merge", which sources.json does not adapt');

        const noCopyright = checkAfter((f) => {
            const file = path.join(f.dir, 'NOTICE');
            writeFileSync(file, readFileSync(file, 'utf8').replace('Copyright (c) 2020-2026 Paweł Kuna', ''));
        });
        expect(noCopyright.status).toBe(1);
        expect(noCopyright.out).toContain("NOTICE: does not carry Tabler's copyright line");
    });

    it('fails on artwork that breaks the drawing rules', () => {
        const r = checkAfter((f) => writeIcon(f, 'tap',
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ff0000" stroke="none">\n'
            + '  <text x="1" y="12">T</text>\n</svg>\n'));
        expect(r.status).toBe(1);
        expect(r.out).toContain('tap.svg: has a colour literal');
        expect(r.out).toContain('tap.svg: element <text> is not allowed');
        expect(r.out).toContain('tap.svg: a kind icon is stroke only');
    });

    // Probes from the context-free Quick review: each passed the first checker.
    const probes: Array<[string, string, string]> = [
        ['single-quoted named fill', `${STROKED}\n  <path d="M3 16h18" fill='red'/>\n</svg>\n`, `fill="red" on <path> is not allowed`],
        ['style attribute', `${STROKED}\n  <path d="M3 16h18" style='stroke:red'/>\n</svg>\n`, 'has a style attribute or element'],
        ['url() paint', `${STROKED}\n  <path d="M3 16h18" fill='url(https://example.com/x.svg#g)'/>\n</svg>\n`, 'has a url() reference'],
        ['unquoted named stroke', `${STROKED}\n  <path d="M3 16h18" stroke=red/>\n</svg>\n`, 'stroke="red" on <path> is not allowed'],
        ['root style', STROKED.replace('<svg ', `<svg style='color:red' `) + '\n  <path d="M3 16h18"/>\n</svg>\n',
            'root attribute style is not allowed']
    ];
    for (const [name, svg, message] of probes) {
        it(`fails on a ${name}`, () => {
            const r = checkAfter((f) => writeIcon(f, 'tap', svg));
            expect(r.status).toBe(1);
            expect(r.out).toContain(`tap.svg: ${message}`);
        });
    }

    it('keeps kind icons stroke only and lets state glyphs fill with currentColor', () => {
        const kind = checkAfter((f) => writeIcon(f, 'tap',
            `${STROKED}\n  <path d="M3 16h18" fill="currentColor"/>\n</svg>\n`));
        expect(kind.status).toBe(1);
        expect(kind.out).toContain('tap.svg: fill="currentColor" on <path>: a kind icon is stroke only');

        const state = checkAfter((f) => writeIcon(f, 'stale',
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none">\n'
            + '  <path d="M7 3h10v18h-10z"/>\n</svg>\n'));
        expect(state.out).not.toContain('stale.svg');
        expect(state.status).toBe(0);
    });

    it('refuses a kind icon whose outline is an alarm circle or square', () => {
        const circle = checkAfter((f) => writeIcon(f, 'meter-station',
            `${STROKED}\n  <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/>\n</svg>\n`));
        expect(circle.status).toBe(1);
        expect(circle.out).toContain('meter-station.svg: <path> is a circle drawn with arcs of radius 9');

        const ring = checkAfter((f) => writeIcon(f, 'booster-station',
            `${STROKED}\n  <circle cx="12" cy="12" r="8"/>\n</svg>\n`));
        expect(ring.out).toContain('booster-station.svg: <circle> is a circle of radius 8');

        const square = checkAfter((f) => writeIcon(f, 'well-pad',
            `${STROKED}\n  <rect x="4" y="4" width="16" height="16" rx="2"/>\n</svg>\n`));
        expect(square.out).toContain('well-pad.svg: <rect> is a square of side 16');
    });
});
