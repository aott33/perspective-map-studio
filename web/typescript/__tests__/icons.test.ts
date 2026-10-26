// Story 2.10: the icon set's build and licence gate (web/scripts/icons.mjs),
// run as a child process so the test sees exactly what the build sees.
import { spawnSync } from 'child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

const webDir = path.resolve(__dirname, '..', '..');
const script = path.join(webDir, 'scripts', 'icons.mjs');
const srcDir = path.join(webDir, 'icons', 'src');
const sourcesFile = path.join(webDir, 'icons', 'sources.json');
const catalogueFile = path.resolve(webDir, '..', 'common', 'src', 'main', 'resources', 'com', 'aoindustrial',
    'perspective', 'mapstudio', 'common', 'icons.json');

const FR9_AND_OWNER = ['well-pad', 'wellhead', 'tank-battery', 'compressor-station', 'booster-station',
    'meter-station', 'pig-trap', 'line-valve', 'tap', 'rtu', 'pipeline', 'lateral', 'lease-road', 'geofence',
    'region', 'site-footprint', 'swd', 'separator'];

function icons(args: string[]): { status: number | null; out: string } {
    const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

/** A copy of the sources and SVGs in a temp folder, for the failure cases. */
function fixture(): { dir: string; args: string[]; out: string } {
    const dir = mkdtempSync(path.join(tmpdir(), 'ms-icons-'));
    cpSync(srcDir, path.join(dir, 'src'), { recursive: true });
    cpSync(sourcesFile, path.join(dir, 'sources.json'));
    cpSync(catalogueFile, path.join(dir, 'icons.json'));
    const out = path.join(dir, 'out');
    return {
        dir,
        out,
        args: ['--src', path.join(dir, 'src'), '--sources', path.join(dir, 'sources.json'),
            '--catalogue', path.join(dir, 'icons.json'), '--out', out]
    };
}

describe('icon set', () => {
    it('passes the check with the committed sources and catalogue', () => {
        const r = icons(['--check']);
        expect(r.out).toContain('27 icons checked');
        expect(r.status).toBe(0);
    });

    it('covers every FR-9 kind, the owner additions, the fallback and the state glyphs', () => {
        const cat = JSON.parse(readFileSync(catalogueFile, 'utf8'));
        const ids = cat.icons.map((i: { id: string }) => i.id);
        expect(ids).toHaveLength(27);
        for (const id of FR9_AND_OWNER) expect(ids).toContain(id);
        expect(cat.fallback).toBe('point');
        expect(cat.icons.filter((i: { group: string }) => i.group === 'state').map((i: { id: string }) => i.id).sort())
            .toEqual(['alarm-1-hollow', 'alarm-1-solid', 'alarm-2-hollow', 'alarm-2-solid', 'alarm-3-hollow',
                'alarm-3-solid', 'comms-lost', 'stale']);
    });

    it('builds a sprite with one symbol per icon and no colour literal', () => {
        const f = fixture();
        try {
            const r = icons(f.args);
            expect(r.status).toBe(0);
            const sprite = readFileSync(path.join(f.out, 'mapstudio-icons.svg'), 'utf8');
            expect((sprite.match(/<symbol id="ms-/g) || []).length).toBe(27);
            expect(sprite).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
            expect(sprite).not.toMatch(/openbridge/i);
            const sheet = readFileSync(path.join(f.out, 'contact-sheet.html'), 'utf8');
            for (const id of FR9_AND_OWNER) expect(sheet).toContain(`data-icon="${id}"`);
            expect(sheet).toContain('engineering review (ER-27) before release');
        } finally {
            rmSync(f.dir, { recursive: true, force: true });
        }
    });

    it('fails on sprite drift: an SVG without an entry, and an entry without an SVG', () => {
        const f = fixture();
        try {
            writeFileSync(path.join(f.dir, 'src', 'extra.svg'), readFileSync(path.join(srcDir, 'tap.svg'), 'utf8'));
            unlinkSync(path.join(f.dir, 'src', 'wellhead.svg'));
            const r = icons([...f.args, '--check']);
            expect(r.status).toBe(1);
            expect(r.out).toContain('src/extra.svg has no entry');
            expect(r.out).toContain('wellhead has no src/wellhead.svg');
        } finally {
            rmSync(f.dir, { recursive: true, force: true });
        }
    });

    it('fails when the committed catalogue does not match the sources', () => {
        const f = fixture();
        try {
            writeFileSync(path.join(f.dir, 'icons.json'), '{}\n');
            const r = icons([...f.args, '--check']);
            expect(r.status).toBe(1);
            expect(r.out).toContain('does not match sources.json');
        } finally {
            rmSync(f.dir, { recursive: true, force: true });
        }
    });

    it('fails on a forbidden source or licence and names the entry', () => {
        const f = fixture();
        try {
            const sources = JSON.parse(readFileSync(path.join(f.dir, 'sources.json'), 'utf8'));
            const tap = sources.icons.find((e: { id: string }) => e.id === 'tap');
            tap.origin = 'tabler:git-merge@3.49.0';
            tap.licence = 'CC-BY-SA-4.0';
            tap.modified = 'none';
            const pad = sources.icons.find((e: { id: string }) => e.id === 'well-pad');
            pad.origin = 'openbridge:pad@1.0.1';
            pad.licence = 'Apache-2.0';
            writeFileSync(path.join(f.dir, 'sources.json'), JSON.stringify(sources));
            const r = icons([...f.args, '--check']);
            expect(r.status).toBe(1);
            expect(r.out).toContain('tap licence "CC-BY-SA-4.0" is not on the allow list');
            expect(r.out).toContain('well-pad names a forbidden source');
        } finally {
            rmSync(f.dir, { recursive: true, force: true });
        }
    });

    it('fails on artwork that breaks the drawing rules', () => {
        const f = fixture();
        try {
            writeFileSync(path.join(f.dir, 'src', 'tap.svg'),
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ff0000" stroke="none">\n'
                + '  <text x="1" y="12">T</text>\n</svg>\n');
            const r = icons([...f.args, '--check']);
            expect(r.status).toBe(1);
            expect(r.out).toContain('tap.svg: has a colour literal');
            expect(r.out).toContain('tap.svg: element <text> is not allowed');
            expect(r.out).toContain('tap.svg: a kind icon is stroke only');
        } finally {
            rmSync(f.dir, { recursive: true, force: true });
        }
    });
});
