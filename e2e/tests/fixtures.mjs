// Shared test plumbing: error watching and opening the Map Studio view.

import { expect, test as base } from '@playwright/test';
import { sessionUrl } from '../lib/env.mjs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EDITOR_USER, OPERATOR_USER, editorStateFile, stateFile } from '../lib/editorAuth.mjs';

const signInCli = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'signInCli.mjs');

/** Collect browser page errors and console errors, and Map Studio console warnings. */
export function watch(page) {
    const errors = [];
    const warnings = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
        if (msg.type() === 'warning' && msg.text().includes('[MapStudio]')) warnings.push(msg.text());
    });
    return { errors, warnings };
}

/** `test` whose every test fails on any browser console error or page error. */
export const test = base.extend({
    watched: [
        async ({ page }, use) => {
            const w = watch(page);
            await use(w);
            expect(w.errors, 'browser console and page errors').toEqual([]);
        },
        { auto: true }
    ]
});
export { expect };

/**
 * How long a test waits, after the state it can observe, to let a late console
 * warning arrive before it asserts "no warning" or "exactly one warning". There
 * is no observable state for the absence of a warning, so this is a stated
 * settle time, not a synchronisation.
 */
export const WARNING_SETTLE_MS = 500;

/**
 * Open a dev project page and wait until the map reports itself ready: the
 * component sets data-map-ready after MapLibre's load and first idle, with both
 * sources and layers added, and writes the counts it read back from MapLibre.
 * Returns the map locator.
 */
export async function openMap(page, pagePath = '/') {
    await page.goto(sessionUrl(pagePath), { waitUntil: 'load' });
    const map = page.locator('.mapstudio-map');
    await map.waitFor({ state: 'visible', timeout: 60_000 });
    // Perspective may drop the websocket once right after a Gateway restart;
    // the banner's active class is the signal that it is reconnecting.
    await page.waitForSelector('.connection-banner.banner-active', { state: 'detached', timeout: 30_000 }).catch(() => {});
    await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 60_000 });
    await page.locator('.mapstudio-reply').waitFor({ state: 'visible' });
    return map;
}

/**
 * The counts the component read back from MapLibre's item sources after the first map.load's
 * items were drawn (only features in the loaded tiles count).
 */
export async function loadedCounts(map) {
    await expect(map).toHaveAttribute('data-points-loaded', /^[0-9]+$/, { timeout: 60_000 });
    return {
        points: Number(await map.getAttribute('data-points-loaded')),
        lines: Number(await map.getAttribute('data-lines-loaded'))
    };
}

/**
 * Wait for two animation frames in the page, so a map that has just changed has
 * had the chance to draw it before a screenshot. A frame boundary, not a time.
 */
export async function nextFrames(page) {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

export { EDITOR_USER, OPERATOR_USER };

/** Sign a dev user in, in its own node process (lib/signInCli.mjs); returns the state file. */
function signInFresh(user) {
    const run = spawnSync(process.execPath, [signInCli, user], { encoding: 'utf8', env: process.env, timeout: 180_000 });
    if (run.status !== 0) {
        throw new Error((run.stderr || '').trim() || 'The dev user ' + user + ' could not sign in (lib/signInCli.mjs).');
    }
    return stateFile(user);
}

/**
 * A second browser context signed in as `user` (epic 2 story 2: the phone editor beside
 * the map editor), signed in the same way as editorTest. The caller closes it.
 */
export async function signedInContext(browser, user, options = {}) {
    return browser.newContext({ ...options, storageState: signInFresh(user) });
}

/**
 * `test` signed in as the dev map editor: right before the test, a separate node
 * process (lib/signInCli.mjs) signs in with its own browser and saves the browser
 * state, and the test's context starts from it. The sign-in runs outside this
 * process, so no test step, trace or report ever sees the password. A sign-in saved
 * once in the global setup was signed out by the time the full suite reached these
 * tests (after the measures' two minutes; cause not established, [live 8.3.10]),
 * hence one fresh sign-in per editor test.
 */
export const editorTest = test.extend({
    // eslint-disable-next-line no-empty-pattern
    storageState: async ({}, use) => {
        signInFresh(EDITOR_USER);
        await use(editorStateFile);
    }
});

/** Wait until map.load has answered (loaded or failed) after openMap. */
export async function mapLoaded(map) {
    await expect(map).not.toHaveAttribute('data-load-state', 'loading', { timeout: 60_000 });
    await expect(map).toHaveAttribute('data-load-state', 'loaded');
    await expect(map).toHaveAttribute('data-items-loaded', /^[0-9]+$/);
    return Number(await map.getAttribute('data-items-loaded'));
}

/**
 * Press the /edit page's "Seed the dev map" button (ops/project/ignition/script-python/mapstudio_seed)
 * on a page already open there, and return its result: {created, updated, restored, unchanged, seq,
 * ids, scale} or {error} or {refused}, each with ranAt (the Gateway's time in ms), which tells this
 * run's result from the one the label showed before.
 */
export async function runSeed(page) {
    const out = page.locator('#mapstudio-dev-seed-result');
    const before = await out.innerText();
    await page.locator('#mapstudio-dev-seed').click();
    await expect.poll(async () => {
        const text = await out.innerText();
        return text !== before && /"(created|error|refused)"/.test(text);
    }, { timeout: 60_000 }).toBe(true);
    return JSON.parse(await out.innerText());
}

let seedResult = null;

/**
 * Seed the dev map once per worker (epic 2 story 11): an editor context opens /edit, presses
 * "Seed the dev map" and returns its result; later calls return the same result. Specs that
 * draw or click the 30-pad set or the tracer's points call it in beforeAll.
 */
export async function ensureSeeded(browser) {
    if (seedResult) return seedResult;
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        const map = await openMap(page, '/edit');
        await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
        await mapLoaded(map);
        const result = await runSeed(page);
        expect(result.error, 'the seed saved').toBeUndefined();
        expect(result.scale, 'the scale set after the seed').toEqual({ pads: 30, lines: 30 });
        seedResult = result;
        return result;
    } finally {
        await context.close();
    }
}
