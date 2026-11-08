/**
 * The first-run checklist and the viewer's note (epic 4 entry 7b; DESIGN.md first-run-checklist, key screen 8;
 * EXPERIENCE.md First-run checklist, Surface states). Pure functions only, unit tested in node; the component
 * (studio/FirstRunChecklist.tsx, MapStudio.tsx) renders what they say.
 *
 * The card shows in Edit mode (the studio on) while the map has loaded with no items, is not hidden and no tool is in hand.
 * Its three steps tick from what the map really holds: (1) a kind setup exists, (2) the map has an item (which also ends
 * the empty map, and so the card), (3) View mode was opened from the card. Hide and step 3 are kept per project and user in
 * localStorage, null-safe as unsaved.ts' queue is (a private window, blocked site data: nothing kept, nothing thrown).
 * In View mode on a loaded map with no items every user sees a short note instead.
 */

import { KeyValueStore } from './unsaved';

/** What the card and the note are decided from. */
export interface FirstRunFacts {
    /** Edit mode's studio shows (MapStudio.studioOn: Edit mode at level full, never on a phone). */
    studioOn: boolean;
    /** map.load answered and the map is drawn. */
    loaded: boolean;
    /** Map items on the map (not deleted), this page's unsaved creates included. */
    itemCount: number;
    /** A tool is in hand (the toolbar's or the list's Add item), or a line or area is being drawn. */
    toolInHand: boolean;
    /** The kept flags of this project and user. */
    kept: FirstRunKept;
}

/** The flags kept per project and user. */
export interface FirstRunKept {
    /** Hide checklist was pressed. */
    hidden: boolean;
    /** Open view mode was pressed on the card (step 3 done). */
    viewed: boolean;
}

export const FIRST_RUN_NONE: FirstRunKept = { hidden: false, viewed: false };

/** The empty map: loaded and holding no item. */
export function emptyMap(facts: Pick<FirstRunFacts, 'loaded' | 'itemCount'>): boolean {
    return facts.loaded && facts.itemCount === 0;
}

/** Whether the first-run card shows: Edit mode, an empty loaded map, not hidden, no tool in hand. */
export function checklistShows(facts: FirstRunFacts): boolean {
    return facts.studioOn && emptyMap(facts) && !facts.kept.hidden && !facts.toolInHand;
}

/** Whether the viewer's note shows: View mode (the studio off) on an empty loaded map, for every user. */
export function viewerNoteShows(facts: Pick<FirstRunFacts, 'studioOn' | 'loaded' | 'itemCount'>): boolean {
    return !facts.studioOn && emptyMap(facts);
}

/** The three steps' done flags, in order. */
export function stepsDone(kindSetupCount: number, itemCount: number, kept: FirstRunKept): [boolean, boolean, boolean] {
    return [kindSetupCount > 0, itemCount > 0, kept.viewed];
}

/** The footer's count: "N of 3 done". */
export function doneText(done: readonly boolean[]): string {
    return done.filter((d) => d).length + ' of ' + done.length + ' done';
}

/** The card's title: "Get <project> on the map", the name the list's header uses. */
export function checklistTitle(project: string): string {
    return 'Get ' + project + ' on the map';
}

export const CHECKLIST_SUBLINE = 'Three steps. Edits save as you go.';

/** Step 1's help, with the number of kinds the host's kind list defines (no count while the list is empty or failed). */
export function kindsHelp(kindCount: number): string {
    if (kindCount <= 0) {
        // The host's kind list empty or failed: no count to give.
        return 'Choose icons, key values, comms and alarms for this project\'s kinds.';
    }
    return 'Choose icons, key values, comms and alarms for the ' + kindCount + (kindCount === 1 ? ' kind' : ' kinds')
        + ' this project defines.';
}

export const ADD_HELP = 'Click a kind in the toolbar and click the map. Importing a CSV, KML or GeoJSON file comes later.';
export const VIEW_HELP = 'See the map the way operators will, with live values.';
export const VIEWER_NOTE = 'Nothing on this map yet.';

const FIRST_RUN_PREFIX = 'mapstudio.firstrun.v1:';

/** The key of one project's and user's kept flags, as unsaved.ts keys its queue. */
export function firstRunKey(project: string, user: string): string {
    return FIRST_RUN_PREFIX + project + ':' + user;
}

/** The kept flags under `key`, or none (nothing kept, unreadable, or a store that refuses). */
export function readKept(store: KeyValueStore | null, key: string | null): FirstRunKept {
    if (!store || key === null) {
        return FIRST_RUN_NONE;
    }
    try {
        const raw = store.getItem(key);
        const value: unknown = raw ? JSON.parse(raw) : null;
        if (!value || typeof value !== 'object') {
            return FIRST_RUN_NONE;
        }
        const v = value as Record<string, unknown>;
        return { hidden: v.hidden === true, viewed: v.viewed === true };
    } catch (err) {
        return FIRST_RUN_NONE;
    }
}

/** Keep one flag on under `key`, with the others kept; a refusing store is ignored. Returns the flags now. */
export function keepFlag(store: KeyValueStore | null, key: string | null, flag: keyof FirstRunKept): FirstRunKept {
    const next = { ...readKept(store, key), [flag]: true };
    if (store && key !== null) {
        try {
            store.setItem(key, JSON.stringify(next));
        } catch (err) {
            // The checklist is a convenience: without storage the flag holds for this page only.
        }
    }
    return next;
}
