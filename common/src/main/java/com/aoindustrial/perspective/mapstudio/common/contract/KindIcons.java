package com.aoindustrial.perspective.mapstudio.common.contract;

import java.util.ArrayList;
import java.util.List;

import com.aoindustrial.perspective.mapstudio.common.IconCatalogue;

/**
 * The icon check of a kind list (story 2.10, docs/icons.md): every kind whose
 * {@code icon} names an icon Map Studio does not ship. Such a kind stays in the
 * list and is drawn with {@link IconCatalogue#FALLBACK}; a kind with no icon
 * uses the fallback too and is not reported.
 *
 * <p>{@link #note()} is the plain-words sentence a status message adds (kind
 * ids and icon names echoed as one short line each, first
 * {@link #MAX_NAMED} kinds); {@link #viewerNote()} is the same without names,
 * for a session that cannot edit; {@link #logNote()} names the kind ids only
 * (no row values in a Gateway log line, docs/kinds-and-assets.md);
 * {@link #key()} identifies the set, so a caller logs one line when it changes.
 */
public record KindIcons(List<String> unknown, String note, String viewerNote, String logNote, String key) {

    /** At most this many kinds are named in a note. */
    public static final int MAX_NAMED = 3;

    /** No kind names an unknown icon. */
    public static final KindIcons NONE = new KindIcons(List.of(), "", "", "", "");

    /** Check {@code kinds} against {@code catalogue}. */
    public static KindIcons check(List<Kind> kinds, IconCatalogue catalogue) {
        List<String> named = new ArrayList<>();
        List<String> ids = new ArrayList<>();
        List<String> keys = new ArrayList<>();
        for (Kind kind : kinds) {
            String icon = kind.icon();
            if (icon == null || icon.isEmpty() || catalogue.contains(icon)) {
                continue;
            }
            keys.add(kind.id() + "=" + icon);
            if (named.size() < MAX_NAMED) {
                ids.add(Rows.echo(kind.id()));
                named.add("Kind " + Rows.echo(kind.id()) + " names icon " + Rows.echo(icon)
                    + ", which Map Studio does not have; it shows as a plain " + IconCatalogue.FALLBACK + ".");
            }
        }
        if (keys.isEmpty()) {
            return NONE;
        }
        int n = keys.size();
        int more = n - named.size();
        String note = String.join(" ", named) + (more == 0 ? ""
            : " " + more + " more " + (more == 1 ? "kind names an unknown icon." : "kinds name unknown icons."));
        String viewerNote = n + (n == 1 ? " kind names an icon" : " kinds name icons")
            + " Map Studio does not have and " + (n == 1 ? "shows" : "show") + " as a plain " + IconCatalogue.FALLBACK + ".";
        String logNote = (n == 1 ? "Kind " : "Kinds ") + String.join(", ", ids)
            + (more > 0 ? " and " + more + " more" : "") + (n == 1 ? " names an icon" : " name icons")
            + " Map Studio does not have.";
        return new KindIcons(List.copyOf(keys), note, viewerNote, logNote, String.join("\n", keys));
    }

    /** True when no kind names an unknown icon. */
    public boolean isEmpty() {
        return unknown.isEmpty();
    }
}
