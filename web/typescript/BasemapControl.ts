import { IControl, Map as MapLibreMap } from 'maplibre-gl';
import { BASEMAP_LABELS, BasemapId } from './basemaps';

/**
 * The basemap switch (epic 3 entry 6, R10): one MapLibre control group with a button per offered
 * basemap, named in words, the chosen one pressed, and a status line in plain words under it when a
 * basemap is refused or its tiles do not load. Hidden while fewer than two basemaps are offered. The
 * component owns the state; the control reports clicks and reflects `setSelected` and `setStatus`.
 * Colours come from mapstudio.css tokens only.
 */
export class BasemapControl implements IControl {
    private container: HTMLDivElement | null = null;
    private group: HTMLDivElement | null = null;
    private status: HTMLDivElement | null = null;
    private buttons = new Map<BasemapId, HTMLButtonElement>();
    private offered: BasemapId[] = [];
    private selected: BasemapId | null = null;

    constructor(private readonly onChoose: (id: BasemapId) => void) {
    }

    onAdd(_map: MapLibreMap): HTMLElement {
        const container = document.createElement('div');
        container.className = 'maplibregl-ctrl mapstudio-basemap';
        container.hidden = true;
        const group = document.createElement('div');
        group.className = 'maplibregl-ctrl-group mapstudio-basemap-group';
        group.setAttribute('role', 'group');
        group.setAttribute('aria-label', 'Basemap');
        container.appendChild(group);
        const status = document.createElement('div');
        status.className = 'mapstudio-basemap-status';
        status.setAttribute('role', 'status');
        status.hidden = true;
        container.appendChild(status);
        this.container = container;
        this.group = group;
        this.status = status;
        this.render();
        return container;
    }

    onRemove(): void {
        this.buttons.forEach((button) => button.removeEventListener('click', this.handleClick));
        this.buttons.clear();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.group = null;
        this.status = null;
    }

    /** The basemaps to offer, in order; the control hides with fewer than two. */
    setOffered(offered: readonly BasemapId[]): void {
        if (offered.join(',') === this.offered.join(',')) {
            return;
        }
        this.offered = offered.slice();
        this.render();
    }

    setSelected(id: BasemapId | null): void {
        this.selected = id;
        this.buttons.forEach((button, key) => {
            const on = key === id;
            button.setAttribute('aria-pressed', on ? 'true' : 'false');
            button.classList.toggle('mapstudio-basemap-button--on', on);
        });
    }

    /** The plain-words status under the buttons, or '' for none. */
    setStatus(text: string): void {
        if (this.status) {
            this.status.textContent = text;
            this.status.hidden = text === '';
        }
    }

    private render(): void {
        const group = this.group;
        if (!group || !this.container) {
            return;
        }
        this.buttons.forEach((button) => button.removeEventListener('click', this.handleClick));
        this.buttons.clear();
        while (group.firstChild) {
            group.removeChild(group.firstChild);
        }
        for (const id of this.offered) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'mapstudio-basemap-button';
            button.setAttribute('data-basemap', id);
            button.setAttribute('aria-pressed', 'false');
            button.title = BASEMAP_LABELS[id];
            button.textContent = BASEMAP_LABELS[id];
            button.addEventListener('click', this.handleClick);
            group.appendChild(button);
            this.buttons.set(id, button);
        }
        this.container.hidden = this.offered.length < 2;
        this.setSelected(this.selected);
    }

    private handleClick = (ev: MouseEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        const id = (ev.currentTarget as HTMLElement).getAttribute('data-basemap') as BasemapId | null;
        if (id) {
            this.onChoose(id);
        }
    };
}
