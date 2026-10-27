package com.aoindustrial.perspective.mapstudio.gateway.store;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonNull;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;

/**
 * {@link MapStore} on PostgreSQL through a Gateway database connection. Prepared
 * statements only; no value is ever formatted into SQL. JSON columns are sent as
 * text and cast ({@code ?::jsonb}); ids as text cast to {@code uuid}.
 */
public final class JdbcMapStore implements MapStore {

    static final String ITEM_COLUMNS =
        "id::text, kind, name, geometry, properties::text, asset_id, overrides::text, ends::text, version, deleted";

    private final ConnectionSource connections;

    public JdbcMapStore(ConnectionSource connections) {
        this.connections = connections;
    }

    @Override
    public <T> T inTransaction(String connection, Work<T> work) throws SQLException {
        try (Connection c = connections.open(connection)) {
            boolean autoCommit = c.getAutoCommit();
            c.setAutoCommit(false);
            try {
                T result = work.run(new JdbcTx(c));
                c.commit();
                return result;
            } catch (SQLException | RuntimeException | Error ex) {
                try {
                    c.rollback();
                } catch (SQLException ignored) {
                    // The original error is the one to report.
                }
                throw ex;
            } finally {
                try {
                    c.setAutoCommit(autoCommit);
                } catch (SQLException ignored) {
                    // Best effort before the connection goes back to the pool.
                }
            }
        }
    }

    private static final class JdbcTx implements Tx {
        private final Connection c;

        JdbcTx(Connection c) {
            this.c = c;
        }

        @Override
        public long nextSeq(String project) throws SQLException {
            try (PreparedStatement ps = c.prepareStatement(
                    "INSERT INTO mapstudio_project (project, seq) VALUES (?, 0) ON CONFLICT (project) DO NOTHING")) {
                ps.setString(1, project);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = c.prepareStatement(
                    "UPDATE mapstudio_project SET seq = seq + 1 WHERE project = ? RETURNING seq")) {
                ps.setString(1, project);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        throw new SQLException("mapstudio_project has no row for the project after the insert");
                    }
                    return rs.getLong(1);
                }
            }
        }

        @Override
        public long currentSeq(String project) throws SQLException {
            try (PreparedStatement ps = c.prepareStatement("SELECT seq FROM mapstudio_project WHERE project = ?")) {
                ps.setString(1, project);
                try (ResultSet rs = ps.executeQuery()) {
                    return rs.next() ? rs.getLong(1) : 0L;
                }
            }
        }

        @Override
        public Optional<MapItemRecord> lockItem(String project, String id) throws SQLException {
            try (PreparedStatement ps = c.prepareStatement("SELECT " + ITEM_COLUMNS
                    + " FROM mapstudio_item WHERE project = ? AND id = ?::uuid FOR UPDATE")) {
                ps.setString(1, project);
                ps.setString(2, id);
                try (ResultSet rs = ps.executeQuery()) {
                    return rs.next() ? Optional.of(item(rs)) : Optional.empty();
                }
            }
        }

        @Override
        public void insertItem(String project, MapItemRecord item) throws SQLException {
            try (PreparedStatement ps = c.prepareStatement("INSERT INTO mapstudio_item (project, id, kind, name, geometry, "
                    + "properties, asset_id, overrides, ends, version, deleted, updated_at) "
                    + "VALUES (?, ?::uuid, ?, ?, ?, ?::jsonb, ?, ?::jsonb, ?::jsonb, ?, ?, now())")) {
                ps.setString(1, project);
                ps.setString(2, item.id());
                bindItem(ps, 3, item);
                ps.executeUpdate();
            }
        }

        @Override
        public void updateItem(String project, MapItemRecord item) throws SQLException {
            try (PreparedStatement ps = c.prepareStatement("UPDATE mapstudio_item SET kind = ?, name = ?, geometry = ?, "
                    + "properties = ?::jsonb, asset_id = ?, overrides = ?::jsonb, ends = ?::jsonb, version = ?, "
                    + "deleted = ?, updated_at = now() WHERE project = ? AND id = ?::uuid")) {
                int next = bindItem(ps, 1, item);
                ps.setString(next, project);
                ps.setString(next + 1, item.id());
                if (ps.executeUpdate() != 1) {
                    throw new SQLException("mapstudio_item row " + item.id() + " was not updated");
                }
            }
        }

        /** Binds kind through deleted from {@code start}; returns the next parameter index. */
        private static int bindItem(PreparedStatement ps, int start, MapItemRecord item) throws SQLException {
            int i = start;
            ps.setString(i++, item.kind());
            ps.setString(i++, item.name());
            ps.setString(i++, item.geometry().toString());
            ps.setString(i++, item.properties().toString());
            if (item.assetId() == null) {
                ps.setNull(i++, Types.VARCHAR);
            } else {
                ps.setString(i++, item.assetId());
            }
            ps.setString(i++, item.overrides().toString());
            if (item.ends() == null || item.ends().isJsonNull()) {
                ps.setNull(i++, Types.VARCHAR);
            } else {
                ps.setString(i++, item.ends().toString());
            }
            ps.setInt(i++, item.version());
            ps.setBoolean(i++, item.deleted());
            return i;
        }

        @Override
        public void insertEdit(EditRow row) throws SQLException {
            try (PreparedStatement ps = c.prepareStatement("INSERT INTO mapstudio_edit (project, batch_id, seq, entity, "
                    + "entity_id, op, version, actor, source, at) VALUES (?, ?::uuid, ?, ?, ?, ?, ?, ?, ?, now())")) {
                ps.setString(1, row.project());
                ps.setString(2, row.batchId());
                ps.setLong(3, row.seq());
                ps.setString(4, row.entity());
                ps.setString(5, row.entityId());
                ps.setString(6, row.op());
                ps.setInt(7, row.version());
                ps.setString(8, row.actor());
                ps.setString(9, row.source());
                ps.executeUpdate();
            }
        }

        @Override
        public void insertBatch(String project, String batchId, long seq, String actor, JsonObject result)
                throws SQLException {
            try (PreparedStatement ps = c.prepareStatement("INSERT INTO mapstudio_batch (project, batch_id, seq, actor, "
                    + "result, committed_at) VALUES (?, ?::uuid, ?, ?, ?::jsonb, now())")) {
                ps.setString(1, project);
                ps.setString(2, batchId);
                ps.setLong(3, seq);
                ps.setString(4, actor);
                ps.setString(5, result.toString());
                ps.executeUpdate();
            }
        }

        @Override
        public Optional<StoredBatch> findBatch(String project, String batchId) throws SQLException {
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT actor, result::text FROM mapstudio_batch WHERE project = ? AND batch_id = ?::uuid")) {
                ps.setString(1, project);
                ps.setString(2, batchId);
                try (ResultSet rs = ps.executeQuery()) {
                    return rs.next()
                        ? Optional.of(new StoredBatch(rs.getString(1), JsonParser.parseString(rs.getString(2)).getAsJsonObject()))
                        : Optional.empty();
                }
            }
        }

        @Override
        public Optional<LastEdit> lastEdit(String project, String entity, String entityId) throws SQLException {
            // No index on (project, entity, entity_id) in schema 1: a scan per conflict, fine at this size.
            try (PreparedStatement ps = c.prepareStatement("SELECT actor, at FROM mapstudio_edit "
                    + "WHERE project = ? AND entity = ? AND entity_id = ? ORDER BY edit_id DESC LIMIT 1")) {
                ps.setString(1, project);
                ps.setString(2, entity);
                ps.setString(3, entityId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        return Optional.empty();
                    }
                    OffsetDateTime at = rs.getObject(2, OffsetDateTime.class);
                    return Optional.of(new LastEdit(rs.getString(1), at == null ? null
                        : DateTimeFormatter.ISO_INSTANT.format(at.withOffsetSameInstant(ZoneOffset.UTC)
                            .truncatedTo(ChronoUnit.SECONDS).toInstant())));
                }
            }
        }

        @Override
        public List<MapItemRecord> liveItems(String project) throws SQLException {
            List<MapItemRecord> items = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement("SELECT " + ITEM_COLUMNS
                    + " FROM mapstudio_item WHERE project = ? AND NOT deleted ORDER BY id")) {
                ps.setString(1, project);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        items.add(item(rs));
                    }
                }
            }
            return items;
        }

        private static MapItemRecord item(ResultSet rs) throws SQLException {
            String ends = rs.getString(8);
            JsonElement endsJson = ends == null ? JsonNull.INSTANCE : JsonParser.parseString(ends);
            return new MapItemRecord(rs.getString(1), rs.getString(2), rs.getString(3),
                JsonParser.parseString(rs.getString(4)).getAsJsonObject(),
                JsonParser.parseString(rs.getString(5)).getAsJsonObject(),
                rs.getString(6),
                JsonParser.parseString(rs.getString(7)).getAsJsonObject(),
                endsJson, rs.getInt(9), rs.getBoolean(10));
        }
    }
}
