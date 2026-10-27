package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

/**
 * The setup form's lists read from the open project (epic 2 story 16), with no SDK type: the
 * project library's functions, the Perspective page URLs and the project's identity provider.
 * {@link ProjectResources} hands it the project's files.
 */
public final class ProjectLists {

    /** A top-level function of a project library script: {@code def name(} at column 0. */
    private static final Pattern DEF = Pattern.compile("(?m)^def[ \\t]+([A-Za-z_][A-Za-z0-9_]*)[ \\t]*\\(");

    /** The identity provider a Perspective project uses when its properties name none. */
    public static final String DEFAULT_IDP = "default";

    private ProjectLists() {
    }

    /**
     * What the form offers from the project.
     *
     * @param functions every top-level function as {@code package.function}, sorted; null when not read
     * @param pages the page URLs of the page configuration, sorted; null when not read
     * @param identityProvider the project's identity provider name
     */
    public record Snapshot(List<String> functions, List<String> pages, String identityProvider) {
        public Snapshot {
            functions = functions == null ? null : List.copyOf(functions);
            pages = pages == null ? null : List.copyOf(pages);
            identityProvider = identityProvider == null || identityProvider.isBlank() ? DEFAULT_IDP
                : identityProvider.trim();
        }

        /** Nothing read: no list, no warnings. */
        public static Snapshot unknown() {
            return new Snapshot(null, null, DEFAULT_IDP);
        }

        /** The functions the list offers: those whose name does not start with "_" (a private helper). */
        public List<String> offeredFunctions() {
            List<String> out = new ArrayList<>();
            if (functions != null) {
                for (String f : functions) {
                    if (!f.substring(f.lastIndexOf('.') + 1).startsWith("_")) {
                        out.add(f);
                    }
                }
            }
            return out;
        }
    }

    /**
     * The project's lists.
     *
     * @param scripts each script resource's folder path ({@code a/b}) and its {@code code.py}
     * @param pageConfig the page configuration's {@code config.json}, or null
     * @param generalProperties the Perspective general properties' JSON, or null
     */
    public static Snapshot of(Map<String, String> scripts, String pageConfig, String generalProperties) {
        TreeSet<String> functions = new TreeSet<>(Comparator.comparing((String s) -> s.toLowerCase(Locale.ROOT))
            .thenComparing(s -> s));
        if (scripts != null) {
            scripts.forEach((path, code) -> functions.addAll(functions(path, code)));
        }
        return new Snapshot(new ArrayList<>(functions), pages(pageConfig), identityProvider(generalProperties));
    }

    /** The top-level functions of one script, as {@code a.b.name} for the script at {@code a/b}. */
    public static List<String> functions(String scriptPath, String code) {
        List<String> out = new ArrayList<>();
        if (scriptPath == null || scriptPath.isBlank() || code == null) {
            return out;
        }
        String pkg = scriptPath.replaceAll("^/+|/+$", "").replace('/', '.');
        Matcher m = DEF.matcher(code);
        while (m.find()) {
            String name = pkg + "." + m.group(1);
            if (!out.contains(name)) {
                out.add(name);
            }
        }
        return out;
    }

    /**
     * The page URLs of a page configuration ({@code pages} keys), sorted; null (no list, so no
     * warnings) when there is no page configuration or it cannot be read, for example an
     * inherited one {@code getResourcesOfType} might leave out [unverified].
     */
    public static List<String> pages(String configJson) {
        JsonObject o = object(configJson);
        if (o == null || !o.has("pages") || !o.get("pages").isJsonObject()) {
            return null;
        }
        List<String> out = new ArrayList<>(o.getAsJsonObject("pages").keySet());
        out.sort(Comparator.naturalOrder());
        return out;
    }

    /** The {@code idp} of the Perspective general properties, or {@link #DEFAULT_IDP}. */
    public static String identityProvider(String generalProperties) {
        JsonObject o = object(generalProperties);
        if (o != null && o.has("idp") && o.get("idp").isJsonPrimitive()) {
            String idp = o.get("idp").getAsString();
            if (!idp.isBlank()) {
                return idp.trim();
            }
        }
        return DEFAULT_IDP;
    }

    /**
     * True when {@code value} names one of {@code pages}: each segment equal, a page's
     * {@code :param} segment matching any segment, and a value's placeholder segment matching a
     * page's {@code :param}. A query string is ignored.
     */
    public static boolean isPage(String value, List<String> pages) {
        String path = value;
        int q = path.indexOf('?');
        if (q >= 0) {
            path = path.substring(0, q);
        }
        String[] v = segments(path);
        for (String page : pages) {
            String[] p = segments(page);
            if (p.length != v.length) {
                continue;
            }
            boolean same = true;
            for (int i = 0; i < p.length && same; i++) {
                same = p[i].equals(v[i]) || p[i].startsWith(":") || (v[i].contains("{") && p[i].startsWith(":"));
            }
            if (same) {
                return true;
            }
        }
        return false;
    }

    /** A page URL as the alarm page field takes it: each {@code :param} becomes {@code {item.name}}. */
    public static String asAlarmPage(String pageUrl) {
        String[] p = segments(pageUrl);
        StringBuilder sb = new StringBuilder();
        for (String s : p) {
            sb.append('/').append(s.startsWith(":") ? "{item.name}" : s);
        }
        return sb.length() == 0 ? "/" : sb.toString();
    }

    private static String[] segments(String path) {
        String trimmed = path.replaceAll("^/+|/+$", "");
        return trimmed.isEmpty() ? new String[0] : trimmed.split("/+");
    }

    private static JsonObject object(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            JsonElement e = JsonParser.parseString(text);
            return e.isJsonObject() ? e.getAsJsonObject() : null;
        } catch (RuntimeException ex) {
            return null;
        }
    }
}
