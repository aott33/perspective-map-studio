import * as React from 'react';
import { TOAST_MS } from '../drawing';
import { ChromeGlyph } from './ChromeGlyph';

/**
 * The toast and Undo bar (epic 4 entry 4; DESIGN.md toast-undo-bar, EXPERIENCE.md Toast / Undo bar): a dark
 * bar bottom-centre after an add, with a check, the message ("Pipeline added and saved") and Undo, the undo
 * stack's last step and nothing new. It hides itself after TOAST_MS, paused while the pointer rests on it
 * (entry 10 may refine the timing), and never sits in the bottom-right corner, which is the App Bar toggle's.
 */
export interface ToastProps {
    message: string;
    /** The Undo button's step ("Undo: add Pipeline"), or '' when nothing can be undone (the button is then disabled). */
    undoLabel: string;
    /** Above the drawing bar while a drawing tool is still in hand, so the two never cover each other. */
    above?: boolean;
    onUndo: () => void;
    onClose: () => void;
}

export class Toast extends React.Component<ToastProps> {
    private timer: ReturnType<typeof setTimeout> | null = null;

    componentDidMount(): void {
        this.start();
    }

    componentWillUnmount(): void {
        this.stop();
    }

    private start = (): void => {
        this.stop();
        this.timer = setTimeout(() => {
            this.timer = null;
            this.props.onClose();
        }, TOAST_MS);
    };

    private stop = (): void => {
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    };

    render(): React.ReactElement {
        return (
            <div className={'mapstudio-toast' + (this.props.above ? ' mapstudio-toast--above' : '')} role="status" data-message={this.props.message}
                 onMouseEnter={this.stop} onMouseLeave={this.start}>
                <ChromeGlyph name="check" className="mapstudio-toast-glyph" size={18} />
                <span className="mapstudio-toast-text">{this.props.message}</span>
                <button type="button" className="mapstudio-toast-undo" disabled={this.props.undoLabel === ''} title={this.props.undoLabel || 'Nothing to undo'}
                        aria-label={this.props.undoLabel || 'Undo'} onClick={this.props.onUndo}>Undo</button>
            </div>
        );
    }
}
