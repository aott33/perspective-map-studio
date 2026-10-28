// The map editor's sign-in with a plain Playwright browser, run by lib/signInCli.mjs
// in its own node process right before each editor test: outside the test runner,
// so no trace, report or step title ever records the password (it is typed with a
// fill() call that only this browser sees). The test's context starts from the
// signed-in browser state (cookies, storageState). The state file holds dev session
// cookies, never the password, and lives in the system temp folder, not e2e/out
// (which CI uploads); the global teardown deletes it.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { e2eProject, envFileValue, repoRoot, sessionUrl } from './env.mjs';

/** The dev map editor (ops/users.py): user mapeditor, role MapEditor. */
export const EDITOR_USER = 'mapeditor';
/** The dev phone editor (ops/users.py, epic 2 story 2): user mapoperator, role MapOperator. */
export const OPERATOR_USER = 'mapoperator';

/** Each dev user's .env key for its password. */
const PASSWORD_KEYS = { [EDITOR_USER]: 'MAPSTUDIO_EDITOR_PASSWORD', [OPERATOR_USER]: 'MAPSTUDIO_OPERATOR_PASSWORD' };

const stateDir = path.join(os.tmpdir(),
    'mapstudio-e2e-' + createHash('sha256').update(repoRoot).digest('hex').slice(0, 8));

/** Where a user's signed-in state lives for this checkout's run. */
export function stateFile(user = EDITOR_USER) {
    return path.join(stateDir, (user === EDITOR_USER ? 'editor' : user) + '-state.json');
}

/** The map editor's state file (entry 1's name). */
export const editorStateFile = stateFile(EDITOR_USER);

/** A dev user's password, from the environment or the git-ignored .env; never logged. */
export function userPassword(user) {
    const key = PASSWORD_KEYS[user];
    return key ? process.env[key] ?? envFileValue(key) : undefined;
}

/** The editor's password, from the environment or the git-ignored .env; never logged. */
export function editorPassword() {
    return userPassword(EDITOR_USER);
}

/** Every dev user's password that is set, for the teardown's scan. */
export function allPasswords() {
    return Object.keys(PASSWORD_KEYS).map(userPassword).filter(Boolean);
}

/** The browser launch options the suite uses (playwright.config.mjs). */
export function launchOptions() {
    const options = {
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    };
    if (process.env.PW_CHROMIUM_PATH) options.executablePath = process.env.PW_CHROMIUM_PATH;
    return options;
}

/**
 * Sign in on the /edit page: its Log in button runs system.perspective.login(), the
 * identity provider asks for the user name, then (after Enter) the password on a
 * new page, and returns to the session (docs/platform-checks.md, epic 2 story 1).
 * Writes the signed-in browser state to stateFile(user) (mode 0600). Returns null,
 * or the reason it could not sign in (no password in .env, or the sign-in failed).
 */
export async function signInEditorOnce(user = EDITOR_USER) {
    const file = stateFile(user);
    rmSync(file, { force: true });
    const password = userPassword(user);
    if (!password) {
        return (PASSWORD_KEYS[user] ?? 'The password of ' + user)
            + ' is not in .env: run ops/up.sh, which generates it and makes the user.';
    }
    const browser = await chromium.launch({ ...launchOptions(), headless: true });
    try {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(sessionUrl('/edit'), { waitUntil: 'load' });
        const login = page.locator('#mapstudio-dev-login');
        await login.waitFor({ state: 'visible', timeout: 90_000 });
        await login.click();
        await page.waitForURL(/\/idp\//, { timeout: 30_000 });
        await page.locator('input[type="text"], input[name="username"], input:not([type])').first().fill(user);
        await page.keyboard.press('Enter');
        const field = page.locator('input[type="password"]').first();
        await field.waitFor({ state: 'visible', timeout: 30_000 });
        await field.fill(password);
        await page.keyboard.press('Enter');
        await page.waitForURL(new RegExp('/data/perspective/client/' + e2eProject() + '/edit'), { timeout: 30_000 });
        await page.locator('#mapstudio-dev-user').filter({ hasText: 'Signed in as ' + user })
            .waitFor({ timeout: 60_000 });
        const state = await context.storageState();
        mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
        writeFileSync(file, JSON.stringify(state), { mode: 0o600 });
        return null;
    } catch (err) {
        // The message names the step that failed; it never carries the password (fill values are not echoed).
        return 'The dev user ' + user + ' could not sign in: ' + String(err && err.message ? err.message.split('\n')[0] : err);
    } finally {
        await browser.close();
    }
}
