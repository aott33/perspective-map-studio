// The lost Gateway connection (owner review notes item 32; AD-6): while the Perspective client is
// disconnected the map says so in words (a status chip, "No connection - values from 14:02"), draws
// every value as stale (the hourglass, no style) and the Needs you bar shows the state unknown (the
// hollow grey bell with "?", its words in the label and title only); when
// the connection is back the map reloads (map.load, then the Gateway's full batch) and the chip goes.
// The client's own dev-console helper `__client.simulateLostConnection(seconds)` closes the channel
// for that long, which is what the suite uses (a real `docker stop` is the playbook's step).

import { TRACER } from '../lib/geo.mjs';
import { EDITOR_USER, expect, mapLoaded, openMap, runSeed, signedInContext, test as watchedTest, watch } from './fixtures.mjs';

/**
 * The client logs its own failed reconnect attempts while the loss is simulated ("Hello API call
 * failed ... Simulated disconnect"): those are the loss itself, so they are left out; any other
 * console or page error still fails the test.
 */
const SIMULATED = /Simulated disconnect/;
const test = watchedTest.extend({
    watched: [
        async ({ page }, use) => {
            const w = watch(page);
            await use(w);
            expect(w.errors.filter((e) => !SIMULATED.test(e)), 'browser console and page errors').toEqual([]);
        },
        { auto: true }
    ]
});

/** The bound for a state to reach the map: one refresh interval (the dev setup's 10 s) plus margin. */
const INTERVAL_MS = 25_000;
/** How long the simulated loss lasts. */
const LOST_S = 8;

let ids;

const liveItem = (page, id) => page.locator('.mapstudio-live-item[data-item-id="' + id + '"]');
const chip = (page) => page.locator('.mapstudio-connection');
const bar = (page) => page.locator('.mapstudio-needs');
/** The bar's label and title while the state is unknown (needsyou.ts `BAR_UNKNOWN`, `LIST_UNKNOWN`). */
const UNKNOWN_LABEL = 'Needs you: state unknown, no connection to the Gateway';
const UNKNOWN_LIST = 'State unknown - no connection to the Gateway';

test.beforeAll(async ({ browser }) => {
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
        const seed = await runSeed(page);
        expect(seed.error, 'the seed saved').toBeUndefined();
        ids = Object.fromEntries(Object.entries(TRACER.points).map(([k, p]) => [k, seed.ids[p.key]]));
    } finally {
        await context.close();
    }
});

test.describe('1440 px', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('a lost connection shows the chip, freezes every value as stale and makes the Needs you state unknown; the map reloads when it is back', async ({ page }) => {
        const map = await openMap(page, '/live');
        await mapLoaded(map);
        await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
        await expect(map).toHaveAttribute('data-connection', 'ok');
        await expect(chip(page)).toHaveCount(0);
        // Point 1 (P12) is quiet after live.spec's setup, so it reads normal; with the connection lost it reads stale.
        await expect(liveItem(page, ids.p1)).toHaveAttribute('data-state', /^(normal|stale|alarm|comms-lost)$/, { timeout: INTERVAL_MS });
        const fullsBefore = Number(await map.getAttribute('data-live-full'));
        const stateBefore = await bar(page).getAttribute('data-state');
        expect(['ok', 'needs']).toContain(stateBefore);

        await page.evaluate((s) => window.__client.simulateLostConnection(s), LOST_S);
        await expect(map).toHaveAttribute('data-connection', 'lost', { timeout: 10_000 });
        await expect(chip(page)).toBeVisible();
        await expect(chip(page)).toHaveText(/^No connection - (values from \d\d:\d\d|no values yet)$/);
        await expect(chip(page)).toHaveAttribute('data-state', 'lost');
        // Every item with values is drawn stale (an alarm keeps its badge over the stale ring): nothing reads as live.
        // Items that show no value (stray items of earlier specs, no comms, KPI, style or alarm) have nothing to freeze.
        const states = await page.locator('.mapstudio-live-item').evaluateAll((els) => els
            .filter((el) => ['data-comms', 'data-kpi', 'data-style', 'data-alarm'].some((a) => el.getAttribute(a)))
            .map((el) => el.getAttribute('data-state')));
        expect(states.length).toBeGreaterThan(0);
        expect(states.every((s) => s === 'stale' || s === 'alarm' || s === 'comms-lost')).toBe(true);
        await expect(liveItem(page, ids.p1)).toHaveAttribute('data-state', /^(stale|alarm|comms-lost)$/);
        // The bar has no words (item 12): the hollow grey bell with "?" and no counts, the words in its label and title.
        await expect(bar(page)).toHaveAttribute('data-state', 'unknown');
        await expect(bar(page)).toHaveAttribute('data-bell', 'none');
        await expect(bar(page)).toHaveAttribute('aria-label', UNKNOWN_LABEL);
        await expect(bar(page)).toHaveAttribute('title', UNKNOWN_LABEL);
        await expect(bar(page)).toHaveText('?');
        await expect(bar(page).locator('.mapstudio-needs-count--comms-lost, .mapstudio-needs-count--stale')).toHaveCount(0);
        // An opened list says the state is unknown and lists no frozen rows.
        await bar(page).click();
        const panel = page.locator('.mapstudio-needs-panel');
        await expect(panel).toHaveAttribute('data-rows', '0');
        await expect(panel.locator('.mapstudio-needs-note')).toHaveText(UNKNOWN_LIST);
        await expect(panel.locator('.mapstudio-needs-row')).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect(panel).toHaveCount(0);

        // Back: the map reloads (another full batch), the chip goes and the bar counts again.
        await expect(map).toHaveAttribute('data-connection', 'ok', { timeout: (LOST_S + 30) * 1000 });
        await expect(chip(page)).toHaveCount(0);
        await expect.poll(() => map.getAttribute('data-live-full').then(Number), { timeout: 30_000 }).toBeGreaterThan(fullsBefore);
        await expect(bar(page)).toHaveAttribute('data-state', /^(ok|needs)$/);
        await expect(bar(page)).not.toHaveText('?');
        await expect(liveItem(page, ids.p1)).toHaveAttribute('data-state', /^(normal|stale|alarm|comms-lost)$/, { timeout: INTERVAL_MS });
    });
});

test.describe('390 px', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test('the chip fits the phone under the top bar', async ({ page }) => {
        const map = await openMap(page, '/live');
        await mapLoaded(map);
        await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
        await page.evaluate((s) => window.__client.simulateLostConnection(s), LOST_S);
        await expect(chip(page)).toBeVisible({ timeout: 10_000 });
        const box = await chip(page).boundingBox();
        const mapBox = await map.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(mapBox.x);
        expect(box.x + box.width).toBeLessThanOrEqual(mapBox.x + mapBox.width);
        // Under the one top bar (48 px tall, 8 px from the top).
        expect(box.y).toBeGreaterThanOrEqual(mapBox.y + 56);
        await expect(map).toHaveAttribute('data-connection', 'ok', { timeout: (LOST_S + 30) * 1000 });
    });
});
