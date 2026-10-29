// Shared test plumbing: error watching and opening the Map Studio view.

import { expect, test as base } from '@playwright/test';
import { screenshotDir, sessionUrl } from '../lib/env.mjs';
import { TRACER } from '../lib/geo.mjs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
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
 * Terra Draw shows no state between two vertex clicks, so there is nothing to
 * await; this pause only keeps two clicks from reading as a double click.
 */
export const VERTEX_PAUSE_MS = 300;

/**
 * Draw the tracer's two-point line with the spike "Draw a line" tool, `dy`
 * pixels below the map's centre offsets (unsaved.spec draws 200 px above, dy -200,
 * so its dashed line is not hidden under a saved one), and wait for the reply.
 */
export async function drawLine(page, map, { dy = 0 } = {}) {
    const box = await map.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const [a, b] = TRACER.drawOffsets.map(([ox, oy]) => [cx + ox, cy + oy + dy]);
    const reply = page.locator('.mapstudio-reply');
    await page.locator('.mapstudio-draw-button').click();
    await expect(reply).toHaveAttribute('data-drawing', 'true');
    await page.mouse.click(a[0], a[1]);
    await page.waitForTimeout(VERTEX_PAUSE_MS);
    await page.mouse.click(b[0], b[1]);
    await page.waitForTimeout(VERTEX_PAUSE_MS);
    await page.keyboard.press('Enter');
    await expect(reply).toHaveAttribute('data-line-points', '2');
}

/**
 * Open a dev project page and wait until the map reports itself ready: the
 * component sets data-map-ready after MapLibre's load and first idle, with both
 * sources and layers added, and writes the counts it read back from MapLibre.
 * Returns the map locator. `project` is the suite's project unless another is named (the showcase
 * project, epic 3 entry 15).
 */
export async function openMap(page, pagePath = '/', project = undefined) {
    await page.goto(sessionUrl(pagePath, project), { waitUntil: 'load' });
    const map = page.locator('.mapstudio-map');
    await map.waitFor({ state: 'visible', timeout: 60_000 });
    // Perspective may drop the websocket once right after a Gateway restart;
    // the banner's active class is the signal that it is reconnecting.
    await page.waitForSelector('.connection-banner.banner-active', { state: 'detached', timeout: 30_000 }).catch(() => {});
    await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 60_000 });
    // The status line is in the DOM on every page; in View mode it shows only when it has a status (entry 15).
    await page.locator('.mapstudio-reply').waitFor({ state: 'attached' });
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

/** A screenshot after the next frames, into the run's screenshot folder (docs/screenshots with E2E_DOCS=1). */
export async function shot(page, name) {
    await nextFrames(page);
    mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, name), fullPage: false });
}

/** How long a spec gives the map to draw and publish a moved view or a changed layer. */
export const DRAW_MS = 20_000;

/** Move the map (the component's e2e view hook) and wait for the labels of that zoom to be published. */
export async function view(page, map, center, zoom) {
    await page.waitForFunction(() => Boolean(window.__mapStudioTestView));
    await page.evaluate(([c, z]) => window.__mapStudioTestView({ center: c, zoom: z }), [center, zoom]);
    await expect(map).toHaveAttribute('data-zoom', zoom.toFixed(2), { timeout: DRAW_MS });
    await expect(map).toHaveAttribute('data-labels-zoom', zoom.toFixed(2), { timeout: DRAW_MS });
    await nextFrames(page);
}

/**
 * Send one message through the page's component (the test hook window.__mapStudioTest,
 * web/typescript/testHook.ts, the component's real session path) and return the Gateway's reply envelope.
 */
export async function send(page, type, body) {
    await page.waitForFunction(() => Boolean(window.__mapStudioTest));
    return page.evaluate(([t, b]) => window.__mapStudioTest.send(t, b), [type, body]);
}

/**
 * Delete every live map item that is not the seed's, as the editor through the test hook (one batch,
 * lines and their instruments together): specs leave the items they create (a pad with an override
 * rule on a tag that does not exist is stale for good, a pad linked to an asset with no tags comms
 * lost, a pad named after an asset turns up in a search), so a spec that counts or lists the seed's
 * items alone runs this first. Returns how many went.
 */
export async function removeStrays(page, seedIds) {
    const keep = new Set(Object.values(seedIds));
    const load = await send(page, 'map.load', {});
    expect(load.type).toBe('map.load.reply');
    const strays = load.body.items.filter((i) => !i.deleted && !keep.has(i.id));
    if (strays.length === 0) {
        return 0;
    }
    const reply = await send(page, 'edits.apply', {
        batchId: randomUUID(), ops: strays.map((i) => ({ op: 'delete', entity: 'item', id: i.id, baseVersion: i.version }))
    });
    expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
    return strays.length;
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

/**
 * Press the /edit page's "Seed the showcase map" button (ops/project/ignition/script-python/
 * mapstudio_showcase_seed, epic 3 entry 15) on a page already open there, and return its result: the dev
 * seed's shape plus `tags` ({written, alarm, stale} or {error}), or {error} or {refused}, each with ranAt.
 */
export async function runShowcaseSeed(page) {
    const out = page.locator('#mapstudio-dev-showcase-result');
    const before = await out.innerText();
    await page.locator('#mapstudio-dev-showcase').click();
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
