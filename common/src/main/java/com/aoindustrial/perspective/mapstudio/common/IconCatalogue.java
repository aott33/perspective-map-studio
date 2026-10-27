package com.aoindustrial.perspective.mapstudio.common;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

/**
 * The icons Map Studio ships (story 2.10, epic R9): the catalogue
 * {@code icons.json} beside this class, built from {@code web/icons/sources.json}
 * by {@code web/scripts/icons.mjs}. A kind names an icon by its id; the kind
 * list check uses {@link #contains(String)} and falls back to {@link #FALLBACK}.
 */
public final class IconCatalogue {

    /** The catalogue resource, next to this class. */
    public static final String RESOURCE = "icons.json";

    /** The icon a kind with no icon, or an unknown one, is drawn with. */
    public static final String FALLBACK = "point";

    /** One catalogue entry. {@code geometry} is null for a state glyph. */
    public static final class Icon {
        public final String id;
        public final String label;
        public final String group;
        public final String geometry;

        Icon(String id, String label, String group, String geometry) {
            this.id = id;
            this.label = label;
            this.group = group;
            this.geometry = geometry;
        }
    }

    private static volatile IconCatalogue shipped;

    private final String version;
    private final Map<String, Icon> icons;

    private IconCatalogue(String version, Map<String, Icon> icons) {
        this.version = version;
        this.icons = Collections.unmodifiableMap(icons);
    }

    /** The catalogue shipped in the module, read once. */
    public static IconCatalogue shipped() {
        IconCatalogue c = shipped;
        if (c == null) {
            synchronized (IconCatalogue.class) {
                c = shipped;
                if (c == null) {
                    try (InputStream in = IconCatalogue.class.getResourceAsStream(RESOURCE)) {
                        if (in == null) {
                            throw new IllegalStateException("The icon catalogue " + RESOURCE + " is missing from the module.");
                        }
                        c = parse(new InputStreamReader(in, StandardCharsets.UTF_8));
                    } catch (IOException e) {
                        throw new IllegalStateException("The icon catalogue " + RESOURCE + " cannot be read.", e);
                    }
                    shipped = c;
                }
            }
        }
        return c;
    }

    /** Parses a catalogue in the {@code icons.json} shape. */
    public static IconCatalogue parse(Reader reader) {
        JsonObject root = JsonParser.parseReader(reader).getAsJsonObject();
        String version = root.get("version").getAsString();
        Map<String, Icon> icons = new LinkedHashMap<>();
        JsonArray list = root.getAsJsonArray("icons");
        for (JsonElement e : list) {
            JsonObject o = e.getAsJsonObject();
            JsonElement geometry = o.get("geometry");
            Icon icon = new Icon(
                o.get("id").getAsString(),
                o.get("label").getAsString(),
                o.get("group").getAsString(),
                geometry == null || geometry.isJsonNull() ? null : geometry.getAsString());
            icons.put(icon.id, icon);
        }
        if (!icons.containsKey(FALLBACK)) {
            throw new IllegalStateException("The icon catalogue has no fallback icon " + FALLBACK + ".");
        }
        return new IconCatalogue(version, icons);
    }

    /** The catalogue version, part of the public contract (NFR-8). */
    public String version() {
        return version;
    }

    /** True when {@code id} names an icon in the catalogue. */
    public boolean contains(String id) {
        return id != null && icons.containsKey(id);
    }

    /** Every icon id, in catalogue order. */
    public Set<String> ids() {
        return icons.keySet();
    }

    /** The entry for {@code id}, or null. */
    public Icon get(String id) {
        return id == null ? null : icons.get(id);
    }

    /** The ids of the icons a kind may name (group {@code kind}). */
    public List<String> kindIcons() {
        List<String> out = new ArrayList<>();
        for (Icon icon : icons.values()) {
            if ("kind".equals(icon.group)) {
                out.add(icon.id);
            }
        }
        return out;
    }

    /**
     * The icon a kind is drawn with: its own when the catalogue has it, else
     * {@link #FALLBACK}. A missing name is not a problem; an unknown one is
     * reported by the caller (phase B, the kind list check).
     */
    public String resolve(String id) {
        return contains(id) ? id : FALLBACK;
    }
}
