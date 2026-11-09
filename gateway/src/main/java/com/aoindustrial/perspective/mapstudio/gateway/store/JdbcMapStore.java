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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonNull;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.contract.Attachment;
import com.aoindustrial.perspective.mapstudio.common.contract.KindSetupRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;

/**
 * {@link MapStore} on PostgreSQL through a Gateway database connection. Prepared
 * statements only; no value is ever formatted into SQL. JSON columns are sent as
 * text and cast ({@code ?::jsonb}); ids as text cast to {@code uuid}.
 */
public final class JdbcMapStore implements MapStore {

    static final String ITEM_COLUMNS =
        "id::text, kind, name, geometry, properties::text, asset_id, overrides::text, ends::text, version, deleted, "
        + "attachment::text";

    static final String KIND_SETUP_COLUMNS = "kind_id, setup::text, version, deleted";

    /** Each map item's newest edit record (epic 4 entry 7a): one row per item id, its actor and time. */
    static final String LAST_EDITS_SQL = "SELECT DISTINCT ON (entity_id) entity_id, actor, at FROM mapstudio_edit"
        + " WHERE project = ? AND entity = 'item' ORDER BY entity_id, edit_id DESC";

    /**
     * {@code edits.history}'s page heads (epic-editing entry 11a): the newest batches below a seq with their op counts,
     * one row per batch (its seq), served backwards by mapstudio_edit_project_seq.
     */
    static final String HISTORY_HEADS_SQL = "SELECT seq, count(*) FROM mapstudio_edit WHERE project = ? AND seq < ?"
        + " GROUP BY seq ORDER BY seq DESC LIMIT ?";

    /**
     * The rows of the batches a page takes, newest batch first, each batch's ops in the order they were saved. A row
     * from before schema 3 has no name or kind of its own: the map item's stored record gives them (a kind setup's
     * kind is its id).
     */
    static final String HISTORY_ROWS_SQL = "SELECT e.seq, e.batch_id::text, e.actor, e.at, e.source, e.op, e.entity,"
        + " e.entity_id, e.version, COALESCE(e.name, i.name),"
        + " COALESCE(e.kind, i.kind, CASE WHEN e.entity = 'kindSetup' THEN e.entity_id END),"
        + " e.before::text, e.after::text"
        + " FROM mapstudio_edit e LEFT JOIN mapstudio_item i ON e.entity = 'item' AND i.project = e.project"
        + " AND i.id = CASE WHEN e.entity = 'item' THEN e.entity_id::uuid END"
        + " WHERE e.project = ? AND e.seq <= ? AND e.seq >= ? ORDER BY e.seq DESC, e.edit_id";

    /** A database time as ISO 8601 UTC to the second ({@code LastEdit}'s form), null for null. */
    static String isoSecond(OffsetDateTime at) {
        return at == null ? null : DateTimeFormatter.ISO_INSTANT.format(at.withOffsetSameInstant(ZoneOffset.UTC)
            .truncatedTo(ChronoUnit.SECONDS).toInstant());
    }

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
                    + "properties, asset_id, overrides, ends, version, deleted, attachment, updated_at) "
                    + "VALUES (?, ?::uuid, ?, ?, ?, ?::jsonb, ?, ?::jsonb, ?::jsonb, ?, ?, ?::jsonb, now())")) {
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
                    + "deleted = ?, attachment = ?::jsonb, updated_at = now() WHERE project = ? AND id = ?::uuid")) {
                int next = bindItem(ps, 1, item);
                ps.setString(next, project);
                ps.setString(next + 1, item.id());
                if (ps.executeUpdate() != 1) {
                    throw new SQLException("mapstudio_item row " + item.id() + " was not updated");
                }
            }
        }

        /** Binds kind through deleted, then attachment, from {@code start}; returns the next parameter index. */
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
            if (item.attachment() == null) {
                ps.setNull(i++, Types.VARCHAR);
            } else {
                ps.setString(i++, item.attachment().toJson().toString());
            }
            return i;
        }

        @Override
        public void insertEdit(EditRow row) throws SQLException {
            try (PreparedStatement ps = c.prepareStatement("INSERT INTO mapstudio_edit (project, batch_id, seq, entity, "
                    + "entity_id, op, version, actor, source, before, after, name, kind, at) "
                    + "VALUES (?, ?::uuid, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, now())")) {
                ps.setString(1, row.project());
                ps.setString(2, row.batchId());
                ps.setLong(3, row.seq());
                ps.setString(4, row.entity());
                ps.setString(5, row.entityId());
                ps.setString(6, row.op());
                ps.setInt(7, row.version());
                ps.setString(8, row.actor());
                ps.setString(9, row.source());
                setNullable(ps, 10, row.before() == null ? null : row.before().toString());
                setNullable(ps, 11, row.after() == null ? null : row.after().toString());
                setNullable(ps, 12, row.name());
                setNullable(ps, 13, row.kind());
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
                    return Optional.of(new LastEdit(rs.getString(1), isoSecond(rs.getObject(2, OffsetDateTime.class))));
                }
            }
        }

        @Override
        public Map<String, LastEdit> lastEdits(String project) throws SQLException {
            Map<String, LastEdit> out = new LinkedHashMap<>();
            // One query per load (entry 7a): the newest edit record of each map item, served by mapstudio_edit_project_entity.
            try (PreparedStatement ps = c.prepareStatement(LAST_EDITS_SQL)) {
                ps.setString(1, project);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        out.put(rs.getString(1), new LastEdit(rs.getString(2), isoSecond(rs.getObject(3, OffsetDateTime.class))));
                    }
                }
            }
            return out;
        }

        @Override
        public HistoryPage history(String project, Long before, int limit) throws SQLException {
            List<Long> seqs = new ArrayList<>();
            List<Integer> counts = new ArrayList<>();
            // One more head than the page can take, so more is known without another query.
            try (PreparedStatement ps = c.prepareStatement(HISTORY_HEADS_SQL)) {
                ps.setString(1, project);
                ps.setLong(2, before == null ? Long.MAX_VALUE : before);
                ps.setInt(3, limit + 1);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        seqs.add(rs.getLong(1));
                        counts.add(rs.getInt(2));
                    }
                }
            }
            int n = HistoryPage.take(counts, limit);
            if (n == 0) {
                return new HistoryPage(List.of(), false);
            }
            List<HistoryPage.Entry> entries = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(HISTORY_ROWS_SQL)) {
                ps.setString(1, project);
                ps.setLong(2, seqs.get(0));
                ps.setLong(3, seqs.get(n - 1));
                try (ResultSet rs = ps.executeQuery()) {
                    long seq = -1;
                    List<HistoryPage.Op> ops = null;
                    while (rs.next()) {
                        long rowSeq = rs.getLong(1);
                        if (ops == null || rowSeq != seq) {
                            seq = rowSeq;
                            ops = new ArrayList<>();
                            entries.add(new HistoryPage.Entry(seq, rs.getString(2), rs.getString(3),
                                isoSecond(rs.getObject(4, OffsetDateTime.class)), rs.getString(5), ops));
                        }
                        ops.add(new HistoryPage.Op(rs.getString(6), rs.getString(7), rs.getString(8), rs.getString(10),
                            rs.getString(11), rs.getInt(9), jsonOrNull(rs.getString(12)), jsonOrNull(rs.getString(13))));
                    }
                }
            }
            List<HistoryPage.Entry> frozen = new ArrayList<>();
            for (HistoryPage.Entry e : entries) {
                frozen.add(new HistoryPage.Entry(e.seq(), e.batchId(), e.actor(), e.at(), e.source(), List.copyOf(e.ops())));
            }
            return new HistoryPage(List.copyOf(frozen), n < seqs.size());
        }

        private static JsonObject jsonOrNull(String text) {
            return text == null ? null : JsonParser.parseString(text).getAsJsonObject();
        }

        private static void setNullable(PreparedStatement ps, int index, String value) throws SQLException {
            if (value == null) {
                ps.setNull(index, Types.VARCHAR);
            } else {
                ps.setString(index, value);
            }
        }

        @Override
        public List<MapItemRecord> liveAttached(String project, String lineId) throws SQLException {
            List<MapItemRecord> items = new ArrayList<>();
            // The partial index mapstudio_item_attached_line (migration 2) serves this predicate.
            try (PreparedStatement ps = c.prepareStatement("SELECT " + ITEM_COLUMNS + " FROM mapstudio_item"
                    + " WHERE project = ? AND (attachment->>'lineId') = ? AND attachment IS NOT NULL AND NOT deleted"
                    + " ORDER BY (attachment->>'distanceM')::double precision, id")) {
                ps.setString(1, project);
                ps.setString(2, lineId);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        items.add(item(rs));
                    }
                }
            }
            return items;
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

        @Override
        public Optional<KindSetupRecord> lockKindSetup(String project, String kindId) throws SQLException {
            try (PreparedStatement ps = c.prepareStatement("SELECT " + KIND_SETUP_COLUMNS
                    + " FROM mapstudio_kind_setup WHERE project = ? AND kind_id = ? FOR UPDATE")) {
                ps.setString(1, project);
                ps.setString(2, kindId);
                try (ResultSet rs = ps.executeQuery()) {
                    return rs.next() ? Optional.of(kindSetup(rs)) : Optional.empty();
                }
            }
        }

        @Override
        public void insertKindSetup(String project, KindSetupRecord setup) throws SQLException {
            try (PreparedStatement ps = c.prepareStatement("INSERT INTO mapstudio_kind_setup (project, kind_id, setup, "
                    + "version, deleted, updated_at) VALUES (?, ?, ?::jsonb, ?, ?, now())")) {
                ps.setString(1, project);
                ps.setString(2, setup.kindId());
                ps.setString(3, setup.setup().toString());
                ps.setInt(4, setup.version());
                ps.setBoolean(5, setup.deleted());
                ps.executeUpdate();
            }
        }

        @Override
        public void updateKindSetup(String project, KindSetupRecord setup) throws SQLException {
            try (PreparedStatement ps = c.prepareStatement("UPDATE mapstudio_kind_setup SET setup = ?::jsonb, "
                    + "version = ?, deleted = ?, updated_at = now() WHERE project = ? AND kind_id = ?")) {
                ps.setString(1, setup.setup().toString());
                ps.setInt(2, setup.version());
                ps.setBoolean(3, setup.deleted());
                ps.setString(4, project);
                ps.setString(5, setup.kindId());
                if (ps.executeUpdate() != 1) {
                    throw new SQLException("mapstudio_kind_setup row " + setup.kindId() + " was not updated");
                }
            }
        }

        @Override
        public List<KindSetupRecord> liveKindSetups(String project) throws SQLException {
            List<KindSetupRecord> setups = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement("SELECT " + KIND_SETUP_COLUMNS
                    + " FROM mapstudio_kind_setup WHERE project = ? AND NOT deleted ORDER BY kind_id")) {
                ps.setString(1, project);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        setups.add(kindSetup(rs));
                    }
                }
            }
            return setups;
        }

        private static KindSetupRecord kindSetup(ResultSet rs) throws SQLException {
            return new KindSetupRecord(rs.getString(1), JsonParser.parseString(rs.getString(2)).getAsJsonObject(),
                rs.getInt(3), rs.getBoolean(4));
        }

        private static MapItemRecord item(ResultSet rs) throws SQLException {
            String ends = rs.getString(8);
            JsonElement endsJson = ends == null ? JsonNull.INSTANCE : JsonParser.parseString(ends);
            String attachment = rs.getString(11);
            Attachment at = attachment == null ? null : Attachment.parse(JsonParser.parseString(attachment));
            return new MapItemRecord(rs.getString(1), rs.getString(2), rs.getString(3),
                JsonParser.parseString(rs.getString(4)).getAsJsonObject(),
                JsonParser.parseString(rs.getString(5)).getAsJsonObject(),
                rs.getString(6),
                JsonParser.parseString(rs.getString(7)).getAsJsonObject(),
                endsJson, at, rs.getInt(9), rs.getBoolean(10));
        }
    }
}
