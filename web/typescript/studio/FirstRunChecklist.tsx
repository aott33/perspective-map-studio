import * as React from 'react';
import { ADD_HELP, CHECKLIST_SUBLINE, VIEW_HELP, checklistTitle, doneText, kindsHelp } from '../firstRun';
import { ChromeGlyph } from './ChromeGlyph';

/**
 * The first-run checklist (epic 4 entry 7b; DESIGN.md first-run-checklist and key screen 8, EXPERIENCE.md First-run
 * checklist): a floating card centred on the empty map in Edit mode, 400 px (narrower when the map is), on the panel
 * surface with radius lg and the one soft shadow. Title "Get <project> on the map", the subline, three rows (a numbered
 * ring, a check once done; a bold label, a help line and a button) and a footer with "N of 3 done" and a ghost "Hide
 * checklist". Not a dialog: no focus trap, Esc does not hide it, its buttons are in the tab order. When it shows and what
 * is done is firstRun.ts'; its attributes are what the e2e suite reads.
 */
export interface FirstRunChecklistProps {
    project: string;
    /** The number of kinds the host's kind list defines. */
    kindCount: number;
    /** Steps 1 to 3 done. */
    done: readonly [boolean, boolean, boolean];
    /** Editing paused (the store unreachable): Add an item is off, as the list's Add item is. */
    addDisabled: boolean;
    onOpenKinds: () => void;
    onAddItem: () => void;
    onOpenView: () => void;
    onHide: () => void;
}

interface Step {
    label: string;
    help: string;
    button: string;
    primary: boolean;
    onClick: () => void;
    disabled: boolean;
}

export function FirstRunChecklist(props: FirstRunChecklistProps): React.ReactElement {
    const title = checklistTitle(props.project);
    const steps: Step[] = [
        { label: 'Set up your kinds', help: kindsHelp(props.kindCount), button: 'Open Kinds', primary: true, onClick: props.onOpenKinds, disabled: false },
        { label: 'Add or import items', help: ADD_HELP, button: 'Add an item', primary: false, onClick: props.onAddItem, disabled: props.addDisabled },
        { label: 'Check the operator view', help: VIEW_HELP, button: 'Open view mode', primary: false, onClick: props.onOpenView, disabled: false }
    ];
    const count = doneText(props.done);
    return (
        <section className="mapstudio-firstrun" aria-label={title} data-done={String(props.done.filter((d) => d).length)}>
            <h2 className="mapstudio-firstrun-title">{title}</h2>
            <p className="mapstudio-firstrun-subline">{CHECKLIST_SUBLINE}</p>
            <ol className="mapstudio-firstrun-steps">
                {steps.map((step, i) => {
                    const done = props.done[i];
                    return (
                        <li key={step.label} className={'mapstudio-firstrun-step' + (done ? ' mapstudio-firstrun-step--done' : '')}
                            data-step={String(i + 1)} data-done={done ? 'true' : 'false'}>
                            <span className="mapstudio-firstrun-ring" aria-hidden="true">
                                {done ? <ChromeGlyph name="check" className="mapstudio-firstrun-check" size={14} /> : String(i + 1)}
                            </span>
                            <span className="mapstudio-firstrun-words">
                                <span className="mapstudio-firstrun-label">
                                    {step.label}
                                    {done ? <span className="mapstudio-firstrun-sr"> (done)</span> : null}
                                </span>
                                <span className="mapstudio-firstrun-help">{step.help}</span>
                            </span>
                            <button type="button" className={'mapstudio-button mapstudio-firstrun-action' + (step.primary ? ' mapstudio-button--primary' : '')}
                                    disabled={step.disabled} onClick={step.onClick}>
                                {step.button}
                            </button>
                        </li>
                    );
                })}
            </ol>
            <footer className="mapstudio-firstrun-footer">
                <span className="mapstudio-firstrun-count" aria-live="polite">{count}</span>
                <button type="button" className="mapstudio-button mapstudio-button--ghost mapstudio-firstrun-hide" onClick={props.onHide}>
                    Hide checklist
                </button>
            </footer>
        </section>
    );
}

/** The viewer's note (entry 7b; EXPERIENCE.md Empty map, viewer): View mode on an empty loaded map, a small centred note. */
export function ViewerNote(props: { text: string }): React.ReactElement {
    return <div className="mapstudio-empty-note" role="status">{props.text}</div>;
}
