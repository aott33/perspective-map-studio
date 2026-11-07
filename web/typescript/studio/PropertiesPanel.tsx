import * as React from 'react';
import { AdapterStatus, Asset, AssetName, FormField, Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import {
    FieldValue, REQUIRED_TEXT, UNKNOWN_KIND, assetListNote, assetVanished, fieldText, isUnset, kindListKnown, kindListNote, missingRequired,
    missingText, nameTwins, readField, twinText, unknownKindText, vanishedText
} from '../itemForm';
import { PLACE_CREDIT, PlaceSource, placeLine } from '../placeCheck';
import { Glyph } from '../popupParts';
import { roundCoordinate } from '../save';
import { ChromeGlyph } from './ChromeGlyph';
import { PAUSED_TEXT } from './UndoGroup';

/** The footer's delete icon on hover (entry 25): what it does and its key; no question is asked and Undo restores the item. */
export const DELETE_TITLE = 'Delete (Del)';

/** Why the footer's delete is off for an item never saved (entry 25's review: no delete at version 0; Discard drops a refused one). */
export const NOT_SAVED_TEXT = 'Not saved yet';

/** Why the footer's delete is off while the Point, Line or Area tool is in hand (entry 25's review): Esc puts the tool down. */
export const TOOL_IN_HAND_TEXT = 'Off while a tool is in hand - Esc puts it down';

/** Zoom to location beside Move (entry 27): its words and its hover text. */
export const ZOOM_TO_TEXT = 'Zoom to location';
export const ZOOM_TO_TITLE = 'Zoom to location: the map moves to the saved point';

/** Whether a typed latitude or longitude reads as a number (in range or not): the place line follows a typed pair once both do. */
export function readsAsNumber(text: string): number | null {
    const t = text.trim();
    const n = Number(t);
    return t !== '' && Number.isFinite(n) ? n : null;
}

/** The footer's delete icon as it shows: why it is off ('' when on), its hover words, and whether it names the Delete key. */
export interface DeleteButton {
    off: string;
    title: string;
    key: boolean;
}

/**
 * The footer's delete icon (entry 25 and its review): off, saying why, while the store is unreachable, for an item never saved, and
 * while a tool is in hand (no delete then by the icon or the key); on, it names Del ("Delete (Del)", `aria-keyshortcuts`) only when
 * Del deletes this item (`delKey`), and is plain "Delete" while Del is a chosen point's Delete point or Move waits for its click.
 */
export function deleteButton(paused: boolean, pending: boolean, toolInHand: boolean, delKey: boolean): DeleteButton {
    const off = paused ? PAUSED_TEXT : pending ? NOT_SAVED_TEXT : toolInHand ? TOOL_IN_HAND_TEXT : '';
    const key = off === '' && delKey;
    return { off, title: off !== '' ? off : key ? DELETE_TITLE : 'Delete', key };
}

/**
 * The docked properties panel's Details tab (epic 4 entries 2 and 4; DESIGN.md Properties panel and tabs,
 * EXPERIENCE.md Properties panel, Place a point, Draw): the header with the kind glyph, the name and the
 * subline, the Details tab, then Name, Kind (a select of the kinds with the item's geometry, so a line or
 * area drawn with a generic tool takes its kind here; the Gateway accepts a kind of the same geometry),
 * Location (latitude and longitude, typed, the non-drag way to place a point; from entry 5 Move beside the label for a
 * point item that is not an instrument, then a click on the map, the owner's mock 4) and the asset link (the kind's
 * assets, Unlink). Every field saves when it is finished (blur, Enter or a choice) through the component's
 * callbacks, one batch each; a field finished while the item's create is still being saved (the item just
 * added with the cursor already in Name) goes to the delegate like any other, which sends it right after the
 * create's reply at the right version. The Style tab, the page
 * link and the Live now block are later entries (the place check is entry 27's, below). The panel is keyed by the item's id, so its drafts
 * start from the record; a new version of the record (a save, an undo, another editor's change) resets
 * the fields the user has not touched and keeps a draft being typed. While map.load says the store is
 * unreachable the fields are paused, as the toolbar is. From entry 25 (DESIGN.md Properties panel: "Footer: a delete icon",
 * key screen 4's bottom right of the panel, which docks left of the map, so the App Bar's corner stays clear) the footer holds
 * the delete icon: no question asked, the item deleted in one batch and one undo step, "Delete (Del)" on hover and as its
 * description while Del deletes this item (`deleteButton`; off for an item never saved and while a tool is in hand); the close
 * names Esc, and Move names Esc while it waits. Each control with a key names it in its hover text and to assistive technology.
 *
 * From entry 6 (R3, R12; itemForm.ts holds the rules) the kind's fields follow Location, in the kind list's order and as its
 * types (DESIGN.md Properties panel: location, kind fields, then the asset link): text and number inputs saved on blur or
 * Enter (Esc puts the record's value back), a number or a whole number that is not one refused in words beside the field
 * and not saved; a boolean a checkbox and a choice a select with "Not set" first, both saved on change. Each save is one
 * update of the whole `properties` (the delegate's `editProperty`), "edit <name>". A required field shows "Required" by its
 * label and, while it is not set, the line at the top names every missing one ("Missing: Status"); nothing stops a save.
 * Name is underlined in the `error` token while another live item with the same name (case and outer spaces aside) is
 * linked to a different asset, its tooltip and description naming it by its folder; the name still saves. An item whose kind
 * left the kind list shows "Unknown kind" with its stored values read only, Kind alone editable (while the kind list cannot be
 * checked against, the list's status message instead, the fields off as well); one whose asset left the asset list says so
 * under Asset and keeps its stored link; the asset list's status message shows under Asset while it is empty, incomplete,
 * failing, slow or not configured. A finished field is compared with the newest value sent for it (`newest`), and once the
 * item's saves settle (`saving` goes false) a field sent and not held by the record (a refused or dropped save) shows the
 * record's value again.
 *
 * From entry 27 (R13; placeCheck.ts holds the rules, docs/place-check.md the data) a point item's Location carries the place line
 * under the hint, in the secondary text colour, its tooltip naming the sources: the place of the typed pair once both fields read
 * as numbers, else of the saved point ("Lea County, New Mexico, US", "Near Grande Prairie, Alberta, CA", "Gulf of Mexico, off
 * Louisiana, US"); "Latitude and longitude look swapped" for a latitude past 90 whose swap is in range (nothing saved, as any pair
 * out of range), "Latitude and longitude may be swapped" for a pair in no area whose swap lands in one; "Looking up the place..."
 * while the data loads and "The place check is not available" if it failed, never stopping a save. The data is asked for when the
 * panel first shows a point (`places`, one fetch per page); a line or an area never asks. Zoom to location, beside Move, moves the
 * map to the saved point at zoom 15 or more, the selection and Details kept (`onZoomTo`).
 */
export interface PropertiesPanelProps {
    item: MapItemRecord;
    kind: Kind | undefined;
    /** The kinds with the item's geometry (a line kind, areas included, for a LineString), for the Kind select. */
    kinds: Kind[];
    /** The kind's assets from the asset list (level `phone` or `full`), for the picker. */
    assets: Asset[];
    /** Every asset's id and name (map.load's `assetNames`): the linked asset's name, and whether it left the list (entry 6). */
    assetNames: AssetName[];
    /** The asset list's status (map.load's `adapters.assets`), or null when the Gateway sent none. */
    assetStatus: AdapterStatus | null;
    /** The map's items, for the duplicate name check (entry 6). */
    items: MapItemRecord[];
    /** Every asset of the asset list (level `full`), for the duplicate's words, which name the other asset's folder. */
    assetRows: Asset[];
    /** The kind list's status (map.load's `adapters.kinds`), or null: an item's kind reads unknown only while the list is in use. */
    kindStatus: AdapterStatus | null;
    /** A batch of the item is in flight or waiting its turn (the delegate's `inFlight`). */
    saving: boolean;
    /** The item's newest properties: those of its batch in flight or waiting, else the record's. */
    newest: Record<string, unknown>;
    /** The item's create is still being saved (no stored version yet): a finished field goes right after it. */
    pending: boolean;
    /** The map store is unreachable (map.load): the fields take no input, as the toolbar does. */
    paused: boolean;
    /** Open with the cursor in Name (the pad just placed; owner decision, 2026-11-04). */
    autoFocusName: boolean;
    onNameFocused: () => void;
    onClose: () => void;
    onRename: (name: string) => void;
    onMove: (lngLat: [number, number]) => void;
    /**
     * Entry 5: whether Move beside Location shows (a point item; an instrument moves along its line, entry 9), whether it waits
     * for the click, and Move pressed (pressed again while it waits, Move is put down). A move made while the item's create is
     * saved goes right after it, as a field does.
     */
    canMoveByClick: boolean;
    moving: boolean;
    onMoveStart: () => void;
    onLink: (assetId: string | null) => void;
    onKind: (kindId: string) => void;
    /** A finished field of the kind (entry 6): its key and its value as its type (null: not set). */
    onProperty: (key: string, value: FieldValue) => void;
    /** The footer's delete icon (entry 25): the item deleted with no question asked; Undo restores it. */
    onDelete: () => void;
    /** The Point, Line or Area tool is in hand, or a drawing is in progress: the footer's delete is off (entry 25's review). */
    toolInHand: boolean;
    /** The Delete key deletes this item now (no point chosen, no Move waiting): the footer names it. */
    delKey: boolean;
    /** The page's place data (entry 27): loaded when the panel first shows a point, its status read for the place line. */
    places: PlaceSource;
    /** Zoom to location (entry 27): the map moves to the saved point at zoom 15 or more; the selection and Details stay. */
    onZoomTo: () => void;
}

interface Drafts {
    name: string;
    lat: string;
    lng: string;
    /** The kind's fields being typed or just chosen, by key (entry 6); a key left out shows the record's value. */
    fields: Record<string, string>;
    /** A typed field's problem in words, by key ("Wells takes a whole number"); nothing of it was saved. */
    problems: Record<string, string>;
}

type FixedField = 'name' | 'lat' | 'lng';

/** The record's values as the fields show them. */
function draftsOf(item: MapItemRecord): Drafts {
    const point = item.geometry.type === 'Point';
    return {
        name: item.name,
        lat: point ? String(item.geometry.coordinates[1]) : '',
        lng: point ? String(item.geometry.coordinates[0]) : '',
        fields: {},
        problems: {}
    };
}

/** A typed latitude or longitude, or null when it is not a number in range. */
export function readCoordinate(text: string, limit: number): number | null {
    const n = Number(text.trim());
    return text.trim() !== '' && Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

/** A dictionary without one key (a copy). */
function without(map: Record<string, string>, key: string): Record<string, string> {
    const out = { ...map };
    delete out[key];
    return out;
}

/** Whether a field's new value is what the record holds already (nothing to save). */
function sameValue(value: FieldValue, stored: unknown): boolean {
    return value === null ? isUnset(stored) : value === stored;
}

export class PropertiesPanel extends React.Component<PropertiesPanelProps, Drafts> {
    private nameInput: HTMLInputElement | null = null;
    /**
     * The field whose Esc is blurring it: its blur must not save. React batches the Esc's own state change, so the blur
     * that follows in the same handler still reads the typed draft.
     */
    private escaped: string | null = null;
    /** The kind fields sent and not yet settled, with the text each showed when sent (entry 6's review). */
    private sent = new Map<string, string>();
    /** False once unmounted: the place data's load may settle after the panel has gone. */
    private mounted = false;

    constructor(props: PropertiesPanelProps) {
        super(props);
        this.state = draftsOf(props.item);
    }

    componentDidMount(): void {
        this.mounted = true;
        this.focusName();
        this.watchPlaces();
    }

    componentWillUnmount(): void {
        this.mounted = false;
    }

    /** A point's Location asks for the place data (once per page; a later panel waits on the same load) and draws again when it settles. */
    private watchPlaces(): void {
        const places = this.props.places;
        if (this.props.item.geometry.type !== 'Point' || places.status().state === 'ready' || places.status().state === 'failed') {
            return;
        }
        places.load().then(() => {
            if (this.mounted) {
                this.forceUpdate();
            }
        });
    }

    componentDidUpdate(prev: PropertiesPanelProps): void {
        if (prev.item.id !== this.props.item.id) {
            this.sent.clear();
            this.setState(draftsOf(this.props.item));
        } else if (prev.item.version !== this.props.item.version) {
            // The record moved on (this field's save, a drag's move, an undo, another editor): a field the user has not
            // touched (its draft is the previous record's value) follows it; a draft being typed keeps its keystrokes.
            const before = draftsOf(prev.item);
            const after = draftsOf(this.props.item);
            const next: Partial<Drafts> = {};
            for (const field of ['name', 'lat', 'lng'] as const) {
                if (this.state[field] === before[field]) {
                    next[field] = after[field];
                }
            }
            // A kind field's draft goes once the record holds it (saved) or still holds what it had (not touched since).
            const fields: Record<string, string> = {};
            const problems: Record<string, string> = {};
            for (const key of Object.keys(this.state.fields)) {
                const text = this.state.fields[key];
                if (text !== fieldText(prev.item.properties[key]) && text !== fieldText(this.props.item.properties[key])) {
                    fields[key] = text;
                    if (this.state.problems[key]) {
                        problems[key] = this.state.problems[key];
                    }
                }
            }
            next.fields = fields;
            next.problems = problems;
            this.setState(next as Pick<Drafts, keyof Drafts>);
        }
        if (prev.item.id === this.props.item.id && prev.saving && !this.props.saving && this.sent.size > 0) {
            // The item's saves settled: a field sent and not held by the record (refused, or dropped behind a refusal) shows the
            // record's value again; one typed since it was sent keeps its keystrokes.
            const sent = new Map(this.sent);
            this.sent.clear();
            const properties = this.props.item.properties;
            this.setState((state) => {
                const fields = { ...state.fields };
                const problems = { ...state.problems };
                sent.forEach((text, key) => {
                    if (fields[key] === text && text !== fieldText(properties[key])) {
                        delete fields[key];
                        delete problems[key];
                    }
                });
                return { fields, problems };
            });
        }
        if (!prev.autoFocusName && this.props.autoFocusName) {
            this.focusName();
        }
    }

    private focusName(): void {
        if (this.props.autoFocusName && this.nameInput) {
            this.nameInput.focus();
            this.nameInput.select();
            this.props.onNameFocused();
        }
    }

    private setNameInput = (el: HTMLInputElement | null): void => {
        this.nameInput = el;
    };

    /** True, once, when the blur is the Esc's (nothing to save). */
    private wasEscaped(field: string): boolean {
        if (this.escaped === field) {
            this.escaped = null;
            return true;
        }
        return false;
    }

    private commitName = (): void => {
        if (this.wasEscaped('name')) {
            return;
        }
        const name = this.state.name.trim();
        if (name === '' || name === this.props.item.name || this.props.paused) {
            this.setState({ name: this.props.item.name });
            return;
        }
        // The field shows the name as it is saved, outer spaces aside.
        this.setState({ name });
        this.props.onRename(name);
    };

    private commitLocation = (field: 'lat' | 'lng') => (): void => {
        if (this.wasEscaped(field)) {
            return;
        }
        const item = this.props.item;
        if (item.geometry.type !== 'Point') {
            return;
        }
        const lat = readCoordinate(this.state.lat, 90);
        const lng = readCoordinate(this.state.lng, 180);
        if (lat === null || lng === null) {
            return;
        }
        const [oldLng, oldLat] = item.geometry.coordinates;
        if (roundCoordinate(lat) === roundCoordinate(oldLat) && roundCoordinate(lng) === roundCoordinate(oldLng) || this.props.paused) {
            return;
        }
        this.props.onMove([lng, lat]);
    };

    /** Enter finishes a field (its blur saves it); Esc puts the record's value back. */
    private onKey = (field: FixedField) => (ev: React.KeyboardEvent<HTMLInputElement>): void => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            ev.currentTarget.blur();
        } else if (ev.key === 'Escape') {
            ev.preventDefault();
            ev.stopPropagation();
            this.escaped = field;
            this.setState({ [field]: draftsOf(this.props.item)[field] } as Pick<Drafts, FixedField>);
            ev.currentTarget.blur();
            this.escaped = null;
        }
    };

    /** A kind field's text typed (entry 6): kept as the draft until it is finished. */
    private onFieldText = (key: string) => (ev: React.ChangeEvent<HTMLInputElement>): void => {
        const text = ev.target.value;
        this.setState((prev) => ({ fields: { ...prev.fields, [key]: text } }));
    };

    /**
     * A text or number field finished (entry 6): read as its type; a value that is not one says so beside the field and is not
     * saved; one the record already holds saves nothing; else one update of `properties`, the draft showing the value as stored.
     */
    private commitField = (field: FormField) => (): void => {
        if (this.wasEscaped('field:' + field.key)) {
            return;
        }
        const text = this.state.fields[field.key];
        if (text === undefined) {
            return;
        }
        if (this.props.paused || !this.props.kind) {
            this.setState((prev) => ({ fields: without(prev.fields, field.key), problems: without(prev.problems, field.key) }));
            return;
        }
        const read = readField(field, text);
        if ('problem' in read) {
            const problem = read.problem;
            this.setState((prev) => ({ problems: { ...prev.problems, [field.key]: problem } }));
            return;
        }
        if (sameValue(read.value, this.props.newest[field.key])) {
            // The value sent last (or stored): nothing to send; the draft shows it until the record holds it.
            const shown = fieldText(read.value);
            this.setState((prev) => ({
                fields: this.sent.has(field.key) ? { ...prev.fields, [field.key]: shown } : without(prev.fields, field.key),
                problems: without(prev.problems, field.key)
            }));
            if (this.sent.has(field.key)) {
                this.sent.set(field.key, shown);
            }
            return;
        }
        const shown = fieldText(read.value);
        this.setState((prev) => ({ fields: { ...prev.fields, [field.key]: shown }, problems: without(prev.problems, field.key) }));
        this.sent.set(field.key, shown);
        this.props.onProperty(field.key, read.value);
    };

    /** Enter finishes a kind field; Esc puts the record's value back and saves nothing. */
    private onFieldKey = (field: FormField) => (ev: React.KeyboardEvent<HTMLInputElement>): void => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            ev.currentTarget.blur();
        } else if (ev.key === 'Escape') {
            ev.preventDefault();
            ev.stopPropagation();
            this.escaped = 'field:' + field.key;
            this.setState((prev) => ({ fields: without(prev.fields, field.key), problems: without(prev.problems, field.key) }));
            ev.currentTarget.blur();
            this.escaped = null;
        }
    };

    /** A choice or a checkbox (entry 6): saved at once, the draft showing it until the record holds it. */
    private chooseField(field: FormField, value: FieldValue): void {
        if (this.props.paused || !this.props.kind || sameValue(value, this.props.newest[field.key])) {
            return;
        }
        const shown = fieldText(value);
        this.setState((prev) => ({ fields: { ...prev.fields, [field.key]: shown } }));
        this.sent.set(field.key, shown);
        this.props.onProperty(field.key, value);
    }

    private onAssetChange = (ev: React.ChangeEvent<HTMLSelectElement>): void => {
        const value = ev.target.value;
        this.props.onLink(value === '' ? null : value);
    };

    private onKindChange = (ev: React.ChangeEvent<HTMLSelectElement>): void => {
        const value = ev.target.value;
        if (value !== '' && value !== this.props.item.kind && !this.props.paused) {
            this.props.onKind(value);
        }
    };

    private onUnlink = (): void => {
        this.props.onLink(null);
    };

    /** One of the kind's fields (entry 6) as its type, its draft or else the record's value. */
    private renderField(field: FormField, index: number): React.ReactElement {
        const { item, paused } = this.props;
        const id = 'mapstudio-prop-' + item.id + '-' + index;
        const draft = this.state.fields[field.key];
        const text = draft !== undefined ? draft : fieldText(item.properties[field.key]);
        const problem = this.state.problems[field.key] || '';
        const required = field.required ? <span className="mapstudio-field-required">{REQUIRED_TEXT}</span> : null;
        const rowProps = {
            className: 'mapstudio-field mapstudio-field--prop mapstudio-field--' + field.type,
            'data-field': field.key,
            'data-type': field.type,
            'data-required': field.required ? 'true' : 'false',
            'data-problem': problem
        };
        if (field.type === 'boolean') {
            return (
                <div key={field.key} {...rowProps}>
                    <div className="mapstudio-field-check-row">
                        <input id={id} type="checkbox" className="mapstudio-field-prop mapstudio-field-check" checked={text === 'true'}
                               disabled={paused} aria-required={field.required}
                               onChange={(ev) => this.chooseField(field, ev.target.checked)} />
                        <label className="mapstudio-field-check-label" htmlFor={id}>{field.label}</label>
                        {required}
                    </div>
                </div>
            );
        }
        const label = (
            <div className="mapstudio-field-label-row mapstudio-field-label-row--start">
                <label className="mapstudio-field-label" htmlFor={id}>{field.label}</label>
                {required}
            </div>
        );
        if (field.type === 'choice') {
            const odd = text !== '' && field.choices.indexOf(text) < 0;
            return (
                <div key={field.key} {...rowProps}>
                    {label}
                    <select id={id} className="mapstudio-input mapstudio-field-prop" value={text} disabled={paused} aria-required={field.required}
                            onChange={(ev) => this.chooseField(field, ev.target.value === '' ? null : ev.target.value)}>
                        <option value="">Not set</option>
                        {odd ? <option value={text}>{text} (not one of the choices)</option> : null}
                        {field.choices.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            );
        }
        const hintId = id + '-problem';
        return (
            <div key={field.key} {...rowProps}>
                {label}
                <input id={id} className="mapstudio-input mapstudio-field-prop" type="text" value={text} disabled={paused}
                       inputMode={field.type === 'integer' ? 'numeric' : field.type === 'number' ? 'decimal' : undefined}
                       aria-required={field.required} aria-invalid={problem !== ''} aria-describedby={problem !== '' ? hintId : undefined}
                       onChange={this.onFieldText(field.key)} onBlur={this.commitField(field)} onKeyDown={this.onFieldKey(field)} />
                {problem !== '' ? <span id={hintId} className="mapstudio-field-hint mapstudio-field-problem" aria-live="polite">{problem}</span> : null}
            </div>
        );
    }

    /** An unknown kind's stored values, read only (entry 6): kept as they are until the kind is changed. */
    private renderStored(): React.ReactNode {
        const properties = this.props.item.properties;
        return Object.keys(properties).filter((key) => !isUnset(properties[key])).map((key) => (
            <div key={key} className="mapstudio-field mapstudio-field--stored" data-field={key}>
                <span className="mapstudio-field-label">{key}</span>
                <span className="mapstudio-field-text mapstudio-field-stored">{fieldText(properties[key])}</span>
            </div>
        ));
    }

    render(): React.ReactElement {
        const { item, kind, kinds, assets, assetNames, assetStatus, pending, paused } = this.props;
        const point = item.geometry.type === 'Point';
        const known = kind !== undefined;
        // "Unknown kind" only while the kind list is in use; while it loads, is not configured or failed with none kept, its
        // status message says why the kind is not found (entry 6's review).
        const listKnown = kindListKnown(this.props.kindStatus);
        const kindHint = known ? '' : listKnown ? unknownKindText(item.kind) : kindListNote(this.props.kindStatus);
        const kindLabel = kind ? kind.name : listKnown ? UNKNOWN_KIND : item.kind;
        // Only Kind takes input while the kind is not in the kind list: the Gateway refuses any other change to the item.
        const frozen = paused || !known;
        const assetId = item.assetId;
        const vanished = assetVanished(assetId, assetNames, assetStatus);
        const listed = assetId !== null ? assetNames.find((a) => a.id === assetId) : undefined;
        const linkWords = assetId === null || vanished ? 'not linked' : 'linked to ' + (listed ? listed.name : assetId);
        const subline = kindLabel + ' - ' + linkWords;
        const remove = deleteButton(paused, pending, this.props.toolInHand, this.props.delKey);
        const latProblem = this.state.lat !== '' && readCoordinate(this.state.lat, 90) === null;
        const lngProblem = this.state.lng !== '' && readCoordinate(this.state.lng, 180) === null;
        // The place line (entry 27): the typed pair once both read as numbers, else the saved point. A pair that looks swapped says so
        // there and the hint keeps its instruction; any other pair out of range is flagged by the hint, as before, with no place line.
        const typedLat = readsAsNumber(this.state.lat);
        const typedLng = readsAsNumber(this.state.lng);
        const geometry = item.geometry;
        const place = geometry.type === 'Point'
            ? typedLat !== null && typedLng !== null
                ? placeLine(this.props.places.status(), typedLat, typedLng)
                : placeLine(this.props.places.status(), geometry.coordinates[1], geometry.coordinates[0])
            : null;
        const swapped = place !== null && place.state === 'swapped';
        const placeId = 'mapstudio-place-' + item.id;
        const missing = missingText(missingRequired(kind, item.properties));
        const twin = twinText(nameTwins(this.state.name, item, this.props.items, this.props.assetRows));
        const twinId = 'mapstudio-twin-' + item.id;
        const assetNote = assetListNote(assetStatus);
        const kindWords = kind ? kind.name.toLowerCase() : item.kind;
        return (
            <section className="mapstudio-panel" aria-label={item.name} data-item-id={item.id} data-pending={pending ? 'true' : 'false'}
                     data-paused={paused ? 'true' : 'false'} data-kind-known={known ? 'true' : 'false'}
                     data-kind-list={listKnown ? 'known' : 'unknown'} data-missing={missing}>
                <header className="mapstudio-panel-header">
                    <span className="mapstudio-popup-disc">
                        {kind && kind.icon !== '' ? <Glyph id={kind.icon} className="mapstudio-popup-glyph" size={18} /> : null}
                    </span>
                    <div className="mapstudio-popup-title">
                        <div className="mapstudio-popup-name mapstudio-panel-name">{item.name}</div>
                        <div className="mapstudio-popup-subline mapstudio-panel-subline">{subline}</div>
                    </div>
                    <button type="button" className="mapstudio-popup-icon mapstudio-panel-close" aria-label="Close" title="Close (Esc)"
                            aria-keyshortcuts="Escape" onClick={this.props.onClose}>
                        <ChromeGlyph name="close" className="mapstudio-popup-chrome" />
                    </button>
                </header>
                <div className="mapstudio-panel-tabs" role="tablist">
                    <button type="button" role="tab" aria-selected="true" className="mapstudio-panel-tab mapstudio-panel-tab--active">Details</button>
                </div>
                <div className="mapstudio-panel-body" role="tabpanel">
                    {paused ? <div className="mapstudio-panel-note" role="status">Paused - the map store is unreachable</div>
                        : pending ? <div className="mapstudio-panel-note" role="status">Saving the new item... a field you finish now saves right after it.</div> : null}
                    {missing !== '' ? <div className="mapstudio-panel-note mapstudio-panel-missing" role="status">{missing}</div> : null}
                    <label className="mapstudio-field">
                        <span className="mapstudio-field-label">Name</span>
                        <input ref={this.setNameInput} className={'mapstudio-input mapstudio-field-name' + (twin !== '' ? ' mapstudio-field-name--twin' : '')}
                               type="text" value={this.state.name} disabled={frozen} title={twin !== '' ? twin : undefined}
                               aria-describedby={twin !== '' ? twinId : undefined} data-twin={twin}
                               onChange={(ev) => this.setState({ name: ev.target.value })} onBlur={this.commitName} onKeyDown={this.onKey('name')} />
                    </label>
                    {/* Outside the label, so the words describe Name and are not part of its name. */}
                    {twin !== '' ? <span id={twinId} className="mapstudio-visually-hidden">{twin}</span> : null}
                    <div className="mapstudio-field mapstudio-field--kind">
                        <label className="mapstudio-field-label" htmlFor={'mapstudio-kind-' + item.id}>Kind</label>
                        <select id={'mapstudio-kind-' + item.id} className="mapstudio-input mapstudio-field-kind" value={item.kind} disabled={paused}
                                aria-describedby={kindHint !== '' ? 'mapstudio-kind-hint-' + item.id : undefined} onChange={this.onKindChange}>
                            {!known || !kinds.some((k) => k.id === item.kind) ? <option value={item.kind}>{kindLabel}</option> : null}
                            {kinds.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                        </select>
                        {kindHint !== '' ? (
                            <span id={'mapstudio-kind-hint-' + item.id} className="mapstudio-field-hint mapstudio-field-kind-hint">{kindHint}</span>
                        ) : null}
                    </div>
                    <div className="mapstudio-field mapstudio-field--location" data-place={place ? place.state : ''}>
                        <div className="mapstudio-field-label-row">
                            <span className="mapstudio-field-label">Location</span>
                            {point ? (
                                <span className="mapstudio-field-actions">
                                    {/* Zoom to location moves the map only, so it stays on while the fields are paused or frozen. */}
                                    <button type="button" className="mapstudio-button mapstudio-field-zoom" title={ZOOM_TO_TITLE}
                                            onClick={this.props.onZoomTo}>{ZOOM_TO_TEXT}</button>
                                    {this.props.canMoveByClick ? (
                                        <button type="button" className="mapstudio-button mapstudio-field-move" aria-pressed={this.props.moving} disabled={frozen}
                                                title={this.props.moving ? 'Move waits for a click on the map; press again or Esc to cancel'
                                                    : 'Move: click the new place on the map'} aria-keyshortcuts={this.props.moving ? 'Escape' : undefined}
                                                onClick={this.props.onMoveStart}>Move</button>
                                    ) : null}
                                </span>
                            ) : null}
                        </div>
                        {point ? (
                            <div className="mapstudio-field-pair">
                                <label className="mapstudio-field-half">
                                    <span className="mapstudio-field-sublabel">Latitude</span>
                                    <input className="mapstudio-input mapstudio-field-lat" type="number" step="any" inputMode="decimal" value={this.state.lat}
                                           disabled={frozen} aria-invalid={latProblem} aria-describedby={place && place.text !== '' ? placeId : undefined}
                                           onChange={(ev) => this.setState({ lat: ev.target.value })}
                                           onBlur={this.commitLocation('lat')} onKeyDown={this.onKey('lat')} />
                                </label>
                                <label className="mapstudio-field-half">
                                    <span className="mapstudio-field-sublabel">Longitude</span>
                                    <input className="mapstudio-input mapstudio-field-lng" type="number" step="any" inputMode="decimal" value={this.state.lng}
                                           disabled={frozen} aria-invalid={lngProblem} aria-describedby={place && place.text !== '' ? placeId : undefined}
                                           onChange={(ev) => this.setState({ lng: ev.target.value })}
                                           onBlur={this.commitLocation('lng')} onKeyDown={this.onKey('lng')} />
                                </label>
                            </div>
                        ) : (
                            <span className="mapstudio-field-text">A line of {item.geometry.coordinates.length} points</span>
                        )}
                        <span className="mapstudio-field-hint">
                            {(latProblem || lngProblem) && !swapped
                                ? 'Latitude is -90 to 90 and longitude -180 to 180.'
                                : point ? 'Drag the pin to fine-tune, or type latitude and longitude.' : ''}
                        </span>
                        {place && place.text !== '' ? (
                            <span id={placeId} className="mapstudio-field-place" data-place={place.state} title={PLACE_CREDIT}>{place.text}</span>
                        ) : null}
                    </div>
                    {kind ? kind.fields.map((field, i) => this.renderField(field, i)) : this.renderStored()}
                    <div className="mapstudio-field mapstudio-field--asset" data-vanished={vanished ? 'true' : 'false'}>
                        <label className="mapstudio-field-label" htmlFor={'mapstudio-asset-' + item.id}>Asset</label>
                        <div className="mapstudio-field-pair">
                            <select id={'mapstudio-asset-' + item.id} className="mapstudio-input mapstudio-field-asset" value={assetId === null ? '' : assetId}
                                    disabled={frozen} onChange={this.onAssetChange}>
                                <option value="">Not linked</option>
                                {assetId !== null && !assets.some((a) => a.id === assetId)
                                    ? <option value={assetId}>{listed && !vanished ? listed.name : assetId + ' (not in the asset list)'}</option> : null}
                                {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                            {assetId !== null ? (
                                <button type="button" className="mapstudio-button mapstudio-field-unlink" disabled={frozen} onClick={this.onUnlink}>Unlink</button>
                            ) : null}
                        </div>
                        <span className="mapstudio-field-hint mapstudio-field-asset-hint">
                            {vanished && assetId !== null
                                ? vanishedText(assetId)
                                : assetId === null
                                    ? (assets.length === 0 ? 'No ' + kindWords + ' assets in the asset list.' : 'Not linked. Pick an asset to show live values.')
                                    : 'Live values come from the linked asset\'s tags.'}
                        </span>
                        {assetNote !== '' ? (
                            <span className="mapstudio-field-asset-status" role="status" data-status={assetStatus ? assetStatus.status : ''}>{assetNote}</span>
                        ) : null}
                    </div>
                </div>
                <footer className="mapstudio-panel-footer">
                    <button type="button" className="mapstudio-dock-button mapstudio-panel-delete" disabled={remove.off !== ''} title={remove.title}
                            aria-label={'Delete ' + item.name} aria-keyshortcuts={remove.key ? 'Delete' : undefined}
                            data-off={remove.off} onClick={this.props.onDelete}>
                        <ChromeGlyph name="trash" />
                    </button>
                </footer>
            </section>
        );
    }
}
