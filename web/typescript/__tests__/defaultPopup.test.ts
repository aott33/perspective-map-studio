import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DefaultPopup, DefaultPopupProps } from '../DefaultPopup';
import { ItemValues, KindDisplay, LiveValue, PopupDetail } from '../live';

const T = '2026-10-28T10:00:00Z';
const NOW = Date.parse('2026-10-28T10:04:00Z');
const good = (value: unknown): LiveValue => ({ value, quality: 'Good', t: T, stale: false, reason: '' });

const DISPLAY: KindDisplay = {
    kindId: 'pad', comms: true,
    kpis: [{ key: 'pressure', label: 'Casing pressure', unit: 'psi', icon: true, on: true },
        { key: 'flow', label: 'Flow', unit: 'bbl/d', icon: false, on: true }],
    alarms: { on: true, count: true, summary: true }, link: '/pad/{item.name}'
};
const ALARMED: ItemValues = {
    id: 'p1', comms: good(true), kpis: { pressure: good(1240), flow: good(80) },
    alarms: good({ active: 2, unacked: 1, priority: 1 }), problems: []
};
const QUIET: ItemValues = { ...ALARMED, alarms: good({ active: 0, unacked: 0, priority: 0 }) };
const DETAIL: PopupDetail = {
    basePath: '[default]Mesa/P14', alarmsPath: '[default]Mesa/P14',
    alarms: {
        counts: { 1: 1, 2: 0, 3: 1 },
        list: [{ name: 'Casing pressure high', source: 'Pressure', priority: 1, unacked: true, activeTime: T },
            { name: 'Low flow', source: 'Flow', priority: 3, unacked: false, activeTime: T }],
        reason: ''
    }
};

function render(over: Partial<DefaultPopupProps> = {}): string {
    const props: DefaultPopupProps = {
        item: { id: 'p1', name: 'P14', kind: 'pad', kindName: 'Well pad', icon: 'well-pad' },
        display: DISPLAY, values: ALARMED, detail: DETAIL, now: NOW, link: '/pad/P14', alarmPage: '/alarms/P14',
        mode: 'card', canEdit: false, onClose: () => undefined, onNavigate: () => undefined, ...over
    };
    return renderToStaticMarkup(React.createElement(DefaultPopup, props));
}

const order = (html: string): string[] => (html.match(/data-part="([a-z]+)"/g) || []).map((m) => m.replace(/data-part="|"/g, ''));

describe('the default popup card (epic 3 entry 8, AD-7)', () => {
    test('the header holds the glyph disc, the name, the kind, the pop-out link and the close, then comms, KPIs, alarms', () => {
        const html = render();
        expect(order(html)).toEqual(['header', 'comms', 'kpis', 'alarms']);
        expect(html).toContain('data-popup-mode="card"');
        expect(html).toContain('class="mapstudio-popup-disc"');
        expect(html).toContain('#ms-well-pad');
        expect(html).toContain('<div class="mapstudio-popup-name">P14</div>');
        expect(html).toContain('<div class="mapstudio-popup-subline">Well pad</div>');
        expect(html).toContain('data-link="/pad/P14"');
        expect(html).toContain('aria-label="Open the page of P14"');
        expect(html).toContain('aria-label="Close"');
        expect(html.indexOf('mapstudio-popup-link')).toBeLessThan(html.indexOf('mapstudio-popup-close'));
        expect(html).toContain('OK - 4 min ago');
        expect(html).toContain('1240 psi');
        expect(html).not.toContain('mapstudio-popup-handle');
        expect(html).not.toContain('data-part="footer"');
    });

    test('the pop-out icon is hidden, not disabled, when the link has no value (R8)', () => {
        const html = render({ link: null });
        expect(html).not.toContain('mapstudio-popup-link');
        expect(html).not.toContain('disabled');
        expect(html).toContain('mapstudio-popup-close');
    });

    test('the alarm block says the count and priority, lists the most important alarm with its age, the rest as more, and offers View alarms', () => {
        const html = render();
        expect(html).toContain('mapstudio-popup-alarms--active mapstudio-popup-alarms--p1');
        expect(html).toContain('data-alarm="1:unacked"');
        expect(html).toContain('data-alarm-counts="1,0,1"');
        expect(html).toContain('#ms-alarm-1-unacknowledged');
        expect(html).toContain('2 alarms - Priority 1, unacknowledged');
        expect(html).toContain('<div class="mapstudio-popup-alarm-counts">1 priority 1, 1 priority 3</div>');
        expect(html).toContain('<div class="mapstudio-popup-alarm-line">Casing pressure high - Pressure, 4 min ago</div>');
        expect(html).toContain('+ 1 more');
        expect(html).not.toContain('Low flow');
        expect(html).toContain('mapstudio-popup-view-alarms');
        expect(html).toContain('>View alarms</button>');
        expect(html).not.toContain('[default]');
    });

    test('with no alarm page there is no View alarms; with no alarms a check and the words, no tint and no button', () => {
        expect(render({ alarmPage: null })).not.toContain('View alarms');
        const quiet = render({ values: QUIET, detail: { ...DETAIL, alarms: { counts: { 1: 0, 2: 0, 3: 0 }, list: [], reason: '' } } });
        expect(quiet).toContain('No active alarms');
        expect(quiet).toContain('mapstudio-popup-alarm-glyph--ok');
        expect(quiet).not.toContain('mapstudio-popup-alarms--active');
        expect(quiet).not.toContain('View alarms');
        expect(quiet).not.toContain('mapstudio-popup-alarm-line');
    });

    test('an alarm whose list could not be read says so in words, and a stale alarms slot is marked', () => {
        const html = render({ detail: { ...DETAIL, alarms: { counts: { 1: 0, 2: 0, 3: 0 }, list: [], reason: 'the alarm status could not be read' } } });
        expect(html).toContain('The alarms could not be listed: the alarm status could not be read.');
        const stale = render({ values: { ...ALARMED, alarms: { ...ALARMED.alarms!, stale: true, reason: 'comms lost' } } });
        expect(stale).toContain('data-stale="true"');
        expect(stale).toContain('Stale - 2 alarms - Priority 1, unacknowledged');
        // Before the detail arrives the block shows the counts from the metrics alone.
        const early = render({ detail: null });
        expect(early).toContain('2 alarms - Priority 1, unacknowledged');
        expect(early).toContain('data-alarm-counts=""');
        expect(early).not.toContain('mapstudio-popup-alarm-line');
    });

    test('a part the setup turns off is not drawn', () => {
        const html = render({ display: { ...DISPLAY, comms: false, alarms: { on: false, count: true, summary: true } } });
        expect(order(html)).toEqual(['header', 'kpis']);
    });
});

describe('the bottom sheet', () => {
    test('the same body with a handle, 44 px header buttons by class, no card button and a footer with View alarms', () => {
        const html = render({ mode: 'sheet' });
        expect(html).toContain('data-popup-mode="sheet"');
        expect(html).toContain('mapstudio-popup--sheet');
        expect(html).toContain('class="mapstudio-popup-handle"');
        expect(order(html)).toEqual(['header', 'comms', 'kpis', 'alarms', 'footer']);
        const footer = html.substring(html.indexOf('data-part="footer"'));
        expect(footer).toContain('View alarms');
        expect((html.match(/View alarms/g) || []).length).toBe(1);
        expect(footer).not.toContain('>Edit<');
    });

    test('Edit shows in the footer only for an editing role; no alarm and no role, no footer', () => {
        expect(render({ mode: 'sheet', canEdit: true })).toContain('mapstudio-popup-edit');
        expect(render({ mode: 'sheet', values: QUIET })).not.toContain('data-part="footer"');
    });
});
