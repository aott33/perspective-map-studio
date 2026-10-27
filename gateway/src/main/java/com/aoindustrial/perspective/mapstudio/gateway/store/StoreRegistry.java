package com.aoindustrial.perspective.mapstudio.gateway.store;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Duration;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;
import java.util.function.LongSupplier;

import com.inductiveautomation.ignition.common.util.LoggerEx;

/**
 * The map store's state per database connection: the connection wait, then the
 * migrations, then ready or unavailable (AD-21). Several projects may name the
 * same connection; it is waited for and migrated once.
 *
 * <p>Log lines: one info line when the wait starts retrying, one info line when
 * the schema was created or upgraded (none when it was current), one error line
 * naming the connection when the connection never became usable or a migration
 * failed ({@link FailureLine}: migration, statement, SQLState, the right), and one
 * warning when the schema is newer than the module (the store is then
 * {@code READ_ONLY}). A line is logged again only when it changes. A connection
 * the Gateway does not have is not logged here: the project that names it warns
 * once at first use (owner decision, 2026-10-26).
 *
 * <p>Epic 2 story 5 (owner decisions, 2026-10-26): an unavailable store is tried
 * again from {@link #ensure} (every {@code map.load} and {@code applyEdits}) at
 * most once per {@link #RETRY}, so fixing a grant heals without a restart; and
 * only a node that may migrate (independent, or the active node of a redundant
 * pair) runs the migrator: a standby only reads the version, and
 * {@link #retryNow()} runs the migrator when it becomes active.
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
    private final BooleanSupplier mayMigrate;
    private final Duration retry;
    private final ConcurrentHashMap<String, StoreState> states = new ConcurrentHashMap<>();
    /** When the migrator last ran (or the wait gave up) per connection, on {@link #nanoClock}. */
    private final ConcurrentHashMap<String, Long> lastAttempt = new ConcurrentHashMap<>();
    /** Connections whose retry is queued or running. */
    private final Set<String> retrying = ConcurrentHashMap.newKeySet();
    /**
     * Connections {@link #retryNow()} asked to run again while a run of theirs was
     * starting or in flight: that run may have read "standby" before the node
     * became active, so it is followed by one more run if it left the store unavailable.
     */
    private final Set<String> rerun = ConcurrentHashMap.newKeySet();
    /** The last failure or warning line logged per connection, so it is logged again only when it changes. */
    private final ConcurrentHashMap<String, String> lastLine = new ConcurrentHashMap<>();

    /** How often an unavailable map store is tried again, at most (owner decision, 2026-10-26). */
    public static final Duration RETRY = Duration.ofSeconds(60);

    /** An independent Gateway: always migrates, retries every {@link #RETRY}. */
    public StoreRegistry(ConnectionSource connections, Migrator migrator, ScheduledExecutorService scheduler,
                         LongSupplier nanoClock, Duration interval, Duration max) {
        this(connections, migrator, scheduler, nanoClock, interval, max, () -> true, RETRY);
    }

    /**
     * @param mayMigrate whether this node may run the migrator now ({@code RedundancyGate::mayWrite})
     * @param retry      the least time between two runs of the migrator on an unavailable store
     */
    public StoreRegistry(ConnectionSource connections, Migrator migrator, ScheduledExecutorService scheduler,
                         LongSupplier nanoClock, Duration interval, Duration max, BooleanSupplier mayMigrate,
                         Duration retry) {
        this.connections = connections;
        this.migrator = migrator;
        this.scheduler = scheduler;
        this.nanoClock = nanoClock;
        this.interval = interval;
        this.max = max;
        this.mayMigrate = mayMigrate;
        this.retry = retry;
    }

    /**
     * Start the wait and the migrations for a connection a setup names, once. A
     * connection the Gateway does not have is checked again on every call, so one
     * added later starts then.
     */
    public void ensure(String connection) {
        states.compute(connection, (name, current) -> {
            if (current != null && current.status() == StoreState.Status.UNAVAILABLE) {
                retryIfDue(name);
                return current;
            }
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

    /**
     * Run the migrator again now on every unavailable store (this node became the
     * active one of a redundant pair). A store still starting, or whose run is in
     * flight, runs again after that run when it leaves the store unavailable, so a
     * run that read "standby" just before the switch does not hold the store for
     * {@link #RETRY}.
     */
    public void retryNow() {
        for (var entry : states.entrySet()) {
            StoreState.Status status = entry.getValue().status();
            if (status == StoreState.Status.UNAVAILABLE || status == StoreState.Status.STARTING) {
                rerun.add(entry.getKey());
                lastAttempt.remove(entry.getKey());
                if (status == StoreState.Status.UNAVAILABLE) {
                    retryIfDue(entry.getKey());
                }
            }
        }
    }

    /** After a run: honour a {@link #retryNow()} that came while it was in flight. */
    private void afterRun(String connection) {
        StoreState state = states.get(connection);
        if (rerun.remove(connection) && state != null && state.status() == StoreState.Status.UNAVAILABLE) {
            lastAttempt.remove(connection);
            retryIfDue(connection);
        }
    }

    /** Queue one migrator run on an unavailable store when the last one is at least {@code retry} old. */
    private void retryIfDue(String connection) {
        Long last = lastAttempt.get(connection);
        if (last != null && nanoClock.getAsLong() - last < retry.toNanos()) {
            return;
        }
        if (!retrying.add(connection)) {
            return;
        }
        try {
            scheduler.execute(() -> {
                try {
                    migrate(connection);
                } finally {
                    retrying.remove(connection);
                }
                afterRun(connection);
            });
        } catch (RuntimeException ex) {
            // A stopping module refuses new work; the next call tries again.
            retrying.remove(connection);
        }
    }

    private void step(String connection, ConnectionWait wait) {
        ConnectionWait.Step step;
        try {
            step = wait.attempt();
        } catch (RuntimeException ex) {
            log.error("Map Studio could not check database connection " + connection + ": "
                + ex.getClass().getSimpleName(), ex);
            lastAttempt.put(connection, nanoClock.getAsLong());
            states.put(connection, StoreState.unavailable("Map Studio could not check the database connection "
                + connection + "."));
            return;
        }
        switch (step) {
            case USABLE -> {
                migrate(connection);
                afterRun(connection);
            }
            case RETRY -> {
                if (wait.attempts() == 1) {
                    log.infof("Map Studio is waiting for database connection %s to be usable (%s); it tries every %d s "
                        + "for up to %d minutes.", connection, wait.lastReason(), interval.toSeconds(), max.toMinutes());
                }
                scheduler.schedule(() -> step(connection, wait), interval.toMillis(), TimeUnit.MILLISECONDS);
            }
            case GAVE_UP -> {
                lastAttempt.put(connection, nanoClock.getAsLong());
                errorOnce(connection, String.format("Map Studio could not use database connection %s within %d minutes "
                    + "(%d attempts; last: %s). The map store is unavailable; Map Studio tries again at most once a "
                    + "minute when a map of a project naming it is opened or saved.",
                    connection, max.toMinutes(), wait.attempts(), wait.lastReason()));
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
        // A retryNow() from before this point is answered by this run (it reads mayMigrate below).
        rerun.remove(connection);
        lastAttempt.put(connection, nanoClock.getAsLong());
        try (Connection c = connections.open(connection)) {
            if (!mayMigrate.getAsBoolean()) {
                readAsStandby(connection, c);
                return;
            }
            Migrator.Result result = migrator.migrate(c);
            if (result.applied().isEmpty()) {
                log.infof("Map Studio's map store on database connection %s is at schema version %d.", connection,
                    result.version());
            } else {
                // From schema 1 on an existing store (epic 2 story 14) the words say upgraded, not created.
                log.infof("Map Studio %s its map store schema on database connection %s: applied version(s) %s, "
                    + "now at schema version %d.", result.applied().get(0) == 1 ? "created" : "upgraded", connection,
                    result.applied(), result.version());
            }
            lastLine.remove(connection);
            states.put(connection, StoreState.ready());
        } catch (Migrator.MigrationFailure ex) {
            errorOnce(connection, FailureLine.line(connection, ex));
            states.put(connection, StoreState.unavailable(FailureLine.userReason(connection, ex)));
        } catch (SQLException ex) {
            errorOnce(connection, FailureLine.connectLine(connection, ex.getSQLState(), ex.getMessage()));
            states.put(connection, StoreState.unavailable(FailureLine.userReason(connection, ex.getSQLState())));
        } catch (Migrator.SchemaNewerException ex) {
            newer(connection, ex.found(), ex.known());
        } catch (RuntimeException ex) {
            errorOnce(connection, FailureLine.connectLine(connection, null,
                ex.getClass().getSimpleName() + ": " + ex.getMessage()));
            states.put(connection, StoreState.unavailable(FailureLine.userReason(connection, (String) null)));
        }
    }

    /** A standby only reads the recorded version: no lock, no DDL (owner decision, 2026-10-26). */
    private void readAsStandby(String connection, Connection c) throws SQLException {
        int version = migrator.recordedVersion(c);
        if (version > migrator.known()) {
            newer(connection, version, migrator.known());
        } else if (version == migrator.known()) {
            log.infof("Map Studio's map store on database connection %s is at schema version %d (this Gateway is a "
                + "standby and does not migrate).", connection, version);
            lastLine.remove(connection);
            states.put(connection, StoreState.ready());
        } else {
            infoOnce(connection, "Map Studio's map store on database connection " + connection + " is at schema version "
                + version + " and needs version " + migrator.known() + "; this Gateway is a standby of a redundant pair,"
                + " so the active Gateway migrates it, or this one when it becomes active.");
            states.put(connection, StoreState.unavailable("The map store is not ready yet: this Gateway is the standby of"
                + " a redundant pair and the active Gateway prepares the map store first."));
        }
    }

    private void newer(String connection, int found, int known) {
        warnOnce(connection, FailureLine.newerLine(connection, found, known));
        states.put(connection, StoreState.readOnly(FailureLine.newerReason(found, known)));
    }

    private boolean changed(String connection, String line) {
        return !line.equals(lastLine.put(connection, line));
    }

    private void errorOnce(String connection, String line) {
        if (changed(connection, line)) {
            log.error(line);
        }
    }

    private void warnOnce(String connection, String line) {
        if (changed(connection, line)) {
            log.warn(line);
        }
    }

    private void infoOnce(String connection, String line) {
        if (changed(connection, line)) {
            log.info(line);
        }
    }

    /**
     * Story 1's rights line: the connection, the statement, the SQLState and the
     * database's own words (from the spike's PostgresCheck, docs/platform-checks.md
     * check 5). Kept for callers of story 1; the registry logs {@link FailureLine}.
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
