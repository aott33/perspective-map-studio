// The owner's re-test of 0.3.0 (docs/test-retest-0.3.0.md; the findings R1 to R7 in
// _bmad-output/backlog/story-owner-review-notes-on-the-0-3-0-map.md, "Re-test findings"), on the showcase
// project (ops/showcase/project) seeded by the dev /edit page: R1 the Needs you bar keeps its nodes when a popup
// opens and closes; R2 the controls stack above an open card that the map carries under them; R3 the legend
// panel takes the search field's width on a desktop; R4 (a) the map keeps its place (camera, selection, open
// card) through View alarms and the browser's back; R6 an open top-bar list joins its field or bar with square
// corners; R7 a custom popup view under the close row is sized to its content, with no needless scroll bar.
// With E2E_DOCS=1 the shots the docs name go to docs/screenshots/retest-*.png.

import { centerFor } from '../lib/geo.mjs';
import {
    DRAW_MS, EDITOR_USER, expect, mapLoaded, openMap, runSeed, shot, signedInContext, test, view, liveItem, bar, clickPoint, INTERVAL_MS
} from './fixtures.mjs';

/** The showcase field (showcase.spec.mjs and review.spec.mjs have the same places). */
const SHOWCASE = {
    project: 'mapstudio-showcase',
    center: [-104.93, 39.7],
    zoom: 15,
    p14: [-104.932682, 39.697524],
    swd1: [-104.927211, 39.696120],
    swd1PhoneCenter: [-104.927211, 39.693280],
    keys: { p14: 'sites/p14', p21: 'sites/p21', swd1: 'sites/swd1' }
};

let ids;

const card = (page) => page.locator('.maplibregl-popup .mapstudio-popup');

/** Open the showcase page and wait for the items, the first full batch and the three seeded states. */
async function openShowcase(page, pagePath = '/') {
    const map = await openMap(page, pagePath, SHOWCASE.project);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
    await expect(bar(page)).toHaveAttribute('aria-label', 'Needs you 3: 1 alarm, 1 comms lost, 1 stale', { timeout: INTERVAL_MS });
    await expect(liveItem(page, ids.swd1)).toHaveAttribute('data-state', 'stale');
    return map;
}

/** The element drawn on top at the centre of `locator`'s box, described by the nearest of `classes` it is inside. */
async function onTopAt(page, locator, classes) {
    const b = await locator.boundingBox();
    return page.evaluate(([x, y, names]) => {
        const el = document.elementFromPoint(x, y);
        for (const name of names) {
            if (el && el.closest('.' + name)) {
                return name;
            }
        }
        return el ? el.className : null;
    }, [b.x + b.width / 2, b.y + b.height / 2, classes]);
}

/**
 * R4 (a)'s diagnostics (the flaky-test fix, 2026-11-08; the cause of its one failure is unproven): every
 * `[MapStudio]` console line about a selection, a popup or the map's place coming back, and each `selectedItem` the Gateway's `session-init`
 * holds once `armed()` is true (after the reload), attached to the test only when it fails.
 */
function selectionTrace(page, armed) {
    const lines = [];
    const inits = [];
    const t0 = Date.now();
    page.on('console', (msg) => {
        const text = msg.text();
        if (text.startsWith('[MapStudio]') && /select|popup|place came back/i.test(text)) {
            lines.push(`${Date.now() - t0} ms ${msg.type()}: ${text}`);
        }
    });
    page.on('websocket', (ws) => {
        ws.on('framereceived', ({ payload }) => {
            const text = typeof payload === 'string' ? payload : payload.toString('utf8');
            if (!armed() || !text.startsWith('session-init:')) {
                return;
            }
            const found = [];
            const walk = (node, path) => {
                if (node === null || typeof node !== 'object') {
                    return;
                }
                for (const [key, value] of Object.entries(node)) {
                    if (key === 'selectedItem') {
                        found.push({ path: path.concat(key).join('.'), value });
                    } else {
                        walk(value, path.concat(key));
                    }
                }
            };
            try {
                walk(JSON.parse(text.slice('session-init:'.length)), []);
            } catch (err) {
                found.push({ error: String(err) });
            }
            inits.push({ at: `${Date.now() - t0} ms`, selectedItem: found });
        });
    });
    return {
        attach: async () => {
            await test.info().attach('R4 (a) session-init selectedItem after the reload', {
                body: JSON.stringify(inits, null, 2), contentType: 'application/json'
            });
            await test.info().attach('R4 (a) [MapStudio] selection, popup and place console lines', {
                body: lines.join('\n') || '(none)', contentType: 'text/plain'
            });
        }
    };
}

const radii = (locator) => locator.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { tl: cs.borderTopLeftRadius, tr: cs.borderTopRightRadius, bl: cs.borderBottomLeftRadius, br: cs.borderBottomRightRadius };
});

test.beforeAll(async ({ browser }) => {
    // Seed the showcase map as the editor from the dev project's /edit page (it seeds both maps; safe to re-run).
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
        const dev = await runSeed(page);
        expect(dev.error, 'the dev seed saved').toBeUndefined();
        expect(dev.showcase && dev.showcase.error, 'the showcase seed saved').toBeUndefined();
        ids = Object.fromEntries(Object.entries(SHOWCASE.keys).map(([k, key]) => [k, dev.showcase.ids[key]]));
    } finally {
        await context.close();
    }
});

test.describe('1440 px', () => {
    test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

    test('R1: opening and closing a popup leaves the Needs you bar\'s nodes in place (no flash)', async ({ page, watched }) => {
        const map = await openShowcase(page);
        // Keep a handle on every node of the bar as it is drawn now.
        await page.evaluate(() => {
            window.__r1Nodes = Array.from(document.querySelector('.mapstudio-needs').querySelectorAll('*'));
        });
        const kept = () => page.evaluate(() => {
            const now = Array.from(document.querySelector('.mapstudio-needs').querySelectorAll('*'));
            return { connected: window.__r1Nodes.every((n) => n.isConnected), same: now.length === window.__r1Nodes.length
                && now.every((n, i) => n === window.__r1Nodes[i]) };
        });
        const popup = await clickPoint(page, map, SHOWCASE.p14, SHOWCASE.center, SHOWCASE.zoom, '.maplibregl-popup .mapstudio-popup--default');
        await expect(popup).toHaveAttribute('data-point-id', ids.p14);
        await expect(map).toHaveAttribute('data-selected', ids.p14);
        expect(await kept(), 'the bar after the popup opened').toEqual({ connected: true, same: true });
        await popup.locator('.mapstudio-popup-close').click();
        await expect(card(page)).toHaveCount(0);
        await expect(map).toHaveAttribute('data-selected', '');
        expect(await kept(), 'the bar after the popup closed').toEqual({ connected: true, same: true });
        // A changed count still redraws the bar: the label is the counts' words (unit tested in needsyou.test.ts).
        await expect(bar(page)).toHaveAttribute('aria-label', 'Needs you 3: 1 alarm, 1 comms lost, 1 stale');
        expect(watched.warnings, 'Map Studio warnings').toEqual([]);
    });

    test('R2: an open card the map carries under the top bar and the zoom card slides under them; every control corner stacks above the popup layer',
        async ({ page, watched }) => {
            const map = await openShowcase(page);
            const popup = await clickPoint(page, map, SHOWCASE.p14, SHOWCASE.center, SHOWCASE.zoom, '.maplibregl-popup .mapstudio-popup--default');
            await expect(popup).toHaveAttribute('data-point-id', ids.p14);
            const box = await map.boundingBox();
            const field = page.locator('.mapstudio-search-field');
            const zoom = page.locator('.mapstudio-zoom');
            // Pan so P14 sits under the search field: its card (above the point) now covers the top bar's place.
            const fieldBox = await field.boundingBox();
            await view(page, map, centerFor(box, SHOWCASE.p14, [fieldBox.x + fieldBox.width / 2, 200], SHOWCASE.zoom), SHOWCASE.zoom);
            const cardBox = await page.locator('.maplibregl-popup-content').boundingBox();
            expect(cardBox.y, 'the card reaches over the top bar').toBeLessThan(fieldBox.y + fieldBox.height / 2);
            expect(await onTopAt(page, field, ['mapstudio-topbar', 'maplibregl-popup']), 'on top at the search field').toBe('mapstudio-topbar');
            await shot(page, 'retest-card-under-top-bar-1440.png');
            // Pan so P14 sits under the zoom card: the card slides under it too.
            const zoomBox = await zoom.boundingBox();
            await view(page, map, centerFor(box, SHOWCASE.p14, [zoomBox.x + zoomBox.width / 2, zoomBox.y + zoomBox.height + 90], SHOWCASE.zoom), SHOWCASE.zoom);
            expect(await onTopAt(page, zoom, ['mapstudio-zoom', 'maplibregl-popup']), 'on top at the zoom card').toBe('mapstudio-zoom');
            // The legend row and the attribution corner stack above the popup layer as well.
            const z = await page.evaluate(() => {
                const of = (sel) => Number(getComputedStyle(document.querySelector(sel)).zIndex);
                return { popup: of('.maplibregl-popup'), corners: ['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((c) => of('.maplibregl-ctrl-' + c)) };
            });
            for (const corner of z.corners) {
                expect(corner, 'a control corner above the popup layer').toBeGreaterThan(z.popup);
            }
            await expect(popup).toBeVisible();
            expect(watched.warnings, 'Map Studio warnings').toEqual([]);
        });

    test('R3: the legend panel is as wide as the search field and its state rows keep to one line', async ({ page, watched }) => {
        await openShowcase(page);
        await page.locator('.mapstudio-legend-button').click();
        const panel = page.locator('.mapstudio-legend-panel');
        await expect(panel).toBeVisible();
        const fieldBox = await page.locator('.mapstudio-search-field').boundingBox();
        const panelBox = await panel.boundingBox();
        expect(Math.round(panelBox.width), 'the search field\'s width').toBe(Math.round(fieldBox.width));
        expect(panelBox.x + panelBox.width, 'never wider than the map less the zoom card').toBeLessThanOrEqual((await page.locator('.mapstudio-zoom').boundingBox()).x);
        // "Priority 1 alarm, digit beside" and "Acknowledged: outlined, with "!"" wrapped at 208 px; one line each now.
        const heights = await panel.locator('.mapstudio-legend-state').evaluateAll((els) => els.map((el) => [el.textContent, el.getBoundingClientRect().height]));
        expect(heights.length).toBe(6);
        for (const [text, h] of heights) {
            expect(h, text + ' on one line').toBeLessThanOrEqual(26);
        }
        await shot(page, 'retest-legend-1440.png');
        expect(watched.warnings, 'Map Studio warnings').toEqual([]);
    });

    test('R6: the search list and the Needs you list join their field and bar with square corners; closed, they round again', async ({ page, watched }) => {
        await openShowcase(page);
        const field = page.locator('.mapstudio-search-field');
        const round = { tl: '10px', tr: '10px', bl: '10px', br: '10px' };
        expect(await radii(field)).toEqual(round);
        expect(await radii(bar(page))).toEqual(round);
        // The search's A to Z list.
        await page.locator('.mapstudio-search-chevron').click();
        const searchPanel = page.locator('.mapstudio-search-panel');
        await expect(searchPanel).toBeVisible();
        expect(await radii(field), 'the field, its list open').toEqual({ tl: '10px', tr: '10px', bl: '0px', br: '0px' });
        const fieldBox = await field.boundingBox();
        let panelBox = await searchPanel.boundingBox();
        expect(Math.abs(panelBox.y - (fieldBox.y + fieldBox.height)), 'the list meets the field').toBeLessThanOrEqual(1);
        expect(await radii(searchPanel)).toEqual({ tl: '0px', tr: '0px', bl: '10px', br: '10px' });
        await shot(page, 'retest-search-open-1440.png');
        await page.keyboard.press('Escape');
        await expect(searchPanel).toHaveCount(0);
        expect(await radii(field), 'the field, its list closed').toEqual(round);
        // The Needs you list.
        await bar(page).click();
        const needsPanel = page.locator('.mapstudio-needs-panel');
        await expect(needsPanel).toBeVisible();
        expect(await radii(bar(page)), 'the bar, its list open').toEqual({ tl: '10px', tr: '10px', bl: '0px', br: '0px' });
        const barBox = await bar(page).boundingBox();
        panelBox = await needsPanel.boundingBox();
        expect(Math.abs(panelBox.y - (barBox.y + barBox.height)), 'the list meets the bar').toBeLessThanOrEqual(1);
        expect(Math.round(panelBox.x), 'under the bar').toBe(Math.round(barBox.x));
        expect((await radii(needsPanel)).tl, 'square where it meets the bar').toBe('0px');
        await shot(page, 'retest-needs-open-1440.png');
        await page.keyboard.press('Escape');
        await expect(needsPanel).toHaveCount(0);
        expect(await radii(bar(page)), 'the bar, its list closed').toEqual(round);
        expect(watched.warnings, 'Map Studio warnings').toEqual([]);
    });
});

test.describe('1366 px', () => {
    test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });

    test('R4 (a): View alarms and the browser\'s back bring the map back where it was, P14\'s card open; a new session opens on the starting area',
        async ({ page, browser, watched }) => {
            let reloaded = false;
            const trace = selectionTrace(page, () => reloaded);
            const map = await openShowcase(page);
            // The page's own starting area the first time.
            await expect(map).toHaveAttribute('data-zoom', SHOWCASE.zoom.toFixed(2));
            // Somewhere else: zoom 16 with P14 left of the centre, then P14's card.
            const center = [-104.9305, 39.6985];
            await view(page, map, center, 16);
            const popup = await clickPoint(page, map, SHOWCASE.p14, center, 16, '.maplibregl-popup .mapstudio-popup--default');
            await expect(popup).toHaveAttribute('data-point-id', ids.p14);
            await expect(popup.locator('[data-part="footer"] .mapstudio-popup-view-alarms')).toBeVisible({ timeout: INTERVAL_MS });
            await page.waitForTimeout(600);
            const before = { center: await map.getAttribute('data-center'), zoom: await map.getAttribute('data-zoom') };
            expect(before.zoom).toBe('16.00');
            // View alarms opens the alarm page; the browser's back returns to the map.
            await popup.locator('[data-part="footer"] .mapstudio-popup-view-alarms').click();
            await expect(page).toHaveURL(/\/alarms\//, { timeout: 30_000 });
            await expect(page.locator('.mapstudio-map')).toHaveCount(0);
            await page.goBack();
            const back = page.locator('.mapstudio-map');
            await expect(back).toHaveAttribute('data-map-ready', 'true', { timeout: 60_000 });
            await expect(back).toHaveAttribute('data-zoom', '16.00', { timeout: DRAW_MS });
            const [lng, lat] = (await back.getAttribute('data-center')).split(',').map(Number);
            const [lng0, lat0] = before.center.split(',').map(Number);
            expect(Math.abs(lng - lng0), 'the same centre (longitude)').toBeLessThan(2e-4);
            expect(Math.abs(lat - lat0), 'the same centre (latitude)').toBeLessThan(2e-4);
            await expect(back).toHaveAttribute('data-selected', ids.p14, { timeout: 30_000 });
            const again = page.locator('.maplibregl-popup .mapstudio-popup--default');
            await expect(again).toBeVisible({ timeout: 30_000 });
            await expect(again).toHaveAttribute('data-point-id', ids.p14);
            await shot(page, 'retest-place-kept-1366.png');
            // Closed, the card stays closed on the next return; a new browser session opens on the starting area.
            try {
                await again.locator('.mapstudio-popup-close').click();
                await expect(card(page)).toHaveCount(0);
                reloaded = true;
                await page.reload();
                const afterReload = page.locator('.mapstudio-map');
                await expect(afterReload).toHaveAttribute('data-map-ready', 'true', { timeout: 60_000 });
                await expect(afterReload).toHaveAttribute('data-zoom', '16.00');
                await expect(afterReload).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
                await page.waitForTimeout(1000);
                await expect(card(page)).toHaveCount(0);
            } catch (err) {
                // The next failure names its cause: what the Gateway handed the reloaded page, and what the map did with it.
                await trace.attach();
                throw err;
            }
            const fresh = await browser.newContext({ viewport: { width: 1366, height: 768 } });
            try {
                const other = await fresh.newPage();
                const otherMap = await openMap(other, '/', SHOWCASE.project);
                await expect(otherMap).toHaveAttribute('data-zoom', SHOWCASE.zoom.toFixed(2));
                await expect(otherMap).toHaveAttribute('data-selected', '');
            } finally {
                await fresh.close();
            }
            expect(watched.warnings, 'Map Studio warnings').toEqual([]);
        });

    test('R7: SWD1\'s custom popup view starts below the close row at its content\'s height, with no scroll bar', async ({ page, watched }) => {
        const map = await openShowcase(page);
        const popup = await clickPoint(page, map, SHOWCASE.swd1, SHOWCASE.center, SHOWCASE.zoom, '.maplibregl-popup .mapstudio-popup--view');
        await expect(popup).toHaveAttribute('data-view-path', 'Popups/SiteCard');
        await expect(page.locator('#mapstudio-sitecard-pressure')).toHaveText('Pressure: 365 psi', { timeout: 30_000 });
        await expectViewFits(page, popup);
        await shot(page, 'retest-popup-view-1366.png');
        expect(watched.warnings, 'Map Studio warnings').toEqual([]);
    });
});

/** The custom view under the close row: nothing scrolls, the first line below the row and inside the area. */
async function expectViewFits(page, popup) {
    const m = await popup.evaluate((el) => {
        const body = el.querySelector('.mapstudio-popup-view-body');
        const root = body.firstElementChild;
        const row = el.querySelector('.mapstudio-popup-view-bar').getBoundingClientRect();
        const title = document.querySelector('#mapstudio-sitecard-title').getBoundingClientRect();
        const area = body.getBoundingClientRect();
        return { body: [body.scrollHeight, body.clientHeight], root: [root.scrollHeight, root.clientHeight],
            rowBottom: row.bottom, titleTop: title.top, areaTop: area.top, areaBottom: area.bottom, titleBottom: title.bottom };
    });
    expect(m.body[0], 'the area under the close row does not scroll').toBeLessThanOrEqual(m.body[1] + 1);
    expect(m.root[0], 'the view itself does not scroll').toBeLessThanOrEqual(m.root[1] + 1);
    expect(m.areaTop, 'the view starts below the close row').toBeGreaterThanOrEqual(m.rowBottom - 0.5);
    expect(m.titleTop, 'the first line is inside the area').toBeGreaterThanOrEqual(m.areaTop - 0.5);
    expect(m.titleBottom).toBeLessThanOrEqual(m.areaBottom + 0.5);
}

test.describe('390 px', () => {
    test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

    test('R6 at phone width: the open Needs you list leaves no rounded corner on the bar or the field; closed, the bar\'s corners round again',
        async ({ page, watched }) => {
            await openShowcase(page);
            const field = page.locator('.mapstudio-search-field');
            expect((await radii(bar(page))).br, 'the bar closed').toBe('10px');
            await bar(page).click();
            await expect(page.locator('.mapstudio-needs-panel')).toBeVisible();
            // The open bar's grey (its hover) with a square bottom-right corner over the list.
            await bar(page).hover();
            const open = await radii(bar(page));
            expect([open.bl, open.br], 'the bar, its list open').toEqual(['0px', '0px']);
            const f = await radii(field);
            expect([f.bl, f.br], 'the field, a list open').toEqual(['0px', '0px']);
            await shot(page, 'retest-needs-open-390.png');
            await page.keyboard.press('Escape');
            await expect(page.locator('.mapstudio-needs-panel')).toHaveCount(0);
            expect((await radii(bar(page))).br, 'the bar closed again').toBe('10px');
            expect((await radii(field)).bl, 'the field closed again').toBe('10px');
            expect(watched.warnings, 'Map Studio warnings').toEqual([]);
        });

    test('R7 on the phone sheet: SWD1\'s custom view at its content\'s height under the close row, no scroll bar', async ({ page, watched }) => {
        const map = await openShowcase(page);
        await view(page, map, SHOWCASE.swd1PhoneCenter, SHOWCASE.zoom);
        const sheet = await clickPoint(page, map, SHOWCASE.swd1, SHOWCASE.swd1PhoneCenter, SHOWCASE.zoom, '.mapstudio-sheet .mapstudio-popup--view');
        await expect(page.locator('#mapstudio-sitecard-pressure')).toHaveText('Pressure: 365 psi', { timeout: 30_000 });
        await expectViewFits(page, sheet);
        await shot(page, 'retest-popup-view-sheet-390.png');
        expect(watched.warnings, 'Map Studio warnings').toEqual([]);
    });
});
