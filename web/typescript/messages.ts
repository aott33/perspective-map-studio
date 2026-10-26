/**
 * The message contract between the browser and the Gateway (AD-8), browser side.
 * Mirrors common/.../Messages.java: every message is `{v, type, id, body}`,
 * carried under one model event name in each direction; every error body is
 * `{code, message}`. Pure functions only, so this module is unit tested in node.
 */

/** Contract version carried in `v`. */
export const MESSAGE_VERSION = 1;

/** Model event name the envelope travels under, both directions. */
export const MESSAGE_EVENT = 'mapstudio.message';

/** Message types this version sends and receives. */
export const MessageTypes = {
    POINT_CLICK: 'point.click',
    POINT_CLICK_REPLY: 'point.click.reply',
    ERROR: 'error'
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
}

/** The outcome of reading one inbound envelope from the Gateway. */
export type Reply =
    | { kind: 'point.click.reply'; id: string; body: PointClickReplyBody }
    | { kind: 'error'; id: string; body: ErrorBody }
    | { kind: 'invalid'; reason: string };

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

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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
        case MessageTypes.ERROR:
            return {
                kind: 'error',
                id: raw.id,
                body: {
                    code: typeof body.code === 'string' ? body.code : 'unknown',
                    message: typeof body.message === 'string' ? body.message : 'Unknown error.'
                }
            };
        default:
            return { kind: 'invalid', reason: 'Unknown reply type: ' + raw.type };
    }
}

/** The one line of text the component shows for a reply. */
export function replyText(reply: Reply): string {
    switch (reply.kind) {
        case 'point.click.reply':
            return 'Gateway received click on ' + reply.body.pointId + ' at ' + reply.body.receivedAt;
        case 'error':
            return 'Error (' + reply.body.code + '): ' + reply.body.message;
        default:
            return 'Invalid reply: ' + reply.reason;
    }
}
