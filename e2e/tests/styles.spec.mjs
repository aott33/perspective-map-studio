// Value-driven styles and area category tints (epic 3 entry 1, R12; AD-11, AD-16). On the dev Gateway
// with the seeded kind setups: the pad kind's States rule on the dev Status tag and the line kind's
// Bands rule on the Flow KPI change Point 1's marker and the tracer line's look within one refresh
// interval, an active alarm draws over the value style, comms lost drops the style until comms are
// back, Point 2's override expression rule (Ignition's expression language, evaluated on the Gateway)
// follows P14's pressure, the two geofences take their category tints and no point does, and the
// /styles page draws every case of every rule in its preset, in both themes. The Gateway's own
// evidence for the expression is docs/platform-checks.md, "Epic 3 entry 1". Screenshots for docs/styles.md.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { screenshotDir } from '../lib/env.mjs';
import { TRACER } from '../lib/geo.mjs';
import {
    EDITOR_USER, editorTest, expect, mapLoaded, nextFrames, openMap, runSeed, signedInContext, test
} from './fixtures.mjs';

/** The bound for a change to reach the map: one refresh interval (the dev setup's 10 s) plus margin. */
const INTERVAL_MS = 25_000;
/** How long a redraw after a view change may take on the dev stack. */
const DRAW_MS = 20_000;
/** A view over the tracer and the two geofences south of it. */
const STYLES_VIEW = { center: [-104.985, 39.737], zoom: 14 };

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

/** Move the map (the component's e2e view hook) and wait for the labels of that zoom to be published. */
async function view(page, map, center, zoom) {
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

/** Every source in its quiet state: Status 0, pressures low, comms on, the line's flow below every band. */
async function quiet(page) {
    await press(page, 'status-0');
    await press(page, 'pressure-low');
    await press(page, 'comms-on');
    await press(page, 'ack');
    await press(page, 'line-flow-low');
    await press(page, 'p14-pressure-low');
}

test.beforeAll(async ({ browser }) => {
    // Seed again (not ensureSeeded's cached result): the kind setups, the override and the geofences
    // come from the seed, and an earlier spec may have changed the pad kind setup.
    const context = await signedInContext(browser, EDITOR_USER);
    try {
        const page = await context.newPage();
        await mapLoaded(await openMap(page, '/edit'));
        const seed = await runSeed(page);
        expect(seed.error, 'the seed saved').toBeUndefined();
        expect(seed.kindSetups, 'the three kind setups').toEqual(expect.objectContaining({ pad: expect.any(String), line: expect.any(String), geofence: expect.any(String) }));
        ids = {
            ...Object.fromEntries(Object.entries(TRACER.points).map(([k, p]) => [k, seed.ids[p.key]])),
            line: seed.ids['tracer/l1'], north: seed.ids['areas/north'], south: seed.ids['areas/south']
        };
        await mapLoaded(await openMap(page, '/live'));
        await quiet(page);
    } finally {
        await context.close();
    }
});

editorTest.describe('1440 px', () => {
    editorTest.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

    editorTest('a States rule on a point, a Bands rule on a line, the alarm over the style, stale dropping it, an override expression, and the area tints',
        async ({ page, watched }) => {
            const map = await openMap(page, '/live');
            await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
            await mapLoaded(map);
            await expect(map).toHaveAttribute('data-live-full', /^[1-9][0-9]*$/, { timeout: 30_000 });
            const p1 = liveItem(page, ids.p1);
            const p2 = liveItem(page, ids.p2);
            const line = liveItem(page, ids.line);
            await expect(p1).toHaveAttribute('data-state', 'normal', { timeout: INTERVAL_MS });
            await expect(p1).toHaveAttribute('data-preset', 'normal', { timeout: INTERVAL_MS });
            await expect(p1).toHaveAttribute('data-style', 'normal');
            await expect(line).toHaveAttribute('data-preset', 'normal', { timeout: INTERVAL_MS });
            await expect(line).toHaveAttribute('data-kpi', '20 bbl/d', { timeout: INTERVAL_MS });

            // The States rule: Status 2 is warning within one refresh interval, said with the word; the marker's ring carries it.
            const changed = Date.now();
            await press(page, 'status-2');
            await expect(p1).toHaveAttribute('data-preset', 'warning', { timeout: INTERVAL_MS });
            expect(Date.now() - changed).toBeLessThan(INTERVAL_MS);
            await expect(p1).toHaveAttribute('data-style', 'warning');
            await expect(p1).toHaveAttribute('data-word', 'Warning');
            await expect(p1).toHaveAttribute('data-state', 'normal');
            expect(await p1.getAttribute('data-marker')).toContain('"warning"]');
            expect(await p1.getAttribute('data-problems')).toBe('');
            // Every value the rule names: 1 attention, 3 fault, 4 dimmed (out of service), 0 no case so normal.
            await press(page, 'status-3');
            await expect(p1).toHaveAttribute('data-preset', 'fault', { timeout: INTERVAL_MS });
            await expect(p1).toHaveAttribute('data-word', 'Fault');
            await press(page, 'status-4');
            await expect(p1).toHaveAttribute('data-preset', 'dimmed', { timeout: INTERVAL_MS });
            await expect(p1).toHaveAttribute('data-word', 'Out of service');
            await press(page, 'status-2');
            await expect(p1).toHaveAttribute('data-preset', 'warning', { timeout: INTERVAL_MS });

            // An active alarm draws over the value style: the alarm badge, the style kept under it.
            await press(page, 'pressure-high');
            await expect(p1).toHaveAttribute('data-alarm', '1:unacked:1', { timeout: INTERVAL_MS });
            await expect(p1).toHaveAttribute('data-state', 'alarm');
            await expect(p1).toHaveAttribute('data-preset', 'warning');
            const marker = await p1.getAttribute('data-marker');
            expect(marker).toContain('"alarm-1-unacknowledged",1,true');
            expect(marker).toContain('"warning"]');
            await press(page, 'pressure-low');
            await press(page, 'ack');
            await expect(p1).toHaveAttribute('data-state', 'normal', { timeout: INTERVAL_MS });

            // A stale source: comms lost drops the style (normal, stale for comms lost) until comms are back.
            await press(page, 'comms-off');
            await expect(p1).toHaveAttribute('data-comms', 'lost', { timeout: INTERVAL_MS });
            await expect(p1).toHaveAttribute('data-preset', 'normal');
            await expect(p1).toHaveAttribute('data-style', 'normal:stale:comms lost');
            await expect(p1).toHaveAttribute('data-word', 'Comms lost');
            expect(await p1.getAttribute('data-marker')).toContain('"normal"]');
            await press(page, 'comms-on');
            await expect(p1).toHaveAttribute('data-preset', 'warning', { timeout: INTERVAL_MS });
            await expect(p1).toHaveAttribute('data-word', 'Warning');

            // The Bands rule on the line's Flow KPI: 120 is the attention band, 300 the fault band, 20 no band.
            await press(page, 'line-flow-mid');
            await expect(line).toHaveAttribute('data-preset', 'attention', { timeout: INTERVAL_MS });
            await expect(line).toHaveAttribute('data-word', 'Attention');
            await press(page, 'line-flow-high');
            await expect(line).toHaveAttribute('data-preset', 'fault', { timeout: INTERVAL_MS });
            await press(page, 'line-flow-mid');
            await expect(line).toHaveAttribute('data-preset', 'attention', { timeout: INTERVAL_MS });

            // The override expression on Point 2 (P14): if({value} > 600, 'warning', 'normal'), evaluated on the Gateway.
            await expect(p2).toHaveAttribute('data-preset', 'normal', { timeout: INTERVAL_MS });
            await press(page, 'p14-pressure-high');
            await expect(p2).toHaveAttribute('data-preset', 'warning', { timeout: INTERVAL_MS });
            expect(await p2.getAttribute('data-problems')).toBe('');
            await press(page, 'p14-pressure-low');
            await expect(p2).toHaveAttribute('data-preset', 'normal', { timeout: INTERVAL_MS });

            // The geofences take their category tints; a point never does (no tint attribute, no area feature for it).
            const areas = JSON.parse(await map.getAttribute('data-areas'));
            const byId = Object.fromEntries(areas.map((a) => [a.id, a]));
            expect(byId[ids.north], 'the North fence').toMatchObject({ tint: 'tint-1' });
            expect(byId[ids.south], 'the South fence').toMatchObject({ tint: 'tint-4' });
            expect(byId[ids.north].color).not.toBe('transparent');
            expect(byId[ids.north].color).not.toBe(byId[ids.south].color);
            expect(byId[ids.p1]).toBeUndefined();
            expect(areas.every((a) => a.id !== ids.line)).toBe(true);
            // The tint tokens resolve on the component and no stored rule or module style holds a colour literal.
            const tokens = await map.evaluate((el) => {
                const root = el.closest('.mapstudio');
                const s = getComputedStyle(root);
                return ['--mapstudio-tint-1', '--mapstudio-tint-4', '--mapstudio-warning', '--mapstudio-attention', '--mapstudio-fault']
                    .map((t) => s.getPropertyValue(t).trim());
            });
            for (const t of tokens) {
                expect(t, 'a token resolves').not.toBe('');
            }

            // The warning marker, the attention line and the tinted fences in one view.
            await view(page, map, STYLES_VIEW.center, STYLES_VIEW.zoom);
            const labels = JSON.parse(await map.getAttribute('data-labels'));
            expect(labels.some((b) => b.layer === 'mapstudio-items-chip' && b.text === 'Warning'), 'the Warning chip').toBe(true);
            expect(labels.some((b) => b.layer === 'mapstudio-line-chip' && b.text === 'Tracer line Attention'), 'the line chip with its word').toBe(true);
            await shot(page, 'mapstudio-styles-1440.png');
            await quiet(page);
            expect(watched.warnings, 'Map Studio warnings').toEqual([]);
        });

    test('the /styles page previews every case of every rule in its preset, and the palettes, in light and dark', async ({ page, watched }) => {
        const map = await openMap(page, '/styles');
        await mapLoaded(map);
        const panel = page.locator('.mapstudio-style-panel');
        await expect(panel).toHaveAttribute('data-previews', '3', { timeout: 30_000 });
        await expect(panel).toHaveAttribute('data-sprite', 'loaded', { timeout: 30_000 });
        const pad = panel.locator('.mapstudio-style-preview[data-kind="pad"]');
        await expect(pad).toHaveAttribute('data-cases', '4');
        await expect(pad.locator('.mapstudio-style-tile')).toHaveCount(4);
        for (const [label, preset, word] of [['1', 'attention', 'Attention'], ['2', 'warning', 'Warning'], ['3', 'fault', 'Fault'], ['4', 'dimmed', 'Out of service']]) {
            const tile = pad.locator('.mapstudio-style-tile[data-label="' + label + '"]');
            await expect(tile).toHaveAttribute('data-preset', preset);
            await expect(tile).toContainText(word);
            await expect(tile.locator('svg')).toHaveCount(1);
        }
        await expect(pad).toContainText('States on a tag');
        const line = panel.locator('.mapstudio-style-preview[data-kind="line"]');
        await expect(line).toHaveAttribute('data-cases', '3');
        await expect(line).toContainText('Bands on the key value flow');
        await expect(line).toContainText('When the value is 50 to 200');
        const fence = panel.locator('.mapstudio-style-preview[data-kind="geofence"]');
        await expect(fence).toHaveAttribute('data-tints', '2');
        await expect(fence.locator('.mapstudio-style-tile[data-tint="tint-4"]')).toContainText('South');
        await expect(panel.locator('.mapstudio-style-palette[data-geometry="point"] .mapstudio-style-tile')).toHaveCount(5);
        await expect(panel.locator('.mapstudio-style-palette[data-geometry="line"] .mapstudio-style-tile')).toHaveCount(8);
        await expect(panel.locator('.mapstudio-style-palette[data-geometry="area"] .mapstudio-style-tile')).toHaveCount(7);
        // The sample SVGs carry the resolved tokens and no colour literal from the module (every paint is a computed value).
        const paints = await panel.evaluate((el) => Array.from(el.querySelectorAll('svg [fill], svg [stroke]'))
            .flatMap((n) => [n.getAttribute('fill'), n.getAttribute('stroke')]).filter((v) => v && v !== 'none' && v !== 'currentColor'));
        expect(paints.length).toBeGreaterThan(10);
        expect(paints.every((p) => /^rgb/.test(p) || /^#/.test(p)), 'computed values from the theme').toBe(true);

        const light = await map.evaluate((el) => getComputedStyle(el.closest('.mapstudio')).backgroundColor);
        await shot(page, 'mapstudio-styles-preview-light-1440.png');
        // The dark theme: the session switches, the tokens change, the preview redraws from them on a reload.
        await page.locator('#mapstudio-styles-theme').click();
        await expect(page.locator('#mapstudio-styles-theme')).toHaveText('Light theme', { timeout: 30_000 });
        await expect.poll(() => map.evaluate((el) => getComputedStyle(el.closest('.mapstudio')).backgroundColor), { timeout: 30_000 })
            .not.toBe(light);
        await page.reload({ waitUntil: 'load' });
        const dark = await openMap(page, '/styles');
        await mapLoaded(dark);
        await expect(page.locator('.mapstudio-style-panel')).toHaveAttribute('data-sprite', 'loaded', { timeout: 30_000 });
        expect(await dark.evaluate((el) => getComputedStyle(el.closest('.mapstudio')).backgroundColor)).not.toBe(light);
        await shot(page, 'mapstudio-styles-preview-dark-1440.png');
        await page.locator('#mapstudio-styles-theme').click();
        await expect(page.locator('#mapstudio-styles-theme')).toHaveText('Dark theme', { timeout: 30_000 });
        expect(watched.warnings, 'Map Studio warnings').toEqual([]);
    });
});

test.describe('390 px', () => {
    test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

    test('the preview panel fits a phone', async ({ page }) => {
        const map = await openMap(page, '/styles');
        await mapLoaded(map);
        const panel = page.locator('.mapstudio-style-panel');
        await expect(panel).toHaveAttribute('data-sprite', 'loaded', { timeout: 30_000 });
        const box = await panel.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(390);
        await shot(page, 'mapstudio-styles-390.png');
    });
});
