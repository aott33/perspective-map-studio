import * as fs from 'fs';
import * as path from 'path';

/**
 * Epic 4 entry 15 (R50, owner 2026-11-03): the module reads nothing of the session and asks the browser for nothing; the
 * page's `userLocation` binding is the one source of the position. No source in web/typescript (the tests excluded) may
 * name the browser's geolocation or the Permissions API.
 */
const ROOT = path.resolve(__dirname, '..');
const BANNED = ['navigator.geolocation', 'getCurrentPosition', 'watchPosition', 'permissions.query'];

function sources(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== '__tests__') {
                out.push(...sources(full));
            }
        } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
}

describe('no geolocation in the component (epic 4 entry 15)', () => {
    test('the sources are found', () => {
        expect(sources(ROOT).map((f) => path.basename(f))).toEqual(expect.arrayContaining(['MapStudio.tsx', 'userLocation.ts']));
    });

    test('no source names the browser\'s geolocation or the Permissions API', () => {
        const found: string[] = [];
        for (const file of sources(ROOT)) {
            const text = fs.readFileSync(file, 'utf8');
            for (const word of BANNED) {
                if (text.includes(word)) {
                    found.push(path.relative(ROOT, file) + ': ' + word);
                }
            }
        }
        expect(found).toEqual([]);
    });
});
