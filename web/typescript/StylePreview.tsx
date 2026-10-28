/**
 * The style rule preview (epic 3 entry 1; EXPERIENCE.md "Kind setup": each state maps to a preset
 * with its preview tile): one tile per case of a rule, the case's words, the look the map draws
 * for that preset (the marker image's own SVG for a point kind, a line sample for a line kind) and
 * the preset's word; and, for an area kind, one swatch per category tint. The kind setup screen
 * (epic-editing) embeds it beside the rule's rows; the component's `previewStyles` prop draws it
 * for every kind on the dev page `/styles`. Pure React, no map: it renders in node for the tests.
 * Every colour is a token value handed in (MarkerColors); nothing here invents one.
 */

import * as React from 'react';
import { AreaTints, Preset, RuleDisplay, TINTS, Tint } from './live';
import { MarkerColors, PRESET_WORDS, SpriteSymbol, lineSampleSvg, markerSpec, markerSvg, pointPreset, tintSampleSvg } from './markers';

export interface StylePreviewKind {
    id: string;
    name: string;
    geometry: 'point' | 'line';
    icon: string;
    area?: boolean;
}

export interface StylePreviewProps {
    kind: StylePreviewKind;
    /** The rule to preview (a kind display's `styleRule`), or undefined for a kind without one. */
    rule?: RuleDisplay;
    /** The area tints to preview (a kind display's `areaTints`), or undefined. */
    tints?: AreaTints;
    /** The sprite's symbols, for the kind glyph in a point tile (an empty map draws the disc alone). */
    symbols: Record<string, SpriteSymbol>;
    colors: MarkerColors;
}

/** The words of a rule's source: "the key value flow", "a tag", "the instruments". */
export function sourceWords(rule: RuleDisplay): string {
    if (rule.source === 'instruments') {
        return 'the instruments at each segment\'s ends';
    }
    if (rule.source.indexOf('kpi:') === 0) {
        return 'the key value ' + rule.source.substring(4);
    }
    return 'a tag';
}

/** The words of a case: "When the value is 2", "When the value is 50 to 200", "When the expression gives warning". */
export function caseWords(rule: RuleDisplay, label: string): string {
    switch (rule.type) {
        case 'states':
            return 'When the value is ' + label;
        case 'bands':
            return 'When the value is ' + label;
        case 'expression':
            return 'When the expression gives ' + label;
        default:
            return label;
    }
}

/** The SVG of one preset's look for a kind: the marker image for a point, a line sample for a line. */
export function presetSampleSvg(kind: StylePreviewKind, preset: Preset, symbols: Record<string, SpriteSymbol>, colors: MarkerColors): string {
    if (kind.geometry === 'line') {
        return lineSampleSvg(preset, colors);
    }
    const state = { commsLost: false, stale: false, alarm: null, iconKpi: null, badge: 'normal' as const, preset };
    return markerSvg({ ...markerSpec(kind.icon, state), preset: pointPreset(preset) }, symbols, colors);
}

function Sample(props: { svg: string; className: string }): React.ReactElement {
    // The SVG text comes from markers.ts (the module's own drawing, token values only), never from data.
    return <span className={props.className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: props.svg }} />;
}

/** The preview of one kind's rule and tints. */
export function StylePreview(props: StylePreviewProps): React.ReactElement {
    const { kind, rule, tints, symbols, colors } = props;
    const cases = rule ? rule.cases : [];
    return (
        <div className="mapstudio-style-preview" data-kind={kind.id} data-cases={String(cases.length)}
             data-tints={tints ? String(tints.tints.length) : '0'}>
            <div className="mapstudio-style-preview-title">
                <span className="mapstudio-style-preview-kind">{kind.name}</span>
                {rule ? (
                    <span className="mapstudio-style-preview-rule">
                        {rule.type === 'instruments' ? 'From ' + sourceWords(rule) : rule.type.charAt(0).toUpperCase() + rule.type.slice(1) + ' on ' + sourceWords(rule)}
                    </span>
                ) : null}
            </div>
            {rule && cases.length === 0 ? (
                <div className="mapstudio-style-preview-note">
                    {rule.type === 'instruments' ? 'Each segment draws the worst of its end instruments.' : 'No case names a preset.'}
                </div>
            ) : null}
            {cases.length > 0 ? (
                <div className="mapstudio-style-preview-tiles">
                    {cases.map((c, i) => (
                        <div key={i} className="mapstudio-style-tile" data-preset={c.preset} data-label={c.label}>
                            <Sample svg={presetSampleSvg(kind, c.preset, symbols, colors)} className={'mapstudio-style-sample mapstudio-style-sample--' + kind.geometry} />
                            <div className="mapstudio-style-tile-text">
                                <div className="mapstudio-style-case">{caseWords(rule!, c.label)}</div>
                                <div className="mapstudio-style-preset">
                                    <span className="mapstudio-style-preset-name">{c.preset}</span>
                                    {PRESET_WORDS[c.preset] ? <span className="mapstudio-style-word">{PRESET_WORDS[c.preset]}</span> : null}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
            {tints ? (
                <div className="mapstudio-style-preview-tints">
                    <div className="mapstudio-style-preview-note">Tint by {tints.property}</div>
                    <div className="mapstudio-style-preview-tiles">
                        {tints.tints.map((t) => (
                            <div key={t.category} className="mapstudio-style-tile" data-tint={t.tint} data-label={t.category}>
                                <Sample svg={tintSampleSvg(t.tint, colors)} className="mapstudio-style-sample mapstudio-style-sample--area" />
                                <div className="mapstudio-style-tile-text">
                                    <div className="mapstudio-style-case">{t.category}</div>
                                    <div className="mapstudio-style-preset"><span className="mapstudio-style-preset-name">{t.tint}</span></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

/** Every preset of a geometry, each in its look, with its word: the palette page (docs/styles.md). */
export function PresetPalette(props: { geometry: 'point' | 'line'; icon: string; symbols: Record<string, SpriteSymbol>; colors: MarkerColors }): React.ReactElement {
    const presets: Preset[] = props.geometry === 'line'
        ? ['normal', 'attention', 'warning', 'fault', 'dimmed', 'solid', 'dashed', 'dotted']
        : ['normal', 'attention', 'warning', 'fault', 'dimmed'];
    const kind: StylePreviewKind = { id: props.geometry, name: props.geometry, geometry: props.geometry, icon: props.icon };
    return (
        <div className="mapstudio-style-preview mapstudio-style-palette" data-geometry={props.geometry} data-cases={String(presets.length)}>
            <div className="mapstudio-style-preview-title">
                <span className="mapstudio-style-preview-kind">{props.geometry === 'line' ? 'Line presets' : 'Point presets'}</span>
            </div>
            <div className="mapstudio-style-preview-tiles">
                {presets.map((preset) => (
                    <div key={preset} className="mapstudio-style-tile" data-preset={preset}>
                        <Sample svg={presetSampleSvg(kind, preset, props.symbols, props.colors)} className={'mapstudio-style-sample mapstudio-style-sample--' + props.geometry} />
                        <div className="mapstudio-style-tile-text">
                            <div className="mapstudio-style-preset">
                                <span className="mapstudio-style-preset-name">{preset}</span>
                                {PRESET_WORDS[preset] ? <span className="mapstudio-style-word">{PRESET_WORDS[preset]}</span> : null}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** The six tints, each as the area look: the palette page. */
export function TintPalette(props: { colors: MarkerColors }): React.ReactElement {
    return (
        <div className="mapstudio-style-preview mapstudio-style-palette" data-geometry="area" data-tints={String(TINTS.length)}>
            <div className="mapstudio-style-preview-title">
                <span className="mapstudio-style-preview-kind">Area tints</span>
            </div>
            <div className="mapstudio-style-preview-tiles">
                {TINTS.map((tint: Tint) => (
                    <div key={tint} className="mapstudio-style-tile" data-tint={tint}>
                        <Sample svg={tintSampleSvg(tint, props.colors)} className="mapstudio-style-sample mapstudio-style-sample--area" />
                        <div className="mapstudio-style-tile-text">
                            <div className="mapstudio-style-preset"><span className="mapstudio-style-preset-name">{tint}</span></div>
                        </div>
                    </div>
                ))}
                <div className="mapstudio-style-tile" data-tint="">
                    <Sample svg={tintSampleSvg(null, props.colors)} className="mapstudio-style-sample mapstudio-style-sample--area" />
                    <div className="mapstudio-style-tile-text">
                        <div className="mapstudio-style-preset"><span className="mapstudio-style-preset-name">no tint</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
