// The tracer of epic 3 entry 5: live values reach an icon and its default popup (AD-6, AD-7).
// On /live the seeded pad kind setup resolves the tracer's
// points against the dev assets P12, P14 and P15 (ops/config/core tags, ops/project seed), and the
// page's MapEditor-only buttons drive the dev tags and the dev-only alarm through the project
// library mapstudio_live: a toggled tag changes the icon's KPI within one refresh interval, an
// alarm draws the priority glyph and digit (solid), its acknowledgement turns it hollow, broken
// comms draws the comms-lost glyph, word and token, a click opens the default popup in the stated
// order and its KPI updates while open, and three open sessions share one subscription per path
// (the Gateway log of MapStudio.live). Screenshots at 1440 and 390 px for the docs (AD-15).

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { screenshotDir } from '../lib/env.mjs';
import { gatewayRun, logLines } from '../lib/gateway.mjs';
import { TRACER, pagePixel } from '../lib/geo.mjs';
import { decodePng, firstOddPixel } from '../lib/png.mjs';
import {
    EDITOR_USER, editorTest, expect, loadedCounts, mapLoaded, nextFrames, openMap, runSeed, signedInContext, test
} from './fixtures.mjs';

/** The bound for a change to reach the icon: one refresh interval (the dev setup's 10 s) plus margin. */
const INTERVAL_MS = 25_000;
/** The bound for an open popup's push (250 ms on the Gateway, plus the round trip). */
const PUSH_MS = 5_000;

let ids;

/** Press a /live dev button and return its result (the label changes on every press, ranAt included). */
async function press(page, button) {
    const out = page.locator('#mapstudio-live-result');
    const before = await out.innerText();
    await page.locator('#mapstudio-live-' + button).click();
    await expect.poll(() => out.innerText(), { timeout: 30_000 }).not.toBe(before);
    const result = JSON.parse(await out.innerText());
    expect(result.error, 'the dev button ' + button).toBeUndefined();
    expect(result.refused, 'the dev button ' + button).toBeUndefined();
    return result;
}

/** The hidden live-state row of one map item. */
const liveItem = (page, id) => page.locator('.mapstudio-live-item[data-item-id="' + id + '"]');

async function clickPoint(page, map, key) {
    await loadedCounts(map);
    const box = await map.boundingBox();
    const [x, y] = pagePixel(box, TRACER.points[key].lngLat, TRACER.center, TRACER.zoom);
    await page.mouse.click(x, y);
}

async function shot(page, name) {
    await nextFrames(page);
    mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, name), fullPage: false });
}

/** Put the dev pad P12 in its quiet state: pressure 400 (no alarm), comms on, nothing unacknowledged. */
async function quiet(page) {
    await press(page, 'pressure-low');
    await press(page, 'comms-on');
    await press(page, 'ack');
}

test.beforeAll(async ({ browser }) => {
    // Seed again (not ensureSeeded's cached result): the pad kind setup and the tracer's asset links
    // come from the seed, and an earlier spec may have changed the pad kind setup.
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
        const seed = await runSeed(page);
        expect(seed.error, 'the seed saved').toBeUndefined();
        ids = Object.fromEntries(Object.entries(TRACER.points).map(([k, p]) => [k, seed.ids[p.key]]));
        await mapLoaded(await openMap(page, '/live'));
        await quiet(page);
    } finally {
        await context.close();
    }
});

editorTest.describe('1440 px', () => {
    editorTest.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

    editorTest('a toggled tag, an alarm raised and acknowledged, comms lost, and the default popup live while open',
        async ({ page, watched }) => {
            const map = await openMap(page, '/live');
            await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
            await mapLoaded(map);
            // The full batch after map.load: every linked tracer point has values; p3 (P15) reports the
            // tags P15 does not have, with no path in the reason.
            await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
            const p1 = liveItem(page, ids.p1);
            const p3 = liveItem(page, ids.p3);
            await expect(p1).toHaveAttribute('data-state', 'normal', { timeout: INTERVAL_MS });
            await expect(p1).toHaveAttribute('data-kpi', '400 psi', { timeout: INTERVAL_MS });
            await expect(p1).toHaveAttribute('data-comms', 'ok');
            await expect(p1).toHaveAttribute('data-alarm', '');
            await expect(p3).toHaveAttribute('data-problems', /comms: the tag was not found; kpi:pressure: the tag was not found/, { timeout: INTERVAL_MS });
            expect(await p3.getAttribute('data-problems')).not.toContain('[default]');

            // A toggled tag changes the icon's KPI within one refresh interval; above 900 it raises the
            // dev alarm: the priority 1 glyph, solid (unacknowledged), with its digit.
            const toggled = Date.now();
            await press(page, 'pressure-high');
            await expect(p1).toHaveAttribute('data-kpi', '950 psi', { timeout: INTERVAL_MS });
            expect(Date.now() - toggled).toBeLessThan(INTERVAL_MS);
            await expect(p1).toHaveAttribute('data-alarm', '1:unacked:1', { timeout: INTERVAL_MS });
            await expect(p1).toHaveAttribute('data-state', 'alarm');
            expect(await p1.getAttribute('data-marker')).toContain('"alarm-1-unacknowledged",1,true');

            // The default popup, in order: header, comms with its data age, the KPIs, the alarms.
            await clickPoint(page, map, 'p1');
            const popup = page.locator('.maplibregl-popup .mapstudio-popup--default');
            await expect(popup).toBeVisible({ timeout: 30_000 });
            await expect(page.locator('.mapstudio-popup--view')).toHaveCount(0);
            expect(await popup.locator('[data-part]').evaluateAll((els) => els.map((e) => e.getAttribute('data-part'))))
                .toEqual(['header', 'comms', 'kpis', 'alarms']);
            await expect(popup.locator('.mapstudio-popup-name')).toHaveText('Point 1');
            await expect(popup.locator('.mapstudio-popup-subline')).toHaveText('Well pad');
            await expect(popup.locator('[data-part="comms"]')).toHaveAttribute('data-comms', 'ok');
            await expect(popup.locator('[data-part="comms"] .mapstudio-popup-value')).toHaveText(/^OK - \d+ (s|min) ago$/);
            const kpis = popup.locator('.mapstudio-popup-kpi');
            await expect(kpis).toHaveCount(2);
            await expect(kpis.nth(0)).toHaveAttribute('data-kpi', 'pressure');
            await expect(kpis.nth(0).locator('.mapstudio-popup-value')).toHaveText('950 psi');
            await expect(kpis.nth(1)).toHaveAttribute('data-kpi', 'flow');
            await expect(popup.locator('[data-part="alarms"]')).toHaveAttribute('data-alarm', '1:unacked');
            await expect(popup.locator('[data-part="alarms"]')).toContainText('1 alarm - Priority 1, unacknowledged');
            // The alarm summary (entry 8, R7): the counts by priority and the alarm in words with its source
            // below the alarms path and its age, read from the Gateway's alarm status; View alarms opens
            // the setup's alarm page with {asset.id} filled. Map Studio acknowledges nothing.
            const alarms = popup.locator('[data-part="alarms"]');
            await expect(alarms).toHaveAttribute('data-alarm-counts', '1,0,0', { timeout: PUSH_MS });
            await expect(alarms).toHaveAttribute('data-alarm-listed', '1');
            await expect(alarms.locator('.mapstudio-popup-alarm-line')).toHaveText(/^High pressure - Pressure, \d+ (s|min) ago$/);
            expect(await alarms.innerText()).not.toContain('[default]');
            await expect(popup.locator('.mapstudio-popup-link')).toHaveAttribute('data-link', '/pad/Point 1');
            await expect(page.locator('.maplibregl-popup-close-button')).toHaveCount(0);
            await shot(page, 'mapstudio-live-1440.png');
            await alarms.locator('.mapstudio-popup-view-alarms').click();
            await expect(page).toHaveURL(/\/alarms\/P12$/, { timeout: 30_000 });
            await expect(page.locator('#mapstudio-alarms-title')).toHaveText('Alarms of P12', { timeout: 30_000 });
            await expect(page.locator('#mapstudio-alarms-table')).toBeVisible();
            await shot(page, 'mapstudio-alarm-page-1440.png');
            // Back on the map, the popup open again for the rest.
            await mapLoaded(await openMap(page, '/live'));
            await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
            await clickPoint(page, map, 'p1');
            await expect(popup).toBeVisible({ timeout: 30_000 });
            await expect(popup.locator('[data-part="alarms"]')).toHaveAttribute('data-alarm', '1:unacked', { timeout: INTERVAL_MS });

            // Acknowledged: the badge turns hollow, the popup says so, while it stays open.
            await press(page, 'ack');
            await expect(p1).toHaveAttribute('data-alarm', '1:acked:1', { timeout: INTERVAL_MS });
            expect(await p1.getAttribute('data-marker')).toContain('"alarm-1-acknowledged",1,false');
            await expect(popup.locator('[data-part="alarms"]')).toHaveAttribute('data-alarm', '1:acked', { timeout: PUSH_MS });
            await expect(popup.locator('[data-part="alarms"]')).toContainText('acknowledged');

            // Comms lost: the comms-lost glyph, word and token on the icon, every value stale in the popup.
            await press(page, 'comms-off');
            await expect(p1).toHaveAttribute('data-comms', 'lost', { timeout: INTERVAL_MS });
            await expect(p1).toHaveAttribute('data-stale', 'true');
            await expect(p1).toHaveAttribute('data-kpi-stale', 'true');
            expect(await p1.getAttribute('data-marker')).toContain('"comms-lost"');
            // The word is symbol-layer text beside the name (entry 7), never in the image id.
            expect(await p1.getAttribute('data-marker')).not.toContain('Comms lost');
            await expect(p1).toHaveAttribute('data-word', 'Comms lost');
            await expect(popup.locator('[data-part="comms"]')).toHaveAttribute('data-comms', 'lost', { timeout: PUSH_MS });
            await expect(popup.locator('[data-part="comms"] .mapstudio-popup-value')).toHaveText(/^Comms lost - /);
            await expect(kpis.nth(0)).toHaveAttribute('data-stale', 'true');
            await expect(kpis.nth(0).locator('.mapstudio-popup-value')).toHaveText('Stale - 950 psi (comms lost)');
            await expect(popup.locator('[data-part="alarms"]')).toHaveAttribute('data-stale', 'true');
            const token = await popup.locator('[data-part="comms"]').evaluate((el) => {
                const lost = getComputedStyle(el).color;
                const expected = getComputedStyle(el.closest('.mapstudio')).getPropertyValue('--mapstudio-comms-lost').trim();
                return { lost, expected };
            });
            expect(token.expected, 'the comms-lost token resolves on the component').not.toBe('');
            expect(token.lost, 'the comms row takes the comms-lost token').not.toBe(await popup.locator('.mapstudio-popup-name').evaluate((el) => getComputedStyle(el).color));
            await shot(page, 'mapstudio-live-comms-lost-1440.png');

            // Comms back and the pressure down: the popup's KPI updates while open, within the push bound.
            await press(page, 'comms-on');
            const changed = Date.now();
            await press(page, 'pressure-low');
            await expect(kpis.nth(0).locator('.mapstudio-popup-value')).toHaveText('400 psi', { timeout: PUSH_MS });
            expect(Date.now() - changed).toBeLessThan(PUSH_MS);
            await expect(popup.locator('[data-part="comms"]')).toHaveAttribute('data-comms', 'ok');
            // The alarm clears (pressure below the setpoint): no active alarm, no badge, back to normal.
            await expect(p1).toHaveAttribute('data-state', 'normal', { timeout: INTERVAL_MS });
            await expect(popup.locator('[data-part="alarms"]')).toContainText('No active alarms', { timeout: PUSH_MS });

            await popup.locator('.mapstudio-popup-close').click();
            await expect(page.locator('.mapstudio-popup--default')).toHaveCount(0);
            expect(watched.warnings, 'Map Studio warnings').toEqual([]);
        });

    editorTest('three open sessions share one subscription per path, and a viewer gets the values', async ({ page, browser }) => {
        const run = await gatewayRun();
        const map = await openMap(page, '/live');
        await mapLoaded(map);
        await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
        const viewers = [];
        try {
            for (let i = 0; i < 2; i++) {
                const context = await browser.newContext({
                    viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, storageState: { cookies: [], origins: [] }
                });
                viewers.push(context);
                const viewer = await context.newPage();
                const viewerMap = await openMap(viewer, '/live');
                await mapLoaded(viewerMap);
                await expect(viewerMap).toHaveAttribute('data-edit-level', 'none');
                // A viewer gets the batches too: values, with no tag path on the wire.
                await expect(viewerMap).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
                await expect(liveItem(viewer, ids.p1)).toHaveAttribute('data-kpi', /psi$/, { timeout: INTERVAL_MS });
                const problems = await liveItem(viewer, ids.p3).getAttribute('data-problems');
                expect(problems).not.toContain('[default]');
            }
            // The Gateway log since the module started: one live subscription per path, none per
            // session. Another spec may have turned the pad setup off and on again (each such rebuild
            // unsubscribes and resubscribes the path), so the path's lines must alternate subscribed,
            // unsubscribed, ... and end subscribed: never two subscribes without an unsubscribe between.
            const lines = await logLines('MapStudio.live', Date.parse(run.moduleStartupTime) - 1000);
            const pressure = lines
                .map((l) => (l.includes('unsubscribed [default]Mesa/P12/Pressure') ? 'unsub'
                    : l.includes('subscribed [default]Mesa/P12/Pressure') ? 'sub' : null))
                .filter(Boolean);
            expect(pressure.length, lines.join('\n')).toBeGreaterThanOrEqual(1);
            expect(pressure[0], lines.join('\n')).toBe('sub');
            expect(pressure[pressure.length - 1], lines.join('\n')).toBe('sub');
            for (let i = 1; i < pressure.length; i++) {
                expect(pressure[i], 'line ' + i + ' of ' + pressure.join(',')).not.toBe(pressure[i - 1]);
            }
            const metrics = lines.filter((l) => l.includes(': subscribed [default]Mesa/P12/Alarm Metrics.'));
            expect([...new Set(metrics.map((l) => l.replace(/.*Alarm Metrics\./, '').trim()))].sort())
                .toEqual(['ActiveAckCount', 'ActiveUnackCount', 'HighestActivePriority']);
            expect(lines.some((l) => /live plan rebuilt: \d+ map items, \d+ tag paths/.test(l))).toBe(true);
        } finally {
            for (const v of viewers) await v.close();
        }
    });
});

editorTest.describe('390 px', () => {
    editorTest.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

    editorTest('the alarmed icon and its popup on a phone', async ({ page }) => {
        const map = await openMap(page, '/live');
        await mapLoaded(map);
        await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
        await press(page, 'pressure-high');
        const p1 = liveItem(page, ids.p1);
        await expect(p1).toHaveAttribute('data-alarm', '1:unacked:1', { timeout: INTERVAL_MS });
        await clickPoint(page, map, 'p1');
        // At 390 px every point popup is a bottom sheet (entry 8; DESIGN.md bottom-sheet): 8 px from the
        // sides, above the App Bar toggle, a handle, 44 px pop-out and close, the alarm block with its
        // line under the glyph, a footer with View alarms, no pointer, and no map label through it.
        const sheet = page.locator('.mapstudio-sheet .mapstudio-popup--default');
        await expect(sheet).toBeVisible({ timeout: 30_000 });
        await expect(map).toHaveAttribute('data-popup-mode', 'sheet');
        await expect(page.locator('.maplibregl-popup')).toHaveCount(0);
        await expect(sheet.locator('[data-part="alarms"]')).toContainText('Priority 1, unacknowledged');
        await expect(sheet.locator('.mapstudio-popup-alarm-line')).toHaveText(/^High pressure - Pressure, /, { timeout: PUSH_MS });
        const geometry = await page.evaluate(() => {
            const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
            const block = document.querySelector('.mapstudio-popup-alarms');
            const glyph = block.querySelector('.mapstudio-popup-alarm-glyph').getBoundingClientRect();
            const words = block.querySelector('.mapstudio-popup-alarm-words').getBoundingClientRect();
            const line = block.querySelector('.mapstudio-popup-alarm-line').getBoundingClientRect();
            const body = r('.mapstudio-popup-body');
            return { sheet: r('.mapstudio-sheet'), handle: r('.mapstudio-popup-handle'), close: r('.mapstudio-popup-close'),
                link: r('.mapstudio-popup-link'), view: r('.mapstudio-popup-view-alarms'), footer: r('.mapstudio-popup-footer'),
                body, glyphRight: glyph.right, wordsLeft: words.left, lineLeft: line.left, blockLeft: block.getBoundingClientRect().left,
                padding: getComputedStyle(document.querySelector('.mapstudio-popup-row')).paddingLeft,
                background: getComputedStyle(document.querySelector('.mapstudio-sheet')).backgroundColor,
                vw: window.innerWidth, vh: window.innerHeight };
        });
        expect(Math.round(geometry.sheet.x)).toBe(8);
        expect(Math.round(geometry.vw - geometry.sheet.r)).toBe(8);
        expect(geometry.vh - geometry.sheet.b, 'above the App Bar toggle').toBeGreaterThanOrEqual(56);
        expect(geometry.sheet.h).toBeLessThanOrEqual(geometry.vh * 0.6 + 1);
        expect(geometry.handle.w).toBe(36);
        expect(Math.min(geometry.close.w, geometry.close.h)).toBeGreaterThanOrEqual(44);
        expect(Math.min(geometry.link.w, geometry.link.h)).toBeGreaterThanOrEqual(44);
        expect(geometry.view.h).toBeGreaterThanOrEqual(44);
        expect(geometry.footer.b).toBeLessThanOrEqual(geometry.sheet.b);
        expect(geometry.padding).toBe('16px');
        expect(geometry.wordsLeft - geometry.glyphRight, 'the heading starts right after its glyph').toBeLessThan(10);
        expect(geometry.lineLeft - geometry.blockLeft, 'the alarm line wraps under the glyph, no gap beside it').toBeLessThan(20);
        expect(geometry.background).not.toMatch(/rgba\(.*, 0\)$|transparent/);
        // The render check (P8): the body's left gutter, 2 to 12 px in, is one flat colour top to bottom:
        // nothing of the map (a marker label, a neighbour's chip) shows through the sheet.
        const clip = { x: Math.round(geometry.body.x) + 2, y: Math.round(geometry.body.y) + 2, width: 10, height: Math.round(geometry.body.h) - 4 };
        const odd = firstOddPixel(decodePng(await page.screenshot({ clip })), 0, 0, clip.width, clip.height, 3);
        expect(odd, 'a pixel of the sheet gutter that is not the surface').toBeNull();
        await shot(page, 'mapstudio-live-390.png');
        // The marker stays above the sheet (the map panned if it had to).
        const marker = await map.evaluate((el) => el.getAttribute('data-center'));
        expect(marker).toBeTruthy();
        await sheet.locator('.mapstudio-popup-close').click();
        await expect(page.locator('.mapstudio-sheet')).toHaveCount(0);
        await expect(map).toHaveAttribute('data-popup-mode', '');
        await quiet(page);
    });
});
