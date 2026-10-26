// Shared test plumbing: error watching and opening the Map Studio view.

import { expect, test as base } from '@playwright/test';
import { sessionUrl } from '../lib/env.mjs';

/** Collect browser page errors and console errors, and Map Studio console warnings. */
export function watch(page) {
    const errors = [];
    const warnings = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
        if (msg.type() === 'warning' && msg.text().includes('[MapStudio]')) warnings.push(msg.text());
    });
    return { errors, warnings };
}

/** `test` whose every test fails on any browser console error or page error. */
export const test = base.extend({
    watched: [
        async ({ page }, use) => {
            const w = watch(page);
            await use(w);
            expect(w.errors, 'browser console and page errors').toEqual([]);
        },
        { auto: true }
    ]
});
export { expect };

/**
 * How long a test waits, after the state it can observe, to let a late console
 * warning arrive before it asserts "no warning" or "exactly one warning". There
 * is no observable state for the absence of a warning, so this is a stated
 * settle time, not a synchronisation.
 */
export const WARNING_SETTLE_MS = 500;

/**
 * Open a dev project page and wait until the map reports itself ready: the
 * component sets data-map-ready after MapLibre's load and first idle, with both
 * sources and layers added, and writes the counts it read back from MapLibre.
 * Returns the map locator.
 */
export async function openMap(page, pagePath = '/') {
    await page.goto(sessionUrl(pagePath), { waitUntil: 'load' });
    const map = page.locator('.mapstudio-map');
    await map.waitFor({ state: 'visible', timeout: 60_000 });
    // Perspective may drop the websocket once right after a Gateway restart;
    // the banner's active class is the signal that it is reconnecting.
    await page.waitForSelector('.connection-banner.banner-active', { state: 'detached', timeout: 30_000 }).catch(() => {});
    await expect(map).toHaveAttribute('data-map-ready', 'true', { timeout: 60_000 });
    await page.locator('.mapstudio-reply').waitFor({ state: 'visible' });
    return map;
}

/** The counts the component read back from MapLibre's sources. */
export async function loadedCounts(map) {
    return {
        points: Number(await map.getAttribute('data-points-loaded')),
        lines: Number(await map.getAttribute('data-lines-loaded'))
    };
}

/**
 * Wait for two animation frames in the page, so a map that has just changed has
 * had the chance to draw it before a screenshot. A frame boundary, not a time.
 */
export async function nextFrames(page) {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
