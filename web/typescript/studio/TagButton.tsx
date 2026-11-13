import * as React from 'react';
import { ChromeGlyph } from './ChromeGlyph';

/**
 * The tag icon button at the end of a path, "Pick a tag" (entry 13b; `.mapstudio-tag-button[data-tag-for]`): one markup for a
 * kind's setup, an item's own paths and the style rule's path. It opens the tag browser for that path; `open` is the card
 * being open for it. `onMouseDown` is for a field that must not finish before the press.
 */
export function tagButton(o: {
    tagFor: string; open: boolean; disabled: boolean; label: string; onClick: () => void;
    onMouseDown?: (ev: React.MouseEvent<HTMLButtonElement>) => void;
}): React.ReactElement {
    return (
        <button type="button" className={'mapstudio-dock-button mapstudio-tag-button' + (o.open ? ' mapstudio-tag-button--open' : '')}
                data-tag-for={o.tagFor} disabled={o.disabled} title="Pick a tag" aria-label={o.label}
                aria-haspopup="dialog" aria-expanded={o.open} onMouseDown={o.onMouseDown} onClick={o.onClick}>
            <ChromeGlyph name="tag" size={16} />
        </button>
    );
}
