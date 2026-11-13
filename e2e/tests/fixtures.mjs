// Shared test plumbing: error watching and opening the Map Studio view.

import { expect, test as base } from '@playwright/test';
import { screenshotDir, sessionUrl } from '../lib/env.mjs';
import { TRACER, pagePixel } from '../lib/geo.mjs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EDITOR2_USER, EDITOR_USER, OPERATOR_USER, editorStateFile, stateFile } from '../lib/editorAuth.mjs';
import { backUpSetup, committedSetup, putBackSetup, scanProject, writeSetup } from '../lib/gateway.mjs';

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
 * Draw the tracer's two-point line with the toolbar's Line tool (epic 4 entry 4: Edit mode at level `full`, 768 px
 * and wider), `dy` pixels below the map's centre offsets (unsaved.spec draws 200 px above, dy -200, so its dashed
 * line is not hidden under a saved one), finished with Enter, and wait until the save was sent (the map's
 * `data-save-state` holds it: saving, saved, refused or unsent; epic 4 entry 24, the status box gone). The tool stays
 * in hand after the finish, so a second line needs no click on the tool. A viewer's or a phone editor's line, where no tool shows, goes through the test
 * hook instead (`hookLineBatch`).
 */
export async function drawLine(page, map, { dy = 0 } = {}) {
    const box = await map.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const [a, b] = TRACER.drawOffsets.map(([ox, oy]) => [cx + ox, cy + oy + dy]);
    if ((await map.getAttribute('data-tool')) !== 'line') {
        await page.locator('.mapstudio-tool--line').click();
    }
    await expect(map).toHaveAttribute('data-tool', 'line');
    const bar = page.locator('.mapstudio-drawing-bar');
    await expect(bar).toHaveAttribute('data-points', '0');
    await page.mouse.click(a[0], a[1]);
    await expect(bar).toHaveAttribute('data-points', '1');
    await page.waitForTimeout(VERTEX_PAUSE_MS);
    await page.mouse.click(b[0], b[1]);
    await expect(bar).toHaveAttribute('data-points', '2');
    await page.waitForTimeout(VERTEX_PAUSE_MS);
    await page.keyboard.press('Enter');
    await expect(bar).toHaveAttribute('data-points', '0');
    await expect(map).toHaveAttribute('data-save-state', /^(saving|saved|refused|unsent)$/);
}

/**
 * One `edits.apply` batch creating a two-vertex line of the dev kind `line` on the tracer's first and third
 * points, `dLat` degrees north, for the test hook (`send`): the component's real session path, so the Gateway
 * judges it from the session user's roles as it judges a tool's save.
 */
export function hookLineBatch(name, dLat = 0) {
    return {
        batchId: randomUUID(),
        ops: [{
            op: 'create', entity: 'item', id: randomUUID(), baseVersion: 0,
            data: {
                kind: 'line', name,
                geometry: { type: 'LineString', coordinates: [TRACER.points.p1.lngLat, TRACER.points.p3.lngLat].map(([lng, lat]) => [lng, lat + dLat]) }
            }
        }]
    };
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
    return map;
}

/**
 * The top-centre chip's words as laid out (epic 4 entry 24): the lines they take and whether some were cut. The chip wraps
 * to two lines at most and its full words are its title.
 */
export async function chipLines(chip) {
    return chip.locator('.mapstudio-chip-text').evaluate((el) => {
        const line = parseFloat(getComputedStyle(el).lineHeight);
        return { lines: Math.round(el.clientHeight / line), cut: el.scrollHeight > el.clientHeight + 1 };
    });
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

/** A render for the docs once the markers have taken the view's zoom (their images redraw a moment after a jump). */
export async function shotSettled(page, name) {
    await page.waitForTimeout(800);
    await shot(page, name);
}

/** How long a spec gives the map to draw and publish a moved view or a changed layer. */
export const DRAW_MS = 20_000;

/**
 * Move the map (the component's e2e view hook), wait for the map to draw the moved view (the hook's
 * promise, on the map's next idle) and for the labels of that zoom to be published.
 */
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
 * Clear Edit mode's units override when one is live (epic 4 entry 19b), as an editor through the test hook: the store
 * then reads as a fresh one, `settings` {}, and the setup's units apply (entry 20a).
 */
export async function clearUnits(page) {
    const load = await send(page, 'map.load', {});
    expect(load.type, JSON.stringify(load.body)).toBe('map.load.reply');
    const units = load.body.settings.units;
    if (units) {
        const reply = await send(page, 'edits.apply', {
            batchId: randomUUID(), ops: [{ op: 'delete', entity: 'settings', id: 'units', baseVersion: units.version }] });
        expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
    }
}

/**
 * Set the units override to `data` ({system, labels}), as an editor through the test hook (no control sends one until
 * entry 20b): an update of the live one, else a create at 0 or at the cleared setting's version, which the create's
 * conflict reports (a cleared one is not in map.load.reply).
 */
export async function setUnits(page, data) {
    const op = (kind, baseVersion) => ({ batchId: randomUUID(), ops: [{ op: kind, entity: 'settings', id: 'units', baseVersion, data }] });
    const load = await send(page, 'map.load', {});
    expect(load.type, JSON.stringify(load.body)).toBe('map.load.reply');
    const live = load.body.settings.units;
    let reply = await send(page, 'edits.apply', live ? op('update', live.version) : op('create', 0));
    if (reply.type === 'error' && reply.body.code === 'conflict' && !live) {
        reply = await send(page, 'edits.apply', op('create', reply.body.conflicts[0].current.version));
    }
    expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
}

/**
 * The dev setup with `units` (entry 19a) for a spec's own run: the committed file is kept (lib/gateway.mjs
 * `backUpSetup`), the changed one scanned, and the wait ends once a map.load on `page` reports them. The spec puts
 * the committed setup back with `restoreSetupUnits`.
 */
export async function useSetupUnits(page, units) {
    backUpSetup();
    writeSetup({ ...committedSetup(), units });
    await scanProject();
    await expectSetupUnits(page, units);
}

/** The committed dev setup back (`putBackSetup`), waited for on `page` when one is given. */
export async function restoreSetupUnits(page) {
    const units = committedSetup().units;
    if (await putBackSetup() && page) {
        await expectSetupUnits(page, units);
    }
}

async function expectSetupUnits(page, units) {
    await expect.poll(async () => {
        const load = await send(page, 'map.load', {});
        return load.type === 'map.load.reply' && load.body.setup ? load.body.setup.units : load.type;
    }, { timeout: 90_000, intervals: [1_000] }).toBe(units);
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

export { EDITOR2_USER, EDITOR_USER, OPERATOR_USER };

/** Sign a dev user in, in its own node process (lib/signInCli.mjs), on the suite's project or `project`; returns the state file. */
function signInFresh(user, project = undefined) {
    const args = project ? [signInCli, user, project] : [signInCli, user];
    const run = spawnSync(process.execPath, args, { encoding: 'utf8', env: process.env, timeout: 180_000 });
    if (run.status !== 0) {
        throw new Error((run.stderr || '').trim() || 'The dev user ' + user + ' could not sign in (lib/signInCli.mjs).');
    }
    return project ? stateFile(user, project) : stateFile(user);
}

/**
 * A second browser context signed in as `user` (epic 2 story 2: the phone editor beside
 * the map editor), signed in the same way as editorTest. The caller closes it. With `project`
 * the sign-in is on that project's /edit page (the empty project, epic 4 entry 7b).
 */
export async function signedInContext(browser, user, options = {}, project = undefined) {
    return browser.newContext({ ...options, storageState: signInFresh(user, project) });
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
 * run's result from the one the label showed before. The same press seeds the showcase map (epic 3
 * entry 15, mapstudio_showcase_seed): its result, the same shape plus `tags`, is under `showcase`.
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

// ---- What several specs share (epic 4 entry 17a): one copy here, each spec importing it. ----

/** The Gateway's answer to a save or a lookup. */
export const REPLY_MS = 20_000;

/** There is nothing to observe when nothing is sent: the time a stray batch would have to show in the map's seq. */
export const NOTHING_MS = 800;

// The L-SWD set (ops/project seed): its three points, the first on CTB1 and the last on SWD1, 2,922 m long.
export const CTB1 = [-105.012, 39.7262];
export const BEND = [-105.009441, 39.720791];
export const SWD1 = [-104.983671, 39.715476];

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The bound for a push to reach an open map: a saved edit on another map, an open popup's values. */
export const PUSH_MS = 5_000;

// CTB1 in the middle at zoom 15: a full disc to click.
export const CTB1_VIEW = { center: CTB1, zoom: 15 };

/** The floating controls' distance from the map's edge (DESIGN.md spacing map-inset). */
export const INSET = 12;

/**
 * The client logs its own failed reconnect attempts while a lost connection is simulated ("Hello API call failed ...
 * Simulated disconnect", as connection.spec.mjs filters them): those are the loss itself; any other console or page
 * error still fails the test.
 */
export const SIMULATED = /Simulated disconnect/;

export const PROJECT = 'mapstudio-dev';

export const KEY = `mapstudio.unsaved.v1:${PROJECT}:${EDITOR_USER}`;

export const PSQL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'ops', 'psql.sh');

/** The OpenStreetMap tiles a spec routes to a stub, and the stub: a 1 by 1 PNG (one blue pixel, so a screenshot shows the tiles drawn). */
export const OSM_TILES = /^https:\/\/tile\.openstreetmap\.org\//;
export const TILE_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

/** The hidden live-state row of one map item. */
export const liveItem = (page, id) => page.locator('.mapstudio-live-item[data-item-id="' + id + '"]');

export const legendPanel = (page) => page.locator('.mapstudio-legend-panel');

export const legendButton = (page) => page.locator('.mapstudio-legend-button');

export const saveWords = (page) => page.locator('.mapstudio-kinds .mapstudio-panel-save');

export const del = (id, baseVersion) => ({ op: 'delete', entity: 'item', id, baseVersion });

export const update = (id, baseVersion, data) => ({ op: 'update', entity: 'item', id, baseVersion, data });

export const batch = (...ops) => ({ batchId: randomUUID(), ops });

export const bar = (page) => page.locator('.mapstudio-needs');

export const undo = (page) => page.locator('.mapstudio-toolbar .mapstudio-undo');

/** A field's wrapper in the setup panel (kindSetup.ts `Fields`). */
export const field = (page, id) => page.locator('.mapstudio-kindsetup [data-field="' + id + '"]');

export const input = (page, id) => field(page, id).locator('input[type="text"]');

export const point = (c) => ({ type: 'Point', coordinates: c });

/** Whether a stored `ends` names these items (the store returns its keys in its own order). */
export const endsAre = (ends, start, end) => (ends && ends.start ? ends.start.itemId : null) === start && (ends && ends.end ? ends.end.itemId : null) === end;

export const lossTest = editorTest.extend({
    watched: [
        async ({ page }, use) => {
            const w = watch(page);
            await use(w);
            expect(w.errors.filter((e) => !SIMULATED.test(e)), 'browser console and page errors').toEqual([]);
        },
        { auto: true }
    ]
});

/** /edit as the map editor at level `full`: the studio shows. */
export async function openEditor(page) {
    const map = await openMap(page, '/edit');
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-edit-level', 'full');
    await expect(map).toHaveAttribute('data-studio', 'on');
    return map;
}

/** The map's page pixel of a place, from the box and the view the map reports now (the stage resizes as panels open). */
export async function pixelNow(map, lngLat) {
    const box = await map.boundingBox();
    const center = (await map.getAttribute('data-center')).split(',').map(Number);
    const zoom = Number(await map.getAttribute('data-zoom'));
    return pagePixel(box, lngLat, center, zoom);
}

/** The map's change sequence number now. */
export async function seqOf(map) {
    return Number(await map.getAttribute('data-store-seq'));
}

/** A list row clicked: the item selected with its Details open. */
export async function selectRow(page, id) {
    await page.locator('.mapstudio-list-row[data-item-id="' + id + '"]').click();
    await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', id);
}

/** One change saved as one batch: the toolbar's Undo names its step, and the map's seq moved on by exactly one. */
export async function expectOneBatch(page, map, seqBefore, step) {
    await expect(page.locator('.mapstudio-toolbar .mapstudio-undo')).toHaveAttribute('data-step', 'Undo: ' + step, { timeout: REPLY_MS });
    await expect(map).toHaveAttribute('data-store-seq', String(seqBefore + 1), { timeout: REPLY_MS });
    await page.waitForTimeout(500);
    await expect(map).toHaveAttribute('data-store-seq', String(seqBefore + 1));
}

/** Nothing was sent: the map's seq stays where it was. */
export async function expectNothingSent(page, map, seqBefore) {
    await page.waitForTimeout(NOTHING_MS);
    await expect(map).toHaveAttribute('data-store-seq', String(seqBefore));
}

/** The stored map items through the test hook, by id (map.load leaves a deleted item out). */
export async function storedAll(page) {
    return Object.fromEntries((await send(page, 'map.load', {})).body.items.map((i) => [i.id, i]));
}

/** The stored kind setup record of a kind through the test hook, or undefined. */
export async function setupOf(page, kindId) {
    const reply = await send(page, 'map.load', {});
    expect(reply.type, JSON.stringify(reply.body)).toBe('map.load.reply');
    return (reply.body.kindSetups || []).find((k) => k.kindId === kindId && !k.deleted);
}

export async function openKinds(page, map) {
    await page.locator('.mapstudio-rail-item[data-surface="kinds"]').click();
    await expect(map).toHaveAttribute('data-surface', 'kinds');
}

/** Whether a pixel is inside a ring of pixels (the even-odd rule; the ring unclosed, as an area is stored). */
export function insideRing([x, y], ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

/** Wait until the stage has the width the docked panels leave it (the map resizes after a panel opens or closes). */
export async function expectStageWidth(map, width) {
    await expect.poll(async () => Math.round((await map.boundingBox()).width), { timeout: 10_000 }).toBe(width);
}

/** A pad placed with the Point tool at `at` and saved: its id (Details opens on it with Name focused). */
export async function placePad(page, map, at) {
    if ((await map.getAttribute('data-tool')) !== 'point') {
        await page.locator('.mapstudio-tool--point').click();
        await expect(map).toHaveAttribute('data-tool', 'point');
    }
    const panel = page.locator('.mapstudio-panel');
    const before = (await panel.count()) > 0 ? await panel.getAttribute('data-item-id') : null;
    await page.mouse.click(at[0], at[1]);
    await expect(panel).toBeVisible({ timeout: 15_000 });
    if (before !== null) {
        await expect(panel).not.toHaveAttribute('data-item-id', before, { timeout: 15_000 });
    }
    const id = await panel.getAttribute('data-item-id');
    expect(id).toMatch(UUID);
    await expect(panel).toHaveAttribute('data-pending', 'false', { timeout: REPLY_MS });
    return id;
}

/** Press a /live dev button and return its result (the label changes on every press, ranAt included). */
export async function press(page, button) {
    const out = page.locator('#mapstudio-live-result');
    const before = await out.innerText();
    await page.locator('#mapstudio-live-' + button).click();
    await expect.poll(() => out.innerText(), { timeout: 30_000 }).not.toBe(before);
    const result = JSON.parse(await out.innerText());
    expect(result.error, 'the dev button ' + button).toBeUndefined();
    expect(result.refused, 'the dev button ' + button).toBeUndefined();
    return result;
}

/** The stored record of a live map item through the test hook, or undefined. */
export async function stored(page, id) {
    return (await send(page, 'map.load', {})).body.items.find((i) => i.id === id && !i.deleted);
}

/** One batch through the test hook, saved. */
export async function apply(page, ops) {
    const reply = await send(page, 'edits.apply', { batchId: randomUUID(), ops });
    expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
}

/** The kind's panel has nothing on its way and the header says Saved. */
export async function settled(page) {
    await expect(page.locator('.mapstudio-kindsetup')).toHaveAttribute('data-saving', '', { timeout: REPLY_MS });
    await expect(saveWords(page)).toHaveText('Saved', { timeout: REPLY_MS });
}

/** The queue as stored for the map editor. */
export async function storedQueue(page) {
    return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '[]'), KEY);
}

/** The second tab, on /live: its dev buttons, and another open map to agree with. */
export async function openDev(context) {
    const dev = await context.newPage();
    await mapLoaded(await openMap(dev, '/live'));
    return dev;
}

export async function load(page) {
    const reply = await send(page, 'map.load', {});
    expect(reply.type, JSON.stringify(reply.body)).toBe('map.load.reply');
    return reply.body;
}

export function saved(reply) {
    expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
    return reply.body;
}

/** The toolbar's Undo, as one batch: the seq moves on by one and `check` (a stored state) holds again. */
export async function undoOnce(page, map, check) {
    const before = await seqOf(map);
    await page.locator('.mapstudio-toolbar .mapstudio-undo').click();
    await expect(map).toHaveAttribute('data-store-seq', String(before + 1), { timeout: REPLY_MS });
    await expect.poll(async () => check(await storedAll(page)), { timeout: REPLY_MS }).toBe(true);
}

/** A page pixel `dx` from the map's centre and `fromTop` below its top edge now: at the tracer's view, the clear ground north of its points. */
export async function spotFromTop(map, dx, fromTop) {
    const box = await map.boundingBox();
    return [box.x + box.width / 2 + dx, box.y + fromTop];
}

/** One statement on the dev map store as its owner role (ops/psql.sh); returns the first line of its unaligned output (a RETURNING value; psql adds the command tag after it). */
export function sql(statement) {
    const run = spawnSync('bash', [PSQL, '-v', 'ON_ERROR_STOP=1', '-At', '-c', statement], { encoding: 'utf8', timeout: 60_000 });
    if (run.status !== 0) {
        throw new Error('psql failed: ' + (run.stderr || '').trim());
    }
    return run.stdout.trim().split('\n')[0];
}

/** Collect the text of every websocket frame the page receives that holds a map.changed. */
export function changedFrames(page) {
    const frames = [];
    page.on('websocket', (ws) => {
        ws.on('framereceived', (f) => {
            const text = typeof f.payload === 'string' ? f.payload : f.payload.toString('utf8');
            if (text.includes('map.changed')) {
                frames.push(text);
            }
        });
    });
    return frames;
}

export function expectRefused(reply, code) {
    expect(reply.type, JSON.stringify(reply.body)).toBe('error');
    expect(reply.body.code).toBe(code);
    return reply.body;
}

/** The item selected with its Details open beside the map. */
export async function expectDetails(page, map, id, name) {
    await expect(map).toHaveAttribute('data-selected', id);
    const panel = page.locator('.mapstudio-panel');
    await expect(panel).toHaveAttribute('data-item-id', id);
    await expect(panel.locator('.mapstudio-panel-name')).toHaveText(name);
}

/** No popup of any kind: no card, no line popup, no sheet, no pick list. */
export async function expectNoPopup(page, map) {
    await expect(map).toHaveAttribute('data-popup-mode', '');
    await expect(map).toHaveAttribute('data-pick-open', 'false');
    await expect(page.locator('.maplibregl-popup')).toHaveCount(0);
    await expect(page.locator('.mapstudio-sheet')).toHaveCount(0);
}

/** A drag by the pointer, in a few moves, so Terra Draw and MapLibre see a drag and not a click. */
export async function drag(page, from, to) {
    await page.mouse.move(from[0], from[1]);
    await page.mouse.move(from[0] + 1, from[1] + 1);
    await page.mouse.down();
    await page.mouse.move(from[0] + (to[0] - from[0]) * 0.25, from[1] + (to[1] - from[1]) * 0.25, { steps: 4 });
    await page.mouse.move(to[0], to[1], { steps: 8 });
    await page.mouse.up();
}

/**
 * Wait until the map's labels of the current view hold every text in `texts` (the names and icon KPIs,
 * published on MapLibre's idle after a batch changed a marker), so a shot shows the labels settled.
 */
export async function labelsPlaced(map, texts) {
    await expect.poll(async () => {
        const labels = (await map.getAttribute('data-labels')) || '';
        return texts.filter((t) => !labels.includes('"' + t + '"'));
    }, { timeout: DRAW_MS }).toEqual([]);
}

/** Click a point on a map centred on `center` at `zoom`; wait for its popup (card or sheet) of `selector`. */
export async function clickPoint(page, map, lngLat, center, zoom, selector) {
    const box = await map.boundingBox();
    const [x, y] = pagePixel(box, lngLat, center, zoom);
    await page.mouse.click(x, y);
    const popup = page.locator(selector);
    await expect(popup).toBeVisible({ timeout: 30_000 });
    return popup;
}

export async function openItems(page, map) {
    await page.locator('.mapstudio-rail-item[data-surface="items"]').click();
    await expect(map).toHaveAttribute('data-surface', 'items');
}

export async function padCount(page) {
    return (await send(page, 'map.load', {})).body.items.filter((i) => !i.deleted && i.kind === 'pad').length;
}

export const create = (id, data) => ({ op: 'create', entity: 'item', id, baseVersion: 0, data });

/** One refresh interval of the dev setup (10 s) with its round trips, as live.spec.mjs bounds it. */
export const INTERVAL_MS = 25_000;

// L-SWD in view with its two pads, large enough that its handles are apart.
export const SWD_VIEW = { center: [(CTB1[0] + SWD1[0]) / 2, (CTB1[1] + SWD1[1]) / 2 + 0.001], zoom: 13.5 };

export function refused(reply, code) {
    expect(reply.type, JSON.stringify(reply.body)).toBe('error');
    expect(reply.body.code, reply.body.message).toBe(code);
    return reply.body;
}
