/**
 * The Edit switch (epic 4 entry 2; DESIGN.md editing-switch, EXPERIENCE.md Editing switch): one
 * MapLibre control top-right above the zoom card, shown only to a session at level `full`. Off it
 * reads "Edit map" with the eye glyph and an off track; on it reads "Editing" with the kinds glyph
 * and the track in the attention token. A `role="switch"` button with `aria-checked`, so it works by
 * keyboard. The component owns the state (the studio model and the `editMode` prop); the control
 * only reports clicks and reflects `setOn`. Token colours only, in mapstudio.css.
 */

import { IControl, Map as MapLibreMap } from 'maplibre-gl';
import { glyphSvg } from './controls';

export class EditSwitch implements IControl {
    private container: HTMLDivElement | null = null;
    private button: HTMLButtonElement | null = null;
    private glyph: HTMLSpanElement | null = null;
    private word: HTMLSpanElement | null = null;
    private on = false;

    constructor(private readonly onToggle: (on: boolean) => void) {
    }

    onAdd(_map: MapLibreMap): HTMLElement {
        const container = document.createElement('div');
        container.className = 'maplibregl-ctrl mapstudio-edit-switch';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mapstudio-edit-switch-button';
        button.setAttribute('role', 'switch');
        const glyph = document.createElement('span');
        glyph.className = 'mapstudio-edit-switch-glyph';
        const word = document.createElement('span');
        word.className = 'mapstudio-edit-switch-word';
        const track = document.createElement('span');
        track.className = 'mapstudio-edit-switch-track';
        track.setAttribute('aria-hidden', 'true');
        const thumb = document.createElement('span');
        thumb.className = 'mapstudio-edit-switch-thumb';
        track.appendChild(thumb);
        button.appendChild(glyph);
        button.appendChild(word);
        button.appendChild(track);
        button.addEventListener('click', this.handleClick);
        container.appendChild(button);
        this.container = container;
        this.button = button;
        this.glyph = glyph;
        this.word = word;
        this.render();
        return container;
    }

    onRemove(): void {
        if (this.button) {
            this.button.removeEventListener('click', this.handleClick);
        }
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.button = null;
        this.glyph = null;
        this.word = null;
    }

    /** The control's element, so the component can lift it above the zoom card in its corner. */
    element(): HTMLElement | null {
        return this.container;
    }

    /** Reflect the mode on the switch. */
    setOn(on: boolean): void {
        if (this.on !== on) {
            this.on = on;
            this.render();
        }
    }

    private render(): void {
        if (!this.button || !this.glyph || !this.word) {
            return;
        }
        const label = this.on ? 'Editing' : 'Edit map';
        this.button.setAttribute('aria-checked', this.on ? 'true' : 'false');
        this.button.setAttribute('aria-label', this.on ? 'Editing: switch off to view the map' : 'Edit map: switch on to edit it');
        this.button.title = this.on ? 'Editing' : 'Edit map';
        this.button.setAttribute('data-on', this.on ? 'true' : 'false');
        this.glyph.innerHTML = glyphSvg(this.on ? 'kinds' : 'eye', 'mapstudio-ctrl-glyph');
        this.word.textContent = label;
    }

    private handleClick = (ev: MouseEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        this.onToggle(!this.on);
    };
}
