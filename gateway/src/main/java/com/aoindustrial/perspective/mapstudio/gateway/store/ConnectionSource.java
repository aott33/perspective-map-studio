package com.aoindustrial.perspective.mapstudio.gateway.store;

import java.sql.Connection;
import java.sql.SQLException;

/** The Gateway's database connections by name; the Gateway implementation wraps the DatasourceManager. */
public interface ConnectionSource {

    /** Whether the Gateway has a database connection of this name. */
    boolean exists(String name);

    /** A pooled connection; the caller closes it. */
    Connection open(String name) throws SQLException;
}
