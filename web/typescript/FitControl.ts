/**
 * Fit and Return (epic 3 entry 7, R5; the template's docs/map.md section 5 items 5, 9 and 10): a
 * MapLibre control group under the zoom buttons, top-right, with two named buttons. Fit fits every
 * map item's bounds and keeps until the bounds change or the user moves the map; Return re-centres
 * on the selected map item and is disabled while nothing is selected. Nothing sits in the
 * bottom-right corner (DESIGN.md, the reserved corner). Token colours only, in mapstudio.css.
 */

import { IControl, Map as MapLibreMap } from 'maplibre-gl';

export class FitControl implements IControl {
    private container: HTMLDivElement | null = null;
    private fitButton: HTMLButtonElement | null = null;
    private returnButton: HTMLButtonElement | null = null;

    constructor(private readonly onFit: () => void, private readonly onReturn: () => void) {}

    onAdd(_map: MapLibreMap): HTMLElement {
        const container = document.createElement('div');
        container.className = 'maplibregl-ctrl maplibregl-ctrl-group mapstudio-fit-group';
        this.fitButton = this.button(container, 'mapstudio-fit-button', 'Fit', 'Fit the map to every item', this.onFit);
        this.returnButton = this.button(container, 'mapstudio-return-button', 'Return', 'Return to the selected item', this.onReturn);
        this.returnButton.disabled = true;
        this.container = container;
        return container;
    }

    private button(parent: HTMLElement, className: string, text: string, label: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mapstudio-fit-control ' + className;
        button.textContent = text;
        button.title = label;
        button.setAttribute('aria-label', label);
        button.addEventListener('click', (ev) => {
            ev.preventDefault();
            onClick();
        });
        parent.appendChild(button);
        return button;
    }

    onRemove(): void {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.fitButton = null;
        this.returnButton = null;
    }

    /** Fit is disabled with nothing to fit; `kept` marks the button pressed while the fit keeps. */
    setFit(enabled: boolean, kept: boolean): void {
        if (this.fitButton) {
            this.fitButton.disabled = !enabled;
            this.fitButton.setAttribute('aria-pressed', kept ? 'true' : 'false');
            this.fitButton.classList.toggle('mapstudio-fit-control--on', kept);
        }
    }

    /** Return is enabled only while a map item is selected. */
    setReturn(enabled: boolean): void {
        if (this.returnButton) {
            this.returnButton.disabled = !enabled;
        }
    }
}
