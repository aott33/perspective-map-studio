// The tracer view at 1440 and 390 px: the seeded map items (epic 2 story 11), the round
// trip, the popup view and a drawn line; one screenshot per width for the docs (AD-15).
// On the dev editing page /edit as the map editor (epic 3 entry 14, epic 4 entry 4): the
// toolbar's Line tool is Edit mode's at level full and 768 px and wider, so the line is drawn
// with it at 1440 px and goes through the test hook at 390 px, where no tool shows.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { screenshotDir } from '../lib/env.mjs';
import { TRACER, pagePixel } from '../lib/geo.mjs';
import {
    EDITOR_USER, VERTEX_PAUSE_MS, drawLine, editorTest, ensureSeeded, expect, hookLineBatch, loadedCounts, mapLoaded, nextFrames, openMap, send, test
} from './fixtures.mjs';

let seed;
test.beforeAll(async ({ browser }) => {
    seed = await ensureSeeded(browser);
});

// The dev View page (owner review notes items 4 and 5): with items in the store its line is the click hint (the
// view's startup script counts them; the empty-map hint to seed from /edit is in the item 4 render), and a click
// round trip shows no echo, only the map's `data-last-reply` (epic 4 entry 24: the status box is gone at every width).
editorTest('the dev View page: the click hint with items, and no click echo in View mode', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const map = await openMap(page, '/');
    await mapLoaded(map);
    await expect(page.locator('#mapstudio-dev-title')).toContainText('Click a point for its popup', { timeout: 15_000 });
    const box = await map.boundingBox();
    const p1 = seed.ids[TRACER.points.p1.key];
    const [x, y] = pagePixel(box, TRACER.points.p1.lngLat, TRACER.center, TRACER.zoom);
    await page.mouse.click(x, y);
    await expect(map).toHaveAttribute('data-last-reply', new RegExp('Gateway received click on ' + p1), { timeout: 15_000 });
    await expect(page.getByText(/Gateway received click/)).toHaveCount(0);
    await expect(page.locator('.mapstudio-reply')).toHaveCount(0);
    await expect(page.locator('.mapstudio-chip')).toHaveCount(0);
});

for (const [width, height] of [[1440, 900], [390, 844]]) {
    test.describe(`${width} px`, () => {
        test.use({ viewport: { width, height }, deviceScaleFactor: 1 });

        editorTest('map, round trip, popup view and a drawn line', async ({ page }) => {
            const map = await openMap(page, '/edit');
            await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
            // Read back from MapLibre's own item sources by the component, not from its input: at least
            // the tracer's three points and its line (the phone's tiles hold only part of the 30-pad set).
            const counts = await loadedCounts(map);
            expect(counts.points).toBeGreaterThanOrEqual(width === 1440 ? 33 : 3);
            expect(counts.lines).toBeGreaterThanOrEqual(width === 1440 ? 31 : 1);
            const p1 = seed.ids[TRACER.points.p1.key];
            const box = await map.boundingBox();
            expect(box, 'map container has a bounding box').not.toBeNull();
            // The component fills the width of the viewport; at 1440 px the map is docked beside the studio's rail and
            // list (epic 4 entry 2: 72 and 280 px, the editor's /edit page opens in Edit mode), at 390 px the studio never shows.
            const root = await page.locator('.mapstudio').boundingBox();
            expect(Math.abs(root.width - width)).toBeLessThanOrEqual(1);
            expect(Math.round(box.width)).toBe(width === 1440 ? width - 72 - 280 : width);

            // One round trip: click p1, the Gateway answers in the envelope.
            const [x, y] = pagePixel(box, TRACER.points.p1.lngLat, TRACER.center, TRACER.zoom);
            await page.mouse.click(x, y);
            // The map's `data-last-reply` holds the reply, and nothing shows it (epic 4 entry 24, owner 2026-11-05: the status box
            // and its click echo are gone at every width): not in Edit mode at 1440 px, not at 390 px, which keeps View mode.
            await expect(map).toHaveAttribute('data-last-reply', new RegExp('Gateway received click on ' + p1), { timeout: 15_000 });
            await expect(map).toHaveAttribute('data-studio', width >= 768 ? 'on' : 'off');
            await expect(page.getByText(/Gateway received click/)).toHaveCount(0);
            await expect(page.locator('.mapstudio-reply')).toHaveCount(0);
            await expect(page.locator('.mapstudio-chip')).toHaveCount(0);

            // The click also opens the default popup from the pad kind setup (a card at 1440 px, a
            // bottom sheet at 390 px; epic 3 entry 8 retired the spike's popupView prop).
            const popup = page.locator((width === 1440 ? '.maplibregl-popup' : '.mapstudio-sheet') + ' .mapstudio-popup--default');
            await expect(popup).toBeVisible({ timeout: 30_000 });
            await expect(popup).toHaveAttribute('data-point-id', p1);
            await expect(popup.locator('.mapstudio-popup-name')).toHaveText('Point 1');
            // Closed before drawing: at 390 px the sheet covers the middle of the map, where the vertices go.
            await popup.locator('.mapstudio-popup-close').click();
            await expect(page.locator('.mapstudio-popup--default')).toHaveCount(0);

            const before = Number(await map.getAttribute('data-items-loaded'));
            if (width >= 768) {
                // Escape cancels a drawing: one vertex, then nothing is drawn, Select is in hand and nothing talks (no pill).
                const cx = box.x + box.width / 2;
                const cy = box.y + box.height / 2;
                const [a] = TRACER.drawOffsets.map(([dx, dy]) => [cx + dx, cy + dy]);
                await expect(page.locator('.mapstudio-toolbar')).toBeVisible();
                await page.locator('.mapstudio-tool--line').click();
                await expect(map).toHaveAttribute('data-tool', 'line');
                const bar = page.locator('.mapstudio-drawing-bar');
                await page.mouse.click(a[0], a[1]);
                await expect(bar).toHaveAttribute('data-points', '1');
                await page.waitForTimeout(VERTEX_PAUSE_MS);
                await page.keyboard.press('Escape');
                await expect(bar).toHaveCount(0);
                await expect(map).toHaveAttribute('data-tool', '');
                await expect(page.locator('.mapstudio-pill')).toHaveCount(0);
                await expect(page.locator('.mapstudio-tool--select')).toHaveAttribute('aria-pressed', 'true');
                await expect(page.locator('.mapstudio-tool--line')).toHaveAttribute('aria-pressed', 'false');
                await expect(map).toHaveAttribute('data-items-loaded', String(before));

                // A two-vertex line finished with Enter: saved at once, selected, its two vertices in the map store. The map keeps
                // the save's state for the suite (entry 24); the header says Saved and nothing else talks of a success.
                await drawLine(page, map);
                await expect(map).toHaveAttribute('data-save-state', 'saved', { timeout: 30_000 });
                await expect(page.locator('.mapstudio-panel-save')).toHaveText('Saved');
                await expect(page.locator('.mapstudio-panel-save--row')).toHaveCount(0);
                await expect(map).toHaveAttribute('data-items-loaded', String(before + 1), { timeout: 15_000 });
                const lineId = await map.getAttribute('data-selected');
                const saved = (await send(page, 'map.load', {})).body.items.find((i) => i.id === lineId);
                expect(saved.geometry.coordinates).toHaveLength(2);
            } else {
                // No tool below 768 px: the line goes through the test hook (the component's real session path) and is drawn from map.changed.
                await expect(page.locator('.mapstudio-toolbar')).toHaveCount(0);
                const reply = await send(page, 'edits.apply', hookLineBatch('Tracer phone line', 0.004));
                expect(reply.type, JSON.stringify(reply.body)).toBe('edits.apply.reply');
                await expect(map).toHaveAttribute('data-items-loaded', String(before + 1), { timeout: 15_000 });
            }
            // Let the map draw the finished line: two frame boundaries, not a time.
            await nextFrames(page);

            mkdirSync(screenshotDir, { recursive: true });
            await page.screenshot({ path: path.join(screenshotDir, `mapstudio-dev-${width}.png`), fullPage: false });
        });
    });
}
