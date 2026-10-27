package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.aoindustrial.perspective.mapstudio.common.contract.SetupLists;
import com.aoindustrial.perspective.mapstudio.common.contract.SetupLists.Entry;
import com.aoindustrial.perspective.mapstudio.common.contract.SetupLists.Part;

/** The dev Gateway and project as the form's lists see them; switchable to unreachable. */
final class FakeListSource implements SetupListSource {

    boolean reachable = true;
    /** When set, the Gateway answers every call with this failure (a refusal, an older module). */
    Exception failure;
    SetupLists gateway = new SetupLists(
        Part.ok(List.of(new Entry("MapStudio", "POSTGRES"), new Entry("MES", "MSSQL"))),
        Part.okNames(List.of("Administrator", "MapEditor", "MapOperator")),
        Part.okNames(List.of("Internal", "MapStudioFiles")));
    Map<String, List<String>> secrets = Map.of("Internal", List.of("api-key", "mapbox-token"));
    final List<String> asked = new ArrayList<>();
    ProjectLists.Snapshot project = new ProjectLists.Snapshot(
        List.of("mapstudio_dev._globals", "mapstudio_dev.assets", "mapstudio_dev.kinds"),
        List.of("/", "/alarms/:name", "/edit"), "default");

    @Override
    public ProjectLists.Snapshot project() {
        return project;
    }

    @Override
    public String gatewayLists(String identityProvider) throws Exception {
        asked.add("lists " + identityProvider);
        if (failure != null) {
            throw failure;
        }
        if (!reachable) {
            throw new java.net.ConnectException("Gateway not reachable");
        }
        return gateway.toJson();
    }

    @Override
    public String secretNames(String provider) throws Exception {
        asked.add("secretNames " + provider);
        if (failure != null) {
            throw failure;
        }
        if (!reachable) {
            throw new java.net.ConnectException("Gateway not reachable");
        }
        List<String> names = secrets.get(provider);
        return names == null ? Part.unavailable("no").toJson() : Part.okNames(names).toJson();
    }
}
