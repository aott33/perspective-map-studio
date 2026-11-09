package com.aoindustrial.perspective.mapstudio.gateway.store;

import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.inductiveautomation.ignition.common.gson.JsonObject;

import com.aoindustrial.perspective.mapstudio.common.contract.KindSetupRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;

/**
 * The map store repository (AD-3): the only code that reads or writes the
 * {@code mapstudio_} tables. Everything happens in one transaction per call of
 * {@link #inTransaction}: committed when the work returns, rolled back when it throws.
 * The Gateway implementation is {@link JdbcMapStore}; the write service's tests use
 * an in-memory fake ({@code gateway/src/test/.../write/FakeMapStore.java}).
 */
public interface MapStore {

    @FunctionalInterface
    interface Work<T> {
        T run(Tx tx) throws SQLException;
    }

    /** Run {@code work} in one transaction on the named database connection. */
    <T> T inTransaction(String connection, Work<T> work) throws SQLException;

    /**
     * One edit record row (one per saved op). Since schema 3 (epic-editing entry 11a) it also keeps what the op did:
     * {@code before} and {@code after} (a create {@code after} only, a delete {@code before} only, an update the
     * top-level fields whose values differ), and the item's {@code name} and {@code kind} as written (the stored
     * record's for a delete; a kind setup's kind id and no name). Any of the four may be null.
     */
    record EditRow(String project, String batchId, long seq, String entity, String entityId, String op, int version,
                   String actor, String source, JsonObject before, JsonObject after, String name, String kind) {

        /** A row without values, name or kind (as rows from before schema 3 read). */
        public EditRow(String project, String batchId, long seq, String entity, String entityId, String op, int version,
                       String actor, String source) {
            this(project, batchId, seq, entity, entityId, op, version, actor, source, null, null, null, null);
        }
    }

    /** A committed batch as its row keeps it: who saved it and the reply it got. */
    record StoredBatch(String actor, JsonObject result) {
    }

    /** Who made an entity's last change and when (ISO 8601, UTC, to the second). */
    record LastEdit(String actor, String at) {
    }

    /** What a transaction may do. Times are the database's {@code now()}: one time per transaction. */
    interface Tx {

        /** Take the project's next change sequence number; its row stays locked until the transaction ends. */
        long nextSeq(String project) throws SQLException;

        /** The project's last change sequence number, 0 before the first batch. */
        long currentSeq(String project) throws SQLException;

        /** The stored map item, locked for update until the transaction ends; empty when there is none. */
        Optional<MapItemRecord> lockItem(String project, String id) throws SQLException;

        void insertItem(String project, MapItemRecord item) throws SQLException;

        void updateItem(String project, MapItemRecord item) throws SQLException;

        void insertEdit(EditRow row) throws SQLException;

        /** The batch's result, kept so a retried batchId returns it (entry 2). */
        void insertBatch(String project, String batchId, long seq, String actor, JsonObject result) throws SQLException;

        /** The committed batch of this id, or empty (epic 2 story 2: a retried batchId replays it). */
        Optional<StoredBatch> findBatch(String project, String batchId) throws SQLException;

        /** The last edit record of one entity, or empty when it has none. */
        Optional<LastEdit> lastEdit(String project, String entity, String entityId) throws SQLException;

        /**
         * Who last changed each map item of the project and when, by item id (epic 4 entry 7a, {@code map.load.reply}'s
         * {@code changed}): the newest edit record of every item, in one query; an item with no record is absent.
         */
        Map<String, LastEdit> lastEdits(String project) throws SQLException;

        /**
         * The live map items attached to this line ({@code attachment.lineId}), ordered by
         * {@code distanceM} then id; unlocked (epic 2 story 14). The project row lock taken by
         * {@link #nextSeq} serialises the project's batches, so none can attach another meanwhile.
         */
        List<MapItemRecord> liveAttached(String project, String lineId) throws SQLException;

        /**
         * One page of the edit record for {@code edits.history} (epic-editing entry 11a): whole batches newest first,
         * only those with a {@code seq} below {@code before} (null: from the newest), closed by
         * {@link HistoryPage#take}'s rule (at most {@code limit} entries and {@link HistoryPage#MAX_OPS} ops, at least
         * one whole entry). A row from before schema 3 reads its name and kind from the entity's stored record and
         * its values as null.
         */
        HistoryPage history(String project, Long before, int limit) throws SQLException;

        /** Every map item of the project that is not deleted, ordered by id. */
        List<MapItemRecord> liveItems(String project) throws SQLException;

        /** The stored kind setup, locked for update until the transaction ends; empty when there is none (story 9). */
        Optional<KindSetupRecord> lockKindSetup(String project, String kindId) throws SQLException;

        void insertKindSetup(String project, KindSetupRecord setup) throws SQLException;

        void updateKindSetup(String project, KindSetupRecord setup) throws SQLException;

        /** Every kind setup of the project that is not deleted, ordered by kind id. */
        List<KindSetupRecord> liveKindSetups(String project) throws SQLException;
    }
}
