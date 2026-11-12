// The project setup on a running Gateway (epic-map-store-and-data, entry 6): a
// changed setup.json applies after a project scan with no restart (level and
// refresh interval follow at the next map.load), a bad field makes the map store
// unavailable with the reason naming the field, and the fixed file brings it back.
// No restart is checked, not assumed: the Gateway's uptime only grows and the
// module's start time stays the same across the run, and the bad read logs exactly
// one MapStudio.setup warning however many map.loads follow it.
// Units (epic 4 entry 19a): map.load.reply's setup always holds `units`, read off the page's websocket
// frames: the dev setup's `metric` for a viewer and an editor (U11), a schema 2 setup's `us` (U2), a
// schema 1 setup's `auto` (U1), and `units` in a schema 1 file refused in the unknown-field words (U4).
// The spec changes the committed dev setup and always puts it back (finally, and
// the global setup after a crashed run). Screenshots at 1440 and 390 px.

import { backUpSetup, committedSetup, gatewayRun, putBackSetup, scanProject, setupWarnings, writeSetup } from '../lib/gateway.mjs';
import { EDITOR_USER, chipLines, editorTest, expect, openMap, shot, signedInContext, test } from './fixtures.mjs';

/** How long a scanned change may take to reach a fresh map.load (seen well under 1 s, docs/platform-checks.md). */
const APPLY_CAP_MS = 30_000;
const TEN_REASON = 'refreshIntervalSeconds must be a whole number from 1 to 3600, not "ten"';

/** The map's load state, level and refresh interval once map.load has answered. */
async function loadedState(page, pagePath) {
    const map = await openMap(page, pagePath);
    await expect(map).not.toHaveAttribute('data-load-state', 'loading', { timeout: 60_000 });
    return {
        load: await map.getAttribute('data-load-state'),
        level: await map.getAttribute('data-edit-level'),
        refresh: await map.getAttribute('data-refresh-interval')
    };
}

/** Reload until map.load shows `want` (a subset of loadedState), for at most APPLY_CAP_MS. */
async function reloadUntil(page, pagePath, want) {
    const deadline = Date.now() + APPLY_CAP_MS;
    let seen;
    for (;;) {
        seen = await loadedState(page, pagePath);
        if (Object.entries(want).every(([k, v]) => seen[k] === v)) return seen;
        if (Date.now() > deadline) break;
        await page.waitForTimeout(1_000);
    }
    expect(seen, `map.load within ${APPLY_CAP_MS / 1000} s of the scan`).toMatchObject(want);
    return seen;
}

async function putBack() {
    await putBackSetup();
}

/**
 * The texts of the frames a page receives that carry a map.load.reply (the Perspective session socket carries Map
 * Studio's messages, as JSON or as an escaped JSON string).
 */
function loadReplyFrames(page) {
    const frames = [];
    page.on('websocket', (ws) => {
        ws.on('framereceived', (f) => {
            const text = typeof f.payload === 'string' ? f.payload : f.payload.toString('utf8');
            if (text.includes('map.load.reply')) frames.push(text);
        });
    });
    return frames;
}

/** The `units` of the newest map.load.reply's setup in `frames`, or null when none carries one. */
function repliedUnits(frames) {
    for (let i = frames.length - 1; i >= 0; i--) {
        const m = /\\*"units\\*"\s*:\s*\\*"([^"\\]*)\\*"/.exec(frames[i]);
        if (m) return m[1];
    }
    return null;
}

/** Open the page afresh and give the units its map.load.reply carried (null when the load failed or carried none). */
async function loadedUnits(page, frames, pagePath) {
    frames.length = 0;
    const state = await loadedState(page, pagePath);
    return state.load === 'loaded' ? repliedUnits(frames) : null;
}

/** Reload until the map.load.reply carries `want`, for at most APPLY_CAP_MS. */
async function reloadUntilUnits(page, frames, pagePath, want) {
    const deadline = Date.now() + APPLY_CAP_MS;
    let seen;
    for (;;) {
        seen = await loadedUnits(page, frames, pagePath);
        if (seen === want || Date.now() > deadline) break;
        await page.waitForTimeout(1_000);
    }
    expect(seen, `map.load.reply's setup.units within ${APPLY_CAP_MS / 1000} s of the scan`).toBe(want);
}

test.describe('1440 px', () => {
    test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

    editorTest('a changed setup applies after a scan, a bad field says why, and the fix brings it back', async ({ page }) => {
        backUpSetup();
        const good = committedSetup();
        const run = await gatewayRun();
        try {
            let state = await loadedState(page, '/edit');
            await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
            expect(state).toMatchObject({ load: 'loaded', level: 'full', refresh: String(good.refreshIntervalSeconds) });

            // Roles and interval changed: the editor is now a phone editor, with no Gateway restart.
            writeSetup({ ...good, roles: { full: ['Nobody'], phone: ['MapEditor'] }, refreshIntervalSeconds: 30 });
            await scanProject();
            await reloadUntil(page, '/edit', { load: 'loaded', level: 'phone', refresh: '30' });

            // A bad field: the map store is unavailable and the component shows the reason naming the field.
            const badReadAt = Date.now() - 1_000;
            writeSetup({ ...good, refreshIntervalSeconds: 'ten' });
            await scanProject();
            await reloadUntil(page, '/edit', { load: 'failed' });
            await loadedState(page, '/edit');
            await loadedState(page, '/edit');
            const warnings = (await setupWarnings(badReadAt)).filter((m) => m.includes('mapstudio-dev'));
            expect(warnings, 'one warning for the bad read, none from the map.loads after it').toHaveLength(1);
            expect(warnings[0]).toContain(TEN_REASON);
            // The setup's reason on the top-centre chip (epic 4 entry 24: the status box is gone): a page whose first load failed has
            // no level, so the studio does not show and the chip says it; the code stays on the map's `data-load-message`.
            const map = page.locator('.mapstudio-map');
            await expect(map).toHaveAttribute('data-load-message', /^store-unreachable: /);
            const status = page.locator('.mapstudio-chip[data-problem="store"]');
            const words = 'Map store: The Map Studio setup of project mapstudio-dev cannot be read: ' + TEN_REASON + '.';
            await expect(status).toContainText(words);
            await expect(status).toHaveAttribute('title', words);
            expect((await chipLines(status)).lines, 'the chip on two lines at most').toBeLessThanOrEqual(2);
            await expect(map).toHaveAttribute('data-studio', 'off');
            await expect(map).toHaveAttribute('data-edit-level', '');
            await shot(page, 'mapstudio-setup-invalid-1440.png');
        } finally {
            await putBack();
        }
        // Fixed: the committed setup applies again.
        await reloadUntil(page, '/edit', { load: 'loaded', level: 'full', refresh: String(good.refreshIntervalSeconds) });
        // And nothing restarted on the way.
        const after = await gatewayRun();
        expect(after.uptimeMs, 'the Gateway uptime did not reset').toBeGreaterThan(run.uptimeMs);
        expect(after.moduleStartupTime, 'the Map Studio module did not restart').toBe(run.moduleStartupTime);
    });
});

test.describe('units in the setup (epic 4 entry 19a)', () => {
    test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

    test('map.load.reply carries the setup\'s units at every level; schema 1 reads as auto and refuses units', async ({ page, browser }) => {
        backUpSetup();
        const good = committedSetup();
        expect(good, 'the dev setup is schema 2 and names metric').toMatchObject({ schemaVersion: 2, units: 'metric' });
        const { units: _units, ...noUnits } = good;
        const frames = loadReplyFrames(page);
        try {
            // U11: an anonymous viewer, then a full editor, get the dev setup's units.
            expect(await loadedUnits(page, frames, '/'), 'a viewer\'s map.load.reply').toBe('metric');
            const editorContext = await signedInContext(browser, EDITOR_USER, { viewport: { width: 1440, height: 900 } });
            try {
                const editorPage = await editorContext.newPage();
                const editorFrames = loadReplyFrames(editorPage);
                const state = await loadedState(editorPage, '/edit');
                expect(state).toMatchObject({ load: 'loaded', level: 'full' });
                expect(repliedUnits(editorFrames), 'a full editor\'s map.load.reply').toBe('metric');
            } finally {
                await editorContext.close();
            }

            // U2: a schema 2 setup naming us.
            writeSetup({ ...good, units: 'us' });
            await scanProject();
            await reloadUntilUnits(page, frames, '/', 'us');

            // U1: a schema 1 setup has no units; the reply still holds them, as auto.
            writeSetup({ ...noUnits, schemaVersion: 1 });
            await scanProject();
            await reloadUntilUnits(page, frames, '/', 'auto');

            // U4: units in a schema 1 file is refused in the words every unknown field gets.
            writeSetup({ ...noUnits, schemaVersion: 1, units: 'metric' });
            await scanProject();
            await reloadUntil(page, '/', { load: 'failed' });
            const status = page.locator('.mapstudio-chip[data-problem="store"]');
            const words = 'Map store: The Map Studio setup of project mapstudio-dev cannot be read: '
                + 'units is not a setup field of schema 1.';
            await expect(status).toHaveAttribute('title', words);
        } finally {
            await putBack();
        }
        // The committed setup applies again, with its units.
        await reloadUntilUnits(page, frames, '/', 'metric');
    });
});

test.describe('390 px', () => {
    test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

    test('a setup that is not JSON says where, readable on a phone', async ({ page }) => {
        backUpSetup();
        try {
            writeSetup('{\n  "schemaVersion": 1,\n  "connection": "MapStudio"\n');
            await scanProject();
            await reloadUntil(page, '/', { load: 'failed' });
            // The setup's reason on the top-centre chip (epic 4 entry 24): a viewer's map, since it concerns the map.
            const status = page.locator('.mapstudio-chip[data-problem="store"]');
            await expect(status).toContainText(/setup\.json is not valid JSON \(line \d+, column \d+\)/);
            writeSetup({ ...committedSetup(), refreshIntervalSeconds: 'ten' });
            await scanProject();
            await reloadUntil(page, '/', { load: 'failed' });
            await expect(status).toContainText(TEN_REASON);
            // Long words wrap to two lines on the phone, the rest cut and in the title.
            expect(await status.getAttribute('title')).toContain(TEN_REASON);
            expect(await chipLines(status)).toEqual({ lines: 2, cut: true });
            await shot(page, 'mapstudio-setup-invalid-390.png');
        } finally {
            await putBack();
        }
        await reloadUntil(page, '/', { load: 'loaded', level: 'none' });
    });
});
