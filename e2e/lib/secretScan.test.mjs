// Unit tests for the e2e/out secret scan: node --test lib/

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { filesHolding, zipEntries } from './secretScan.mjs';

/** A one-entry zip (deflated), the way Playwright writes trace files. */
function zipOf(name, text) {
    const data = Buffer.from(text, 'utf8');
    const packed = deflateRawSync(data);
    const nameBytes = Buffer.from(name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(0, 42);
    const cdOffset = local.length + nameBytes.length + packed.length;
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(central.length + nameBytes.length, 12);
    eocd.writeUInt32LE(cdOffset, 16);
    return Buffer.concat([local, nameBytes, packed, central, nameBytes, eocd]);
}

test('zip entries are read back, deflated ones inflated', () => {
    const entries = zipEntries(zipOf('trace.trace', '{"params":{"value":"abc"}}'));
    assert.equal(entries.length, 1);
    assert.equal(entries[0].name, 'trace.trace');
    assert.equal(entries[0].data.toString('utf8'), '{"params":{"value":"abc"}}');
});

test('a secret is found in a plain file and inside a zipped trace, and nowhere else', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'scan-'));
    try {
        mkdirSync(path.join(dir, 'results', 't1'), { recursive: true });
        writeFileSync(path.join(dir, 'report.html'), 'nothing here');
        writeFileSync(path.join(dir, 'results', 't1', 'trace.zip'), zipOf('0-trace.trace', '{"value":"Hunter2Secret"}'));
        writeFileSync(path.join(dir, 'log.txt'), 'fill Hunter2Secret');
        const found = filesHolding(dir, 'Hunter2Secret').map((f) => path.relative(dir, f)).sort();
        assert.deepEqual(found, ['log.txt', path.join('results', 't1', 'trace.zip') + '!0-trace.trace']);
        assert.deepEqual(filesHolding(dir, 'NotThere1'), []);
        assert.deepEqual(filesHolding(dir, ''), []);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
