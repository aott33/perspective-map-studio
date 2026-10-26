#!/usr/bin/env node
// Capture the mapstudio-dev view in headless Chromium at 1440 and 390 px wide,
// after clicking one point and drawing one line with the line tool, and save
// the images to docs/screenshots/.
//
// Usage: node ops/screenshot.mjs [--url http://localhost:9088]
// The Gateway URL defaults to GATEWAY_URL, else http://localhost:9088; with a
// GATEWAY_HTTP_PORT in .env pass --url http://localhost:<port>.
//
// Needs Playwright with its Chromium (`npm i -g playwright` plus
// `npx playwright install chromium`, or an environment that has them). Fails
// on any console error or page error in the session, and when the Gateway
// does not answer the click.

import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', 'docs', 'screenshots');
const argUrl = process.argv.indexOf('--url');
const baseUrl = argUrl > -1 ? process.argv[argUrl + 1] : (process.env.GATEWAY_URL ?? 'http://localhost:9088');
const session = `${baseUrl}/data/perspective/client/mapstudio-dev`;

// The map's fixed view and test data (web/typescript/testData.ts). The click
// target is projected with the Web Mercator formula MapLibre uses, so the
// script needs no handle on the map object.
const CENTER = [-104.9725, 39.7445];
const ZOOM = 12.5;
const POINT = { id: 'p1', lngLat: [-104.9903, 39.7392] };
// Pixel offsets from the map centre for the drawn line's two vertices, chosen
// to miss the three test points at this zoom on both viewports.
const DRAW_OFFSETS = [[-60, 120], [110, 40]];

function project([lng, lat], zoom) {
    const scale = 512 * Math.pow(2, zoom);
    const x = ((lng + 180) / 360) * scale;
    const rad = (lat * Math.PI) / 180;
    const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale;
    return [x, y];
}

async function capture(browser, width, height) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });

    await page.goto(session, { waitUntil: 'load' });
    const map = page.locator('.mapstudio-map');
    await map.waitFor({ state: 'visible', timeout: 60_000 });
    await page.locator('.mapstudio-map canvas').waitFor({ state: 'visible', timeout: 30_000 });
    // Perspective may drop the websocket once right after a Gateway restart;
    // the banner's active class is the signal that it is reconnecting.
    await page.waitForSelector('.connection-banner.banner-active', { state: 'detached', timeout: 30_000 }).catch(() => {});
    await page.locator('.mapstudio-reply').waitFor({ state: 'visible' });
    // Let MapLibre finish its first frame and add the layers.
    await page.waitForTimeout(1500);

    const box = await map.boundingBox();
    if (!box) throw new Error('map container has no bounding box');
    const [cx, cy] = project(CENTER, ZOOM);
    const [px, py] = project(POINT.lngLat, ZOOM);
    const x = box.x + box.width / 2 + (px - cx);
    const y = box.y + box.height / 2 + (py - cy);
    await page.mouse.click(x, y);

    const reply = page.locator('.mapstudio-reply');
    await reply.filter({ hasText: `Gateway received click on ${POINT.id}` }).waitFor({ timeout: 15_000 });
    const replyText = await reply.textContent();

    // Draw one line with Terra Draw: toggle the tool, click two spots clear of
    // the test points, press Enter to finish. The status line reports the count.
    const toggle = page.locator('.mapstudio-draw-button');
    const [ax, ay] = [box.x + box.width / 2 + DRAW_OFFSETS[0][0], box.y + box.height / 2 + DRAW_OFFSETS[0][1]];
    const [bx, by] = [box.x + box.width / 2 + DRAW_OFFSETS[1][0], box.y + box.height / 2 + DRAW_OFFSETS[1][1]];

    // Cancel first: one vertex, then Escape leaves the tool with nothing drawn.
    await toggle.click();
    await page.waitForSelector('.mapstudio-reply[data-drawing="true"]', { timeout: 5_000 });
    await page.mouse.click(ax, ay);
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForSelector('.mapstudio-reply[data-drawing="false"][data-line-points=""]', { timeout: 5_000 });
    if (await page.locator('.mapstudio-draw-button[aria-pressed="true"]').count() !== 0) {
        throw new Error('the line tool is still pressed after Escape');
    }

    await toggle.click();
    await page.waitForSelector('.mapstudio-reply[data-drawing="true"]', { timeout: 5_000 });
    await page.mouse.click(ax, ay);
    await page.waitForTimeout(300);
    await page.mouse.click(bx, by);
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForSelector('.mapstudio-reply[data-line-points="2"]', { timeout: 5_000 });
    const text = await reply.locator('.mapstudio-draw-status').textContent();
    // Let Terra Draw's layers render the finished line.
    await page.waitForTimeout(500);

    const file = path.join(outDir, `mapstudio-dev-${width}.png`);
    await page.screenshot({ path: file, fullPage: false });
    await context.close();
    return { file, text: `${replyText} | ${text}`, errors };
}

async function main() {
    await mkdir(outDir, { recursive: true });
    const browser = await chromium.launch({
        headless: true,
        // Software WebGL for MapLibre on a machine with no GPU.
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    });
    let failed = false;
    try {
        for (const [width, height] of [[1440, 900], [390, 844]]) {
            const { file, text, errors } = await capture(browser, width, height);
            console.log(`${width}px: ${file}`);
            console.log(`  reply: ${text}`);
            if (errors.length) {
                failed = true;
                console.error(`  ${errors.length} error(s) in the session:`);
                errors.forEach((e) => console.error(`    ${e}`));
            }
        }
    } finally {
        await browser.close();
    }
    if (failed) process.exit(1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
