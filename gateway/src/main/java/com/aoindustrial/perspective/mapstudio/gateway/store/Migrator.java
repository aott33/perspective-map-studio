package com.aoindustrial.perspective.mapstudio.gateway.store;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import com.aoindustrial.perspective.mapstudio.gateway.store.Migrations.Migration;

/**
 * Creates or upgrades the {@code mapstudio_} tables on one connection (AD-3, AD-21).
 *
 * <p>It first reads the recorded version with no lock and no DDL ({@code to_regclass},
 * then {@code max(version)}), so a migrated database needs only SELECT and a
 * least-privilege runtime role without CREATE comes up available. Only when a
 * migration is pending does it take the lock and create anything.
 *
 * <p>Each migration runs in its own transaction, under a PostgreSQL advisory lock
 * so two Gateways never migrate at once; inside the lock it reads the recorded
 * schema version again, so a second Gateway that waited on the lock applies
 * nothing. Migration 1 creates {@code mapstudio_schema_version} too, so the whole
 * first schema and its version are one transaction: either all of it exists or
 * none of it.
 */
public final class Migrator {

    /** The advisory lock every Map Studio migration takes (a transaction lock: released at commit or rollback). */
    static final String LOCK = "SELECT pg_advisory_xact_lock(hashtext('mapstudio_migrations'))";
    static final String CREATE_VERSION_TABLE = "CREATE TABLE IF NOT EXISTS mapstudio_schema_version ("
        + "version integer PRIMARY KEY, "
        + "applied_at timestamptz NOT NULL DEFAULT now(), "
        + "module_version text NOT NULL)";
    static final String READ_VERSION = "SELECT coalesce(max(version), 0) FROM mapstudio_schema_version";
    /** Whether the version table exists, without touching it (needs no right on it). */
    static final String VERSION_TABLE_EXISTS = "SELECT to_regclass('mapstudio_schema_version') IS NOT NULL";
    static final String RECORD_VERSION = "INSERT INTO mapstudio_schema_version (version, module_version) VALUES (?, ?)";

    /** The schema is newer than this module knows (AD-21: the map is read only; entry 5 builds that). */
    public static final class SchemaNewerException extends Exception {
        private final int found;

        SchemaNewerException(int found, int known) {
            super("the map store's schema version " + found + " is newer than this module knows (" + known + ")");
            this.found = found;
        }

        public int found() {
            return found;
        }
    }

    /** What a run did: the versions applied (empty when the schema was current) and the version now recorded. */
    public record Result(List<Integer> applied, int version) {
    }

    /** A statement that failed, kept so the AD-21 error line can name it. */
    public static final class MigrationFailure extends SQLException {
        private final String statement;

        MigrationFailure(String statement, SQLException cause) {
            super(cause.getMessage(), cause.getSQLState(), cause.getErrorCode(), cause);
            this.statement = statement;
        }

        public String statement() {
            return statement;
        }
    }

    private final List<Migration> migrations;
    private final String moduleVersion;

    public Migrator(List<Migration> migrations, String moduleVersion) {
        this.migrations = List.copyOf(migrations);
        this.moduleVersion = moduleVersion;
    }

    public Result migrate(Connection connection) throws SQLException, SchemaNewerException {
        boolean autoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        List<Integer> applied = new ArrayList<>();
        int version = 0;
        try {
            // Read first, with no lock and no DDL: a migrated database needs only SELECT here,
            // so a least-privilege runtime role (no CREATE) comes up available.
            version = readVersion(connection);
            connection.commit();
            if (version > migrations.size()) {
                throw new SchemaNewerException(version, migrations.size());
            }
            if (version >= migrations.size()) {
                return new Result(List.of(), version);
            }
            for (Migration migration : migrations) {
                version = beginAndReadVersion(connection);
                if (version > migrations.size()) {
                    connection.rollback();
                    throw new SchemaNewerException(version, migrations.size());
                }
                if (version >= migration.version()) {
                    connection.commit();
                    continue;
                }
                for (String statement : migration.statements()) {
                    execute(connection, statement);
                }
                try (PreparedStatement ps = connection.prepareStatement(RECORD_VERSION)) {
                    ps.setInt(1, migration.version());
                    ps.setString(2, moduleVersion);
                    ps.executeUpdate();
                } catch (SQLException ex) {
                    throw new MigrationFailure(RECORD_VERSION, ex);
                }
                connection.commit();
                applied.add(migration.version());
                version = migration.version();
            }
            return new Result(List.copyOf(applied), version);
        } catch (SQLException | SchemaNewerException | RuntimeException ex) {
            try {
                connection.rollback();
            } catch (SQLException ignored) {
                // The connection is going back to the pool; the original error is what matters.
            }
            throw ex;
        } finally {
            try {
                connection.setAutoCommit(autoCommit);
            } catch (SQLException ignored) {
                // Best effort before the connection goes back to the pool.
            }
        }
    }

    /** The recorded schema version, 0 when the version table does not exist; no lock, no DDL. */
    private static int readVersion(Connection connection) throws SQLException {
        try (Statement s = connection.createStatement(); ResultSet rs = s.executeQuery(VERSION_TABLE_EXISTS)) {
            if (!rs.next() || !rs.getBoolean(1)) {
                return 0;
            }
        } catch (SQLException ex) {
            throw new MigrationFailure(VERSION_TABLE_EXISTS, ex);
        }
        try (Statement s = connection.createStatement(); ResultSet rs = s.executeQuery(READ_VERSION)) {
            return rs.next() ? rs.getInt(1) : 0;
        } catch (SQLException ex) {
            throw new MigrationFailure(READ_VERSION, ex);
        }
    }

    private static int beginAndReadVersion(Connection connection) throws SQLException {
        execute(connection, LOCK);
        execute(connection, CREATE_VERSION_TABLE);
        try (Statement s = connection.createStatement(); ResultSet rs = s.executeQuery(READ_VERSION)) {
            return rs.next() ? rs.getInt(1) : 0;
        } catch (SQLException ex) {
            throw new MigrationFailure(READ_VERSION, ex);
        }
    }

    private static void execute(Connection connection, String sql) throws SQLException {
        try (Statement s = connection.createStatement()) {
            s.execute(sql);
        } catch (SQLException ex) {
            throw new MigrationFailure(sql, ex);
        }
    }
}
