import { defineConfig } from '@playwright/test';
import { gatewayUrl } from './lib/env.mjs';

// One Chromium, software WebGL (MapLibre needs a GL context and the CI runner
// and the cloud box have no GPU). PW_CHROMIUM_PATH points at a browser the
// pinned Playwright cannot find itself. CI installs Chromium with
// `playwright install`; the cloud box has one pre-installed, and `playwright
// install` is never run there.
const launchOptions = {
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
};
if (process.env.PW_CHROMIUM_PATH) launchOptions.executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
    testDir: './tests',
    testMatch: '**/*.spec.mjs',
    // Serial. One retry in CI only, for a runner's cold start (a first page load on a fresh Gateway);
    // locally a flaky test fails at once. measures.json records retriesConfigured and, per measure,
    // the attempt it came from.
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    timeout: 180_000,
    expect: { timeout: 15_000 },
    globalSetup: './global-setup.mjs',
    globalTeardown: './global-teardown.mjs',
    outputDir: 'out/results',
    reporter: [['list'], ['html', { open: 'never', outputFolder: 'out/report' }]],
    use: {
        baseURL: gatewayUrl(),
        headless: process.env.E2E_HEADED !== '1',
        trace: 'retain-on-failure',
        launchOptions
    },
    projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
