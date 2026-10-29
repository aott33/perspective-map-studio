#!/usr/bin/env node
// Side-by-side images of the showcase renders and the UX mockups (epic 3 entry 15): each
// docs/screenshots/showcase-*.png (e2e/tests/showcase.spec.mjs with E2E_DOCS=1) on the left, its mockup
// from _bmad-output/initiative-flowmap/ux-map-studio/mockups/ on the right, composed by Playwright from an
// HTML page into docs/screenshots/showcase-compare-*.png for the UX comparison
// (ux-map-studio/review-showcase-vs-mockups.md) and the owner's acceptance. No Gateway and no new
// dependency: it uses the e2e suite's Playwright (cd e2e && npm ci first) and the same Chromium
// (PW_CHROMIUM_PATH where the pinned Playwright cannot find one).
//
// Usage: node scripts/showcase-compare.mjs [--out <folder>]

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(root, 'docs', 'screenshots');
const mockups = path.join(root, '_bmad-output', 'initiative-flowmap', 'ux-map-studio', 'mockups');
const outArg = process.argv.indexOf('--out');
const out = outArg >= 0 && process.argv[outArg + 1] ? path.resolve(process.argv[outArg + 1]) : shots;

/** The pairs: the render, its mockup, the width both are shown at (the mockup's), and the caption. */
export const PAIRS = [
    { name: 'view-mode-1440', render: 'showcase-view-mode-1440.png', mockup: 'view-mode-1440.png', caption: 'View mode at 1440 px' },
    { name: 'view-mode-needs-you-1440', render: 'showcase-view-mode-needs-you-1440.png', mockup: 'view-mode-needs-you-1440.png',
        caption: 'The Needs you list and the legend open, 1440 px' },
    { name: 'view-desktop-popup-1366', render: 'showcase-view-desktop-popup-1366.png', mockup: 'key-screen-1-view-desktop-popup.png',
        caption: 'P14\'s popup at 1366 px' },
    { name: 'line-instruments-1366', render: 'showcase-line-instruments-1366.png', mockup: 'key-screen-3-line-instruments-live.png',
        caption: 'The L-SWD line popup at zoom 16, 1366 px' },
    { name: 'phone-sheet-390', render: 'showcase-phone-sheet-390.png', mockup: 'key-screen-2-phone-sheet.png', caption: 'P14\'s bottom sheet at 390 px' }
];

const GAP = 24;
const CAPTION = 36;

function dataUri(file) {
    return 'data:image/png;base64,' + readFileSync(file).toString('base64');
}

/** The PNG's width and height from its IHDR chunk. */
function pngSize(file) {
    const b = readFileSync(file);
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function page(pair, left, right, size) {
    const width = size.width * 2 + GAP * 3;
    const height = size.height + CAPTION + GAP * 2;
    return `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; background: #ffffff; font: 600 14px/1.3 system-ui, sans-serif; color: #323232; }
    .pair { display: flex; gap: ${GAP}px; padding: ${GAP}px; width: ${width}px; height: ${height}px; box-sizing: border-box; }
    figure { margin: 0; width: ${size.width}px; }
    figcaption { height: ${CAPTION}px; }
    figcaption span { font-weight: 400; color: #5e5e5e; }
    img { display: block; width: ${size.width}px; height: ${size.height}px; object-fit: contain; object-position: top left;
        background: #f4f4f4; outline: 1px solid #d8d8d8; }
    </style></head><body><div class="pair">
    <figure><figcaption>Render <span>${pair.caption} (${pair.render})</span></figcaption><img src="${left}" alt=""></figure>
    <figure><figcaption>Mockup <span>${pair.mockup}</span></figcaption><img src="${right}" alt=""></figure>
    </div></body></html>`;
}

async function main() {
    const e2eRequire = createRequire(path.join(root, 'e2e', 'package.json'));
    let chromium;
    try {
        ({ chromium } = e2eRequire('@playwright/test'));
    } catch (err) {
        console.error('Playwright is not installed: run `npm ci` in e2e/ first.');
        process.exit(2);
    }
    const launchOptions = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };
    if (process.env.PW_CHROMIUM_PATH) launchOptions.executablePath = process.env.PW_CHROMIUM_PATH;
    const browser = await chromium.launch(launchOptions);
    mkdirSync(out, { recursive: true });
    let missing = 0;
    try {
        for (const pair of PAIRS) {
            const left = path.join(shots, pair.render);
            const right = path.join(mockups, pair.mockup);
            if (!existsSync(left) || !existsSync(right)) {
                console.error(`Missing ${existsSync(left) ? right : left}`);
                missing++;
                continue;
            }
            const size = pngSize(right);
            const width = size.width * 2 + GAP * 3;
            const height = size.height + CAPTION + GAP * 2;
            const tab = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
            await tab.setContent(page(pair, dataUri(left), dataUri(right), size), { waitUntil: 'load' });
            const file = path.join(out, `showcase-compare-${pair.name}.png`);
            await tab.screenshot({ path: file, fullPage: false });
            await tab.close();
            console.log(`${path.relative(root, file)}: ${width} x ${height}`);
        }
    } finally {
        await browser.close();
    }
    if (missing > 0) {
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
