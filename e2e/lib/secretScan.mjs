// Look for a secret in every file under a folder, including the entries of zip
// files (Playwright traces are zips of JSON). Used by the global teardown so that
// e2e/out, which CI uploads, never carries the map editor's password. Pure node,
// no dependency: a minimal zip reader (stored and deflated entries, no zip64).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

/** The entries of a zip file as {name, data} (data null when it cannot be read). */
export function zipEntries(buffer) {
    const entries = [];
    let eocd = -1;
    for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i--) {
        if (buffer.readUInt32LE(i) === 0x06054b50) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0) return entries;
    const count = buffer.readUInt16LE(eocd + 10);
    let p = buffer.readUInt32LE(eocd + 16);
    for (let n = 0; n < count && p + 46 <= buffer.length && buffer.readUInt32LE(p) === 0x02014b50; n++) {
        const method = buffer.readUInt16LE(p + 10);
        const size = buffer.readUInt32LE(p + 20);
        const nameLength = buffer.readUInt16LE(p + 28);
        const extraLength = buffer.readUInt16LE(p + 30);
        const commentLength = buffer.readUInt16LE(p + 32);
        const local = buffer.readUInt32LE(p + 42);
        const name = buffer.toString('utf8', p + 46, p + 46 + nameLength);
        let data = null;
        if (local + 30 <= buffer.length && buffer.readUInt32LE(local) === 0x04034b50) {
            const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
            const raw = buffer.subarray(start, start + size);
            try {
                data = method === 0 ? raw : method === 8 ? inflateRawSync(raw) : null;
            } catch {
                data = null;
            }
        }
        entries.push({ name, data });
        p += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
}

/** Every file under `dir` (and every zip entry inside one) whose bytes contain `secret`. */
export function filesHolding(dir, secret) {
    const found = [];
    if (!secret) return found;
    const needle = Buffer.from(secret, 'utf8');
    const walk = (folder) => {
        let names;
        try {
            names = readdirSync(folder);
        } catch {
            return;
        }
        for (const name of names) {
            const file = path.join(folder, name);
            const stat = statSync(file);
            if (stat.isDirectory()) {
                walk(file);
                continue;
            }
            const bytes = readFileSync(file);
            if (bytes.includes(needle)) {
                found.push(file);
                continue;
            }
            if (name.endsWith('.zip') || name.endsWith('.trace')) {
                for (const entry of zipEntries(bytes)) {
                    if (entry.data && entry.data.includes(needle)) {
                        found.push(file + '!' + entry.name);
                        break;
                    }
                }
            }
        }
    };
    walk(dir);
    return found;
}
