// The batches geometry.ts and undo.ts build, as the Gateway gets them (epic 2 story 14, review
// finding of lens quick): this test builds a run of line batches and their undo batches on a
// small store model and checks them against the committed fixture
// gateway/src/test/resources/.../write/instrument-batches.json, which
// WriteServiceBatchReplayTest.java replays through the real WriteService. A change to either
// module changes the fixture: run `UPDATE_FIXTURES=1 npx jest batch-replay` and commit it, so
// the Java test checks the new output.
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { EditBatch, MapItemData, MapItemRecord } from '../contract';
import {
    Position, lineDeleteBatch, lineGeometryBatch, lineMoveBatch, lineSplitBatch, pointAt, round6
} from '../geometry';
import { reverseBatch } from '../undo';

const FIXTURE = join(__dirname, '..', '..', '..', 'gateway', 'src', 'test', 'resources', 'com', 'aoindustrial',
    'perspective', 'mapstudio', 'gateway', 'write', 'instrument-batches.json');

const SWD: Position[] = [[-103.52, 31.92], [-103.505, 31.9205], [-103.490423, 31.926]];
const LINE_ID = '11111111-1111-4111-8111-111111111111';
const PT1 = '22222222-2222-4222-8222-222222222222';
const PT2 = '33333333-3333-4333-8333-333333333333';
const PART_B = '55555555-5555-4555-8555-555555555555';

type Result = { entity: string; id: string; version: number };
interface Step { name: string; batch: EditBatch; results: Result[] }

/** The store as the Gateway keeps it, for the versions and records the next batch is built from. */
class Model {
    readonly items = new Map<string, MapItemRecord>();

    apply(batch: EditBatch): Result[] {
        return batch.ops.map((op) => {
            const old = this.items.get(op.id);
            const data: MapItemData = op.data || {};
            let next: MapItemRecord;
            if (op.op === 'create') {
                next = { id: op.id, kind: data.kind!, name: data.name ?? '', geometry: data.geometry!,
                    properties: data.properties ?? {}, assetId: data.assetId ?? null, overrides: data.overrides ?? {},
                    ends: data.ends ?? null, attachment: data.attachment ?? null,
                    version: op.baseVersion === 0 ? 1 : op.baseVersion + 1, deleted: false };
            } else if (op.op === 'delete') {
                next = { ...old!, version: old!.version + 1, deleted: true };
            } else {
                next = { ...old!, ...(data as Partial<MapItemRecord>), version: old!.version + 1 };
            }
            this.items.set(op.id, next);
            return { entity: 'item', id: op.id, version: next.version };
        });
    }

    get(id: string): MapItemRecord {
        return this.items.get(id)!;
    }

    live(): MapItemRecord[] {
        return [...this.items.values()];
    }
}

function tapCreate(id: string, name: string, distanceM: number) {
    const p = pointAt(SWD, distanceM);
    return { op: 'create' as const, entity: 'item' as const, id, baseVersion: 0, data: { kind: 'tap', name,
        geometry: { type: 'Point' as const, coordinates: [round6(p[0]), round6(p[1])] as Position },
        attachment: { lineId: LINE_ID, distanceM } } };
}

function batchId(n: number): string {
    return `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;
}

/** The run: each batch built from the model as the previous ones left it. */
function run(): { steps: Step[]; final: MapItemRecord[] } {
    const m = new Model();
    const steps: Step[] = [];
    const save = (name: string, batch: EditBatch): Step => {
        const before = m.live().map((r) => ({ ...r }));
        const step = { name, batch, results: m.apply(batch) };
        steps.push(step);
        return Object.assign(step, { before });
    };
    const undo = (name: string, done: Step & { before?: MapItemRecord[] }) =>
        save(name, reverseBatch(batchId(steps.length + 1), done.before!, done.batch, done.results));

    save('create the line and its two taps', { batchId: batchId(1), ops: [
        { op: 'create', entity: 'item', id: LINE_ID, baseVersion: 0, data: { kind: 'line', name: 'L-SWD',
            geometry: { type: 'LineString', coordinates: SWD }, properties: { diameter: 8 } } },
        tapCreate(PT1, 'PT-1', 1143), tapCreate(PT2, 'PT-2', 2841)] });
    const reshaped = save('reshape (lineGeometryBatch)', lineGeometryBatch(batchId(2), m.get(LINE_ID),
        [[-103.52, 31.92], [-103.505, 31.9223], [-103.490423, 31.926]], m.live()));
    undo('undo the reshape (reverseBatch)', reshaped);
    const mid = pointAt(SWD, 600);
    save('insert a vertex (lineGeometryBatch)', lineGeometryBatch(batchId(4), m.get(LINE_ID),
        [SWD[0], [round6(mid[0]), round6(mid[1])], SWD[1], SWD[2]], m.live()));
    save('move the whole line (lineMoveBatch)', lineMoveBatch(batchId(5), m.get(LINE_ID), [0.01, -0.005], m.live()));
    const moved = (m.get(LINE_ID).geometry as { coordinates: Position[] }).coordinates;
    const split = save('split at a vertex (lineSplitBatch)', lineSplitBatch(batchId(6), m.get(LINE_ID),
        moved.slice(0, 3), moved.slice(2), { id: PART_B, data: { kind: 'line', name: 'L-SWD B', properties: {} } },
        m.live()));
    undo('undo the split (reverseBatch)', split);
    const deleted = save('delete the line with its taps (lineDeleteBatch)', lineDeleteBatch(batchId(8),
        m.get(LINE_ID), m.live()));
    undo('undo the delete (reverseBatch)', deleted);
    return { steps: steps.map(({ name, batch, results }) => ({ name, batch, results })), final: m.live() };
}

describe('the line batches the Gateway replays (WriteServiceBatchReplayTest.java)', () => {
    const built = run();
    const text = JSON.stringify(built, null, 2) + '\n';

    test('the run covers every builder and the reverse of an update, a split and a delete', () => {
        expect(built.steps.map((s) => s.batch.ops.length)).toEqual([3, 3, 3, 3, 3, 4, 4, 3, 3]);
        const split = built.steps[5].batch.ops;
        expect(split.map((o) => (o.data?.attachment as { lineId?: string } | undefined)?.lineId))
            .toEqual([undefined, undefined, LINE_ID, PART_B]);
        const restore = built.steps[8].batch.ops[0];
        expect(restore.op).toBe('create');
        expect(restore.data).toMatchObject({ attachment: null, ends: null, assetId: null });
        expect(built.final.filter((r) => !r.deleted).map((r) => r.id).sort()).toEqual([LINE_ID, PT1, PT2]);
        expect(built.final.find((r) => r.id === PART_B)!.deleted).toBe(true);
    });

    test('matches the committed fixture the Java test replays', () => {
        if (process.env.UPDATE_FIXTURES === '1') {
            writeFileSync(FIXTURE, text);
        }
        expect(existsSync(FIXTURE)).toBe(true);
        expect(readFileSync(FIXTURE, 'utf8')).toBe(text);
    });
});
