// The engineering review pack (epic 3 entry 12, R16 and R5; docs/review-er27.md): the showcase
// project (ops/showcase/project, entry 15) in its review states, rendered in the light theme (`/`) and
// the dark theme (`/dark`, a page whose view switches the session's theme at startup), so the owner's
// ER-27 review sees every glyph, alarm priority and acknowledgement state, comms lost, stale, the
// line looks per segment, instrument alarms, the Needs you bar and list, the legend's key, the point
// card, the phone bottom sheet and the custom popup view's close row, side by side in both themes.
// The review states come from the dev /styles page's showcase buttons (mapstudio_showcase_seed
// .review_states): beside the mockups' three states, CS01 priority 2, CTB1 priority 3, P12 priority 1
// acknowledged, PT-1 priority 2 and PT-2 priority 3 acknowledged; `stale` adds PT-2 comms lost. The
// contrast check (e2e/lib/contrast.mjs) reads every hue token's computed value from the page in each
// theme and fails on a state mark under 3:1 against the blank map, the panel or the light raster
// sample (WCAG 1.4.11); with E2E_DOCS=1 its table goes to docs/review-er27-contrast-<theme>.md and
// the renders to docs/screenshots/review-<theme>-*.png.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pagePixel } from '../lib/geo.mjs';
import { TOKENS, checkTheme, markdownTable, misses } from '../lib/contrast.mjs';
import { docsMode, outDir, repoRoot } from '../lib/env.mjs';
import { DRAW_MS, EDITOR_USER, expect, mapLoaded, openMap, runSeed, shot, signedInContext, test, view } from './fixtures.mjs';

/** The bound for a state change to reach the map: one refresh interval (the showcase setup's 10 s) plus margin. */
const INTERVAL_MS = 25_000;

/** The showcase field (showcase.spec.mjs has the same places). */
const SHOWCASE = {
    project: 'mapstudio-showcase',
    center: [-104.93, 39.7],
    zoom: 15,
    p14: [-104.932682, 39.697524],
    swd1: [-104.927211, 39.696120],
    phoneCenter: [-104.932682, 39.694684],
    swd1PhoneCenter: [-104.927211, 39.693280],
    between: [-104.928427, 39.697593],
    lineCenter: [-104.928427, 39.696573],
    keys: { p14: 'sites/p14', p12: 'sites/p12', p21: 'sites/p21', ctb1: 'sites/ctb1', cs01: 'sites/cs01', swd1: 'sites/swd1',
        line: 'lines/swd', pt1: 'instruments/pt1', pt2: 'instruments/pt2' }
};

/** The review states' Needs you count: six alarms (P14, CS01, CTB1, P12, PT-1, PT-2), P21 comms lost, SWD1 stale. */
const NEEDS_YOU = 'Needs you 8: 6 alarms, 1 comms lost, 1 stale';

let ids;

const bar = (page) => page.locator('.mapstudio-needs');
const liveItem = (page, id) => page.locator('.mapstudio-live-item[data-item-id="' + id + '"]');

/** Press a /styles dev button as the editor and return its result; the page is opened and closed here. */
async function pressLive(browser, button) {
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/styles'));
        const out = page.locator('#mapstudio-styles-result');
        const before = await out.innerText();
        await page.locator('#mapstudio-styles-' + button).click();
        await expect.poll(() => out.innerText(), { timeout: 60_000 }).not.toBe(before);
        const result = JSON.parse(await out.innerText());
        expect(result.error, 'the dev button ' + button).toBeUndefined();
        expect(result.refused, 'the dev button ' + button).toBeUndefined();
        return result;
    } finally {
        await context.close();
    }
}

/** Whether the component's blank-map token is a dark colour (the dark theme is on). */
async function isDark(page) {
    return page.evaluate(() => {
        const v = getComputedStyle(document.querySelector('.mapstudio')).getPropertyValue('--mapstudio-blank').trim();
        const m = /^rgb\((\d+),\s*(\d+),\s*(\d+)/.exec(v) || /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(v);
        if (!m) return null;
        const [r, g, b] = [1, 2, 3].map((i) => (v.startsWith('#') ? parseInt(m[i], 16) : Number(m[i])));
        return r + g + b < 384;
    });
}

/**
 * Open the showcase page in a theme and wait for the items, the first full batch and the labels of the
 * starting zoom. The dark page sets the session's theme as its view starts; the map then reloads so its
 * marker images are drawn from the dark tokens (the images are rasterised when the map is created).
 * `watched` is the test's warning collector (fixtures.mjs).
 */
async function openReview(page, theme, watched) {
    const pagePath = theme === 'dark' ? '/dark' : '/';
    let map = await openMap(page, pagePath, SHOWCASE.project);
    if (theme === 'dark') {
        await expect.poll(() => isDark(page), { timeout: 30_000 }).toBe(true);
        // The first load switches the theme while the map is being built: Perspective swaps the theme
        // stylesheet, and a token read in that moment is empty (the draw tool then warns once that it
        // keeps its library default, seen once in three runs). The pack renders the reload, which
        // starts dark; the warnings of the switching load are not the reload's.
        watched.warnings.length = 0;
        map = await openMap(page, pagePath, SHOWCASE.project);
        expect(await isDark(page), 'the dark theme after the reload').toBe(true);
    } else {
        expect(await isDark(page), 'the light theme').toBe(false);
    }
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
    await expect(map).toHaveAttribute('data-labels-zoom', SHOWCASE.zoom.toFixed(2), { timeout: DRAW_MS });
    return map;
}

/** The review states, from the batch. */
async function reviewStates(page) {
    await expect(bar(page)).toHaveAttribute('aria-label', NEEDS_YOU, { timeout: INTERVAL_MS });
    await expect(liveItem(page, ids.p14)).toHaveAttribute('data-alarm', '1:unacked:1');
    await expect(liveItem(page, ids.cs01)).toHaveAttribute('data-alarm', '2:unacked:1');
    await expect(liveItem(page, ids.ctb1)).toHaveAttribute('data-alarm', '3:unacked:1');
    await expect(liveItem(page, ids.p12)).toHaveAttribute('data-alarm', '1:acked:1');
    await expect(liveItem(page, ids.pt1)).toHaveAttribute('data-alarm', '2:unacked:1');
    await expect(liveItem(page, ids.pt2)).toHaveAttribute('data-alarm', '3:acked:1');
    await expect(liveItem(page, ids.p21)).toHaveAttribute('data-state', 'comms-lost');
    await expect(liveItem(page, ids.swd1)).toHaveAttribute('data-state', 'stale');
}

/** Wait until the map's labels hold every text in `texts` (names and KPIs placed after the batch). */
async function labelsPlaced(map, texts) {
    await expect.poll(async () => {
        const labels = (await map.getAttribute('data-labels')) || '';
        return texts.filter((t) => !labels.includes('"' + t + '"'));
    }, { timeout: DRAW_MS }).toEqual([]);
}

/** Click a point on a map centred on `center` at `zoom` and return its open popup (card or sheet). */
async function clickPoint(page, map, lngLat, center, zoom, selector) {
    const box = await map.boundingBox();
    const [x, y] = pagePixel(box, lngLat, center, zoom);
    await page.mouse.click(x, y);
    const popup = page.locator(selector);
    await expect(popup).toBeVisible({ timeout: 30_000 });
    return popup;
}

/**
 * The contrast check of the open page's theme: every hue token's computed value from the component
 * root, every state mark 3:1 or better on its surfaces; the table written for the docs.
 */
async function contrastCheck(page, theme) {
    const values = await page.evaluate((tokens) => {
        const cs = getComputedStyle(document.querySelector('.mapstudio'));
        return Object.fromEntries(Object.entries(tokens).map(([k, t]) => [k, cs.getPropertyValue(t).trim()]));
    }, TOKENS);
    for (const [key, value] of Object.entries(values)) {
        expect(value, 'the computed value of ' + TOKENS[key]).toMatch(/^(#[0-9a-f]{3,6}|rgba?\()/i);
    }
    const result = checkTheme(values);
    const table = markdownTable(theme, result);
    const file = docsMode ? path.join(repoRoot, 'docs', 'review-er27-contrast-' + theme + '.md') : path.join(outDir, 'contrast-' + theme + '.md');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, '<!-- Generated by e2e/tests/review.spec.mjs (E2E_DOCS=1) from the computed theme tokens of the showcase page, '
        + theme + ' theme; WCAG 2.1 contrast ratios (e2e/lib/contrast.mjs). Do not edit by hand. -->\n\n' + table + '\n');
    expect(misses(result).map((m) => m.id + ' ' + JSON.stringify(m.ratios)), theme + ' theme: state marks under 3:1').toEqual([]);
    return result;
}

test.beforeAll(async ({ browser }) => {
    // Seed the showcase map (safe to re-run), then put it in the review states.
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
        const dev = await runSeed(page);
        expect(dev.error, 'the dev seed saved').toBeUndefined();
        const seed = dev.showcase;
        expect(seed && seed.error, 'the showcase seed saved').toBeUndefined();
        expect(seed.tags.error, 'the showcase tags set').toBeUndefined();
        ids = Object.fromEntries(Object.entries(SHOWCASE.keys).map(([k, key]) => [k, seed.ids[key]]));
    } finally {
        await context.close();
    }
    const review = await pressLive(browser, 'showcase-review-alarms');
    expect(review).toMatchObject({ mode: 'alarms', raised: 5, commsOff: false });
    expect(review.acknowledged).toBeGreaterThanOrEqual(2);
});

test.afterAll(async ({ browser }) => {
    // The mockups' states back (showcase.spec.mjs seeds them again anyway).
    const off = await pressLive(browser, 'showcase-review-off');
    expect(off.mode).toBe('off');
});

for (const theme of ['light', 'dark']) {
    test.describe(theme + ' theme', () => {
        test.describe('1440 px', () => {
            test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

            test('every state on the map, the contrast check, then the Needs you list and the legend open', async ({ page, watched }) => {
                const map = await openReview(page, theme, watched);
                await expect(page.locator('button:not(.mapstudio button)')).toHaveCount(0);
                await reviewStates(page);
                await contrastCheck(page, theme);
                // Each of L-SWD's three segments graded by its end instruments: PT-1 (priority 2) over the first two, PT-2 (priority 3) on the last.
                await expect(liveItem(page, ids.line)).toHaveAttribute('data-segments', /"alarm":"2:unacked".*"alarm":"2:unacked".*"alarm":"3:acked"/, { timeout: INTERVAL_MS });
                await labelsPlaced(map, ['P14', 'P21', 'P12', 'CS01', 'CTB1', 'Comms lost', 'Stale']);
                await shot(page, 'review-' + theme + '-states-1440.png');

                await bar(page).click();
                const rows = page.locator('.mapstudio-needs-row');
                await expect(rows).toHaveCount(8);
                const states = await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-state') + '|' + el.querySelector('.mapstudio-needs-name').textContent));
                // Alarms by priority (unacknowledged before acknowledged within one), then comms lost, then stale.
                expect(states.slice(0, 2).sort()).toEqual(['alarm|P12', 'alarm|P14']);
                expect(states.slice(2, 4).sort()).toEqual(['alarm|CS01', 'alarm|PT-1']);
                expect(states.slice(4, 6).sort()).toEqual(['alarm|CTB1', 'alarm|PT-2']);
                expect(states.slice(6)).toEqual(['comms-lost|P21', 'stale|SWD1']);
                await page.locator('.mapstudio-legend-button').click();
                await expect(page.locator('.mapstudio-legend-panel')).toBeVisible();
                await expect(page.locator('.mapstudio-legend-section--states .mapstudio-legend-key-row')).toHaveCount(6);
                await expect(page.locator('.mapstudio-needs-panel')).toBeVisible();
                await shot(page, 'review-' + theme + '-needs-you-legend-1440.png');
                expect(watched.warnings, 'Map Studio warnings').toEqual([]);
            });
        });

        test.describe('1366 px', () => {
            test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });

            test('P14\'s card, SWD1\'s custom popup view with its close row, and the L-SWD popup at the alarmed segment', async ({ page, watched }) => {
                const map = await openReview(page, theme, watched);
                await reviewStates(page);
                await labelsPlaced(map, ['P14', '1240 psi', 'SWD1']);
                const card = await clickPoint(page, map, SHOWCASE.p14, SHOWCASE.center, SHOWCASE.zoom, '.maplibregl-popup .mapstudio-popup--default');
                await expect(card).toHaveAttribute('data-point-id', ids.p14);
                await expect(card.locator('.mapstudio-popup-alarm-line')).toHaveText(/^Casing pressure high - P14-2H, /, { timeout: INTERVAL_MS });
                await shot(page, 'review-' + theme + '-popup-1366.png');

                const viewPopup = await clickPoint(page, map, SHOWCASE.swd1, SHOWCASE.center, SHOWCASE.zoom, '.maplibregl-popup .mapstudio-popup--view');
                await expect(viewPopup).toHaveAttribute('data-view-path', 'Popups/SiteCard');
                await expect(page.locator('#mapstudio-sitecard-title')).toHaveText('SWD1 - site card', { timeout: 30_000 });
                await expect(page.locator('#mapstudio-sitecard-pressure')).toHaveText('Pressure: 365 psi', { timeout: 30_000 });
                const close = viewPopup.locator('.mapstudio-popup-close');
                const closeBox = await close.boundingBox();
                expect(Math.min(closeBox.width, closeBox.height)).toBeGreaterThanOrEqual(32);
                await shot(page, 'review-' + theme + '-popup-view-1366.png');
                await close.click();
                await expect(page.locator('.mapstudio-popup--view')).toHaveCount(0);

                await view(page, map, SHOWCASE.lineCenter, 16);
                await labelsPlaced(map, ['PT-1', 'PT-2']);
                const box = await map.boundingBox();
                const [x, y] = pagePixel(box, SHOWCASE.between, SHOWCASE.lineCenter, 16);
                await page.mouse.click(x, y);
                const line = page.locator('.maplibregl-popup .mapstudio-popup--line');
                await expect(line).toBeVisible({ timeout: 30_000 });
                await expect(line).toHaveAttribute('data-segment', ids.pt1 + '|' + ids.pt2);
                await expect(map).toHaveAttribute('data-highlighted', ids.pt1 + ',' + ids.pt2);
                await shot(page, 'review-' + theme + '-line-1366.png');
                expect(watched.warnings, 'Map Studio warnings').toEqual([]);
            });

            test('PT-2 comms lost: its marker and its two segments dashed, the line popup saying so', async ({ page, browser, watched }) => {
                const stale = await pressLive(browser, 'showcase-review-stale');
                expect(stale).toMatchObject({ mode: 'stale', raised: 5, commsOff: true });
                try {
                    const map = await openReview(page, theme, watched);
                    await expect(liveItem(page, ids.pt2)).toHaveAttribute('data-comms', 'lost', { timeout: INTERVAL_MS });
                    await expect(liveItem(page, ids.line)).toHaveAttribute('data-segments', /"stale":false.*"stale":true.*"stale":true/, { timeout: INTERVAL_MS });
                    await view(page, map, SHOWCASE.lineCenter, 16);
                    await labelsPlaced(map, ['PT-1', 'PT-2']);
                    const box = await map.boundingBox();
                    const [x, y] = pagePixel(box, SHOWCASE.between, SHOWCASE.lineCenter, 16);
                    await page.mouse.click(x, y);
                    const line = page.locator('.maplibregl-popup .mapstudio-popup--line');
                    await expect(line).toBeVisible({ timeout: 30_000 });
                    await expect(line).toHaveAttribute('data-segment', ids.pt1 + '|' + ids.pt2);
                    await shot(page, 'review-' + theme + '-line-stale-1366.png');
                    expect(watched.warnings, 'Map Studio warnings').toEqual([]);
                } finally {
                    const back = await pressLive(browser, 'showcase-review-alarms');
                    expect(back.mode).toBe('alarms');
                }
            });
        });

        test.describe('390 px', () => {
            test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

            test('the one top bar with the Needs you list, P14\'s bottom sheet and SWD1\'s custom view sheet with its close row', async ({ page, watched }) => {
                const map = await openReview(page, theme, watched);
                await reviewStates(page);
                await bar(page).click();
                await expect(page.locator('.mapstudio-needs-row')).toHaveCount(8);
                await shot(page, 'review-' + theme + '-needs-you-390.png');
                await page.keyboard.press('Escape');
                await expect(page.locator('.mapstudio-needs-panel')).toHaveCount(0);

                await view(page, map, SHOWCASE.phoneCenter, SHOWCASE.zoom);
                await labelsPlaced(map, ['P14']);
                const sheet = await clickPoint(page, map, SHOWCASE.p14, SHOWCASE.phoneCenter, SHOWCASE.zoom, '.mapstudio-sheet .mapstudio-popup--default');
                await expect(map).toHaveAttribute('data-popup-mode', 'sheet');
                await expect(sheet.locator('.mapstudio-popup-alarm-line')).toHaveText(/^Casing pressure high - P14-2H, /, { timeout: INTERVAL_MS });
                await shot(page, 'review-' + theme + '-sheet-390.png');
                await sheet.locator('.mapstudio-popup-close').click();
                await expect(page.locator('.mapstudio-sheet')).toHaveCount(0);

                await view(page, map, SHOWCASE.swd1PhoneCenter, SHOWCASE.zoom);
                await labelsPlaced(map, ['SWD1']);
                const viewSheet = await clickPoint(page, map, SHOWCASE.swd1, SHOWCASE.swd1PhoneCenter, SHOWCASE.zoom, '.mapstudio-sheet .mapstudio-popup--view');
                await expect(page.locator('#mapstudio-sitecard-title')).toHaveText('SWD1 - site card', { timeout: 30_000 });
                const close = viewSheet.locator('.mapstudio-popup-close');
                const closeBox = await close.boundingBox();
                expect(Math.min(closeBox.width, closeBox.height)).toBeGreaterThanOrEqual(44);
                await shot(page, 'review-' + theme + '-popup-view-sheet-390.png');
                expect(watched.warnings, 'Map Studio warnings').toEqual([]);
            });
        });
    });
}
