package com.aoindustrial.perspective.mapstudio.common.contract;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;

/**
 * One asset of the project's asset list (AD-4, docs/kinds-and-assets.md):
 * {@code {id, name, kind, basePath}}. {@code kind} must be in the kind list;
 * {@code basePath} is a fully qualified tag path, provider included
 * ({@code [default]Mesa/P12}). Unknown keys are ignored.
 */
public record Asset(String id, String name, String kind, String basePath) {

    /** {@code [provider]} then at least one character of path. */
    static final Pattern BASE_PATH = Pattern.compile("^\\[[^\\[\\]\\s][^\\[\\]]*\\]\\S.*$");

    static Asset parse(JsonObject o, Set<String> kindIds) throws Rows.RowException {
        String id = Rows.id(o, "id");
        String name = Rows.requiredString(o, "name");
        String kind = Rows.requiredString(o, "kind");
        String basePath = Rows.requiredString(o, "basePath");
        if (!kindIds.contains(kind)) {
            throw new Rows.RowException("kind " + kind + " is not in the kind list");
        }
        if (!BASE_PATH.matcher(basePath).matches()) {
            throw new Rows.RowException("basePath does not start with a [provider]");
        }
        return new Asset(id, name, kind, basePath);
    }

    public JsonObject toJson() {
        JsonObject o = new JsonObject();
        o.addProperty("id", id);
        o.addProperty("name", name);
        o.addProperty("kind", kind);
        o.addProperty("basePath", basePath);
        return o;
    }

    /**
     * Read every row against {@code kindIds} (the last good kind list): valid
     * assets are kept in order, each left-out row gives one reason.
     */
    public static Parsed<Asset> parseList(JsonArray rows, Set<String> kindIds) {
        List<Asset> kept = new ArrayList<>();
        List<String> reasons = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        for (int i = 0; i < rows.size(); i++) {
            JsonElement row = rows.get(i);
            if (row == null || !row.isJsonObject()) {
                reasons.add(Rows.where(i, row) + " is not a dict");
                continue;
            }
            try {
                Asset asset = parse(row.getAsJsonObject(), kindIds);
                if (!ids.add(asset.id())) {
                    throw new Rows.RowException("the id appears twice");
                }
                kept.add(asset);
            } catch (Rows.RowException ex) {
                reasons.add(Rows.where(i, row) + ": " + ex.getMessage());
            }
        }
        return new Parsed<>(List.copyOf(kept), List.copyOf(reasons), rows.size());
    }

    public static JsonArray toJson(List<Asset> assets) {
        JsonArray a = new JsonArray();
        assets.forEach(x -> a.add(x.toJson()));
        return a;
    }
}
