package com.aoindustrial.perspective.mapstudio.gateway.store;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The words of a map store failure (AD-21, epic 2 story 5): the one Gateway log
 * line and the plain reason a person sees. Pure, so its wording is unit tested.
 *
 * <p>The log line names the connection, the migration, the statement (ordinal
 * and first line), the SQLState ("none" for a failure that is not a database
 * error), the right when the SQLState is 42501, and the database's own message.
 * It never holds a value, a password or a map item property: migrations carry no
 * values, and the database's message for a DDL failure names objects only.
 */
public final class FailureLine {

    private FailureLine() {
    }

    /** PostgreSQL's insufficient_privilege. */
    static final String SQLSTATE_INSUFFICIENT_PRIVILEGE = StoreRegistry.SQLSTATE_INSUFFICIENT_PRIVILEGE;

    private static final Pattern SCHEMA = Pattern.compile("for schema ([A-Za-z0-9_\"]+)");

    /** The error line for a failed migrator run on {@code connection}. */
    public static String line(String connection, Migrator.MigrationFailure failure) {
        String sqlState = sqlState(failure);
        StringBuilder out = new StringBuilder("Map Studio cannot prepare its map store on database connection ")
            .append(connection).append(": ").append(where(failure)).append(" (").append(firstLine(failure.statement()))
            .append(") failed with SQLState ").append(sqlState);
        String right = right(failure.statement(), sqlState, failure.getMessage());
        if (right != null) {
            out.append(", the database role lacks ").append(right);
        }
        out.append(": ").append(oneLine(failure.getMessage()));
        return out.toString();
    }

    /** The error line when the connection could not be opened or committed (not a statement). */
    public static String connectLine(String connection, String sqlState, String detail) {
        return "Map Studio cannot prepare its map store on database connection " + connection
            + ": opening or committing on the connection failed with SQLState " + (sqlState == null ? "none" : sqlState)
            + ": " + oneLine(detail);
    }

    /**
     * The plain reason a person sees for a failed migrator run (story 1's words,
     * plus where to look). On a 42501 it follows the same right as the log line:
     * CREATE for a CREATE statement, ownership for ALTER or DROP, and a generic
     * "a right it needs" for any other statement (the version read, the version record).
     */
    public static String userReason(String connection, Migrator.MigrationFailure failure) {
        String sqlState = failure.getSQLState();
        if (SQLSTATE_INSUFFICIENT_PRIVILEGE.equals(sqlState)) {
            String right = right(failure.statement(), sqlState, failure.getMessage());
            if (right != null && right.startsWith("CREATE")) {
                return createReason(connection);
            }
            if (right != null) {
                return "The map store is unavailable: the database role of connection " + connection
                    + " does not own Map Studio's tables. Ask an administrator (see the Gateway log).";
            }
            return rightReason(connection);
        }
        return userReason(connection, sqlState);
    }

    /**
     * The plain reason a person sees for an unavailable map store that is not a
     * statement's failure (opening or committing on the connection): a 42501 there
     * names no particular right.
     */
    public static String userReason(String connection, String sqlState) {
        if (SQLSTATE_INSUFFICIENT_PRIVILEGE.equals(sqlState)) {
            return rightReason(connection);
        }
        return "The map store is unavailable: Map Studio could not create its tables on connection " + connection
            + " (SQLState " + (sqlState == null ? "none" : sqlState) + "). Ask an administrator (see the Gateway log).";
    }

    private static String createReason(String connection) {
        return "The map store is unavailable: the database role of connection " + connection
            + " lacks the right to create Map Studio's tables. Ask an administrator (see the Gateway log).";
    }

    private static String rightReason(String connection) {
        return "The map store is unavailable: the database role of connection " + connection
            + " lacks a right Map Studio needs. Ask an administrator (see the Gateway log).";
    }

    /** The read-only reason for a schema newer than the module. */
    public static String newerReason(int found, int known) {
        return "The map store was upgraded by a newer Map Studio (schema " + found + ", this module knows " + known
            + "); saving is off until the module is upgraded.";
    }

    /** The warning line for a schema newer than the module (logged once per change). */
    public static String newerLine(String connection, int found, int known) {
        return "Map Studio's map store on database connection " + connection + " is at schema version " + found
            + ", newer than this module knows (" + known + "); the map is read only here until the Map Studio module"
            + " is upgraded. Nothing was migrated or changed.";
    }

    static String sqlState(Migrator.MigrationFailure failure) {
        return failure.getSQLState() == null || failure.getSQLState().isBlank() ? "none" : failure.getSQLState();
    }

    private static String where(Migrator.MigrationFailure failure) {
        if (failure.migration() == 0) {
            return "reading the schema version";
        }
        if (failure.ordinal() == 0) {
            return "migration " + failure.migration() + ", before its statements";
        }
        return "migration " + failure.migration() + ", statement " + failure.ordinal() + " of " + failure.count();
    }

    /**
     * The right a 42501 points at, from the statement's verb: CREATE on the schema
     * (named from the database's message when it says) for CREATE, ownership of
     * the table for ALTER or DROP; null otherwise or for another SQLState.
     */
    static String right(String statement, String sqlState, String detail) {
        if (!SQLSTATE_INSUFFICIENT_PRIVILEGE.equals(sqlState) || statement == null) {
            return null;
        }
        String verb = statement.strip().toUpperCase(Locale.ROOT);
        if (verb.startsWith("CREATE")) {
            Matcher m = SCHEMA.matcher(detail == null ? "" : detail);
            return m.find() ? "CREATE on schema " + m.group(1) : "CREATE on the schema";
        }
        if (verb.startsWith("ALTER") || verb.startsWith("DROP")) {
            return "ownership of the table";
        }
        return null;
    }

    static String firstLine(String statement) {
        if (statement == null) {
            return "";
        }
        // Up to the column list: "CREATE TABLE mapstudio_item (" is named "CREATE TABLE mapstudio_item ...".
        String s = statement.strip();
        int nl = s.indexOf('\n');
        String first = nl < 0 ? s : s.substring(0, nl).strip();
        int paren = first.indexOf(" (");
        if (paren > 0) {
            return first.substring(0, paren) + " ...";
        }
        return nl < 0 ? first : first + " ...";
    }

    static String oneLine(String s) {
        return s == null ? "" : s.replace('\n', ' ').strip();
    }
}
