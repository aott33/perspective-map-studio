import * as React from 'react';
import { Asset, Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { Glyph } from '../popupParts';
import { roundCoordinate } from '../save';
import { ChromeGlyph } from './ChromeGlyph';

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
 * create's reply at the right version. The Style tab, the kind's form fields, the place check, the page
 * link and the Live now block are later entries. The panel is keyed by the item's id, so its drafts
 * start from the record; a new version of the record (a save, an undo, another editor's change) resets
 * the fields the user has not touched and keeps a draft being typed. While map.load says the store is
 * unreachable the fields are paused, as the toolbar is.
 */
export interface PropertiesPanelProps {
    item: MapItemRecord;
    kind: Kind | undefined;
    /** The kinds with the item's geometry (a line kind, areas included, for a LineString), for the Kind select. */
    kinds: Kind[];
    /** The kind's assets from the asset list (level `phone` or `full`), for the picker. */
    assets: Asset[];
    /** The linked asset's name, or null when none or not in the list. */
    assetName: string | null;
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
}

interface Drafts {
    name: string;
    lat: string;
    lng: string;
}

/** The record's values as the fields show them. */
function draftsOf(item: MapItemRecord): Drafts {
    const point = item.geometry.type === 'Point';
    return {
        name: item.name,
        lat: point ? String(item.geometry.coordinates[1]) : '',
        lng: point ? String(item.geometry.coordinates[0]) : ''
    };
}

/** A typed latitude or longitude, or null when it is not a number in range. */
export function readCoordinate(text: string, limit: number): number | null {
    const n = Number(text.trim());
    return text.trim() !== '' && Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

export class PropertiesPanel extends React.Component<PropertiesPanelProps, Drafts> {
    private nameInput: HTMLInputElement | null = null;

    constructor(props: PropertiesPanelProps) {
        super(props);
        this.state = draftsOf(props.item);
    }

    componentDidMount(): void {
        this.focusName();
    }

    componentDidUpdate(prev: PropertiesPanelProps): void {
        if (prev.item.id !== this.props.item.id) {
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
            this.setState(next as Pick<Drafts, keyof Drafts>);
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

    private commitName = (): void => {
        const name = this.state.name.trim();
        if (name === '' || name === this.props.item.name || this.props.paused) {
            this.setState({ name: this.props.item.name });
            return;
        }
        this.props.onRename(name);
    };

    private commitLocation = (): void => {
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
    private onKey = (field: keyof Drafts) => (ev: React.KeyboardEvent<HTMLInputElement>): void => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            ev.currentTarget.blur();
        } else if (ev.key === 'Escape') {
            ev.preventDefault();
            ev.stopPropagation();
            this.setState({ [field]: draftsOf(this.props.item)[field] } as Pick<Drafts, keyof Drafts>);
            ev.currentTarget.blur();
        }
    };

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

    render(): React.ReactElement {
        const { item, kind, kinds, assets, assetName, pending, paused } = this.props;
        const point = item.geometry.type === 'Point';
        const kindName = kind ? kind.name : item.kind;
        const assetId = item.assetId;
        const subline = kindName + ' - ' + (item.assetId === null ? 'not linked' : 'linked to ' + (assetName || item.assetId));
        const latProblem = this.state.lat !== '' && readCoordinate(this.state.lat, 90) === null;
        const lngProblem = this.state.lng !== '' && readCoordinate(this.state.lng, 180) === null;
        return (
            <section className="mapstudio-panel" aria-label={item.name} data-item-id={item.id} data-pending={pending ? 'true' : 'false'}
                     data-paused={paused ? 'true' : 'false'}>
                <header className="mapstudio-panel-header">
                    <span className="mapstudio-popup-disc">
                        {kind && kind.icon !== '' ? <Glyph id={kind.icon} className="mapstudio-popup-glyph" size={18} /> : null}
                    </span>
                    <div className="mapstudio-popup-title">
                        <div className="mapstudio-popup-name mapstudio-panel-name">{item.name}</div>
                        <div className="mapstudio-popup-subline mapstudio-panel-subline">{subline}</div>
                    </div>
                    <button type="button" className="mapstudio-popup-icon mapstudio-panel-close" aria-label="Close" title="Close" onClick={this.props.onClose}>
                        <ChromeGlyph name="close" className="mapstudio-popup-chrome" />
                    </button>
                </header>
                <div className="mapstudio-panel-tabs" role="tablist">
                    <button type="button" role="tab" aria-selected="true" className="mapstudio-panel-tab mapstudio-panel-tab--active">Details</button>
                </div>
                <div className="mapstudio-panel-body" role="tabpanel">
                    {paused ? <div className="mapstudio-panel-note" role="status">Paused - the map store is unreachable</div>
                        : pending ? <div className="mapstudio-panel-note" role="status">Saving the new item... a field you finish now saves right after it.</div> : null}
                    <label className="mapstudio-field">
                        <span className="mapstudio-field-label">Name</span>
                        <input ref={this.setNameInput} className="mapstudio-input mapstudio-field-name" type="text" value={this.state.name} disabled={paused}
                               onChange={(ev) => this.setState({ name: ev.target.value })} onBlur={this.commitName} onKeyDown={this.onKey('name')} />
                    </label>
                    <div className="mapstudio-field mapstudio-field--kind">
                        <label className="mapstudio-field-label" htmlFor={'mapstudio-kind-' + item.id}>Kind</label>
                        <select id={'mapstudio-kind-' + item.id} className="mapstudio-input mapstudio-field-kind" value={item.kind} disabled={paused}
                                onChange={this.onKindChange}>
                            {!kinds.some((k) => k.id === item.kind) ? <option value={item.kind}>{item.kind} (not in the kind list)</option> : null}
                            {kinds.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                        </select>
                    </div>
                    <div className="mapstudio-field mapstudio-field--location">
                        <div className="mapstudio-field-label-row">
                            <span className="mapstudio-field-label">Location</span>
                            {point && this.props.canMoveByClick ? (
                                <button type="button" className="mapstudio-button mapstudio-field-move" aria-pressed={this.props.moving} disabled={paused}
                                        title={this.props.moving ? 'Move waits for a click on the map; press again or Esc to cancel'
                                            : 'Move: click the new place on the map'} onClick={this.props.onMoveStart}>Move</button>
                            ) : null}
                        </div>
                        {point ? (
                            <div className="mapstudio-field-pair">
                                <label className="mapstudio-field-half">
                                    <span className="mapstudio-field-sublabel">Latitude</span>
                                    <input className="mapstudio-input mapstudio-field-lat" type="number" step="any" inputMode="decimal" value={this.state.lat}
                                           disabled={paused} aria-invalid={latProblem} onChange={(ev) => this.setState({ lat: ev.target.value })}
                                           onBlur={this.commitLocation} onKeyDown={this.onKey('lat')} />
                                </label>
                                <label className="mapstudio-field-half">
                                    <span className="mapstudio-field-sublabel">Longitude</span>
                                    <input className="mapstudio-input mapstudio-field-lng" type="number" step="any" inputMode="decimal" value={this.state.lng}
                                           disabled={paused} aria-invalid={lngProblem} onChange={(ev) => this.setState({ lng: ev.target.value })}
                                           onBlur={this.commitLocation} onKeyDown={this.onKey('lng')} />
                                </label>
                            </div>
                        ) : (
                            <span className="mapstudio-field-text">A line of {item.geometry.coordinates.length} points</span>
                        )}
                        <span className="mapstudio-field-hint">
                            {latProblem || lngProblem
                                ? 'Latitude is -90 to 90 and longitude -180 to 180.'
                                : point ? 'Drag the pin to fine-tune, or type latitude and longitude.' : ''}
                        </span>
                    </div>
                    <div className="mapstudio-field mapstudio-field--asset">
                        <label className="mapstudio-field-label" htmlFor={'mapstudio-asset-' + item.id}>Asset</label>
                        <div className="mapstudio-field-pair">
                            <select id={'mapstudio-asset-' + item.id} className="mapstudio-input mapstudio-field-asset" value={assetId === null ? '' : assetId}
                                    disabled={paused} onChange={this.onAssetChange}>
                                <option value="">Not linked</option>
                                {assetId !== null && !assets.some((a) => a.id === assetId)
                                    ? <option value={assetId}>{assetId} (not in the asset list)</option> : null}
                                {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                            {assetId !== null ? (
                                <button type="button" className="mapstudio-button mapstudio-field-unlink" disabled={paused} onClick={this.onUnlink}>Unlink</button>
                            ) : null}
                        </div>
                        <span className="mapstudio-field-hint">
                            {assetId === null
                                ? (assets.length === 0 ? 'No ' + kindName.toLowerCase() + ' assets in the asset list.' : 'Not linked. Pick an asset to show live values.')
                                : 'Live values come from the linked asset\'s tags.'}
                        </span>
                    </div>
                </div>
            </section>
        );
    }
}
