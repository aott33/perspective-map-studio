/**
 * The View-mode controls' wiring (epic 4 entry 1, the component split; epic 3 entry 14, DESIGN.md View
 * mode): one function adds the zoom card top-right, the search field top-left with the Needs you bar in
 * its slot and its list under the row, the legend bottom-left and the provider's attribution
 * bottom-right, each wired to the component's callbacks, and returns the handles the component keeps
 * (their setters are called where the items, the fit, the selection and the basemap are drawn);
 * another adds or removes the Mapbox logo while Satellite is drawn. DOM-bound (MapLibre controls);
 * the controls themselves are their own modules (ZoomControl.ts, SearchControl.ts, NeedsYouControl.ts,
 * LegendControl.ts, mapboxLogo.ts) and the Draw a line toggle is Edit mode's (editing.ts).
 */

import { AttributionControl, Map as MapLibreMap } from 'maplibre-gl';
import { BasemapId } from './basemaps';
import { LegendControl } from './LegendControl';
import { LegendToggle } from './legend';
import { MapboxLogoControl } from './mapboxLogo';
import { NeedsYouControl } from './NeedsYouControl';
import { NeedsYouRow } from './needsyou';
import { SearchControl } from './SearchControl';
import { SearchResult } from './search';
import { ZoomControl } from './ZoomControl';

/** What the controls call back on the component. */
export interface ViewControlsHost {
    /** The map's element, which carries the `data-*-open` attributes the suite reads; null once unmounted. */
    mapContainer: HTMLDivElement | null;
    /** The zoom card's Fit and Return. */
    onFit(): void;
    onReturn(): void;
    /** A search result or a Needs you row chosen. */
    onSearchChoose(result: SearchResult): void;
    onNeedsYouChoose(row: NeedsYouRow): void;
    /** The legend's basemap choice (for the delegate) and its Lines and Names toggles. */
    onBasemapChoose(id: BasemapId): void;
    onLegendSwitch(toggle: LegendToggle, on: boolean): void;
}

/** The handles the component keeps; `needsYou` is null when the search control gave no slot. */
export interface ViewControls {
    zoom: ZoomControl;
    search: SearchControl;
    needsYou: NeedsYouControl | null;
    legend: LegendControl;
}

/**
 * The View-mode controls as designed (epic 3 entry 14, DESIGN.md View mode): one zoom card top-right
 * (plus, the level, minus, Fit, Return), and bottom-left the Legend button with the scale bar and the
 * attribution beside it, whose panel holds the basemap choice; the bottom-right corner stays clear
 * for the Perspective App Bar toggle.
 */
export function addViewControls(map: MapLibreMap, host: ViewControlsHost, toggles: Record<LegendToggle, boolean>): ViewControls {
    const zoom = new ZoomControl(host.onFit, host.onReturn);
    map.addControl(zoom, 'top-right');
    // The search field top-left (entry 9, DESIGN.md search-field): the top bar entry 3 shares with Needs you.
    const search = new SearchControl(host.onSearchChoose, (open) => {
        if (host.mapContainer) {
            host.mapContainer.setAttribute('data-search-open', open ? 'true' : 'false');
        }
    });
    map.addControl(search, 'top-left');
    // The Needs you bar after the field and its list under the row (entry 3, DESIGN.md needs-you-bar).
    let needsYou: NeedsYouControl | null = null;
    const slot = search.slot();
    const panelHost = search.panelHost();
    if (slot && panelHost) {
        needsYou = new NeedsYouControl(host.onNeedsYouChoose, (open) => {
            if (host.mapContainer) {
                host.mapContainer.setAttribute('data-needs-open', open ? 'true' : 'false');
            }
            if (open) {
                search.close();
            }
        });
        needsYou.mount(slot, panelHost);
    }
    const legend = new LegendControl(host.onBasemapChoose, (open) => {
        if (host.mapContainer) {
            host.mapContainer.setAttribute('data-legend-open', open ? 'true' : 'false');
        }
    }, host.onLegendSwitch);
    legend.setToggles(toggles.lines, toggles.names);
    map.addControl(legend, 'bottom-left');
    // The provider's attribution (R10, always shown with a basemap): small muted text along the bottom-right
    // edge under the App Bar toggle, never covering it (owner review, item 3); with Satellite the Mapbox logo
    // joins it in that corner (applyProviderLogo; the stylesheet places both at every width).
    map.addControl(new AttributionControl({ compact: false }), 'bottom-right');
    return { zoom, search, needsYou, legend };
}

/**
 * The Mapbox logo while Satellite is drawn, and only then (owner decision 2026-11-03), bottom-right with the
 * attribution (owner, 0.3.0 re-test: "all the logos on the bottom right"). Takes the control the map holds
 * (or null) and the provider's logo (basemaps.ts providerLogo); returns the control the map holds now.
 */
export function applyProviderLogo(map: MapLibreMap, current: MapboxLogoControl | null, logo: string | null): MapboxLogoControl | null {
    if (logo === 'mapbox' && !current) {
        const added = new MapboxLogoControl();
        map.addControl(added, 'bottom-right');
        return added;
    }
    if (logo !== 'mapbox' && current) {
        map.removeControl(current);
        return null;
    }
    return current;
}
