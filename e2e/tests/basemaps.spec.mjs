// Basemaps and the starting area (epic 3 entry 6, R1, R10, AD-12) and the View-mode controls as
// designed (entry 14, R5). On the dev Gateway: the setup offers None, OpenStreetMap and Satellite in
// the Legend panel bottom-left (the Legend button opens it by click or keyboard, Esc closes it); None
// draws the blank background; OpenStreetMap and Satellite draw their tiles with the provider's
// attribution always shown beside the Legend button; the top-right holds one zoom card (plus, the
// level, minus, Fit, Return) and nothing else, and View mode has no Draw a line; Satellite's tile source comes from the Gateway (basemap.source), its token read from the
// secret the setup names (ops/secrets/map_token, a generated placeholder that starts with pk.), refused
// in plain words when the secret is not a public token, is missing or is not named; the token never
// reaches the browser's storage or the Gateway log. Two components with different starting areas (the
// /two page) show the same map items. Tiles are routed to a 1 by 1 PNG (the CI runner and the cloud
// box may not reach tile.openstreetmap.org, and the placeholder token is not Mapbox's), so the specs
// assert on the chosen basemap, the attribution and the tile state, and a routed abort proves the
// tile-failure status. Screenshots at 1440 and 390 px for the docs (AD-15).

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot, screenshotDir, sessionUrl } from '../lib/env.mjs';
import { backUpSetup, committedSetup, gatewayRun, logLines, putBackSetup, scanProject, writeSetup } from '../lib/gateway.mjs';
import { ensureSeeded, expect, mapLoaded, nextFrames, openMap, test } from './fixtures.mjs';

/** A 1 by 1 PNG (one blue pixel, so a screenshot shows the tiles drawn), served for every tile the specs route. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const OSM_TILES = /^https:\/\/tile\.openstreetmap\.org\//;
const MAPBOX_TILES = /^https:\/\/api\.mapbox\.com\/v4\/mapbox\.satellite\//;
/** How long a basemap change (a Gateway round trip, the tiles' first idle) may take on the dev stack. */
const CHANGE_MS = 30_000;

/** A dev secret's content, read for the checks that nothing holds it; never logged. */
function secretFile(name) {
    const file = path.join(repoRoot, 'ops', 'secrets', name);
    return existsSync(file) ? readFileSync(file, 'utf8').trim() : '';
}

/**
 * Serve the stub tile for both providers; returns the tile URLs asked for (query strings included). With
 * `brokenOsm` the OSM tiles come back as bytes that are not an image: the tile fails inside MapLibre (its
 * error event) with no network error of the browser's own, which a routed abort or a 404 would log as a
 * console error of its own, whatever the component does.
 */
async function stubTiles(page, { brokenOsm = false } = {}) {
    const asked = [];
    await page.route(OSM_TILES, (route) => {
        asked.push(route.request().url());
        return route.fulfill({ status: 200, contentType: 'image/png', body: brokenOsm ? Buffer.from('not a png') : PNG });
    });
    await page.route(MAPBOX_TILES, (route) => {
        asked.push(route.request().url());
        return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    });
    return asked;
}

const button = (page, id) => page.locator('.mapstudio-basemap-button[data-basemap="' + id + '"]');
const attribution = (page) => page.locator('.maplibregl-ctrl-attrib');
const legendButton = (page) => page.locator('.mapstudio-legend-button');
const legendPanel = (page) => page.locator('.mapstudio-legend-panel');

/** Open the Legend panel (entry 14), where the basemap choice lives; it stays open until Esc, the button or a map click. */
async function openLegend(page, map) {
    await legendButton(page).click();
    await expect(legendPanel(page)).toBeVisible();
    await expect(map).toHaveAttribute('data-legend-open', 'true');
}

/** Everything in the page's localStorage and sessionStorage as one string. */
async function storageText(page) {
    return page.evaluate(() => {
        const dump = (s) => {
            const out = {};
            for (let i = 0; i < s.length; i++) {
                out[s.key(i)] = s.getItem(s.key(i));
            }
            return out;
        };
        return JSON.stringify({ local: dump(window.localStorage), session: dump(window.sessionStorage) });
    });
}

async function shot(page, name) {
    await nextFrames(page);
    mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, name), fullPage: false });
}

test.beforeAll(async ({ browser }) => {
    // The /two page compares item counts, so the dev map must be seeded (a fresh stack has none).
    await ensureSeeded(browser);
});

test.describe('1440 px', () => {
    test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

    test('None, OpenStreetMap and Satellite each draw with their attribution, and the choice is remembered',
        async ({ page, watched }) => {
            const token = secretFile('map_token');
            expect(token, 'ops/secrets/map_token (ops/gen_secrets.py writes a placeholder)').toMatch(/^pk\./);
            const run = await gatewayRun();
            const asked = await stubTiles(page);
            const map = await openMap(page, '/');
            await mapLoaded(map);
            await openLegend(page, map);
            // The setup offers all three; nothing remembered in a fresh browser: the first listed, None.
            await expect(map).toHaveAttribute('data-basemap-offered', 'none,osm,satellite');
            await expect(map).toHaveAttribute('data-basemap', 'none');
            await expect(map).toHaveAttribute('data-basemap-tiles', 'none');
            await expect(map).toHaveAttribute('data-basemap-status', '');
            await expect(page.locator('.mapstudio-basemap-button')).toHaveCount(3);
            await expect(button(page, 'none')).toHaveAttribute('aria-pressed', 'true');
            await expect(attribution(page)).toHaveClass(/maplibregl-attrib-empty/);
            expect(asked, 'no tile is asked for with None').toEqual([]);

            // OpenStreetMap: its tiles and its attribution.
            await button(page, 'osm').click();
            await expect(map).toHaveAttribute('data-basemap', 'osm');
            await expect(button(page, 'osm')).toHaveAttribute('aria-pressed', 'true');
            await expect(attribution(page)).toBeVisible();
            await expect(attribution(page)).toContainText('OpenStreetMap contributors');
            await expect(attribution(page).locator('a[href="https://www.openstreetmap.org/copyright"]')).toHaveCount(1);
            await expect(map).toHaveAttribute('data-basemap-tiles', 'loaded', { timeout: CHANGE_MS });
            expect(asked.some((u) => OSM_TILES.test(u)), 'OSM tiles asked for').toBe(true);
            await shot(page, 'mapstudio-basemap-osm-1440.png');

            // Satellite: the Gateway answers the Mapbox source from the setup's secret; the token is only in the tile URL.
            await button(page, 'satellite').click();
            await expect(map).toHaveAttribute('data-basemap', 'satellite', { timeout: CHANGE_MS });
            await expect(map).toHaveAttribute('data-basemap-status', '');
            await expect(attribution(page)).toContainText('Mapbox');
            await expect(attribution(page)).toContainText('Maxar');
            await expect(attribution(page)).toContainText('Improve this map');
            await expect(map).toHaveAttribute('data-basemap-tiles', 'loaded', { timeout: CHANGE_MS });
            const mapboxAsked = asked.filter((u) => MAPBOX_TILES.test(u));
            expect(mapboxAsked.length).toBeGreaterThan(0);
            expect(mapboxAsked[0]).toContain('access_token=' + token);
            expect(mapboxAsked[0]).toMatch(/@2x\.jpg90\?/);
            expect(await storageText(page), 'no token in the browser\'s storage').not.toContain(token);
            expect(await storageText(page)).toContain('"mapstudio.basemap.v1":"satellite"');
            const lines = await logLines('MapStudio.basemap', Date.parse(run.moduleStartupTime) - 1000);
            for (const line of lines) {
                expect(line, 'a Gateway log line never holds the token').not.toContain(token);
            }
            await shot(page, 'mapstudio-basemap-satellite-1440.png');

            // The choice is remembered in this browser: a reload opens on Satellite again.
            await page.reload({ waitUntil: 'load' });
            const again = await openMap(page, '/');
            await mapLoaded(again);
            await expect(again).toHaveAttribute('data-basemap', 'satellite', { timeout: CHANGE_MS });

            // Back to None: no tiles, no attribution.
            await openLegend(page, again);
            await button(page, 'none').click();
            await expect(again).toHaveAttribute('data-basemap', 'none');
            await expect(again).toHaveAttribute('data-basemap-tiles', 'none');
            await expect(attribution(page)).toHaveClass(/maplibregl-attrib-empty/);
            expect(watched.warnings, 'Map Studio warnings').toEqual([]);
        });

    test('a token that is not public, a missing secret and no secret are refused in words; a setup without satellite offers none',
        async ({ page }) => {
            const token = secretFile('map_token');
            const pgPassword = secretFile('pg_password');
            expect(pgPassword, 'ops/secrets/pg_password').not.toBe('');
            backUpSetup();
            const good = committedSetup();
            const run = await gatewayRun();
            await stubTiles(page);
            try {
                // The pg_password secret exists but is not a pk. token: refused, the selection stays, the value shown nowhere.
                writeSetup({ ...good, tokenSecret: 'MapStudioFiles/pg_password' });
                await scanProject();
                let map = await openMap(page, '/');
                await mapLoaded(map);
                await openLegend(page, map);
                await button(page, 'satellite').click();
                await expect(map).toHaveAttribute('data-basemap-status', /^Satellite is unavailable: The map token secret MapStudioFiles\/pg_password is not a public Mapbox token/, { timeout: CHANGE_MS });
                await expect(map).toHaveAttribute('data-basemap', 'none');
                await expect(button(page, 'none')).toHaveAttribute('aria-pressed', 'true');
                await expect(page.locator('.mapstudio-basemap-status')).toBeVisible();
                await expect(page.locator('.mapstudio-basemap-status')).toContainText('not a public Mapbox token');
                expect(await map.getAttribute('data-basemap-status')).not.toContain(pgPassword);
                expect(await storageText(page)).not.toContain(pgPassword);

                // A secret the provider does not have.
                writeSetup({ ...good, tokenSecret: 'MapStudioFiles/nope' });
                await scanProject();
                await button(page, 'satellite').click();
                await expect(map).toHaveAttribute('data-basemap-status', 'Satellite is unavailable: The map token secret MapStudioFiles/nope was not found.', { timeout: CHANGE_MS });

                // No secret named at all.
                writeSetup({ ...good, tokenSecret: '' });
                await scanProject();
                await button(page, 'satellite').click();
                await expect(map).toHaveAttribute('data-basemap-status', /^Satellite is unavailable: The Map Studio setup names no map token secret/, { timeout: CHANGE_MS });
                // Another choice clears the status.
                await button(page, 'osm').click();
                await expect(map).toHaveAttribute('data-basemap', 'osm');
                await expect(map).toHaveAttribute('data-basemap-status', '');

                // A setup without satellite offers two; mapbox is listed but not drawn (deferred).
                writeSetup({ ...good, basemaps: ['osm', 'none', 'mapbox'] });
                await scanProject();
                await page.reload({ waitUntil: 'load' });
                map = await openMap(page, '/');
                await mapLoaded(map);
                await expect(map).toHaveAttribute('data-basemap-offered', 'osm,none');
                await openLegend(page, map);
                await expect(page.locator('.mapstudio-basemap-button')).toHaveCount(2);
                // Remembered osm is still offered, so it stays the choice.
                await expect(map).toHaveAttribute('data-basemap', 'osm');

                const lines = await logLines('MapStudio.basemap', Date.parse(run.moduleStartupTime) - 1000);
                expect(lines.some((l) => l.includes('MapStudioFiles/pg_password')), lines.join('\n')).toBe(true);
                for (const line of lines) {
                    expect(line).not.toContain(pgPassword);
                    expect(line).not.toContain(token);
                }
            } finally {
                await putBackSetup();
            }
        });

    test('tiles that do not load are said in words, not as a browser error', async ({ page, watched }) => {
        await stubTiles(page, { brokenOsm: true });
        const map = await openMap(page, '/');
        await mapLoaded(map);
        await openLegend(page, map);
        await button(page, 'osm').click();
        await expect(map).toHaveAttribute('data-basemap', 'osm');
        await expect(map).toHaveAttribute('data-basemap-tiles', 'failed', { timeout: CHANGE_MS });
        await expect(map).toHaveAttribute('data-basemap-status', 'OpenStreetMap tiles are not loading; check the network.');
        await expect(page.locator('.mapstudio-basemap-status')).toContainText('tiles are not loading');
        // The attribution still shows: the provider's terms do not depend on the tiles arriving.
        await expect(attribution(page)).toContainText('OpenStreetMap contributors');
        expect(watched.warnings).toEqual([]);
    });

    test('the View-mode controls as designed: one zoom card top-right, the Legend bottom-left by click and keyboard, no Draw a line',
        async ({ page }) => {
            await stubTiles(page);
            const map = await openMap(page, '/');
            await mapLoaded(map);
            // Top-right: the zoom card alone (plus, the level, minus, Fit, Return), nothing else.
            await expect(page.locator('.maplibregl-ctrl-top-right .maplibregl-ctrl')).toHaveCount(1);
            const zoom = page.locator('.mapstudio-zoom');
            await expect(zoom).toBeVisible();
            await expect(zoom.locator('.mapstudio-zoom-in')).toHaveAttribute('aria-label', 'Zoom in');
            await expect(zoom.locator('.mapstudio-zoom-level')).toHaveText('z 12');
            await expect(zoom.locator('.mapstudio-zoom-out')).toHaveAttribute('aria-label', 'Zoom out');
            await expect(zoom.locator('.mapstudio-fit-button')).toHaveAttribute('aria-label', 'Fit the map to every item');
            await expect(zoom.locator('.mapstudio-return-button')).toBeDisabled();
            await expect(page.locator('.mapstudio-draw-button'), 'View mode has no Draw a line').toHaveCount(0);
            await zoom.locator('.mapstudio-zoom-in').click();
            await expect(map).toHaveAttribute('data-zoom', '13.00', { timeout: CHANGE_MS });
            await expect(zoom.locator('.mapstudio-zoom-level')).toHaveText('z 13');
            await zoom.locator('.mapstudio-zoom-out').click();
            await expect(map).toHaveAttribute('data-zoom', '12.00', { timeout: CHANGE_MS });
            // Bottom-left: the Legend button with the scale bar beside it; the panel is closed.
            const row = page.locator('.mapstudio-legend-row');
            await expect(legendButton(page)).toContainText('Legend');
            await expect(legendButton(page)).toHaveAttribute('aria-expanded', 'false');
            await expect(row.locator('.maplibregl-ctrl-scale')).toBeVisible();
            await expect(legendPanel(page)).toHaveCount(0);
            await expect(map).toHaveAttribute('data-legend-open', 'false');
            const buttonBox = await legendButton(page).boundingBox();
            const scaleBox = await row.locator('.maplibregl-ctrl-scale').boundingBox();
            expect(scaleBox.x, 'the scale bar beside the Legend button').toBeGreaterThan(buttonBox.x + buttonBox.width);
            // By keyboard: Enter on the button opens the panel with focus inside; Esc closes it and returns the focus.
            await legendButton(page).focus();
            await page.keyboard.press('Enter');
            await expect(legendPanel(page)).toBeVisible();
            await expect(map).toHaveAttribute('data-legend-open', 'true');
            await expect(legendButton(page)).toHaveAttribute('aria-expanded', 'true');
            await expect(legendPanel(page).locator('.mapstudio-legend-heading').first()).toHaveText('Basemap');
            await expect(page.locator('.mapstudio-basemap-button')).toHaveCount(3);
            await expect(button(page, 'none')).toBeFocused();
            const panelBox = await legendPanel(page).boundingBox();
            expect(panelBox.y + panelBox.height, 'the panel opens above the button').toBeLessThanOrEqual(buttonBox.y + 1);
            await page.keyboard.press('Escape');
            await expect(legendPanel(page)).toHaveCount(0);
            await expect(map).toHaveAttribute('data-legend-open', 'false');
            await expect(legendButton(page)).toBeFocused();
            // By click: the button opens it, the basemap choice works inside it, a click on the map closes it.
            await openLegend(page, map);
            await button(page, 'osm').click();
            await expect(map).toHaveAttribute('data-basemap', 'osm');
            await expect(legendPanel(page), 'a choice keeps the panel open').toBeVisible();
            await expect(attribution(page)).toContainText('OpenStreetMap contributors');
            const box = await map.boundingBox();
            await page.mouse.click(box.x + box.width / 2, box.y + 80);
            await expect(legendPanel(page)).toHaveCount(0);
            // The bottom-right corner is the Perspective App Bar toggle's at every width.
            const corner = { x: box.x + box.width - 64, y: box.y + box.height - 64 };
            for (const b of [await zoom.boundingBox(), await row.boundingBox()]) {
                expect(b.x + b.width > corner.x && b.y + b.height > corner.y, 'nothing in the bottom-right corner').toBe(false);
            }
            await expect(map).toHaveAttribute('data-basemap-tiles', 'loaded', { timeout: CHANGE_MS });
            await shot(page, 'mapstudio-controls-1440.png');
        });

    test('two components with different starting areas show the same map items', async ({ page }) => {
        await stubTiles(page);
        // Not openMap: it waits on one .mapstudio-map, and this page has two.
        await page.goto(sessionUrl('/two'), { waitUntil: 'load' });
        const maps = page.locator('.mapstudio-map');
        await expect(maps).toHaveCount(2, { timeout: 60_000 });
        const left = maps.nth(0);
        const right = maps.nth(1);
        for (const m of [left, right]) {
            await expect(m).toHaveAttribute('data-map-ready', 'true', { timeout: 60_000 });
            await expect(m).not.toHaveAttribute('data-load-state', 'loading', { timeout: 60_000 });
            await expect(m).toHaveAttribute('data-load-state', 'loaded');
            await expect(m).toHaveAttribute('data-items-loaded', /^[1-9][0-9]*$/);
        }
        expect(await left.getAttribute('data-items-loaded')).toBe(await right.getAttribute('data-items-loaded'));
        // The left opens on the dev centre and zoom; the right fits its bounds (a smaller area, so a higher zoom).
        expect(await left.getAttribute('data-center')).toBe('-104.97250,39.74450');
        expect(await left.getAttribute('data-zoom')).toBe('12.00');
        const [lng, lat] = (await right.getAttribute('data-center')).split(',').map(Number);
        expect(lng).toBeGreaterThan(-104.995);
        expect(lng).toBeLessThan(-104.95);
        expect(lat).toBeGreaterThan(39.735);
        expect(lat).toBeLessThan(39.754);
        expect(Number(await right.getAttribute('data-zoom'))).toBeGreaterThan(12);
        await shot(page, 'mapstudio-two-1440.png');
    });
});

test.describe('390 px', () => {
    test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

    test('the zoom card, the Legend panel and the attribution fit a phone at 44 px and leave the bottom-right corner clear', async ({ page }) => {
        await stubTiles(page);
        const map = await openMap(page, '/');
        await mapLoaded(map);
        await expect(page.locator('.mapstudio-draw-button')).toHaveCount(0);
        await openLegend(page, map);
        await button(page, 'osm').click();
        await expect(map).toHaveAttribute('data-basemap', 'osm');
        await expect(attribution(page)).toContainText('OpenStreetMap contributors');
        await expect(map).toHaveAttribute('data-basemap-tiles', 'loaded', { timeout: CHANGE_MS });
        // Every control button is a 44 px touch target (DESIGN.md target-touch), the panel's included.
        for (const b of await page.locator('.mapstudio .maplibregl-ctrl button').all()) {
            const r = await b.boundingBox();
            expect(Math.min(r.width, r.height), (await b.getAttribute('aria-label')) || (await b.textContent())).toBeGreaterThanOrEqual(44);
        }
        const zoom = await page.locator('.mapstudio-zoom').boundingBox();
        const panel = await legendPanel(page).boundingBox();
        const attrib = await attribution(page).boundingBox();
        for (const box of [zoom, panel, attrib]) {
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(390);
        }
        await shot(page, 'mapstudio-basemap-390.png');
        await page.keyboard.press('Escape');
        await expect(legendPanel(page)).toHaveCount(0);
        const legend = await page.locator('.mapstudio-legend-row').boundingBox();
        // The bottom-right 64 px corner is the Perspective App Bar toggle's (DESIGN.md).
        const corner = { x: 390 - 64, y: 844 - 64 };
        for (const box of [zoom, legend, attrib]) {
            const inCorner = box.x + box.width > corner.x && box.y + box.height > corner.y;
            expect(inCorner, 'nothing in the bottom-right corner').toBe(false);
        }
        await shot(page, 'mapstudio-controls-390.png');
    });
});
