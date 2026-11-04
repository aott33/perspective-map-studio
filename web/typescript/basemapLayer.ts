/**
 * The basemap under the items (epic 4 entry 1, the component split; epic 3 entry 6): the delegate's
 * choice drawn when its revision changed (mapLayers.ts setBasemapLayer), the legend's buttons and
 * status, the Mapbox logo while Satellite is drawn (viewControls.ts), the provider's "Improve this
 * map" links carrying the map's position, a tile that did not load said once in words, and the
 * basemap attributes the e2e suite reads. DOM-bound (the attribution's links, the map's error and
 * idle events); every function takes the component as its host (BasemapHost names the fields it
 * reads), and the revision gating stays the component's: `drawnBasemap`, `drawnSource` and `tiles`
 * are its fields, read and written here exactly as before the split.
 */

import { ErrorEvent, Map as MapLibreMap } from 'maplibre-gl';
import type { Props } from './MapStudio';
import { IMPROVE_MAP_CLASS, RasterSource, feedbackHref, providerLogo, rasterPaint, tilesFailedText } from './basemaps';
import { LegendControl } from './LegendControl';
import { SOURCE_BASEMAP, setBasemapLayer } from './mapLayers';
import { MapboxLogoControl } from './mapboxLogo';
import { applyProviderLogo } from './viewControls';

/** The drawn basemap's tiles: none (no source), loading, loaded (the map went idle) or failed (a tile error). */
export type TilesState = 'none' | 'loading' | 'loaded' | 'failed';

/** What the basemap reads and writes on the component. */
export interface BasemapHost {
    readonly props: Readonly<Props>;
    map: MapLibreMap | null;
    mapContainer: HTMLDivElement | null;
    itemsReady: boolean;
    /** The basemap revision last drawn, the raster source the map holds now (by identity) and its tiles' state. */
    drawnBasemap: number;
    drawnSource: RasterSource | null;
    tiles: TilesState;
    legendControl: LegendControl | null;
    /** The Mapbox logo control, bottom-right, while Satellite is drawn. */
    logoControl: MapboxLogoControl | null;
}

/**
 * Put the delegate's basemap under the items (epic 3 entry 6): the raster source and layer of the
 * chosen basemap, none for None; the control's buttons and status; the attributes tests read.
 */
export function applyBasemap(host: BasemapHost): void {
    const delegate = host.props.delegate;
    const map = host.map;
    if (!map || !host.itemsReady || !delegate || delegate.basemap.revision === host.drawnBasemap) {
        return;
    }
    const b = delegate.basemap;
    host.drawnBasemap = b.revision;
    if (host.legendControl) {
        host.legendControl.setOffered(b.offered);
        host.legendControl.setSelected(b.selected);
    }
    if (b.source !== host.drawnSource) {
        // Only a changed source touches the map: a status-only change (a refusal) keeps the tiles.
        host.drawnSource = b.source;
        setBasemapLayer(map, b.source, b.selected);
        host.tiles = b.source ? 'loading' : 'none';
    }
    // The Mapbox logo while Satellite is drawn, and only then (viewControls.ts applyProviderLogo).
    const logo = providerLogo(b.selected, b.source);
    host.logoControl = applyProviderLogo(map, host.logoControl, logo);
    if (host.mapContainer) {
        host.mapContainer.setAttribute('data-provider-logo', logo || '');
    }
    updateFeedbackLinks(host);
    publishBasemap(host);
}

/** The attribution's "Improve this map" links with the map's centre and zoom (basemaps.ts feedbackHref). */
export function updateFeedbackLinks(host: BasemapHost): void {
    const map = host.map;
    const el = host.mapContainer;
    if (!map || !el) {
        return;
    }
    const links = el.querySelectorAll<HTMLAnchorElement>('.maplibregl-ctrl-attrib a.' + IMPROVE_MAP_CLASS);
    if (links.length === 0) {
        return;
    }
    const center = map.getCenter();
    const zoom = map.getZoom();
    links.forEach((a) => {
        const href = feedbackHref(a.getAttribute('href') || '', center, zoom);
        if (a.getAttribute('href') !== href) {
            a.setAttribute('href', href);
        }
    });
}

/** The basemap's state for the control's status line and the e2e suite. */
export function publishBasemap(host: BasemapHost): void {
    const delegate = host.props.delegate;
    const el = host.mapContainer;
    if (!delegate || !el) {
        return;
    }
    const b = delegate.basemap;
    const status = b.status !== '' ? b.status : host.tiles === 'failed' && b.selected ? tilesFailedText(b.selected) : '';
    if (host.legendControl) {
        host.legendControl.setStatus(status);
    }
    el.setAttribute('data-basemap', b.selected || '');
    el.setAttribute('data-basemap-offered', b.offered.join(','));
    el.setAttribute('data-basemap-status', status);
    el.setAttribute('data-basemap-tiles', host.tiles);
    el.setAttribute('data-basemap-paint', JSON.stringify(rasterPaint(b.selected)));
    // What OpenStreetMap is drawn with whatever the choice (item 25), for the contrast check's quiet raster sample.
    el.setAttribute('data-quiet-paint', JSON.stringify(rasterPaint('osm')));
}

/**
 * A MapLibre error: a basemap tile that did not load (a blocked network, a site without internet)
 * is said once in words and at info, never as a browser error; anything else is an error as before
 * (with no listener MapLibre would write it to console.error itself).
 */
export function onMapError(host: BasemapHost, ev: ErrorEvent & { sourceId?: string }): void {
    if (ev.sourceId === SOURCE_BASEMAP) {
        if (host.tiles !== 'failed') {
            host.tiles = 'failed';
            const selected = host.props.delegate ? host.props.delegate.basemap.selected : null;
            console.info('[MapStudio] ' + (selected ? tilesFailedText(selected) : 'Basemap tiles are not loading.'));
            publishBasemap(host);
        }
        return;
    }
    console.error(ev.error);
}
