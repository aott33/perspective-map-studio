// One formatter behind every distance, following the units in force (epic-editing entry 20a, R27), live on the dev stack
// with the seeded L-SWD set (about 2,922.2 m, 9,587 ft; PT-1 at 1,143 m, LV-1 at 2,000 m, PT-2 at 2,841 m). The units in force are the
// store's live override, else the setup's `units`, else the browser's locale; no control sets the override until entry
// 20b, so it is set here through the component's real session path (fixtures.mjs `setUnits`, `clearUnits`).
// With the setup at `metric`: a second editor and an anonymous viewer hold L-SWD's line popup open while the map editor
// sets the override to US with words, then US with symbols, then clears it; both popups follow with no reload (F8, F9,
// F2), and the map carries `data-units` and `data-unit-labels`. Under US units the editor's Details and drawing bar write
// and read feet, and what is stored stays metres (F5 to F7). With the setup at `us` and no override the popup reads miles
// and feet and a typed 3750 stores 1143 m; an override wins over the setup. The spec leaves the committed setup, no
// override and the seed's own L-SWD set.

import { pagePixel } from '../lib/geo.mjs';
import {
    EDITOR2_USER, EDITOR_USER, clearUnits, editorTest, expect, mapLoaded, openMap, removeStrays, restoreSetupUnits, runSeed, send, setUnits,
    signedInContext, test, useSetupUnits, view
} from './fixtures.mjs';

const REPLY_MS = 20_000;
/** How long a wait for "nothing was sent" lasts before the seq is read again. */
const NOTHING_MS = 800;

/** The seed's L-SWD: the point 1,500 m along it (between PT-1 and LV-1) and a view that puts it in the upper part of the map. */
const BETWEEN = [-104.999729, 39.718789];
const POPUP_VIEW = { center: [-105.00017, 39.708889], zoom: 14 };
const KEYS = { ctb1: 'swd/ctb1', swd1: 'swd/swd1', line: 'swd/line', pt1: 'swd/pt1', lv1: 'swd/lv1', pt2: 'swd/pt2' };

let seedIds;
let ids;

/** The seed's own L-SWD set again and no item but the seed's (an instrument this spec placed or moved). */
async function seedAgain(browser) {
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
        const seed = await runSeed(page);
        expect(seed.error, 'the seed saved').toBeUndefined();
        await removeStrays(page, seed.ids);
        await clearUnits(page);
        await restoreSetupUnits(page);
        return seed;
    } finally {
        await context.close();
    }
}

test.beforeAll(async ({ browser }) => {
    const seed = await seedAgain(browser);
    seedIds = seed.ids;
    ids = Object.fromEntries(Object.entries(KEYS).map(([k, key]) => [k, seed.ids[key]]));
});

test.afterAll(async ({ browser }) => {
    await seedAgain(browser);
});

async function openEditor(page) {
    const map = await openMap(page, '/edit');
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);
    await expect(map).toHaveAttribute('data-edit-level', 'full');
    await expect(map).toHaveAttribute('data-studio', 'on');
    return map;
}

/** L-SWD's line popup opened by a click between PT-1 and LV-1, on a View-mode page. */
async function openLinePopup(page, map) {
    await view(page, map, POPUP_VIEW.center, POPUP_VIEW.zoom);
    const box = await map.boundingBox();
    const [x, y] = pagePixel(box, BETWEEN, POPUP_VIEW.center, POPUP_VIEW.zoom);
    await page.mouse.click(x, y);
    const popup = page.locator('.maplibregl-popup .mapstudio-popup--line');
    await expect(popup).toBeVisible({ timeout: 30_000 });
    await expect(popup.locator('.mapstudio-popup-name')).toHaveText('L-SWD');
    return popup;
}

/** The popup's distances: the subline, the segment's span and each row's distance in order. */
async function expectPopup(popup, { subline, span, rows }) {
    await expect(popup.locator('.mapstudio-popup-subline')).toHaveText(subline, { timeout: REPLY_MS });
    await expect(popup.locator('.mapstudio-popup-segment-span')).toHaveText(span);
    await expect(popup.locator('.mapstudio-popup-row-distance')).toHaveText(rows);
}

const METRIC = {
    subline: 'Gathering line - 6 in, 2.9 km', span: '1.1 to 2.8 km', rows: ['0 m', '1.1 km', '2 km', '2.8 km', '2.9 km']
};
const US_SHORT = {
    subline: 'Gathering line - 6 in, 1.8 mi', span: '3,750 ft to 1.8 mi', rows: ['0 ft', '3,750 ft', '1.2 mi', '1.8 mi', '1.8 mi']
};
const US_LONG = {
    subline: 'Gathering line - 6 in, 1.8 miles', span: '3,750 feet to 1.8 miles', rows: ['0 feet', '3,750 feet', '1.2 miles', '1.8 miles', '1.8 miles']
};

async function expectUnits(map, system, labels) {
    await expect(map).toHaveAttribute('data-units', system, { timeout: REPLY_MS });
    await expect(map).toHaveAttribute('data-unit-labels', labels);
}

/** The stored map items through the test hook, by id. */
async function storedAll(page) {
    return Object.fromEntries((await send(page, 'map.load', {})).body.items.map((i) => [i.id, i]));
}

async function selectRow(page, id) {
    await page.locator('.mapstudio-list-row[data-item-id="' + id + '"]').click();
    await expect(page.locator('.mapstudio-panel')).toHaveAttribute('data-item-id', id);
}

/** A distance typed in PT-1's Details and finished with Enter: one batch, and what the store then holds. */
async function typeDistance(page, map, text, wantM) {
    const before = Number(await map.getAttribute('data-store-seq'));
    const field = page.locator('.mapstudio-panel .mapstudio-field-distance');
    await field.fill(text);
    await field.press('Enter');
    await expect(map).toHaveAttribute('data-store-seq', String(before + 1), { timeout: REPLY_MS });
    await expect.poll(async () => (await storedAll(page))[ids.pt1].attachment.distanceM, { timeout: REPLY_MS }).toBe(wantM);
    expect((await storedAll(page))[ids.pt1].attachment.lineId).toBe(ids.line);
}

editorTest.describe('distances follow the units in force (entry 20a)', () => {
    editorTest.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, actionTimeout: REPLY_MS });

    editorTest('the setup at metric: an override reaches a second editor\'s and a viewer\'s open line popup with no reload, and Details reads and writes feet',
        async ({ page, browser, watched }) => {
            editorTest.setTimeout(420_000);
            const map = await openEditor(page);
            await clearUnits(page);
            const otherContext = await signedInContext(browser, EDITOR2_USER, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
            const viewerContext = await browser.newContext({
                viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, storageState: { cookies: [], origins: [] }
            });
            try {
                // A second editor in View mode (/live) and an anonymous viewer, each with L-SWD's popup open.
                const other = await otherContext.newPage();
                const otherMap = await openMap(other, '/live');
                await mapLoaded(otherMap);
                await expect(otherMap).toHaveAttribute('data-edit-level', 'full');
                const viewer = await viewerContext.newPage();
                const viewerMap = await openMap(viewer, '/');
                await mapLoaded(viewerMap);
                await expect(viewerMap).toHaveAttribute('data-edit-level', 'none');
                const otherPopup = await openLinePopup(other, otherMap);
                const viewerPopup = await openLinePopup(viewer, viewerMap);
                const watching = [[otherMap, otherPopup], [viewerMap, viewerPopup]];

                // No override: the setup's metric, as before this entry for a kilometre or more.
                for (const [m, popup] of [[map, null], ...watching]) {
                    await expectUnits(m, 'metric', 'short');
                    await expect(m).toHaveAttribute('data-units-override', '');
                    if (popup) {
                        await expectPopup(popup, METRIC);
                    }
                }
                const reloads = await Promise.all(watching.map(([m]) => m.getAttribute('data-map-reloads')));

                // F8: US with words, set by the map editor: both open popups follow, no reload, the popup still open.
                await setUnits(page, { system: 'us', labels: 'long' });
                await expectUnits(map, 'us', 'long');
                for (const [m, popup] of watching) {
                    await expectUnits(m, 'us', 'long');
                    await expectPopup(popup, US_LONG);
                    await expect(popup).toBeVisible();
                }
                // F2: US with symbols.
                await setUnits(page, { system: 'us', labels: 'short' });
                for (const [m, popup] of watching) {
                    await expectUnits(m, 'us', 'short');
                    await expectPopup(popup, US_SHORT);
                }
                await expectUnits(map, 'us', 'short');

                // The editor's Details under US units. The line: its instruments in feet and miles.
                await selectRow(page, ids.line);
                const panel = page.locator('.mapstudio-panel');
                await expect(panel.locator('.mapstudio-instrument-at')).toHaveText(['3,750 ft', '1.2 mi', '1.8 mi']);
                // F5, F7: the drawing bar's typed distance in feet, the range in feet; nothing saved by a refusal.
                await panel.locator('.mapstudio-field-add-instrument').click();
                await page.locator('.mapstudio-instrument-kinds .mapstudio-instrument-kind[data-kind="tap"]').click();
                const bar = page.locator('.mapstudio-drawing-bar--instrument');
                await expect(bar.locator('.mapstudio-instrument-length')).toHaveText('of 9,587 ft');
                const barField = bar.locator('.mapstudio-instrument-distance');
                await expect(barField).toHaveAttribute('placeholder', 'Feet');
                await expect(bar.locator('label')).toHaveText('Distance along L-SWD (ft)');
                let seq = await map.getAttribute('data-store-seq');
                for (const bad of ['abc', '9700']) {
                    await barField.fill(bad);
                    await barField.press('Enter');
                    await expect(bar).toHaveAttribute('data-reason', 'Type a distance from 0 to 9,587 ft');
                }
                await page.waitForTimeout(NOTHING_MS);
                await expect(map).toHaveAttribute('data-store-seq', seq);
                // The override changed while the bar holds a refusal and a number not placed: the bar is in the new unit, the
                // refusal (its range in feet) gone and the field empty, so nothing typed as feet is read as metres.
                await barField.fill('9000');
                await setUnits(page, { system: 'metric', labels: 'long' });
                await expect(bar.locator('.mapstudio-instrument-length')).toHaveText('of 2,922 metres');
                await expect(bar.locator('label')).toHaveText('Distance along L-SWD (metres)');
                await expect(bar).toHaveAttribute('data-reason', '');
                await expect(barField).toHaveValue('');
                await expect(barField).toHaveAttribute('placeholder', 'Metres');
                await setUnits(page, { system: 'us', labels: 'short' });
                await expect(bar.locator('.mapstudio-instrument-length')).toHaveText('of 9,587 ft');
                await expect(map).toHaveAttribute('data-store-seq', String(Number(seq) + 2));
                seq = await map.getAttribute('data-store-seq');
                // A bare 8000 is feet: the tap is stored at 2,438.4 m.
                await barField.fill('8000');
                await barField.press('Enter');
                await expect(map).toHaveAttribute('data-store-seq', String(Number(seq) + 1), { timeout: REPLY_MS });
                const placed = Object.values(await storedAll(page)).filter((i) => !i.deleted && i.attachment && i.attachment.lineId === ids.line
                    && !Object.values(seedIds).includes(i.id));
                expect(placed.map((i) => i.attachment.distanceM)).toEqual([2438.4]);
                await expect(panel).toHaveAttribute('data-item-id', placed[0].id);
                await expect(panel.locator('.mapstudio-field-on-line')).toHaveText('On L-SWD at 1.5 mi');

                // PT-1: its place, the field's unit, its value and the line's length in feet; the store keeps 1143 m.
                await selectRow(page, ids.pt1);
                await expect(panel.locator('.mapstudio-field-on-line')).toHaveText('On L-SWD at 3,750 ft');
                await expect(panel.locator('.mapstudio-field-distance-row .mapstudio-field-sublabel')).toHaveText('Distance along the line (ft)');
                const field = panel.locator('.mapstudio-field-distance');
                await expect(field).toHaveValue('3,750');
                await expect(panel.locator('.mapstudio-field-length')).toHaveText('of 9,587 ft');
                expect((await storedAll(page))[ids.pt1].attachment.distanceM).toBe(1143);
                // F7: refused in the shown unit, nothing saved.
                seq = await map.getAttribute('data-store-seq');
                for (const bad of ['abc', '99999']) {
                    await field.fill(bad);
                    await field.press('Enter');
                    await expect(panel.locator('.mapstudio-field-distance-problem')).toHaveText('Type a distance from 0 to 9,587 ft');
                }
                await page.waitForTimeout(NOTHING_MS);
                await expect(map).toHaveAttribute('data-store-seq', seq);
                // F6: a bare number is feet; a typed ft or m is honoured; each 3750 ft or 1143 m stores 1143 m.
                await typeDistance(page, map, '4000', 1219.2);
                await expect(field).toHaveValue('4,000');
                await typeDistance(page, map, '3750', 1143);
                await expect(field).toHaveValue('3,750');
                await typeDistance(page, map, '1200 m', 1200);
                await expect(field).toHaveValue('3,937');
                await typeDistance(page, map, '3750 ft', 1143);
                await typeDistance(page, map, '4,000 ft', 1219.2);
                await typeDistance(page, map, '1143 m', 1143);
                await expect(field).toHaveValue('3,750');
                await expect(panel.locator('.mapstudio-field-on-line')).toHaveText('On L-SWD at 3,750 ft');
                // The other sessions' open popups followed the moves and still read feet.
                for (const [, popup] of watching) {
                    await expect(popup.locator('.mapstudio-popup-row-distance').nth(1)).toHaveText('3,750 ft', { timeout: REPLY_MS });
                }

                // F9: the override cleared: kilometres again, on every map, the field in metres, still no reload.
                await clearUnits(page);
                await expectUnits(map, 'metric', 'short');
                await expect(field).toHaveValue('1143');
                await expect(panel.locator('.mapstudio-field-length')).toHaveText('of 2,922 m');
                await expect(panel.locator('.mapstudio-field-on-line')).toHaveText('On L-SWD at 1.1 km');
                for (const [m, popup] of watching) {
                    await expectUnits(m, 'metric', 'short');
                    await expect(m).toHaveAttribute('data-units-override', '');
                    await expect(popup.locator('.mapstudio-popup-subline')).toHaveText(METRIC.subline, { timeout: REPLY_MS });
                    await expect(popup.locator('.mapstudio-popup-row-distance').nth(1)).toHaveText('1.1 km');
                    await expect(popup).toBeVisible();
                }
                expect(await Promise.all(watching.map(([m]) => m.getAttribute('data-map-reloads')))).toEqual(reloads);
                expect(watched.errors).toEqual([]);
            } finally {
                await clearUnits(page);
                // The tap this test placed goes, so the next test's click on the line meets the line.
                await removeStrays(page, seedIds);
                await otherContext.close();
                await viewerContext.close();
            }
        });

    editorTest('the setup at us: the popup reads miles and feet, a typed 3750 stores 1143 m, and an override wins over the setup',
        async ({ page, browser }) => {
            editorTest.setTimeout(420_000);
            await openEditor(page);
            await clearUnits(page);
            const viewerContext = await browser.newContext({
                viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, storageState: { cookies: [], origins: [] }
            });
            try {
                await useSetupUnits(page, 'us');
                // Pages opened once the Gateway reads the setup: a viewer's popup and the editor's Details.
                const viewer = await viewerContext.newPage();
                const viewerMap = await openMap(viewer, '/');
                await mapLoaded(viewerMap);
                await expectUnits(viewerMap, 'us', 'short');
                await expect(viewerMap).toHaveAttribute('data-units-override', '');
                const popup = await openLinePopup(viewer, viewerMap);
                await expectPopup(popup, US_SHORT);
                // The scale bar (MapLibre's own) follows the system in force.
                const scale = viewer.locator('.mapstudio-legend-scale');
                await expect(scale).toHaveText(/^[\d,.]+\s?(ft|mi)$/);

                const map = await openEditor(page);
                await expectUnits(map, 'us', 'short');
                await selectRow(page, ids.pt1);
                const panel = page.locator('.mapstudio-panel');
                const field = panel.locator('.mapstudio-field-distance');
                await expect(field).toHaveValue('3,750');
                await expect(panel.locator('.mapstudio-field-length')).toHaveText('of 9,587 ft');
                await typeDistance(page, map, '4000', 1219.2);
                await typeDistance(page, map, '3750', 1143);
                await expect(field).toHaveValue('3,750');

                // An override of metric with words wins over the setup's us; cleared, the setup's us is back.
                const reloads = await viewerMap.getAttribute('data-map-reloads');
                await setUnits(page, { system: 'metric', labels: 'long' });
                await expectUnits(viewerMap, 'metric', 'long');
                await expect(popup.locator('.mapstudio-popup-subline')).toHaveText('Gathering line - 6 in, 2.9 kilometres', { timeout: REPLY_MS });
                await expect(popup.locator('.mapstudio-popup-segment-span')).toHaveText('1.1 to 2.8 kilometres');
                await expect(scale).toHaveText(/^[\d,.]+\s?(m|km)$/);
                await expect(field).toHaveValue('1143');
                await clearUnits(page);
                await expectUnits(viewerMap, 'us', 'short');
                await expectPopup(popup, US_SHORT);
                await expect(scale).toHaveText(/^[\d,.]+\s?(ft|mi)$/);
                await expect(field).toHaveValue('3,750');
                expect(await viewerMap.getAttribute('data-map-reloads')).toBe(reloads);
            } finally {
                await clearUnits(page);
                await restoreSetupUnits(page);
                await viewerContext.close();
            }
        });
});
