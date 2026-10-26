// The 30-pad scale view draws its seeded stand-in data set (30 pads, 30 lines).

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { screenshotDir } from '../lib/env.mjs';
import { expect, loadedCounts, nextFrames, openMap, test } from './fixtures.mjs';

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

test('the scale page draws 30 pads and their lines', async ({ page }) => {
    const map = await openMap(page, '/scale');
    await expect(map).toHaveAttribute('data-test-set', 'scale30');
    // Read back from MapLibre's own sources by the component, not from its input.
    expect(await loadedCounts(map)).toEqual({ points: 30, lines: 30 });
    await nextFrames(page);
    mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, 'mapstudio-scale-1440.png') });
});
