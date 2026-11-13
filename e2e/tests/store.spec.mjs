// The map store tracer (epic-map-store-and-data, entry 1): a map editor's line is
// saved through edits.apply and drawn from map.load after a reload; a viewer's
// save is refused on the Gateway; system.mapstudio saves through the same write
// service. Screenshots at 1440 and 390 px for the docs (AD-15). Since epic 4 entry 4 the
// editor draws with the toolbar's Line tool, which shows at level full and 768 px and wider,
// so the editor's page is opened wide enough to draw and the viewer's line goes through the
// test hook (the component's real session path, judged on the Gateway from the session's roles).

import { EDITOR_USER, drawLine, editorTest, expect, hookLineBatch, mapLoaded, openMap, send, shot, test, UUID } from './fixtures.mjs';

for (const [width, height] of [[1440, 900], [390, 844]]) {
    test.describe(`${width} px`, () => {
        test.use({ viewport: { width, height }, deviceScaleFactor: 1 });

        editorTest('a map editor saves a line and it comes back from the map store after a reload', async ({ page }) => {
            // Signed in by the global setup (lib/editorAuth.mjs): the password never passes through this test.
            if (width < 768) {
                // No drawing tool below 768 px (epic 4 entry 4): the line is drawn at a laptop width and the phone width comes back for the reload.
                await page.setViewportSize({ width: 1366, height: 768 });
            }
            let map = await openMap(page, '/edit');
            await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
            const before = await mapLoaded(map);
            await expect(map).toHaveAttribute('data-edit-level', 'full');

            await drawLine(page, map);
            // The save's state, version and item are the map's (epic 4 entry 24: the status box and its "Saved as version 1"
            // are gone); the list header says Saved.
            await expect(map).toHaveAttribute('data-save-state', 'saved', { timeout: 30_000 });
            await expect(map).toHaveAttribute('data-save-version', '1');
            await expect(page.locator('.mapstudio-panel-save')).toHaveText('Saved');
            expect(await map.getAttribute('data-save-item')).toMatch(UUID);
            await expect(map).toHaveAttribute('data-items-loaded', String(before + 1));
            if (width < 768) {
                await page.setViewportSize({ width, height });
            }
            await shot(page, `mapstudio-store-editor-${width}.png`);

            // Drawn from map.load after a reload, not from the browser's memory.
            await page.reload({ waitUntil: 'load' });
            map = await openMap(page, '/edit');
            expect(await mapLoaded(map)).toBe(before + 1);
            await expect(map).toHaveAttribute('data-edit-level', 'full');
            await expect(map).toHaveAttribute('data-save-state', 'idle');
            await shot(page, `mapstudio-store-editor-reload-${width}.png`);
        });

        test('a viewer\'s save is refused on the Gateway and nothing is written', async ({ page }) => {
            // On /edit, where Edit mode holds the tools (epic 3 entry 14, epic 4 entry 4); the anonymous viewer is still a viewer
            // there: no studio and no tool at level none, so the line goes through the test hook and the Gateway refuses it.
            let map = await openMap(page, '/edit');
            const before = await mapLoaded(map);
            await expect(map).toHaveAttribute('data-edit-level', 'none');
            await expect(page.locator('.mapstudio-toolbar')).toHaveCount(0);

            const reply = await send(page, 'edits.apply', hookLineBatch('Viewer line'));
            expect(reply.type).toBe('error');
            expect(reply.body.code).toBe('role');
            expect(reply.body.message).toMatch(/^You do not have a role that lets you change the map\./);
            await expect(map).toHaveAttribute('data-items-loaded', String(before));
            await shot(page, `mapstudio-store-viewer-${width}.png`);

            await page.reload({ waitUntil: 'load' });
            map = await openMap(page, '/edit');
            expect(await mapLoaded(map)).toBe(before);
        });
    });
}

test.describe('scripting API', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('the dev page\'s script checks write nothing for a session without MapEditor', async ({ page }) => {
        let map = await openMap(page, '/edit');
        await expect(page.locator('#mapstudio-dev-user')).toContainText('Not signed in');
        const before = await mapLoaded(map);
        await page.locator('#mapstudio-dev-script-checks').click();
        const out = page.locator('#mapstudio-dev-script-results');
        await expect(out).toContainText('"refused"', { timeout: 60_000 });
        expect(JSON.parse(await out.innerText()).refused).toMatch(/need the MapEditor role/);
        await page.reload({ waitUntil: 'load' });
        map = await openMap(page, '/edit');
        expect(await mapLoaded(map)).toBe(before);
    });

    editorTest('system.mapstudio.applyEdits and getMap use the same write path', async ({ page }) => {
        let map = await openMap(page, '/edit');
        await expect(page.locator('#mapstudio-dev-user')).toContainText('Signed in as ' + EDITOR_USER);
        const before = await mapLoaded(map);
        await page.locator('#mapstudio-dev-script-checks').click();
        const out = page.locator('#mapstudio-dev-script-results');
        await expect(out).toContainText('"results"', { timeout: 60_000 });
        const { pointId, results } = JSON.parse(await out.innerText());
        const byName = Object.fromEntries(results.map((r) => [r.name, r]));
        expect(pointId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

        expect(byName.create.ok).toBe(true);
        expect(byName.create.value.results).toEqual([{ entity: 'item', id: pointId, version: 1 }]);
        expect(byName.getMapAfterCreate.value).toBe(1);
        expect(byName.updateAtStoredVersion.ok).toBe(true);
        expect(byName.updateAtStoredVersion.value.results[0].version).toBe(2);
        expect(byName.updateAtStoredVersion.value.seq).toBe(byName.create.value.seq + 1);
        expect(byName.updateAtOldVersion.ok).toBe(false);
        expect(byName.updateAtOldVersion.error).toMatch(/^conflict: /);
        // Deletes are supported from epic 2 story 2: the check sends a stale one, refused with conflict.
        expect(byName.staleDelete.ok).toBe(false);
        expect(byName.staleDelete.error).toMatch(/^conflict: /);
        expect(byName.noActor.ok).toBe(false);
        expect(byName.noActor.error).toMatch(/^invalid: applyEdits needs an actor/);
        expect(byName.unknownProject.ok).toBe(false);
        expect(byName.unknownProject.error).toMatch(/^store-unreachable: Project no-such-project has no Map Studio setup/);
        expect(byName.getMapAtEnd.value).toBe(2);
        expect(byName.ping.value).toMatch(/^Map Studio pong at /);

        // Story 9's checks (kind setups, a CSV-style number) are asserted in kindsetup.spec.mjs.
        // A reload draws the script's two points (the check pad and the CSV pad), and story 14's line
        // and tap (instruments.spec.mjs), from the map store.
        await page.reload({ waitUntil: 'load' });
        map = await openMap(page, '/edit');
        expect(await mapLoaded(map)).toBe(before + 4);
    });
});
