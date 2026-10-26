package com.aoindustrial.perspective.mapstudio.gateway.store;

import java.util.function.Function;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.gateway.setup.SetupRegistry;

/**
 * The one check before any read or write of a project's map: the project has a
 * setup, and the map store on the connection it names is ready. Otherwise
 * {@code store-unreachable} with the reason in plain words.
 */
public final class StoreGate {

    private final SetupRegistry setups;
    private final Function<String, StoreState> states;

    /** {@code states} gives the store state of a connection ({@code StoreRegistry::state} on the Gateway). */
    public StoreGate(SetupRegistry setups, Function<String, StoreState> states) {
        this.setups = setups;
        this.states = states;
    }

    /** The project's setup, when its map store is ready. */
    public Setup requireReady(String project) {
        Setup setup = setups.require(project);
        StoreState state = states.apply(setup.connection());
        if (state.isReady()) {
            return setup;
        }
        if (state.status() == StoreState.Status.NO_CONNECTION) {
            String reason = "Project " + project + " names the database connection " + setup.connection()
                + " in its Map Studio setup, but the Gateway has no connection of that name; its map store is unavailable.";
            setups.warnOnce(project + "|" + setup.connection(), reason);
            throw new MapStudioException(Messages.CODE_STORE_UNREACHABLE, reason);
        }
        throw new MapStudioException(Messages.CODE_STORE_UNREACHABLE, state.reason());
    }
}
