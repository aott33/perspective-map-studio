package com.aoindustrial.perspective.mapstudio.gateway.store;

import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

import com.inductiveautomation.ignition.common.gson.JsonObject;

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

    /** One edit record row (one per saved op). */
    record EditRow(String project, String batchId, long seq, String entity, String entityId, String op, int version,
                   String actor, String source) {
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

        /** Every map item of the project that is not deleted, ordered by id. */
        List<MapItemRecord> liveItems(String project) throws SQLException;
    }
}
