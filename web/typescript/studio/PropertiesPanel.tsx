import * as React from 'react';
import { Asset, Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { Glyph } from '../popupParts';
import { roundCoordinate } from '../save';
import { ChromeGlyph } from './ChromeGlyph';

/**
 * The docked properties panel's Details tab (epic 4 entry 2; DESIGN.md Properties panel and tabs,
 * EXPERIENCE.md Properties panel, Place a point): the header with the kind glyph, the name and the
 * subline, the Details tab, then Name, Kind (read-only text in this slice), Location (latitude and
 * longitude, typed, the non-drag way to place a point) and the asset link (the kind's assets, Unlink).
 * Every field saves when it is finished (blur or Enter) through the component's callbacks, one
 * batch each. A field finished while the item's create is still being saved (no stored version yet,
 * the pad just placed with the cursor already in Name) is held and sent once the version arrives.
 * The Style tab, the kind's form fields, the place check, the page link and the Live now block are
 * later entries. The panel is keyed by the item's id, so its drafts start from the record; a new
 * version of the record (a save, an undo, another editor's change) resets them.
 */
export interface PropertiesPanelProps {
    item: MapItemRecord;
    kind: Kind | undefined;
    /** The kind's assets from the asset list (level `phone` or `full`), for the picker. */
    assets: Asset[];
    /** The linked asset's name, or null when none or not in the list. */
    assetName: string | null;
    /** The item's create is still being saved (no stored version yet): a finished field waits for it. */
    pending: boolean;
    /** Open with the cursor in Name (the pad just placed; owner decision, 2026-11-04). */
    autoFocusName: boolean;
    onNameFocused: () => void;
    onClose: () => void;
    onRename: (name: string) => void;
    onMove: (lngLat: [number, number]) => void;
    onLink: (assetId: string | null) => void;
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

/** A field finished while the create was in flight, sent once the item has a version. */
interface Held {
    name?: string;
    lngLat?: [number, number];
    assetId?: string | null;
}

export class PropertiesPanel extends React.Component<PropertiesPanelProps, Drafts> {
    private nameInput: HTMLInputElement | null = null;
    private held: Held = {};

    constructor(props: PropertiesPanelProps) {
        super(props);
        this.state = draftsOf(props.item);
    }

    componentDidMount(): void {
        this.focusName();
    }

    componentDidUpdate(prev: PropertiesPanelProps): void {
        if (prev.item.id !== this.props.item.id || prev.item.version !== this.props.item.version) {
            // The record moved on (this field's save, an undo, another editor): the drafts follow it, a held draft excepted.
            const drafts = draftsOf(this.props.item);
            if (this.held.name !== undefined) {
                drafts.name = this.held.name;
            }
            this.setState(drafts);
        }
        if (prev.pending && !this.props.pending) {
            this.sendHeld();
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

    /** The fields finished while the create was being saved, now that the item has a version. */
    private sendHeld(): void {
        const held = this.held;
        this.held = {};
        if (held.name !== undefined && held.name !== this.props.item.name) {
            this.props.onRename(held.name);
        }
        if (held.lngLat !== undefined) {
            this.props.onMove(held.lngLat);
        }
        if (held.assetId !== undefined && held.assetId !== this.props.item.assetId) {
            this.props.onLink(held.assetId);
        }
    }

    private setNameInput = (el: HTMLInputElement | null): void => {
        this.nameInput = el;
    };

    private commitName = (): void => {
        const name = this.state.name.trim();
        if (name === '' || name === this.props.item.name) {
            this.setState({ name: this.props.item.name });
            return;
        }
        if (this.props.pending) {
            this.held.name = name;
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
        if (roundCoordinate(lat) === roundCoordinate(oldLat) && roundCoordinate(lng) === roundCoordinate(oldLng)) {
            return;
        }
        if (this.props.pending) {
            this.held.lngLat = [lng, lat];
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
        const assetId = value === '' ? null : value;
        if (this.props.pending) {
            this.held.assetId = assetId;
            return;
        }
        this.props.onLink(assetId);
    };

    private onUnlink = (): void => {
        if (this.props.pending) {
            this.held.assetId = null;
            return;
        }
        this.props.onLink(null);
    };

    render(): React.ReactElement {
        const { item, kind, assets, assetName, pending } = this.props;
        const point = item.geometry.type === 'Point';
        const kindName = kind ? kind.name : item.kind;
        const assetId = this.held.assetId !== undefined ? this.held.assetId : item.assetId;
        const subline = kindName + ' - ' + (item.assetId === null ? 'not linked' : 'linked to ' + (assetName || item.assetId));
        const latProblem = this.state.lat !== '' && readCoordinate(this.state.lat, 90) === null;
        const lngProblem = this.state.lng !== '' && readCoordinate(this.state.lng, 180) === null;
        return (
            <section className="mapstudio-panel" aria-label={item.name} data-item-id={item.id} data-pending={pending ? 'true' : 'false'}>
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
                    {pending ? <div className="mapstudio-panel-note" role="status">Saving the new item... a field you finish now saves right after it.</div> : null}
                    <label className="mapstudio-field">
                        <span className="mapstudio-field-label">Name</span>
                        <input ref={this.setNameInput} className="mapstudio-input mapstudio-field-name" type="text" value={this.state.name}
                               onChange={(ev) => this.setState({ name: ev.target.value })} onBlur={this.commitName} onKeyDown={this.onKey('name')} />
                    </label>
                    <div className="mapstudio-field">
                        <span className="mapstudio-field-label">Kind</span>
                        <span className="mapstudio-field-text mapstudio-field-kind">{kindName}</span>
                    </div>
                    <div className="mapstudio-field mapstudio-field--location">
                        <span className="mapstudio-field-label">Location</span>
                        {point ? (
                            <div className="mapstudio-field-pair">
                                <label className="mapstudio-field-half">
                                    <span className="mapstudio-field-sublabel">Latitude</span>
                                    <input className="mapstudio-input mapstudio-field-lat" type="number" step="any" inputMode="decimal" value={this.state.lat}
                                           aria-invalid={latProblem} onChange={(ev) => this.setState({ lat: ev.target.value })}
                                           onBlur={this.commitLocation} onKeyDown={this.onKey('lat')} />
                                </label>
                                <label className="mapstudio-field-half">
                                    <span className="mapstudio-field-sublabel">Longitude</span>
                                    <input className="mapstudio-input mapstudio-field-lng" type="number" step="any" inputMode="decimal" value={this.state.lng}
                                           aria-invalid={lngProblem} onChange={(ev) => this.setState({ lng: ev.target.value })}
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
                                    onChange={this.onAssetChange}>
                                <option value="">Not linked</option>
                                {assetId !== null && !assets.some((a) => a.id === assetId)
                                    ? <option value={assetId}>{assetId} (not in the asset list)</option> : null}
                                {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                            {assetId !== null ? (
                                <button type="button" className="mapstudio-button mapstudio-field-unlink" onClick={this.onUnlink}>Unlink</button>
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
