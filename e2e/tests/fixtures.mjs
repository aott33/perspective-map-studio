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
 * Open a dev project page and wait until the map has drawn its first frame.
 * Returns the map locator. `waitReply: false` is for the popup fallback pages,
 * which have the same component and so the same reply box.
 */
export async function openMap(page, pagePath = '/') {
    await page.goto(sessionUrl(pagePath), { waitUntil: 'load' });
    const map = page.locator('.mapstudio-map');
    await map.waitFor({ state: 'visible', timeout: 60_000 });
    await page.locator('.mapstudio-map canvas').waitFor({ state: 'visible', timeout: 30_000 });
    // Perspective may drop the websocket once right after a Gateway restart;
    // the banner's active class is the signal that it is reconnecting.
    await page.waitForSelector('.connection-banner.banner-active', { state: 'detached', timeout: 30_000 }).catch(() => {});
    await page.locator('.mapstudio-reply').waitFor({ state: 'visible' });
    // Let MapLibre finish its first frame and add the layers.
    await page.waitForTimeout(1500);
    return map;
}
