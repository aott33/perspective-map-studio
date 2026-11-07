import * as fs from 'fs';
import * as path from 'path';
import {
    DIRECTIONS_OFF, coord6, directionsLink, fillTemplate, platformLink, platformOf, readDirections, resetDirectionsWarnings, templateUsable
} from '../directions';

const DESKTOP = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', maxTouchPoints: 0 };
const ANDROID = { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36', maxTouchPoints: 5 };
const IPHONE = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', maxTouchPoints: 5 };
const IPAD_DESKTOP = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', maxTouchPoints: 5 };
const MAC = { userAgent: IPAD_DESKTOP.userAgent, maxTouchPoints: 0 };

/** P14 in the dev map: [lng, lat]. */
const P14: [number, number] = [-103.2, 32.1];
const ON = { enabled: true, urlTemplate: '' };

describe('directions (epic 4 entry 16)', () => {
    let warn: jest.SpyInstance;
    beforeEach(() => {
        resetDirectionsWarnings();
        warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });
    afterEach(() => warn.mockRestore());

    test('the prop: null, a non-object or enabled not true is off; a template that is not a string is none', () => {
        expect(readDirections(null)).toEqual(DIRECTIONS_OFF);
        expect(readDirections(undefined)).toEqual(DIRECTIONS_OFF);
        expect(readDirections('yes')).toEqual(DIRECTIONS_OFF);
        expect(readDirections({ enabled: 'true' })).toEqual(DIRECTIONS_OFF);
        expect(readDirections({ enabled: false, urlTemplate: 'https://x' })).toEqual(DIRECTIONS_OFF);
        expect(readDirections({ enabled: true })).toEqual({ enabled: true, urlTemplate: '' });
        expect(readDirections({ enabled: true, urlTemplate: 5 })).toEqual({ enabled: true, urlTemplate: '' });
        expect(readDirections({ enabled: true, urlTemplate: 'geo:{lat},{lng}', extra: 1 })).toEqual({ enabled: true, urlTemplate: 'geo:{lat},{lng}' });
    });

    test('the platform: an iPhone, iPad or iPod agent, or Macintosh with touch points above 1, is Apple; the rest are not', () => {
        expect(platformOf(IPHONE.userAgent, IPHONE.maxTouchPoints)).toBe('apple');
        expect(platformOf('Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)', 5)).toBe('apple');
        expect(platformOf('Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)', 5)).toBe('apple');
        expect(platformOf(IPAD_DESKTOP.userAgent, IPAD_DESKTOP.maxTouchPoints)).toBe('apple');
        expect(platformOf(MAC.userAgent, 1)).toBe('other');
        expect(platformOf(MAC.userAgent, MAC.maxTouchPoints)).toBe('other');
        expect(platformOf(ANDROID.userAgent, ANDROID.maxTouchPoints)).toBe('other');
        expect(platformOf(DESKTOP.userAgent, DESKTOP.maxTouchPoints)).toBe('other');
        expect(platformOf('', 0)).toBe('other');
    });

    test('the platform link: Google route on a desktop and Android, Apple route with the name on iOS; 6 decimals', () => {
        expect(coord6(32.1)).toBe('32.100000');
        expect(coord6(-103.1234567)).toBe('-103.123457');
        expect(directionsLink(ON, P14, 'P14', DESKTOP)).toBe('https://www.google.com/maps/dir/?api=1&destination=32.100000,-103.200000');
        expect(directionsLink(ON, P14, 'P14', ANDROID)).toBe('https://www.google.com/maps/dir/?api=1&destination=32.100000,-103.200000');
        expect(directionsLink(ON, P14, 'P14 & pad', IPHONE)).toBe('https://maps.apple.com/?daddr=32.100000,-103.200000&q=P14%20%26%20pad');
        expect(directionsLink(ON, P14, 'P14', IPAD_DESKTOP)).toBe('https://maps.apple.com/?daddr=32.100000,-103.200000&q=P14');
        expect(platformLink('other', 1, 2, 'x')).toBe('https://www.google.com/maps/dir/?api=1&destination=1.000000,2.000000');
    });

    test('off gives no link', () => {
        expect(directionsLink(DIRECTIONS_OFF, P14, 'P14', DESKTOP)).toBeNull();
        expect(directionsLink(ON, [NaN, 32], 'P14', DESKTOP)).toBeNull();
    });

    test('a template: https, http, geo and maps are filled, the name encoded, every placeholder each time', () => {
        expect(templateUsable('https://x.example/r')).toBe(true);
        expect(templateUsable('http://x.example/r')).toBe(true);
        expect(templateUsable('geo:{lat},{lng}')).toBe(true);
        expect(templateUsable('maps:?daddr={lat},{lng}')).toBe(true);
        expect(directionsLink({ enabled: true, urlTemplate: 'https://x.example/r?to={lat},{lng}&n={name}' }, P14, 'Pad 14/A', DESKTOP))
            .toBe('https://x.example/r?to=32.100000,-103.200000&n=Pad%2014%2FA');
        expect(fillTemplate('geo:{lat},{lng}?q={lat},{lng}({name})', 32.1, -103.2, 'P14'))
            .toBe('geo:32.100000,-103.200000?q=32.100000,-103.200000(P14)');
        expect(warn).not.toHaveBeenCalled();
    });

    test('any other template is ignored with one warning and the platform link used', () => {
        const bad = { enabled: true, urlTemplate: 'javascript:alert(1)' };
        expect(templateUsable('javascript:alert(1)')).toBe(false);
        expect(templateUsable('  ')).toBe(false);
        expect(templateUsable('/alarms/{name}')).toBe(false);
        expect(templateUsable('ftp://x')).toBe(false);
        expect(directionsLink(bad, P14, 'P14', DESKTOP)).toBe('https://www.google.com/maps/dir/?api=1&destination=32.100000,-103.200000');
        expect(directionsLink(bad, P14, 'P14', IPHONE)).toBe('https://maps.apple.com/?daddr=32.100000,-103.200000&q=P14');
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).toContain('directions.urlTemplate is ignored');
        expect(String(warn.mock.calls[0][0])).not.toContain('javascript');
    });

    test('the module opens the link and fetches nothing: no fetch, XMLHttpRequest or beacon in directions.ts', () => {
        const text = fs.readFileSync(path.resolve(__dirname, '..', 'directions.ts'), 'utf8');
        for (const word of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket']) {
            expect(text).not.toContain(word);
        }
        expect(text).toContain("window.open(url, '_blank', 'noopener')");
    });
});
