package com.aoindustrial.perspective.mapstudio.gateway.adapter;

import java.util.List;
import java.util.Set;

import com.aoindustrial.perspective.mapstudio.common.contract.AdapterStatus;
import com.aoindustrial.perspective.mapstudio.gateway.setup.SetupRegistry;

/** Host adapters for tests that are not about them: no kind or asset function set up. */
public final class NoAdapters {

    private NoAdapters() {
    }

    public static AdapterSnapshot snapshot(String project) {
        AdapterStatus none = new AdapterStatus(AdapterStatus.NOT_CONFIGURED, "No function is set up.", "", 0, 0, null);
        return new AdapterSnapshot(List.of(), List.of(), none, none);
    }

    /** An adapter service over {@code setups} whose caller fails the test if it is ever called. */
    public static AdapterService service(SetupRegistry setups) {
        return AdapterService.create(setups::find, Set::of, (project, function) -> {
            throw new AssertionError("no adapter call expected in this test");
        });
    }
}
