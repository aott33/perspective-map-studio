// Unsaved edits survive and replay (epic-map-store-and-data, entry 8). Every batch is
// queued in localStorage (per project and user) before it is sent and stays there until
// its edits.apply.reply or a Discard; the queue replays after map.load answers at level
// phone or full.
//
// "Gateway gone" is made deterministic by routing the page's websockets through the test
// (Playwright routeWebSocket) and taking every edits.apply out of the browser's frames, so
// the Gateway never sees the save and the 15 s reply timer runs out. The same routing drops a
// map.changed (a gap) and turns a map.load.reply into a store-unreachable error, to show what
// a failed load after the map loaded does. Whether Chromium's offline
// emulation closes an open Perspective websocket is not relied on ([unverified]). A stopped
// Gateway is the manual check in docs/platform-checks.md.
// Screenshots at 1440 and 390 px (AD-15).

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { envFileValue, gatewayUrl, screenshotDir } from '../lib/env.mjs';
import { TRACER } from '../lib/geo.mjs';
import {
    EDITOR_USER, OPERATOR_USER, editorTest, expect, mapLoaded, nextFrames, openMap, signedInContext, test
} from './fixtures.mjs';

// As in store.spec.mjs: the pause only keeps two vertex clicks from reading as a double click.
const VERTEX_PAUSE_MS = 300;
const PROJECT = 'mapstudio-dev';
const KEY = `mapstudio.unsaved.v1:${PROJECT}:${EDITOR_USER}`;
// The component's reply timeout is 15 s; the assertion waits a little longer.
const UNSENT_TIMEOUT_MS = 25_000;

async function drawLine(page, map) {
    const box = await map.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    // 200 px above store.spec's lines, so the dashed unsaved line is not hidden under a saved one.
    const [a, b] = TRACER.drawOffsets.map(([dx, dy]) => [cx + dx, cy + dy - 200]);
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

async function shot(page, name) {
    await nextFrames(page);
    mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, name), fullPage: false });
}

/** Send one message through the page's component with the test hook; returns the reply envelope. */
async function send(page, type, body) {
    await page.waitForFunction(() => Boolean(window.__mapStudioTest));
    return page.evaluate(([t, b]) => window.__mapStudioTest.send(t, b), [type, body]);
}

/** The queue as stored for the map editor. */
async function storedQueue(page) {
    return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '[]'), KEY);
}

const EVENT_FIRED = 'event-fired:';
const BUSY_MESSAGE = 'Map Studio is busy with other map requests; nothing was saved. Try again in a moment.';

/**
 * The Gateway's reply as Perspective delivers it ([observed in the 8.3.10 client]: a text
 * frame `event-fired:` and JSON whose `event` is the Map Studio envelope), or null.
 */
function firedEvent(message) {
    if (typeof message !== 'string' || !message.startsWith(EVENT_FIRED)) return null;
    try {
        const frame = JSON.parse(message.slice(EVENT_FIRED.length));
        return frame && frame.event && typeof frame.event.type === 'string' ? frame : null;
    } catch (err) {
        return null;
    }
}

const SYNC = 'sync:';

/**
 * A browser frame without the edits.apply events the gate drops. Perspective sends component
 * events inside numbered `sync:` frames and waits for each one to be answered
 * ([observed in the 8.3.10 client]: a dropped frame stalls every later one), so the frame is
 * passed on with those events taken out rather than dropped.
 */
function withoutDroppedSaves(message, gate) {
    if (typeof message !== 'string' || !message.startsWith(SYNC) || !message.includes('edits.apply')) return message;
    let frame;
    try {
        frame = JSON.parse(message.slice(SYNC.length));
    } catch (err) {
        return message;
    }
    if (!frame || !Array.isArray(frame.events)) return message;
    const kept = frame.events.filter((e) => {
        const ev = e && e.event;
        const save = ev && ev.type === 'edits.apply';
        const drop = save && (gate.drop || (gate.dropBatch && ev.body && ev.body.batchId === gate.dropBatch));
        if (drop) gate.dropped++;
        return !drop;
    });
    if (kept.length === frame.events.length) return message;
    frame.events = kept;
    return SYNC + JSON.stringify(frame);
}

/**
 * Route every websocket of the context through the test. While `gate.drop` is true, every
 * edits.apply the browser sends is taken out (the Gateway never sees it), and while
 * `gate.dropBatch` is set, every edits.apply of that batch. While
 * `gate.dropChanged` is above 0, that many map.changed frames are dropped (a gap). While
 * `gate.failLoad` is 'busy' or 'down', a map.load.reply becomes that store-unreachable error.
 */
async function routeSockets(context, gate) {
    await context.routeWebSocket(/.*/, (ws) => {
        const server = ws.connectToServer();
        ws.onMessage((message) => {
            server.send(withoutDroppedSaves(message, gate));
        });
        server.onMessage((message) => {
            const frame = firedEvent(message);
            if (frame && frame.event.type === 'map.changed' && gate.dropChanged > 0) {
                gate.dropChanged--;
                return;
            }
            if (frame && frame.event.type === 'map.load.reply' && gate.failLoad) {
                gate.failedLoads++;
                frame.event = {
                    v: frame.event.v, type: 'error', id: frame.event.id,
                    body: {
                        code: 'store-unreachable',
                        message: gate.failLoad === 'busy' ? BUSY_MESSAGE : 'The map store is unavailable (test).'
                    }
                };
                ws.send(EVENT_FIRED + JSON.stringify(frame));
                return;
            }
            ws.send(message);
        });
    });
}

for (const [width, height] of [[1440, 900], [390, 844]]) {
    editorTest.describe(`${width} px`, () => {
        editorTest.use({ viewport: { width, height }, deviceScaleFactor: 1 });

        editorTest('a line the Gateway never answers is kept, survives the page and saves on reopen',
            async ({ page, context }) => {
                const gate = { drop: false, dropped: 0, dropChanged: 0, failLoad: null, failedLoads: 0 };
                await routeSockets(context, gate);
                let map = await openMap(page, '/edit');
                const before = await mapLoaded(map);
                await expect(map).toHaveAttribute('data-edit-level', 'full');
                await expect(map).toHaveAttribute('data-editing', 'on');

                gate.drop = true;
                await drawLine(page, map);
                // Written before the send, so it is in storage at once.
                await expect.poll(async () => (await storedQueue(page)).length).toBe(1);
                const row = page.locator('.mapstudio-unsaved-row');
                // Unsent from the start; the reason arrives when the 15 s reply timer runs out.
                await expect(row).toHaveAttribute('data-code', 'timeout', { timeout: UNSENT_TIMEOUT_MS });
                await expect(row).toHaveAttribute('data-unsaved-state', 'unsent');
                await expect(page.locator('.mapstudio-unsaved-summary')).toHaveText('Store unreachable - 1 edit not saved');
                await expect(page.locator('.mapstudio-save-status')).toHaveAttribute('data-save-state', 'unsent');
                await expect(map).toHaveAttribute('data-unsaved-count', '1');
                await expect(map).toHaveAttribute('data-items-loaded', String(before));
                expect(gate.dropped).toBeGreaterThan(0);
                const [entry] = await storedQueue(page);
                await shot(page, `mapstudio-unsaved-kept-${width}.png`);

                // Close the page; a new page of the same browser (same localStorage) with the Gateway reachable.
                await page.close();
                gate.drop = false;
                const reopened = await context.newPage();
                map = await openMap(reopened, '/edit');
                await expect(map).toHaveAttribute('data-load-state', 'loaded', { timeout: 60_000 });
                await expect(map).toHaveAttribute('data-unsaved-count', '0', { timeout: 30_000 });
                await expect(map).toHaveAttribute('data-items-loaded', String(before + 1));
                expect(await storedQueue(reopened)).toEqual([]);

                // Saved under its original batchId: the Gateway answers a resend with the first reply.
                const again = await send(reopened, 'edits.apply', entry.batch);
                expect(again.type).toBe('edits.apply.reply');
                expect(again.body.batchId).toBe(entry.batchId);
                await shot(reopened, `mapstudio-unsaved-replayed-${width}.png`);
            });

        editorTest('a queued batch refused for a conflict names the other editor\'s change and Discard removes it',
            async ({ page, browser }) => {
                let map = await openMap(page, '/edit');
                await mapLoaded(map);
                const id = randomUUID();
                const lineData = (name, dy) => ({
                    kind: 'line', name,
                    geometry: { type: 'LineString', coordinates: [TRACER.points.p1.lngLat, TRACER.points.p2.lngLat]
                        .map(([lng, lat]) => [lng, lat + dy]) }
                });
                const create = { batchId: randomUUID(), ops: [{ op: 'create', entity: 'item', id, baseVersion: 0, data: lineData('Conflict line', 0) }] };
                expect((await send(page, 'edits.apply', create)).type).toBe('edits.apply.reply');
                // The phone editor changes the line's properties: version 2, changed by mapoperator.
                const operator = await signedInContext(browser, OPERATOR_USER, { viewport: { width: 390, height: 844 } });
                try {
                    const opPage = await operator.newPage();
                    const opMap = await openMap(opPage, '/edit');
                    await mapLoaded(opMap);
                    await expect(opMap).toHaveAttribute('data-edit-level', 'phone');
                    const opSave = await send(opPage, 'edits.apply', {
                        batchId: randomUUID(),
                        ops: [{ op: 'update', entity: 'item', id, baseVersion: 1, data: { properties: { buried: true } } }]
                    });
                    expect(opSave.type, JSON.stringify(opSave.body)).toBe('edits.apply.reply');
                } finally {
                    await operator.close();
                }
                // A stale batch left in the queue by an earlier page: an update at baseVersion 1 (the
                // line is at 2) and a new line, so the whole batch is refused and the new line is
                // drawn as unsaved until it is discarded.
                const stale = {
                    batchId: randomUUID(),
                    ops: [
                        { op: 'update', entity: 'item', id, baseVersion: 1, data: { name: 'Stale edit' } },
                        { op: 'create', entity: 'item', id: randomUUID(), baseVersion: 0, data: lineData('Unsaved line', 0.002) }
                    ]
                };
                // The Gateway's sentence for this batch (a refused batch is not saved, so asking is harmless).
                const refusal = await send(page, 'edits.apply', stale);
                expect(refusal.type).toBe('error');
                expect(refusal.body.code).toBe('conflict');
                await page.evaluate(([key, b]) => window.localStorage.setItem(key, JSON.stringify([{
                    batchId: b.batchId, batch: b, queuedAt: new Date().toISOString(), state: 'unsent'
                }])), [KEY, stale]);

                await page.reload({ waitUntil: 'load' });
                map = await openMap(page, '/edit');
                const row = page.locator(`.mapstudio-unsaved-row[data-batch-id="${stale.batchId}"]`);
                await expect(row).toHaveAttribute('data-unsaved-state', 'refused', { timeout: 30_000 });
                await expect(row).toHaveAttribute('data-code', 'conflict');
                await expect(row).toContainText(`Not saved - conflict with ${OPERATOR_USER}'s change.`);
                await expect(row).toContainText(refusal.body.message);
                expect(refusal.body.message).toContain(OPERATOR_USER);
                await expect(map).toHaveAttribute('data-unsaved-count', '1');
                await expect(map).toHaveAttribute('data-unsaved-drawn', '1');
                await shot(page, `mapstudio-unsaved-conflict-${width}.png`);

                await row.locator('.mapstudio-unsaved-discard').click();
                await expect(map).toHaveAttribute('data-unsaved-count', '0');
                await expect(map).toHaveAttribute('data-unsaved-drawn', '0');
                await expect(page.locator('.mapstudio-unsaved')).toHaveCount(0);
                expect(await storedQueue(page)).toEqual([]);
            });
    });
}

editorTest.describe('a map.load that fails after the map loaded', () => {
    editorTest.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

    editorTest('busy keeps the items and editing; store unreachable draws no store item but keeps the queued line; both retry',
        async ({ page, context }) => {
            editorTest.setTimeout(180_000);
            const gate = { drop: false, dropBatch: null, dropped: 0, dropChanged: 0, failLoad: null, failedLoads: 0 };
            await routeSockets(context, gate);
            const map = await openMap(page, '/edit');
            await mapLoaded(map);
            const lineBatch = (name, dy) => ({
                batchId: randomUUID(),
                ops: [{
                    op: 'create', entity: 'item', id: randomUUID(), baseVersion: 0,
                    data: { kind: 'line', name, geometry: { type: 'LineString', coordinates: [TRACER.points.p1.lngLat, TRACER.points.p3.lngLat]
                        .map(([lng, lat]) => [lng, lat + dy]) } }
                }]
            });
            // At least one store item drawn, saved by the hook and drawn from its map.changed.
            const before = Number(await map.getAttribute('data-items-loaded'));
            expect((await send(page, 'edits.apply', lineBatch('Loaded line', -0.002))).type).toBe('edits.apply.reply');
            await expect(map).toHaveAttribute('data-items-loaded', String(before + 1));

            // A line the Gateway never sees: queued and drawn as unsaved.
            gate.drop = true;
            await drawLine(page, map);
            await expect(map).toHaveAttribute('data-unsaved-count', '1');
            await expect(map).toHaveAttribute('data-unsaved-drawn', '1');
            // From here only that batch is dropped, so the hook's saves below reach the Gateway.
            gate.dropBatch = (await storedQueue(page))[0].batchId;
            gate.drop = false;

            // A gap: the first of two saves' map.changed is dropped, so the map sends map.load,
            // and the bounded pool's busy answer comes back.
            gate.failLoad = 'busy';
            gate.dropChanged = 1;
            expect((await send(page, 'edits.apply', lineBatch('Gap line 1', -0.003))).type).toBe('edits.apply.reply');
            expect((await send(page, 'edits.apply', lineBatch('Gap line 2', -0.004))).type).toBe('edits.apply.reply');
            await expect(map).toHaveAttribute('data-load-state', 'failed', { timeout: 30_000 });
            expect(gate.failedLoads).toBe(1);
            await expect(map).toHaveAttribute('data-editing', 'on');
            await expect(map).toHaveAttribute('data-items-loaded', String(before + 1));
            await expect(map).toHaveAttribute('data-edit-level', 'full');
            await expect(page.locator('.mapstudio-draw-button')).toBeEnabled();

            // The timed retry (15 s) loads again, now answered store-unreachable: no store item is
            // drawn as current, the draw tool is off, and the queued line is still drawn as unsaved.
            gate.failLoad = 'down';
            await expect.poll(() => gate.failedLoads, { timeout: 30_000 }).toBe(2);
            await expect(map).toHaveAttribute('data-store-state', 'unavailable');
            await expect(map).toHaveAttribute('data-items-loaded', '0');
            await expect(map).toHaveAttribute('data-editing', 'off');
            await expect(page.locator('.mapstudio-draw-button')).toBeDisabled();
            await expect(map).toHaveAttribute('data-unsaved-count', '1');
            await expect(map).toHaveAttribute('data-unsaved-drawn', '1');
            await expect(page.locator('.mapstudio-load-status')).toContainText('store-unreachable: The map store is unavailable (test).');
            await shot(page, 'mapstudio-unsaved-store-down-1440.png');

            // The store is back: the next timed retry loads the map, editing comes back on and the
            // queued line is replayed and saved.
            gate.failLoad = null;
            gate.dropBatch = null;
            await expect(map).toHaveAttribute('data-load-state', 'loaded', { timeout: 30_000 });
            await expect(map).toHaveAttribute('data-editing', 'on');
            await expect(map).toHaveAttribute('data-unsaved-count', '0', { timeout: 30_000 });
            await expect(map).toHaveAttribute('data-items-loaded', String(before + 4));
            await expect(page.locator('.mapstudio-draw-button')).toBeEnabled();
        });
});

// The plan's manual check, scripted: stops and starts this checkout's dev Gateway container
// (MAPSTUDIO_CONTAINER in .env), so it runs only when asked: MAPSTUDIO_GATEWAY_STOP=1.
test.describe('with the dev Gateway stopped', () => {
    test.skip(process.env.MAPSTUDIO_GATEWAY_STOP !== '1', 'stops the dev Gateway: run with MAPSTUDIO_GATEWAY_STOP=1');
    test.use({ viewport: { width: 1440, height: 900 } });

    function docker(...args) {
        const run = spawnSync('docker', args, { encoding: 'utf8', timeout: 180_000 });
        if (run.status !== 0) throw new Error('docker ' + args[0] + ' failed: ' + (run.stderr || '').trim());
    }

    async function gatewayRunning() {
        try {
            const res = await fetch(`${gatewayUrl()}/StatusPing`, { signal: AbortSignal.timeout(5_000) });
            return res.ok && (await res.text()).includes('RUNNING');
        } catch (err) {
            return false;
        }
    }

    test('a line drawn while the Gateway is down survives the browser and saves when it is back', async ({ browser }) => {
        test.setTimeout(600_000);
        const container = process.env.MAPSTUDIO_CONTAINER ?? envFileValue('MAPSTUDIO_CONTAINER');
        expect(container, 'MAPSTUDIO_CONTAINER').toBeTruthy();
        let context = await signedInContext(browser, EDITOR_USER, { viewport: { width: 1440, height: 900 } });
        let page = await context.newPage();
        let map = await openMap(page, '/edit');
        const before = await mapLoaded(map);

        docker('stop', container);
        try {
            await drawLine(page, map);
            const row = page.locator('.mapstudio-unsaved-row');
            await expect(row).toHaveAttribute('data-code', /^(timeout|disconnected)$/, { timeout: UNSENT_TIMEOUT_MS });
            await expect(row).toHaveAttribute('data-unsaved-state', 'unsent');
            console.log('Gateway stopped: the row says "' + (await row.locator('.mapstudio-unsaved-text').textContent())
                + '" (code ' + (await row.getAttribute('data-code')) + ')');
            await shot(page, 'mapstudio-unsaved-gateway-stopped-1440.png');
            // Close the browser context: only the stored queue survives it.
            const queued = await storedQueue(page);
            expect(queued.length).toBe(1);
            await context.close();

            docker('start', container);
            await expect.poll(gatewayRunning, { timeout: 300_000, intervals: [2_000] }).toBe(true);

            context = await signedInContext(browser, EDITOR_USER, { viewport: { width: 1440, height: 900 } });
            page = await context.newPage();
            // The new browser starts with the stored queue, as a reopened browser would.
            await page.goto(`${gatewayUrl()}/StatusPing`);
            await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [KEY, JSON.stringify(queued)]);
            map = await openMap(page, '/edit');
            await expect(map).toHaveAttribute('data-unsaved-count', '0', { timeout: 60_000 });
            await expect(map).toHaveAttribute('data-items-loaded', String(before + 1));
            console.log('Gateway back: batch ' + queued[0].batchId + ' saved by the replay.');
        } finally {
            if (!(await gatewayRunning())) {
                docker('start', container);
            }
            await context.close().catch(() => {});
        }
    });
});
