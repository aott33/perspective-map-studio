// The Style tab and an item's own style rule (epic 4 entry 12c2, R5, R15): the rule checked as an item's own (a type, a full
// path, 12c1's words; T7, T8), the copy of the kind's rule Override starts from (T4), a rule in words (T2), the "shows now"
// line, the `styleRule` row of an override with every other stored part untouched (T11), its Undo words (T10) and a refusal's
// place; then the panel as drawn: the two tabs as a tab list (T1), the read-only rows and the kind's rule under "From kind" (T2),
// an own rule in the shared editor under Override with Reset (T6, T9), and the editor shared with Kinds' section 6 (T12).
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdapterStatus, Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { RULE_ROW, applyRuleEdit, ownRule, refusalRest, ruleLabel } from '../itemOverrides';
import {
    Fields, KeyValue, NO_RULE, OWN_PATH_TEXT, OWN_RULE_EMPTY, RuleDraft, checkRule, ownRuleStart, ownRuleTypes, readSetup, ruleDraft, ruleRefusalPlace,
    ruleWords, sameRule, showsNowText
} from '../kindSetup';
import { ItemState } from '../live';
import { ItemView } from '../placeholders';
import { createPlaceSource } from '../placeCheck';
import {
    PANEL_TABS, PropertiesPanel, PropertiesPanelProps, STYLE_ICON_HINT, STYLE_LABEL_HINT, STYLE_SIZE_HINT, StyleFacts, sizeText, tabForKey
} from '../studio/PropertiesPanel';
import { RuleEditor, ruleFields } from '../studio/RuleEditor';

const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] };
const LINE: Kind = { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [] };
const FENCE: Kind = { id: 'geofence', name: 'Geofence', geometry: 'line', icon: 'geofence', labelRank: 0, fields: [], area: true };
const PAD_RULE = { source: { path: '{asset.path}/Status' }, type: 'states', cases: [
    { value: 1, preset: 'attention' }, { value: 2, preset: 'warning' }, { value: 3, preset: 'fault' }, { value: 4, preset: 'dimmed' }] };
const LINE_RULE = { source: { kpi: 'flow' }, type: 'bands', cases: [
    { min: null, max: 50, preset: 'normal' }, { min: 50, max: 200, preset: 'attention' }, { min: 200, max: null, preset: 'fault' }] };
const P2_RULE = { source: { path: '[default]Mesa/P14/Pressure' }, type: 'expression', expression: "if({value} > 600, 'warning', 'normal')" };
const INSTRUMENTS = { source: { instruments: 'worst' } };
const KPIS: KeyValue[] = readSetup({ kpis: [
    { key: 'pressure', label: 'Pressure', path: '{asset.path}/Pressure', unit: 'psi', on: true, icon: true },
    { key: 'flow', label: 'Flow', path: '{asset.path}/Flow', unit: 'bbl/d', on: false }] }).kpis;
const P12: ItemView = { itemId: 'i12', itemName: 'P12', assetId: 'P12', assetPath: '[default]Mesa/P12', properties: {} };
const UNLINKED: ItemView = { ...P12, assetId: null, assetPath: null };
const NO_ASSET_ROW: ItemView = { ...P12, assetPath: null };
const OWN = { own: true };

function states(path: string): RuleDraft {
    return { ...NO_RULE, type: 'states', sources: { ...NO_RULE.sources, states: { from: 'path', path } }, states: [{ value: '1', preset: 'fault' }] };
}

function state(extra: Partial<ItemState> = {}): ItemState {
    return { commsLost: false, stale: false, alarm: null, iconKpi: null, badge: 'normal', preset: 'normal', ...extra } as ItemState;
}

describe('a rule checked as an item\'s own (T7, T8)', () => {
    test('a full path is taken; a path under {asset.path}, one with no provider and a provider alone are not, in 12c1\'s words', () => {
        expect(checkRule(states('[default]Mesa/P14/Status'), PAD, OWN)).toEqual({
            rule: { source: { path: '[default]Mesa/P14/Status' }, type: 'states', cases: [{ value: 1, preset: 'fault' }] }, missing: [], rows: [] });
        const under = checkRule(states('{asset.path}/Status'), PAD, OWN);
        expect(under.rule).toBeUndefined();
        expect(under.missing).toEqual([OWN_PATH_TEXT]);
        expect(under.path).toBe("an override's tag path is a full path such as [default]Mesa/P12/Pressure, not {asset.path}/Status.");
        expect(checkRule(states('Mesa/X'), PAD, OWN).path).toBe('Mesa/X is not a tag path; use a full path such as [default]Shared/GasPrice.');
        expect(checkRule(states('[default]'), PAD, OWN).rule).toBeUndefined();
        // A kind's rule keeps taking a path under {asset.path}, and says nothing of it.
        const kinds = checkRule(states('{asset.path}/Status'), PAD);
        expect(kinds.rule).toEqual({ source: { path: '{asset.path}/Status' }, type: 'states', cases: [{ value: 1, preset: 'fault' }] });
        expect(kinds.path).toBeUndefined();
    });

    test('an empty path asks for one, with no words beside the field; a key value is taken as it is', () => {
        const empty = checkRule(states('  '), PAD, OWN);
        expect(empty.missing).toEqual(['Type the tag path the rule reads.']);
        expect(empty.path).toBeUndefined();
        const kpi: RuleDraft = { ...states(''), sources: { ...NO_RULE.sources, states: { from: 'kpi', key: 'pressure' } } };
        expect(checkRule(kpi, PAD, OWN).rule).toEqual({ source: { kpi: 'pressure' }, type: 'states', cases: [{ value: 1, preset: 'fault' }] });
    });

    test('an own rule has a type: None is Reset\'s, so it is never sent as a rule; a half-built one says what is missing', () => {
        expect(ownRuleTypes(PAD)).toEqual(['states', 'bands', 'expression']);
        expect(ownRuleTypes(LINE)).toEqual(['states', 'bands', 'expression', 'instruments']);
        expect(ownRuleTypes(FENCE)).toEqual(['states', 'bands', 'expression']);
        expect(checkRule(NO_RULE, PAD, OWN)).toEqual({ missing: ['Pick a rule type.'], rows: [] });
        expect(checkRule(NO_RULE, PAD).rule).toBeNull();
        expect(checkRule(OWN_RULE_EMPTY, PAD, OWN).missing).toEqual(['Pick the value the rule reads.', 'Add a case.']);
        const noPreset: RuleDraft = { ...states('[default]Mesa/P14/Status'), states: [{ value: '1', preset: '' }] };
        expect(checkRule(noPreset, PAD, OWN)).toEqual({ missing: ['Case 1 has no preset.'], rows: [0] });
        expect(checkRule(ruleDraft(INSTRUMENTS), LINE, OWN).rule).toEqual(INSTRUMENTS);
    });

    test('the same rule is the same whatever is stored around it', () => {
        expect(sameRule(ruleDraft(P2_RULE), { expression: P2_RULE.expression, type: 'expression', source: P2_RULE.source }, PAD, OWN)).toBe(true);
        expect(sameRule(ruleDraft(P2_RULE), null, PAD, OWN)).toBe(false);
    });
});

describe('what Override starts from: a copy of the kind\'s rule (T4)', () => {
    test('a path under {asset.path} is filled for this item and the copy is a whole rule', () => {
        const start = ownRuleStart(PAD_RULE, P12);
        expect(checkRule(start, PAD, OWN).rule).toEqual({ ...PAD_RULE, source: { path: '[default]Mesa/P12/Status' } });
        // Every type is offered the filled path, never the kind's own.
        expect(start.sources.bands).toEqual({ from: 'path', path: '[default]Mesa/P12/Status' });
    });

    test('a key value, a full path and the instruments source are copied as they are', () => {
        expect(checkRule(ownRuleStart(LINE_RULE, P12), LINE, OWN).rule).toEqual(LINE_RULE);
        expect(checkRule(ownRuleStart(P2_RULE, P12), PAD, OWN).rule).toEqual(P2_RULE);
        expect(checkRule(ownRuleStart(INSTRUMENTS, P12), LINE, OWN).rule).toEqual(INSTRUMENTS);
    });

    test('an item with no asset, a kind with no rule and a path that cannot be filled start empty: nothing to save yet', () => {
        expect(ownRuleStart(PAD_RULE, UNLINKED)).toBe(OWN_RULE_EMPTY);
        expect(ownRuleStart(LINE_RULE, UNLINKED)).toBe(OWN_RULE_EMPTY);
        expect(ownRuleStart(null, P12)).toBe(OWN_RULE_EMPTY);
        expect(ownRuleStart({ odd: true }, P12)).toBe(OWN_RULE_EMPTY);
        expect(ownRuleStart(PAD_RULE, NO_ASSET_ROW)).toBe(OWN_RULE_EMPTY);
        expect(checkRule(OWN_RULE_EMPTY, PAD, OWN).rule).toBeUndefined();
    });
});

describe('a rule in words (T2)', () => {
    test('States, Bands, an expression, the instruments and none', () => {
        expect(ruleWords(PAD_RULE, KPIS, PAD)).toEqual({ type: 'states', summary: 'States on the tag {asset.path}/Status', expression: '', cases: [
            { label: 'When the value is 1', preset: 'attention' }, { label: 'When the value is 2', preset: 'warning' },
            { label: 'When the value is 3', preset: 'fault' }, { label: 'When the value is 4', preset: 'dimmed' }] });
        expect(ruleWords(LINE_RULE, KPIS, LINE)).toEqual({ type: 'bands', summary: 'Bands on Flow', expression: '', cases: [
            { label: 'Below 50', preset: 'normal' }, { label: 'From 50 up to 200', preset: 'attention' }, { label: 'From 200 up', preset: 'fault' }] });
        expect(ruleWords(P2_RULE, KPIS, PAD)).toEqual({ type: 'expression', summary: 'Expression on the tag [default]Mesa/P14/Pressure',
            expression: P2_RULE.expression, cases: [{ label: 'warning', preset: 'warning' }, { label: 'normal', preset: 'normal' }] });
        expect(ruleWords(INSTRUMENTS, KPIS, LINE).summary).toBe('Each segment takes the worst of the instruments at its ends.');
        expect(ruleWords(null, KPIS, PAD)).toEqual({ type: 'none', summary: 'Well pad has no style rule.', cases: [], expression: '' });
    });
});

describe('the "shows now" line, in the item\'s own words', () => {
    const facts = { kind: PAD, name: 'P12', state: state({ preset: 'fault' }), own: true, rule: 'rule' as const, unsaved: false };

    test('by its own rule or the kind\'s, and when its alarm wins', () => {
        expect(showsNowText(facts)).toBe('Shows now: P12 is Fault by its own rule. An alarm wins over the rule; a stale value shows only as Stale.');
        expect(showsNowText({ ...facts, own: false, state: state() }))
            .toBe('Shows now: P12 is Normal by the well pad rule. An alarm wins over the rule; a stale value shows only as Stale.');
        expect(showsNowText({ ...facts, state: state({ preset: 'fault', alarm: { priority: 1, unacked: true, active: 1, stale: false } }) }))
            .toBe('Shows now: P12 is Fault by its own rule, but its priority 1 alarm wins over the rule.');
    });

    test('stale, comms lost, no values yet, no rule, the instruments, an area, and a rule not saved yet', () => {
        expect(showsNowText({ ...facts, state: state({ stale: true }) })).toBe('Shows now: P12 shows only as Stale until a fresh value comes.');
        expect(showsNowText({ ...facts, state: state({ stale: true, commsLost: true }) })).toBe('Shows now: P12 shows only as Comms lost until a fresh value comes.');
        expect(showsNowText({ ...facts, state: null })).toBe('Shows now: no live values for P12 yet.');
        expect(showsNowText({ ...facts, own: false, rule: 'none', state: null })).toBe('Shows now: P12 draws as Normal. Well pad has no style rule.');
        expect(showsNowText({ ...facts, kind: LINE, name: 'L-SWD', rule: 'instruments' }))
            .toBe('Shows now: by its own rule, each segment of L-SWD takes the worst of the instruments at its ends. An alarm wins over it.');
        expect(showsNowText({ ...facts, kind: FENCE })).toBe('An area draws its category tint, not a preset, so a style rule does not show on P12.');
        expect(showsNowText({ ...facts, unsaved: true })).toMatch(/ The map shows the stored rule until this one is whole\.$/);
        expect(showsNowText({ ...facts, own: false, unsaved: true })).toMatch(/ The map shows the kind's rule until this one is whole\.$/);
        // A kind with no rule has none to show meanwhile.
        expect(showsNowText({ ...facts, own: false, rule: 'none', unsaved: true }))
            .toBe('Shows now: P12 draws as Normal. Well pad has no style rule. The map draws no rule until this one is whole.');
        for (const text of [showsNowText(facts), showsNowText({ ...facts, state: null })]) {
            expect(text).not.toContain(String.fromCharCode(0x2014));
        }
    });
});

describe('the styleRule row of an override (T10, T11)', () => {
    const KPI_ROWS = [{ key: 'pressure', path: '[default]Mesa/P14/Pressure' }];
    const STORED = { comms: { path: '[default]Mesa/P14/Comms', on: true }, kpis: KPI_ROWS, link: '/other' };

    test('only styleRule changes: every other stored part is the same object, set and reset', () => {
        const set = applyRuleEdit(STORED, P2_RULE);
        expect(set).toEqual({ ...STORED, styleRule: P2_RULE });
        expect(set.kpis).toBe(KPI_ROWS);
        expect(set.comms).toBe(STORED.comms);
        expect(Object.keys(set)).toEqual(['comms', 'kpis', 'link', 'styleRule']);
        const reset = applyRuleEdit(set, null);
        expect(reset).toEqual(STORED);
        expect(reset.kpis).toBe(KPI_ROWS);
        expect(applyRuleEdit(null, null)).toEqual({});
    });

    test('an edit that changes nothing returns the newest itself', () => {
        const held = { styleRule: P2_RULE };
        expect(applyRuleEdit(held, { ...P2_RULE })).toBe(held);
        expect(applyRuleEdit(STORED, null)).toBe(STORED);
    });

    test('the item\'s own rule is one the Gateway applies; Undo names the style rule', () => {
        expect(RULE_ROW).toBe('styleRule');
        expect(ownRule({ styleRule: P2_RULE })).toBe(P2_RULE);
        expect(ownRule({ styleRule: INSTRUMENTS })).toBe(INSTRUMENTS);
        expect(ownRule({ styleRule: PAD_RULE })).toBeNull();
        expect(ownRule({ link: '/other' })).toBeNull();
        expect(ownRule(null)).toBeNull();
        expect(ruleLabel(false, 'Point 2')).toBe("change Point 2's style rule");
        expect(ruleLabel(true, 'Point 2')).toBe("reset Point 2's style rule");
    });

    test('a refusal stands beside the part of the rule it names, else in the rule\'s own box with all its words', () => {
        expect(refusalRest('Op 0 (p12): overrides: styleRule.cases[1].preset: Pick a preset.')).toBe('styleRule.cases[1].preset: Pick a preset.');
        expect(ruleRefusalPlace('Op 0 (p12): overrides: styleRule.cases[1].preset: Pick a preset: normal.'))
            .toEqual({ at: Fields.ruleCase(1), words: 'Pick a preset: normal.' });
        // An expression the Gateway cannot read, in its own words (WriteService.checkExpression, "overrides.styleRule"): a dot, no colon.
        const unread = 'the expression could not be read: a style rule may reference {value} only, not {pressure}';
        expect(refusalRest('Op 0 (p12): overrides.styleRule.expression: ' + unread)).toBe('styleRule.expression: ' + unread);
        expect(ruleRefusalPlace('Op 0 (p12): overrides.styleRule.expression: ' + unread)).toEqual({ at: Fields.ruleExpression, words: unread });
        expect(ruleRefusalPlace('Op 0 (p12): overrides: styleRule.expression: ' + unread)).toEqual({ at: Fields.ruleExpression, words: unread });
        expect(ruleRefusalPlace('Op 0 (p12): overrides: styleRule.source.path: an override\'s tag path is a full path.'))
            .toEqual({ at: Fields.ruleSource, words: 'an override\'s tag path is a full path.' });
        expect(ruleRefusalPlace('Editing needs the full editing role.')).toEqual({ at: Fields.styleRule, words: 'Editing needs the full editing role.' });
        expect(ruleRefusalPlace('Op 0 (p12): overrides: comms.path: a tag path is needed.'))
            .toEqual({ at: Fields.styleRule, words: 'comms.path: a tag path is needed.' });
    });
});

// ---- The panel ----

const OK: AdapterStatus = { status: 'ok', message: '', function: 'f', count: 1, left: 0, refreshedAt: null };
const noop = (): void => undefined;

function record(extra: Partial<MapItemRecord> = {}): MapItemRecord {
    return { id: 'p1', kind: 'pad', name: 'P12', geometry: { type: 'Point', coordinates: [-104.97, 39.74] }, properties: {}, assetId: 'P12',
        overrides: {}, ends: null, attachment: null, version: 2, deleted: false, ...extra };
}

function facts(extra: Partial<StyleFacts> = {}): StyleFacts {
    return { kpis: KPIS, kindRule: PAD_RULE, ownRule: null, view: { ...P12, itemId: 'p1' }, state: state(), symbols: {}, colors: null, ...extra };
}

function props(over: Partial<PropertiesPanelProps> = {}): PropertiesPanelProps {
    const item = over.item || record();
    return {
        item, kind: PAD, kinds: [PAD], assets: [], assetNames: [], assetStatus: OK, items: [item], assetRows: [], kindStatus: OK,
        saving: false, newest: item.properties, pending: false, paused: false, autoFocusName: false, onNameFocused: noop, onClose: noop,
        onRename: noop, onMove: noop, canMoveByClick: true, moving: false, onMoveStart: noop, onLink: noop, onKind: noop, onProperty: noop,
        onDelete: noop, toolInHand: false, delKey: true, places: createPlaceSource(() => new Promise(() => undefined)), onZoomTo: noop,
        style: facts(), ...over
    };
}

function panel(over: Partial<PropertiesPanelProps> = {}): string {
    return renderToStaticMarkup(React.createElement(PropertiesPanel, props(over)));
}

/** The opening tag that holds `marker`. */
function tag(html: string, marker: string): string {
    const at = html.indexOf(marker);
    if (at < 0) {
        throw new Error('No ' + marker + ' in the markup.');
    }
    return html.slice(html.lastIndexOf('<', at), html.indexOf('>', at) + 1);
}

/** The Style panel's markup, to the footer. */
function styleOf(html: string): string {
    return html.slice(html.indexOf('class="mapstudio-style"'), html.indexOf('mapstudio-panel-footer'));
}

describe('the two tabs, a real tab list (T1)', () => {
    test('Details and Style: one tab stop, each names its panel, the chosen one underlined and its panel alone shown', () => {
        const html = panel();
        expect(tag(html, 'class="mapstudio-panel-tabs"')).toContain('role="tablist"');
        const details = tag(html, 'data-tab="details"');
        const style = tag(html, 'data-tab="style"');
        for (const a of ['role="tab"', 'aria-selected="true"', 'tabindex="0"', 'aria-controls="mapstudio-panel-p1-details-panel"', 'mapstudio-panel-tab--active']) {
            expect(details).toContain(a);
        }
        for (const a of ['role="tab"', 'aria-selected="false"', 'tabindex="-1"', 'aria-controls="mapstudio-panel-p1-style-panel"']) {
            expect(style).toContain(a);
        }
        expect(style).not.toContain('mapstudio-panel-tab--active');
        expect(tag(html, 'id="mapstudio-panel-p1-details-panel"')).not.toContain('hidden');
        const stylePanel = tag(html, 'id="mapstudio-panel-p1-style-panel"');
        for (const a of ['class="mapstudio-style"', 'role="tabpanel"', 'aria-labelledby="mapstudio-panel-p1-style-tab"', 'hidden=""']) {
            expect(stylePanel).toContain(a);
        }
        const chosen = panel({ tab: 'style' });
        expect(tag(chosen, 'data-tab="style"')).toContain('aria-selected="true"');
        expect(tag(chosen, 'data-tab="details"')).toContain('tabindex="-1"');
        expect(tag(chosen, 'id="mapstudio-panel-p1-details-panel"')).toContain('hidden=""');
        expect(tag(chosen, 'id="mapstudio-panel-p1-style-panel"')).not.toContain('hidden');
    });

    test('the arrow keys, Home and End move between the tabs and wrap; any other key moves nothing', () => {
        expect(PANEL_TABS.map(([t]) => t)).toEqual(['details', 'style']);
        expect(tabForKey('details', 'ArrowRight')).toBe('style');
        expect(tabForKey('style', 'ArrowRight')).toBe('details');
        expect(tabForKey('details', 'ArrowLeft')).toBe('style');
        expect(tabForKey('style', 'ArrowLeft')).toBe('details');
        expect(tabForKey('style', 'Home')).toBe('details');
        expect(tabForKey('details', 'End')).toBe('style');
        expect(tabForKey('details', 'Enter')).toBeNull();
        const chosen: string[] = [];
        const inst = new PropertiesPanel(props({ onTab: (t) => chosen.push(t) }));
        const press = (key: string): boolean => {
            let prevented = false;
            (inst as unknown as { onTabKey(ev: unknown): void }).onTabKey({ key, preventDefault: () => { prevented = true; } });
            return prevented;
        };
        expect(press('ArrowRight')).toBe(true);
        expect(press('Tab')).toBe(false);
        expect(chosen).toEqual(['style']);
    });

    test('an item just placed shows Details, where Name takes the cursor, and the remembered tab is not changed', () => {
        const chosen: string[] = [];
        const html = panel({ tab: 'style', autoFocusName: true, onTab: (t) => chosen.push(t) });
        expect(tag(html, 'data-tab="details"')).toContain('aria-selected="true"');
        expect(tag(html, 'id="mapstudio-panel-p1-details-panel"')).not.toContain('hidden');
        expect(tag(html, 'id="mapstudio-panel-p1-style-panel"')).toContain('hidden=""');
        new PropertiesPanel(props({ tab: 'style', autoFocusName: true, onTab: (t) => chosen.push(t) })).componentDidMount();
        expect(chosen).toEqual([]);
    });
});

describe('the Style tab from the kind (T2)', () => {
    test('Icon, Size and Label read only, each saying where it comes from', () => {
        const html = styleOf(panel({ tab: 'style' }));
        expect((html.match(/data-row="[^"]+"/g) || [])).toEqual(['data-row="icon"', 'data-row="size"', 'data-row="label"']);
        expect(html).toContain('<span class="mapstudio-mono">well-pad</span>');
        expect(html).toContain(STYLE_ICON_HINT.replace(/'/g, '&#x27;'));
        expect(html).toContain(sizeText(PAD).replace(/'/g, '&#x27;'));
        expect(html).toContain(STYLE_SIZE_HINT.replace(/'/g, '&#x27;'));
        expect(html).toContain('<span class="mapstudio-field-text mapstudio-style-value">P12</span>');
        expect(html).toContain(STYLE_LABEL_HINT.replace(/'/g, '&#x27;'));
        // Nothing of them is a control.
        const rows = html.slice(0, html.indexOf('mapstudio-style-rule'));
        expect(rows).not.toMatch(/<input|<select|<button|<textarea/);
        for (const hint of [STYLE_ICON_HINT, STYLE_SIZE_HINT, STYLE_LABEL_HINT]) {
            expect(hint).toContain('comes from the project\'s kind list and is not changed here.');
        }
        expect(sizeText(LINE)).toBe('Its width follows its diameter; a line with no diameter draws thin.');
        expect(sizeText(PAD)).toBe('One size: every point\'s marker is the same size.');
    });

    test('the kind\'s rule in words with a tile per case under "From kind", Edit the kind\'s rule and Override; no editor', () => {
        const html = styleOf(panel({ tab: 'style' }));
        expect(tag(html, 'class="mapstudio-style-rule"')).toContain('data-own="false"');
        expect(html).toMatch(/<h3 class="mapstudio-livenow-heading" id="mapstudio-style-rule-p1">Style rule<\/h3><span class="mapstudio-kindsetup-tag mapstudio-fromkind-tag">From kind<\/span>/);
        expect(tag(html, 'class="mapstudio-style-kindrule"')).toContain('data-rule="states"');
        expect(html).toContain('States on the tag {asset.path}/Status');
        expect((html.match(/class="mapstudio-style-kindcase" data-preset="[a-z]+"/g) || []).map((m) => m.slice(m.indexOf('data-preset'))))
            .toEqual(['data-preset="attention"', 'data-preset="warning"', 'data-preset="fault"', 'data-preset="dimmed"']);
        expect((html.match(/class="mapstudio-rule-tile"/g) || [])).toHaveLength(4);
        expect(html).toMatch(/mapstudio-style-kind"[^>]*>Edit the kind&#x27;s rule</);
        expect(html).toMatch(/mapstudio-style-override"[^>]*>Override</);
        expect(html).not.toContain('mapstudio-override-tag');
        expect(html).not.toContain('mapstudio-style-reset');
        expect(html).not.toContain('class="mapstudio-rule"');
        expect(html).toContain('<div class="mapstudio-style-shows" role="status" aria-live="polite">Shows now: P12 is Normal by the well pad rule.');
        expect(html).not.toContain(String.fromCharCode(0x2014));
    });

    test('a kind with no rule says so; paused, Override takes no input and Edit the kind\'s rule still opens Kinds', () => {
        const none = styleOf(panel({ tab: 'style', style: facts({ kindRule: null }) }));
        expect(tag(none, 'class="mapstudio-style-kindrule"')).toContain('data-rule="none"');
        expect(none).toContain('Well pad has no style rule.');
        expect(none).not.toContain('mapstudio-style-kindcase"');
        const paused = styleOf(panel({ tab: 'style', paused: true }));
        expect(tag(paused, 'mapstudio-style-override')).toContain('disabled');
        expect(tag(paused, 'mapstudio-style-kind"')).not.toContain('disabled');
        expect(panel({ tab: 'style', kind: undefined, style: undefined })).toContain('mapstudio-style-unknown');
    });

    test('a refused Override\'s words stand under the buttons', () => {
        const html = styleOf(panel({ tab: 'style',
            overrideRefusal: { row: RULE_ROW, words: 'Editing needs the full editing role.', path: '', batchId: 'b1', at: Fields.styleRule } }));
        expect(html).toMatch(/mapstudio-style-refusal" role="alert">.*Editing needs the full editing role\./);
        // A path row's refusal is not the rule's.
        expect(styleOf(panel({ tab: 'style', overrideRefusal: { row: 'comms', words: 'no', path: '', batchId: 'b1' } }))).not.toContain('mapstudio-style-refusal');
    });
});

describe('an item\'s own rule in the shared editor (T6, T9)', () => {
    test('Point 2\'s expression: marked Override with Reset, the editor with no None type and no resolve note', () => {
        const html = styleOf(panel({ tab: 'style', style: facts({ ownRule: P2_RULE }) }));
        expect(tag(html, 'class="mapstudio-style-rule"')).toContain('data-own="true"');
        expect(html).toContain('<span class="mapstudio-override-tag">Override</span>');
        expect(html).toMatch(/mapstudio-style-reset"[^>]*>Reset</);
        expect(html).not.toContain('mapstudio-fromkind-tag');
        expect(html).not.toContain('mapstudio-style-kind"');
        expect(html).not.toContain('mapstudio-style-override');
        expect((html.match(/data-type="[a-z]+"/g) || [])).toEqual(['data-type="states"', 'data-type="bands"', 'data-type="expression"']);
        expect(tag(html, 'data-type="expression"')).toContain('aria-pressed="true"');
        expect(html).toContain('if({value} &gt; 600, &#x27;warning&#x27;, &#x27;normal&#x27;)</textarea>');
        expect(tag(html, 'class="mapstudio-input mapstudio-kindsetup-input mapstudio-mono mapstudio-rule-path"')).toContain('value="[default]Mesa/P14/Pressure"');
        expect(html).not.toContain('mapstudio-resolve-note');
        expect(html).not.toContain('mapstudio-rule-unsaved');
        expect(html).toContain('Shows now: P12 is Normal by its own rule.');
    });

    test('a line that is not an area is offered From its instruments; L-SWD\'s is chosen', () => {
        const item = record({ id: 'l1', kind: 'line', name: 'L-SWD', geometry: { type: 'LineString', coordinates: [[-105, 39.7], [-104.9, 39.7]] } });
        const html = styleOf(panel({ tab: 'style', item, kind: LINE, style: facts({ kindRule: LINE_RULE, ownRule: INSTRUMENTS }) }));
        expect(tag(html, 'data-type="instruments"')).toContain('aria-pressed="true"');
        expect(html).toContain('Each segment takes the worst of the instruments at its ends.');
        expect(html).toContain('<span class="mapstudio-override-tag">Override</span>');
        const area = styleOf(panel({ tab: 'style', item, kind: FENCE, style: facts({ ownRule: P2_RULE }) }));
        expect(area).not.toContain('data-type="instruments"');
    });

    test('a refusal stands beside the part of the rule it names; paused, the editor and Reset take no input', () => {
        const refused = styleOf(panel({ tab: 'style', style: facts({ ownRule: P2_RULE }),
            overrideRefusal: { row: RULE_ROW, words: 'the expression could not be read: x', path: '', batchId: 'b1', at: Fields.ruleExpression } }));
        const expression = refused.slice(refused.indexOf('data-field="styleRule.expression"'));
        expect(expression).toMatch(/^[^]*?<span[^>]*class="mapstudio-field-refusal" role="alert" data-at="styleRule\.expression">/);
        expect(refused).toContain('the expression could not be read: x');
        const paused = styleOf(panel({ tab: 'style', paused: true, style: facts({ ownRule: P2_RULE }) }));
        expect(tag(paused, 'mapstudio-style-reset')).toContain('disabled');
        expect(tag(paused, 'data-type="states"')).toContain('disabled');
    });

    test('Override saves a whole copy at once; one that starts empty opens the editor and sends nothing; Reset sends null', () => {
        const sent: Array<Record<string, unknown> | null> = [];
        const take = (rule: Record<string, unknown> | null): boolean => sent.push(rule) > 0;
        const whole = new PropertiesPanel(props({ onStyleRule: take }));
        const states: Array<Record<string, unknown>> = [];
        whole.setState = ((s: Record<string, unknown>) => states.push(s)) as typeof whole.setState;
        (whole as unknown as { onOverrideRule(): void }).onOverrideRule();
        expect(sent).toEqual([{ ...PAD_RULE, source: { path: '[default]Mesa/P12/Status' } }]);
        expect(states).toEqual([]);
        const empty = new PropertiesPanel(props({ onStyleRule: take, style: facts({ view: { ...UNLINKED, itemId: 'p1' } }) }));
        empty.setState = ((s: Record<string, unknown>) => states.push(s)) as typeof empty.setState;
        (empty as unknown as { onOverrideRule(): void }).onOverrideRule();
        expect(sent).toHaveLength(1);
        expect(states).toEqual([{ ruleStart: OWN_RULE_EMPTY }]);
        (empty as unknown as { onResetRule(): void }).onResetRule();
        expect(sent[1]).toBeNull();
        // Paused, nothing is sent.
        const paused = new PropertiesPanel(props({ paused: true, onStyleRule: take }));
        (paused as unknown as { onOverrideRule(): void }).onOverrideRule();
        (paused as unknown as { onResetRule(): void }).onResetRule();
        expect(sent).toHaveLength(2);
    });
});

describe('the shared editor (T12): what it draws, and what it sends', () => {
    function editor(over: Partial<React.ComponentProps<typeof RuleEditor>> = {}): RuleEditor {
        return new RuleEditor({ kind: PAD, kpis: KPIS, stored: P2_RULE, version: 4, off: false, idBase: 'x', refusals: [], refused: false, saving: false,
            done: 0, onSend: () => true, onClearRefusal: noop, ...over });
    }

    test('the fields a draft draws: the box always, the value and the rows of the chosen type', () => {
        expect(ruleFields(NO_RULE)).toEqual([Fields.styleRule]);
        expect(ruleFields(ruleDraft(INSTRUMENTS))).toEqual([Fields.styleRule]);
        expect(ruleFields(ruleDraft(PAD_RULE))).toEqual([Fields.styleRule, Fields.ruleSource, Fields.ruleCase(0), Fields.ruleCase(1), Fields.ruleCase(2),
            Fields.ruleCase(3)]);
        expect(ruleFields(ruleDraft(P2_RULE))).toEqual([Fields.styleRule, Fields.ruleSource, Fields.ruleExpression]);
    });

    test('with no draft it shows the stored rule; an own rule\'s half-built draft is not sent, a whole one is, at its version', () => {
        expect(editor().draft()).toEqual(ruleDraft(P2_RULE));
        const sent: Array<[Record<string, unknown> | null, number | null]> = [];
        const own = editor({ own: true, stored: null, initial: OWN_RULE_EMPTY, onSend: (rule, base) => { sent.push([rule, base]); return true; } });
        expect(own.draft()).toBe(OWN_RULE_EMPTY);
        (own as unknown as { commitRule(): void }).commitRule();
        expect(sent).toEqual([]);
        (own as unknown as { state: { rule: RuleDraft } }).state = { rule: states('{asset.path}/Status') };
        (own as unknown as { commitRule(): void }).commitRule();
        expect(sent).toEqual([]);
        (own as unknown as { state: { rule: RuleDraft } }).state = { rule: states('[default]Mesa/P14/Status') };
        (own as unknown as { commitRule(): void }).commitRule();
        expect(sent).toEqual([[{ source: { path: '[default]Mesa/P14/Status' }, type: 'states', cases: [{ value: 1, preset: 'fault' }] }, 4]]);
        // On its way: the same rule is not sent twice.
        (own as unknown as { commitRule(): void }).commitRule();
        expect(sent).toHaveLength(1);
    });

    test('a kind\'s None removes the rule; an own rule never sends None', () => {
        const sent: Array<Record<string, unknown> | null> = [];
        const kinds = editor({ onSend: (rule) => { sent.push(rule); return true; } });
        (kinds as unknown as { state: { rule: RuleDraft } }).state = { rule: NO_RULE };
        (kinds as unknown as { commitRule(): void }).commitRule();
        expect(sent).toEqual([null]);
        const own = editor({ own: true, onSend: (rule) => { sent.push(rule); return true; } });
        (own as unknown as { state: { rule: RuleDraft } }).state = { rule: NO_RULE };
        (own as unknown as { commitRule(): void }).commitRule();
        expect(sent).toHaveLength(1);
    });
});
