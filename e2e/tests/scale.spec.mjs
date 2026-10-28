// The 30-pad scale set, seeded into the dev map through system.mapstudio (epic 2 story 11):
// the seed is MapEditor only, safe to re-run (a second run changes nothing, a deleted seed
// item is restored), and / draws the set from the map store.

import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { screenshotDir } from '../lib/env.mjs';
import {
    EDITOR_USER, editorTest, ensureSeeded, expect, loadedCounts, mapLoaded, nextFrames, openMap, runSeed,
    signedInContext, test
} from './fixtures.mjs';

const UUID5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

test('the seed needs the MapEditor role', async ({ page, browser }) => {
    test.setTimeout(240_000);
    // An editor deletes a seed item first, so a seed that ran anyway would show: it would restore it.
    const seed = await ensureSeeded(browser);
    const padId = seed.ids['scale/pad-29'];
    const editor = await signedInContext(browser, EDITOR_USER);
    try {
        const editorPage = await editor.newPage();
        await mapLoaded(await openMap(editorPage, '/edit'));
        await editorPage.waitForFunction(() => Boolean(window.__mapStudioTest));
        const send = (type, body) => editorPage.evaluate(([t, b]) => window.__mapStudioTest.send(t, b), [type, body]);
        const live = async () => (await send('map.load', {})).body.items.find((i) => i.id === padId && !i.deleted);
        const pad = await live();
        expect(pad, 'Pad 29 in map.load').toBeDefined();
        const deleted = await send('edits.apply', { batchId: randomUUID(), ops: [
            { op: 'delete', entity: 'item', id: padId, baseVersion: pad.version }] });
        expect(deleted.type, JSON.stringify(deleted.body)).toBe('edits.apply.reply');

        const map = await openMap(page, '/edit');
        await expect(page.locator('#mapstudio-dev-user')).toContainText('Not signed in');
        await mapLoaded(map);
        const result = await runSeed(page);
        expect(result.refused).toMatch(/needs the MapEditor role/);
        expect(result.seq).toBeUndefined();
        expect(await live(), 'Pad 29 still deleted: nothing was seeded').toBeUndefined();

        // Put it back for the specs after this one.
        const restored = await runSeed(editorPage);
        expect(restored).toMatchObject({ restored: 1, scale: { pads: 30, lines: 30 } });
    } finally {
        await editor.close();
    }
});

editorTest('the seed is safe to re-run and restores a deleted seed item', async ({ page }) => {
    test.setTimeout(240_000);
    const map = await openMap(page, '/edit');
    await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
    await mapLoaded(map);

    const first = await runSeed(page);
    expect(first.error).toBeUndefined();
    expect(first.created + first.updated + first.restored + first.unchanged).toBe(74);
    expect(first.scale).toEqual({ pads: 30, lines: 30 });
    expect(Object.keys(first.ids)).toHaveLength(74);
    for (const id of Object.values(first.ids)) expect(id).toMatch(UUID5);

    const second = await runSeed(page);
    expect(second).toMatchObject({ created: 0, updated: 0, restored: 0, unchanged: 74, seq: null,
        scale: { pads: 30, lines: 30 } });
    expect(second.ids).toEqual(first.ids);

    // Delete Pad 30 through the component's real session path, then seed again: restored.
    await page.waitForFunction(() => Boolean(window.__mapStudioTest));
    const send = (type, body) => page.evaluate(([t, b]) => window.__mapStudioTest.send(t, b), [type, body]);
    const loaded = await send('map.load', {});
    const pad = loaded.body.items.find((i) => i.id === first.ids['scale/pad-30']);
    expect(pad, 'Pad 30 in map.load').toBeDefined();
    const deleted = await send('edits.apply', { batchId: randomUUID(), ops: [
        { op: 'delete', entity: 'item', id: pad.id, baseVersion: pad.version }] });
    expect(deleted.type, JSON.stringify(deleted.body)).toBe('edits.apply.reply');

    const third = await runSeed(page);
    expect(third).toMatchObject({ created: 0, updated: 0, restored: 1, unchanged: 67, scale: { pads: 30, lines: 30 } });
    expect(third.seq).toBeGreaterThan(0);
    const fourth = await runSeed(page);
    expect(fourth).toMatchObject({ restored: 0, unchanged: 74, seq: null, scale: { pads: 30, lines: 30 } });
});

test('/ draws the seeded 30-pad set and the tracer from the map store', async ({ page, browser }) => {
    await ensureSeeded(browser);
    const map = await openMap(page, '/');
    await mapLoaded(map);
    // Read back from MapLibre's own item sources by the component: the 33 seeded pads, the shared pair as
    // one marker (epic 3 entry 7) and 31 lines, plus any other spec's items inside the view.
    const counts = await loadedCounts(map);
    expect(counts.points).toBeGreaterThanOrEqual(34);
    expect(counts.lines).toBeGreaterThanOrEqual(31);
    await nextFrames(page);
    mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, 'mapstudio-scale-1440.png') });
});
