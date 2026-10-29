// The showcase page (epic 3 entry 15): the mapstudio-showcase project (ops/showcase/project) shows the
// Map Studio component alone, with no test control or readout, on a Mesa-like demo field seeded with
// the UX mockups' names, kinds, places and states by the dev project's /edit page ("Seed the dev map"
// seeds it too, project library mapstudio_showcase_seed). This spec seeds it, then renders the same five views
// as the mockups in _bmad-output/initiative-flowmap/ux-map-studio/mockups/ for the UX comparison
// (ux-map-studio/review-showcase-vs-mockups.md) and the docs: view mode at 1440 px (view-mode-1440.png),
// the Needs you list and the legend open (view-mode-needs-you-1440.png), P14's popup at 1366 px
// (key-screen-1-view-desktop-popup.png), the L-SWD line popup at zoom 16 (key-screen-3-line-instruments-
// live.png) and P14's bottom sheet on a 390 px phone (key-screen-2-phone-sheet.png). With E2E_DOCS=1
// the shots go to docs/screenshots/showcase-*.png; scripts/showcase-compare.mjs composes them beside
// the mockups.

import { pagePixel } from '../lib/geo.mjs';
import { DRAW_MS, EDITOR_USER, expect, mapLoaded, openMap, runSeed, shot, signedInContext, test, view } from './fixtures.mjs';

/** The bound for the seeded states to reach the map: one refresh interval (the showcase setup's 10 s) plus margin. */
const INTERVAL_MS = 25_000;

/**
 * The showcase project and its field (mapstudio_showcase_seed): the page's starting area, P14's place,
 * the point on L-SWD between PT-1 and PT-2 (260 m along it, clear of LV-1 at 313 m), the view centres
 * that frame each mockup (the phone puts P14 172 px above the centre, as key-screen-2 does; the line
 * view at zoom 16 puts the clicked point 120 px above the centre so the popup opens above it), and
 * the seed keys of the items the renders name.
 */
const SHOWCASE = {
    project: 'mapstudio-showcase',
    center: [-104.93, 39.7],
    zoom: 15,
    p14: [-104.932682, 39.697524],
    phoneCenter: [-104.932682, 39.694684],
    between: [-104.928427, 39.697593],
    lineCenter: [-104.928427, 39.696573],
    keys: { p14: 'sites/p14', p21: 'sites/p21', swd1: 'sites/swd1', line: 'lines/swd', pt1: 'instruments/pt1', pt2: 'instruments/pt2' }
};

let ids;

const bar = (page) => page.locator('.mapstudio-needs');
const liveItem = (page, id) => page.locator('.mapstudio-live-item[data-item-id="' + id + '"]');

/** Open the showcase page and wait for the items, the first full batch and the labels of the starting zoom. */
async function openShowcase(page) {
    const map = await openMap(page, '/', SHOWCASE.project);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
    await expect(map).toHaveAttribute('data-labels-zoom', SHOWCASE.zoom.toFixed(2), { timeout: DRAW_MS });
    return map;
}

/** The three seeded states, from the batch: P14 in alarm, P21 comms lost, SWD1 stale, and the bar's count. */
async function threeStates(page) {
    await expect(bar(page)).toHaveAttribute('aria-label', 'Needs you 3: 1 alarm, 1 comms lost, 1 stale', { timeout: INTERVAL_MS });
    await expect(liveItem(page, ids.p14)).toHaveAttribute('data-state', 'alarm');
    await expect(liveItem(page, ids.p21)).toHaveAttribute('data-state', 'comms-lost');
    await expect(liveItem(page, ids.swd1)).toHaveAttribute('data-state', 'stale');
}

/**
 * Wait until the map's labels of the current view hold every text in `texts` (the names and icon KPIs,
 * published on MapLibre's idle after a batch changed a marker), so a shot shows the labels settled.
 */
async function labelsPlaced(map, texts) {
    await expect.poll(async () => {
        const labels = (await map.getAttribute('data-labels')) || '';
        return texts.filter((t) => !labels.includes('"' + t + '"'));
    }, { timeout: DRAW_MS }).toEqual([]);
}

/** No dev control or readout on the page: the component alone fills the view. */
async function componentAlone(page, map) {
    await expect(page.locator('button:not(.mapstudio button)')).toHaveCount(0);
    await expect(page.locator('#mapstudio-dev-user, #mapstudio-live-result, #mapstudio-dev-seed-result')).toHaveCount(0);
    const box = await map.boundingBox();
    const size = page.viewportSize();
    expect(Math.round(box.width)).toBe(size.width);
    expect(Math.round(box.height)).toBe(size.height);
}

/** Click P14 on a map centred on `center` at `zoom` and return its open default popup (card or sheet). */
async function clickP14(page, map, center, zoom) {
    const box = await map.boundingBox();
    const [x, y] = pagePixel(box, SHOWCASE.p14, center, zoom);
    await page.mouse.click(x, y);
    const popup = page.locator('.maplibregl-popup .mapstudio-popup--default, .mapstudio-sheet .mapstudio-popup--default');
    await expect(popup).toBeVisible({ timeout: 30_000 });
    await expect(popup).toHaveAttribute('data-point-id', ids.p14);
    await expect(popup.locator('.mapstudio-popup-alarm-line')).toHaveText(/^Casing pressure high - P14-2H, /, { timeout: INTERVAL_MS });
    return popup;
}

test.beforeAll(async ({ browser }) => {
    // Seed the showcase map as the editor from the dev project's /edit page (the dev seed's button seeds
    // both maps): the items, the kind setups and the demo tags' states; safe to re-run, so a used stack
    // gets the mockups' states back.
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
        const dev = await runSeed(page);
        expect(dev.error, 'the dev seed saved').toBeUndefined();
        const seed = dev.showcase;
        expect(seed, 'the showcase seed ran').toBeTruthy();
        expect(seed.error, 'the showcase seed saved').toBeUndefined();
        expect(seed.tags.error, 'the showcase tags set').toBeUndefined();
        expect(seed.tags.written).toBe(33);
        ids = Object.fromEntries(Object.entries(SHOWCASE.keys).map(([k, key]) => [k, seed.ids[key]]));
    } finally {
        await context.close();
    }
});

test.describe('1440 px', () => {
    test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

    test('view mode: the demo field at zoom 15 with P14 in alarm, P21 comms lost and SWD1 stale; the Needs you list and the legend open',
        async ({ page, watched }) => {
            const map = await openShowcase(page);
            await componentAlone(page, map);
            await expect(map).toHaveAttribute('data-zoom', '15.00');
            await threeStates(page);
            // The pipeline's segments from the taps: PT-1 to PT-2 normal, nothing stale on the line.
            await expect(liveItem(page, ids.line)).toHaveAttribute('data-segments', /"from":"[^"]+","to":"[^"]+"/, { timeout: INTERVAL_MS });
            // Not L-SWD's chip: at zoom 15 it gives way to PT-1's name (the names layer is placed first; punch list item 42).
            await labelsPlaced(map, ['P14', '1240 psi', 'SWD1', '365 psi', 'Comms lost', 'Stale']);
            await shot(page, 'showcase-view-mode-1440.png');

            // The ranked list under the bar and the legend panel, both open, as view-mode-needs-you-1440.png shows.
            await bar(page).click();
            const rows = page.locator('.mapstudio-needs-row');
            await expect(rows).toHaveCount(3);
            const texts = await rows.evaluateAll((els) => els.map((el) => [el.getAttribute('data-state'),
                el.querySelector('.mapstudio-needs-name').textContent, el.querySelector('.mapstudio-needs-kind').textContent].join('|')));
            expect(texts).toEqual(['alarm|P14|Well pad', 'comms-lost|P21|Well pad', 'stale|SWD1|SWD']);
            await page.locator('.mapstudio-legend-button').click();
            await expect(page.locator('.mapstudio-legend-panel')).toBeVisible();
            await expect(page.locator('.mapstudio-needs-panel')).toBeVisible();
            await shot(page, 'showcase-view-mode-needs-you-1440.png');
            expect(watched.warnings, 'Map Studio warnings').toEqual([]);
        });
});

test.describe('1366 px', () => {
    test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });

    test('P14\'s popup: comms, the three key values and the priority 1 alarm with View alarms', async ({ page, watched }) => {
        const map = await openShowcase(page);
        await componentAlone(page, map);
        await threeStates(page);
        await labelsPlaced(map, ['P14', '1240 psi', 'SWD1', '365 psi']);
        const popup = await clickP14(page, map, SHOWCASE.center, SHOWCASE.zoom);
        await expect(popup.locator('.mapstudio-popup-subline')).toHaveText('Well pad');
        const kpis = popup.locator('.mapstudio-popup-kpi .mapstudio-popup-value');
        await expect(kpis).toHaveText([/^1,?240 psi$/, '410 psi', '1.8 MMcf/d']);
        await expect(popup.locator('[data-part="alarms"]')).toContainText('1 alarm - Priority 1, unacknowledged');
        await expect(popup.locator('.mapstudio-popup-view-alarms')).toBeVisible();
        await shot(page, 'showcase-view-desktop-popup-1366.png');
        expect(watched.warnings, 'Map Studio warnings').toEqual([]);
    });

    test('the L-SWD line popup at zoom 16: the segment PT-1 to PT-2, its instruments in order with their values', async ({ page, watched }) => {
        const map = await openShowcase(page);
        await threeStates(page);
        await view(page, map, SHOWCASE.lineCenter, 16);
        await labelsPlaced(map, ['P14', '1240 psi', 'PT-1']);
        const box = await map.boundingBox();
        const [x, y] = pagePixel(box, SHOWCASE.between, SHOWCASE.lineCenter, 16);
        await page.mouse.click(x, y);
        const popup = page.locator('.maplibregl-popup .mapstudio-popup--line');
        await expect(popup).toBeVisible({ timeout: 30_000 });
        await expect(popup).toHaveAttribute('data-segment', ids.pt1 + '|' + ids.pt2);
        await expect(popup.locator('.mapstudio-popup-segment-title')).toHaveText('Segment PT-1 to PT-2');
        const names = await popup.locator('.mapstudio-popup-instrument .mapstudio-popup-row-name').allTextContents();
        expect(names).toEqual(['CTB1 outlet', 'PT-1', 'LV-1', 'PT-2', 'SWD1 inlet']);
        const values = await popup.locator('.mapstudio-popup-instrument .mapstudio-popup-value').allTextContents();
        expect(values).toEqual(['412 psi', '398 psi', 'No value', '371 psi', '365 psi']);
        await expect(map).toHaveAttribute('data-highlighted', ids.pt1 + ',' + ids.pt2);
        await shot(page, 'showcase-line-instruments-1366.png');
        expect(watched.warnings, 'Map Studio warnings').toEqual([]);
    });
});

test.describe('390 px', () => {
    test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

    test('P14\'s bottom sheet on a phone, the map centred so P14 sits above it', async ({ page, watched }) => {
        const map = await openShowcase(page);
        await componentAlone(page, map);
        await threeStates(page);
        await view(page, map, SHOWCASE.phoneCenter, SHOWCASE.zoom);
        await labelsPlaced(map, ['P14', '1240 psi']);
        const sheet = await clickP14(page, map, SHOWCASE.phoneCenter, SHOWCASE.zoom);
        await expect(map).toHaveAttribute('data-popup-mode', 'sheet');
        await expect(sheet.locator('.mapstudio-popup-view-alarms')).toBeVisible();
        await shot(page, 'showcase-phone-sheet-390.png');
        expect(watched.warnings, 'Map Studio warnings').toEqual([]);
    });
});
