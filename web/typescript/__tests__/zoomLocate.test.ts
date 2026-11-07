import { Map as MapLibreMap } from 'maplibre-gl';
import { ZoomControl } from '../ZoomControl';
import { GLYPH_PATHS } from '../controls';
import { LocationState } from '../userLocation';

/** A small stand-in for the DOM the zoom card builds (the suite runs in node). */
class FakeEl {
    className = '';
    title = '';
    innerHTML = '';
    textContent = '';
    disabled = false;
    type = '';
    children: FakeEl[] = [];
    parentNode: FakeEl | null = null;
    private attrs: Record<string, string> = {};
    private listeners: Record<string, Array<(ev: { preventDefault(): void }) => void>> = {};
    private classes = new Set<string>();
    classList = {
        toggle: (name: string, on: boolean): void => { if (on) { this.classes.add(name); } else { this.classes.delete(name); } },
        contains: (name: string): boolean => this.classes.has(name)
    };
    setAttribute(name: string, value: string): void { this.attrs[name] = value; }
    getAttribute(name: string): string | null { return name in this.attrs ? this.attrs[name] : null; }
    appendChild(child: FakeEl): FakeEl { child.parentNode = this; this.children.push(child); return child; }
    removeChild(child: FakeEl): void { this.children = this.children.filter((c) => c !== child); }
    addEventListener(type: string, fn: (ev: { preventDefault(): void }) => void): void { (this.listeners[type] = this.listeners[type] || []).push(fn); }
    click(): void { for (const fn of this.listeners.click || []) { fn({ preventDefault: () => undefined }); } }
}

const realDocument = (global as { document?: unknown }).document;

beforeAll(() => {
    (global as { document?: unknown }).document = { createElement: () => new FakeEl() };
});

afterAll(() => {
    (global as { document?: unknown }).document = realDocument;
});

function mount(onLocate: () => void): { control: ZoomControl; card: FakeEl; locate: FakeEl } {
    const map = { on: () => undefined, off: () => undefined, getZoom: () => 12, zoomIn: () => undefined, zoomOut: () => undefined };
    const control = new ZoomControl(() => undefined, () => undefined, onLocate);
    const card = control.onAdd(map as unknown as MapLibreMap) as unknown as FakeEl;
    const buttons = card.children.filter((c) => c.className.includes('mapstudio-ctrl-button'));
    return { control, card, locate: buttons[buttons.length - 1] };
}

describe('Locate me on the zoom card (epic 4 entry 15)', () => {
    test('it is the card\'s last button, after Return, a navigation arrow', () => {
        const { card, locate } = mount(() => undefined);
        const names = card.children.map((c) => c.className.replace('mapstudio-ctrl-button ', ''));
        expect(names).toEqual(['mapstudio-zoom-in', 'mapstudio-zoom-level', 'mapstudio-zoom-out', 'mapstudio-fit-button',
            'mapstudio-return-button', 'mapstudio-locate-button']);
        expect(locate.innerHTML).toContain(GLYPH_PATHS.navigate);
        expect(locate.getAttribute('aria-label')).toBe('Locate me');
    });

    test('off at mount (no prop yet), with its reason in its title and accessible description, and a press does nothing', () => {
        let pressed = 0;
        const { locate } = mount(() => { pressed++; });
        expect(locate.title).toBe('Locate me - location is off for this session');
        expect(locate.getAttribute('aria-description')).toBe('Locate me - location is off for this session');
        expect(locate.getAttribute('aria-disabled')).toBe('true');
        expect(locate.classList.contains('mapstudio-ctrl-button--inert')).toBe(true);
        locate.click();
        expect(pressed).toBe(0);
    });

    test('each state says its own words; only a fix makes it active', () => {
        let pressed = 0;
        const { control, locate } = mount(() => { pressed++; });
        const words: Record<LocationState, string> = {
            off: 'Locate me - location is off for this session',
            denied: 'Locate me - location permission not granted',
            nofix: 'Locate me - no location fix yet',
            fix: 'Locate me'
        };
        for (const state of ['denied', 'nofix', 'off'] as LocationState[]) {
            control.setLocate(state);
            expect(locate.title).toBe(words[state]);
            expect(locate.getAttribute('aria-description')).toBe(words[state]);
            expect(locate.getAttribute('aria-disabled')).toBe('true');
            expect(locate.getAttribute('data-locate')).toBe(state);
            locate.click();
        }
        expect(pressed).toBe(0);
        control.setLocate('fix');
        expect(locate.title).toBe('Locate me');
        expect(locate.getAttribute('aria-disabled')).toBe('false');
        expect(locate.classList.contains('mapstudio-ctrl-button--inert')).toBe(false);
        locate.click();
        expect(pressed).toBe(1);
    });
});
