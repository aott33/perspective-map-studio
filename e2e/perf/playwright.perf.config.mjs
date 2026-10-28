import { defineConfig } from '@playwright/test';
import { gatewayUrl } from '../lib/env.mjs';
import { launchOptions } from '../lib/editorAuth.mjs';

// The performance check (epic 2 story 17), run by ops/perf.sh only: `npm test` uses
// ../playwright.config.mjs, whose testDir is ./tests, so it never runs this suite.
// No trace, video or screenshot (finding 6 of the plan review): the map editor signs in through
// lib/signInCli.mjs in its own process, and nothing of this run may record a fill() value. The
// global teardown deletes the signed-in state files and fails the run if any file under e2e/out
// holds a dev user's password; ops/perf.sh greps e2e/out once more after the run.
export default defineConfig({
    testDir: '.',
    testMatch: 'perf.spec.mjs',
    fullyParallel: false,
    workers: 1,
    retries: 0,
    timeout: 3_600_000,
    expect: { timeout: 30_000 },
    globalTeardown: '../global-teardown.mjs',
    outputDir: '../out/perf/results',
    reporter: [['list']],
    use: {
        baseURL: gatewayUrl(),
        headless: process.env.E2E_HEADED !== '1',
        trace: 'off',
        video: 'off',
        screenshot: 'off',
        launchOptions: launchOptions()
    },
    projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
