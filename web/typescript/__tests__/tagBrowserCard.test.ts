// The tag browser's card as it is drawn (epic 4 entry 13b; DESIGN.md Tag browser): the header and the For line, the Provider
// select with the default first and tagged, the tree's rows with their type and data type, the asset folder marked and its rows
// guided (B1), one row in the tab order, the picked row and the note with what the button saves (B2, B3), a folder that is no
// pick with the button inert (B4), "Use this folder" for Alarms (B5), the folder button away from the asset folder (B6), the
// Loading row with the spinner and an empty folder (B8), a provider it cannot browse (B9) and a refusal in place (B10). The
// keyboard and the focus are the e2e spec's (e2e/tests/tagbrowser.spec.mjs); the tree's logic is tagBrowser.test.ts.
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Kind } from '../adapters';
import { TagChild } from '../messages';
import { TagBrowser, TagBrowserProps } from '../studio/TagBrowser';
import { BrowseAnswers, FolderAnswer, TreeState, browseKey, chooseProvider, openFolder } from '../tagBrowser';

const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] };
const PROVIDERS = [{ name: 'Site2', isDefault: false }, { name: 'default', isDefault: true }];
const tag = (path: string, dataType: string): TagChild => ({ name: path.slice(path.lastIndexOf('/') + 1), path, type: 'tag', dataType, hasChildren: false });
const folder = (path: string, type: TagChild['type'] = 'folder', hasChildren = true): TagChild =>
    ({ name: path.replace(/^\[.*\]/, '').split('/').pop() as string, path, type, dataType: null, hasChildren });
const loaded = (children: TagChild[], truncated = false): FolderAnswer => ({ state: 'loaded', children, truncated });

const P14 = folder('[default]Mesa/P14', 'udt-instance');
const P15 = folder('[default]Mesa/P15');
const PRESSURE = tag('[default]Mesa/P14/Pressure', 'Float8');
const AMBIENT = tag('[default]Plant/AmbientTemp', 'Float8');
const OPENED: BrowseAnswers = {
    providers: PROVIDERS,
    folders: {
        [browseKey('default', '')]: loaded([folder('[default]Mesa'), folder('[default]Plant')]),
        [browseKey('default', 'Mesa')]: loaded([P14, P15]),
        [browseKey('default', 'Mesa/P14')]: loaded([tag('[default]Mesa/P14/Comms', 'Boolean'), PRESSURE]),
        [browseKey('default', 'Plant')]: loaded([AMBIENT])
    },
    picks: {}
};
const noop = (): void => undefined;

/** The card's markup, its tree changed first as a person's clicks and keys would change it. */
function card(over: Partial<TagBrowserProps> = {}, change?: (tree: TreeState) => TreeState, refused?: string, typed?: string): string {
    const props: TagBrowserProps = {
        kind: PAD, tagFor: 'kpis.pressure.path', target: { part: 'kpi', index: 2 }, preview: { name: 'Point 2', folder: '[default]Mesa/P14' },
        answers: OPENED, onBrowse: noop, onAskPick: noop, onUse: () => '', onClose: noop, onGone: noop, ...over
    };
    class Changed extends TagBrowser {
        constructor(p: TagBrowserProps) {
            super(p);
            if (change) {
                this.state = { tree: change(this.state.tree) };
            }
            if (refused) {
                this.state = { ...this.state, refused };
            }
            if (typed !== undefined) {
                this.state = { ...this.state, typed };
            }
        }
    }
    return renderToStaticMarkup(React.createElement(Changed, props));
}

/** Each row's opening tag, in order. */
function rows(html: string): string[] {
    return html.match(/<div role="treeitem"[^>]*>/g) || [];
}

const attr = (tagText: string, name: string): string => (new RegExp(' ' + name + '="([^"]*)"').exec(tagText) || ['', ''])[1];

describe('the card (B1)', () => {
    const html = card();

    test('the header, the close and the For line', () => {
        expect(html).toContain('class="mapstudio-tagbrowser" role="dialog"');
        expect(html).toContain('data-for="kpis.pressure.path"');
        expect(html).toMatch(/<h3 id="[^"]+" class="mapstudio-tagbrowser-title">Pick a tag<\/h3>/);
        expect(html).toMatch(/class="mapstudio-dock-button mapstudio-tagbrowser-close" title="Close \(Esc\)" aria-label="Close"/);
        expect(html).toMatch(/class="mapstudio-tagbrowser-for">For: Key value 2 of the Well pad kind<\/p>/);
        expect(card({ target: { part: 'comms' } })).toContain('For: Comms of the Well pad kind');
        expect(card({ target: { part: 'alarms' } })).toContain('For: Alarms of the Well pad kind');
    });

    test('the Provider select lists the default first, tagged Default, and shows it', () => {
        expect(html).toMatch(/<option selected="" value="default">default \(Default\)<\/option><option value="Site2">Site2<\/option>/);
        expect(html).toContain('class="mapstudio-kindsetup-tag mapstudio-tagbrowser-default">Default</span>');
        expect(html).not.toContain('mapstudio-tagbrowser-home');
    });

    test('the tree opens at the asset folder: opened, marked, its rows guided, each with its type and a tag its data type', () => {
        const all = rows(html);
        expect(all.map((r) => attr(r, 'data-path'))).toEqual(['[default]Mesa', '[default]Mesa/P14', '[default]Mesa/P14/Comms', '[default]Mesa/P14/Pressure',
            '[default]Mesa/P15', '[default]Plant']);
        expect(all.map((r) => attr(r, 'aria-level'))).toEqual(['1', '2', '3', '3', '2', '1']);
        expect(all.map((r) => attr(r, 'aria-expanded'))).toEqual(['true', 'true', '', '', 'false', 'false']);
        expect(all.map((r) => attr(r, 'data-asset'))).toEqual(['false', 'true', 'false', 'false', 'false', 'false']);
        expect(all.map((r) => attr(r, 'data-guided'))).toEqual(['false', 'false', 'true', 'true', 'false', 'false']);
        expect(all.map((r) => /padding-left:(\d+)px/.exec(r)![1])).toEqual(['6', '22', '38', '38', '22', '6']);
        expect(html).toContain('class="mapstudio-kindsetup-tag mapstudio-tag-asset">Asset folder</span>');
        expect(html).toContain('<span class="mapstudio-tag-name mapstudio-mono">Pressure</span><span class="mapstudio-tag-type">Tag</span>'
            + '<span class="mapstudio-tag-datatype">Float8</span>');
        expect(html).toContain('<span class="mapstudio-tag-type">UDT instance</span><span class="mapstudio-tag-datatype"></span>');
        expect(html).toContain('<span class="mapstudio-tag-type">Folder</span>');
        expect(html).toContain('role="tree" aria-label="Tags of default"');
    });

    test('one row is in the tab order: the asset folder the card opened at', () => {
        const all = rows(html);
        expect(all.map((r) => attr(r, 'tabindex'))).toEqual(['-1', '0', '-1', '-1', '-1', '-1']);
    });

    test('nothing is picked: the Path field is empty and can be typed in, the note says where it opened, the button is inert', () => {
        const input = (/<input type="text" id="[^"]+" class="mapstudio-input mapstudio-mono"[^>]*>/.exec(html) || [''])[0];
        expect(input).toContain('value="" placeholder="Pick in the tree or type one"');
        expect(input).toContain('data-typed="false"');
        expect(input).not.toContain('readonly');
        expect(input).not.toContain('disabled');
        expect(html).toContain('data-tone="plain" data-save=""');
        expect(html).toContain('Opened at Point 2&#x27;s asset folder, the preview item.');
        expect(html).toMatch(/class="mapstudio-button mapstudio-button--primary mapstudio-tagbrowser-use" disabled="">Use this tag<\/button>/);
        expect(html).toContain('class="mapstudio-button mapstudio-tagbrowser-cancel">Cancel</button>');
    });
});

describe('a pick (B2 to B5)', () => {
    test('B2: inside the asset folder the note shows the path to save and what it resolves for; the button is live', () => {
        const html = card({ answers: { ...OPENED, picks: { [PRESSURE.path]: { state: 'answered', path: '{asset.path}/Pressure', relative: true, n: 4, m: 5,
            failing: ['Point 3'], failingMore: 0 } } } }, (t) => ({ ...t, picked: PRESSURE, focus: 'mesa/p14/pressure' }));
        const picked = rows(html).filter((r) => attr(r, 'data-picked') === 'true');
        expect(picked.map((r) => [attr(r, 'data-path'), attr(r, 'aria-selected'), attr(r, 'tabindex')])).toEqual([[PRESSURE.path, 'true', '0']]);
        expect(picked[0]).toContain('mapstudio-tag-row--picked');
        expect(html).toContain('value="[default]Mesa/P14/Pressure"');
        expect(html).toContain('data-tone="plain" data-save="{asset.path}/Pressure"');
        expect(html).toContain('Inside Point 2&#x27;s asset folder - saved for every well pad as');
        expect(html).toContain('<div class="mapstudio-mono mapstudio-tagbrowser-note-path">{asset.path}/Pressure</div>');
        expect(html).toMatch(/mapstudio-tagbrowser-note-resolve--warning" data-warning="true">.*Resolves for 4 of 5 well pads\. Not for Point 3\./);
        expect(html).toMatch(/mapstudio-tagbrowser-use">Use this tag<\/button>/);
    });

    test('the button waits for the Gateway\'s answer', () => {
        const html = card({ answers: { ...OPENED, picks: { [PRESSURE.path]: { state: 'asking' } } } }, (t) => ({ ...t, picked: PRESSURE }));
        expect(html).toContain('Checking...');
        expect(html).toMatch(/mapstudio-tagbrowser-use" disabled="">Use this tag/);
    });

    test('B3: outside it, the shared-tag note on the warning tone with the full path', () => {
        const html = card({ answers: { ...OPENED, picks: { [AMBIENT.path]: { state: 'answered', path: AMBIENT.path, relative: false } } } },
            (t) => ({ ...openFolder(t, 'plant'), picked: AMBIENT }));
        expect(html).toContain('class="mapstudio-tagbrowser-note mapstudio-tagbrowser-note--shared"');
        expect(html).toContain('data-tone="shared" data-save="[default]Plant/AmbientTemp"');
        expect(html).toMatch(/mapstudio-tagbrowser-note-title">.*<span>Same tag for every well pad<\/span>/);
        expect(html).toContain('AmbientTemp is outside Point 2&#x27;s asset folder, so it is saved as the full path and every well pad shows this one tag.');
    });

    test('B4: a folder picked for a key value says so, the Path field shows it and the button stays inert', () => {
        const html = card({}, (t) => ({ ...t, picked: P15 }));
        expect(html).toContain('<span>Pick a tag, not a folder.</span>');
        expect(html).toContain('value="[default]Mesa/P15"');
        expect(html).toMatch(/mapstudio-tagbrowser-use" disabled="">Use this tag/);
    });

    test('B5: for Alarms a folder is a pick and the button reads Use this folder', () => {
        const html = card({ target: { part: 'alarms' }, tagFor: 'alarms.path',
            answers: { ...OPENED, picks: { [P14.path]: { state: 'answered', path: '{asset.path}', relative: true, n: 5, m: 5 } } } }, (t) => ({ ...t, picked: P14 }));
        expect(html).toContain('data-save="{asset.path}"');
        expect(html).toMatch(/mapstudio-tagbrowser-use">Use this folder<\/button>/);
        expect(html).toMatch(/data-warning="false">.*Resolves for 5 of 5 well pads/);
    });
});

describe('the states (B6, B8 to B10, B12)', () => {
    test('B6: another provider shows its top level, with the button back to the asset folder', () => {
        const answers: BrowseAnswers = { ...OPENED, folders: { ...OPENED.folders, [browseKey('Site2', '')]: loaded([folder('[Site2]Yard')]) } };
        const html = card({ answers }, (t) => chooseProvider(t, 'Site2'));
        expect(html).toContain('data-provider="Site2"');
        expect(rows(html).map((r) => attr(r, 'data-path'))).toEqual(['[Site2]Yard']);
        expect(html).toMatch(/mapstudio-tagbrowser-home" title="Back to Point 2&#x27;s asset folder">.*<span>Point 2 folder<\/span>/);
        expect(html).not.toContain('mapstudio-tagbrowser-default');
    });

    test('B8: a folder being opened shows Loading with the spinner under it; an empty one says so; a cut one ends in the count', () => {
        const loading = card({ answers: { ...OPENED, folders: { ...OPENED.folders, [browseKey('default', 'Mesa/P15')]: { state: 'loading' } } } },
            (t) => openFolder(t, 'mesa/p15'));
        expect(loading).toMatch(/data-kind="loading" data-under="Mesa\/P15"[^>]*><span class="mapstudio-spinner" aria-hidden="true"><\/span><span class="mapstudio-tag-words">Loading\.\.\.<\/span>/);
        expect(rows(loading).filter((r) => attr(r, 'data-kind') === 'node')).toHaveLength(6);
        const empty = card({ answers: { ...OPENED, folders: { ...OPENED.folders, [browseKey('default', 'Mesa/P15')]: loaded([]) } } }, (t) => openFolder(t, 'mesa/p15'));
        expect(empty).toMatch(/mapstudio-tag-row--empty[^>]*data-kind="empty"[^>]*><span class="mapstudio-tag-words">No tags in this folder<\/span>/);
        const cut = card({ answers: { ...OPENED, folders: { ...OPENED.folders, [browseKey('default', 'Mesa/P15')]: loaded([tag('[default]Mesa/P15/Flow', 'Float8')], true) } } },
            (t) => openFolder(t, 'mesa/p15'));
        expect(cut).toContain('<span class="mapstudio-tag-words">Showing the first 1,000.</span>');
        // Before anything answered: the one Loading row, and the select waits for the providers.
        const first = card({ answers: { providers: [], folders: {}, picks: {} } });
        expect(rows(first).map((r) => attr(r, 'data-kind'))).toEqual(['loading']);
        expect(first).toContain('<option selected="" value="default">default</option>');
    });

    test('B9: a provider that does not answer replaces the tree; the select still offers the others', () => {
        const words = 'The tag provider Site2 is on this Gateway but does not answer; it is stopped or faulted. Start it on the Gateway\'s tag provider page.';
        const answers: BrowseAnswers = { ...OPENED, providers: [{ name: 'default', isDefault: true }, { name: 'System', isDefault: false }],
            folders: { ...OPENED.folders, [browseKey('Site2', '')]: { state: 'failed', code: 'tags-unavailable', message: words } } };
        const html = card({ answers }, (t) => chooseProvider(t, 'Site2'));
        expect(html).not.toContain('role="tree"');
        expect(html).toMatch(/class="mapstudio-tagbrowser-problem" role="alert" data-code="tags-unavailable">.*<span>Can&#x27;t browse Site2<\/span>/);
        expect(html).toContain('stopped or faulted');
        expect(html).toContain('mapstudio-tagbrowser-retry">Try again</button>');
        expect(html).toMatch(/<option value="default">default \(Default\)<\/option><option value="System">System<\/option><option selected="" value="Site2">Site2<\/option>/);
    });

    test('B10: a refused role shows the Gateway\'s words in place with no Try again; a folder that is gone shows them under it with one', () => {
        const role = card({ answers: { providers: [], picks: {}, folders: { [browseKey('default', '')]: { state: 'failed', code: 'role',
            message: 'Browsing tags needs a full editing role. Ask for a Map Studio editing role.' } } } });
        expect(role).toContain('data-code="role"');
        expect(role).toContain('Browsing tags needs a full editing role. Ask for a Map Studio editing role.');
        expect(role).not.toContain('Try again');
        expect(role).not.toContain('Can&#x27;t browse');
        const gone = card({ answers: { ...OPENED, folders: { ...OPENED.folders, [browseKey('default', 'Mesa/P15')]: { state: 'failed', code: 'invalid',
            message: 'The folder Mesa/P15 was not found in tag provider default.' } } } }, (t) => openFolder(t, 'mesa/p15'));
        expect(gone).toMatch(/data-kind="failed" data-under="Mesa\/P15" data-code="invalid"[^>]*>.*The folder Mesa\/P15 was not found in tag provider default\..*mapstudio-tag-retry">Try again<\/button>/);
    });

    test('B12: with no preview item the default provider\'s top level shows and a pick is its full path', () => {
        const answers: BrowseAnswers = { providers: PROVIDERS, picks: {},
            folders: { [browseKey(null, '')]: loaded([folder('[default]Mesa'), folder('[default]Plant')]), [browseKey('default', 'Plant')]: loaded([AMBIENT]) } };
        const html = card({ preview: null, answers });
        expect(rows(html).map((r) => attr(r, 'data-path'))).toEqual(['[default]Mesa', '[default]Plant']);
        expect(html).toContain('No well pad is linked to an asset, so there is no asset folder to open.');
        expect(html).not.toContain('Asset folder');
        const picked = card({ preview: null, answers }, (t) => ({ ...openFolder({ ...t, provider: 'default' }, 'plant'), picked: AMBIENT }));
        expect(picked).toContain('data-tone="shared" data-save="[default]Plant/AmbientTemp"');
        expect(picked).toMatch(/mapstudio-tagbrowser-use">Use this tag<\/button>/);
    });
});

describe('a pick that was not saved', () => {
    test('the card stays with the reason by the button; nothing of it shows otherwise', () => {
        const html = card({}, (t) => ({ ...t, picked: PRESSURE }), 'Not saved. This key value row is gone.');
        expect(html).toMatch(/<p class="mapstudio-tagbrowser-refused" role="alert">.*<span>Not saved\. This key value row is gone\.<\/span><\/p><footer/);
        expect(card()).not.toContain('mapstudio-tagbrowser-refused');
    });

    test('a preview item whose asset has no tag folder opens the default provider\'s top level and says so', () => {
        const answers: BrowseAnswers = { providers: PROVIDERS, picks: {}, folders: { [browseKey(null, '')]: loaded([folder('[default]Mesa')]) } };
        const html = card({ preview: { name: 'Pad 99', folder: 'Mesa/P99' }, answers });
        expect(html).toContain('Pad 99&#x27;s asset has no tag folder to open, so the tree starts at the top.');
        expect(html).not.toContain('is linked to an asset');
    });
});

describe('a typed path (entry 13c, C7 to C11)', () => {
    const answered = (path: string, answer: BrowseAnswers['picks'][string]): BrowseAnswers => ({ ...OPENED, picks: { [path]: answer } });

    test('C7: a typed full path shows as typed; the note and the button follow the Gateway\'s answer as for a pick', () => {
        const typed = '[default]Mesa/P14/Pressure';
        const html = card({ answers: answered(typed, { state: 'answered', path: '{asset.path}/Pressure', relative: true, n: 4, m: 5, failing: ['Point 3'], failingMore: 0 }) },
            undefined, undefined, '  ' + typed + ' ');
        expect(html).toContain('value="  [default]Mesa/P14/Pressure "');
        expect(html).toContain('data-typed="true"');
        expect(html).toContain('data-tone="plain" data-save="{asset.path}/Pressure"');
        expect(html).toMatch(/Resolves for 4 of 5 well pads\. Not for Point 3\./);
        expect(html).toMatch(/mapstudio-tagbrowser-use">Use this tag<\/button>/);
        // Typing drops the tree's pick: no row is picked.
        expect(rows(html).filter((r) => attr(r, 'data-picked') === 'true')).toEqual([]);
    });

    test('C8: {asset.path}/... typed is answered the same; until the answer the button waits', () => {
        const typed = '{asset.path}/Pressure';
        expect(card({}, undefined, undefined, typed)).toMatch(/Checking\.\.\..*mapstudio-tagbrowser-use" disabled="">Use this tag/);
        const html = card({ answers: answered(typed, { state: 'answered', path: typed, relative: true, n: 5, m: 5 }) }, undefined, undefined, typed);
        expect(html).toContain('data-save="{asset.path}/Pressure"');
        expect(html).toMatch(/Resolves for 5 of 5 well pads/);
    });

    test('C9: a path the Gateway refuses shows its words on the warning tone and the button is inert', () => {
        const typed = '[default]Mesa//P14';
        const words = 'The path [default]Mesa//P14 has an empty part between two /.';
        const html = card({ answers: answered(typed, { state: 'failed', code: 'invalid', message: words }) }, undefined, undefined, typed);
        expect(html).toContain('data-tone="warning" data-save=""');
        expect(html).toContain('<span>' + words + '</span>');
        expect(html).not.toContain('Could not check this path');
        expect(html).toMatch(/mapstudio-tagbrowser-use" disabled="">Use this tag/);
    });

    test('C10: with a provider it cannot browse the Path field still takes a path and its answer is used', () => {
        const typed = '[default]Mesa/P14/Pressure';
        const html = card({
            answers: { providers: PROVIDERS, folders: { [browseKey('Site2', '')]: { state: 'failed', code: 'tags-unavailable', message: 'Site2 does not answer.' } },
                picks: { [typed]: { state: 'answered', path: '{asset.path}/Pressure', relative: true, n: 5, m: 5 } } }
        }, (t) => chooseProvider(t, 'Site2'), undefined, typed);
        expect(html).toContain('Can&#x27;t browse Site2');
        expect(html).toContain('value="[default]Mesa/P14/Pressure"');
        expect(html).toContain('data-save="{asset.path}/Pressure"');
        expect(html).toMatch(/mapstudio-tagbrowser-use">Use this tag<\/button>/);
    });

    test('C11: with no typed text the field shows the picked row\'s path; an emptied field is the opening note again', () => {
        expect(card({}, (t) => ({ ...t, picked: PRESSURE }))).toContain('value="[default]Mesa/P14/Pressure"');
        const emptied = card({}, undefined, undefined, '');
        expect(emptied).toContain('Opened at Point 2&#x27;s asset folder, the preview item.');
        expect(emptied).toMatch(/mapstudio-tagbrowser-use" disabled="">/);
    });
});

describe('one item\'s card (entry 13c, C4 to C6, C8)', () => {
    const OVERRIDE = { part: 'override' as const, name: 'Casing pressure', item: 'P14' };
    const over = (more: Partial<TagBrowserProps> = {}): Partial<TagBrowserProps> =>
        ({ tagFor: 'override:kpi:casing', target: OVERRIDE, preview: { name: 'P14', folder: '[default]Mesa/P14' }, ...more });

    test('C4: the For line, the item\'s own asset folder, and a pick saved as the full path with the Override tag and Use for P14', () => {
        const asked: string[] = [];
        const html = card(over({ onAskPick: (p) => asked.push(p) }), (t) => ({ ...t, picked: PRESSURE }));
        expect(html).toContain('For: Casing pressure on P14 only - an override');
        expect(html).toContain('data-part="override"');
        expect(html).toContain('data-tone="plain" data-save="[default]Mesa/P14/Pressure"');
        expect(html).toContain('<span>Saved for P14 only, as the full path</span>');
        expect(html).toContain('<div class="mapstudio-mono mapstudio-tagbrowser-note-path">[default]Mesa/P14/Pressure</div>');
        expect(html).toContain('<div class="mapstudio-tagbrowser-note-override"><span class="mapstudio-override-tag">Override</span></div>');
        expect(html).toMatch(/mapstudio-tagbrowser-use">Use for P14<\/button>/);
        expect(html).not.toContain('Checking...');
        expect(asked).toEqual([]);
    });

    test('C5: the own rule\'s For line; nothing picked says where it opened and that a pick is for P14 only', () => {
        const html = card(over({ tagFor: 'own.styleRule.path', target: { part: 'ownRule', item: 'P14' } }));
        expect(html).toContain('For: Style rule of P14 only');
        expect(html).toContain('Opened at P14&#x27;s asset folder. A pick is saved for P14 only, as the full path.');
        expect(html).toMatch(/mapstudio-tagbrowser-use" disabled="">Use for P14/);
    });

    test('C6: an item with no asset opens the default provider\'s top; a pick is its full path', () => {
        const top: BrowseAnswers = { providers: PROVIDERS, folders: { [browseKey(null, '')]: loaded([folder('[default]Mesa'), AMBIENT]),
            [browseKey('default', '')]: loaded([folder('[default]Mesa'), AMBIENT]) }, picks: {} };
        const html = card(over({ preview: null, answers: top }), (t) => ({ ...t, provider: 'default', picked: AMBIENT }));
        expect(rows(html).map((r) => attr(r, 'data-path'))).toEqual(['[default]Mesa', '[default]Plant/AmbientTemp']);
        expect(html).toContain('data-save="[default]Plant/AmbientTemp"');
        expect(card(over({ preview: null, answers: top }))).toContain('P14 is not linked to an asset with a tag folder, so the tree starts at the top.');
    });

    test('C8: {asset.path}/... typed for an item is refused with the override check\'s words; a typed full path is taken', () => {
        const refused = card(over(), undefined, undefined, '{asset.path}/Pressure');
        expect(refused).toContain('data-tone="warning" data-save=""');
        expect(refused).toContain('an override&#x27;s tag path is a full path such as [default]Mesa/P12/Pressure, not {asset.path}/Pressure.');
        expect(refused).toMatch(/mapstudio-tagbrowser-use" disabled="">Use for P14/);
        const taken = card(over(), undefined, undefined, '[default]Mesa/P14/Casing');
        expect(taken).toContain('data-save="[default]Mesa/P14/Casing"');
        expect(taken).toMatch(/mapstudio-tagbrowser-use">Use for P14<\/button>/);
    });

    test('a folder is a pick for an override of Alarms only', () => {
        expect(card(over(), (t) => ({ ...t, picked: P15 }))).toContain('<span>Pick a tag, not a folder.</span>');
        const alarms = card(over({ tagFor: 'override:alarms', target: { part: 'override', name: 'Alarms', item: 'P14', folders: true } }), (t) => ({ ...t, picked: P15 }));
        expect(alarms).toContain('data-save="[default]Mesa/P15"');
        expect(alarms).toMatch(/mapstudio-tagbrowser-use">Use for P14<\/button>/);
    });
});
