// The Style tab and an item's own style rule (epic 4 entry 12c2, R5, R15): the rule checked as an item's own (a type, a full
// path, 12c1's words; T7, T8), the copy of the kind's rule Override starts from (T4), a rule in words (T2), the "shows now"
// line, the `styleRule` row of an override with every other stored part untouched (T11), its Undo words (T10) and a refusal's
// place; then the panel as drawn: the two tabs as a tab list (T1), the read-only rows and the kind's rule under "From kind" (T2),
// an own rule in the shared editor under Override with Reset (T6, T9), and the editor shared with Kinds' section 6 (T12).
// Entry 12c3 (the tab reordered, its words made plain, its flow mended): the order (U1), the action and own-rule lines (U2), the
// Live now line (U3), a half-built rule kept when the panel goes (U4), Esc inside a rule not saved (U5), Enter keeping the
// field (U6), Override by what the kind's rule needs (U10) and the selects in the tiles' words (U11).
import { METRIC_UNITS } from '../geometry';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdapterStatus, Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { RULE_ROW, applyRuleEdit, ownRule, refusalRest, ruleLabel } from '../itemOverrides';
import {
    Fields, KeyValue, NO_RULE, OWN_PATH_TEXT, OWN_RULE_EMPTY, RuleDraft, UNSAVED_KEEPS, checkRule, overrideLineText, ownLineText, ownRuleStart,
    draftSource, withSource, ownRuleTypes, presetWord, readSetup, ruleDraft, ruleRefusalPlace, ruleWords, sameRule, showsNowText, unsavedText
} from '../kindSetup';
import { ItemState } from '../live';
import { ItemView } from '../placeholders';
import { createPlaceSource } from '../placeCheck';
import {
    PANEL_TABS, PropertiesPanel, PropertiesPanelProps, STYLE_FROM_KIND_HINT, StyleFacts, sizeText, tabForKey
} from '../studio/PropertiesPanel';
import { RuleEditor, RuleKeep, ruleFields } from '../studio/RuleEditor';

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

    test('a kind with no rule and a path that cannot be filled start empty: nothing to save yet', () => {
        expect(ownRuleStart(PAD_RULE, UNLINKED)).toBe(OWN_RULE_EMPTY);
        expect(ownRuleStart(null, P12)).toBe(OWN_RULE_EMPTY);
        expect(ownRuleStart({ odd: true }, P12)).toBe(OWN_RULE_EMPTY);
        expect(ownRuleStart(PAD_RULE, NO_ASSET_ROW)).toBe(OWN_RULE_EMPTY);
        expect(checkRule(OWN_RULE_EMPTY, PAD, OWN).rule).toBeUndefined();
    });
});

describe('U10: an unlinked item\'s Override, by what the kind\'s rule needs (the owner\'s ruling on 12c2)', () => {
    test('From its instruments, a key value and a full path are copied whole, so they save at once', () => {
        expect(checkRule(ownRuleStart(INSTRUMENTS, UNLINKED), LINE, OWN).rule).toEqual(INSTRUMENTS);
        expect(checkRule(ownRuleStart(LINE_RULE, UNLINKED), LINE, OWN).rule).toEqual(LINE_RULE);
        expect(checkRule(ownRuleStart(P2_RULE, UNLINKED), PAD, OWN).rule).toEqual(P2_RULE);
    });

    test('only a path under {asset.path} has nothing to fill from: it starts empty', () => {
        expect(ownRuleStart(PAD_RULE, UNLINKED)).toBe(OWN_RULE_EMPTY);
        expect(checkRule(ownRuleStart(PAD_RULE, UNLINKED), PAD, OWN).rule).toBeUndefined();
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
            expression: P2_RULE.expression, cases: [{ label: 'Warning', preset: 'warning' }, { label: 'Normal', preset: 'normal' }] });
        expect(ruleWords(INSTRUMENTS, KPIS, LINE).summary).toBe('Each segment takes the worst of the instruments at its ends.');
        expect(ruleWords(null, KPIS, PAD)).toEqual({ type: 'none', summary: 'Well pad has no style rule.', cases: [], expression: '' });
    });

    test('12c3: for an item, a path under {asset.path} is said filled for it; one that cannot be filled is said as written', () => {
        expect(ruleWords(PAD_RULE, KPIS, PAD, P12).summary).toBe('States on the tag [default]Mesa/P12/Status');
        expect(ruleWords(PAD_RULE, KPIS, PAD, UNLINKED).summary).toBe('States on the tag {asset.path}/Status');
        expect(ruleWords(P2_RULE, KPIS, PAD, P12).summary).toBe('Expression on the tag [default]Mesa/P14/Pressure');
        expect(ruleWords(LINE_RULE, KPIS, LINE, P12).summary).toBe('Bands on Flow');
    });

    test('U11: a preset in the tiles\' words; what is stored is its name', () => {
        expect(['normal', 'attention', 'warning', 'fault', 'dimmed', 'solid', 'dashed', 'dotted'].map(presetWord))
            .toEqual(['Normal', 'Attention', 'Warning', 'Fault', 'Out of service', 'Solid', 'Dashed', 'Dotted']);
        expect(presetWord('odd')).toBe('odd');
    });
});

describe('U3: the Live now line, one line', () => {
    const facts = { kind: PAD, name: 'P12', state: state({ preset: 'fault' }), own: true, rule: 'rule' as const };

    test('"<name> is <state word>, by the <kind> rule." or "by its own rule."', () => {
        expect(showsNowText(facts)).toBe('P12 is Fault, by its own rule.');
        expect(showsNowText({ ...facts, own: false, state: state() })).toBe('P12 is Normal, by the well pad rule.');
        expect(showsNowText({ ...facts, state: state({ preset: 'dimmed' }) })).toBe('P12 is Out of service, by its own rule.');
    });

    test('the alarm, Stale and Comms lost words only when they are true', () => {
        expect(showsNowText({ ...facts, state: state({ preset: 'fault', alarm: { priority: 1, unacked: true, active: 1, stale: false } }) }))
            .toBe('P12 is Fault, by its own rule. Its priority 1 alarm shows over it.');
        expect(showsNowText({ ...facts, state: state({ stale: true }) })).toBe('P12 shows only as Stale until a fresh value comes.');
        expect(showsNowText({ ...facts, state: state({ stale: true, commsLost: true }) })).toBe('P12 shows only as Comms lost until a fresh value comes.');
        for (const text of [showsNowText(facts), showsNowText({ ...facts, own: false, state: state() })]) {
            expect(text).not.toMatch(/alarm|Stale|Comms lost/);
        }
    });

    test('no values yet, no rule, the instruments and an area; never the words of a rule not saved, and no em dash', () => {
        expect(showsNowText({ ...facts, state: null })).toBe('No live values for P12 yet.');
        expect(showsNowText({ ...facts, own: false, rule: 'none', state: null })).toBe('P12 is Normal. Well pad has no style rule.');
        expect(showsNowText({ ...facts, own: false, rule: 'none', state: state({ alarm: { priority: 2, unacked: false, active: 1, stale: false } }) }))
            .toBe('P12 is Normal. Well pad has no style rule. Its priority 2 alarm shows over it.');
        expect(showsNowText({ ...facts, kind: LINE, name: 'L-SWD', rule: 'instruments' }))
            .toBe('Each segment of L-SWD takes the worst of the instruments at its ends, by its own rule.');
        expect(showsNowText({ ...facts, kind: FENCE })).toBe('An area draws its category tint, not a preset, so a style rule does not show on P12.');
        for (const text of [showsNowText(facts), showsNowText({ ...facts, state: null })]) {
            expect(text).not.toContain(String.fromCharCode(0x2014));
            expect(text).not.toContain('whole');
        }
    });
});

describe('U2: the lines that say in view what each action does', () => {
    test('from the kind: what Override and Edit the kind\'s rule do; an Override that starts empty does not say "saved at once"', () => {
        expect(overrideLineText('P12', PAD, true)).toBe('Override gives P12 its own copy, saved at once. Edit the kind\'s rule changes every well pad.');
        expect(overrideLineText('Style pad', PAD, false))
            .toBe('Override gives Style pad its own rule, saved once it is complete. Edit the kind\'s rule changes every well pad.');
    });

    test('overridden: whose the rule is and how it saves; "Not saved yet" gives the reason first, then what the map keeps', () => {
        expect(ownLineText('P12')).toBe('For P12 only. Changes save as you make them.');
        expect(UNSAVED_KEEPS).toBe('The map keeps the saved rule until then.');
        expect(unsavedText(['Case 5 has no preset.'], UNSAVED_KEEPS)).toBe('Not saved yet. Case 5 has no preset. The map keeps the saved rule until then.');
        expect(unsavedText([], UNSAVED_KEEPS)).toBe('');
        for (const text of [overrideLineText('P12', PAD, true), overrideLineText('P12', PAD, false), ownLineText('P12'), UNSAVED_KEEPS]) {
            expect(text).not.toContain('whole');
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
        item, kind: PAD, kinds: [PAD], units: METRIC_UNITS, assets: [], assetNames: [], assetStatus: OK, items: [item], assetRows: [], kindStatus: OK,
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

describe('the Style tab from the kind (T2, U1, U2)', () => {
    test('U1: the order, top to bottom: the heading with its tag, Live now, the rule, the actions with their line, then From kind', () => {
        const html = styleOf(panel({ tab: 'style' }));
        const at = ['mapstudio-style-rule-head', 'mapstudio-style-live', 'mapstudio-style-kindrule', 'mapstudio-style-actions', 'mapstudio-style-line',
            'mapstudio-style-fromkind'].map((c) => html.indexOf(c));
        expect(at.every((n) => n >= 0)).toBe(true);
        expect(at.slice().sort((a, b) => a - b)).toEqual(at);
        // The rule's section is named by its heading and described by its tag.
        const section = tag(html, 'class="mapstudio-style-rule"');
        expect(section).toContain('aria-labelledby="mapstudio-style-rule-p1"');
        expect(section).toContain('aria-describedby="mapstudio-style-rule-p1-tag"');
        expect(html).toMatch(/<h3 class="mapstudio-livenow-heading" id="mapstudio-style-rule-p1">Style rule<\/h3><span id="mapstudio-style-rule-p1-tag" class="mapstudio-style-tag mapstudio-kindsetup-tag mapstudio-fromkind-tag">From kind<\/span>/);
    });

    test('From kind, the foot: the icon and the size in one line with one hint; no Label row, and nothing of it a control', () => {
        const html = styleOf(panel({ tab: 'style' }));
        const foot = html.slice(html.indexOf('class="mapstudio-style-fromkind"'));
        expect((foot.match(/data-row="[^"]+"/g) || [])).toEqual(['data-row="icon"', 'data-row="size"']);
        expect(html).not.toContain('data-row="label"');
        expect(html).not.toContain('mapstudio-style-row');
        expect(foot).toContain('<span class="mapstudio-mono">well-pad</span>');
        expect(foot).toContain('One size');
        expect((foot.match(/class="mapstudio-field-hint"/g) || [])).toHaveLength(1);
        expect(foot).toContain(STYLE_FROM_KIND_HINT.replace(/'/g, '&#x27;'));
        expect(foot).not.toMatch(/<input|<select|<button|<textarea/);
        expect(STYLE_FROM_KIND_HINT).toBe('The icon and the size come from the project\'s kind list and are not changed here.');
        expect(sizeText(LINE)).toBe('Width by diameter');
        expect(sizeText(PAD)).toBe('One size');
        expect(sizeText(FENCE)).toBe('One outline');
    });

    test('the kind\'s rule: its sentence filled for the item, a line per case with its tile and words and no code name; no editor', () => {
        const html = styleOf(panel({ tab: 'style' }));
        expect(tag(html, 'class="mapstudio-style-rule"')).toContain('data-own="false"');
        expect(tag(html, 'class="mapstudio-style-kindrule"')).toContain('data-rule="states"');
        expect(html).toContain('States on the tag [default]Mesa/P12/Status');
        expect((html.match(/class="mapstudio-style-kindcase" data-preset="[a-z]+"/g) || []).map((m) => m.slice(m.indexOf('data-preset'))))
            .toEqual(['data-preset="attention"', 'data-preset="warning"', 'data-preset="fault"', 'data-preset="dimmed"']);
        expect((html.match(/class="mapstudio-rule-tile"/g) || [])).toHaveLength(4);
        expect((html.match(/class="mapstudio-style-kindcase-preset">([^<]+)</g) || []).map((m) => m.slice(m.indexOf('>') + 1, -1)))
            .toEqual(['Attention', 'Warning', 'Fault', 'Out of service']);
        const cases = html.slice(html.indexOf('mapstudio-style-kindcases'), html.indexOf('mapstudio-style-actions'));
        expect(cases).not.toContain('mapstudio-mono');
        expect(cases).not.toContain('>dimmed<');
        // The word is said beside the tile, once.
        expect(cases).not.toContain('mapstudio-rule-word');
        expect(html).not.toContain('mapstudio-override-tag');
        expect(html).not.toContain('mapstudio-style-reset');
        expect(html).not.toContain('class="mapstudio-rule"');
        expect(html).not.toContain(String.fromCharCode(0x2014));
    });

    test('U2, U3: Live now, one line; Override the one bordered button, the kind\'s rule a text link, and one line in view for both', () => {
        const html = styleOf(panel({ tab: 'style' }));
        expect(html).toContain('<span class="mapstudio-field-label mapstudio-style-live-label">Live now</span>'
            + '<span class="mapstudio-style-shows" role="status" aria-live="polite">P12 is Normal, by the well pad rule.</span>');
        expect(html).toMatch(/class="mapstudio-button mapstudio-style-override"[^>]*>Override</);
        expect(html).toMatch(/class="mapstudio-style-link mapstudio-style-kind"[^>]*>Edit the kind&#x27;s rule</);
        expect((html.match(/class="mapstudio-button/g) || [])).toHaveLength(1);
        const line = 'Override gives P12 its own copy, saved at once. Edit the kind&#x27;s rule changes every well pad.';
        expect(html).toContain('<span id="mapstudio-style-rule-p1-line" class="mapstudio-field-hint mapstudio-style-line">' + line + '</span>');
        for (const control of ['mapstudio-style-override"', 'mapstudio-style-kind"']) {
            expect(tag(html, control)).toContain('aria-describedby="mapstudio-style-rule-p1-line"');
            // What it does is said in view, not in hover text.
            expect(tag(html, control)).not.toContain('title=');
        }
        // An unlinked pad whose kind reads a path under {asset.path} has nothing to copy: the line does not say "saved at once".
        const unlinked = styleOf(panel({ tab: 'style', style: facts({ view: { ...UNLINKED, itemId: 'p1' } }) }));
        expect(unlinked).toContain('Override gives P12 its own rule, saved once it is complete.');
        expect(unlinked).toContain('States on the tag {asset.path}/Status');
    });

    test('a kind with no rule says so; paused, Override takes no input and Edit the kind\'s rule still opens Kinds', () => {
        const none = styleOf(panel({ tab: 'style', style: facts({ kindRule: null }) }));
        expect(tag(none, 'class="mapstudio-style-kindrule"')).toContain('data-rule="none"');
        expect(none).toContain('Well pad has no style rule.');
        expect(none).not.toContain('mapstudio-style-kindcase"');
        expect(none).toContain('P12 is Normal. Well pad has no style rule.');
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
        expect(html).toContain('<span id="mapstudio-style-rule-p1-tag" class="mapstudio-style-tag mapstudio-override-tag">Override</span>');
        expect(html).toMatch(/mapstudio-style-reset"[^>]*>Reset</);
        expect(html).not.toContain('mapstudio-fromkind-tag');
        expect(html).not.toContain('mapstudio-style-override');
        expect((html.match(/data-type="[a-z]+"/g) || [])).toEqual(['data-type="states"', 'data-type="bands"', 'data-type="expression"']);
        expect(tag(html, 'data-type="expression"')).toContain('aria-pressed="true"');
        expect(html).toContain('if({value} &gt; 600, &#x27;warning&#x27;, &#x27;normal&#x27;)</textarea>');
        expect(tag(html, 'class="mapstudio-input mapstudio-kindsetup-input mapstudio-mono mapstudio-rule-path"')).toContain('value="[default]Mesa/P14/Pressure"');
        expect(html).not.toContain('mapstudio-resolve-note');
        // The note is mounted with no words: a stored rule is complete.
        expect(html).toMatch(/class="mapstudio-rule-unsaved" role="status" data-unsaved="false"><\/span>/);
        expect(html).toContain('P12 is Normal, by its own rule.');
    });

    test('U1, U2 overridden: the same order, the own-rule line and a link to the kind\'s rule; the Live now line is the same node', () => {
        const html = styleOf(panel({ tab: 'style', style: facts({ ownRule: P2_RULE }) }));
        const at = ['mapstudio-style-rule-head', 'mapstudio-style-live', 'mapstudio-rule"', 'mapstudio-style-own-note', 'mapstudio-style-actions',
            'mapstudio-style-fromkind"'].map((c) => html.indexOf(c));
        expect(at.every((n) => n >= 0)).toBe(true);
        expect(at.slice().sort((a, b) => a - b)).toEqual(at);
        expect(html).toContain('>For P12 only. Changes save as you make them.</span>');
        expect(html).toMatch(/class="mapstudio-style-link mapstudio-style-kind"[^>]*>Open the kind&#x27;s rule</);
        expect(html).not.toContain('whole');
        // The status line stands at the same place in the section, from the kind or overridden: one node, only its words changing.
        const before = (h: string): string => h.slice(h.indexOf('mapstudio-style-rule-head'), h.indexOf('mapstudio-style-shows')).replace(/<[^>]*>[^<]*/g, (m) => m.slice(1, m.search(/[ >]/)) + ' ');
        expect(before(html).split(' ').slice(0, 3)).toEqual(before(styleOf(panel({ tab: 'style' }))).split(' ').slice(0, 3));
    });

    test('a line that is not an area is offered From its instruments; L-SWD\'s is chosen', () => {
        const item = record({ id: 'l1', kind: 'line', name: 'L-SWD', geometry: { type: 'LineString', coordinates: [[-105, 39.7], [-104.9, 39.7]] } });
        const html = styleOf(panel({ tab: 'style', item, kind: LINE, style: facts({ kindRule: LINE_RULE, ownRule: INSTRUMENTS }) }));
        expect(tag(html, 'data-type="instruments"')).toContain('aria-pressed="true"');
        expect(html).toContain('Each segment takes the worst of the instruments at its ends.');
        expect(html).toContain('mapstudio-override-tag">Override</span>');
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

    test('U10: Override on an unlinked line whose kind\'s rule is From its instruments saves at once', () => {
        const sent: Array<Record<string, unknown> | null> = [];
        const item = record({ id: 'l1', kind: 'line', name: 'L-9', assetId: null, geometry: { type: 'LineString', coordinates: [[-105, 39.7], [-104.9, 39.7]] } });
        const line = new PropertiesPanel(props({ item, kind: LINE, onStyleRule: (rule) => sent.push(rule) > 0,
            style: facts({ kindRule: INSTRUMENTS, view: { ...UNLINKED, itemId: 'l1' } }) }));
        const states: unknown[] = [];
        line.setState = ((s: unknown) => states.push(s)) as typeof line.setState;
        (line as unknown as { onOverrideRule(): void }).onOverrideRule();
        expect(sent).toEqual([INSTRUMENTS]);
        expect(states).toEqual([]);
    });
});

describe('U4: a half-built own rule is kept per item when its panel goes', () => {
    const half: RuleDraft = { ...states('[default]Mesa/P14/Status'), states: [{ value: '1', preset: 'fault' }, { value: '5', preset: '' }] };
    const KEEP: RuleKeep = { draft: half, base: 2, stepStored: JSON.stringify(P2_RULE), paths: {} };

    test('the panel going hands the editor\'s draft up, and nothing when there is none', () => {
        const kept: Array<[string, RuleKeep | null]> = [];
        const inst = new PropertiesPanel(props({ onRuleKeep: (id, keep) => kept.push([id, keep]) }));
        (inst as unknown as { ruleEditor: { current: unknown } }).ruleEditor = { current: { keep: () => KEEP } };
        inst.componentWillUnmount();
        const none = new PropertiesPanel(props({ onRuleKeep: (id, keep) => kept.push([id, keep]) }));
        none.componentWillUnmount();
        expect(kept).toEqual([['p1', KEEP], ['p1', null]]);
    });

    test('the item\'s panel back: the draft as left, still "Not saved yet", the reason first, then what the map keeps', () => {
        const html = styleOf(panel({ tab: 'style', style: facts({ ownRule: P2_RULE }), ruleKeep: KEEP }));
        expect(tag(html, 'data-type="states"')).toContain('aria-pressed="true"');
        expect((html.match(/class="mapstudio-rule-case"/g) || [])).toHaveLength(2);
        expect(html).toContain('mapstudio-rule-value" value="5"');
        expect(html).toMatch(/class="mapstudio-rule-unsaved" role="status" data-unsaved="true">Not saved yet\. Case 2 has no preset\. The map keeps the saved rule until then\.<\/span>/);
        // One note box, no second: the Live now line and the own-rule line are plain lines.
        expect((html.match(/Not saved yet/g) || [])).toHaveLength(1);
        expect(html).toContain('P12 is Normal, by its own rule.');
    });

    test('a kept rule that was never stored opens its editor again, the item still from its kind', () => {
        const html = styleOf(panel({ tab: 'style', ruleKeep: { ...KEEP, stepStored: 'null' } }));
        const section = tag(html, 'class="mapstudio-style-rule"');
        expect(section).toContain('data-own="false"');
        expect(section).toContain('data-editing="true"');
        expect(html).toContain('mapstudio-fromkind-tag">From kind</span>');
        expect(html).toMatch(/mapstudio-style-keep"[^>]*>Keep the kind&#x27;s rule</);
        expect(html).toContain('Not saved yet. Case 2 has no preset. The map keeps the saved rule until then.');
    });

    test('the editor keeps only a draft that says "Not saved yet", and takes it back in step with the store as it was', () => {
        const sent: Array<[Record<string, unknown> | null, number | null]> = [];
        const make = (over: Partial<React.ComponentProps<typeof RuleEditor>>): RuleEditor => new RuleEditor({ kind: PAD, kpis: KPIS, stored: P2_RULE,
            version: 7, off: false, idBase: 'x', refusals: [], refused: false, saving: false, done: 0, onClearRefusal: noop, own: true,
            onSend: (rule, base) => { sent.push([rule, base]); return true; }, ...over });
        const untouched = make({});
        expect(untouched.keep()).toBeNull();
        expect(untouched.unsaved()).toBe(false);
        const back = make({ kept: KEEP });
        expect(back.draft()).toBe(half);
        expect(back.unsaved()).toBe(true);
        expect(back.keep()).toEqual({ draft: half, base: 7, stepStored: KEEP.stepStored, paths: {} });
        // Finished, it goes at the item's version now: the stored rule is the one it was left with, whatever else was edited.
        (back as unknown as { state: { rule: RuleDraft } }).state = { rule: { ...half, states: [half.states[0], { value: '5', preset: 'warning' }] } };
        (back as unknown as { commitRule(): void }).commitRule();
        // On its way: nothing of it is kept.
        expect(back.keep()).toBeNull();
        expect(sent).toHaveLength(1);
        expect(sent[0][1]).toBe(7);
        // Another editor stored a rule meanwhile: it goes at the version it was built on, and meets the conflict.
        const stale = make({ kept: KEEP, stored: PAD_RULE });
        (stale as unknown as { state: { rule: RuleDraft } }).state = { rule: { ...half, states: [half.states[0], { value: '5', preset: 'warning' }] } };
        (stale as unknown as { commitRule(): void }).commitRule();
        expect(sent[1][1]).toBe(2);
    });
});

describe('U5, U6: the keyboard keeps its place', () => {
    function esc(inst: PropertiesPanel, target: unknown, key = 'Escape'): boolean {
        let stopped = false;
        (inst as unknown as { onStyleKey(ev: unknown): void }).onStyleKey({ key, target, stopPropagation: () => { stopped = true; } });
        return stopped;
    }
    const inRule = (tagName: string, inEditor = true): unknown => ({ tagName, type: 'text',
        closest: (sel: string) => (sel === '.mapstudio-style-rule' || (inEditor && sel === '.mapstudio-rule') ? {} : null) });
    const outside = { tagName: 'BUTTON', closest: () => null };

    test('U5: Esc on a button of a rule that is not saved never reaches the panel\'s close; saved, it does', () => {
        const inst = new PropertiesPanel(props());
        const ref = inst as unknown as { ruleEditor: { current: unknown } };
        ref.ruleEditor = { current: { unsaved: () => true } };
        expect(esc(inst, inRule('BUTTON'))).toBe(true);
        expect(esc(inst, inRule('BUTTON', false))).toBe(true);
        expect(esc(inst, outside)).toBe(false);
        expect(esc(inst, inRule('BUTTON'), 'Enter')).toBe(false);
        ref.ruleEditor = { current: { unsaved: () => false } };
        expect(esc(inst, inRule('BUTTON'))).toBe(false);
        // A typed field of the rule keeps its Esc whether or not the rule is saved (12c2).
        expect(esc(inst, inRule('INPUT'))).toBe(true);
        expect(esc(inst, inRule('SELECT'))).toBe(true);
        ref.ruleEditor = { current: null };
        expect(esc(inst, inRule('BUTTON'))).toBe(false);
    });

    test('U8: with the cursor in the rule, a stored rule changed by an Undo shows in the editor; another editor\'s waits for the cursor to leave', () => {
        const other = { ...P2_RULE, expression: "if({value} > 1, 'fault', 'normal')" };
        const held = globalThis as unknown as { document?: unknown };
        const before = held.document;
        // The cursor rests on a button of the rule.
        const button = { tagName: 'BUTTON' };
        held.document = { activeElement: button };
        try {
            const run = (undoing: boolean, typed: boolean): RuleDraft | null => {
                const base = { kind: PAD, kpis: KPIS, stored: P2_RULE as Record<string, unknown>, version: 4, off: false, idBase: 'x', refusals: [], refused: false,
                    saving: false, done: 0, onClearRefusal: noop, own: true, onSend: () => true };
                const ed = new RuleEditor(base);
                const inner = ed as unknown as { state: { rule: RuleDraft | null }; props: unknown; ruleBox: { current: unknown }; typed: boolean };
                inner.state = { rule: ruleDraft(P2_RULE) };
                inner.ruleBox = { current: { contains: (el: unknown) => el === button, querySelectorAll: () => [], querySelector: () => null } };
                inner.typed = typed;
                let folded: RuleDraft | null = null;
                ed.setState = ((next: { rule: RuleDraft }) => { folded = next.rule; }) as typeof ed.setState;
                inner.props = { ...base, stored: other, version: 5, undoing };
                ed.componentDidUpdate();
                return folded;
            };
            expect(run(false, false)).toBeNull();
            expect(run(true, false)).toEqual(ruleDraft(other));
            // Keystrokes not yet finished are never replaced under the cursor.
            expect(run(true, true)).toBeNull();
        } finally {
            held.document = before;
        }
    });

    test('a complete rule that is not saved (refused, its conflict waiting, or not taken) is not saved too: kept, and Esc stays', () => {
        const whole = states('[default]Mesa/P14/Status');
        const make = (over: Partial<React.ComponentProps<typeof RuleEditor>>): RuleEditor => {
            const ed = new RuleEditor({ kind: PAD, kpis: KPIS, stored: P2_RULE, version: 4, off: false, idBase: 'x', refusals: [], refused: false,
                saving: false, done: 0, onClearRefusal: noop, own: true, onSend: () => true, ...over });
            (ed as unknown as { state: { rule: RuleDraft } }).state = { rule: whole };
            return ed;
        };
        // Refused by the Gateway, or its conflict card standing.
        expect(make({ refused: true }).unsaved()).toBe(true);
        expect(make({ refused: true, saving: true }).keep()).not.toBeNull();
        // Complete and not what is stored, nothing on its way (the save was not taken).
        expect(make({}).keep()).toEqual({ draft: whole, base: null, stepStored: null, paths: {} });
        // On its way: it will be saved, so it is not kept.
        expect(make({ saving: true }).unsaved()).toBe(false);
        // What is stored is saved.
        expect(make({ stored: checkRule(whole, PAD, OWN).rule as Record<string, unknown> }).unsaved()).toBe(false);
        // Back on the item, it says it was not saved until it is changed.
        const html = styleOf(panel({ tab: 'style', style: facts({ ownRule: P2_RULE }), ruleKeep: { draft: whole, base: 2, stepStored: JSON.stringify(P2_RULE), paths: {} } }));
        expect(html).toContain('data-unsaved="true">Not saved yet. Change the rule to try again.</span>');
    });

    test('a conflict waiting for its card: the other editor\'s rule is not taken under the cursor until the choice is made', () => {
        const theirs = { ...P2_RULE, expression: "if({value} > 1, 'fault', 'normal')" };
        const mine = { ...P2_RULE, expression: "if({value} > 2, 'fault', 'normal')" };
        const held = globalThis as unknown as { document?: unknown };
        const before = held.document;
        const button = { tagName: 'SELECT' };
        held.document = { activeElement: button };
        try {
            const base = { kind: PAD, kpis: KPIS, stored: P2_RULE as Record<string, unknown>, version: 4, off: false, idBase: 'x', refusals: [], refused: false,
                saving: false, done: 0, onClearRefusal: noop, own: true, onSend: () => true };
            const ed = new RuleEditor(base);
            const inner = ed as unknown as { state: { rule: RuleDraft | null }; props: unknown; ruleBox: { current: unknown }; commitRule(): void };
            inner.ruleBox = { current: { contains: (el: unknown) => el === button, querySelectorAll: () => [], querySelector: () => null } };
            inner.state = { rule: ruleDraft(mine) };
            const folded: RuleDraft[] = [];
            ed.setState = ((next: { rule: RuleDraft }) => { folded.push(next.rule); }) as typeof ed.setState;
            inner.commitRule();
            // Sent and seen on its way; then the conflict: the flight ends, the entry waits in the queue, their rule is the stored one.
            inner.props = { ...base, saving: true };
            ed.componentDidUpdate();
            inner.props = { ...base, stored: theirs, version: 5, refused: true };
            ed.componentDidUpdate();
            ed.componentDidUpdate();
            expect(folded).toEqual([]);
            // "Use their version": the entry is gone, and their rule shows with the cursor still in the rule.
            inner.props = { ...base, stored: theirs, version: 5 };
            ed.componentDidUpdate();
            expect(folded).toEqual([ruleDraft(theirs)]);
        } finally {
            held.document = before;
        }
    });

    test('U6: Enter in a rule field sends the rule when it is complete and never blurs the field', () => {
        const sent: Array<Record<string, unknown> | null> = [];
        const ed = new RuleEditor({ kind: PAD, kpis: KPIS, stored: null, version: 4, off: false, idBase: 'x', refusals: [], refused: false, saving: false,
            done: 0, onClearRefusal: noop, own: true, initial: states('[default]Mesa/P14/Status'), onSend: (rule) => { sent.push(rule); return true; } });
        let prevented = false;
        const key = (k: string): void => (ed as unknown as { onDraftKey(ev: unknown): void }).onDraftKey({ key: k, preventDefault: () => { prevented = true; },
            currentTarget: { blur: () => { throw new Error('the field lost the focus'); } } });
        key('a');
        expect(sent).toEqual([]);
        key('Enter');
        expect(prevented).toBe(true);
        expect(sent).toEqual([{ source: { path: '[default]Mesa/P14/Status' }, type: 'states', cases: [{ value: 1, preset: 'fault' }] }]);
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

describe('entry 13c: the tag button on the own rule\'s tag path, and a pick into the draft (C5)', () => {
    const buttons = (html: string): string[] => html.match(/<button[^>]*mapstudio-tag-button[^>]*>/g) || [];

    test('a full editor has the button beside the tag path; pressed, it names the item and its own rule', () => {
        expect(buttons(styleOf(panel({ tab: 'style', style: facts({ ownRule: P2_RULE }) })))).toEqual([]);
        const asked: unknown[] = [];
        const html = styleOf(panel({ tab: 'style', style: facts({ ownRule: P2_RULE }), onBrowse: (tagFor, target) => asked.push([tagFor, target]) }));
        expect(buttons(html)).toHaveLength(1);
        expect(buttons(html)[0]).toContain('data-tag-for="own.styleRule.path"');
        expect(buttons(html)[0]).toContain('aria-label="Pick a tag for the style rule" aria-haspopup="dialog" aria-expanded="false"');
        const open = styleOf(panel({ tab: 'style', style: facts({ ownRule: P2_RULE }), onBrowse: noop, browsing: 'own.styleRule.path' }));
        expect(buttons(open)[0]).toContain('aria-expanded="true"');
        // The kind's rule in words has no path to pick.
        expect(buttons(styleOf(panel({ tab: 'style', onBrowse: noop })))).toEqual([]);
    });

    const sent: Array<[Record<string, unknown> | null, number | null]> = [];
    const make = (over: Partial<React.ComponentProps<typeof RuleEditor>>): RuleEditor => {
        const editor = new RuleEditor({ kind: PAD, kpis: KPIS, stored: P2_RULE, version: 7, off: false, idBase: 'x', refusals: [], refused: false,
            saving: false, done: 0, onClearRefusal: noop, own: true, onSend: (rule, base) => { sent.push([rule, base]); return true; }, ...over });
        const raw = editor as unknown as { state: object; setState: (u: unknown, then?: () => void) => void };
        raw.setState = (u: unknown, then?: () => void): void => {
            raw.state = { ...raw.state, ...(typeof u === 'function' ? (u as (s: object) => object)(raw.state) : u as object) };
            if (then) {
                then();
            }
        };
        return editor;
    };

    test('a pick goes into the draft as the tag path and the rule is sent when it is complete', () => {
        sent.length = 0;
        expect(make({}).usePath('[default]Mesa/P14/Status')).toBe('');
        expect(sent).toEqual([[{ ...P2_RULE, source: { path: '[default]Mesa/P14/Status' } }, 7]]);
    });

    test('a rule not complete takes the path and says Not saved yet; nothing is sent', () => {
        sent.length = 0;
        const editor = make({ stored: null, initial: withSource({ ...ruleDraft(null), type: 'states' }, { from: 'path', path: '' }) });
        expect(editor.usePath('[default]Mesa/P14/Status')).toBe('');
        expect(sent).toEqual([]);
        expect(editor.unsaved()).toBe(true);
        expect(draftSource(editor.draft())).toEqual({ from: 'path', path: '[default]Mesa/P14/Status' });
    });

    test('an editor that takes no input, or a rule that reads no tag, says why', () => {
        sent.length = 0;
        expect(make({ off: true }).usePath('[default]a/b')).toBe('Not saved. The rule cannot be changed now.');
        expect(make({ stored: { source: { instruments: 'worst' } }, kind: { ...PAD, geometry: 'line' } }).usePath('[default]a/b'))
            .toBe('Not saved. This rule no longer reads a tag path.');
        expect(sent).toEqual([]);
    });

    test('the value moved to a key value while the card is open: the card is told to close, and a pick is refused in words', () => {
        sent.length = 0;
        let gone = 0;
        const onKpi = { ...P2_RULE, source: { kpi: KPIS[0].key } };
        const editor = make({ stored: onKpi, browsing: true, onBrowseGone: () => { gone++; } });
        editor.componentDidUpdate();
        expect(gone).toBe(1);
        expect(editor.usePath('[default]Mesa/P14/Status')).toBe('Not saved. This rule no longer reads a tag path.');
        expect(sent).toEqual([]);
        // While the rule shows its tag path field the card stays.
        const onPath = make({ browsing: true, onBrowseGone: () => { gone++; } });
        onPath.componentDidUpdate();
        expect(gone).toBe(1);
    });
});
