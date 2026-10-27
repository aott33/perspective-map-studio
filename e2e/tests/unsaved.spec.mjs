// Unsaved edits survive and replay (epic-map-store-and-data, entry 8). Every batch is
// queued in localStorage (per project and user) before it is sent and stays there until
// its edits.apply.reply or a Discard; the queue replays after map.load answers at level
// phone or full.
//
// "Gateway gone" is made deterministic by routing the page's websockets through the test
// (Playwright routeWebSocket) and dropping every frame that carries an edits.apply, so the
// Gateway never sees the save and the 15 s reply timer runs out. Whether Chromium's offline
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
    EDITOR_USER, editorTest, expect, mapLoaded, nextFrames, openMap, signedInContext, test
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

/**
 * Route every websocket of the context through the test; while `gate.drop` is true, a
 * browser frame that carries an edits.apply is dropped (the Gateway never sees it).
 */
async function routeSockets(context, gate) {
    await context.routeWebSocket(/.*/, (ws) => {
        const server = ws.connectToServer();
        ws.onMessage((message) => {
            if (gate.drop && typeof message === 'string' && message.includes('edits.apply')) {
                gate.dropped++;
                return;
            }
            server.send(message);
        });
        server.onMessage((message) => ws.send(message));
    });
}

for (const [width, height] of [[1440, 900], [390, 844]]) {
    editorTest.describe(`${width} px`, () => {
        editorTest.use({ viewport: { width, height }, deviceScaleFactor: 1 });

        editorTest('a line the Gateway never answers is kept, survives the page and saves on reopen',
            async ({ page, context }) => {
                const gate = { drop: false, dropped: 0 };
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

        editorTest('a queued batch refused for a conflict names the other change and Discard removes it',
            async ({ page }) => {
                let map = await openMap(page, '/edit');
                await mapLoaded(map);
                const id = randomUUID();
                const create = {
                    batchId: randomUUID(),
                    ops: [{
                        op: 'create', entity: 'item', id, baseVersion: 0,
                        data: { kind: 'line', name: 'Conflict line', geometry: { type: 'LineString', coordinates: [TRACER.points.p1.lngLat, TRACER.points.p2.lngLat] } }
                    }]
                };
                expect((await send(page, 'edits.apply', create)).type).toBe('edits.apply.reply');
                const rename = (name) => ({
                    batchId: randomUUID(),
                    ops: [{ op: 'update', entity: 'item', id, baseVersion: 1, data: { name } }]
                });
                expect((await send(page, 'edits.apply', rename('Saved second'))).type).toBe('edits.apply.reply');
                // A stale edit left in the queue by an earlier page: baseVersion 1, the item is at 2.
                const stale = rename('Stale edit');
                await page.evaluate(([key, b]) => window.localStorage.setItem(key, JSON.stringify([{
                    batchId: b.batchId, batch: b, queuedAt: new Date().toISOString(), state: 'unsent'
                }])), [KEY, stale]);

                await page.reload({ waitUntil: 'load' });
                map = await openMap(page, '/edit');
                const row = page.locator(`.mapstudio-unsaved-row[data-batch-id="${stale.batchId}"]`);
                await expect(row).toHaveAttribute('data-unsaved-state', 'refused', { timeout: 30_000 });
                await expect(row).toHaveAttribute('data-code', 'conflict');
                await expect(row).toContainText(`Not saved - conflict with ${EDITOR_USER}'s change.`);
                await expect(map).toHaveAttribute('data-unsaved-count', '1');
                await shot(page, `mapstudio-unsaved-conflict-${width}.png`);

                await row.locator('.mapstudio-unsaved-discard').click();
                await expect(map).toHaveAttribute('data-unsaved-count', '0');
                await expect(page.locator('.mapstudio-unsaved')).toHaveCount(0);
                expect(await storedQueue(page)).toEqual([]);
            });
    });
}

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
