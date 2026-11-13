import * as React from 'react';

/**
 * A tab list's markup (DESIGN.md Properties panel and tabs): the Details and Style tabs of the properties panel and the Layers
 * and Legend tabs of the Layers surface. `roving` is the properties panel's key handling (one tab stop, the keys move and the
 * focus follows); without it a tab takes no `tabindex` and no key handler, as the Layers surface's tabs.
 */
export function panelTabs<T extends string>(o: {
    label: string; tabs: ReadonlyArray<[T, string]>; now: T;
    tabId: (tab: T) => string; panelId: (tab: T) => string; onChoose: (tab: T) => void;
    roving?: { onKeyDown: (ev: React.KeyboardEvent<HTMLButtonElement>) => void; ref: (tab: T, el: HTMLButtonElement | null) => void };
}): React.ReactElement {
    const roving = o.roving;
    return (
        <div className="mapstudio-panel-tabs" role="tablist" aria-label={o.label}>
            {o.tabs.map(([tab, label]) => (
                <button key={tab} ref={roving ? (el) => roving.ref(tab, el) : undefined} type="button" role="tab" id={o.tabId(tab)} data-tab={tab}
                        aria-selected={o.now === tab} aria-controls={o.panelId(tab)} tabIndex={roving ? (o.now === tab ? 0 : -1) : undefined}
                        className={'mapstudio-panel-tab' + (o.now === tab ? ' mapstudio-panel-tab--active' : '')}
                        onClick={() => o.onChoose(tab)} onKeyDown={roving ? roving.onKeyDown : undefined}>{label}</button>
            ))}
        </div>
    );
}
