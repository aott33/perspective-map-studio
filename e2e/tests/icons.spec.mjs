// Story 2.10: the icon set the module serves. The Gateway serves the sprite,
// the catalogue and the owner's contact sheet under /res/mapstudio/icons/ with
// usable content types, and the contact sheet renders every icon at a laptop
// and a phone width with no horizontal scroll. The screenshots are the owner's
// review pictures (docs/icons.md). Phase B: a kind naming an icon the set does
// not have stays listed and map.load's kind status names it in words.

import path from 'node:path';
import { screenshotDir } from '../lib/env.mjs';
import { EDITOR_USER, editorTest, expect, mapLoaded, openMap, test } from './fixtures.mjs';

const BASE = '/res/mapstudio/icons/';
const ICON_COUNT = 28;

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

test.describe('kind icon check', () => {
    test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

    const PAGE = '/adapters';
    const KINDS_FN = 'mapstudio_dev.kinds';
    const UNKNOWN = 'Kind pad names icon wel-pad, which Map Studio does not have; it shows as a plain point.';

    async function press(page, button, mode) {
        await page.locator('#mapstudio-dev-adapter-' + button).click();
        await expect(page.locator('#mapstudio-dev-adapter-result')).toContainText(`"mode":"${mode}"`, { timeout: 60_000 });
        return JSON.parse(await page.locator('#mapstudio-dev-adapter-result').textContent());
    }

    async function kindsAfterReload(page) {
        await page.reload({ waitUntil: 'load' });
        await mapLoaded(await openMap(page, PAGE));
        const el = page.locator('.mapstudio-adapter-status');
        await expect(el).toHaveAttribute('data-kinds-status', /.+/);
        return {
            status: await el.getAttribute('data-kinds-status'),
            message: await el.getAttribute('data-kinds-message'),
            rows: await el.getAttribute('data-kinds-rows')
        };
    }

    editorTest('a kind naming an unknown icon stays listed and its status names the kind and the icon', async ({ page }) => {
        await mapLoaded(await openMap(page, PAGE));
        await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);

        // The dev kinds name real icons: ok with no icon note.
        await press(page, 'ok', 'ok');
        let k = await kindsAfterReload(page);
        expect(k).toEqual({ status: 'ok', message: `3 kinds from ${KINDS_FN}.`, rows: '3' });

        const r = await press(page, 'unknown-icon', 'unknown-icon');
        expect(r.kinds.status).toBe('ok');
        expect(r.kinds.message).toBe(`3 kinds from ${KINDS_FN}. ${UNKNOWN}`);
        k = await kindsAfterReload(page);
        expect(k).toEqual({ status: 'ok', message: `3 kinds from ${KINDS_FN}. ${UNKNOWN}`, rows: '3' });

        await press(page, 'ok', 'ok');
        k = await kindsAfterReload(page);
        expect(k.message).toBe(`3 kinds from ${KINDS_FN}.`);
    });
});
