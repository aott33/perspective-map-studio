import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {
    AbstractUIElementStore,
    Component,
    ComponentMeta,
    ComponentProps,
    ComponentStoreDelegate,
    JsObject,
    PageStore,
    PComponent,
    PropertyTree,
    Size2d
} from '@inductiveautomation/perspective-client';
import { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, MapMouseEvent, NavigationControl, Popup, setWorkerUrl } from 'maplibre-gl';
import { TerraDraw, TerraDrawLineStringMode } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import { DrawControl } from './DrawControl';
import {
    DRAW_IDLE,
    DRAW_MODE_LINE,
    DRAW_MODE_OFF,
    DrawState,
    cancelDrawing,
    drawStatusText,
    finishLine,
    startDrawing
} from './draw';
import { EditLevel, MapItemRecord } from './contract';
import { AdapterStatus, HostLists, NO_HOST_LISTS } from './adapters';
import { MESSAGE_EVENT, Reply, editsApply, mapLoad, pointClick, readReply, replyText } from './messages';
import { PointPopup } from './PointPopup';
import { SAVE_IDLE, SaveState, itemsToGeoJson, lineCreateBatch, newId, refusedSave, saveStatusText, withItem } from './save';
import { AuthorParams, PopupPoint, popupMountPath } from './popupParams';
import { TestData, selectTestData } from './testSet';
import { drawColor, themeColor } from './theme';

/** Must match MapStudioComponent.COMPONENT_ID on the Java side. */
export const COMPONENT_TYPE = 'ao.mapstudio';

/**
 * MapLibre's worker, served by the gateway hook beside the bundle under the
 * module's mount alias (MapStudioModule.URL_ALIAS); copied there by webpack
 * with a .js name so the gateway serves it with a JavaScript content type.
 */
export const WORKER_URL = '/res/mapstudio/maplibre-gl-worker.js';
setWorkerUrl(WORKER_URL);

/** Component props read from the property tree (mapstudio.props.json). */
export interface MapStudioProps {
    /**
     * Spike-only (story 4): the project view opened as a popup on a point
     * click, with the author's params. A later version names it in the kind
     * setup (AD-7).
     */
    popupView: {
        path: string;
        params: AuthorParams;
    };
    /**
     * Spike-only (story 7): which fixed test data the map draws, 'tracer' (three
     * points and a line) or 'scale30' (a seeded 30-pad stand-in for the
     * template's scale set). Removed when the map store supplies the data
     * (epic-map-store-and-data).
     */
    testSet: string;
}

/** The popup that is open: the clicked point with its map coordinates. */
interface OpenPopup {
    point: PopupPoint;
    lngLat: [number, number];
}

interface MapStudioState extends DrawState {
    popup: OpenPopup | null;
}

/** The delegate state the component renders. */
export interface MapStudioDelegateState {
    /** The last point-click reply from the Gateway as one line of text, or '' before the first. */
    lastReply: string;
    /** Id of the point.click message whose reply is awaited, or null. */
    pendingId: string | null;
    /** The map store's items, as map.load sent them plus this session's saves. */
    items: MapItemRecord[];
    /** Bumped whenever items change, so the component knows to redraw them. */
    itemsRevision: number;
    /** The level map.load reported, or null before it answered. */
    level: EditLevel | null;
    /** 'loading', 'loaded', or the store-unreachable (or other) reason map.load answered. */
    load: { state: 'loading' | 'loaded' | 'failed'; message: string };
    /** The last save of a drawn line. */
    save: SaveState;
    /** The project's kind list, asset list (editors only) and their statuses, from map.load. */
    lists: HostLists;
}

/**
 * Browser side of the component delegate: sends envelopes to the Gateway
 * delegate and keeps what the replies say. Point-click replies set the reply
 * line; map.load and edits.apply replies are routed by message id and never
 * change it, and they log to the console at info only.
 */
export class MapStudioStoreDelegate extends ComponentStoreDelegate {
    private lastReply = '';
    private pendingId: string | null = null;
    private items: MapItemRecord[] = [];
    private itemsRevision = 0;
    private level: EditLevel | null = null;
    private load: MapStudioDelegateState['load'] = { state: 'loading', message: '' };
    private save: SaveState = SAVE_IDLE;
    private lists: HostLists = NO_HOST_LISTS;
    private mapLoadId: string | null = null;
    /** edits.apply message id -> the map item it creates and the record it would store. */
    private pendingSaves = new Map<string, MapItemRecord>();

    constructor(componentStore: AbstractUIElementStore) {
        super(componentStore);
    }

    mapStateToProps(): MapStudioDelegateState {
        return {
            lastReply: this.lastReply,
            pendingId: this.pendingId,
            items: this.items,
            itemsRevision: this.itemsRevision,
            level: this.level,
            load: this.load,
            save: this.save,
            lists: this.lists
        };
    }

    /** Send `point.click` for one point; the reply arrives in handleEvent. */
    sendPointClick(pointId: string): void {
        const message = pointClick(pointId);
        this.pendingId = message.id;
        this.notify();
        this.fireEvent(MESSAGE_EVENT, message as unknown as JsObject);
    }

    /** Ask the Gateway for the map (map.load); the items and the level arrive in handleEvent. */
    sendMapLoad(): void {
        const message = mapLoad();
        this.mapLoadId = message.id;
        this.load = { state: 'loading', message: '' };
        this.notify();
        this.fireEvent(MESSAGE_EVENT, message as unknown as JsObject);
    }

    /** Save a finished line as one new map item (edits.apply with one create op). */
    sendLineCreate(coordinates: Array<[number, number]>): string {
        const itemId = newId();
        const batch = lineCreateBatch(itemId, newId(), coordinates, new Date());
        const message = editsApply(batch);
        const data = batch.ops[0].data;
        this.pendingSaves.set(message.id, {
            id: itemId,
            kind: data.kind as string,
            name: data.name as string,
            geometry: data.geometry as MapItemRecord['geometry'],
            properties: {},
            assetId: null,
            overrides: {},
            ends: null,
            version: 0,
            deleted: false
        });
        this.save = { state: 'saving', itemId };
        this.notify();
        this.fireEvent(MESSAGE_EVENT, message as unknown as JsObject);
        return itemId;
    }

    handleEvent(eventName: string, eventObject: JsObject): void {
        if (eventName !== MESSAGE_EVENT) {
            console.warn('[MapStudio] Ignoring unknown model event ' + eventName);
            return;
        }
        const reply = readReply(eventObject);
        if (reply.kind === 'map.load.reply' || (reply.kind === 'error' && reply.id === this.mapLoadId)) {
            this.onMapLoad(reply);
            return;
        }
        if (reply.kind === 'edits.apply.reply' || (reply.kind === 'error' && this.pendingSaves.has(reply.id))) {
            this.onSave(reply);
            return;
        }
        if (reply.kind !== 'invalid' && this.pendingId !== null && reply.id !== this.pendingId) {
            console.warn('[MapStudio] Reply ' + reply.id + ' does not match the pending message ' + this.pendingId);
        }
        this.lastReply = replyText(reply);
        this.pendingId = null;
        console.info('[MapStudio] ' + this.lastReply);
        this.notify();
    }

    private onMapLoad(reply: Reply): void {
        if (reply.kind === 'map.load.reply') {
            this.items = reply.body.items;
            this.itemsRevision++;
            this.level = reply.body.level;
            this.lists = reply.body.lists;
            this.load = { state: 'loaded', message: '' };
        } else if (reply.kind === 'error') {
            this.level = null;
            this.load = { state: 'failed', message: reply.body.code + ': ' + reply.body.message };
        }
        this.mapLoadId = null;
        console.info('[MapStudio] ' + replyText(reply));
        this.notify();
    }

    private onSave(reply: Reply): void {
        if (reply.kind !== 'edits.apply.reply' && reply.kind !== 'error') {
            return;
        }
        const pending = this.pendingSaves.get(reply.id);
        this.pendingSaves.delete(reply.id);
        if (!pending) {
            console.info('[MapStudio] A save reply ' + reply.id + ' matches no pending save.');
            return;
        }
        if (reply.kind === 'edits.apply.reply') {
            const result = reply.body.results.find((r) => r.id === pending.id);
            const version = result ? result.version : 1;
            this.items = withItem(this.items, { ...pending, version });
            this.itemsRevision++;
            this.save = { state: 'saved', itemId: pending.id, version };
        } else {
            this.save = refusedSave(pending.id, reply.body);
        }
        console.info('[MapStudio] ' + replyText(reply));
        this.notify();
    }
}

type Props = ComponentProps<MapStudioProps, MapStudioDelegateState>;

const SOURCE_POINTS = 'mapstudio-points';
const SOURCE_LINE = 'mapstudio-line';
const LAYER_LINE = 'mapstudio-line';
const LAYER_POINTS = 'mapstudio-points';
/** The map store's items (map.load and this session's saves); separate from the test data's sources. */
const SOURCE_ITEM_LINES = 'mapstudio-items-line';
const SOURCE_ITEM_POINTS = 'mapstudio-items-point';
const LAYER_ITEM_LINES = 'mapstudio-items-line';
const LAYER_ITEM_POINTS = 'mapstudio-items-point';

/**
 * The Map Studio component: a MapLibre map on a blank style with fixed test
 * data (three points and one line). Clicking a point sends `point.click`
 * through the delegate; the reply is shown as text over the map.
 */
export class MapStudio extends Component<Props, MapStudioState> {
    state: MapStudioState = { ...DRAW_IDLE, popup: null };

    /** Chosen once from the testSet prop; the map is built from it at mount. */
    private testData: TestData = selectTestData(this.props.props.testSet);
    private mapContainer: HTMLDivElement | null = null;
    private map: MapLibreMap | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private draw: TerraDraw | null = null;
    private drawControl: DrawControl | null = null;
    /** The MapLibre popup, created once and moved between points; its content is a React portal. */
    private popup: Popup | null = null;
    /** The DOM node the popup shows; React renders PointPopup into it through a portal. */
    private popupContent: HTMLDivElement | null = null;
    /** Whether the items sources exist (after the map's load). */
    private itemsReady = false;
    /** The items revision last drawn. */
    private drawnRevision = -1;
    /** Map item id of a line being saved -> its Terra Draw feature id, removed once the store has it. */
    private savingFeatures = new Map<string, string | number>();

    componentDidMount(): void {
        if (!this.mapContainer) {
            return;
        }
        const root = this.props.store.element as HTMLElement | undefined;
        const colors = {
            background: themeColor(root, '--containerRoot'),
            line: themeColor(root, '--neutral-70'),
            point: themeColor(root, '--label'),
            pointStroke: themeColor(root, '--containerRoot')
        };
        const data = this.testData;
        const map = new MapLibreMap({
            container: this.mapContainer,
            style: {
                version: 8,
                sources: {},
                layers: [{
                    id: 'background',
                    type: 'background',
                    paint: { 'background-color': colors.background }
                }]
            },
            center: data.center,
            zoom: data.zoom,
            attributionControl: false
        });
        map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
        map.on('load', () => {
            map.addSource(SOURCE_LINE, { type: 'geojson', data: data.lines });
            map.addSource(SOURCE_POINTS, { type: 'geojson', data: data.points });
            map.addLayer({
                id: LAYER_LINE,
                type: 'line',
                source: SOURCE_LINE,
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: { 'line-color': colors.line, 'line-width': 3 }
            });
            map.addLayer({
                id: LAYER_POINTS,
                type: 'circle',
                source: SOURCE_POINTS,
                paint: {
                    'circle-radius': 9,
                    'circle-color': colors.point,
                    'circle-stroke-color': colors.pointStroke,
                    'circle-stroke-width': 2
                }
            });
            const empty = itemsToGeoJson([]);
            map.addSource(SOURCE_ITEM_LINES, { type: 'geojson', data: empty.lines });
            map.addSource(SOURCE_ITEM_POINTS, { type: 'geojson', data: empty.points });
            map.addLayer({
                id: LAYER_ITEM_LINES,
                type: 'line',
                source: SOURCE_ITEM_LINES,
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: { 'line-color': colors.point, 'line-width': 3 }
            });
            map.addLayer({
                id: LAYER_ITEM_POINTS,
                type: 'circle',
                source: SOURCE_ITEM_POINTS,
                paint: {
                    'circle-radius': 7,
                    'circle-color': colors.line,
                    'circle-stroke-color': colors.pointStroke,
                    'circle-stroke-width': 2
                }
            });
            this.itemsReady = true;
            this.drawItems();
            const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
            if (delegate) {
                delegate.sendMapLoad();
            }
            map.on('click', LAYER_POINTS, this.onPointClick);
            map.on('click', this.onMapClick);
            map.on('mouseenter', LAYER_POINTS, () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', LAYER_POINTS, () => { map.getCanvas().style.cursor = ''; });
            this.startTerraDraw(map, root);
            // Readiness for the e2e suite: set once the map has gone idle with
            // both sources and layers added, counted from MapLibre itself.
            map.once('idle', () => this.publishReadiness(map));
        });
        this.drawControl = new DrawControl(this.toggleDrawing);
        map.addControl(this.drawControl, 'top-right');
        this.map = map;

        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => { map.resize(); });
            this.resizeObserver.observe(this.mapContainer);
        }
    }

    componentDidUpdate(): void {
        this.drawItems();
        this.dropSavedFeature();
    }

    /** Put the delegate's items into the items sources when they changed. */
    private drawItems(): void {
        const delegate = this.props.delegate;
        if (!this.map || !this.itemsReady || !delegate || delegate.itemsRevision === this.drawnRevision) {
            return;
        }
        const data = itemsToGeoJson(delegate.items);
        const lines = this.map.getSource(SOURCE_ITEM_LINES) as GeoJSONSource | undefined;
        const points = this.map.getSource(SOURCE_ITEM_POINTS) as GeoJSONSource | undefined;
        if (lines && points) {
            lines.setData(data.lines);
            points.setData(data.points);
            this.drawnRevision = delegate.itemsRevision;
            if (this.mapContainer) {
                this.mapContainer.setAttribute('data-items-loaded',
                    String(data.lines.features.length + data.points.features.length));
            }
        }
    }

    /** A saved line is drawn from the items source: remove Terra Draw's copy of it. */
    private dropSavedFeature(): void {
        const delegate = this.props.delegate;
        if (!delegate || delegate.save.state !== 'saved' || !this.draw) {
            return;
        }
        const featureId = this.savingFeatures.get(delegate.save.itemId);
        if (featureId !== undefined) {
            this.savingFeatures.delete(delegate.save.itemId);
            try {
                this.draw.removeFeatures([featureId]);
            } catch (err) {
                console.info('[MapStudio] The drawn copy of a saved line was already gone.');
            }
        }
    }

    componentWillUnmount(): void {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.mapContainer) {
            this.mapContainer.removeEventListener('keydown', this.onKeyDown, true);
        }
        if (this.draw) {
            this.draw.stop();
            this.draw = null;
        }
        if (this.popup) {
            this.popup.off('close', this.onPopupClosed);
            this.popup.remove();
            this.popup = null;
        }
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        this.drawControl = null;
    }

    /**
     * Terra Draw on the MapLibre adapter, started after the map's own layers so
     * its `td-*` layers draw above them. It idles in the `static` mode and only
     * the toggle enters `linestring`, so the point click round trip keeps the
     * map's clicks while the tool is off. Styles come from theme tokens
     * converted to hex (AD-11); a token that does not resolve leaves that key
     * to the library default, with one warning from drawColor.
     */
    private startTerraDraw(map: MapLibreMap, root: HTMLElement | undefined): void {
        const line = drawColor(root, ['--label', '--neutral-70']);
        const outline = drawColor(root, ['--containerRoot', '--container']);
        const styles: { [key: string]: string | number } = {
            lineStringWidth: 4,
            closingPointWidth: 6,
            closingPointOutlineWidth: 2
        };
        if (line) {
            styles.lineStringColor = line;
            styles.closingPointColor = line;
        }
        if (outline) {
            styles.closingPointOutlineColor = outline;
        }
        const draw = new TerraDraw({
            adapter: new TerraDrawMapLibreGLAdapter({ map }),
            modes: [new TerraDrawLineStringMode({ styles })]
        });
        draw.on('finish', this.onDrawFinish);
        draw.start();
        this.draw = draw;
        if (this.mapContainer) {
            // Capture phase, so Escape leaves the tool even after Terra Draw has
            // cleaned up its provisional line.
            this.mapContainer.addEventListener('keydown', this.onKeyDown, true);
        }
    }

    /**
     * Spike and e2e only: tell a test the map is drawn. The counts are read
     * back from MapLibre's own sources (querySourceFeatures, unique by the
     * feature's id property), so they prove the data reached the map, not only
     * that the component was constructed with it.
     */
    private publishReadiness(map: MapLibreMap): void {
        const el = this.mapContainer;
        if (!el || this.map !== map) {
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
        el.setAttribute('data-points-loaded', String(count(SOURCE_POINTS)));
        el.setAttribute('data-lines-loaded', String(count(SOURCE_LINE)));
        el.setAttribute('data-map-ready', 'true');
    }

    private toggleDrawing = (): void => {
        if (!this.draw) {
            return;
        }
        if (this.state.drawing) {
            this.draw.setMode(DRAW_MODE_OFF);
            this.setDrawState(cancelDrawing());
        } else {
            this.draw.setMode(DRAW_MODE_LINE);
            this.setDrawState(startDrawing());
        }
    };

    private onDrawFinish = (id: string | number, context: { mode: string; action: string }): void => {
        if (!this.draw || context.mode !== DRAW_MODE_LINE) {
            return;
        }
        const feature = this.draw.getSnapshotFeature(id);
        const geometry = feature ? feature.geometry : undefined;
        const points = geometry && geometry.type === 'LineString' ? geometry.coordinates.length : 0;
        this.draw.setMode(DRAW_MODE_OFF);
        this.setDrawState(finishLine(points));
        console.info('[MapStudio] Line drawn with Terra Draw: ' + points + ' points, id ' + id);
        // Save the finished line through the write path (edits.apply); the Gateway checks the role.
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        if (delegate && geometry && geometry.type === 'LineString') {
            const coordinates = geometry.coordinates.map((c) => [c[0], c[1]] as [number, number]);
            const itemId = delegate.sendLineCreate(coordinates);
            this.savingFeatures.set(itemId, id);
        }
    };

    private onKeyDown = (ev: KeyboardEvent): void => {
        if (ev.key === 'Escape' && this.state.drawing && this.draw) {
            this.draw.setMode(DRAW_MODE_OFF);
            this.setDrawState(cancelDrawing());
        }
    };

    private setDrawState(state: DrawState): void {
        this.setState(state);
        if (this.drawControl) {
            this.drawControl.setPressed(state.drawing);
        }
    }

    private onPointClick = (ev: MapLayerMouseEvent): void => {
        if (this.state.drawing) {
            // The click belongs to the line being drawn.
            return;
        }
        const feature = ev.features && ev.features[0];
        const pointId = feature && feature.properties ? feature.properties.id : undefined;
        if (typeof pointId !== 'string') {
            return;
        }
        const name = feature && feature.properties && typeof feature.properties.name === 'string'
            ? feature.properties.name : '';
        const geometry = feature ? feature.geometry : undefined;
        const lngLat: [number, number] = geometry && geometry.type === 'Point'
            ? [geometry.coordinates[0], geometry.coordinates[1]]
            : [ev.lngLat.lng, ev.lngLat.lat];
        this.openPopup({ id: pointId, name }, lngLat);

        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        if (!delegate) {
            console.warn('[MapStudio] No delegate; the click on ' + pointId + ' was not sent.');
            return;
        }
        delegate.sendPointClick(pointId);
    };

    /**
     * A click on the map away from any point closes the popup. MapLibre's own
     * closeOnClick is not used: it runs after the layer click handler and
     * would close the popup that a click on another point has just moved.
     */
    private onMapClick = (ev: MapMouseEvent): void => {
        if (this.state.drawing || !this.map || !this.popup || !this.popup.isOpen()) {
            return;
        }
        const onPoint = this.map.queryRenderedFeatures(ev.point, { layers: [LAYER_POINTS] });
        if (onPoint.length === 0) {
            this.popup.remove();
        }
    };

    /**
     * Open (or move) the MapLibre popup at a point. The popup's DOM node is
     * filled by React through a portal in render(), so the embedded project
     * view stays in this component's React tree.
     */
    private openPopup(point: PopupPoint, lngLat: [number, number]): void {
        if (!this.map) {
            return;
        }
        if (!this.popup) {
            this.popupContent = document.createElement('div');
            this.popupContent.className = 'mapstudio-popup-root';
            this.popup = new Popup({
                closeButton: true,
                closeOnClick: false,
                closeOnMove: false,
                // MapLibre writes maxWidth as an inline style on the popup, so the
                // phone cap lives here, not in the stylesheet.
                maxWidth: 'calc(100vw - 32px)',
                offset: 12
            });
            this.popup.setDOMContent(this.popupContent);
            this.popup.on('close', this.onPopupClosed);
        }
        this.setState({ popup: { point, lngLat } }, () => {
            if (this.popup && this.map) {
                this.popup.setLngLat(lngLat);
                if (!this.popup.isOpen()) {
                    this.popup.addTo(this.map);
                }
            }
        });
    }

    /** MapLibre closed the popup (close button, map click): unmount the view. */
    private onPopupClosed = (): void => {
        if (this.state.popup !== null) {
            this.setState({ popup: null });
        }
    };

    private renderPopup(): React.ReactNode {
        const open = this.state.popup;
        if (!open || !this.popupContent) {
            return null;
        }
        const store = this.props.store;
        const { path, params } = this.props.props.popupView;
        const mountPath = popupMountPath(store.viewMountPath, store.addressPathString);
        return ReactDOM.createPortal(
            <PointPopup
                key={PageStore.instanceKeyFor(path, mountPath) + '|' + open.point.id}
                clientStore={store.view.page.parent}
                parent={store}
                path={path}
                params={params}
                mountPath={mountPath}
                point={open.point}
            />,
            this.popupContent
        );
    }

    /**
     * The host lists' statuses as one hidden element, for tests and the dev page;
     * showing them to people is epic-editing's.
     */
    private renderAdapterStatus(lists: HostLists): React.ReactNode {
        const attrs = (name: 'kinds' | 'assets', status: AdapterStatus | null): Record<string, string> => ({
            ['data-' + name + '-status']: status ? status.status : '',
            ['data-' + name + '-count']: status ? String(status.count) : '',
            ['data-' + name + '-message']: status ? status.message : ''
        });
        return (
            <div className="mapstudio-adapter-status" hidden
                 {...attrs('kinds', lists.adapters ? lists.adapters.kinds : null)}
                 {...attrs('assets', lists.adapters ? lists.adapters.assets : null)}
                 data-kinds-rows={String(lists.kinds.length)}
                 data-assets-rows={lists.assets === null ? '' : String(lists.assets.length)} />
        );
    }

    private setMapContainer = (el: HTMLDivElement | null): void => {
        this.mapContainer = el;
    };

    render(): React.ReactNode {
        const delegate = this.props.delegate;
        const pending = !!(delegate && delegate.pendingId);
        const drawText = drawStatusText(this.state);
        const replyLine = delegate && delegate.lastReply ? delegate.lastReply : 'Click a point.';
        const save = delegate ? delegate.save : SAVE_IDLE;
        const saveText = saveStatusText(save);
        const load = delegate ? delegate.load : { state: 'loading', message: '' };
        return (
            <div {...this.props.emit({ classes: ['mapstudio'] })}>
                <div className="mapstudio-map" ref={this.setMapContainer}
                     data-test-set={this.testData.name}
                     data-edit-level={delegate && delegate.level ? delegate.level : ''}
                     data-load-state={load.state} />
                <div className={'mapstudio-reply' + (pending ? ' mapstudio-reply--pending' : '')}
                     data-pending={pending ? 'true' : 'false'}
                     data-drawing={this.state.drawing ? 'true' : 'false'}
                     data-line-points={this.state.linePoints === null ? '' : String(this.state.linePoints)}>
                    <div>{pending ? 'Waiting for the Gateway ...' : replyLine}</div>
                    {drawText !== '' ? <div className="mapstudio-draw-status">{drawText}</div> : null}
                    {saveText !== '' ? (
                        <div className={'mapstudio-save-status mapstudio-save-status--' + save.state}
                             data-save-state={save.state}
                             data-item-id={save.state === 'idle' ? '' : save.itemId}
                             data-version={save.state === 'saved' ? String(save.version) : ''}
                             data-code={save.state === 'refused' ? save.code : ''}>
                            {saveText}
                        </div>
                    ) : null}
                    {load.state === 'failed'
                        ? <div className="mapstudio-load-status">Map store: {load.message}</div> : null}
                </div>
                {this.renderAdapterStatus(delegate ? delegate.lists : NO_HOST_LISTS)}
                {this.renderPopup()}
            </div>
        );
    }
}

export class MapStudioMeta implements ComponentMeta {
    getComponentType(): string {
        return COMPONENT_TYPE;
    }

    getViewComponent(): PComponent {
        return MapStudio as unknown as PComponent;
    }

    getDefaultSize(): Size2d {
        return { width: 600, height: 400 };
    }

    createDelegate(component: AbstractUIElementStore): ComponentStoreDelegate | undefined {
        return new MapStudioStoreDelegate(component);
    }

    getPropsReducer(tree: PropertyTree): MapStudioProps {
        return {
            testSet: tree.readString('testSet', 'tracer'),
            popupView: {
                path: tree.readString('popupView.path', ''),
                params: tree.readObject<AuthorParams>('popupView.params', {})
            }
        };
    }
}
