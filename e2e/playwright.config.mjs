import { defineConfig } from '@playwright/test';
import { gatewayUrl } from './lib/env.mjs';

// One Chromium, software WebGL (MapLibre needs a GL context and the CI runner
// and the cloud box have no GPU). PW_CHROMIUM_PATH points at a browser the
// pinned Playwright cannot find itself; `playwright install` is never run here.
const launchOptions = {
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
};
if (process.env.PW_CHROMIUM_PATH) launchOptions.executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
    testDir: './tests',
    testMatch: '**/*.spec.mjs',
    // Serial, no retries: a flaky measure must show as a failure, not a pass on the second try.
    fullyParallel: false,
    workers: 1,
    retries: 0,
    timeout: 180_000,
    expect: { timeout: 15_000 },
    globalSetup: './global-setup.mjs',
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
