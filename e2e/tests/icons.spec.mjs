// Story 2.10: the icon set the module serves. The Gateway serves the sprite,
// the catalogue and the owner's contact sheet under /res/mapstudio/icons/ with
// usable content types, and the contact sheet renders every icon at a laptop
// and a phone width with no horizontal scroll. The screenshots are the owner's
// review pictures (docs/icons.md).

import path from 'node:path';
import { screenshotDir } from '../lib/env.mjs';
import { expect, test } from './fixtures.mjs';

const BASE = '/res/mapstudio/icons/';
const ICON_COUNT = 27;

/** File, and a content type the browser accepts for its use. */
const SERVED = [
    ['mapstudio-icons.svg', /^image\/svg\+xml/],
    ['icons.json', /^(application\/json|text\/plain)/],
    ['contact-sheet.html', /^text\/html/]
];

for (const [file, type] of SERVED) {
    test(`the Gateway serves ${file} with a usable content type`, async ({ request }) => {
        const res = await request.get(BASE + file);
        expect(res.status(), `${file} status`).toBe(200);
        const contentType = res.headers()['content-type'] ?? '';
        test.info().annotations.push({ type: 'content-type', description: `${file}: ${contentType || '(none)'}` });
        expect(contentType, `${file} content type`).toMatch(type);
    });
}

test('the served catalogue lists every icon', async ({ request }) => {
    const res = await request.get(BASE + 'icons.json');
    const catalogue = JSON.parse(await res.text());
    expect(catalogue.icons).toHaveLength(ICON_COUNT);
    expect(catalogue.fallback).toBe('point');
});

for (const width of [1440, 390]) {
    test(`contact sheet at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(BASE + 'contact-sheet.html', { waitUntil: 'load' });
        // Two theme panels, each with every icon once.
        await expect(page.locator('figure.icon')).toHaveCount(ICON_COUNT * 2);
        // Every glyph resolves to a symbol in the inline sprite and draws something.
        const empty = await page.evaluate(() => [...document.querySelectorAll('figure.icon .s24 svg')]
            .filter((svg) => {
                const box = svg.querySelector('use').getBBox();
                return !(box.width > 0 && box.height > 0);
            }).length);
        expect(empty, 'icons that draw nothing').toBe(0);
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(scrollWidth, 'no horizontal scroll').toBeLessThanOrEqual(width);
        await page.screenshot({ path: path.join(screenshotDir, `icons-contact-sheet-${width}.png`), fullPage: true });
    });
}
