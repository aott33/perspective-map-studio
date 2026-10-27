// The tag browser's lookups (epic-map-store-and-data, entry 15), live: tags.browse and
// tags.resolve sent through the component's real session path with the test hook
// window.__mapStudioTest (web/typescript/testHook.ts), against the dev tag provider `default`
// seeded on a fresh volume from ops/config/core (Mesa/P12 and P14 instances of the UDT Pad,
// Mesa/P15 a folder with Flow only, Plant/Header/Pressure). The Gateway checks the session
// user's roles; only a full editor gets an answer. Nothing here writes a tag.

import { randomUUID } from 'node:crypto';
import {
    OPERATOR_USER, editorTest, expect, mapLoaded, openMap, signedInContext, test, watch
} from './fixtures.mjs';

/** Send one message through the page's component and return the Gateway's reply envelope. */
async function send(page, type, body) {
    await page.waitForFunction(() => Boolean(window.__mapStudioTest));
    return page.evaluate(([t, b]) => window.__mapStudioTest.send(t, b), [type, body]);
}

function expectReply(reply, type) {
    expect(reply.type, JSON.stringify(reply.body)).toBe(type);
    return reply.body;
}

function expectRefused(reply, code) {
    expect(reply.type, JSON.stringify(reply.body)).toBe('error');
    expect(reply.body.code).toBe(code);
    return reply.body;
}

const names = (body) => body.children.map((c) => c.name);

function createPad(assetId, i) {
    return {
        op: 'create', entity: 'item', id: randomUUID(), baseVersion: 0,
        data: {
            kind: 'pad', name: 'Tag check ' + assetId, assetId,
            properties: { status: 'producing' },
            geometry: { type: 'Point', coordinates: [-104.97 + i * 0.001, 39.745] }
        }
    };
}

editorTest.describe('tag browse and resolve', () => {
    editorTest.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

    editorTest('a full editor browses providers and folders and resolves picks against an asset', async ({ page }) => {
        const map = await openMap(page, '/edit');
        await mapLoaded(map);
        await expect(map).toHaveAttribute('data-edit-level', 'full');

        // The default provider's root, with both providers and exactly one default.
        const root = expectReply(await send(page, 'tags.browse', {}), 'tags.browse.reply');
        expect(root.provider).toBe('default');
        expect(root.folder).toBe('');
        expect(root.providers).toEqual([{ name: 'default', isDefault: true }, { name: 'System', isDefault: false }]);
        expect(names(root)).toEqual(expect.arrayContaining(['Mesa', 'Plant']));
        expect(root.truncated).toBe(false);

        // An asset folder: the UDT instance's members, full paths with the provider, data types set.
        const p12 = expectReply(await send(page, 'tags.browse', { provider: 'default', folder: 'Mesa/P12' }),
            'tags.browse.reply');
        expect(p12.children).toEqual([
            { name: 'Comms', path: '[default]Mesa/P12/Comms', type: 'tag', dataType: 'Boolean', hasChildren: false },
            { name: 'Flow', path: '[default]Mesa/P12/Flow', type: 'tag', dataType: 'Float8', hasChildren: false },
            { name: 'Pressure', path: '[default]Mesa/P12/Pressure', type: 'tag', dataType: 'Float8', hasChildren: false }
        ]);
        const mesa = expectReply(await send(page, 'tags.browse', { folder: 'Mesa' }), 'tags.browse.reply');
        expect(mesa.children.map((c) => [c.name, c.type, c.dataType])).toEqual([
            ['Lines', 'folder', null], ['P12', 'udt-instance', null], ['P14', 'udt-instance', null], ['P15', 'folder', null]
        ]);

        // A second provider, and the unknown ones.
        const system = expectReply(await send(page, 'tags.browse', { provider: 'System' }), 'tags.browse.reply');
        expect(system.provider).toBe('System');
        expect(names(system)).toContain('Gateway');
        expect(expectRefused(await send(page, 'tags.browse', { provider: 'nope' }), 'invalid').message).toContain('nope');
        expect(expectRefused(await send(page, 'tags.browse', { folder: 'Mesa/Nope' }), 'invalid').message)
            .toContain('Mesa/Nope');

        // Three pads linked to P12, P14 and P15; P15 has no Pressure.
        const saved = await send(page, 'edits.apply', {
            batchId: randomUUID(), ops: [createPad('P12', 0), createPad('P14', 1), createPad('P15', 2)]
        });
        expectReply(saved, 'edits.apply.reply');
        const loaded = expectReply(await send(page, 'map.load', {}), 'map.load.reply');
        const pads = new Set(loaded.assets.filter((a) => a.kind === 'pad').map((a) => a.id));
        const linked = loaded.items.filter((i) => i.kind === 'pad' && pads.has(i.assetId));
        const m = linked.length;
        const n = m - linked.filter((i) => i.assetId === 'P15').length;
        expect(m).toBeGreaterThanOrEqual(3);

        const inside = { kindId: 'pad', assetId: 'P12', path: '[default]Mesa/P12/Pressure' };
        expect(expectReply(await send(page, 'tags.resolve', inside), 'tags.resolve.reply'))
            .toEqual({ path: '{asset.path}/Pressure', relative: true, n, m });
        expect(expectReply(await send(page, 'tags.resolve', { ...inside, path: '{asset.path}/Pressure' }),
            'tags.resolve.reply')).toEqual({ path: '{asset.path}/Pressure', relative: true, n, m });
        // Flow exists on all three.
        expect(expectReply(await send(page, 'tags.resolve', { ...inside, path: '[default]Mesa/P12/Flow' }),
            'tags.resolve.reply')).toEqual({ path: '{asset.path}/Flow', relative: true, n: m, m });
        expect(expectReply(await send(page, 'tags.resolve', { ...inside, path: '[default]Plant/Header/Pressure' }),
            'tags.resolve.reply')).toEqual({ path: '[default]Plant/Header/Pressure', relative: false });

        expectRefused(await send(page, 'tags.resolve', { ...inside, path: 'Mesa/P12/Pressure' }), 'invalid');
        expectRefused(await send(page, 'tags.resolve', { ...inside, kindId: 'line' }), 'invalid');
        expectRefused(await send(page, 'tags.resolve', { ...inside, assetId: 'P99' }), 'invalid');
    });

    editorTest('a phone editor is refused role for both lookups', async ({ browser }) => {
        const context = await signedInContext(browser, OPERATOR_USER, { viewport: { width: 390, height: 844 } });
        try {
            const page = await context.newPage();
            const watched = watch(page);
            const map = await openMap(page, '/edit');
            await mapLoaded(map);
            await expect(map).toHaveAttribute('data-edit-level', 'phone');
            expectRefused(await send(page, 'tags.browse', {}), 'role');
            expectRefused(await send(page, 'tags.resolve', { kindId: 'pad', assetId: 'P12', path: '{asset.path}' }), 'role');
            expect(watched.errors).toEqual([]);
        } finally {
            await context.close();
        }
    });
});

test.describe('tag browse for a viewer', () => {
    test('an anonymous viewer is refused role and learns nothing about tags', async ({ page }) => {
        const map = await openMap(page, '/');
        await mapLoaded(map);
        const browse = expectRefused(await send(page, 'tags.browse', { provider: 'nope' }), 'role');
        expect(browse.message).not.toContain('nope');
        expectRefused(await send(page, 'tags.resolve', { kindId: 'pad', assetId: 'P12', path: '{asset.path}' }), 'role');
    });
});
