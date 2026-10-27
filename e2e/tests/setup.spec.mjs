// The project setup on a running Gateway (epic-map-store-and-data, entry 6): a
// changed setup.json applies after a project scan with no restart (level and
// refresh interval follow at the next map.load), a bad field makes the map store
// unavailable with the reason naming the field, and the fixed file brings it back.
// No restart is checked, not assumed: the Gateway's uptime only grows and the
// module's start time stays the same across the run, and the bad read logs exactly
// one MapStudio.setup warning however many map.loads follow it.
// The spec changes the committed dev setup and always puts it back (finally, and
// the global setup after a crashed run). Screenshots at 1440 and 390 px.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { screenshotDir } from '../lib/env.mjs';
import { backUpSetup, committedSetup, gatewayRun, putBackSetup, scanProject, setupWarnings, writeSetup } from '../lib/gateway.mjs';
import { EDITOR_USER, editorTest, expect, nextFrames, openMap, test } from './fixtures.mjs';

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

async function shot(page, name) {
    await nextFrames(page);
    mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, name), fullPage: false });
}

async function putBack() {
    await putBackSetup();
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
            const status = page.locator('.mapstudio-load-status');
            await expect(status).toContainText('store-unreachable');
            await expect(status).toContainText('The Map Studio setup of project mapstudio-dev cannot be read: ' + TEN_REASON);
            await expect(page.locator('.mapstudio-map')).toHaveAttribute('data-edit-level', '');
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

test.describe('390 px', () => {
    test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

    test('a setup that is not JSON says where, readable on a phone', async ({ page }) => {
        backUpSetup();
        try {
            writeSetup('{\n  "schemaVersion": 1,\n  "connection": "MapStudio"\n');
            await scanProject();
            await reloadUntil(page, '/', { load: 'failed' });
            await expect(page.locator('.mapstudio-load-status')).toContainText(/setup\.json is not valid JSON \(line \d+, column \d+\)/);
            writeSetup({ ...committedSetup(), refreshIntervalSeconds: 'ten' });
            await scanProject();
            await reloadUntil(page, '/', { load: 'failed' });
            await expect(page.locator('.mapstudio-load-status')).toContainText(TEN_REASON);
            await shot(page, 'mapstudio-setup-invalid-390.png');
        } finally {
            await putBack();
        }
        await reloadUntil(page, '/', { load: 'loaded', level: 'none' });
    });
});
