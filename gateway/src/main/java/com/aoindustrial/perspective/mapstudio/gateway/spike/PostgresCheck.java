package com.aoindustrial.perspective.mapstudio.gateway.spike;

import java.sql.SQLException;

import com.inductiveautomation.ignition.common.util.LoggerEx;
import com.inductiveautomation.ignition.gateway.datasource.Datasource;
import com.inductiveautomation.ignition.gateway.datasource.DatasourceManager;
import com.inductiveautomation.ignition.gateway.datasource.SRConnection;

/**
 * Spike check 5: connect to PostgreSQL through an Ignition database connection
 * on the Gateway's default connection settings, create a {@code mapstudio_}
 * table, and on a connection whose role lacks CREATE log one error naming the
 * connection, the statement kind and the SQLState (AD-21).
 */
public final class PostgresCheck {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.check.postgres");

    /** PostgreSQL's insufficient_privilege. */
    public static final String SQLSTATE_INSUFFICIENT_PRIVILEGE = "42501";

    static final String TABLE = "mapstudio_schema_version";
    static final String CREATE = "CREATE TABLE IF NOT EXISTS " + TABLE + " (version integer NOT NULL)";
    static final String INSERT = "INSERT INTO " + TABLE + " (version) VALUES (?)";
    static final String READ = "SELECT max(version) FROM " + TABLE;

    private final DatasourceManager datasources;

    public PostgresCheck(DatasourceManager datasources) {
        this.datasources = datasources;
    }

    /** The owner role: connect, create, insert, read back; PASS carries the server version. */
    public CheckResult checkOwner(String connectionName) {
        String name = "postgres";
        Datasource datasource = datasources.getDatasource(connectionName);
        if (datasource == null) {
            return CheckResult.fail(name, "no database connection named " + connectionName);
        }
        try (SRConnection connection = datasource.getConnection()) {
            Object serverVersion = connection.runScalarQuery("SELECT version()");
            connection.runUpdateQuery(CREATE);
            connection.runPrepUpdate(INSERT, 1);
            Object version = connection.runScalarQuery(READ);
            return CheckResult.pass(name, String.format(
                "connection %s (status %s): created %s, inserted 1, read back max(version)=%s; server: %s",
                connectionName, datasource.getStatus(), TABLE, version, serverVersion));
        } catch (SQLException ex) {
            return CheckResult.fail(name, String.format("connection %s: %s SQLState %s: %s",
                connectionName, ex.getClass().getSimpleName(), ex.getSQLState(), ex.getMessage()));
        }
    }

    /**
     * The CONNECT-only role: the connection validates ({@code SELECT 1}) but the
     * CREATE must fail with SQLState 42501, and the module logs the AD-21 error line.
     */
    public CheckResult checkMissingRights(String connectionName) {
        String name = "postgres-rights";
        Datasource datasource = datasources.getDatasource(connectionName);
        if (datasource == null) {
            return CheckResult.fail(name, "no database connection named " + connectionName);
        }
        try (SRConnection connection = datasource.getConnection()) {
            Object probe = connection.runScalarQuery("SELECT 1");
            try {
                connection.runUpdateQuery(CREATE);
            } catch (SQLException ex) {
                log.error(rightsMessage(connectionName, "CREATE TABLE", ex.getSQLState(), ex.getMessage()));
                if (SQLSTATE_INSUFFICIENT_PRIVILEGE.equals(ex.getSQLState())) {
                    return CheckResult.pass(name, String.format(
                        "connection %s (status %s) answered SELECT 1 = %s; CREATE TABLE refused with SQLState %s; "
                            + "one error line logged naming the connection",
                        connectionName, datasource.getStatus(), probe, ex.getSQLState()));
                }
                return CheckResult.fail(name, String.format("connection %s: CREATE failed with SQLState %s, expected %s: %s",
                    connectionName, ex.getSQLState(), SQLSTATE_INSUFFICIENT_PRIVILEGE, ex.getMessage()));
            }
            return CheckResult.fail(name, "connection " + connectionName
                + " could CREATE TABLE; the role has more rights than the check assumes");
        } catch (SQLException ex) {
            return CheckResult.fail(name, String.format("connection %s: could not connect: %s SQLState %s: %s",
                connectionName, ex.getClass().getSimpleName(), ex.getSQLState(), ex.getMessage()));
        }
    }

    /**
     * The one error line AD-21 asks for: the connection, what was attempted, the
     * SQLState and the database's own words. Pure, so its shape is tested.
     */
    public static String rightsMessage(String connectionName, String statementKind, String sqlState, String detail) {
        String reason = SQLSTATE_INSUFFICIENT_PRIVILEGE.equals(sqlState)
            ? "the database role lacks the right to " + statementKind
            : statementKind + " failed";
        return String.format("Map Studio cannot create its tables on connection %s: %s (SQLState %s): %s",
            connectionName, reason, sqlState, detail == null ? "" : detail.trim());
    }
}
