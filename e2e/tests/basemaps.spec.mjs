// Basemaps and the starting area (epic 3 entry 6, R1, R10, AD-12) and the View-mode controls as
// designed (entry 14, R5). On the dev Gateway: the setup offers None, OpenStreetMap and Satellite in
// the Legend panel bottom-left (the Legend button opens it by click or keyboard, Esc closes it); None
// draws the blank background; OpenStreetMap and Satellite draw their tiles with the provider's
// attribution always shown (small muted text along the bottom-right edge, under the App Bar toggle, owner review
// item 3), and with Satellite the Mapbox logo after the scale bar and Mapbox's four links (owner decision 2026-11-03); the basemap switch exists only when the setup lists more than one basemap and the first listed is the
// default (item 3); the scale bar sits on the Legend button's bottom edge (item 1); the top-right holds one zoom card (plus, the
// level, minus, Fit, Return) and nothing else, and View mode has no Draw a line; Satellite's tile source comes from the Gateway (basemap.source), its token read from the
// secret the setup names (ops/secrets/map_token, a generated placeholder that starts with pk.), refused
// in plain words when the secret is not a public token, is missing or is not named; the token never
// reaches the browser's storage or the Gateway log. Two components with different starting areas (the
// /two page) show the same map items. Tiles are routed to a 1 by 1 PNG (the CI runner and the cloud
// box may not reach tile.openstreetmap.org, and the placeholder token is not Mapbox's), so the specs
// assert on the chosen basemap, the attribution and the tile state, and a routed abort proves the
// tile-failure status. Screenshots at 1440 and 390 px for the docs (AD-15).

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot, sessionUrl } from '../lib/env.mjs';
import { backUpSetup, committedSetup, gatewayRun, logLines, putBackSetup, scanProject, writeSetup } from '../lib/gateway.mjs';
import { ensureSeeded, expect, mapLoaded, openMap, shot, test } from './fixtures.mjs';

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
// The Mapbox logo while Satellite is drawn (owner decision 2026-11-03), in the Legend row after the scale bar.
const mapboxLogo = (page) => page.locator('.mapstudio-mapbox-logo');
/** Mapbox's text attribution for satellite (its attribution guide): four links, in this order. */
const MAPBOX_LINKS = [
    ['\u00a9 Mapbox', 'https://www.mapbox.com/about/maps/'],
    ['\u00a9 OpenStreetMap', 'https://www.openstreetmap.org/copyright'],
    ['Improve this map', /^https:\/\/apps\.mapbox\.com\/feedback\/#\/-?[0-9.]+\/-?[0-9.]+\/[0-9.]+$/],
    ['\u00a9 Maxar', 'https://www.maxar.com/']
];

/**
 * The Mapbox logo and the four links are shown, the logo is Mapbox's own image at its own size and links to Mapbox,
 * and "Improve this map" carries the map's position (`data-center` and `data-zoom`).
 */
async function expectMapboxAttribution(page, map) {
    await expect(mapboxLogo(page)).toHaveCount(1);
    await expect(mapboxLogo(page)).toBeVisible();
    await expect(mapboxLogo(page)).toHaveAttribute('href', 'https://www.mapbox.com/');
    await expect(mapboxLogo(page)).toHaveAttribute('aria-label', 'Mapbox logo');
    await expect(map).toHaveAttribute('data-provider-logo', 'mapbox');
    const img = await mapboxLogo(page).locator('img').evaluate((el) => ({
        src: el.getAttribute('src'), natural: [el.naturalWidth, el.naturalHeight], filter: getComputedStyle(el).filter,
        opacity: getComputedStyle(el).opacity, box: [el.getBoundingClientRect().width, el.getBoundingClientRect().height]
    }));
    expect(img.src.startsWith('data:image/svg+xml'), 'inlined in the bundle, not loaded from a CDN').toBe(true);
    expect(img.natural, 'the image decoded').toEqual([88, 23]);
    expect(img.box, 'its own size').toEqual([88, 23]);
    expect(img.filter, 'never restyled').toBe('none');
    expect(img.opacity).toBe('1');
    const links = attribution(page).locator('a');
    await expect(links).toHaveCount(MAPBOX_LINKS.length);
    for (let i = 0; i < MAPBOX_LINKS.length; i++) {
        await expect(links.nth(i)).toHaveText(MAPBOX_LINKS[i][0]);
        await expect(links.nth(i)).toHaveAttribute('href', MAPBOX_LINKS[i][1]);
    }
    // The feedback link's position is the map's (the guide's #/{lng}/{lat}/{zoom}).
    const [lng, lat] = (await map.getAttribute('data-center')).split(',').map(Number);
    const zoom = Number(await map.getAttribute('data-zoom'));
    await expect.poll(async () => {
        const at = (await links.nth(2).getAttribute('href')).split('#/')[1].split('/').map(Number);
        return Math.abs(at[0] - lng) < 1e-4 && Math.abs(at[1] - lat) < 1e-4 && Math.abs(at[2] - zoom) < 0.01;
    }, { timeout: CHANGE_MS }).toBe(true);
}

/** The logo sits on the map and covers none of the Legend button, the scale bar, the attribution and the App Bar toggle. */
async function expectLogoPlaced(page, map) {
    const mapBox = await map.boundingBox();
    const logo = await mapboxLogo(page).boundingBox();
    const legend = await legendButton(page).boundingBox();
    const scale = await page.locator('.mapstudio-legend-row .maplibregl-ctrl-scale').boundingBox();
    const attrib = await attribution(page).boundingBox();
    expect(logo.x, 'on the map').toBeGreaterThanOrEqual(mapBox.x);
    expect(logo.x + logo.width).toBeLessThanOrEqual(mapBox.x + mapBox.width);
    expect(logo.y + logo.height).toBeLessThanOrEqual(mapBox.y + mapBox.height);
    expect(logo.x, 'bottom-left, after the scale bar').toBeGreaterThan(scale.x + scale.width);
    expect(Math.abs((logo.y + logo.height) - (legend.y + legend.height)), 'on the Legend button\'s bottom edge').toBeLessThanOrEqual(1);
    for (const [name, other] of [['the Legend button', legend], ['the scale bar', scale], ['the attribution', attrib]]) {
        expect(overlap(logo, other), 'the logo never covers ' + name).toBe(false);
    }
    expect(overlap(attrib, scale), 'the attribution never covers the scale bar').toBe(false);
    expect(overlap(attrib, legend), 'the attribution never covers the Legend button').toBe(false);
    expect(attrib.x).toBeGreaterThanOrEqual(mapBox.x);
    expect(attrib.x + attrib.width).toBeLessThanOrEqual(mapBox.x + mapBox.width);
    if (await appBarToggle(page).count()) {
        const toggle = await appBarToggle(page).boundingBox();
        expect(overlap(logo, toggle), 'the logo never covers the App Bar toggle').toBe(false);
        expect(overlap(attrib, toggle), 'the attribution never covers the App Bar toggle').toBe(false);
    }
}
const legendButton = (page) => page.locator('.mapstudio-legend-button');
const legendPanel = (page) => page.locator('.mapstudio-legend-panel');
// Perspective's App Bar toggle (the page's fixed bottom-right button): the attribution sits under it, never over it.
const appBarToggle = (page) => page.locator('.bar-reveal');

/** The rectangles of two boxes overlap (by more than a pixel each way). */
function overlap(a, b) {
    return a.x + a.width > b.x + 1 && b.x + b.width > a.x + 1 && a.y + a.height > b.y + 1 && b.y + b.height > a.y + 1;
}

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
            await expect(mapboxLogo(page), 'no Mapbox logo with None').toHaveCount(0);
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
            await expect(mapboxLogo(page), 'no Mapbox logo with OpenStreetMap').toHaveCount(0);
            await expect(map).toHaveAttribute('data-provider-logo', '');
            await expect(attribution(page)).not.toContainText('Mapbox');
            await shot(page, 'mapstudio-basemap-osm-1440.png');

            // Satellite: the Gateway answers the Mapbox source from the setup's secret; the token is only in the tile URL.
            await button(page, 'satellite').click();
            await expect(map).toHaveAttribute('data-basemap', 'satellite', { timeout: CHANGE_MS });
            await expect(map).toHaveAttribute('data-basemap-status', '');
            await expect(attribution(page)).toContainText('Mapbox');
            await expect(attribution(page)).toContainText('Maxar');
            await expect(attribution(page)).toContainText('Improve this map');
            await expect(map).toHaveAttribute('data-basemap-tiles', 'loaded', { timeout: CHANGE_MS });
            // The Mapbox logo and the four links Mapbox's attribution guide asks for (owner decision 2026-11-03).
            await expectMapboxAttribution(page, map);
            await expect(attribution(page)).not.toContainText(token);
            await page.keyboard.press('Escape');
            await expect(legendPanel(page)).toHaveCount(0);
            await expectLogoPlaced(page, map);
            // A move updates "Improve this map" to the new position.
            await page.locator('.mapstudio-zoom-in').click();
            await expect(map).toHaveAttribute('data-zoom', '13.00', { timeout: CHANGE_MS });
            await expectMapboxAttribution(page, map);
            await page.locator('.mapstudio-zoom-out').click();
            await expect(map).toHaveAttribute('data-zoom', '12.00', { timeout: CHANGE_MS });
            await openLegend(page, map);
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
            await expectMapboxAttribution(page, again);

            // To OpenStreetMap and back to None: the logo leaves with Satellite; no tiles, no attribution.
            await openLegend(page, again);
            await button(page, 'osm').click();
            await expect(again).toHaveAttribute('data-basemap', 'osm');
            await expect(mapboxLogo(page), 'the logo hides when the basemap leaves Satellite').toHaveCount(0);
            await expect(attribution(page)).toContainText('OpenStreetMap contributors');
            await expect(attribution(page)).not.toContainText('Mapbox');
            await button(page, 'none').click();
            await expect(again).toHaveAttribute('data-basemap', 'none');
            await expect(again).toHaveAttribute('data-basemap-tiles', 'none');
            await expect(attribution(page)).toHaveClass(/maplibregl-attrib-empty/);
            await expect(mapboxLogo(page)).toHaveCount(0);
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

                // A setup that lists one basemap: the basemap is the project's setting, so a viewer has no switch (the
                // Basemap section is absent) and the one listed is drawn, whatever this browser chose before (item 3).
                writeSetup({ ...good, basemaps: ['none'] });
                await scanProject();
                await page.reload({ waitUntil: 'load' });
                map = await openMap(page, '/');
                await mapLoaded(map);
                await expect(map).toHaveAttribute('data-basemap-offered', 'none');
                await expect(map).toHaveAttribute('data-basemap', 'none');
                await openLegend(page, map);
                await expect(page.locator('.mapstudio-basemap-button')).toHaveCount(0);
                await expect(page.locator('.mapstudio-legend-section--basemap')).toHaveCount(0);
                expect(await legendPanel(page).locator('.mapstudio-legend-heading').allTextContents()).not.toContain('Basemap');
                // The first listed is the default: with the order reversed and nothing chosen, OpenStreetMap is drawn.
                await page.evaluate(() => window.localStorage.removeItem('mapstudio.basemap.v1'));
                writeSetup({ ...good, basemaps: ['osm'] });
                await scanProject();
                await page.reload({ waitUntil: 'load' });
                map = await openMap(page, '/');
                await mapLoaded(map);
                await expect(map).toHaveAttribute('data-basemap', 'osm', { timeout: CHANGE_MS });
                await expect(page.locator('.mapstudio-basemap-button')).toHaveCount(0);

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
            // On the button's bottom edge, not floating above it (item 1).
            expect(Math.abs((scaleBox.y + scaleBox.height) - (buttonBox.y + buttonBox.height)), 'the scale bar bottom-aligned with the Legend button')
                .toBeLessThanOrEqual(1);
            // The attribution is not in the row any more.
            await expect(row.locator('.maplibregl-ctrl-attrib')).toHaveCount(0);
            // By keyboard: Enter on the button opens the panel with focus inside; Esc closes it and returns the focus.
            await legendButton(page).focus();
            await page.keyboard.press('Enter');
            await expect(legendPanel(page)).toBeVisible();
            await expect(map).toHaveAttribute('data-legend-open', 'true');
            await expect(legendButton(page)).toHaveAttribute('aria-expanded', 'true');
            // The key's sections come first, States first (item 24); the Basemap section is the last (the setup lists three), and the
            // first control took the focus.
            await expect(legendPanel(page).locator('.mapstudio-legend-heading').first()).toHaveText('States');
            await expect(legendPanel(page).locator('.mapstudio-legend-heading').last()).toHaveText('Basemap');
            await expect(page.locator('.mapstudio-basemap-button')).toHaveCount(3);
            await expect(page.locator('.mapstudio-legend-toggle[data-toggle="lines"]')).toBeFocused();
            const panelBox = await legendPanel(page).boundingBox();
            expect(panelBox.y + panelBox.height, 'the panel opens above the button').toBeLessThanOrEqual(buttonBox.y + 1);
            // It stops below the top bar (item 23): the search field's bottom edge, on a map as short as the viewport.
            const topBar = await page.locator('.mapstudio-topbar-row').boundingBox();
            expect(panelBox.y, 'the panel stops below the top bar').toBeGreaterThanOrEqual(topBar.y + topBar.height);
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
            // The bottom-right corner is the Perspective App Bar toggle's at every width: the controls keep clear of it,
            // and the attribution (small muted text along the bottom edge, item 3) sits under the toggle, never over it.
            const corner = { x: box.x + box.width - 64, y: box.y + box.height - 64 };
            for (const b of [await zoom.boundingBox(), await legendButton(page).boundingBox(), scaleBox]) {
                expect(b.x + b.width > corner.x && b.y + b.height > corner.y, 'nothing in the bottom-right corner').toBe(false);
            }
            const attribBox = await attribution(page).boundingBox();
            expect(attribBox.x + attribBox.width, 'the attribution along the bottom-right edge').toBeGreaterThan(box.x + box.width - 16);
            expect(attribBox.y + attribBox.height, 'inside the map').toBeLessThanOrEqual(box.y + box.height + 0.5);
            expect(attribBox.height, 'small').toBeLessThanOrEqual(16);
            expect(await attribution(page).evaluate((el) => parseFloat(getComputedStyle(el).fontSize)), 'small text').toBeLessThanOrEqual(11);
            if (await appBarToggle(page).count()) {
                expect(overlap(attribBox, await appBarToggle(page).boundingBox()), 'the attribution never covers the App Bar toggle').toBe(false);
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
        // The basemap is the project's setting; the dev setup lists three, so the sheet below has no switch on a phone
        // and the choice is made on a wider screen or is remembered (item 3): choose OpenStreetMap through the component.
        await page.evaluate(() => window.localStorage.setItem('mapstudio.basemap.v1', 'osm'));
        await page.reload({ waitUntil: 'load' });
        const phoneMap = await openMap(page, '/');
        await mapLoaded(phoneMap);
        await expect(phoneMap).toHaveAttribute('data-basemap', 'osm', { timeout: CHANGE_MS });
        await expect(attribution(page)).toContainText('OpenStreetMap contributors');
        await expect(phoneMap).toHaveAttribute('data-basemap-tiles', 'loaded', { timeout: CHANGE_MS });
        const legend = await legendButton(page).boundingBox();
        const scale = await page.locator('.maplibregl-ctrl-scale').boundingBox();
        expect(Math.abs((scale.y + scale.height) - (legend.y + legend.height)), 'the scale bar bottom-aligned with the Legend button (390)')
            .toBeLessThanOrEqual(1);
        await legendButton(page).click();
        await expect(legendPanel(page)).toBeVisible();
        // A bottom sheet like the popups (item 2): 8 px from the sides, above the Legend row, below the top bar, a handle and
        // a 44 px Close; Show (the Lines and Names toggles) first; the key in two columns; no Basemap section at all.
        await expect(legendPanel(page)).toHaveClass(/mapstudio-legend-panel--sheet/);
        const mapBox = await phoneMap.boundingBox();
        const panel = await legendPanel(page).boundingBox();
        expect(Math.round(panel.x - mapBox.x), 'the sheet 8 px from the left').toBe(8);
        expect(Math.round(mapBox.x + mapBox.width - (panel.x + panel.width)), 'the sheet 8 px from the right').toBe(8);
        expect(panel.y + panel.height, 'above the Legend row').toBeLessThanOrEqual(legend.y + 1);
        const bar = await page.locator('.mapstudio-topbar').boundingBox();
        expect(panel.y, 'the sheet stops below the top bar').toBeGreaterThanOrEqual(bar.y + bar.height);
        await expect(legendPanel(page).locator('.mapstudio-legend-handle')).toBeVisible();
        const close = await legendPanel(page).locator('.mapstudio-legend-close').boundingBox();
        expect(Math.min(close.width, close.height), 'a 44 px Close').toBeGreaterThanOrEqual(44);
        const headings = await legendPanel(page).locator('.mapstudio-legend-heading').allTextContents();
        expect(headings[0], 'Show first').toBe('Show');
        expect(headings).not.toContain('Basemap');
        await expect(page.locator('.mapstudio-basemap-button')).toHaveCount(0);
        await expect(legendPanel(page).locator('.mapstudio-legend-toggle')).toHaveCount(2);
        const showBox = await legendPanel(page).locator('.mapstudio-legend-section--show').boundingBox();
        const statesBox = await legendPanel(page).locator('.mapstudio-legend-section--states').boundingBox();
        expect(showBox.y, 'Show above the key').toBeLessThan(statesBox.y);
        // Two columns: the key's sections start at two different x (the first of each column).
        const xs = await legendPanel(page).locator('.mapstudio-legend-columns .mapstudio-legend-section').evaluateAll(
            (els) => els.map((el) => Math.round(el.getBoundingClientRect().x)));
        expect(new Set(xs).size, 'the key in two columns').toBe(2);
        // The sheet scrolls inside: every Show checkbox is reachable and the body is the scroller.
        const scrolls = await legendPanel(page).locator('.mapstudio-legend-body').evaluate((el) => getComputedStyle(el).overflowY);
        expect(scrolls).toBe('auto');
        // Every control button is a 44 px touch target (DESIGN.md target-touch), the sheet's included.
        for (const b of await page.locator('.mapstudio .maplibregl-ctrl button').all()) {
            const r = await b.boundingBox();
            expect(Math.min(r.width, r.height), (await b.getAttribute('aria-label')) || (await b.textContent())).toBeGreaterThanOrEqual(44);
        }
        const zoom = await page.locator('.mapstudio-zoom').boundingBox();
        const attrib = await attribution(page).boundingBox();
        for (const box of [zoom, panel, attrib]) {
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(390);
        }
        await shot(page, 'mapstudio-basemap-390.png');
        // The Close button closes it and the Legend button has the focus.
        await legendPanel(page).locator('.mapstudio-legend-close').click();
        await expect(legendPanel(page)).toHaveCount(0);
        await expect(legendButton(page)).toBeFocused();
        // The bottom-right 64 px corner is the Perspective App Bar toggle's (DESIGN.md): the controls keep clear of it and the
        // attribution sits under the toggle (item 3).
        const corner = { x: 390 - 64, y: 844 - 64 };
        for (const box of [zoom, legend, scale]) {
            const inCorner = box.x + box.width > corner.x && box.y + box.height > corner.y;
            expect(inCorner, 'nothing in the bottom-right corner').toBe(false);
        }
        if (await appBarToggle(page).count()) {
            expect(overlap(attrib, await appBarToggle(page).boundingBox()), 'the attribution never covers the App Bar toggle').toBe(false);
        }
        await shot(page, 'mapstudio-controls-390.png');
    });

    test('with Satellite the Mapbox logo and its four links fit a phone beside the Legend row, clear of the App Bar toggle',
        async ({ page, watched }) => {
            await stubTiles(page);
            const first = await openMap(page, '/');
            await mapLoaded(first);
            // No switch on a phone (item 3): Satellite is the remembered choice, made on a wider screen.
            await page.evaluate(() => window.localStorage.setItem('mapstudio.basemap.v1', 'satellite'));
            await page.reload({ waitUntil: 'load' });
            const map = await openMap(page, '/');
            await mapLoaded(map);
            await expect(map).toHaveAttribute('data-basemap', 'satellite', { timeout: CHANGE_MS });
            await expect(map).toHaveAttribute('data-basemap-tiles', 'loaded', { timeout: CHANGE_MS });
            await expectMapboxAttribution(page, map);
            await expectLogoPlaced(page, map);
            // The four links do not fit beside the row on a phone: the attribution is one line just above the Legend row.
            const attrib = await attribution(page).boundingBox();
            const legend = await legendButton(page).boundingBox();
            expect(attrib.height, 'one line').toBeLessThanOrEqual(16);
            expect(attrib.y + attrib.height, 'above the Legend row').toBeLessThanOrEqual(legend.y);
            expect(attrib.x + attrib.width, 'clear of the App Bar corner').toBeLessThanOrEqual(390 - 64);
            // OpenStreetMap remembered instead: no logo, and the attribution is back along the bottom edge.
            await page.evaluate(() => window.localStorage.setItem('mapstudio.basemap.v1', 'osm'));
            await page.reload({ waitUntil: 'load' });
            const osm = await openMap(page, '/');
            await mapLoaded(osm);
            await expect(osm).toHaveAttribute('data-basemap', 'osm', { timeout: CHANGE_MS });
            await expect(attribution(page)).toContainText('OpenStreetMap contributors');
            await expect(mapboxLogo(page)).toHaveCount(0);
            const osmBox = await attribution(page).boundingBox();
            const mapBox = await osm.boundingBox();
            expect(osmBox.y + osmBox.height, 'along the bottom edge').toBeGreaterThan(mapBox.y + mapBox.height - 4);
            expect(watched.warnings).toEqual([]);
        });
});
