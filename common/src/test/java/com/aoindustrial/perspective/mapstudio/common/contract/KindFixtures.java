package com.aoindustrial.perspective.mapstudio.common.contract;

import java.util.List;

import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

/** Kinds and a full kind setup for the story 9 tests (the dev adapter's kinds, area flag included). */
final class KindFixtures {

    static final List<Kind> KINDS = Kind.parseList(JsonParser.parseString("["
        + "{\"id\":\"pad\",\"name\":\"Well pad\",\"geometry\":\"point\",\"fields\":["
        + "{\"key\":\"operator\",\"type\":\"text\"},{\"key\":\"wells\",\"type\":\"integer\"},"
        + "{\"key\":\"status\",\"type\":\"choice\",\"required\":true,\"choices\":[\"producing\",\"shut in\"]}]},"
        + "{\"id\":\"line\",\"name\":\"Gathering line\",\"geometry\":\"line\",\"fields\":["
        + "{\"key\":\"diameter\",\"type\":\"number\"},{\"key\":\"buried\",\"type\":\"boolean\"}]},"
        + "{\"id\":\"geofence\",\"name\":\"Geofence\",\"geometry\":\"line\",\"area\":true,\"fields\":["
        + "{\"key\":\"operator\",\"type\":\"text\"}]}]").getAsJsonArray()).kept();
    static final Kind PAD = KINDS.get(0);
    static final Kind LINE = KINDS.get(1);
    static final Kind GEOFENCE = KINDS.get(2);

    /** The I/O matrix's "Save setup" row, with a States rule. */
    static final String PAD_SETUP = "{\"comms\":{\"path\":\"{asset.path}/Comms\",\"on\":true},"
        + "\"kpis\":[{\"key\":\"pressure\",\"label\":\"Pressure\",\"path\":\"{asset.path}/Pressure\",\"unit\":\"psi\","
        + "\"on\":true,\"icon\":true},"
        + "{\"key\":\"gas\",\"label\":\"Gas price\",\"path\":\"[default]Shared/GasPrice\",\"unit\":\"\",\"on\":false,"
        + "\"icon\":false}],"
        + "\"alarms\":{\"path\":\"{asset.path}\",\"count\":true,\"summary\":true},"
        + "\"link\":\"/pad/{item.name}\","
        + "\"popupView\":{\"path\":\"Popups/PadDetails\",\"params\":{\"padName\":\"{item.name}\","
        + "\"tagPath\":\"{asset.path}\",\"area\":\"Mesa\",\"pressure\":\"{asset.path}/Pressure\"}},"
        + "\"styleRule\":{\"source\":{\"path\":\"{asset.path}/State\"},\"type\":\"states\","
        + "\"cases\":[{\"value\":\"running\",\"preset\":\"normal\"},{\"value\":\"stopped\",\"preset\":\"fault\"}]}}";

    static final String BANDS = "{\"source\":{\"kpi\":\"pressure\"},\"type\":\"bands\",\"cases\":["
        + "{\"min\":null,\"max\":900,\"preset\":\"normal\"},{\"min\":900,\"max\":null,\"preset\":\"warning\"}]}";

    private KindFixtures() {
    }

    static JsonObject json(String s) {
        return JsonParser.parseString(s).getAsJsonObject();
    }
}
