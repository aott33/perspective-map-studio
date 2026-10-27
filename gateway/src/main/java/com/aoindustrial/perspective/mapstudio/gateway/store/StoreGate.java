package com.aoindustrial.perspective.mapstudio.gateway.store;

import java.util.Optional;
import java.util.function.Function;
import java.util.function.Supplier;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.gateway.setup.SetupRegistry;

/**
 * The one check before any read or write of a project's map: the project has a
 * setup, and the map store on the connection it names can be read
 * ({@link #requireReadable}) or written ({@link #requireWritable}). Otherwise
 * {@code store-unreachable}, or for a write on a readable store {@code read-only},
 * with the reason in plain words.
 *
 * <p>Read only (AD-21, epic 2 story 5): the map store's schema is newer than this
 * module ({@code StoreState.Status.READ_ONLY}), or this Gateway is the standby of a
 * redundant pair (the {@code standby} supplier, {@code RedundancyGate::standbyReason}).
 */
public final class StoreGate {

    /** A readable project: its setup, and why it cannot be saved (null when it can). */
    public record Readable(Setup setup, String readOnly) {
    }

    private final SetupRegistry setups;
    private final Function<String, StoreState> states;
    private final Supplier<Optional<String>> standby;

    /** {@code states} gives the store state of a connection ({@code StoreRegistry::state} on the Gateway). */
    public StoreGate(SetupRegistry setups, Function<String, StoreState> states) {
        this(setups, states, Optional::empty);
    }

    /** {@code standby} gives the standby reason while this Gateway is a standby, else empty. */
    public StoreGate(SetupRegistry setups, Function<String, StoreState> states, Supplier<Optional<String>> standby) {
        this.setups = setups;
        this.states = states;
        this.standby = standby;
    }

    /** The project's setup, when its map store can be saved to (story 1's name; the same as {@link #requireWritable}). */
    public Setup requireReady(String project) {
        return requireWritable(project);
    }

    /**
     * The project's setup, when its map store can be saved to.
     *
     * @throws MapStudioException {@code store-unreachable} when it cannot be read, {@code read-only} when it can
     *                            be read but not saved
     */
    public Setup requireWritable(String project) {
        Readable readable = requireReadable(project);
        if (readable.readOnly() != null) {
            throw new MapStudioException(Messages.CODE_READ_ONLY, readable.readOnly());
        }
        return readable.setup();
    }

    /**
     * The project's setup and its read-only reason, when its map store can be read.
     *
     * @throws MapStudioException {@code store-unreachable} when it cannot be read
     */
    public Readable requireReadable(String project) {
        Setup setup = setups.require(project);
        StoreState state = states.apply(setup.connection());
        if (state.isReadable()) {
            Optional<String> standbyReason = standby.get();
            if (standbyReason.isPresent()) {
                return new Readable(setup, standbyReason.get());
            }
            return new Readable(setup, state.status() == StoreState.Status.READ_ONLY ? state.reason() : null);
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
