import * as React from 'react';
import {
    ClientStore,
    ComponentStore,
    PageStore,
    View,
    ViewProps,
    ViewStateType
} from '@inductiveautomation/perspective-client';
import { AuthorParams, isFailedViewState } from './popupParams';

/**
 * Perspective's View is typed against React 18 while this bundle compiles with
 * the React 16 typings the runtime externals match; the alias keeps JSX happy
 * without changing what is rendered (the same trick as PComponent in story 1).
 */
const ProjectView = View as unknown as React.ComponentClass<ViewProps>;

export interface PointPopupProps {
    /** The client store, `store.view.page.parent` of the component. */
    clientStore: ClientStore;
    /** The Map Studio component store, passed to the view as its parent (view cycle check). */
    parent: ComponentStore;
    /** The kind setup's project view path. */
    path: string;
    /** The view's params: the kind setup's filled params with `mapItem` (popupParams.ts). */
    params: AuthorParams;
    /** Mount path for the embedded view. */
    mountPath: string;
    /** The map item's id, for tests. */
    pointId: string;
    /** What to show when the view cannot be: Map Studio's default popup (AD-7). */
    fallback: () => React.ReactNode;
}

interface PointPopupState {
    /** Set when the view reported a state it cannot recover from. */
    failed: boolean;
}

/**
 * The content of the point popup when the kind setup names a custom popup view (AD-7, epic 3
 * entry 8): the project view rendered with Perspective's own View component the way the built-in
 * Map renders its custom controls and view layer, with `mapItem` and the filled params; a missing
 * or failing view (not found, an error, access denied) falls back to the default popup with one
 * console warning naming the path.
 */
export class PointPopup extends React.Component<PointPopupProps, PointPopupState> {
    state: PointPopupState = { failed: false };

    private onViewStateChange = (state: ViewStateType): void => {
        if (isFailedViewState(state) && !this.state.failed) {
            console.warn('[MapStudio] Popup view "' + this.props.path + '" cannot be shown (' + state
                + '); showing the default popup instead.');
            this.setState({ failed: true });
        }
    };

    render(): React.ReactNode {
        const { clientStore, parent, path, params, mountPath, pointId } = this.props;
        if (!path || this.state.failed) {
            return this.props.fallback();
        }
        return (
            <div className="mapstudio-popup mapstudio-popup--view" data-point-id={pointId} data-view-path={path}>
                <ProjectView
                    key={PageStore.instanceKeyFor(path, mountPath)}
                    store={clientStore}
                    parent={parent}
                    resourcePath={path}
                    mountPath={mountPath}
                    params={params}
                    useDefaultWidth={true}
                    useDefaultHeight={true}
                    onViewStateChange={this.onViewStateChange}
                />
            </div>
        );
    }
}
