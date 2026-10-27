// Where the suite finds the Gateway and where it writes. From the git-ignored
// .env it reads the host port and, for the map editor's sign-in in the global setup (lib/editorAuth.mjs),
// MAPSTUDIO_EDITOR_PASSWORD; never the admin password. Passwords are never logged.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const e2eDir = path.resolve(here, '..');
export const repoRoot = path.resolve(e2eDir, '..');

/** The value of KEY in the repository's .env, or undefined. Other keys are never read. */
export function envFileValue(key) {
    const file = path.join(repoRoot, '.env');
    if (!existsSync(file)) return undefined;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z_]+)=(.*)$/);
        if (m && m[1] === key) return m[2].trim().replace(/^["']|["']$/g, '');
    }
    return undefined;
}

/** GATEWAY_URL, else http://localhost:<GATEWAY_HTTP_PORT from .env, else 9088>. */
export function gatewayUrl() {
    if (process.env.GATEWAY_URL) return process.env.GATEWAY_URL.replace(/\/$/, '');
    const port = process.env.GATEWAY_HTTP_PORT ?? envFileValue('GATEWAY_HTTP_PORT') ?? '9088';
    return `http://localhost:${port}`;
}

/** E2E_DOCS=1 rewrites the committed screenshots and measures under docs/. */
export const docsMode = process.env.E2E_DOCS === '1';
export const outDir = path.join(e2eDir, 'out');
export const screenshotDir = docsMode ? path.join(repoRoot, 'docs', 'screenshots') : path.join(outDir, 'screenshots');
/** Always written. */
export const measuresOutFile = path.join(outDir, 'measures.json');
/** The committed copy: only with E2E_DOCS=1, and only when every measure test passed. */
export const measuresDocsFile = docsMode ? path.join(repoRoot, 'docs', 'spike-measures.json') : null;

/** The project's session URL for a page path such as '/' or '/edit'. */
export function sessionUrl(pagePath = '/') {
    return `${gatewayUrl()}/data/perspective/client/mapstudio-dev${pagePath === '/' ? '' : pagePath}`;
}
