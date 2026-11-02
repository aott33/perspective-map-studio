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

    test('with no alarm page there is no View alarms; with no alarms the words alone (no check mark, option A), no tint and no button', () => {
        expect(render({ alarmPage: null })).not.toContain('View alarms');
        const quiet = render({ values: QUIET, detail: { ...DETAIL, alarms: { counts: { 1: 0, 2: 0, 3: 0 }, list: [], reason: '' } } });
        expect(quiet).toContain('No active alarms');
        expect(quiet).not.toContain('mapstudio-popup-alarm-glyph--ok');
        expect(quiet).not.toContain('#ms-stale');
        expect(quiet).not.toContain('mapstudio-popup-alarms--active');
        expect(quiet).not.toContain('View alarms');
        expect(quiet).not.toContain('mapstudio-popup-alarm-line');
    });

    test('option A rows (owner review notes items 13, 15 and 21): the comms status right-aligned, a stale value as the hourglass alone, no data in words', () => {
        const html = render();
        // The comms row keeps its check and the age; its label is never cut.
        expect(html).toMatch(/data-comms="ok"[^>]*>.*mapstudio-popup-ok-glyph.*OK - 4 min ago/);
        // A stale value: the hourglass before the value, the reason in the row's tooltip, the code kept for tests.
        const stale = render({ values: { ...ALARMED, kpis: { pressure: { value: 880, quality: 'Bad', t: T, stale: true, reason: 'comms lost' }, flow: ALARMED.kpis.flow } } });
        expect(stale).toMatch(/data-kpi="pressure"[^>]*data-stale="true"[^>]*data-quality="Bad"[^>]*title="Stale - comms lost"/);
        expect(stale).toMatch(/#ms-stale.*880 psi/);
        expect(stale).not.toContain('Stale - 880');
        expect(stale).not.toContain('(comms lost)');
        // A comms tag that is not there (Point 3): comms lost as the marker draws it, the code in plain words, kept in the tooltip.
        const notFound = render({ values: { id: 'p1', comms: { value: null, quality: 'Bad_NotFound', t: null, stale: true, reason: 'Bad_NotFound' },
            kpis: {}, problems: [] }, detail: null });
        expect(notFound).toMatch(/mapstudio-popup-comms--lost[^>]*data-comms="lost"[^>]*data-quality="Bad_NotFound"/);
        expect(notFound).toContain('No data yet - tag not found');
        expect(notFound).not.toContain('Bad_NotFound)</span>');
        expect(notFound).toContain('#ms-comms-lost');
        expect(notFound).not.toContain('mapstudio-popup-ok-glyph');
        expect(notFound).toContain('mapstudio-popup-kpi--none');
        expect(notFound).toContain('No data yet</span>');
        expect(notFound).toContain('Alarm state unknown');
        expect(notFound).toContain('data-alarm="unknown"');
        // No data yet (item 21, no comms slot at all: no asset linked): neither OK nor lost, no glyph, the words in the
        // secondary colour by class with the problem's reason, and the alarm state unknown.
        const unlinked = render({ values: { id: 'p1', kpis: {}, problems: [{ slot: 'comms', reason: 'no asset is linked' }] }, detail: null });
        expect(unlinked).toMatch(/mapstudio-popup-comms--unknown[^>]*data-comms="unknown"/);
        expect(unlinked).toContain('No data yet - no asset is linked');
        expect(unlinked).not.toContain('mapstudio-popup-ok-glyph');
        expect(unlinked).not.toContain('#ms-comms-lost');
        expect(unlinked).toContain('Alarm state unknown');
        // A slot that has simply not delivered yet reads the same, its code in the tooltip.
        const early = render({ values: { id: 'p1', comms: { value: null, quality: 'Uncertain_InitialValue', t: null, stale: true, reason: 'no value yet' },
            kpis: {}, problems: [] }, detail: null });
        expect(early).toMatch(/data-comms="unknown"[^>]*data-quality="Uncertain_InitialValue"/);
        expect(early).toContain('title="No data yet (Uncertain_InitialValue)"');
    });

    test('an alarm whose list could not be read says so in words, and a stale alarms slot shows the hourglass with its reason', () => {
        const html = render({ detail: { ...DETAIL, alarms: { counts: { 1: 0, 2: 0, 3: 0 }, list: [], reason: 'the alarm status could not be read' } } });
        expect(html).toContain('The alarms could not be listed: the alarm status could not be read.');
        // An alarm while comms are lost (item 13): the alarm glyph, then the hourglass, then the words; no "Stale - ".
        const stale = render({ values: { ...ALARMED, comms: { ...ALARMED.comms!, value: false },
            alarms: { ...ALARMED.alarms!, stale: true, reason: 'comms lost' } } });
        expect(stale).toContain('data-stale="true"');
        expect(stale).toMatch(/#ms-alarm-1-unacknowledged.*#ms-stale.*2 alarms - Priority 1, unacknowledged/);
        expect(stale).not.toContain('Stale - 2 alarms');
        expect(stale).toContain('title="Alarm state may be out of date: comms lost 4 min ago"');
        // No active alarms while comms are lost: the hourglass before the words, the same tooltip.
        const quietLost = render({ values: { ...QUIET, comms: { ...QUIET.comms!, value: false }, alarms: { ...QUIET.alarms!, stale: true, reason: 'comms lost' } },
            detail: { ...DETAIL, alarms: { counts: { 1: 0, 2: 0, 3: 0 }, list: [], reason: '' } } });
        expect(quietLost).toMatch(/#ms-stale.*No active alarms/);
        expect(quietLost).toContain('Alarm state may be out of date: comms lost 4 min ago');
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
