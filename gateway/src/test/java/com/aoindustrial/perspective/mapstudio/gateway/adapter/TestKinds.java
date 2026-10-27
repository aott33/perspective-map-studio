package com.aoindustrial.perspective.mapstudio.gateway.adapter;

import java.util.List;

import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.contract.AdapterStatus;
import com.aoindustrial.perspective.mapstudio.common.contract.Kind;

/**
 * A kind list for the write path's tests (epic 2 story 9): every item a test saves is checked
 * against it. {@code pad} (point), {@code line} (line), {@code geofence} (an area line kind)
 * {@code pipe} (line, no fields) and {@code tap} (an instrument point kind, epic 2 story 14).
 */
public final class TestKinds {

    public static final List<Kind> KINDS = Kind.parseList(JsonParser.parseString("["
        + "{\"id\":\"pad\",\"name\":\"Well pad\",\"geometry\":\"point\",\"icon\":\"well-pad\",\"fields\":["
        + "{\"key\":\"operator\",\"type\":\"text\"},{\"key\":\"wells\",\"type\":\"integer\"},"
        + "{\"key\":\"status\",\"type\":\"choice\",\"required\":true,\"choices\":[\"producing\",\"shut in\"]},"
        + "{\"key\":\"note\",\"type\":\"text\"}]},"
        + "{\"id\":\"line\",\"name\":\"Gathering line\",\"geometry\":\"line\",\"fields\":["
        + "{\"key\":\"diameter\",\"type\":\"number\"},{\"key\":\"buried\",\"type\":\"boolean\"},"
        + "{\"key\":\"note\",\"type\":\"text\"},{\"key\":\"inspected\",\"type\":\"boolean\"}]},"
        + "{\"id\":\"geofence\",\"name\":\"Geofence\",\"geometry\":\"line\",\"area\":true,\"fields\":["
        + "{\"key\":\"operator\",\"type\":\"text\"}]},"
        + "{\"id\":\"pipe\",\"name\":\"Pipe\",\"geometry\":\"line\"},"
        + "{\"id\":\"tap\",\"name\":\"Tap\",\"geometry\":\"point\",\"icon\":\"tap\",\"instrument\":true,\"fields\":["
        + "{\"key\":\"tag\",\"type\":\"text\"}]}]").getAsJsonArray()).kept();

    private TestKinds() {
    }

    /** The kind list in use with status ok, no assets. */
    public static AdapterSnapshot snapshot(String project) {
        AdapterStatus ok = new AdapterStatus(AdapterStatus.OK, KINDS.size() + " kinds from test.kinds.", "test.kinds",
            KINDS.size(), 0, "2026-10-27T10:00:00Z");
        AdapterStatus none = new AdapterStatus(AdapterStatus.NOT_CONFIGURED, "No function is set up.", "", 0, 0, null);
        return new AdapterSnapshot(KINDS, List.of(), ok, none);
    }
}
