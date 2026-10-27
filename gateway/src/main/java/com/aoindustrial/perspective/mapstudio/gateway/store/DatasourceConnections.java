package com.aoindustrial.perspective.mapstudio.gateway.store;

import java.sql.Connection;
import java.sql.SQLException;

import com.inductiveautomation.ignition.gateway.datasource.Datasource;
import com.inductiveautomation.ignition.gateway.datasource.DatasourceManager;

/**
 * {@link ConnectionSource} on the Gateway's {@code DatasourceManager}:
 * {@code getDatasource(name).getConnection()} gives a pooled {@code SRConnection},
 * a {@code java.sql.Connection} (docs/platform-checks.md, check 5) [live 8.3.10].
 * Transactions use plain JDBC on it ({@code setAutoCommit(false)}, commit,
 * rollback), seen working by this story's e2e run.
 */
public final class DatasourceConnections implements ConnectionSource {

    private final DatasourceManager datasources;

    public DatasourceConnections(DatasourceManager datasources) {
        this.datasources = datasources;
    }

    @Override
    public boolean exists(String name) {
        return datasources.getDatasource(name) != null;
    }

    @Override
    public Connection open(String name) throws SQLException {
        Datasource datasource = datasources.getDatasource(name);
        if (datasource == null) {
            throw new SQLException("The Gateway has no database connection named " + name + ".");
        }
        return datasource.getConnection();
    }
}
