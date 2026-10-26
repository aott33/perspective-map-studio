import * as React from 'react';
import {
    AbstractUIElementStore,
    Component,
    ComponentMeta,
    ComponentProps,
    ComponentStoreDelegate,
    JsObject,
    PComponent,
    PropertyTree,
    Size2d
} from '@inductiveautomation/perspective-client';
import { Map as MapLibreMap, MapLayerMouseEvent, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import { MESSAGE_EVENT, pointClick, readReply, replyText } from './messages';
import { TEST_LINE, TEST_POINTS } from './testData';
import { themeColor } from './theme';

/** Must match MapStudioComponent.COMPONENT_ID on the Java side. */
export const COMPONENT_TYPE = 'ao.mapstudio';

/**
 * MapLibre's worker, served by the gateway hook beside the bundle under the
 * module's mount alias (MapStudioModule.URL_ALIAS); copied there by webpack
 * with a .js name so the gateway serves it with a JavaScript content type.
 */
export const WORKER_URL = '/res/mapstudio/maplibre-gl-worker.js';
setWorkerUrl(WORKER_URL);

/** Component props read from the property tree. None yet beyond style. */
export interface MapStudioProps {
}

/** The delegate state the component renders. */
export interface MapStudioDelegateState {
    /** The last reply from the Gateway as one line of text, or '' before the first. */
    lastReply: string;
    /** Id of the message whose reply is awaited, or null. */
    pendingId: string | null;
}

/**
 * Browser side of the component delegate: sends envelopes to the Gateway
 * delegate and keeps the last reply for the component to show.
 */
export class MapStudioStoreDelegate extends ComponentStoreDelegate {
    private lastReply = '';
    private pendingId: string | null = null;

    constructor(componentStore: AbstractUIElementStore) {
        super(componentStore);
    }

    mapStateToProps(): MapStudioDelegateState {
        return { lastReply: this.lastReply, pendingId: this.pendingId };
    }

    /** Send `point.click` for one point; the reply arrives in handleEvent. */
    sendPointClick(pointId: string): void {
        const message = pointClick(pointId);
        this.pendingId = message.id;
        this.notify();
        this.fireEvent(MESSAGE_EVENT, message as unknown as JsObject);
    }

    handleEvent(eventName: string, eventObject: JsObject): void {
        if (eventName !== MESSAGE_EVENT) {
            console.warn('[MapStudio] Ignoring unknown model event ' + eventName);
            return;
        }
        const reply = readReply(eventObject);
        if (reply.kind !== 'invalid' && this.pendingId !== null && reply.id !== this.pendingId) {
            console.warn('[MapStudio] Reply ' + reply.id + ' does not match the pending message ' + this.pendingId);
        }
        this.lastReply = replyText(reply);
        this.pendingId = null;
        console.info('[MapStudio] ' + this.lastReply);
        this.notify();
    }
}

type Props = ComponentProps<MapStudioProps, MapStudioDelegateState>;

const SOURCE_POINTS = 'mapstudio-points';
const SOURCE_LINE = 'mapstudio-line';
const LAYER_LINE = 'mapstudio-line';
const LAYER_POINTS = 'mapstudio-points';

/**
 * The Map Studio component: a MapLibre map on a blank style with fixed test
 * data (three points and one line). Clicking a point sends `point.click`
 * through the delegate; the reply is shown as text over the map.
 */
export class MapStudio extends Component<Props, {}> {
    private mapContainer: HTMLDivElement | null = null;
    private map: MapLibreMap | null = null;
    private resizeObserver: ResizeObserver | null = null;

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
            center: TEST_LINE.center,
            zoom: TEST_LINE.zoom,
            attributionControl: false
        });
        map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
        map.on('load', () => {
            map.addSource(SOURCE_LINE, { type: 'geojson', data: TEST_LINE.feature });
            map.addSource(SOURCE_POINTS, { type: 'geojson', data: TEST_POINTS });
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
            map.on('click', LAYER_POINTS, this.onPointClick);
            map.on('mouseenter', LAYER_POINTS, () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', LAYER_POINTS, () => { map.getCanvas().style.cursor = ''; });
        });
        this.map = map;

        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => { map.resize(); });
            this.resizeObserver.observe(this.mapContainer);
        }
    }

    componentWillUnmount(): void {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
    }

    private onPointClick = (ev: MapLayerMouseEvent): void => {
        const feature = ev.features && ev.features[0];
        const pointId = feature && feature.properties ? feature.properties.id : undefined;
        if (typeof pointId !== 'string') {
            return;
        }
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        if (!delegate) {
            console.warn('[MapStudio] No delegate; the click on ' + pointId + ' was not sent.');
            return;
        }
        delegate.sendPointClick(pointId);
    };

    private setMapContainer = (el: HTMLDivElement | null): void => {
        this.mapContainer = el;
    };

    render(): React.ReactNode {
        const delegate = this.props.delegate;
        const pending = !!(delegate && delegate.pendingId);
        const text = delegate && delegate.lastReply ? delegate.lastReply : 'Click a point.';
        return (
            <div {...this.props.emit({ classes: ['mapstudio'] })}>
                <div className="mapstudio-map" ref={this.setMapContainer} />
                <div className={'mapstudio-reply' + (pending ? ' mapstudio-reply--pending' : '')}
                     data-pending={pending ? 'true' : 'false'}>
                    {pending ? 'Waiting for the Gateway ...' : text}
                </div>
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

    getPropsReducer(_tree: PropertyTree): MapStudioProps {
        return {};
    }
}
