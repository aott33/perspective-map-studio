/**
 * The message contract between the browser and the Gateway (AD-8), browser side.
 * Mirrors common/.../Messages.java: every message is `{v, type, id, body}`,
 * carried under one model event name in each direction; every error body is
 * `{code, message}`. Pure functions only, so this module is unit tested in node.
 */

import { isRecord } from './json';
import { MapChangedBody, readMapChanged } from './changes';
import {
    Conflict, EditBatch, EditsApplyReplyBody, MapLoadReplyBody, readConflicts, readEditsApplyReply, readMapLoadReply
} from './contract';
import { ValuesBatchBody, readValuesBatch } from './live';

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
    /** The tag browser's lookups (epic 2 story 15); their replies are read by epic-editing. */
    TAGS_BROWSE: 'tags.browse',
    TAGS_BROWSE_REPLY: 'tags.browse.reply',
    TAGS_RESOLVE: 'tags.resolve',
    TAGS_RESOLVE_REPLY: 'tags.resolve.reply',
    /** Live values (epic 3 entry 5, AD-6, AD-7): the Gateway's batches, and the popup's open and close. */
    VALUES_BATCH: 'values.batch',
    POPUP_OPEN: 'popup.open',
    POPUP_CLOSE: 'popup.close'
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
    | { kind: 'error'; id: string; body: ErrorBody }
    | { kind: 'invalid'; reason: string };

/** The `map.load` message: the browser asks for the map. */
export function mapLoad(id?: string): Envelope<Record<string, never>> {
    return envelope(MessageTypes.MAP_LOAD, {}, id);
}

/** The `popup.open` message: the browser opened a map item's popup (its values are pushed on change). */
export function popupOpen(itemId: string, id?: string): Envelope<{ itemId: string }> {
    return envelope(MessageTypes.POPUP_OPEN, { itemId }, id);
}

/** The `popup.close` message. */
export function popupClose(itemId: string, id?: string): Envelope<{ itemId: string }> {
    return envelope(MessageTypes.POPUP_CLOSE, { itemId }, id);
}

/** The `edits.apply` message for one batch. */
export function editsApply(batch: EditBatch, id?: string): Envelope<EditBatch> {
    return envelope(MessageTypes.EDITS_APPLY, batch, id);
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
        case MessageTypes.MAP_CHANGED:
            return { kind: 'map.changed', id: raw.id, body: readMapChanged(raw.body) };
        case MessageTypes.VALUES_BATCH:
            return { kind: 'values.batch', id: raw.id, body: readValuesBatch(raw.body) };
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
        case 'error':
            return 'Error (' + reply.body.code + '): ' + reply.body.message;
        default:
            return 'Invalid reply: ' + reply.reason;
    }
}
