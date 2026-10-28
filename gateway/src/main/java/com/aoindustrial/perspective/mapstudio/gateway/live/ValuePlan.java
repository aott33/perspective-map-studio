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
import com.aoindustrial.perspective.mapstudio.common.contract.KindDisplay;
import com.aoindustrial.perspective.mapstudio.common.contract.KindSetupRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.Placeholders;

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
 * <li>Slots: {@code comms}, {@code kpi:<key>} for each KPI that is on, and the three alarm
 *     metrics of the alarms path ({@link AlarmMetrics}); a part turned off is never subscribed.</li>
 * </ul>
 */
public final class ValuePlan {

    public static final String COMMS = "comms";
    public static final String KPI_PREFIX = "kpi:";
    public static final String ALARMS = "alarms";
    static final String ALARM_ACKED = "alarm:acked";
    static final String ALARM_UNACKED = "alarm:unacked";
    static final String ALARM_PRIORITY = "alarm:priority";

    static final String NO_ASSET = "no asset is linked";
    static final String ASSET_MISSING = "the linked asset is not in the asset list";
    static final String NOT_A_PATH = "the tag path is not a full path or an {asset.path} path";

    /** A slot that could not be resolved, with the reason in plain words. */
    public record Problem(String slot, String reason) {
        public JsonObject toJson() {
            JsonObject o = new JsonObject();
            o.addProperty("slot", slot);
            o.addProperty("reason", reason);
            return o;
        }
    }

    /** One map item's slots (slot name to full path) and problems. */
    public record ItemPlan(String id, String kind, Map<String, String> slots, List<Problem> problems) {
    }

    /** The project's plan: items by id, the distinct paths, the items each path serves, and the kind display list. */
    public record Plan(Map<String, ItemPlan> items, Set<String> paths, Map<String, Set<String>> itemsByPath,
                       List<KindDisplay> display) {

        public int problemCount() {
            int n = 0;
            for (ItemPlan item : items.values()) {
                n += item.problems().size();
            }
            return n;
        }
    }

    public static final Plan EMPTY = new Plan(Map.of(), Set.of(), Map.of(), List.of());

    private ValuePlan() {
    }

    public static Plan build(List<KindSetupRecord> setups, List<MapItemRecord> items, List<Asset> assets) {
        Map<String, JsonObject> setupByKind = new HashMap<>();
        List<KindDisplay> display = new ArrayList<>();
        for (KindSetupRecord record : setups) {
            if (record.deleted() || record.setup() == null) {
                continue;
            }
            setupByKind.put(record.kindId(), record.setup());
            display.add(KindDisplay.of(record.kindId(), record.setup()));
        }
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
            ItemPlan plan = plan(item, setup, assetById);
            if (plan.slots().isEmpty() && plan.problems().isEmpty()) {
                continue;
            }
            plans.put(item.id(), plan);
            for (String path : plan.slots().values()) {
                paths.add(path);
                byPath.computeIfAbsent(path, p -> new HashSet<>()).add(item.id());
            }
        }
        return new Plan(Map.copyOf(plans), Set.copyOf(paths), Map.copyOf(byPath), List.copyOf(display));
    }

    private static ItemPlan plan(MapItemRecord item, JsonObject setup, Map<String, Asset> assets) {
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
        for (JsonObject kpi : kpis(setup, overrides)) {
            String key = text(kpi, "key");
            if (key == null || !on(kpi, "on")) {
                continue;
            }
            resolve(KPI_PREFIX + key, text(kpi, "path"), item, asset, view, slots, problems);
        }
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
        return new ItemPlan(item.id(), item.kind(), Map.copyOf(slots), List.copyOf(problems));
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
