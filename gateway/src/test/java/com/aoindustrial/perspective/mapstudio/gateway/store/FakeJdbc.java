package com.aoindustrial.perspective.mapstudio.gateway.store;

import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * A scripted {@code java.sql.Connection} for the migrator's tests: records every
 * statement, answers the schema version query with {@link #version}, and throws
 * {@link #failOn}'s SQLException for the first statement that contains it.
 */
final class FakeJdbc {

    final List<String> executed = new ArrayList<>();
    final List<String> events = new ArrayList<>();
    /** Every string bound to a prepared statement, in order (the version record's module_version). */
    final List<String> boundStrings = new ArrayList<>();
    int version;
    /** Whether mapstudio_schema_version exists; null means "when version > 0". */
    Boolean tableExists;
    String failOn;
    String failSqlState = "42501";
    /** The message of failOn's SQLException (epic 2 story 5 checks it reaches the log line). */
    String failMessage = "permission denied for schema public";
    /** When set, the first statement containing it throws an IllegalStateException (a non-SQL failure). */
    String failOnRuntime;
    boolean autoCommit = true;

    Connection connection() {
        return (Connection) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[] {Connection.class},
            (proxy, method, args) -> switch (method.getName()) {
                case "getAutoCommit" -> autoCommit;
                case "setAutoCommit" -> {
                    autoCommit = (Boolean) args[0];
                    yield null;
                }
                case "commit", "rollback", "close" -> {
                    events.add(method.getName());
                    yield null;
                }
                case "createStatement" -> statement();
                case "prepareStatement" -> prepared((String) args[0]);
                default -> throw new UnsupportedOperationException(method.getName());
            });
    }

    private void run(String sql) throws SQLException {
        executed.add(sql);
        if (failOnRuntime != null && sql.contains(failOnRuntime)) {
            throw new IllegalStateException("driver bug");
        }
        if (failOn != null && sql.contains(failOn)) {
            throw new SQLException(failMessage, failSqlState);
        }
    }

    private Statement statement() {
        return (Statement) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[] {Statement.class},
            (proxy, method, args) -> switch (method.getName()) {
                case "execute" -> {
                    run((String) args[0]);
                    yield true;
                }
                case "executeQuery" -> {
                    run((String) args[0]);
                    yield versionResult();
                }
                case "close" -> null;
                default -> throw new UnsupportedOperationException(method.getName());
            });
    }

    private PreparedStatement prepared(String sql) {
        return (PreparedStatement) Proxy.newProxyInstance(getClass().getClassLoader(),
            new Class<?>[] {PreparedStatement.class},
            (proxy, method, args) -> switch (method.getName()) {
                case "setInt" -> null;
                case "setString" -> {
                    boundStrings.add((String) args[1]);
                    yield null;
                }
                case "executeUpdate" -> {
                    run(sql);
                    yield 1;
                }
                case "close" -> null;
                default -> throw new UnsupportedOperationException(method.getName());
            });
    }

    private ResultSet versionResult() {
        boolean[] read = {false};
        return (ResultSet) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[] {ResultSet.class},
            (proxy, method, args) -> switch (method.getName()) {
                case "next" -> {
                    boolean first = !read[0];
                    read[0] = true;
                    yield first;
                }
                case "getInt" -> version;
                case "getBoolean" -> tableExists != null ? tableExists : version > 0;
                case "close" -> null;
                default -> throw new UnsupportedOperationException(method.getName());
            });
    }
}
