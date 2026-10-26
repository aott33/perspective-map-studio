package com.aoindustrial.perspective.mapstudio.gateway.store;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.LongSupplier;

import com.inductiveautomation.ignition.common.util.LoggerEx;

/**
 * The map store's state per database connection: the connection wait, then the
 * migrations, then ready or unavailable (AD-21). Several projects may name the
 * same connection; it is waited for and migrated once.
 *
 * <p>Log lines: one info line when the wait starts retrying, one info line when
 * the schema was created or upgraded (none when it was current), and one error
 * line naming the connection when the connection never became usable, a
 * migration failed (with the statement and SQLState), or the schema is newer
 * than the module. A connection the Gateway does not have is not logged here:
 * the project that names it warns once at first use (owner decision, 2026-10-26).
 */
public final class StoreRegistry {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.store");

    /** PostgreSQL's insufficient_privilege. */
    public static final String SQLSTATE_INSUFFICIENT_PRIVILEGE = "42501";

    private final ConnectionSource connections;
    private final Migrator migrator;
    private final ScheduledExecutorService scheduler;
    private final LongSupplier nanoClock;
    private final Duration interval;
    private final Duration max;
    private final ConcurrentHashMap<String, StoreState> states = new ConcurrentHashMap<>();

    public StoreRegistry(ConnectionSource connections, Migrator migrator, ScheduledExecutorService scheduler,
                         LongSupplier nanoClock, Duration interval, Duration max) {
        this.connections = connections;
        this.migrator = migrator;
        this.scheduler = scheduler;
        this.nanoClock = nanoClock;
        this.interval = interval;
        this.max = max;
    }

    /**
     * Start the wait and the migrations for a connection a setup names, once. A
     * connection the Gateway does not have is checked again on every call, so one
     * added later starts then.
     */
    public void ensure(String connection) {
        states.compute(connection, (name, current) -> {
            if (current != null && current.status() != StoreState.Status.NO_CONNECTION) {
                return current;
            }
            if (!connections.exists(name)) {
                return StoreState.noConnection(name);
            }
            ConnectionWait wait = new ConnectionWait(() -> probe(name), nanoClock, max);
            scheduler.execute(() -> step(name, wait));
            return StoreState.starting(name);
        });
    }

    /** The state of a connection's map store (starting it when it is not known yet). */
    public StoreState state(String connection) {
        ensure(connection);
        return states.get(connection);
    }

    private void step(String connection, ConnectionWait wait) {
        ConnectionWait.Step step;
        try {
            step = wait.attempt();
        } catch (RuntimeException ex) {
            log.error("Map Studio could not check database connection " + connection + ": "
                + ex.getClass().getSimpleName(), ex);
            states.put(connection, StoreState.unavailable("Map Studio could not check the database connection "
                + connection + "."));
            return;
        }
        switch (step) {
            case USABLE -> migrate(connection);
            case RETRY -> {
                if (wait.attempts() == 1) {
                    log.infof("Map Studio is waiting for database connection %s to be usable (%s); it tries every %d s "
                        + "for up to %d minutes.", connection, wait.lastReason(), interval.toSeconds(), max.toMinutes());
                }
                scheduler.schedule(() -> step(connection, wait), interval.toMillis(), TimeUnit.MILLISECONDS);
            }
            case GAVE_UP -> {
                log.errorf("Map Studio could not use database connection %s within %d minutes (%d attempts; last: %s). "
                    + "The map store is unavailable until the connection works and the Gateway or the module restarts.",
                    connection, max.toMinutes(), wait.attempts(), wait.lastReason());
                states.put(connection, StoreState.unavailable("The map store is unavailable: the database connection "
                    + connection + " did not become usable (" + wait.lastReason() + ")."));
            }
        }
    }

    private Optional<String> probe(String connection) {
        if (!connections.exists(connection)) {
            return Optional.of("the Gateway has no database connection named " + connection);
        }
        try (Connection c = connections.open(connection); Statement s = c.createStatement()) {
            s.execute("SELECT 1");
            return Optional.empty();
        } catch (SQLException ex) {
            return Optional.of("SQLState " + ex.getSQLState() + ": " + oneLine(ex.getMessage()));
        } catch (RuntimeException | LinkageError ex) {
            // The transient Driver$1 NoClassDefFoundError at Gateway start is a LinkageError (check 5).
            return Optional.of(ex.getClass().getSimpleName() + ": " + oneLine(ex.getMessage()));
        }
    }

    private void migrate(String connection) {
        try (Connection c = connections.open(connection)) {
            Migrator.Result result = migrator.migrate(c);
            if (result.applied().isEmpty()) {
                log.infof("Map Studio's map store on database connection %s is at schema version %d.", connection,
                    result.version());
            } else {
                log.infof("Map Studio created its map store schema on database connection %s: applied version(s) %s, "
                    + "now at schema version %d.", connection, result.applied(), result.version());
            }
            states.put(connection, StoreState.ready());
        } catch (Migrator.MigrationFailure ex) {
            log.error(rightsMessage(connection, ex.statement(), ex.getSQLState(), ex.getMessage()));
            states.put(connection, StoreState.unavailable(unavailableReason(connection, ex.getSQLState())));
        } catch (SQLException ex) {
            log.error(rightsMessage(connection, "connect", ex.getSQLState(), ex.getMessage()));
            states.put(connection, StoreState.unavailable(unavailableReason(connection, ex.getSQLState())));
        } catch (Migrator.SchemaNewerException ex) {
            log.errorf("Map Studio cannot use database connection %s: %s. Update the Map Studio module.",
                connection, ex.getMessage());
            states.put(connection, StoreState.unavailable("The map store on " + connection
                + " was made by a newer Map Studio (schema version " + ex.found() + ")."));
        } catch (RuntimeException ex) {
            log.error("Map Studio could not create its tables on database connection " + connection + ": "
                + ex.getClass().getSimpleName(), ex);
            states.put(connection, StoreState.unavailable("The map store on " + connection + " could not be created."));
        }
    }

    private static String unavailableReason(String connection, String sqlState) {
        if (SQLSTATE_INSUFFICIENT_PRIVILEGE.equals(sqlState)) {
            return "The map store is unavailable: the database role of connection " + connection
                + " lacks the right to create Map Studio's tables.";
        }
        return "The map store is unavailable: Map Studio could not create its tables on connection " + connection
            + " (SQLState " + sqlState + ").";
    }

    /**
     * The one error line AD-21 asks for: the connection, the statement, the SQLState
     * and the database's own words (from the spike's PostgresCheck, docs/platform-checks.md check 5).
     */
    public static String rightsMessage(String connection, String statement, String sqlState, String detail) {
        String reason = SQLSTATE_INSUFFICIENT_PRIVILEGE.equals(sqlState)
            ? "the database role lacks the right to run it"
            : "it failed";
        return String.format("Map Studio cannot create its tables on database connection %s: %s (statement: %s; "
                + "SQLState %s): %s", connection, reason, firstLine(statement), sqlState,
            detail == null ? "" : oneLine(detail));
    }

    private static String firstLine(String statement) {
        if (statement == null) {
            return "";
        }
        String s = statement.strip();
        int nl = s.indexOf('\n');
        return nl < 0 ? s : s.substring(0, nl).strip() + " ...";
    }

    private static String oneLine(String s) {
        return s == null ? "" : s.replace('\n', ' ').strip();
    }
}
