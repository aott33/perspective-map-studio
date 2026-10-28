package com.aoindustrial.perspective.mapstudio.gateway.live;

import java.util.List;

import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.contract.AdapterStatus;
import com.aoindustrial.perspective.mapstudio.common.contract.Asset;
import com.aoindustrial.perspective.mapstudio.common.contract.KindSetupRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.AdapterSnapshot;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.TestKinds;

/** The plan's I/O matrix row "Plan from setups": the pad setup, the tracer's three pads and an unlinked pad. */
final class LiveFixtures {

    static final String P1 = "11111111-1111-4111-8111-111111111111";
    static final String P2 = "22222222-2222-4222-8222-222222222222";
    static final String P3 = "33333333-3333-4333-8333-333333333333";
    static final String UNLINKED = "44444444-4444-4444-8444-444444444444";
    static final String OVERRIDDEN = "55555555-5555-4555-8555-555555555555";

    static final String PAD_SETUP = "{\"comms\":{\"path\":\"{asset.path}/Comms\",\"on\":true},"
        + "\"kpis\":[{\"key\":\"pressure\",\"label\":\"Pressure\",\"path\":\"{asset.path}/Pressure\",\"unit\":\"psi\","
        + "\"on\":true,\"icon\":true},"
        + "{\"key\":\"flow\",\"label\":\"Flow\",\"path\":\"{asset.path}/Flow\",\"unit\":\"bbl/d\",\"on\":true},"
        + "{\"key\":\"gas\",\"label\":\"Gas price\",\"path\":\"[default]Shared/GasPrice\",\"unit\":\"\",\"on\":false}],"
        + "\"alarms\":{\"path\":\"{asset.path}\",\"count\":true,\"summary\":true},\"link\":\"/pad/{item.name}\"}";

    static final List<Asset> ASSETS = List.of(
        new Asset("P12", "Pad 12", "pad", "[default]Mesa/P12"),
        new Asset("P14", "Pad 14", "pad", "[default]Mesa/P14"),
        new Asset("P15", "Pad 15", "pad", "[default]Mesa/P15"));

    private LiveFixtures() {
    }

    static JsonObject json(String s) {
        return JsonParser.parseString(s).getAsJsonObject();
    }

    static KindSetupRecord padSetup() {
        return new KindSetupRecord("pad", json(PAD_SETUP), 1, false);
    }

    static MapItemRecord pad(String id, String name, String assetId, String overrides) {
        JsonObject data = json("{\"kind\":\"pad\",\"name\":\"" + name + "\",\"geometry\":{\"type\":\"Point\","
            + "\"coordinates\":[-104.99,39.74]},\"properties\":{\"status\":\"producing\"}"
            + (assetId == null ? "" : ",\"assetId\":\"" + assetId + "\"")
            + (overrides == null ? "" : ",\"overrides\":" + overrides) + "}");
        return MapItemRecord.fromCreate(id, data, 0);
    }

    static List<MapItemRecord> items() {
        return List.of(pad(P1, "Point 1", "P12", null), pad(P2, "Point 2", "P14", null), pad(P3, "Point 3", "P15", null),
            pad(UNLINKED, "Pad 1", null, null));
    }

    static AdapterSnapshot lists(List<Asset> assets) {
        AdapterStatus ok = new AdapterStatus(AdapterStatus.OK, "ok", "f", 1, 0, null);
        return new AdapterSnapshot(TestKinds.KINDS, assets, ok, ok);
    }
}
