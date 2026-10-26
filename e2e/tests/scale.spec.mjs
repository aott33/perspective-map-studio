// The 30-pad scale view draws its seeded stand-in data set (30 pads, 30 lines).

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { screenshotDir } from '../lib/env.mjs';
import { expect, openMap, test } from './fixtures.mjs';

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

test('the scale page draws 30 pads and their lines', async ({ page }) => {
    const map = await openMap(page, '/scale');
    await expect(map).toHaveAttribute('data-test-set', 'scale30');
    await expect(map).toHaveAttribute('data-feature-count', '60');
    mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, 'mapstudio-scale-1440.png') });
});
