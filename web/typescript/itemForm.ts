/**
 * The item form's rules (epic 4 entry 6, R3, R12; EXPERIENCE.md Properties panel, Unlinked, No asset list or incomplete):
 * the kind's fields read and checked as the Gateway's `ItemCheck` types them (a choice in its list, a number or a whole
 * number stored as a number, text as text; `required` is the browser's alone, never enforced at save), the required fields
 * still missing, the other live items that share a name on a different asset, the asset list's state as Details says it, an
 * item whose kind or asset left its list, and the last finished value of each field kept per project and kind for the next
 * item of that kind (name, location and link are never kept). Pure apart from the store it is handed; unit tested in node.
 */

import { AdapterStatus, AssetName, FormField, Kind } from './adapters';
import { MapItemRecord } from './contract';
import { isRecord } from './json';

/** A field's value as the map store keeps it: text, a number, true or false, or null for "not set". */
export type FieldValue = string | number | boolean | null;

/** A typed field read: its value, or why it is not one (said beside the field, nothing saved). */
export type FieldRead = { value: FieldValue } | { problem: string };

/** What a number field takes: the decimal forms Java's BigDecimal reads, as `ItemCheck` does (no hex, no "Infinity", no comma). */
const DECIMAL = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

/** A stored value as its field's input shows it: '' for not set. */
export function fieldText(value: unknown): string {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return JSON.stringify(value);
}

/**
 * The text typed in a field read as its type (`ItemCheck.value`): blank is not set (null); text keeps what was typed, outer
 * spaces aside; a number is any decimal, a whole number one with no fraction ("3.0" is 3), each sent as a number; a boolean
 * is "true" or "false"; a choice is one of its choices. Anything else is a problem in words ("Wells takes a whole number").
 * A whole number past what the browser holds exactly (2^53) is out of range here, though the Gateway would take it.
 */
export function readField(field: FormField, text: string): FieldRead {
    const t = text.trim();
    if (t === '') {
        return { value: null };
    }
    switch (field.type) {
        case 'text':
            return { value: t };
        case 'choice':
            return field.choices.indexOf(t) >= 0 ? { value: t } : { problem: field.label + ' is one of ' + field.choices.join(', ') };
        case 'boolean': {
            const s = t.toLowerCase();
            return s === 'true' ? { value: true } : s === 'false' ? { value: false } : { problem: field.label + ' is true or false' };
        }
        case 'number':
        case 'integer': {
            const whole = field.type === 'integer';
            const takes = { problem: field.label + (whole ? ' takes a whole number' : ' takes a number') };
            if (!DECIMAL.test(t)) {
                return takes;
            }
            const n = Number(t);
            if (!isFinite(n)) {
                return { problem: field.label + ' is out of range' };
            }
            if (whole && !Number.isInteger(n)) {
                return takes;
            }
            if (whole && !Number.isSafeInteger(n)) {
                return { problem: field.label + ' is out of range' };
            }
            // -0 is stored as 0.
            return { value: n === 0 ? 0 : n };
        }
        default:
            return { problem: field.label + ' has a type Map Studio does not know' };
    }
}

/** Whether a stored value has its field's type as the map store keeps it (normalised by `ItemCheck`); null is no value. */
export function fitsField(field: FormField, value: unknown): boolean {
    switch (field.type) {
        case 'text':
            return typeof value === 'string';
        case 'choice':
            return typeof value === 'string' && field.choices.indexOf(value) >= 0;
        case 'boolean':
            return typeof value === 'boolean';
        case 'number':
            return typeof value === 'number' && isFinite(value);
        case 'integer':
            return typeof value === 'number' && Number.isInteger(value);
        default:
            return false;
    }
}

/** The values of `properties` that `kind` defines and that fit their fields: what a kind change keeps (the Gateway refuses an unknown key). */
export function keptProperties(properties: Record<string, unknown>, kind: Kind): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of kind.fields) {
        if (Object.prototype.hasOwnProperty.call(properties, field.key) && fitsField(field, properties[field.key])) {
            out[field.key] = properties[field.key];
        }
    }
    return out;
}

/** The whole `properties` object with one field set (a copy; "not set" leaves the key out), as one update sends it. */
export function withValue(properties: Record<string, unknown>, key: string, value: FieldValue): Record<string, unknown> {
    const out: Record<string, unknown> = { ...properties };
    if (value === null) {
        delete out[key];
    } else {
        out[key] = value;
    }
    return out;
}

/** Whether a stored value counts as not set: absent, null, or blank text (false is a value). */
export function isUnset(value: unknown): boolean {
    return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

/** The kind's required fields not set on the item, in the kind list's order. */
export function missingRequired(kind: Kind | undefined, properties: Record<string, unknown>): FormField[] {
    return kind ? kind.fields.filter((f) => f.required && isUnset(properties[f.key])) : [];
}

/** The line at Details' top naming every missing required field ("Missing: Status"), '' when none is. */
export function missingText(missing: readonly FormField[]): string {
    return missing.length === 0 ? '' : 'Missing: ' + missing.map((f) => f.label).join(', ');
}

/** The word by a required field's label. */
export const REQUIRED_TEXT = 'Required';

/** Two names are the same name with letter case and outer spaces aside. */
export function sameName(a: string, b: string): boolean {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Another live item with the same name on a different asset (R3): its id and the asset it is linked to (null: unlinked). */
export interface NameTwin {
    id: string;
    assetId: string | null;
    /** The asset's name from the asset names, or its id when they do not list it. */
    assetLabel: string | null;
}

/**
 * The other live items whose name is `name` (letter case and outer spaces aside) and whose asset is not the item's (an
 * unlinked one counts as on a different asset from a linked one; two unlinked items do not). Never a refusal: the name
 * saves; Details underlines it and says which.
 */
export function nameTwins(name: string, self: { id: string; assetId: string | null }, items: readonly MapItemRecord[],
    assetNames: readonly AssetName[]): NameTwin[] {
    if (name.trim() === '') {
        return [];
    }
    const out: NameTwin[] = [];
    for (const other of items) {
        if (other.deleted || other.id === self.id || other.assetId === self.assetId || !sameName(other.name, name)) {
            continue;
        }
        const listed = other.assetId !== null ? assetNames.find((a) => a.id === other.assetId) : undefined;
        out.push({ id: other.id, assetId: other.assetId, assetLabel: other.assetId === null ? null : listed ? listed.name : other.assetId });
    }
    return out;
}

/** The underlined Name's tooltip and accessible description ("Also the name of the item linked to Pad 15"), '' with no twin. */
export function twinText(twins: readonly NameTwin[]): string {
    if (twins.length === 0) {
        return '';
    }
    const parts = twins.filter((t) => t.assetId !== null).map((t) => 'the item linked to ' + t.assetLabel);
    const unlinked = twins.length - parts.length;
    if (unlinked > 0) {
        parts.push(unlinked === 1 ? 'an unlinked item' : unlinked + ' unlinked items');
    }
    const words = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
    return 'Also the name of ' + words;
}

/** The asset list's status words whose message Details shows under Asset (docs/kinds-and-assets.md, Status). */
const NOTED: ReadonlySet<string> = new Set(['empty', 'incomplete', 'failing', 'slow', 'not-configured']);

/** The asset list's message under Asset while it is empty, incomplete, failing, slow or not configured; '' otherwise. */
export function assetListNote(status: AdapterStatus | null): string {
    return status !== null && NOTED.has(status.status) ? status.message : '';
}

/**
 * Whether the asset list in use is one an item's link can be checked against: read and in use (ok, incomplete, or empty: a
 * real answer with no rows), or a failing or slow refresh that keeps a last good list. Not while it loads, is not configured,
 * or failed with no list kept, and not from a Gateway that sends no status: then no link reads as vanished.
 */
export function assetListKnown(status: AdapterStatus | null): boolean {
    if (status === null) {
        return false;
    }
    switch (status.status) {
        case 'ok':
        case 'incomplete':
        case 'empty':
            return true;
        case 'failing':
        case 'slow':
            return status.count > 0;
        default:
            return false;
    }
}

/** Whether the item's asset left the asset list (R3): linked, the list known, and the asset not in it. It keeps its stored link. */
export function assetVanished(assetId: string | null, assetNames: readonly AssetName[], status: AdapterStatus | null): boolean {
    return assetId !== null && assetListKnown(status) && !assetNames.some((a) => a.id === assetId);
}

/** The vanished asset's reason, as Details and the list's Unlinked badge say it. */
export function vanishedReason(assetId: string): string {
    return assetId + ' is no longer in the asset list';
}

/** Details' words for a vanished asset under Asset. */
export function vanishedText(assetId: string): string {
    return 'Not linked: ' + vanishedReason(assetId);
}

/** The Kind row's words for a kind not in the kind list. */
export const UNKNOWN_KIND = 'Unknown kind';

/** Its sentence under the Kind row. */
export function unknownKindText(kindId: string): string {
    return kindId + ' is no longer in the kind list; its values are kept';
}

// ---- The last values per kind (R12: prefill) ----

/** The part of `Storage` the prefill uses (localStorage in the browser, a map in the tests). */
export interface FormStore {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

const PREFILL_PREFIX = 'mapstudio.prefill.v1|';

/** The key of one kind's last values in one project. */
export function prefillKey(project: string | null, kindId: string): string {
    return PREFILL_PREFIX + (project || '') + '|' + kindId;
}

/** The last values stored under `key`, or none (nothing stored, unreadable, or a store that refuses). */
export function readPrefill(store: FormStore | null, key: string): Record<string, unknown> {
    try {
        const raw = store ? store.getItem(key) : null;
        const value: unknown = raw ? JSON.parse(raw) : null;
        return isRecord(value) ? value : {};
    } catch (err) {
        return {};
    }
}

/** Keep a finished field's value under `key` ("not set" forgets it); a refusing store (private window, full) is ignored. */
export function rememberValue(store: FormStore | null, key: string, fieldKey: string, value: FieldValue): void {
    try {
        if (!store) {
            return;
        }
        store.setItem(key, JSON.stringify(withValue(readPrefill(store, key), fieldKey, value)));
    } catch (err) {
        // The prefill is a convenience: without storage a new item starts blank.
    }
}

/** The values a new item of `kind` starts with: the kept ones the kind still defines and that fit their fields now. */
export function prefillFor(kind: Kind, stored: Record<string, unknown>): Record<string, unknown> {
    return keptProperties(stored, kind);
}
