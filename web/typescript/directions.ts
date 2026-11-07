/**
 * Directions (epic 4 entry 16, R51 and R52; EXPERIENCE.md Popup card, DESIGN.md popup-card footer): the `directions` prop
 * read, the platform worked out from the user agent and the touch points, the page's link template checked and filled,
 * and the link the popup's Directions button opens: the route to the item, not the pin, in the device's maps app or page.
 * The destination is the item record's own coordinates. Map Studio draws no route and sends nothing anywhere: the
 * button opens the link in a new tab on the press, and nothing here makes a request. Pure, unit tested in node.
 */

import { isRecord } from './json';

/** The prop as read: on or off, and the page's template ('' for none). */
export interface DirectionsSetting {
    enabled: boolean;
    urlTemplate: string;
}

export const DIRECTIONS_OFF: DirectionsSetting = { enabled: false, urlTemplate: '' };

/** The prop read: null, a non-object or `enabled` not true is off; a template that is not a string counts as none. */
export function readDirections(raw: unknown): DirectionsSetting {
    if (!isRecord(raw) || raw.enabled !== true) {
        return DIRECTIONS_OFF;
    }
    return { enabled: true, urlTemplate: typeof raw.urlTemplate === 'string' ? raw.urlTemplate : '' };
}

export type Platform = 'apple' | 'other';

/**
 * iOS and iPadOS: an iPhone, iPad or iPod user agent, or a Macintosh one with more than one touch point (iPadOS
 * asks for the desktop site and says Macintosh). Everything else, Android and every desktop included, is `other`.
 */
export function platformOf(userAgent: string, maxTouchPoints: number): Platform {
    if (/iPhone|iPad|iPod/.test(userAgent)) {
        return 'apple';
    }
    if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) {
        return 'apple';
    }
    return 'other';
}

/** The schemes a template may start with: a web page or a maps app. */
const TEMPLATE_SCHEMES = /^(https:\/\/|http:\/\/|geo:|maps:)/i;

/** Whether a template is used: a non-empty string starting with one of the schemes above. */
export function templateUsable(template: string): boolean {
    return template.trim() !== '' && TEMPLATE_SCHEMES.test(template.trim());
}

/** A coordinate as the link carries it: 6 decimals. */
export function coord6(n: number): string {
    return n.toFixed(6);
}

/** The template with `{lat}`, `{lng}` (6 decimals) and `{name}` (URL-encoded) filled. */
export function fillTemplate(template: string, lat: number, lng: number, name: string): string {
    return template.trim()
        .split('{lat}').join(coord6(lat))
        .split('{lng}').join(coord6(lng))
        .split('{name}').join(encodeURIComponent(name));
}

/** The platform's own link: Apple Maps' route on iOS and iPadOS, Google Maps' route elsewhere. */
export function platformLink(platform: Platform, lat: number, lng: number, name: string): string {
    if (platform === 'apple') {
        return 'https://maps.apple.com/?daddr=' + coord6(lat) + ',' + coord6(lng) + '&q=' + encodeURIComponent(name);
    }
    return 'https://www.google.com/maps/dir/?api=1&destination=' + coord6(lat) + ',' + coord6(lng);
}

/** What the browser says about itself, read where the link is built (tests pass their own). */
export interface Agent {
    userAgent: string;
    maxTouchPoints: number;
}

/** The running browser's agent, or a plain desktop one where there is no `navigator` (node). */
export function currentAgent(): Agent {
    if (typeof navigator === 'undefined') {
        return { userAgent: '', maxTouchPoints: 0 };
    }
    return { userAgent: navigator.userAgent || '', maxTouchPoints: navigator.maxTouchPoints || 0 };
}

/** The templates already warned about, so a template that is not used warns once, not on every render. */
const warned = new Set<string>();

/**
 * The link for a point at `[lng, lat]` named `name`, or null when Directions is off. A template the setting holds is
 * used when it is usable; any other template is ignored with one console warning and the platform link used.
 */
export function directionsLink(setting: DirectionsSetting, position: [number, number], name: string, agent: Agent): string | null {
    if (!setting.enabled) {
        return null;
    }
    const [lng, lat] = position;
    if (!isFinite(lat) || !isFinite(lng)) {
        return null;
    }
    if (setting.urlTemplate !== '') {
        if (templateUsable(setting.urlTemplate)) {
            return fillTemplate(setting.urlTemplate, lat, lng, name);
        }
        if (!warned.has(setting.urlTemplate)) {
            warned.add(setting.urlTemplate);
            console.warn('[MapStudio] directions.urlTemplate is ignored: it must start with https://, http://, geo: or maps:. '
                + 'The platform\'s maps link is used instead.');
        }
    }
    return platformLink(platformOf(agent.userAgent, agent.maxTouchPoints), lat, lng, name);
}

/** Forget the templates warned about (tests). */
export function resetDirectionsWarnings(): void {
    warned.clear();
}

/**
 * Open the link on the press: a new tab, or the maps app the device hands it to, with no opener. A browser that blocks
 * it is left to say so; nothing else happens.
 */
export function openDirections(url: string): void {
    if (typeof window !== 'undefined' && typeof window.open === 'function') {
        window.open(url, '_blank', 'noopener');
    }
}
