// The Needs you summary and the legend's key (epic 3 entry 3, R14, R15; DESIGN.md needs-you-bar and
// legend, EXPERIENCE.md Needs you bar and Legend). On the dev Gateway with the seeded kind setups
// and the tracer: Point 1 in alarm (P12 pressure 950), Point 3 comms lost (P15 has no Comms tag, the
// not-found case entry 5 left) and Point 2 stale (P14's Pressure at Bad quality, its comms fine) read
// "Needs you 3: 1 alarm, 1 comms lost, 1 stale" within one refresh interval, from the same batch the
// markers draw from; the list ranks them alarm, comms lost, stale with the state in words, detail and
// age, and a row zooms to and selects its item; the whole thing works by keyboard (Enter, arrows, Esc
// with the focus returned); at 390 px the bar shares the one top bar with search and the list expands
// inside it; with all three cleared (the alarm down and acknowledged, the quality good, Point 3
// unlinked from P15, which rebuilds the live plan) it reads "All OK" in neutral and stays. The legend
// names every glyph and line look and its Lines and Names toggles hide what they say, remembered for
// the session. Screenshots at 1440 and 390 px for the docs (AD-15). The spec links Point 3 to P15
// again when it is done, since the seed leaves an assetId alone.

import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { screenshotDir } from '../lib/env.mjs';
import { TRACER } from '../lib/geo.mjs';
import {
    EDITOR_USER, editorTest, expect, mapLoaded, nextFrames, openMap, runSeed, signedInContext, test
} from './fixtures.mjs';

/** The bound for a change to reach the map: one refresh interval (the dev setup's 10 s) plus margin. */
const INTERVAL_MS = 25_000;
/** How long a redraw or a popup after a choice may take on the dev stack. */
const DRAW_MS = 20_000;
/** Where the three tracer points are all in view at zoom 14. */
const TRACER_VIEW = { center: TRACER.center, zoom: 14 };

let ids;

const bar = (page) => page.locator('.mapstudio-needs');
const panel = (page) => page.locator('.mapstudio-needs-panel');
const rows = (page) => page.locator('.mapstudio-needs-row');
const popup = (page) => page.locator('.maplibregl-popup .mapstudio-popup--default');
const legendButton = (page) => page.locator('.mapstudio-legend-button');
const legendPanel = (page) => page.locator('.mapstudio-legend-panel');
const toggle = (page, name) => page.locator('.mapstudio-legend-toggle[data-toggle="' + name + '"]');
const liveItem = (page, id) => page.locator('.mapstudio-live-item[data-item-id="' + id + '"]');

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

async function send(page, type, body) {
    await page.waitForFunction(() => Boolean(window.__mapStudioTest));
    return page.evaluate(([t, b]) => window.__mapStudioTest.send(t, b), [type, body]);
}

/** Link a map item to an asset (or to none with null) through the component's real session path, as the editor. */
async function link(page, id, assetId) {
    const load = await send(page, 'map.load', {});
    expect(load.type).toBe('map.load.reply');
    const item = load.body.items.find((i) => i.id === id);
    expect(item, 'the item ' + id).toBeTruthy();
    if (item.assetId === assetId) {
        return;
    }
    const reply = await send(page, 'edits.apply', {
        batchId: randomUUID(), ops: [{ op: 'update', entity: 'item', id, baseVersion: item.version, data: { assetId } }]
    });
    expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
}

/** Open /live as the editor and wait for the items and the first full batch. */
async function openLive(page) {
    const map = await openMap(page, '/live');
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
    await expect(bar(page)).toBeVisible();
    return map;
}

/** Move the map (the component's e2e view hook) and wait for the labels of that zoom to be published. */
async function view(page, map, { center, zoom }) {
    await page.waitForFunction(() => Boolean(window.__mapStudioTestView));
    await page.evaluate(([c, z]) => window.__mapStudioTestView({ center: c, zoom: z }), [center, zoom]);
    await expect(map).toHaveAttribute('data-zoom', zoom.toFixed(2), { timeout: DRAW_MS });
    await expect(map).toHaveAttribute('data-labels-zoom', zoom.toFixed(2), { timeout: DRAW_MS });
    await nextFrames(page);
}

async function shot(page, name) {
    await nextFrames(page);
    mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, name), fullPage: false });
}

/** The three states: Point 1 in alarm, Point 2 stale, Point 3 comms lost (as the seed leaves it). */
async function threeStates(page) {
    await press(page, 'comms-on');
    await press(page, 'pressure-high');
    await press(page, 'p14-pressure-bad');
}

/** Everything quiet again: the alarm down and acknowledged, P14's quality good. */
async function quiet(page) {
    await press(page, 'pressure-low');
    await press(page, 'comms-on');
    await press(page, 'ack');
    await press(page, 'p14-pressure-good');
}

/** The rows as "rank|state|name|kind|words|detail". */
async function rowTexts(page) {
    return rows(page).evaluateAll((els) => els.map((el) => [el.getAttribute('data-rank'), el.getAttribute('data-state'),
        el.querySelector('.mapstudio-needs-name').textContent, el.querySelector('.mapstudio-needs-kind').textContent,
        el.querySelector('.mapstudio-needs-state').textContent,
        (el.querySelector('.mapstudio-needs-detail') || { textContent: '' }).textContent].join('|')));
}

test.beforeAll(async ({ browser }) => {
    // Seed again (not ensureSeeded's cached result): the kind setups and the tracer's asset links come
    // from the seed, and an earlier spec may have changed the pad kind setup.
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
        const seed = await runSeed(page);
        expect(seed.error, 'the seed saved').toBeUndefined();
        ids = Object.fromEntries(Object.entries(TRACER.points).map(([k, p]) => [k, seed.ids[p.key]]));
        await link(page, ids.p3, 'P15');
        await mapLoaded(await openMap(page, '/live'));
        await threeStates(page);
    } finally {
        await context.close();
    }
});

test.afterAll(async ({ browser }) => {
    // Leave the dev map as the seed made it: Point 3 linked to P15, every source quiet.
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/live'));
        await link(page, ids.p3, 'P15');
        await quiet(page);
    } finally {
        await context.close();
    }
});

editorTest.describe('1440 px', () => {
    editorTest.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

    editorTest('one alarm, one comms lost and one stale read Needs you 3, ranked in the list; a row zooms to and selects its item; by keyboard too',
        async ({ page, watched }) => {
            const map = await openLive(page);
            // The bar beside the search field: 40 px tall, 12 px after the field, in the top bar's row.
            const fieldBox = await page.locator('.mapstudio-search-field').boundingBox();
            const barBox = await bar(page).boundingBox();
            expect(Math.round(barBox.height)).toBe(40);
            expect(Math.round(barBox.x - (fieldBox.x + fieldBox.width))).toBe(12);
            expect(Math.round(barBox.y)).toBe(Math.round(fieldBox.y));
            await expect(bar(page)).toHaveAttribute('aria-expanded', 'false');
            await expect(panel(page)).toHaveCount(0);

            // The three states from the batch: the words, the glyph per count, the hidden rows agree.
            await expect(bar(page)).toHaveAttribute('aria-label', 'Needs you 3: 1 alarm, 1 comms lost, 1 stale', { timeout: INTERVAL_MS });
            await expect(bar(page)).toHaveAttribute('data-count', '3');
            await expect(bar(page)).toHaveAttribute('data-state', 'needs');
            await expect(bar(page)).toHaveText(/^Needs you 3:\s*1 alarm\s*1 comms lost\s*1 stale$/);
            await expect(bar(page).locator('.mapstudio-needs-count--alarm use')).toHaveAttribute('href', /#ms-alarm-1-unacknowledged$/);
            await expect(bar(page).locator('.mapstudio-needs-count--comms-lost use')).toHaveAttribute('href', /#ms-comms-lost$/);
            await expect(bar(page).locator('.mapstudio-needs-count--stale use')).toHaveAttribute('href', /#ms-stale$/);
            await expect(liveItem(page, ids.p1)).toHaveAttribute('data-state', 'alarm');
            await expect(liveItem(page, ids.p3)).toHaveAttribute('data-state', 'comms-lost');
            await expect(liveItem(page, ids.p2)).toHaveAttribute('data-state', 'stale');
            // The alarm count takes the priority 1 token, the comms-lost glyph its own, the words stay the text colour.
            const colors = await bar(page).evaluate((el) => {
                const root = el.closest('.mapstudio');
                const token = (name) => getComputedStyle(root).getPropertyValue(name).trim();
                return {
                    alarm: getComputedStyle(el.querySelector('.mapstudio-needs-count--alarm')).color,
                    alarmToken: token('--mapstudio-alarm-1'),
                    comms: getComputedStyle(el.querySelector('.mapstudio-needs-count--comms-lost .mapstudio-needs-glyph')).color,
                    commsToken: token('--mapstudio-comms-lost'),
                    words: getComputedStyle(el.querySelector('.mapstudio-needs-words')).color
                };
            });
            expect(colors.alarmToken).not.toBe('');
            expect(colors.commsToken).not.toBe('');
            expect(colors.alarm).not.toBe(colors.words);
            expect(colors.comms).not.toBe(colors.words);
            expect(colors.comms).not.toBe(colors.alarm);

            // A click opens the ranked list under the bar: alarm, comms lost, stale, each with the words, detail and age.
            await view(page, map, TRACER_VIEW);
            await bar(page).click();
            await expect(panel(page)).toBeVisible();
            await expect(map).toHaveAttribute('data-needs-open', 'true');
            await expect(bar(page)).toHaveAttribute('aria-expanded', 'true');
            await expect(panel(page)).toHaveAttribute('role', 'region');
            await expect(panel(page)).toHaveAttribute('aria-label', 'Needs you');
            await expect(panel(page).locator('.mapstudio-needs-note')).toHaveText('Ranked: alarms by priority, then comms lost, then stale');
            await expect(rows(page)).toHaveCount(3);
            const texts = await rowTexts(page);
            expect(texts[0]).toMatch(/^1\|alarm\|Point 1\|Well pad\|Priority 1 alarm, unacknowledged\|1 alarm - \d+ (s|min) ago$/);
            expect(texts[1]).toMatch(/^2\|comms-lost\|Point 3\|Well pad\|Comms lost\|No value yet - The tag was not found$/);
            expect(texts[2]).toMatch(/^3\|stale\|Point 2\|Well pad\|Stale value\|Pressure - last \d+ (s|min) ago$/);
            await expect(rows(page).nth(0).locator('use')).toHaveAttribute('href', /#ms-alarm-1-unacknowledged$/);
            await expect(rows(page).nth(1).locator('use')).toHaveAttribute('href', /#ms-comms-lost$/);
            await expect(rows(page).nth(2).locator('use')).toHaveAttribute('href', /#ms-stale$/);
            const panelBox = await panel(page).boundingBox();
            expect(Math.round(panelBox.width)).toBe(320);
            expect(Math.round(panelBox.x), 'the list under the bar').toBe(Math.round(barBox.x));
            expect(panelBox.y).toBeGreaterThanOrEqual(barBox.y + barBox.height);
            // The first row took the focus.
            await expect(rows(page).nth(0)).toBeFocused();
            await shot(page, 'mapstudio-needs-you-1440.png');

            // A click on the stale row: the map zooms to Point 2 at 15, selects it and opens its popup; the list closes.
            await rows(page).nth(2).click();
            await expect(panel(page)).toHaveCount(0);
            await expect(map).toHaveAttribute('data-needs-open', 'false');
            await expect(map).toHaveAttribute('data-selected', ids.p2, { timeout: DRAW_MS });
            await expect(map).toHaveAttribute('data-zoom', '15.00', { timeout: DRAW_MS });
            await expect(map).toHaveAttribute('data-center', '-104.97500,39.75000');
            await expect(popup(page)).toHaveAttribute('data-point-id', ids.p2, { timeout: DRAW_MS });
            await expect(page.locator('.mapstudio-search-status')).toHaveText('Point 2 selected');
            await expect(page.locator('.mapstudio-reply')).toContainText('Gateway received click on ' + ids.p2, { timeout: DRAW_MS });

            // By keyboard: Enter on the bar opens the list with the first row focused, the arrows move and wrap,
            // Esc closes it and returns the focus to the bar; Enter on a row chooses it.
            await bar(page).focus();
            await page.keyboard.press('Enter');
            await expect(panel(page)).toBeVisible();
            await expect(rows(page).nth(0)).toBeFocused();
            await page.keyboard.press('ArrowDown');
            await expect(rows(page).nth(1)).toBeFocused();
            await page.keyboard.press('ArrowUp');
            await page.keyboard.press('ArrowUp');
            await expect(rows(page).nth(2)).toBeFocused();
            await page.keyboard.press('Escape');
            await expect(panel(page)).toHaveCount(0);
            await expect(bar(page)).toBeFocused();
            await page.keyboard.press('Enter');
            await expect(rows(page).nth(0)).toBeFocused();
            await page.keyboard.press('Enter');
            await expect(panel(page)).toHaveCount(0);
            await expect(map).toHaveAttribute('data-selected', ids.p1, { timeout: DRAW_MS });
            await expect(map).toHaveAttribute('data-center', '-104.99030,39.73920', { timeout: DRAW_MS });
            await expect(popup(page)).toHaveAttribute('data-point-id', ids.p1, { timeout: DRAW_MS });
            // A click on the map closes an open list.
            await bar(page).click();
            await expect(panel(page)).toBeVisible();
            const box = await map.boundingBox();
            await page.mouse.click(box.x + box.width / 2, box.y + box.height - 120);
            await expect(panel(page)).toHaveCount(0);
            expect(watched.warnings, 'Map Studio warnings').toEqual([]);
        });
});

editorTest.describe('390 px', () => {
    editorTest.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

    editorTest('the top bar holds search and Needs you, the list expands inside it, the bottom-right corner is clear', async ({ page }) => {
        const map = await openLive(page);
        await expect(bar(page)).toHaveAttribute('data-count', '3', { timeout: INTERVAL_MS });
        const topbar = page.locator('.mapstudio-topbar');
        let topBox = await topbar.boundingBox();
        const fieldBox = await page.locator('.mapstudio-search-field').boundingBox();
        let barBox = await bar(page).boundingBox();
        // One bar 8 px from the edges, 48 px tall: the field then the Needs you button, side by side inside it.
        expect(Math.round(topBox.x)).toBe(8);
        expect(Math.round(topBox.width)).toBe(390 - 16);
        expect(Math.round(topBox.height)).toBe(48);
        expect(barBox.height, 'a 44 px target').toBeGreaterThanOrEqual(44);
        expect(barBox.x).toBeGreaterThanOrEqual(fieldBox.x + fieldBox.width - 1);
        expect(barBox.x + barBox.width).toBeLessThanOrEqual(topBox.x + topBox.width + 1);
        // The glyphs carry the counts on the phone; the words are the button's label.
        await expect(bar(page)).toHaveAttribute('aria-label', 'Needs you 3: 1 alarm, 1 comms lost, 1 stale');
        await expect(bar(page).locator('.mapstudio-needs-count--comms-lost .mapstudio-needs-count-word')).toBeHidden();

        // A tap expands the list inside the bar, rows at least 44 px.
        await bar(page).click();
        await expect(panel(page)).toBeVisible();
        await expect(rows(page)).toHaveCount(3);
        topBox = await topbar.boundingBox();
        const panelBox = await panel(page).boundingBox();
        expect(Math.round(panelBox.x)).toBe(Math.round(topBox.x));
        expect(Math.round(panelBox.width)).toBe(Math.round(topBox.width));
        expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(topBox.y + topBox.height + 1);
        for (const row of await rows(page).all()) {
            expect((await row.boundingBox()).height, 'a 44 px row').toBeGreaterThanOrEqual(44);
        }
        // The zoom card sits under the bar; nothing in the bottom-right corner.
        const zoomBox = await page.locator('.mapstudio-zoom').boundingBox();
        expect(zoomBox.y).toBeGreaterThanOrEqual(topBox.y + topBox.height + 8 - 1);
        await shot(page, 'mapstudio-needs-you-390.png');
        const corner = { x: 390 - 64, y: 844 - 64 };
        for (const b of [topBox, zoomBox, await legendButton(page).boundingBox()]) {
            expect(b.x + b.width > corner.x && b.y + b.height > corner.y, 'nothing in the bottom-right corner').toBe(false);
        }
        // A tap on a row chooses it; the bar is back to one line.
        await rows(page).nth(0).click();
        await expect(panel(page)).toHaveCount(0);
        await expect(map).toHaveAttribute('data-selected', ids.p1, { timeout: DRAW_MS });
        await expect(popup(page)).toHaveAttribute('data-point-id', ids.p1, { timeout: DRAW_MS });
        barBox = await bar(page).boundingBox();
        expect(Math.round((await topbar.boundingBox()).height)).toBe(48);
        // With text in the search field the results take the bar and Needs you steps aside.
        await page.locator('.mapstudio-search-input').click();
        await page.locator('.mapstudio-search-input').fill('Point');
        await expect(page.locator('.mapstudio-search-option')).toHaveCount(3);
        await expect(bar(page)).toBeHidden();
        await page.keyboard.press('Escape');
        await expect(bar(page)).toBeVisible();
    });
});

editorTest.describe('1440 px, all cleared', () => {
    editorTest.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

    editorTest('with nothing to attend to the bar reads All OK in neutral and stays; the legend names every glyph and line look and its toggles work, remembered for the session',
        async ({ page, watched }) => {
            const map = await openLive(page);
            await expect(bar(page)).toHaveAttribute('data-count', '3', { timeout: INTERVAL_MS });
            // The alarm down and acknowledged, P14's quality good: Points 1 and 2 go; Point 3 stays comms lost until it is unlinked.
            await quiet(page);
            await expect(bar(page)).toHaveAttribute('aria-label', 'Needs you 1: 1 comms lost', { timeout: INTERVAL_MS });
            await link(page, ids.p3, null);
            await expect(bar(page)).toHaveAttribute('data-state', 'ok', { timeout: INTERVAL_MS });
            await expect(bar(page)).toHaveText('All OK');
            await expect(bar(page)).toHaveAttribute('data-count', '0');
            await expect(bar(page)).toBeVisible();
            // Neutral: the words take the secondary text token, not an alarm or comms-lost hue.
            const ok = await bar(page).evaluate((el) => {
                const root = el.closest('.mapstudio');
                const words = getComputedStyle(el.querySelector('.mapstudio-needs-words')).color;
                const probe = document.createElement('span');
                probe.style.color = 'var(--label--disabled)';
                root.appendChild(probe);
                const neutral = getComputedStyle(probe).color;
                probe.remove();
                return { words, neutral };
            });
            expect(ok.words).toBe(ok.neutral);
            await bar(page).click();
            await expect(panel(page).locator('.mapstudio-needs-note')).toHaveText('Nothing needs you');
            await expect(rows(page)).toHaveCount(0);
            await page.keyboard.press('Escape');
            await expect(panel(page)).toHaveCount(0);
            await expect(bar(page)).toBeFocused();
            await shot(page, 'mapstudio-needs-you-ok-1440.png');

            // The legend's key: the kinds on the map, the states, the lines, the pad's styles, the geofence's tints, Show, Basemap.
            await view(page, map, TRACER_VIEW);
            await legendButton(page).focus();
            await page.keyboard.press('Enter');
            await expect(legendPanel(page)).toBeVisible();
            await expect(toggle(page, 'lines')).toBeFocused();
            expect(await legendPanel(page).locator('.mapstudio-legend-heading').allTextContents())
                .toEqual(['Kinds', 'States', 'Lines', 'Styles', 'Areas', 'Show', 'Basemap']);
            expect(await legendPanel(page).locator('.mapstudio-legend-kind .mapstudio-legend-key-words').allTextContents())
                .toEqual(['Well pad', 'Gathering line', 'Geofence']);
            expect(await legendPanel(page).locator('.mapstudio-legend-state .mapstudio-legend-key-words').allTextContents())
                .toEqual(['Priority 1 alarm, digit beside', 'Priority 2 alarm', 'Priority 3 alarm', 'Acknowledged', 'Comms lost', 'Stale value']);
            expect(await legendPanel(page).locator('.mapstudio-legend-line .mapstudio-legend-key-words').allTextContents())
                .toEqual(['Pipeline, weight by size', 'Thin: no instruments', 'Dashed: no data or comms lost', 'Hue: the highest alarm']);
            expect(await legendPanel(page).locator('.mapstudio-legend-style .mapstudio-legend-key-words').allTextContents())
                .toEqual(['Attention', 'Warning', 'Fault', 'Out of service']);
            expect(await legendPanel(page).locator('.mapstudio-legend-tint .mapstudio-legend-key-words').allTextContents())
                .toEqual(['North', 'South', 'No category']);
            await expect(legendPanel(page).locator('.mapstudio-legend-note')).toHaveText('Below zoom 14 sites show as dots');
            await expect(legendPanel(page).locator('.mapstudio-legend-kind[data-kind="pad"] use')).toHaveAttribute('href', /#ms-well-pad$/);
            await expect(legendPanel(page).locator('.mapstudio-legend-state[data-glyph="comms-lost"] use')).toHaveAttribute('href', /#ms-comms-lost$/);
            // The samples take the tokens: the priority 1 badge the alarm-1 token, the comms-lost ring its own, no literal.
            const sampleColors = await legendPanel(page).evaluate((el) => ({
                p1: getComputedStyle(el.querySelector('.mapstudio-legend-state[data-glyph="alarm-1-unacknowledged"] .mapstudio-legend-sample')).color,
                comms: getComputedStyle(el.querySelector('.mapstudio-legend-state[data-glyph="comms-lost"] .mapstudio-legend-sample')).color,
                stale: getComputedStyle(el.querySelector('.mapstudio-legend-state[data-glyph="stale"] .mapstudio-legend-sample')).color,
                words: getComputedStyle(el.querySelector('.mapstudio-legend-key-words')).color
            }));
            expect(sampleColors.p1).not.toBe(sampleColors.words);
            expect(sampleColors.comms).not.toBe(sampleColors.words);
            expect(sampleColors.comms).not.toBe(sampleColors.p1);
            expect(sampleColors.stale, 'stale takes no hue').toBe(sampleColors.words);
            await expect(map).toHaveAttribute('data-lines', 'on');
            await expect(map).toHaveAttribute('data-names', 'on');
            await shot(page, 'mapstudio-legend-1440.png');

            // Lines off hides every line and the arrow; Names off hides the names and keeps the markers.
            await expect(map).toHaveAttribute('data-lines-drawn', /^[1-9][0-9]*$/);
            await toggle(page, 'lines').click();
            await expect(map).toHaveAttribute('data-lines', 'off');
            await expect.poll(() => map.getAttribute('data-lines-drawn'), { timeout: DRAW_MS }).toBe('0');
            await toggle(page, 'lines').click();
            await expect(map).toHaveAttribute('data-lines', 'on');
            await expect.poll(() => map.getAttribute('data-lines-drawn'), { timeout: DRAW_MS }).not.toBe('0');
            await expect(map).toHaveAttribute('data-names-shown', /^[1-9][0-9]*$/, { timeout: DRAW_MS });
            await toggle(page, 'names').click();
            await expect(map).toHaveAttribute('data-names', 'off');
            await expect.poll(() => map.getAttribute('data-names-shown'), { timeout: DRAW_MS }).toBe('0');
            // Esc closes the panel and the Legend button has the focus; the toggle is remembered for the session.
            await page.keyboard.press('Escape');
            await expect(legendPanel(page)).toHaveCount(0);
            await expect(legendButton(page)).toBeFocused();
            await page.reload();
            await openLive(page);
            await expect(map).toHaveAttribute('data-names', 'off');
            await expect(map).toHaveAttribute('data-lines', 'on');
            await legendButton(page).click();
            await expect(toggle(page, 'names')).not.toBeChecked();
            await expect(toggle(page, 'lines')).toBeChecked();
            await toggle(page, 'names').click();
            await expect(map).toHaveAttribute('data-names', 'on');
            // A new browser session starts with both on.
            const fresh = await page.context().browser().newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
                storageState: { cookies: [], origins: [] } });
            try {
                const viewer = await fresh.newPage();
                const viewerMap = await openMap(viewer, '/live');
                await mapLoaded(viewerMap);
                await expect(viewerMap).toHaveAttribute('data-lines', 'on');
                await expect(viewerMap).toHaveAttribute('data-names', 'on');
                // A viewer gets the summary too (level none, no tag path): All OK while everything is quiet.
                await expect(viewer.locator('.mapstudio-needs')).toHaveAttribute('data-state', 'ok', { timeout: 30_000 });
            } finally {
                await fresh.close();
            }
            expect(watched.warnings, 'Map Studio warnings').toEqual([]);
        });
});
