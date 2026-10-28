/**
 * The host lists map.load carries (Map Studio 0.2.0, docs/kinds-and-assets.md):
 * the project's kind list, its asset list (editors only) and the status of each.
 * Pure readers, tolerant of a Gateway that sends none of them; unit tested in node.
 */

import { isRecord } from './json';

/** Stable status words of a host list. */
export type AdapterStatusWord = 'ok' | 'empty' | 'failing' | 'slow' | 'incomplete' | 'not-configured' | 'loading';

const STATUS_WORDS: ReadonlySet<string> = new Set([
    'ok', 'empty', 'failing', 'slow', 'incomplete', 'not-configured', 'loading'
]);

export interface FormField {
    key: string;
    label: string;
    type: 'text' | 'number' | 'integer' | 'boolean' | 'choice';
    required: boolean;
    choices: string[];
}

export interface Kind {
    id: string;
    name: string;
    geometry: 'point' | 'line';
    icon: string;
    labelRank: number;
    fields: FormField[];
    /** A line kind drawn as a closed area (epic 2 story 9); sent only when true. */
    area?: boolean;
    /** A point kind whose map items may be attached to a line (epic 2 story 14); sent only when true. */
    instrument?: boolean;
}

export interface Asset {
    id: string;
    name: string;
    kind: string;
    basePath: string;
}

export interface AdapterStatus {
    status: AdapterStatusWord;
    message: string;
    function: string;
    count: number;
    left: number;
    refreshedAt: string | null;
}

export interface HostLists {
    kinds: Kind[];
    /** null when map.load sent no assets (a viewer, or an older Gateway). */
    assets: Asset[] | null;
    adapters: { kinds: AdapterStatus; assets: AdapterStatus } | null;
}

const FIELD_TYPES: ReadonlySet<string> = new Set(['text', 'number', 'integer', 'boolean', 'choice']);

function readField(value: unknown): FormField | null {
    if (!isRecord(value) || typeof value.key !== 'string' || typeof value.type !== 'string'
        || !FIELD_TYPES.has(value.type)) {
        return null;
    }
    return {
        key: value.key,
        label: typeof value.label === 'string' ? value.label : value.key,
        type: value.type as FormField['type'],
        required: value.required === true,
        choices: Array.isArray(value.choices) ? value.choices.filter((c): c is string => typeof c === 'string') : []
    };
}

/** One kind, or null when it is not one. */
export function readKind(value: unknown): Kind | null {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string'
        || (value.geometry !== 'point' && value.geometry !== 'line')) {
        return null;
    }
    const fields: FormField[] = [];
    if (Array.isArray(value.fields)) {
        for (const raw of value.fields) {
            const f = readField(raw);
            if (f) {
                fields.push(f);
            }
        }
    }
    return {
        id: value.id,
        name: value.name,
        geometry: value.geometry,
        icon: typeof value.icon === 'string' ? value.icon : '',
        labelRank: typeof value.labelRank === 'number' && isFinite(value.labelRank) ? value.labelRank : 0,
        fields,
        ...(value.area === true ? { area: true } : {}),
        ...(value.instrument === true ? { instrument: true } : {})
    };
}

/** One asset, or null when it is not one. */
export function readAsset(value: unknown): Asset | null {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string'
        || typeof value.kind !== 'string' || typeof value.basePath !== 'string') {
        return null;
    }
    return { id: value.id, name: value.name, kind: value.kind, basePath: value.basePath };
}

/** One list's status, or null when it is not one. */
export function readAdapterStatus(value: unknown): AdapterStatus | null {
    if (!isRecord(value) || typeof value.status !== 'string' || !STATUS_WORDS.has(value.status)
        || typeof value.message !== 'string') {
        return null;
    }
    return {
        status: value.status as AdapterStatusWord,
        message: value.message,
        function: typeof value.function === 'string' ? value.function : '',
        count: typeof value.count === 'number' ? value.count : 0,
        left: typeof value.left === 'number' ? value.left : 0,
        refreshedAt: typeof value.refreshedAt === 'string' ? value.refreshedAt : null
    };
}

function readRows<T>(value: unknown, read: (v: unknown) => T | null): T[] {
    const out: T[] = [];
    if (Array.isArray(value)) {
        for (const raw of value) {
            const row = read(raw);
            if (row) {
                out.push(row);
            }
        }
    }
    return out;
}

/** The kinds, assets and statuses of a map.load.reply body; rows that are not rows are left out. */
export function readHostLists(body: Record<string, unknown>): HostLists {
    let adapters: HostLists['adapters'] = null;
    if (isRecord(body.adapters)) {
        const k = readAdapterStatus(body.adapters.kinds);
        const a = readAdapterStatus(body.adapters.assets);
        if (k && a) {
            adapters = { kinds: k, assets: a };
        }
    }
    return {
        kinds: readRows(body.kinds, readKind),
        assets: Array.isArray(body.assets) ? readRows(body.assets, readAsset) : null,
        adapters
    };
}

/** No lists yet (before map.load answered). */
export const NO_HOST_LISTS: HostLists = { kinds: [], assets: null, adapters: null };
