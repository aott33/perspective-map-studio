import * as React from 'react';
import { SaveCardData } from '../unsaved';
import { ChromeGlyph } from './ChromeGlyph';

/**
 * The save problems' card (epic 4 entry 10; EXPERIENCE.md Save and store states, Conflict card, Save banner, R26; DESIGN.md
 * conflict-card, save-banner; the key-screen-9 mocks): one card on the map under the toolbar, the moment's choice, while the
 * save status row stays the lasting record. Which card and its words are unsaved.ts `saveCardFor`'s:
 *
 * - **conflict**: the warning glyph, "Not saved - conflict with Sam's change", the other editor's change ("Sam moved P14 about
 *   40 m north at 10:42, while you were editing it."), "Your change, kept here and not saved: ...", then "Use Sam's version" and
 *   a primary "Apply mine on top" (only the first, with the reason in words, when they deleted it or my add met one that
 *   exists); "1 of 2" while two conflicts wait.
 * - **unreachable**: the cloud glyph, "Store unreachable", what is kept and that editing is paused, a primary "Try again" and
 *   "Show my 2 edits", which opens the row's list of them.
 * - **busy**: the warning glyph, "Not saved - Map Studio is busy", the Gateway's sentence, "Your change, kept here: ...", a
 *   primary "Try again" and "Discard my change" (off while the batch is being sent).
 *
 * It arrives as an alert (`role="alert"`) and takes no focus: the focus stays where it was, Tab reaches its buttons. Esc in it
 * closes a conflict or busy card (its entry stays on the row), never the unreachable one; when the card goes with the focus in
 * it, the focus goes back where it came from. Test hooks: `.mapstudio-save-card`, `data-card`, `data-batch-id`.
 */
export interface SaveCardProps {
    card: SaveCardData;
    /** The busy entry is being sent: its Discard waits for the answer. */
    sending: boolean;
    /** The connection's chip shows under the toolbar too: the card sits under it. */
    belowChip: boolean;
    onUseTheirs: (batchId: string) => void;
    onApplyOnTop: (batchId: string) => void;
    onRetry: (batchId: string) => void;
    onRetryStore: () => void;
    onDiscard: (batchId: string) => void;
    onShowEdits: () => void;
    /** Esc on a conflict or busy card. */
    onClose: (batchId: string) => void;
}

/** "Use Sam's version", or "Use their version" when the Gateway named nobody. */
export function useTheirsText(who: string): string {
    return who !== '' ? 'Use ' + who + "'s version" : 'Use their version';
}

/** "Show my 2 edits", "Show my edit". */
export function showEditsText(count: number): string {
    return count === 1 ? 'Show my edit' : 'Show my ' + count + ' edits';
}

export class SaveCard extends React.Component<SaveCardProps> {
    private readonly root = React.createRef<HTMLElement>();
    private readonly titleId = 'mapstudio-save-card-' + Math.random().toString(36).slice(2, 8);
    /** Where the focus came from when it entered the card, to go back to when the card goes with the focus in it. */
    private returnTo: HTMLElement | null = null;

    componentWillUnmount(): void {
        this.giveFocusBack();
    }

    private giveFocusBack(): void {
        const root = this.root.current;
        const back = this.returnTo;
        if (typeof document === 'undefined' || !root || !back || !root.contains(document.activeElement) || !back.isConnected) {
            return;
        }
        back.focus();
    }

    private onFocus = (ev: React.FocusEvent<HTMLElement>): void => {
        const from = ev.relatedTarget as HTMLElement | null;
        const root = this.root.current;
        if (from && root && !root.contains(from)) {
            this.returnTo = from;
        }
    };

    private onKeyDown = (ev: React.KeyboardEvent<HTMLElement>): void => {
        const card = this.props.card;
        if (ev.key === 'Escape' && card.kind !== 'unreachable') {
            ev.preventDefault();
            ev.stopPropagation();
            this.giveFocusBack();
            this.props.onClose(card.batchId);
        }
    };

    private buttons(): React.ReactNode {
        const p = this.props;
        const card = p.card;
        if (card.kind === 'conflict') {
            return (
                <React.Fragment>
                    <button type="button" className="mapstudio-button mapstudio-save-card-theirs" onClick={() => p.onUseTheirs(card.batchId)}>
                        {useTheirsText(card.who)}
                    </button>
                    {card.onTop ? (
                        <button type="button" className="mapstudio-button mapstudio-button--primary mapstudio-save-card-ontop"
                                onClick={() => p.onApplyOnTop(card.batchId)}>Apply mine on top</button>
                    ) : null}
                </React.Fragment>
            );
        }
        if (card.kind === 'unreachable') {
            return (
                <React.Fragment>
                    <button type="button" className="mapstudio-button mapstudio-button--primary mapstudio-save-card-retry" onClick={p.onRetryStore}>Try again</button>
                    <button type="button" className="mapstudio-button mapstudio-save-card-show" onClick={p.onShowEdits}>{showEditsText(card.count)}</button>
                </React.Fragment>
            );
        }
        return (
            <React.Fragment>
                <button type="button" className="mapstudio-button mapstudio-button--primary mapstudio-save-card-retry"
                        onClick={() => p.onRetry(card.batchId)}>Try again</button>
                <button type="button" className="mapstudio-button mapstudio-save-card-discard" disabled={p.sending}
                        title={p.sending ? 'Being sent; wait for the answer.' : undefined}
                        onClick={() => p.onDiscard(card.batchId)}>Discard my change</button>
            </React.Fragment>
        );
    }

    render(): React.ReactNode {
        const card = this.props.card;
        const closable = card.kind !== 'unreachable';
        return (
            <section ref={this.root} role="alert" aria-labelledby={this.titleId}
                     className={'mapstudio-save-card mapstudio-save-card--' + card.kind + (this.props.belowChip ? ' mapstudio-save-card--below-chip' : '')}
                     data-card={card.kind} data-batch-id={card.batchId} data-position={card.position} data-on-top={card.onTop ? 'true' : 'false'}
                     aria-keyshortcuts={closable ? 'Escape' : undefined} onKeyDown={this.onKeyDown} onFocus={this.onFocus}>
                <div className="mapstudio-save-card-head">
                    <ChromeGlyph name={card.kind === 'unreachable' ? 'cloud' : 'warning'} className="mapstudio-save-card-glyph" size={16} />
                    <h3 id={this.titleId} className="mapstudio-save-card-title">{card.title}</h3>
                    {card.position !== '' ? <span className="mapstudio-save-card-position">{card.position}</span> : null}
                </div>
                <p className="mapstudio-save-card-text">{card.text}</p>
                {card.kept !== '' ? <p className="mapstudio-save-card-kept">{card.kept}</p> : null}
                <div className="mapstudio-save-card-actions">{this.buttons()}</div>
            </section>
        );
    }
}
