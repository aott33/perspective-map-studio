/**
 * The shared contracts of Map Studio 0.2.0, browser side. Mirrors
 * common/.../Messages.java and common/.../contract/*.java; docs/contract.md is
 * the reference. Pure types and readers only, unit tested in node.
 */

import { isRecord } from './json';
import { HostLists, readHostLists } from './adapters';

/** Public contract version these shapes belong to (AD-9). */
export const CONTRACT_VERSION = '0.2.0';

/** Error codes: stable kebab-case words. */
export const ErrorCodes = {
    CONFLICT: 'conflict',
    ROLE: 'role',
    INVALID: 'invalid',
    /** Reserved: nothing sends it today; a gap in `seq` reloads with `map.load` instead (epic 2 story 12). */
    STALE: 'stale',
    STORE_UNREACHABLE: 'store-unreachable',
    /** Readable but not saved here: a newer map store schema, or a standby Gateway (epic 2 story 5). */
    READ_ONLY: 'read-only',
    /** The tag system did not answer a tag lookup within 5 s, or failed (epic 2 story 15). */
    TAGS_UNAVAILABLE: 'tags-unavailable'
} as const;

/** Editing levels map.load reports (AD-2). */
export type EditLevel = 'none' | 'phone' | 'full';

export interface PointGeometry {
    type: 'Point';
    coordinates: [number, number];
}

export interface LineGeometry {
    type: 'LineString';
    coordinates: Array<[number, number]>;
}

export type ItemGeometry = PointGeometry | LineGeometry;

/**
 * An instrument's place on its line (AD-19, epic 2 story 14): the line's id and the distance
 * along it in metres from its first vertex (geodesic, geometry.ts), to 0.1 m.
 */
export interface Attachment {
    lineId: string;
    distanceM: number;
}

/** The stored map item record (AD-20), closed and typed. */
export interface MapItemRecord {
    id: string;
    kind: string;
    name: string;
    geometry: ItemGeometry;
    properties: Record<string, unknown>;
    assetId: string | null;
    overrides: Record<string, unknown>;
    ends: { start?: { itemId: string }; end?: { itemId: string } } | null;
    /** Only on a map item of an instrument kind attached to a line; null otherwise (and from an older Gateway). */
    attachment: Attachment | null;
    version: number;
    deleted: boolean;
}

/** The fields an op's data may carry: the record minus id, version and deleted. */
export type MapItemData = Partial<Omit<MapItemRecord, 'id' | 'version' | 'deleted'>>;

/**
 * A kind's stored setup (AD-16, epic 2 story 9; docs/kind-setup.md): what its map items
 * show. Checked on the Gateway; the browser reads it as data (epic-viewing draws it).
 */
export interface KindSetupRecord {
    kindId: string;
    setup: Record<string, unknown>;
    version: number;
    deleted: boolean;
}

/** A kind setup op's data: the record minus kindId, version and deleted. */
export interface KindSetupData {
    setup: Record<string, unknown>;
}

export interface EditOp {
    op: 'create' | 'update' | 'delete';
    entity: 'item' | 'kindSetup';
    id: string;
    /** 0 on create, the stored version otherwise. */
    baseVersion: number;
    /** The record's fields (all of a create's, the changed ones of an update); a delete carries none. */
    data?: MapItemData;
}

/** A kind setup op (epic 2 story 9): `id` is the kind id; a delete carries no data. */
export interface KindSetupOp {
    op: 'create' | 'update' | 'delete';
    entity: 'kindSetup';
    id: string;
    baseVersion: number;
    data?: KindSetupData;
}

export interface EditBatch {
    batchId: string;
    ops: EditOp[];
}

/** The part of the project setup map.load sends the browser (optional; docs/setup.md). */
export interface MapSetup {
    refreshIntervalSeconds: number;
    basemaps: string[];
    alarmPage: string;
}

export interface MapLoadReplyBody {
    level: EditLevel;
    seq: number;
    items: MapItemRecord[];
    /** The project's kind list, asset list (editors only) and their statuses (adapters.ts). */
    lists: HostLists;
    /**
     * Why the map cannot be saved on this Gateway (epic 2 story 5); left out when it
     * can (the Gateway sends null then).
     */
    readOnly?: string;
    /** Absent from a Gateway older than epic 2 entry 6, or when it is malformed. */
    setup?: MapSetup;
    /** The project's kind setups, at levels phone and full only (epic 2 story 9); malformed ones left out. */
    kindSetups?: KindSetupRecord[];
    /**
     * The session user name, sent at level `phone` and `full` only (epic 2 story 8); absent
     * at level `none`, for an anonymous session, or from an older Gateway.
     */
    user?: string;
}

export interface EditsApplyReplyBody {
    batchId: string;
    seq: number;
    results: Array<{ entity: string; id: string; version: number }>;
}

/**
 * One stale op of a refused batch (epic 2 story 2), listed in a `conflict` error body:
 * the stored record, and who changed it last and when (ISO 8601, UTC), null when unknown.
 */
export interface Conflict {
    index: number;
    entity: string;
    id: string;
    baseVersion: number;
    /** The stored map item, or the stored kind setup when `entity` is `kindSetup`. */
    current: MapItemRecord | KindSetupRecord | null;
    changedBy: string | null;
    changedAt: string | null;
}

function isPosition(value: unknown): value is [number, number] {
    return Array.isArray(value) && value.length === 2 && value.every((n) => typeof n === 'number' && isFinite(n));
}

function isGeometry(value: unknown): value is ItemGeometry {
    if (!isRecord(value)) {
        return false;
    }
    if (value.type === 'Point') {
        return isPosition(value.coordinates);
    }
    if (value.type === 'LineString') {
        return Array.isArray(value.coordinates) && value.coordinates.length >= 2 && value.coordinates.every(isPosition);
    }
    return false;
}

/** An attachment, or null when absent or not one (the record stays usable). */
export function readAttachment(value: unknown): Attachment | null {
    if (!isRecord(value) || typeof value.lineId !== 'string' || typeof value.distanceM !== 'number'
        || !isFinite(value.distanceM) || value.distanceM < 0) {
        return null;
    }
    return { lineId: value.lineId, distanceM: value.distanceM };
}

/** A map item record from the Gateway, or null when it is not one. */
export function readMapItem(value: unknown): MapItemRecord | null {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.kind !== 'string'
        || typeof value.name !== 'string' || !isGeometry(value.geometry) || typeof value.version !== 'number'
        || typeof value.deleted !== 'boolean') {
        return null;
    }
    return {
        id: value.id,
        kind: value.kind,
        name: value.name,
        geometry: value.geometry,
        properties: isRecord(value.properties) ? value.properties : {},
        assetId: typeof value.assetId === 'string' ? value.assetId : null,
        overrides: isRecord(value.overrides) ? value.overrides : {},
        ends: isRecord(value.ends) ? value.ends as MapItemRecord['ends'] : null,
        attachment: readAttachment(value.attachment),
        version: value.version,
        deleted: value.deleted
    };
}

/** The body of a map.load.reply, or null when it is malformed. Items that are not records are left out. */
export function readMapLoadReply(body: Record<string, unknown>): MapLoadReplyBody | null {
    const level = body.level;
    if ((level !== 'none' && level !== 'phone' && level !== 'full') || typeof body.seq !== 'number'
        || !Array.isArray(body.items)) {
        return null;
    }
    const items: MapItemRecord[] = [];
    for (const raw of body.items) {
        const item = readMapItem(raw);
        if (item) {
            items.push(item);
        }
    }
    const reply: MapLoadReplyBody = { level, seq: body.seq, items, lists: readHostLists(body) };
    if (typeof body.readOnly === 'string' && body.readOnly !== '') {
        reply.readOnly = body.readOnly;
    }
    const setup = readMapSetup(body.setup);
    if (setup) {
        reply.setup = setup;
    }
    if (Array.isArray(body.kindSetups)) {
        reply.kindSetups = body.kindSetups.map(readKindSetup).filter((k): k is KindSetupRecord => k !== null);
    }
    if (typeof body.user === 'string' && body.user !== '') {
        reply.user = body.user;
    }
    return reply;
}

/** A kind setup record from the Gateway, or null when it is not one. */
export function readKindSetup(value: unknown): KindSetupRecord | null {
    if (!isRecord(value) || typeof value.kindId !== 'string' || !isRecord(value.setup)
        || typeof value.version !== 'number' || typeof value.deleted !== 'boolean') {
        return null;
    }
    return { kindId: value.kindId, setup: value.setup, version: value.version, deleted: value.deleted };
}

/** map.load.reply's setup, or null when it is absent or malformed (the reply stays usable). */
export function readMapSetup(value: unknown): MapSetup | null {
    if (!isRecord(value) || typeof value.refreshIntervalSeconds !== 'number'
        || !Number.isInteger(value.refreshIntervalSeconds) || value.refreshIntervalSeconds < 1
        || !Array.isArray(value.basemaps) || !value.basemaps.every((b) => typeof b === 'string')
        || typeof value.alarmPage !== 'string') {
        return null;
    }
    return {
        refreshIntervalSeconds: value.refreshIntervalSeconds,
        basemaps: value.basemaps as string[],
        alarmPage: value.alarmPage
    };
}

/** The body of an edits.apply.reply, or null when it is malformed. */
export function readEditsApplyReply(body: Record<string, unknown>): EditsApplyReplyBody | null {
    if (typeof body.batchId !== 'string' || typeof body.seq !== 'number' || !Array.isArray(body.results)) {
        return null;
    }
    const results: EditsApplyReplyBody['results'] = [];
    for (const r of body.results) {
        if (!isRecord(r) || typeof r.entity !== 'string' || typeof r.id !== 'string' || typeof r.version !== 'number') {
            return null;
        }
        results.push({ entity: r.entity, id: r.id, version: r.version });
    }
    return { batchId: body.batchId, seq: body.seq, results };
}

/** The conflicts of a `conflict` error body; entries that are not conflicts are left out. */
export function readConflicts(value: unknown): Conflict[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const out: Conflict[] = [];
    for (const c of value) {
        if (!isRecord(c) || typeof c.index !== 'number' || typeof c.entity !== 'string' || typeof c.id !== 'string'
            || typeof c.baseVersion !== 'number') {
            continue;
        }
        out.push({
            index: c.index,
            entity: c.entity,
            id: c.id,
            baseVersion: c.baseVersion,
            current: c.entity === 'kindSetup' ? readKindSetup(c.current) : readMapItem(c.current),
            changedBy: typeof c.changedBy === 'string' ? c.changedBy : null,
            changedAt: typeof c.changedAt === 'string' ? c.changedAt : null
        });
    }
    return out;
}
