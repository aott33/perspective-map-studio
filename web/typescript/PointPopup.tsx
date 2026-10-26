import * as React from 'react';
import {
    ClientStore,
    ComponentStore,
    PageStore,
    View,
    ViewProps,
    ViewStateType
} from '@inductiveautomation/perspective-client';
import { AuthorParams, PopupPoint, fallbackText, isFailedViewState, popupViewParams } from './popupParams';

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
    /** Project view path; empty shows the text fallback. */
    path: string;
    /** Author params from the `popupView.params` prop. */
    params: AuthorParams;
    /** Mount path for the embedded view. */
    mountPath: string;
    /** The clicked point. */
    point: PopupPoint;
}

interface PointPopupState {
    /** Set when the view reported a state it cannot recover from. */
    failed: boolean;
}

/**
 * The content of the point popup: the project view named by `path`, rendered
 * with Perspective's own View component the way the built-in Map renders its
 * custom controls and view layer (AD-7), or a text fallback with the point id
 * when there is no path or the view cannot be shown.
 */
export class PointPopup extends React.Component<PointPopupProps, PointPopupState> {
    state: PointPopupState = { failed: false };

    private onViewStateChange = (state: ViewStateType): void => {
        if (isFailedViewState(state) && !this.state.failed) {
            console.warn('[MapStudio] Popup view "' + this.props.path + '" cannot be shown (' + state
                + '); showing the text popup instead.');
            this.setState({ failed: true });
        }
    };

    render(): React.ReactNode {
        const { clientStore, parent, path, params, mountPath, point } = this.props;
        if (!path || this.state.failed) {
            return (
                <div className="mapstudio-popup mapstudio-popup--text" data-point-id={point.id}>
                    {fallbackText(point)}
                </div>
            );
        }
        return (
            <div className="mapstudio-popup mapstudio-popup--view" data-point-id={point.id}>
                <ProjectView
                    key={PageStore.instanceKeyFor(path, mountPath)}
                    store={clientStore}
                    parent={parent}
                    resourcePath={path}
                    mountPath={mountPath}
                    params={popupViewParams(params, point)}
                    useDefaultWidth={true}
                    useDefaultHeight={true}
                    onViewStateChange={this.onViewStateChange}
                />
            </div>
        );
    }
}
