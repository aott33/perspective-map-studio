/**
 * Basemaps in the browser (epic 3 entry 6, R10, AD-12): which of the setup's basemaps the control
 * offers (None, OpenStreetMap, Satellite; the Mapbox vector style is deferred and not offered), the
 * OpenStreetMap raster source, the reader of the Gateway's `basemap.source.reply` (the satellite
 * source, whose token the Gateway read from the setup's secret), the initial choice, and the words
 * of every status. Pure, unit tested in node.
 *
 * The token reaches this code only inside the satellite tile URL template, kept in the delegate's
 * memory for the page; nothing here writes it anywhere, and the remembered choice is the basemap's
 * id only.
 */

import { isRecord } from './json';

export type BasemapId = 'none' | 'osm' | 'satellite';

/** The ids this version draws, in the order the control shows them when the setup lists them. */
export const BASEMAP_IDS: readonly BasemapId[] = ['none', 'osm', 'satellite'];

export const BASEMAP_LABELS: Record<BasemapId, string> = {
    none: 'None',
    osm: 'OpenStreetMap',
    satellite: 'Satellite'
};

/** A raster tile source the map draws under its items (MapLibre raster source fields). */
export interface RasterSource {
    tiles: string[];
    tileSize: number;
    maxzoom: number;
    /** HTML the attribution control shows, always, for this provider. */
    attribution: string;
}

/**
 * OpenStreetMap's public tiles. Their usage policy asks for attribution, light use and no bulk
 * downloading (docs/setup.md); the browser sends its Referer as the policy asks.
 */
export const OSM_SOURCE: RasterSource = {
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
};

/** The key the viewer's last choice is kept under in localStorage (the id only, never a token). */
export const BASEMAP_STORAGE_KEY = 'mapstudio.basemap.v1';

function isBasemapId(value: unknown): value is BasemapId {
    return typeof value === 'string' && (BASEMAP_IDS as readonly string[]).indexOf(value) >= 0;
}

/**
 * The basemaps the control offers from the setup's list, in the setup's order: the ids this version
 * draws; anything else (`mapbox`, a name from a newer setup) is left out and named in `dropped`.
 */
export function offeredBasemaps(setupList: readonly string[] | undefined | null): { offered: BasemapId[]; dropped: string[] } {
    const offered: BasemapId[] = [];
    const dropped: string[] = [];
    for (const id of setupList || []) {
        if (isBasemapId(id)) {
            if (offered.indexOf(id) < 0) {
                offered.push(id);
            }
        } else if (dropped.indexOf(id) < 0) {
            dropped.push(id);
        }
    }
    return { offered, dropped };
}

/**
 * The basemap to start on: the remembered one when the setup still offers it, else the first the
 * setup lists; null when nothing is offered (no setup yet, or a map.load that failed).
 */
export function initialBasemap(offered: readonly BasemapId[], remembered: string | null | undefined): BasemapId | null {
    if (isBasemapId(remembered) && offered.indexOf(remembered) >= 0) {
        return remembered;
    }
    return offered.length > 0 ? offered[0] : null;
}

/** The basemap to fall back to when `refused` cannot be drawn: the first offered one that needs no token. */
export function fallbackBasemap(offered: readonly BasemapId[], refused: BasemapId): BasemapId | null {
    for (const id of offered) {
        if (id !== refused && id !== 'satellite') {
            return id;
        }
    }
    return null;
}

/** The remembered choice, or null when storage is unavailable or holds nothing readable. */
export function rememberedBasemap(storage: Pick<Storage, 'getItem'> | null): string | null {
    if (!storage) {
        return null;
    }
    try {
        return storage.getItem(BASEMAP_STORAGE_KEY);
    } catch (err) {
        return null;
    }
}

/** Keep the viewer's choice (the id only); a refusing storage is ignored. */
export function rememberBasemap(storage: Pick<Storage, 'setItem'> | null, id: BasemapId): void {
    if (!storage) {
        return;
    }
    try {
        storage.setItem(BASEMAP_STORAGE_KEY, id);
    } catch (err) {
        // A private window or blocked site data: the choice lasts for this page only.
    }
}

export interface BasemapSourceReplyBody {
    basemap: BasemapId;
    provider: string;
    source: RasterSource;
}

/** The body of a basemap.source.reply, or null when it is malformed. */
export function readBasemapSource(body: unknown): BasemapSourceReplyBody | null {
    if (!isRecord(body) || !isBasemapId(body.basemap) || !Array.isArray(body.tiles) || body.tiles.length === 0
        || !body.tiles.every((t) => typeof t === 'string' && t !== '')) {
        return null;
    }
    return {
        basemap: body.basemap,
        provider: typeof body.provider === 'string' ? body.provider : '',
        source: {
            tiles: body.tiles as string[],
            tileSize: typeof body.tileSize === 'number' && body.tileSize > 0 ? body.tileSize : 256,
            maxzoom: typeof body.maxzoom === 'number' && body.maxzoom >= 0 ? body.maxzoom : 22,
            attribution: typeof body.attribution === 'string' ? body.attribution : ''
        }
    };
}

/** The basemap.source message body for one basemap. */
export function basemapSourceBody(id: BasemapId): { basemap: BasemapId } {
    return { basemap: id };
}

/** The status when a basemap's source was refused: the Gateway's plain words after the basemap's name. */
export function refusedText(id: BasemapId, message: string): string {
    return BASEMAP_LABELS[id] + ' is unavailable: ' + message;
}

/** The status when a basemap's tiles do not load (blocked network, a site without internet). */
export function tilesFailedText(id: BasemapId): string {
    return BASEMAP_LABELS[id] + ' tiles are not loading; check the network.';
}
