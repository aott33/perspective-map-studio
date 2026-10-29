package com.aoindustrial.perspective.mapstudio.gateway.live;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;

import com.aoindustrial.perspective.mapstudio.common.contract.Asset;
import com.aoindustrial.perspective.mapstudio.common.contract.InvalidValue;
import com.aoindustrial.perspective.mapstudio.common.contract.Kind;
import com.aoindustrial.perspective.mapstudio.common.contract.KindDisplay;
import com.aoindustrial.perspective.mapstudio.common.contract.KindSetupRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.Placeholders;
import com.aoindustrial.perspective.mapstudio.common.contract.StyleRule;

/**
 * What one project subscribes to (AD-6, AD-16, epic 3 entry 5), worked out from its live kind
 * setups, its live map items and the asset list, pure: for every map item of a kind with a
 * setup, the full tag path of each slot its setup turns on, and the slots that cannot be
 * resolved with a plain-words reason (never a path: viewers get the reasons).
 *
 * <ul>
 * <li>{@code {asset.path}} and {@code {asset.path}/<suffix>} resolve from the item's own asset
 *     (owner, 2026-10-27): no asset linked, or an asset the list does not have, is a problem.</li>
 * <li>A full path is the same tag for every item of the kind.</li>
 * <li>An item's overrides replace the kind's comms and alarms parts and, by key, a KPI's path and
 *     switch, with full paths only (docs/kind-setup.md); anything else in them is ignored.</li>
 * <li>Slots: {@code comms}, {@code kpi:<key>} for each KPI that is on, the three alarm
 *     metrics of the alarms path ({@link AlarmMetrics}), and {@code style}, the style rule's source
 *     (epic 3 entry 1): a {@code {path}} resolved like any other, or a {@code {kpi}} sharing that
 *     KPI's path (subscribed even when the KPI is off, since the rule names it); an item's
 *     {@code overrides.styleRule} replaces the kind's whole rule; the instruments source makes no
 *     slot but keeps the line planned, since its look is worked out from its instruments at each
 *     batch build (entry 2). A part turned off is never subscribed.</li>
 * <li>Instruments on lines (entry 2, AD-19): every live map item with an attachment is indexed under
 *     its line in order of distance, with the icon KPI its kind setup names ({@link KindDisplay#iconKpi}:
 *     an instrument with one measures and bounds a segment; one without, a line valve, does not), and
 *     each line's snapped ends are kept, so the cache can grade the segments and an open line popup
 *     can push every instrument on it.</li>
 * </ul>
 */
public final class ValuePlan {

    public static final String COMMS = "comms";
    public static final String KPI_PREFIX = "kpi:";
    public static final String ALARMS = "alarms";
    public static final String STYLE = "style";
    static final String ALARM_ACKED = "alarm:acked";
    static final String ALARM_UNACKED = "alarm:unacked";
    static final String ALARM_PRIORITY = "alarm:priority";

    static final String NO_ASSET = "no asset is linked";
    static final String ASSET_MISSING = "the linked asset is not in the asset list";
    static final String NOT_A_PATH = "the tag path is not a full path or an {asset.path} path";
    static final String NO_SUCH_KPI = "the style rule names a KPI the setup does not have";

    /** A slot that could not be resolved, with the reason in plain words. */
    public record Problem(String slot, String reason) {
        public JsonObject toJson() {
            JsonObject o = new JsonObject();
            o.addProperty("slot", slot);
            o.addProperty("reason", reason);
            return o;
        }
    }

    /**
     * One map item's style rule as the cache evaluates it: the rule (States or Bands evaluate
     * themselves) and, for an expression rule, its compiled expression (one per distinct text per
     * plan, shared by the items that use it).
     */
    public record Style(StyleRule rule, StyleExpressions.Compiled expression) {
    }

    /** One map item's slots (slot name to full path), problems, and its style rule (null without one). */
    public record ItemPlan(String id, String kind, Map<String, String> slots, List<Problem> problems, Style style) {

        public ItemPlan(String id, String kind, Map<String, String> slots, List<Problem> problems) {
            this(id, kind, slots, problems, null);
        }
    }

    /**
     * One instrument attached to a line (entry 2): its id and name, its distance along the line, and
     * the icon KPI its kind setup names (null when it has none: it sits on a segment and bounds none).
     */
    public record Instrument(String id, String name, double distanceM, String iconKpi) {
        public boolean measures() {
            return iconKpi != null;
        }
    }

    /** The map items a line's ends snap to (null for a floating end). */
    public record Ends(String start, String end) {
    }

    /**
     * The project's plan: items by id, the distinct paths, the items each path serves, the kind
     * display list, the instruments attached to each line in order of distance, and each line's ends.
     */
    public record Plan(Map<String, ItemPlan> items, Set<String> paths, Map<String, Set<String>> itemsByPath,
                       List<KindDisplay> display, Map<String, List<Instrument>> instrumentsByLine, Map<String, Ends> ends) {

        /** A plan with no instruments and no ends (entry 5's shape). */
        public Plan(Map<String, ItemPlan> items, Set<String> paths, Map<String, Set<String>> itemsByPath,
                    List<KindDisplay> display) {
            this(items, paths, itemsByPath, display, Map.of(), Map.of());
        }

        public int problemCount() {
            int n = 0;
            for (ItemPlan item : items.values()) {
                n += item.problems().size();
            }
            return n;
        }

        /** The instruments attached to the line, in order of distance (empty for none or not a line). */
        public List<Instrument> instrumentsOf(String lineId) {
            List<Instrument> list = instrumentsByLine.get(lineId);
            return list == null ? List.of() : list;
        }

        /** The line's ends, or none snapped. */
        public Ends endsOf(String lineId) {
            Ends e = ends.get(lineId);
            return e == null ? new Ends(null, null) : e;
        }

        /** True when the planned item is a line whose style is the instruments source. */
        public boolean gradesSegments(String id) {
            ItemPlan item = items.get(id);
            return item != null && item.style() != null && item.style().rule().instruments();
        }

        /**
         * The lines whose segments a change of {@code instrumentId} regrades: the line it is attached
         * to, when that line's style is the instruments source.
         */
        public List<String> linesRegradedBy(String instrumentId) {
            List<String> out = new ArrayList<>();
            for (Map.Entry<String, List<Instrument>> e : instrumentsByLine.entrySet()) {
                if (!gradesSegments(e.getKey())) {
                    continue;
                }
                for (Instrument i : e.getValue()) {
                    if (i.id().equals(instrumentId)) {
                        out.add(e.getKey());
                        break;
                    }
                }
            }
            return out;
        }
    }

    public static final Plan EMPTY = new Plan(Map.of(), Set.of(), Map.of(), List.of());

    private ValuePlan() {
    }

    /** The plan with no kind list: expression rules take a point kind's presets. */
    public static Plan build(List<KindSetupRecord> setups, List<MapItemRecord> items, List<Asset> assets) {
        return build(setups, items, assets, List.of());
    }

    /**
     * The plan: {@code kinds} is the project's kind list, which the style rules' displays and the
     * expressions' preset lists read (a kind not in it counts as a point kind).
     */
    public static Plan build(List<KindSetupRecord> setups, List<MapItemRecord> items, List<Asset> assets,
                             List<Kind> kinds) {
        Map<String, Kind> kindById = new HashMap<>();
        for (Kind kind : kinds) {
            kindById.put(kind.id(), kind);
        }
        Map<String, JsonObject> setupByKind = new HashMap<>();
        Map<String, KindDisplay> displayByKind = new HashMap<>();
        List<KindDisplay> display = new ArrayList<>();
        for (KindSetupRecord record : setups) {
            if (record.deleted() || record.setup() == null) {
                continue;
            }
            setupByKind.put(record.kindId(), record.setup());
            KindDisplay d = KindDisplay.of(record.kindId(), record.setup(), kindById.get(record.kindId()));
            displayByKind.put(record.kindId(), d);
            display.add(d);
        }
        // The instruments of each line in order of distance (entry 2), and each line's snapped ends,
        // whatever the kind setups say: the popup lists an instrument with no setup too.
        Map<String, List<Instrument>> instrumentsByLine = new HashMap<>();
        Map<String, Ends> ends = new HashMap<>();
        for (MapItemRecord item : items) {
            if (item.deleted()) {
                continue;
            }
            if (item.attachment() != null) {
                KindDisplay d = displayByKind.get(item.kind());
                instrumentsByLine.computeIfAbsent(item.attachment().lineId(), k -> new ArrayList<>())
                    .add(new Instrument(item.id(), item.name(), item.attachment().distanceM(), d == null ? null : d.iconKpi()));
            }
            Ends e = ends(item.ends());
            if (e.start() != null || e.end() != null) {
                ends.put(item.id(), e);
            }
        }
        for (List<Instrument> list : instrumentsByLine.values()) {
            list.sort((a, b) -> {
                int byDistance = Double.compare(a.distanceM(), b.distanceM());
                return byDistance != 0 ? byDistance : a.id().compareTo(b.id());
            });
        }
        Map<String, List<Instrument>> frozen = new HashMap<>();
        instrumentsByLine.forEach((k, v) -> frozen.put(k, List.copyOf(v)));
        Map<String, StyleExpressions.Compiled> expressions = new HashMap<>();
        Map<String, Asset> assetById = new HashMap<>();
        for (Asset asset : assets) {
            assetById.put(asset.id(), asset);
        }
        Map<String, ItemPlan> plans = new LinkedHashMap<>();
        Set<String> paths = new HashSet<>();
        Map<String, Set<String>> byPath = new HashMap<>();
        for (MapItemRecord item : items) {
            if (item.deleted()) {
                continue;
            }
            JsonObject setup = setupByKind.get(item.kind());
            if (setup == null) {
                continue;
            }
            Kind kind = kindById.get(item.kind());
            ItemPlan plan = plan(item, setup, assetById,
                kind == null ? new Kind(item.kind(), item.kind(), "point", null, 0, List.of()) : kind, expressions);
            if (plan.slots().isEmpty() && plan.problems().isEmpty() && plan.style() == null) {
                continue;
            }
            plans.put(item.id(), plan);
            for (String path : plan.slots().values()) {
                paths.add(path);
                byPath.computeIfAbsent(path, p -> new HashSet<>()).add(item.id());
            }
        }
        return new Plan(Map.copyOf(plans), Set.copyOf(paths), Map.copyOf(byPath), List.copyOf(display),
            Map.copyOf(frozen), Map.copyOf(ends));
    }

    /** The stored {@code ends} ({@code {start: {itemId}, end: {itemId}}}) as the two ids, null where not snapped. */
    static Ends ends(JsonElement ends) {
        if (ends == null || !ends.isJsonObject()) {
            return new Ends(null, null);
        }
        return new Ends(endId(ends.getAsJsonObject().get("start")), endId(ends.getAsJsonObject().get("end")));
    }

    private static String endId(JsonElement end) {
        if (end == null || !end.isJsonObject()) {
            return null;
        }
        String id = text(end.getAsJsonObject(), "itemId");
        return id == null || id.isBlank() ? null : id;
    }

    private static ItemPlan plan(MapItemRecord item, JsonObject setup, Map<String, Asset> assets, Kind kind,
                                 Map<String, StyleExpressions.Compiled> expressions) {
        Map<String, String> slots = new LinkedHashMap<>();
        List<Problem> problems = new ArrayList<>();
        JsonObject overrides = item.overrides() == null ? new JsonObject() : item.overrides();
        Asset asset = item.assetId() == null ? null : assets.get(item.assetId());
        Placeholders.ItemView view = new Placeholders.ItemView(item.id(), item.name(), item.assetId(),
            asset == null ? null : asset.basePath(), item.properties());

        JsonObject comms = part(setup, overrides, "comms");
        if (comms != null && on(comms, "on")) {
            resolve(COMMS, text(comms, "path"), item, asset, view, slots, problems);
        }
        // Every KPI's path, on or off: a style rule may name an off KPI as its source.
        Map<String, String> kpiPaths = new LinkedHashMap<>();
        for (JsonObject kpi : kpis(setup, overrides)) {
            String key = text(kpi, "key");
            if (key == null) {
                continue;
            }
            kpiPaths.put(key, text(kpi, "path"));
            if (!on(kpi, "on")) {
                continue;
            }
            resolve(KPI_PREFIX + key, text(kpi, "path"), item, asset, view, slots, problems);
        }
        Style style = style(item, setup, overrides, kpiPaths, asset, view, slots, problems, kind, expressions);
        JsonObject alarms = part(setup, overrides, "alarms");
        if (alarms != null) {
            Map<String, String> folder = new LinkedHashMap<>();
            resolve(ALARMS, text(alarms, "path"), item, asset, view, folder, problems);
            String base = folder.get(ALARMS);
            if (base != null) {
                slots.put(ALARM_ACKED, AlarmMetrics.path(base, AlarmMetrics.ACTIVE_ACKED));
                slots.put(ALARM_UNACKED, AlarmMetrics.path(base, AlarmMetrics.ACTIVE_UNACKED));
                slots.put(ALARM_PRIORITY, AlarmMetrics.path(base, AlarmMetrics.HIGHEST_ACTIVE));
            }
        }
        return new ItemPlan(item.id(), item.kind(), Map.copyOf(slots), List.copyOf(problems), style);
    }

    /**
     * The item's style rule and its source slot: the item's own {@code overrides.styleRule} (an
     * override's {@code {path}} must be full) replaces the kind's. A {@code {kpi}} source takes
     * that KPI's path as the item sees it (its override applied); the instruments source makes no
     * slot and is kept as the item's style, with no expression (entry 2: the cache grades the line's
     * segments from its instruments at each batch build). An expression that does not parse (the
     * write path refuses one, so only an older or hand-written row) is a problem and no slot.
     */
    private static Style style(MapItemRecord item, JsonObject setup, JsonObject overrides, Map<String, String> kpiPaths,
                               Asset asset, Placeholders.ItemView view, Map<String, String> slots, List<Problem> problems,
                               Kind kind, Map<String, StyleExpressions.Compiled> expressions) {
        StyleRule rule = null;
        JsonElement over = overrides.get("styleRule");
        if (over != null && over.isJsonObject()) {
            StyleRule candidate = StyleRule.read(over);
            if (candidate != null && (candidate.path() == null || isFull(candidate.path()))) {
                rule = candidate;
            }
        }
        if (rule == null) {
            rule = StyleRule.read(setup.get("styleRule"));
        }
        if (rule == null) {
            return null;
        }
        if (rule.instruments()) {
            return new Style(rule, null);
        }
        String template;
        if (rule.kpi() != null) {
            if (!kpiPaths.containsKey(rule.kpi())) {
                problems.add(new Problem(STYLE, NO_SUCH_KPI));
                return null;
            }
            template = kpiPaths.get(rule.kpi());
        } else {
            template = rule.path();
        }
        if (template == null) {
            problems.add(new Problem(STYLE, NOT_A_PATH));
            return null;
        }
        StyleExpressions.Compiled compiled = null;
        if (StyleRule.EXPRESSION.equals(rule.type())) {
            String key = kind.id() + "\n" + rule.expression();
            if (!expressions.containsKey(key)) {
                try {
                    expressions.put(key, StyleExpressions.compile(rule.expression(), kind));
                } catch (InvalidValue ex) {
                    expressions.put(key, null);
                    problems.add(new Problem(STYLE, ex.getMessage()));
                    return null;
                }
            }
            compiled = expressions.get(key);
            if (compiled == null) {
                problems.add(new Problem(STYLE, "the expression could not be read"));
                return null;
            }
        }
        int before = problems.size();
        resolve(STYLE, template, item, asset, view, slots, problems);
        if (!slots.containsKey(STYLE)) {
            if (problems.size() == before) {
                problems.add(new Problem(STYLE, NOT_A_PATH));
            }
            return null;
        }
        return new Style(rule, compiled);
    }

    /** The kind's part, or the item's override of it when that is an object with a full path. */
    private static JsonObject part(JsonObject setup, JsonObject overrides, String name) {
        JsonElement o = overrides.get(name);
        if (o != null && o.isJsonObject() && isFull(text(o.getAsJsonObject(), "path"))) {
            return o.getAsJsonObject();
        }
        JsonElement s = setup.get(name);
        return s != null && s.isJsonObject() ? s.getAsJsonObject() : null;
    }

    /** The kind's KPIs with the item's override of each key applied (path and switch, full paths only). */
    private static List<JsonObject> kpis(JsonObject setup, JsonObject overrides) {
        List<JsonObject> out = new ArrayList<>();
        JsonElement k = setup.get("kpis");
        if (k == null || !k.isJsonArray()) {
            return out;
        }
        Map<String, JsonObject> byKey = new HashMap<>();
        JsonElement ov = overrides.get("kpis");
        if (ov != null && ov.isJsonArray()) {
            for (JsonElement e : ov.getAsJsonArray()) {
                if (e.isJsonObject() && text(e.getAsJsonObject(), "key") != null
                        && isFull(text(e.getAsJsonObject(), "path"))) {
                    byKey.put(text(e.getAsJsonObject(), "key"), e.getAsJsonObject());
                }
            }
        }
        for (JsonElement e : k.getAsJsonArray()) {
            if (!e.isJsonObject()) {
                continue;
            }
            JsonObject kpi = e.getAsJsonObject().deepCopy();
            JsonObject over = byKey.get(text(kpi, "key"));
            if (over != null) {
                kpi.add("path", over.get("path"));
                if (over.has("on")) {
                    kpi.add("on", over.get("on"));
                }
            }
            out.add(kpi);
        }
        return out;
    }

    private static void resolve(String slot, String template, MapItemRecord item, Asset asset,
                                Placeholders.ItemView view, Map<String, String> slots, List<Problem> problems) {
        if (template == null) {
            return;
        }
        if (isFull(template)) {
            slots.put(slot, template);
            return;
        }
        if (!template.startsWith(Placeholders.ASSET_PATH)) {
            problems.add(new Problem(slot, NOT_A_PATH));
            return;
        }
        if (item.assetId() == null) {
            problems.add(new Problem(slot, NO_ASSET));
            return;
        }
        if (asset == null) {
            problems.add(new Problem(slot, ASSET_MISSING));
            return;
        }
        String full = Placeholders.fill(template, view);
        if (full == null || !isFull(full)) {
            problems.add(new Problem(slot, NOT_A_PATH));
            return;
        }
        slots.put(slot, full);
    }

    static boolean isFull(String s) {
        return s != null && s.startsWith("[") && s.indexOf(']') > 1 && s.indexOf('{') < 0;
    }

    private static boolean on(JsonObject o, String key) {
        JsonElement v = o.get(key);
        return v == null || !v.isJsonPrimitive() || !v.getAsJsonPrimitive().isBoolean() || v.getAsBoolean();
    }

    private static String text(JsonObject o, String key) {
        JsonElement v = o.get(key);
        return v != null && v.isJsonPrimitive() && v.getAsJsonPrimitive().isString() ? v.getAsString() : null;
    }

    public static JsonArray problemsJson(List<Problem> problems) {
        JsonArray a = new JsonArray();
        problems.forEach(p -> a.add(p.toJson()));
        return a;
    }
}
