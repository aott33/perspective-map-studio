/**
 * The items on the map (epic 4 entry 1, the component split): the delegate's items put into the item
 * sources when their revision, the live revision, the selection or the sharing distance changed
 * (features.ts builds the GeoJSON), the queued edits into the unsaved sources (epic 2 story 8), the
 * sprite fetched once and the marker images drawn from it for MapLibre's missing image resolver
 * (markers.ts), the drawn copy of a queued line dropped from Terra Draw, and the item counts the e2e
 * suite reads. DOM-bound (MapLibre sources and images, a canvas); every function takes the component
 * as its host (ItemsHost names the fields and callbacks it reads), and the revision gating stays the
 * component's: `drawnRevision`, `drawnLive`, `drawnUnsaved`, `drawnFulls`, `drawnSelection` and
 * `drawnWithinM` are its fields, read and written here exactly as before the split.
 */

import { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { TerraDraw } from 'terra-draw';
import type { MapStudioState, Props } from './MapStudio';
import { MapFeatures, buildFeatures } from './features';
import { Place } from './place';
import { LegendControl } from './LegendControl';
import { legendKey } from './legend';
import {
    SOURCE_ARROW, SOURCE_ITEM_AREAS, SOURCE_ITEM_LINES, SOURCE_ITEM_POINTS, SOURCE_LINE_ENDS, SOURCE_LINE_MARKS, SOURCE_UNSAVED_LINES,
    SOURCE_UNSAVED_POINTS, SPRITE_URL
} from './mapLayers';
import { MarkerColors, SpriteSymbol, imageFor, parseSprite } from './markers';
import { NeedsYouControl } from './NeedsYouControl';
import { needsYou } from './needsyou';
import { itemsToGeoJson } from './save';
import { SearchControl } from './SearchControl';
import { buildEntries } from './search';
import { sharedWithinM } from './shared';
import { unsavedItems } from './unsaved';
import { UserLocation } from './userLocation';

/** What the items layer reads and writes on the component. */
export interface ItemsHost {
    readonly props: Readonly<Props>;
    readonly state: Readonly<MapStudioState>;
    map: MapLibreMap | null;
    mapContainer: HTMLDivElement | null;
    /** Whether the items sources exist (after the map's load). */
    itemsReady: boolean;
    /** The revisions last drawn: the items, the live values, the full batches (the legend's key), the selection, the sharing distance. */
    drawnRevision: number;
    drawnLive: number;
    drawnFulls: number;
    drawnSelection: string;
    drawnWithinM: number;
    /** The preview item last drawn with its word (epic 4 entry 12b2), '' for none. */
    drawnPreview: string;
    /** The unsaved and items revisions last drawn into the unsaved sources. */
    drawnUnsaved: string;
    /** Whether the e2e item counts were asked for (after the first loaded items are drawn). */
    itemCountsAsked: boolean;
    /** The theme colours the marker images are drawn with (item 29). */
    markerColors: MarkerColors | null;
    /** The sharing distance at the map's zoom (item 20). */
    withinM: number;
    /** Where each member of a shared marker is drawn, by item id (item 20): a popup anchors there. */
    anchors: Record<string, [number, number]>;
    /** The items' bounds last drawn and their key, for Fit; the key Fit keeps by, or null while Fit is not in force. */
    itemBounds: MapFeatures['bounds'];
    itemBoundsKey: string;
    fitKey: string | null;
    /** A remembered selection still to put back (camera.ts applyRestore), or null; the item counts wait for it. */
    restore: Place | null;
    /** The sprite's symbols once fetched (empty when the fetch failed), its fetch, and the images made, by id. */
    symbols: Record<string, SpriteSymbol> | null;
    sprite: Promise<Record<string, SpriteSymbol>> | null;
    madeImages: Map<string, Promise<void>>;
    /** Terra Draw and its features of finished lines: removed once queued, as the unsaved layer draws them. */
    draw: TerraDraw | null;
    queuedFeatures: Array<string | number>;
    searchControl: SearchControl | null;
    needsYouControl: NeedsYouControl | null;
    legendControl: LegendControl | null;
    /** The page's userLocation as read (entry 15): the legend's "You are here" row with a position. */
    readonly userLocation: UserLocation;
    /** The selection's attributes and Return (selection.tsx); a kept Fit's follow and its attribute (camera.ts). */
    publishSelection(): void;
    /** The preview item of the kind whose setup is open in Edit mode's Kinds (entry 12b2), or null: it carries the Preview word. */
    previewItemId(): string | null;
    fitTo(bounds: [number, number, number, number]): void;
    publishFit(): void;
}

/**
 * Put the delegate's items into the items sources when they changed; none while map.load
 * says the store is unreachable (nothing stale drawn as current). Then the unsaved items.
 */
export function drawItems(host: ItemsHost): void {
    drawUnsaved(host);
    const delegate = host.props.delegate;
    // One item: today's selection (its ring or casing, a line's arrow, floating ends and open segment). Several (epic 4 entry 8):
    // every item in the set takes its ring or casing alone, an area its casing, and no line its arrow or ends.
    const set = host.state.studio.selected;
    const several = set.length >= 2;
    const selected = several ? null : host.state.selected;
    const selectionKey = several ? 'set:' + set.join(',') : selected ? selected.kind + ':' + selected.id : '';
    // The preview item's word (entry 12b2) comes and goes with Kinds, the kind chosen, the preview item and Editing: a change of
    // it redraws the sources once, as a changed selection does.
    const previewId = host.previewItemId();
    const previewKey = previewId || '';
    if (!host.map || !host.itemsReady || !delegate || !host.markerColors
        || (delegate.itemsRevision === host.drawnRevision && delegate.liveRevision === host.drawnLive
            && selectionKey === host.drawnSelection && host.withinM === host.drawnWithinM && previewKey === host.drawnPreview)) {
        return;
    }
    // No store item is drawn as current while map.load says the store is unavailable; a save's pause (entry 10) keeps them.
    const items = delegate.editing === 'off' && !delegate.savePaused ? [] : delegate.items;
    const data = buildFeatures(items, delegate.lists.kinds, delegate.live, selected, host.markerColors, host.withinM, several ? set : [], previewId);
    host.anchors = data.anchors;
    host.drawnWithinM = host.withinM;
    const source = (id: string): GeoJSONSource | undefined => host.map!.getSource(id) as GeoJSONSource | undefined;
    const lines = source(SOURCE_ITEM_LINES);
    const areas = source(SOURCE_ITEM_AREAS);
    const points = source(SOURCE_ITEM_POINTS);
    const marks = source(SOURCE_LINE_MARKS);
    const arrow = source(SOURCE_ARROW);
    const ends = source(SOURCE_LINE_ENDS);
    if (lines && areas && points && marks && arrow && ends) {
        lines.setData(data.lines);
        areas.setData(data.areas);
        points.setData(data.points);
        marks.setData(data.marks);
        arrow.setData(data.arrow);
        ends.setData(data.ends);
        if (host.searchControl && delegate.itemsRevision !== host.drawnRevision) {
            // The search's entries follow the items (entry 9): names, kinds and the linked assets' names.
            host.searchControl.setEntries(buildEntries(items, delegate.lists.kinds, delegate.lists.assetNames));
        }
        if (host.needsYouControl) {
            // The Needs you summary from the same batch the markers draw from (entry 3, AD-6).
            // While the values are frozen (the connection lost, item 32) the bar shows the state unknown.
            host.needsYouControl.setUnknown(delegate.connection.frozen);
            host.needsYouControl.setSummary(needsYou(items, delegate.lists.kinds, delegate.live, Date.now()));
        }
        if (host.legendControl && (delegate.itemsRevision !== host.drawnRevision || delegate.live.fulls !== host.drawnFulls)) {
            // The legend's key follows the kinds on the map and the kind display of the last full batch (entry 3).
            host.legendControl.setKey(legendKey(items, delegate.lists.kinds, delegate.live.display, host.userLocation.state === 'fix'));
            host.drawnFulls = delegate.live.fulls;
        }
        host.drawnRevision = delegate.itemsRevision;
        host.drawnLive = delegate.liveRevision;
        host.drawnSelection = selectionKey;
        host.drawnPreview = previewKey;
        host.itemBounds = data.bounds;
        host.itemBoundsKey = data.boundsKey;
        if (host.mapContainer) {
            // The map items drawn (a shared marker counts its members), as the suite has always read it.
            host.mapContainer.setAttribute('data-items-loaded', String(data.lineItems + data.areas.features.length
                + data.points.features.reduce((n, f) => n + f.properties.members, 0)));
            host.mapContainer.setAttribute('data-shared-markers', String(data.shared));
            host.mapContainer.setAttribute('data-arrow', String(data.arrow.features.length));
            // The selected line's floating ends drawn with the mark (entry 4): 0, 1 or 2, '' with no line selected.
            host.mapContainer.setAttribute('data-floating-ends', data.arrow.features.length > 0 ? String(data.ends.features.length) : '');
            // The preview item and the words the map draws for it (entry 12b2), for tests: its chip's word (a point with a marker
            // of its own; '' when it shares a marker, is an area or is not drawn) or its line's label.
            const previewPoint = previewId ? data.points.features.find((f) => f.properties.id === previewId) : undefined;
            const previewMark = previewId ? data.marks.features.find((f) => f.properties.id === previewId) : undefined;
            host.mapContainer.setAttribute('data-preview-item', previewKey);
            host.mapContainer.setAttribute('data-preview-word', previewPoint ? previewPoint.properties.word : previewMark ? previewMark.properties.label : '');
            // The areas and their tints (entry 1), for tests: id, tint name and the resolved colour.
            host.mapContainer.setAttribute('data-areas', JSON.stringify(data.areas.features.map((f) => ({
                id: f.properties.id, tint: f.properties.tint, color: f.properties.color
            }))));
        }
        host.publishSelection();
        // A kept Fit follows a change of the items' bounds (a new item outside them), nothing else.
        if (host.fitKey !== null && host.fitKey !== data.boundsKey && data.bounds) {
            host.fitKey = data.boundsKey;
            host.fitTo(data.bounds);
        }
        host.publishFit();
        if (!host.itemCountsAsked && delegate.load.state === 'loaded') {
            // The first map.load's items, counted back from MapLibre once it has gone idle with them.
            host.itemCountsAsked = true;
            const map = host.map;
            map.once('idle', () => publishItemCounts(host, map));
        }
    }
}

/** The queued items, dashed, leaving out any the store already draws (saved in another tab). */
export function drawUnsaved(host: ItemsHost): void {
    const delegate = host.props.delegate;
    if (!host.map || !host.itemsReady || !delegate
        || delegate.unsavedRevision + ':' + delegate.itemsRevision === host.drawnUnsaved) {
        return;
    }
    const stored = new Set(delegate.items.filter((i) => i.version > 0).map((i) => i.id));
    const data = itemsToGeoJson(unsavedItems(delegate.unsaved).filter((i) => !stored.has(i.id)));
    const lines = host.map.getSource(SOURCE_UNSAVED_LINES) as GeoJSONSource | undefined;
    const points = host.map.getSource(SOURCE_UNSAVED_POINTS) as GeoJSONSource | undefined;
    if (lines && points) {
        lines.setData(data.lines);
        points.setData(data.points);
        host.drawnUnsaved = delegate.unsavedRevision + ':' + delegate.itemsRevision;
        if (host.mapContainer) {
            // For tests: the features put into the unsaved sources (dashed lines and points).
            host.mapContainer.setAttribute('data-unsaved-drawn',
                String(data.lines.features.length + data.points.features.length));
        }
    }
}

/** A finished line is queued and drawn from the unsaved layer: remove Terra Draw's copy of it. */
export function dropQueuedFeatures(host: ItemsHost): void {
    if (!host.draw || host.queuedFeatures.length === 0) {
        return;
    }
    const ids = host.queuedFeatures;
    host.queuedFeatures = [];
    for (const id of ids) {
        try {
            host.draw.removeFeatures([id]);
        } catch (err) {
            console.info('[MapStudio] The drawn copy of a queued line was already gone.');
        }
    }
}

/** Fetch the sprite once; an image asked for meanwhile waits for it (a failed fetch draws the markers without glyphs). */
export function loadSprite(host: ItemsHost): Promise<Record<string, SpriteSymbol>> {
    if (host.sprite) {
        return host.sprite;
    }
    if (typeof fetch !== 'function') {
        host.sprite = Promise.resolve({});
        return host.sprite;
    }
    host.sprite = fetch(SPRITE_URL).then((res) => {
        if (!res.ok) {
            throw new Error('HTTP ' + res.status);
        }
        return res.text();
    }).then((text) => {
        host.symbols = parseSprite(text);
        return host.symbols;
    }).catch((err) => {
        console.warn('[MapStudio] The icon sprite could not be loaded (' + String(err && err.message ? err.message : err)
            + '); markers draw without glyphs.');
        host.symbols = {};
        return host.symbols;
    });
    return host.sprite;
}

/**
 * MapLibre asked for an image it does not have (the missing image resolver): draw it from the
 * sprite and the theme tokens at the device pixel ratio and add it. The promise settles once the
 * image is in the map (MapLibre waits for it before laying the symbols out); a second ask for the
 * same id shares the first's promise.
 */
export function makeImage(host: ItemsHost, id: string): Promise<void> {
    const map = host.map;
    const colors = host.markerColors;
    if (!map || !colors) {
        return Promise.resolve();
    }
    const made = host.madeImages.get(id);
    if (made) {
        return made;
    }
    const promise = loadSprite(host).then((symbols) => new Promise<void>((resolve) => {
        const spec = imageFor(id, symbols, colors);
        if (!spec || host.map !== map) {
            resolve();
            return;
        }
        const ratio = typeof window !== 'undefined' && window.devicePixelRatio ? Math.min(3, window.devicePixelRatio) : 1;
        const image = new Image();
        image.onload = () => {
            if (host.map === map) {
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(spec.width * ratio);
                canvas.height = Math.round(spec.height * ratio);
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    if (!map.hasImage(id)) {
                        const scale = (n: number): number => Math.round(n * ratio);
                        map.addImage(id, data, {
                            pixelRatio: ratio,
                            ...(spec.content ? { content: spec.content.map(scale) as [number, number, number, number] } : {}),
                            ...(spec.stretchX ? { stretchX: spec.stretchX.map(([a, b]) => [scale(a), scale(b)] as [number, number]) } : {}),
                            ...(spec.stretchY ? { stretchY: spec.stretchY.map(([a, b]) => [scale(a), scale(b)] as [number, number]) } : {})
                        });
                    }
                }
            }
            resolve();
        };
        image.onerror = () => {
            console.warn('[MapStudio] A marker image could not be drawn.');
            resolve();
        };
        image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(spec.svg);
    }));
    host.madeImages.set(id, promise);
    return promise;
}

/**
 * The theme changed (item 29): the images were drawn in the old colours, so they are dropped and the
 * missing-image resolver draws them again, and the items are drawn again from the first revision.
 */
export function dropImages(host: ItemsHost, map: MapLibreMap): void {
    for (const id of Array.from(host.madeImages.keys())) {
        if (map.hasImage(id)) {
            map.removeImage(id);
        }
    }
    host.madeImages.clear();
    host.drawnRevision = -1;
}

/**
 * For the e2e suite: the point and line items of the first map.load, read back from
 * MapLibre's own item sources (querySourceFeatures, unique by the feature's id
 * property) after the map went idle with them, so they prove the items reached the
 * map. Only features in the loaded tiles count, so on a small viewport some may not.
 */
export function publishItemCounts(host: ItemsHost, map: MapLibreMap): void {
    const el = host.mapContainer;
    if (!el || host.map !== map) {
        return;
    }
    const canvas = map.getCanvas();
    const container = map.getContainer();
    if (host.restore !== null || canvas.clientWidth !== container.clientWidth || canvas.clientHeight !== container.clientHeight) {
        // A remembered selection is still to come back (owner re-test R4 (a)), and in Edit mode its properties panel
        // docks beside the map and resizes it (epic 4 entry 2): the counts, which a test takes as "drawn and settled",
        // wait for the idle after it is put back or dropped and after the canvas matches its container again (every
        // values batch and every resize redraws, so an idle follows).
        map.once('idle', () => publishItemCounts(host, map));
        return;
    }
    const count = (source: string): number => {
        const ids = new Set<string>();
        for (const f of map.querySourceFeatures(source)) {
            const id = f.properties ? f.properties.id : undefined;
            if (typeof id === 'string') {
                ids.add(id);
            }
        }
        return ids.size;
    };
    el.setAttribute('data-points-loaded', String(count(SOURCE_ITEM_POINTS)));
    el.setAttribute('data-lines-loaded', String(count(SOURCE_ITEM_LINES)));
}

/**
 * The zoom settled (owner review notes item 20): the sharing distance follows the zoom, so a group
 * of points splits once its members are a marker apart on screen; the features are rebuilt when it moves.
 */
export function onZoomEnd(host: ItemsHost, map: MapLibreMap): void {
    if (host.map !== map) {
        return;
    }
    const withinM = sharedWithinM(map.getZoom(), map.getCenter().lat);
    if (withinM !== host.withinM) {
        host.withinM = withinM;
        drawItems(host);
    }
}
