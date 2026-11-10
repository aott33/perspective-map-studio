/**
 * The message contract between the browser and the Gateway (AD-8), browser side.
 * Mirrors common/.../Messages.java: every message is `{v, type, id, body}`,
 * carried under one model event name in each direction; every error body is
 * `{code, message}`. Pure functions only, so this module is unit tested in node.
 */

import { isRecord } from './json';
import { MapChangedBody, readMapChanged } from './changes';
import {
    Conflict, EditBatch, EditsApplyReplyBody, EditsHistoryReplyBody, EditsHistoryRequest, MapLoadReplyBody,
    readConflicts, readEditsApplyReply, readEditsHistoryReply, readMapLoadReply
} from './contract';
import { ValuesBatchBody, readValuesBatch } from './live';
import { BasemapId, BasemapSourceReplyBody, readBasemapSource } from './basemaps';

/** Contract version carried in `v`. */
export const MESSAGE_VERSION = 1;

/** Model event name the envelope travels under, both directions. */
export const MESSAGE_EVENT = 'mapstudio.message';

/** Message types this version sends and receives. */
export const MessageTypes = {
    POINT_CLICK: 'point.click',
    POINT_CLICK_REPLY: 'point.click.reply',
    MAP_LOAD: 'map.load',
    MAP_LOAD_REPLY: 'map.load.reply',
    EDITS_APPLY: 'edits.apply',
    EDITS_APPLY_REPLY: 'edits.apply.reply',
    MAP_CHANGED: 'map.changed',
    ERROR: 'error',
    /** The tag browser's lookups (epic 2 story 15); `tags.resolve` is sent by the Kinds screen since epic 4 entry 12a, `tags.browse` by entry 13. */
    TAGS_BROWSE: 'tags.browse',
    TAGS_BROWSE_REPLY: 'tags.browse.reply',
    TAGS_RESOLVE: 'tags.resolve',
    TAGS_RESOLVE_REPLY: 'tags.resolve.reply',
    /** Live values (epic 3 entry 5, AD-6, AD-7): the Gateway's batches, and the popup's open and close. */
    VALUES_BATCH: 'values.batch',
    POPUP_OPEN: 'popup.open',
    POPUP_CLOSE: 'popup.close',
    /** A basemap's tile source (epic 3 entry 6, AD-12): the satellite source with its token, read on the Gateway. */
    BASEMAP_SOURCE: 'basemap.source',
    BASEMAP_SOURCE_REPLY: 'basemap.source.reply',
    /** The edit record, newest first, in pages (epic-editing entry 11a): levels phone and full only. */
    EDITS_HISTORY: 'edits.history',
    EDITS_HISTORY_REPLY: 'edits.history.reply'
} as const;

export interface Envelope<B = Record<string, unknown>> {
    v: number;
    type: string;
    id: string;
    body: B;
}

export interface PointClickBody {
    pointId: string;
}

export interface PointClickReplyBody {
    pointId: string;
    receivedAt: string;
}

export interface ErrorBody {
    code: string;
    message: string;
    /** Set when an edits.apply batch was refused. */
    batchId?: string;
    /** The op at fault, when one is. */
    op?: { index: number; id?: string };
    /** Every stale op, on a `conflict` (epic 2 story 2). */
    conflicts?: Conflict[];
}

/** The outcome of reading one inbound envelope from the Gateway. */
export type Reply =
    | { kind: 'point.click.reply'; id: string; body: PointClickReplyBody }
    | { kind: 'map.load.reply'; id: string; body: MapLoadReplyBody }
    | { kind: 'edits.apply.reply'; id: string; body: EditsApplyReplyBody }
    /** `body` is null when the map.changed could not be read: the browser treats it as a gap. */
    | { kind: 'map.changed'; id: string; body: MapChangedBody | null }
    /** `body` is null when the values.batch could not be read: it is ignored (the next full batch heals). */
    | { kind: 'values.batch'; id: string; body: ValuesBatchBody | null }
    /** `body` is null when the basemap.source.reply could not be read: the basemap stays as it was. */
    | { kind: 'basemap.source.reply'; id: string; body: BasemapSourceReplyBody | null }
    | { kind: 'edits.history.reply'; id: string; body: EditsHistoryReplyBody }
    /** What `tags.resolve` said of one path (epic 4 entry 12a, the Kinds screen's resolve notes). */
    | { kind: 'tags.resolve.reply'; id: string; body: TagsResolveReplyBody }
    | { kind: 'error'; id: string; body: ErrorBody }
    | { kind: 'invalid'; reason: string };

/** The `map.load` message: the browser asks for the map. */
export function mapLoad(id?: string): Envelope<Record<string, never>> {
    return envelope(MessageTypes.MAP_LOAD, {}, id);
}

/** The `popup.open` message: the browser opened a map item's popup (its values are pushed on change). */
/** The segment a line's popup opened at (epic 3 entry 2, AD-7): the two node ids round the clicked spot. */
export interface PopupSegment {
    fromId: string;
    toId: string;
}

/** `popup.open {itemId, segment?}`: the Gateway pushes the item's values, and a line's instruments', while it is open. */
export function popupOpen(itemId: string, segment?: PopupSegment | null, id?: string): Envelope<{ itemId: string; segment?: PopupSegment }> {
    return envelope(MessageTypes.POPUP_OPEN, segment ? { itemId, segment: { fromId: segment.fromId, toId: segment.toId } } : { itemId }, id);
}

/** The `popup.close` message. */
export function popupClose(itemId: string, id?: string): Envelope<{ itemId: string }> {
    return envelope(MessageTypes.POPUP_CLOSE, { itemId }, id);
}

/** The `basemap.source` message: the browser asks for a basemap's tile source (satellite only). */
export function basemapSource(basemap: BasemapId, id?: string): Envelope<{ basemap: BasemapId }> {
    return envelope(MessageTypes.BASEMAP_SOURCE, { basemap }, id);
}

/** The `edits.apply` message for one batch. */
export function editsApply(batch: EditBatch, id?: string): Envelope<EditBatch> {
    return envelope(MessageTypes.EDITS_APPLY, batch, id);
}

/** The `edits.history` message: one page of the edit record, before a seq when paging back. */
export function editsHistory(request: EditsHistoryRequest = {}, id?: string): Envelope<EditsHistoryRequest> {
    const body: EditsHistoryRequest = {};
    if (request.before !== undefined) {
        body.before = request.before;
    }
    if (request.limit !== undefined) {
        body.limit = request.limit;
    }
    return envelope(MessageTypes.EDITS_HISTORY, body, id);
}

/** `tags.resolve`'s body (docs/contract.md): a kind, an asset of that kind and a tag path. */
export interface TagsResolveBody {
    kindId: string;
    assetId: string;
    path: string;
}

/**
 * `tags.resolve.reply`'s body: the path as the Gateway reads it, whether it is below the asset (`{asset.path}/...`), and for one
 * that is, the kind's linked map items it resolves for (`n`) of those with an asset (`m`).
 */
export interface TagsResolveReplyBody {
    path: string;
    relative: boolean;
    n?: number;
    m?: number;
}

/** The `tags.resolve` message (epic 4 entry 12a): how many of a kind's linked map items a tag path resolves for; level full only. */
export function tagsResolve(body: TagsResolveBody, id?: string): Envelope<TagsResolveBody> {
    return envelope(MessageTypes.TAGS_RESOLVE, { kindId: body.kindId, assetId: body.assetId, path: body.path }, id);
}

/** A UUID v4 string: `crypto.randomUUID` where the browser has it, else a Math.random fallback. */
export function newMessageId(): string {
    const c = typeof crypto !== 'undefined' ? crypto : undefined;
    if (c && typeof c.randomUUID === 'function') {
        return c.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
        const r = Math.floor(Math.random() * 16);
        const v = ch === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/** Wrap a body in the envelope. */
export function envelope<B>(type: string, body: B, id: string = newMessageId()): Envelope<B> {
    return { v: MESSAGE_VERSION, type, id, body };
}

/** The `point.click` message for one point. */
export function pointClick(pointId: string, id?: string): Envelope<PointClickBody> {
    return envelope(MessageTypes.POINT_CLICK, { pointId }, id);
}

/** Read one envelope from the Gateway into a typed reply; never throws. */
export function readReply(raw: unknown): Reply {
    if (!isRecord(raw)) {
        return { kind: 'invalid', reason: 'The reply is not an object.' };
    }
    if (raw.v !== MESSAGE_VERSION) {
        return { kind: 'invalid', reason: 'The reply has an unsupported version: ' + String(raw.v) };
    }
    if (typeof raw.type !== 'string' || typeof raw.id !== 'string') {
        return { kind: 'invalid', reason: 'The reply has no type or id.' };
    }
    const body = isRecord(raw.body) ? raw.body : {};
    switch (raw.type) {
        case MessageTypes.POINT_CLICK_REPLY:
            if (typeof body.pointId !== 'string' || typeof body.receivedAt !== 'string') {
                return { kind: 'invalid', reason: 'point.click.reply needs pointId and receivedAt.' };
            }
            return {
                kind: 'point.click.reply',
                id: raw.id,
                body: { pointId: body.pointId, receivedAt: body.receivedAt }
            };
        case MessageTypes.MAP_LOAD_REPLY: {
            const loaded = readMapLoadReply(body);
            return loaded ? { kind: 'map.load.reply', id: raw.id, body: loaded }
                : { kind: 'invalid', reason: 'map.load.reply needs level, seq and items.' };
        }
        case MessageTypes.EDITS_APPLY_REPLY: {
            const saved = readEditsApplyReply(body);
            return saved ? { kind: 'edits.apply.reply', id: raw.id, body: saved }
                : { kind: 'invalid', reason: 'edits.apply.reply needs batchId, seq and results.' };
        }
        case MessageTypes.EDITS_HISTORY_REPLY: {
            const page = readEditsHistoryReply(body);
            return page ? { kind: 'edits.history.reply', id: raw.id, body: page }
                : { kind: 'invalid', reason: 'edits.history.reply needs entries and more.' };
        }
        case MessageTypes.TAGS_RESOLVE_REPLY: {
            if (typeof body.path !== 'string' || typeof body.relative !== 'boolean') {
                return { kind: 'invalid', reason: 'tags.resolve.reply needs path and relative.' };
            }
            const resolved: TagsResolveReplyBody = { path: body.path, relative: body.relative };
            if (typeof body.n === 'number' && typeof body.m === 'number') {
                resolved.n = body.n;
                resolved.m = body.m;
            }
            return { kind: 'tags.resolve.reply', id: raw.id, body: resolved };
        }
        case MessageTypes.MAP_CHANGED:
            return { kind: 'map.changed', id: raw.id, body: readMapChanged(raw.body) };
        case MessageTypes.VALUES_BATCH:
            return { kind: 'values.batch', id: raw.id, body: readValuesBatch(raw.body) };
        case MessageTypes.BASEMAP_SOURCE_REPLY:
            return { kind: 'basemap.source.reply', id: raw.id, body: readBasemapSource(raw.body) };
        case MessageTypes.ERROR: {
            const error: ErrorBody = {
                code: typeof body.code === 'string' ? body.code : 'unknown',
                message: typeof body.message === 'string' ? body.message : 'Unknown error.'
            };
            if (typeof body.batchId === 'string') {
                error.batchId = body.batchId;
            }
            if (isRecord(body.op) && typeof body.op.index === 'number') {
                error.op = typeof body.op.id === 'string'
                    ? { index: body.op.index, id: body.op.id } : { index: body.op.index };
            }
            if (Array.isArray(body.conflicts)) {
                error.conflicts = readConflicts(body.conflicts);
            }
            return { kind: 'error', id: raw.id, body: error };
        }
        default:
            return { kind: 'invalid', reason: 'Unknown reply type: ' + raw.type };
    }
}

/** The one line of text the component shows for a reply. */
export function replyText(reply: Reply): string {
    switch (reply.kind) {
        case 'point.click.reply':
            return 'Gateway received click on ' + reply.body.pointId + ' at ' + reply.body.receivedAt;
        case 'map.load.reply':
            return 'Map loaded: ' + reply.body.items.length + ' map items at seq ' + reply.body.seq;
        case 'edits.apply.reply':
            return 'Saved batch ' + reply.body.batchId + ' as seq ' + reply.body.seq;
        case 'map.changed':
            return reply.body ? 'Map changed: seq ' + reply.body.seq + ', ' + reply.body.ops.length + ' op(s)'
                : 'Map changed: unreadable change';
        case 'values.batch':
            return reply.body ? 'Live values: ' + (reply.body.full ? 'full batch, ' : '') + reply.body.items.length
                + ' map item(s) at seq ' + reply.body.seq : 'Live values: unreadable batch';
        case 'basemap.source.reply':
            // Never the tile URL: it carries the token.
            return reply.body ? 'Basemap source: ' + reply.body.basemap + ' from ' + reply.body.provider
                : 'Basemap source: unreadable reply';
        case 'edits.history.reply':
            return 'Recent changes: ' + reply.body.entries.length + ' change(s)' + (reply.body.more ? ', more' : '');
        case 'tags.resolve.reply':
            return 'Tag path ' + reply.body.path + (reply.body.n !== undefined ? ': resolves for ' + reply.body.n + ' of ' + reply.body.m : ': a full path');
        case 'error':
            return 'Error (' + reply.body.code + '): ' + reply.body.message;
        default:
            return 'Invalid reply: ' + reply.reason;
    }
}
