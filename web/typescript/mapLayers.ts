/**
 * The map's drawing (epic 4 entry 1, the component split): the ids of every source and layer the map
 * holds, the served sprite and glyph URLs, the theme tokens the map paints with, the blank map and
 * marker colours read from the theme, and the functions that make the map on its blank style, add the
 * item, unsaved and text layers, put the basemap under them, paint them again after a theme change,
 * show or hide them for the legend's toggles and publish the labels drawn for the e2e suite.
 * DOM-bound (a MapLibre map in, the theme read from the component's root); MapStudio.tsx calls these
 * from componentDidMount, the map's load handler, applyTheme, applyBasemap, applyLayerToggles and the
 * idle handler. The layer order and every paint and layout value are the component's as built
 * through epic 3; nothing here reads the component's state or redraws on its own.
 */

import { Map as MapLibreMap } from 'maplibre-gl';
import type { ExpressionSpecification, MapOptions } from 'maplibre-gl';
import { BasemapId, RasterSource, rasterPaint } from './basemaps';
import { LegendToggle } from './legend';
import {
    AREA_DASH, AREA_FILL_OPACITY, AREA_LINE_OPACITY, AREA_LINE_WIDTH, ARROW_IMAGE, CHIP_IMAGE, CHIP_PADDING, CHIP_SIZE, DIMMED_OPACITY, DISC_CENTER,
    FONT_CHIP, FONT_NAME, HALO_WIDTH, KPI_SIZE, KPI_TOP_PX, LINE_CHIP_OFFSET_BADGE_EM, LINE_CHIP_OFFSET_EM, LINE_DASH, LINE_DOT,
    LINE_HALO_WIDTH, MARKER_COLLISION_PADDING, MARKER_IMAGE, MARKER_TOKENS, MarkerColors, NAME_SIZE, NAME_TOP_PX, TEXT_PADDING, ZOOM_DOT, ZOOM_KPI,
    ZOOM_NAME, lineHaloDash, textWidthPx
} from './markers';
import { itemsToGeoJson } from './save';
import { themeColor } from './theme';

/** The basemap's raster source and layer (epic 3 entry 6), drawn under the item layers. */
export const SOURCE_BASEMAP = 'mapstudio-basemap';
export const LAYER_BASEMAP = 'mapstudio-basemap';
/** The map store's items (map.load and this session's saves). */
export const SOURCE_ITEM_LINES = 'mapstudio-items-line';
export const SOURCE_ITEM_POINTS = 'mapstudio-items-point';
/** The areas (a line kind with `area: true`, epic 3 entry 1): a closed fill in the category tint and its outline, under the lines. */
export const SOURCE_ITEM_AREAS = 'mapstudio-items-area';
export const LAYER_AREA_FILL = 'mapstudio-items-area-fill';
export const LAYER_AREA_LINE = 'mapstudio-items-area-line';
export const LAYER_AREA_LINE_DASHED = 'mapstudio-items-area-line-dashed';
/** The `dotted` preset's lines (entry 1): round dots, a layer of their own since the dash pattern is not data-driven. */
export const LAYER_ITEM_LINES_DOTTED = 'mapstudio-items-line-dotted';
/** Each line's midpoint mark (its name chip and alarm badge) and the selected line's flow arrow (features.ts). */
export const SOURCE_LINE_MARKS = 'mapstudio-line-marks';
export const SOURCE_ARROW = 'mapstudio-arrow';
/** The selected line's floating ends (epic 4 entry 4): a small ring in the selection token at each end that snaps to nothing. */
export const SOURCE_LINE_ENDS = 'mapstudio-line-ends';
export const LAYER_LINE_ENDS = 'mapstudio-line-ends';
/** The floating end's mark: its radius and ring, in px. */
export const END_MARK_RADIUS = 4.5;
export const END_MARK_RING = 2;
/** The lines: the selection casing under them, dashed (comms lost, stale, no data) and solid, weight and hue per feature. */
export const LAYER_LINE_CASING = 'mapstudio-items-line-casing';
/** The halo under every line in the blank-map token (entry 12, markers.ts LINE_HALO_WIDTH), one layer per pattern. */
export const LAYER_LINE_HALO = 'mapstudio-items-line-halo';
export const LAYER_LINE_HALO_DASHED = 'mapstudio-items-line-halo-dashed';
export const LAYER_LINE_HALO_DOTTED = 'mapstudio-items-line-halo-dotted';
export const LAYER_ITEM_LINES_DASHED = 'mapstudio-items-line-dashed';
export const LAYER_ITEM_LINES = 'mapstudio-items-line';
/**
 * The point text, lowest first (epic 3 entry 7): the icon KPI, the state chip, the name; then the
 * line chips and badges; then the markers (icons placed first, so no text covers a disc); the arrow on top.
 */
export const LAYER_ITEM_KPI = 'mapstudio-items-kpi';
export const LAYER_ITEM_CHIPS = 'mapstudio-items-chip';
export const LAYER_ITEM_NAMES = 'mapstudio-items-name';
export const LAYER_LINE_CHIPS = 'mapstudio-line-chip';
export const LAYER_LINE_BADGES = 'mapstudio-line-badge';
export const LAYER_ITEM_MARKERS = 'mapstudio-items-marker';
export const LAYER_ARROW = 'mapstudio-arrow';
/** How far apart the flow arrows sit along the selected line (item 22), in px. */
const ARROW_SPACING_PX = 250;
/** The served sprite the marker images are drawn from (docs/icons.md). */
export const SPRITE_URL = '/res/mapstudio/icons/mapstudio-icons.svg';
/** The served glyphs the text layers are set in (web/scripts/glyphs.mjs, docs/icons.md). */
export const GLYPHS_URL = '/res/mapstudio/glyphs/{fontstack}/{range}.pbf';
/** The chip's text offset, quantised to steps of this many ems for the data-driven text-offset. */
const CHIP_OFFSET_STEP_EM = 0.25;
const CHIP_OFFSET_MAX_EM = 16;
/** The queued (unsaved) map items, drawn dashed (epic 2 story 8). */
export const SOURCE_UNSAVED_LINES = 'mapstudio-unsaved-line';
export const SOURCE_UNSAVED_POINTS = 'mapstudio-unsaved-point';
export const LAYER_UNSAVED_LINES = 'mapstudio-unsaved-line';
export const LAYER_UNSAVED_POINTS = 'mapstudio-unsaved-point';

/** The layers a pointer turns into a hand over: the markers and every line pattern. */
const POINTER_LAYERS = [LAYER_ITEM_MARKERS, LAYER_ITEM_LINES, LAYER_ITEM_LINES_DASHED, LAYER_ITEM_LINES_DOTTED];

/** The blank map's colours (DESIGN.md basemap-blank, `--neutral-20`): the background and the halos, and the unsaved layers' ink. */
export interface BlankColors {
    background: string;
    line: string;
    point: string;
    pointStroke: string;
}

/** The blank map and the halos are the blank-map token; the unsaved items draw in the label token. */
export function blankColors(root: HTMLElement | undefined): BlankColors {
    return {
        background: themeColor(root, '--neutral-20'),
        line: themeColor(root, '--neutral-70'),
        point: themeColor(root, '--label'),
        pointStroke: themeColor(root, '--neutral-20')
    };
}

/** The first token of each list that resolves on the root (theme.ts), for the marker images. */
export function markerColors(root: HTMLElement | undefined): MarkerColors {
    const first = (tokens: readonly string[]): string => {
        for (const token of tokens) {
            const value = themeColor(root, token);
            if (value !== 'transparent') {
                return value;
            }
        }
        return 'transparent';
    };
    let font = 'sans-serif';
    if (root && typeof getComputedStyle === 'function') {
        const family = getComputedStyle(root).fontFamily;
        if (family) {
            font = family;
        }
    }
    return {
        disc: first(MARKER_TOKENS.disc),
        glyph: first(MARKER_TOKENS.glyph),
        halo: first(MARKER_TOKENS.halo),
        textSecondary: first(MARKER_TOKENS.textSecondary),
        line: first(MARKER_TOKENS.line),
        chipEdge: first(MARKER_TOKENS.chipEdge),
        selection: first(MARKER_TOKENS.selection),
        commsLost: first(MARKER_TOKENS.commsLost),
        alarm: [first(MARKER_TOKENS.alarm1), first(MARKER_TOKENS.alarm2), first(MARKER_TOKENS.alarm3)],
        font,
        attention: first(MARKER_TOKENS.attention),
        warning: first(MARKER_TOKENS.warning),
        fault: first(MARKER_TOKENS.fault),
        tints: [first(MARKER_TOKENS.tint1), first(MARKER_TOKENS.tint2), first(MARKER_TOKENS.tint3), first(MARKER_TOKENS.tint4),
            first(MARKER_TOKENS.tint5), first(MARKER_TOKENS.tint6)]
    };
}

/** Every token the map draws with (item 29): the marker tokens and the blank map's, the theme watch's snapshot. */
export const THEME_TOKENS: readonly string[] = ['--neutral-20', '--neutral-70', '--label', '--containerRoot', '--container']
    .concat(...Object.values(MARKER_TOKENS).map((tokens) => tokens.slice()));

/** A style expression as the layer definitions take it (the spec's own type is too narrow for the ones built here). */
type Expression = ExpressionSpecification;

/**
 * The chip text's offset as a data-driven `text-offset`: MapLibre builds no array from a feature
 * value, so the per-feature `chipOffset` (ems) is stepped to literal pairs every CHIP_OFFSET_STEP_EM.
 */
export function chipOffsetExpression(): Expression {
    const y = NAME_TOP_PX / CHIP_SIZE;
    const expr: unknown[] = ['step', ['get', 'chipOffset'], ['literal', [0, y]]];
    for (let em = CHIP_OFFSET_STEP_EM; em <= CHIP_OFFSET_MAX_EM; em += CHIP_OFFSET_STEP_EM) {
        expr.push(em, ['literal', [em, y]]);
    }
    return expr as unknown as Expression;
}

/** One rendered label's box on the map, in container pixels, for the e2e overlap check (an estimate from the layout). */
export interface LabelBox {
    layer: string;
    id: string;
    text: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Where the map opens: the remembered place's camera, else the starting area (camera.ts startCamera). */
export type StartCamera = Pick<MapOptions, 'center' | 'zoom' | 'bounds' | 'fitBoundsOptions'>;

/**
 * The map on its blank style: the one background layer in the blank-map token, the bundled glyphs
 * served by the Gateway beside the bundle as the text layers' one font source, no sources yet (the
 * load handler adds them), and no attribution control of MapLibre's own (viewControls.ts adds it).
 */
export function createMap(container: HTMLDivElement, background: string, camera: StartCamera): MapLibreMap {
    return new MapLibreMap({
        container,
        style: {
            version: 8,
            // The bundled glyphs, served by the Gateway beside the bundle: the text layers' one font source.
            glyphs: GLYPHS_URL,
            sources: {},
            layers: [{
                id: 'background',
                type: 'background',
                paint: { 'background-color': background }
            }]
        },
        ...camera,
        attributionControl: false
    });
}

/**
 * The item sources, empty, and the area and line layers (the map's load handler, before the missing
 * image resolver is set and the unsaved and text layers are added).
 */
export function addItemLayers(map: MapLibreMap, mc: MarkerColors): void {
    const empty = itemsToGeoJson([]);
    map.addSource(SOURCE_ITEM_LINES, { type: 'geojson', data: empty.lines });
    map.addSource(SOURCE_ITEM_AREAS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource(SOURCE_ITEM_POINTS, { type: 'geojson', data: empty.points });
    map.addSource(SOURCE_LINE_MARKS, { type: 'geojson', data: empty.points });
    map.addSource(SOURCE_ARROW, { type: 'geojson', data: empty.points });
    map.addSource(SOURCE_LINE_ENDS, { type: 'geojson', data: empty.points });
    // The areas (entry 1, AD-11): a low-saturation fill in the category tint and a firmer
    // outline, under every line and point; a tint is never on a point or a line. An area with
    // no tint is its dashed outline alone in the lateral tone (DESIGN.md: the geofence outline;
    // entry 15), with no fill: a tint is the only wash an area takes.
    const tinted: Expression = ['!=', ['get', 'tint'], ''];
    map.addLayer({
        id: LAYER_AREA_FILL,
        type: 'fill',
        source: SOURCE_ITEM_AREAS,
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', tinted, AREA_FILL_OPACITY, 0] }
    });
    map.addLayer({
        id: LAYER_AREA_LINE,
        type: 'line',
        source: SOURCE_ITEM_AREAS,
        filter: tinted,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': AREA_LINE_WIDTH, 'line-opacity': AREA_LINE_OPACITY }
    });
    map.addLayer({
        id: LAYER_AREA_LINE_DASHED,
        type: 'line',
        source: SOURCE_ITEM_AREAS,
        filter: ['!', tinted],
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': AREA_LINE_WIDTH, 'line-dasharray': AREA_DASH }
    });
    // The halo under every line (entry 12): the blank-map token, one pixel each side, as the
    // markers' halo, so a line's hue or dash keeps 3:1 on a raster tile in either theme
    // (docs/review-er27.md); invisible on the blank map, and under the selection casing, which
    // covers it on the selected line. One layer per pattern, the dash of a dashed or dotted halo
    // scaled per weight to sit under the line's (markers.ts lineHaloDash).
    const dimmed: Expression = ['case', ['==', ['get', 'dimmed'], true], DIMMED_OPACITY, 1];
    const dashedFilter: Expression = ['==', ['get', 'dashed'], true];
    const dottedFilter: Expression = ['==', ['get', 'dotted'], true];
    const solidFilter: Expression = ['all', ['!=', ['get', 'dashed'], true], ['!=', ['get', 'dotted'], true]];
    map.addLayer({
        id: LAYER_LINE_HALO_DASHED,
        type: 'line',
        source: SOURCE_ITEM_LINES,
        filter: dashedFilter,
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: { 'line-color': mc.halo, 'line-width': LINE_HALO_WIDTH as Expression,
            'line-dasharray': lineHaloDash(LINE_DASH) as Expression, 'line-opacity': dimmed }
    });
    map.addLayer({
        id: LAYER_LINE_HALO_DOTTED,
        type: 'line',
        source: SOURCE_ITEM_LINES,
        filter: dottedFilter,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': mc.halo, 'line-width': LINE_HALO_WIDTH as Expression,
            'line-dasharray': lineHaloDash(LINE_DOT) as Expression, 'line-opacity': dimmed }
    });
    map.addLayer({
        id: LAYER_LINE_HALO,
        type: 'line',
        source: SOURCE_ITEM_LINES,
        filter: solidFilter,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': mc.halo, 'line-width': LINE_HALO_WIDTH as Expression, 'line-opacity': dimmed }
    });
    // The lines (DESIGN.md map-line): the selection casing over the halo under the selected one, then dashed,
    // dotted and solid lines with their weight and hue per feature (features.ts, markers.ts
    // lineLook); the dimmed preset fades the line.
    map.addLayer({
        id: LAYER_LINE_CASING,
        type: 'line',
        source: SOURCE_ITEM_LINES,
        filter: ['==', ['get', 'selected'], true],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
            'line-color': mc.selection, 'line-width': ['+', ['get', 'weight'], 4],
            // The open segment of a line (its popup, entry 2) firmer than the rest of the selected line.
            'line-opacity': ['case', ['==', ['get', 'segmentSelected'], true], 0.85, 0.5]
        }
    });
    map.addLayer({
        id: LAYER_ITEM_LINES_DASHED,
        type: 'line',
        source: SOURCE_ITEM_LINES,
        filter: dashedFilter,
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'weight'], 'line-dasharray': LINE_DASH, 'line-opacity': dimmed }
    });
    map.addLayer({
        id: LAYER_ITEM_LINES_DOTTED,
        type: 'line',
        source: SOURCE_ITEM_LINES,
        filter: dottedFilter,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'weight'], 'line-dasharray': LINE_DOT, 'line-opacity': dimmed }
    });
    map.addLayer({
        id: LAYER_ITEM_LINES,
        type: 'line',
        source: SOURCE_ITEM_LINES,
        filter: solidFilter,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'weight'], 'line-opacity': dimmed }
    });
    // The selected line's floating ends (entry 4; DESIGN.md Map line, EXPERIENCE.md Snap): a small ring in
    // the selection token on the halo fill, over the line; a snapped end has its item's marker instead.
    map.addLayer({
        id: LAYER_LINE_ENDS,
        type: 'circle',
        source: SOURCE_LINE_ENDS,
        paint: {
            'circle-radius': END_MARK_RADIUS,
            'circle-color': mc.halo,
            'circle-stroke-color': mc.selection,
            'circle-stroke-width': END_MARK_RING
        }
    });
}

/** The unsaved sources, empty, and their dashed line and ringed point layers (epic 2 story 8), over the lines. */
export function addUnsavedLayers(map: MapLibreMap, colors: BlankColors): void {
    const empty = itemsToGeoJson([]);
    map.addSource(SOURCE_UNSAVED_LINES, { type: 'geojson', data: empty.lines });
    map.addSource(SOURCE_UNSAVED_POINTS, { type: 'geojson', data: empty.points });
    map.addLayer({
        id: LAYER_UNSAVED_LINES,
        type: 'line',
        source: SOURCE_UNSAVED_LINES,
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: { 'line-color': colors.point, 'line-width': 3, 'line-dasharray': [2, 1.5] }
    });
    map.addLayer({
        id: LAYER_UNSAVED_POINTS,
        type: 'circle',
        source: SOURCE_UNSAVED_POINTS,
        paint: {
            'circle-radius': 7,
            'circle-color': colors.pointStroke,
            'circle-stroke-color': colors.point,
            'circle-stroke-width': 2
        }
    });
}

/**
 * The symbol layers (epic 3 entry 7, DESIGN.md map marker, state word chip, map line), lowest first:
 * the icon KPI (from zoom 15, decision D4), the state chip beside the name and the name (from zoom
 * 14), each set in the bundled glyphs with a halo, colliding and giving way by `rank`
 * (symbol-sort-key: alarm, comms lost, stale, then the kind list's label rank); the line name chips
 * and alarm badges at each line's midpoint; the markers, which never drop (a normal item is a dot
 * below zoom 14, a 7 px one below 12, an abnormal item keeps its full marker at every zoom); and
 * the flow arrow of the selected line. Icons are placed before the text of the layers under them,
 * so no label covers a disc.
 */
export function addTextLayers(map: MapLibreMap, mc: MarkerColors): void {
    const normal: Expression = ['==', ['get', 'state'], 'normal'];
    const halo = { 'text-halo-color': mc.halo, 'text-halo-width': HALO_WIDTH, 'text-halo-blur': 0.5 };
    map.addLayer({
        id: LAYER_ITEM_KPI,
        type: 'symbol',
        source: SOURCE_ITEM_POINTS,
        minzoom: ZOOM_KPI,
        filter: ['!=', ['get', 'kpi'], ''],
        layout: {
            'text-field': ['get', 'kpi'],
            'text-font': [FONT_NAME],
            'text-size': KPI_SIZE,
            'text-anchor': 'top',
            'text-offset': [0, KPI_TOP_PX / KPI_SIZE],
            'text-max-width': 14,
            'text-padding': TEXT_PADDING,
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'symbol-sort-key': ['get', 'rank']
        },
        paint: { 'text-color': ['case', ['==', ['get', 'kpiStale'], true], mc.textSecondary, mc.glyph], ...halo }
    });
    map.addLayer({
        id: LAYER_ITEM_CHIPS,
        type: 'symbol',
        source: SOURCE_ITEM_POINTS,
        minzoom: ZOOM_NAME,
        filter: ['!=', ['get', 'word'], ''],
        layout: {
            'text-field': ['get', 'word'],
            'text-font': [FONT_CHIP],
            'text-size': CHIP_SIZE,
            'text-anchor': 'top-left',
            'text-offset': chipOffsetExpression(),
            'icon-image': CHIP_IMAGE,
            'icon-text-fit': 'both',
            'icon-text-fit-padding': CHIP_PADDING,
            'text-padding': TEXT_PADDING,
            // The chip's box is the stretched image (the text plus CHIP_PADDING); no more padding round it.
            'icon-padding': 0,
            'text-allow-overlap': false,
            'icon-allow-overlap': false,
            'text-optional': false,
            'icon-optional': false,
            'symbol-sort-key': ['get', 'rank']
        },
        paint: { 'text-color': mc.glyph }
    });
    map.addLayer({
        id: LAYER_ITEM_NAMES,
        type: 'symbol',
        source: SOURCE_ITEM_POINTS,
        minzoom: ZOOM_NAME,
        layout: {
            'text-field': ['get', 'name'],
            'text-font': [FONT_NAME],
            'text-size': NAME_SIZE,
            'text-anchor': 'top',
            'text-offset': [0, NAME_TOP_PX / NAME_SIZE],
            'text-max-width': 14,
            'text-padding': TEXT_PADDING,
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'symbol-sort-key': ['get', 'rank']
        },
        paint: { 'text-color': mc.glyph, ...halo }
    });
    map.addLayer({
        id: LAYER_LINE_CHIPS,
        type: 'symbol',
        source: SOURCE_LINE_MARKS,
        minzoom: ZOOM_NAME,
        layout: {
            'text-field': ['get', 'label'],
            'text-font': [FONT_CHIP],
            'text-size': CHIP_SIZE,
            'text-anchor': 'center',
            // Under the line, and under the badge when the line has one (the arrow sits at the midpoint).
            'text-offset': ['case', ['!=', ['get', 'badge'], ''], ['literal', [0, LINE_CHIP_OFFSET_BADGE_EM]],
                ['literal', [0, LINE_CHIP_OFFSET_EM]]],
            'icon-image': CHIP_IMAGE,
            'icon-text-fit': 'both',
            'icon-text-fit-padding': CHIP_PADDING,
            'text-padding': TEXT_PADDING,
            'icon-padding': 0,
            'text-allow-overlap': false,
            'icon-allow-overlap': false,
            'text-optional': false,
            'icon-optional': false,
            'symbol-sort-key': ['get', 'rank']
        },
        paint: { 'text-color': mc.glyph }
    });
    map.addLayer({
        id: LAYER_LINE_BADGES,
        type: 'symbol',
        source: SOURCE_LINE_MARKS,
        filter: ['!=', ['get', 'badge'], ''],
        layout: {
            'icon-image': ['get', 'badge'],
            'icon-anchor': 'center',
            // The badge's centre sits 8 px left of the image's centre (markers.ts badgeSvg).
            'icon-offset': [8, 0],
            'icon-allow-overlap': true,
            'icon-ignore-placement': false
        }
    });
    const markerOffset: Expression = ['literal', [MARKER_IMAGE.width / 2 - DISC_CENTER[0], MARKER_IMAGE.height / 2 - DISC_CENTER[1]]];
    const dotOffset: Expression = ['literal', [0, 0]];
    const markerPadding: Expression = ['literal', MARKER_COLLISION_PADDING];
    const iconOffset = ['step', ['zoom'], ['case', normal, dotOffset, markerOffset], ZOOM_NAME, markerOffset] as unknown as Expression;
    map.addLayer({
        id: LAYER_ITEM_MARKERS,
        type: 'symbol',
        source: SOURCE_ITEM_POINTS,
        layout: {
            // The zoom bands: the 7 px dot below 12, the 11 px dot to 14, the marker from 14; an abnormal
            // item's dotSmall and dotMid are its marker, so it keeps its size and hit area.
            'icon-image': ['step', ['zoom'], ['get', 'dotSmall'], ZOOM_DOT, ['get', 'dotMid'], ZOOM_NAME, ['get', 'marker']],
            'icon-anchor': 'center',
            'icon-offset': iconOffset,
            'icon-allow-overlap': true,
            'icon-ignore-placement': false,
            // The text keeps clear of the marker's footprint (MARKER_COLLISION_PADDING shrinks the image's
            // box to it, item 16); a dot's own box, no padding.
            'icon-padding': ['step', ['zoom'], ['case', normal, ['literal', [0]], markerPadding], ZOOM_NAME, markerPadding] as unknown as Expression,
            // Drawn in rank order with the abnormal ones on top (lower keys draw first).
            'symbol-sort-key': ['-', 1000, ['get', 'rank']]
        }
    });
    // The flow arrow repeated along the selected line (item 22): MapLibre lays the arrow image's x axis
    // along the line every ARROW_SPACING_PX (one at the centre when the line is shorter), in the line's
    // drawn direction, under the line's chip and badge so the midpoint mark stays on top.
    map.addLayer({
        id: LAYER_ARROW,
        type: 'symbol',
        source: SOURCE_ARROW,
        layout: {
            'symbol-placement': 'line',
            'symbol-spacing': ARROW_SPACING_PX,
            'icon-image': ARROW_IMAGE,
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
        }
    }, LAYER_LINE_CHIPS);
}

/** A pointer over a marker or a line is a hand. */
export function addPointerCursor(map: MapLibreMap): void {
    for (const layer of POINTER_LAYERS) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    }
}

/**
 * The basemap's raster source and layer under the items (epic 3 entry 6): the current ones removed,
 * then the chosen source added with its layer under the first item layer, or nothing for None.
 */
export function setBasemapLayer(map: MapLibreMap, source: RasterSource | null, selected: BasemapId | null): void {
    if (map.getLayer(LAYER_BASEMAP)) {
        map.removeLayer(LAYER_BASEMAP);
    }
    if (map.getSource(SOURCE_BASEMAP)) {
        map.removeSource(SOURCE_BASEMAP);
    }
    if (source) {
        map.addSource(SOURCE_BASEMAP, {
            type: 'raster',
            tiles: source.tiles,
            tileSize: source.tileSize,
            maxzoom: source.maxzoom,
            attribution: source.attribution
        });
        // OpenStreetMap drawn quiet (item 25, basemaps.ts rasterPaint); Satellite as it comes.
        map.addLayer({ id: LAYER_BASEMAP, type: 'raster', source: SOURCE_BASEMAP, paint: rasterPaint(selected) },
            map.getLayer(LAYER_AREA_FILL) ? LAYER_AREA_FILL : undefined);
    }
}

/**
 * The theme changed after the map mounted (item 29; the paint part of the component's applyTheme):
 * every paint colour the layers took at mount is set again from the tokens read now. Returns the
 * blank-map colour, which the component publishes as `data-blank`.
 */
export function applyThemePaint(map: MapLibreMap, root: HTMLElement | undefined, mc: MarkerColors): string {
    const blank = themeColor(root, '--neutral-20');
    const setPaint = (layer: string, name: string, value: unknown): void => {
        if (map.getLayer(layer)) {
            // The paint property names are the style spec's; the typed overload is too narrow for a name in a variable.
            (map.setPaintProperty as unknown as (l: string, n: string, v: unknown) => void)(layer, name, value);
        }
    };
    setPaint('background', 'background-color', blank);
    for (const layer of [LAYER_LINE_HALO, LAYER_LINE_HALO_DASHED, LAYER_LINE_HALO_DOTTED]) {
        setPaint(layer, 'line-color', mc.halo);
    }
    setPaint(LAYER_LINE_CASING, 'line-color', mc.selection);
    setPaint(LAYER_LINE_ENDS, 'circle-color', mc.halo);
    setPaint(LAYER_LINE_ENDS, 'circle-stroke-color', mc.selection);
    setPaint(LAYER_UNSAVED_LINES, 'line-color', themeColor(root, '--label'));
    setPaint(LAYER_UNSAVED_POINTS, 'circle-color', blank);
    setPaint(LAYER_UNSAVED_POINTS, 'circle-stroke-color', themeColor(root, '--label'));
    setPaint(LAYER_ITEM_KPI, 'text-color', ['case', ['==', ['get', 'kpiStale'], true], mc.textSecondary, mc.glyph]);
    for (const layer of [LAYER_ITEM_CHIPS, LAYER_ITEM_NAMES, LAYER_LINE_CHIPS]) {
        setPaint(layer, 'text-color', mc.glyph);
    }
    for (const layer of [LAYER_ITEM_KPI, LAYER_ITEM_NAMES]) {
        setPaint(layer, 'text-halo-color', mc.halo);
    }
    return blank;
}

/**
 * The legend's Lines and Names toggles (entry 3, R14): Lines off hides every line layer and the
 * flow arrow (areas stay); Names off hides the item names, the state chips, the icon KPI text and
 * the line name chips, and keeps the markers (an abnormal item's badge and digit stay) and the
 * line badges. The component remembers the toggles per browser session and publishes them.
 */
export function applyLayerToggles(map: MapLibreMap, toggles: Record<LegendToggle, boolean>): void {
    const lineLayers = [LAYER_LINE_CASING, LAYER_LINE_HALO_DASHED, LAYER_LINE_HALO_DOTTED, LAYER_LINE_HALO, LAYER_ITEM_LINES_DASHED,
        LAYER_ITEM_LINES_DOTTED, LAYER_ITEM_LINES, LAYER_LINE_ENDS, LAYER_LINE_BADGES, LAYER_ARROW];
    const nameLayers = [LAYER_ITEM_NAMES, LAYER_ITEM_CHIPS, LAYER_ITEM_KPI];
    const set = (layer: string, visible: boolean): void => {
        if (map.getLayer(layer)) {
            map.setLayoutProperty(layer, 'visibility', visible ? 'visible' : 'none');
        }
    };
    for (const layer of lineLayers) {
        set(layer, toggles.lines);
    }
    for (const layer of nameLayers) {
        set(layer, toggles.names);
    }
    set(LAYER_LINE_CHIPS, toggles.lines && toggles.names);
}

/**
 * For the e2e suite: the labels MapLibre drew (queryRenderedFeatures leaves out the ones hidden by a
 * collision), each with its box in container pixels estimated from the layer's layout and the text
 * width estimate the chip placement uses (textWidthPx); MapLibre's own placement is what keeps the
 * real boxes apart. Written on `el` (the map's element) with the line, arrow and name counts.
 */
export function publishLabels(map: MapLibreMap, el: HTMLElement): void {
    const boxes: LabelBox[] = [];
    const seen = new Set<string>();
    const add = (layer: string, textOf: (p: Record<string, unknown>) => string,
                 boxOf: (p: Record<string, unknown>, x: number, y: number, w: number) => [number, number]): void => {
        if (!map.getLayer(layer)) {
            return;
        }
        for (const f of map.queryRenderedFeatures({ layers: [layer] })) {
            const p = (f.properties || {}) as Record<string, unknown>;
            const id = typeof p.id === 'string' ? p.id : '';
            const key = layer + '|' + id;
            if (seen.has(key) || !f.geometry || f.geometry.type !== 'Point') {
                continue;
            }
            seen.add(key);
            const text = textOf(p);
            const at = map.project([f.geometry.coordinates[0], f.geometry.coordinates[1]]);
            const size = layer === LAYER_ITEM_NAMES ? NAME_SIZE : CHIP_SIZE;
            const w = textWidthPx(text, size);
            const [x, y] = boxOf(p, at.x, at.y, w);
            boxes.push({ layer, id, text, x, y, w, h: Math.round(size * 1.25) });
        }
    };
    const str = (v: unknown): string => (typeof v === 'string' ? v : '');
    add(LAYER_ITEM_NAMES, (p) => str(p.name), (_p, x, y, w) => [x - w / 2, y + NAME_TOP_PX]);
    add(LAYER_ITEM_CHIPS, (p) => str(p.word), (p, x, y) => [x + Number(p.chipOffset) * CHIP_SIZE - CHIP_PADDING[3], y + NAME_TOP_PX]);
    add(LAYER_ITEM_KPI, (p) => str(p.kpi), (_p, x, y, w) => [x - w / 2, y + KPI_TOP_PX]);
    add(LAYER_LINE_CHIPS, (p) => str(p.label), (p, x, y, w) => [x - w / 2 - CHIP_PADDING[3],
        y - 8 + (str(p.badge) ? LINE_CHIP_OFFSET_BADGE_EM : LINE_CHIP_OFFSET_EM) * CHIP_SIZE]);
    // The chip's box takes its padding.
    for (const b of boxes) {
        if (b.layer === LAYER_ITEM_CHIPS || b.layer === LAYER_LINE_CHIPS) {
            b.w += CHIP_PADDING[1] + CHIP_PADDING[3];
            b.h += CHIP_PADDING[0] + CHIP_PADDING[2];
        }
    }
    el.setAttribute('data-labels', JSON.stringify(boxes));
    // The line features and the arrow MapLibre drew (none while the legend's Lines toggle is off, entry 3).
    const drawn = (layers: string[]): number => layers.filter((l) => map.getLayer(l))
        .reduce((n, l) => n + map.queryRenderedFeatures({ layers: [l] }).length, 0);
    el.setAttribute('data-lines-drawn', String(drawn([LAYER_ITEM_LINES, LAYER_ITEM_LINES_DASHED, LAYER_ITEM_LINES_DOTTED])));
    el.setAttribute('data-arrow-drawn', String(drawn([LAYER_ARROW])));
    el.setAttribute('data-names-shown', String(boxes.filter((b) => b.layer === LAYER_ITEM_NAMES).length));
    el.setAttribute('data-labels-zoom', map.getZoom().toFixed(2));
}
