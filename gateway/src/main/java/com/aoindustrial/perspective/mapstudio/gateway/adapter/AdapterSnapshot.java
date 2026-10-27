package com.aoindustrial.perspective.mapstudio.gateway.adapter;

import java.util.List;

import com.inductiveautomation.ignition.common.gson.JsonObject;

import com.aoindustrial.perspective.mapstudio.common.contract.AdapterStatus;
import com.aoindustrial.perspective.mapstudio.common.contract.Asset;
import com.aoindustrial.perspective.mapstudio.common.contract.Kind;

/**
 * A project's kind list and asset list as the Gateway holds them now, with the
 * status of each (docs/kinds-and-assets.md). Read by {@code MapLoader} for
 * {@code map.load}, by {@code refreshAdapters}, and later by item validation
 * (story 9) and the icon check (story 10).
 */
public record AdapterSnapshot(List<Kind> kinds, List<Asset> assets, AdapterStatus kindsStatus,
                              AdapterStatus assetsStatus) {

    /** {@code {kinds: status, assets: status}} with the full messages. */
    public JsonObject statusJson() {
        return statusJson(true);
    }

    /**
     * {@code {kinds: status, assets: status}}; {@code detail} false gives the
     * viewer messages (no host error text, no row ids) for level {@code none}.
     */
    public JsonObject statusJson(boolean detail) {
        JsonObject o = new JsonObject();
        o.add("kinds", kindsStatus.toJson(detail));
        o.add("assets", assetsStatus.toJson(detail));
        return o;
    }
}
