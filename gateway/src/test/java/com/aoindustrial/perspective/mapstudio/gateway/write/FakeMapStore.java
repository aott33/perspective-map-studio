package com.aoindustrial.perspective.mapstudio.gateway.write;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;

import com.inductiveautomation.ignition.common.gson.JsonObject;

import com.aoindustrial.perspective.mapstudio.common.contract.KindSetupRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.gateway.store.MapStore;

/**
 * An in-memory {@link MapStore} for the write path's tests: each transaction works
 * on a copy of the committed state, which replaces it only when the work returns,
 * so a refusal half way through leaves nothing behind (all or none). Shared by the
 * write service's tests; later entries (retries, deletes, kind setups, failure
 * cases) extend it rather than adding another fake. Edit rows carry {@link #now}.
 */
public class FakeMapStore implements MapStore {

    /** One committed batch row. */
    public record BatchRow(String project, String batchId, long seq, String actor, JsonObject result) {
    }

    /** Everything the store holds; copied per transaction. */
    public static final class State {
        public final Map<String, Long> seqs = new HashMap<>();
        public final Map<String, TreeMap<String, MapItemRecord>> items = new HashMap<>();
        public final Map<String, TreeMap<String, KindSetupRecord>> kindSetups = new HashMap<>();
        public final List<EditRow> edits = new ArrayList<>();
        public final List<String> editTimes = new ArrayList<>();
        public final Map<String, BatchRow> batches = new LinkedHashMap<>();

        State copy() {
            State s = new State();
            s.seqs.putAll(seqs);
            items.forEach((p, m) -> s.items.put(p, new TreeMap<>(m)));
            kindSetups.forEach((p, m) -> s.kindSetups.put(p, new TreeMap<>(m)));
            s.edits.addAll(edits);
            s.editTimes.addAll(editTimes);
            s.batches.putAll(batches);
            return s;
        }
    }

    public State committed = new State();
    /** The time every edit record of the fake carries (the database's now()). */
    public String now = "2026-10-26T14:02:00Z";
    /**
     * When set, the next insertBatch finds this row already committed by another transaction
     * (a concurrent send of the same batchId): it is added to the committed state and the
     * insert throws SQLState 23505, as PostgreSQL's primary key would.
     */
    public BatchRow racingBatch;
    /**
     * When set, the next nextSeq finds this row committed by another transaction while it
     * waited for the project row lock (a concurrent send of the same batchId that won the
     * lock): the row and its seq join the committed state and this transaction's view, so the
     * findBatch after nextSeq sees it, while every lookup before nextSeq did not.
     */
    public BatchRow batchCommittedDuringSeqLock;
    /** How many times nextSeq ran, committed or not. */
    public int nextSeqCalls;
    public int transactions;
    /** The database connection the last transaction was opened on. */
    public String lastConnection;
    /** When set, the next transaction throws it at its first write (a database failure). */
    public SQLException failNextWrite;

    /** Serialised, as the project row lock serialises a project's batches. */
    @Override
    public synchronized <T> T inTransaction(String connection, Work<T> work) throws SQLException {
        transactions++;
        lastConnection = connection;
        State working = committed.copy();
        T result = work.run(new FakeTx(working));
        committed = working;
        return result;
    }

    public List<MapItemRecord> items(String project) {
        return new ArrayList<>(committed.items.getOrDefault(project, new TreeMap<>()).values());
    }

    public List<KindSetupRecord> kindSetups(String project) {
        return new ArrayList<>(committed.kindSetups.getOrDefault(project, new TreeMap<>()).values());
    }

    private final class FakeTx implements Tx {
        private final State s;

        FakeTx(State s) {
            this.s = s;
        }

        private void maybeFail() throws SQLException {
            if (failNextWrite != null) {
                SQLException ex = failNextWrite;
                failNextWrite = null;
                throw ex;
            }
        }

        @Override
        public long nextSeq(String project) throws SQLException {
            maybeFail();
            nextSeqCalls++;
            if (batchCommittedDuringSeqLock != null) {
                BatchRow won = batchCommittedDuringSeqLock;
                batchCommittedDuringSeqLock = null;
                String key = won.project() + "|" + won.batchId();
                committed.batches.put(key, won);
                committed.seqs.put(won.project(), won.seq());
                s.batches.put(key, won);
                s.seqs.put(won.project(), won.seq());
            }
            long next = s.seqs.getOrDefault(project, 0L) + 1;
            s.seqs.put(project, next);
            return next;
        }

        @Override
        public long currentSeq(String project) {
            return s.seqs.getOrDefault(project, 0L);
        }

        @Override
        public Optional<MapItemRecord> lockItem(String project, String id) {
            return Optional.ofNullable(s.items.getOrDefault(project, new TreeMap<>()).get(id));
        }

        @Override
        public void insertItem(String project, MapItemRecord item) throws SQLException {
            maybeFail();
            TreeMap<String, MapItemRecord> m = s.items.computeIfAbsent(project, p -> new TreeMap<>());
            if (m.containsKey(item.id())) {
                throw new SQLException("duplicate key", "23505");
            }
            m.put(item.id(), item);
        }

        @Override
        public void updateItem(String project, MapItemRecord item) throws SQLException {
            maybeFail();
            TreeMap<String, MapItemRecord> m = s.items.computeIfAbsent(project, p -> new TreeMap<>());
            if (!m.containsKey(item.id())) {
                throw new SQLException("no row", "02000");
            }
            m.put(item.id(), item);
        }

        @Override
        public void insertEdit(EditRow row) {
            s.edits.add(row);
            s.editTimes.add(now);
        }

        @Override
        public void insertBatch(String project, String batchId, long seq, String actor, JsonObject result)
                throws SQLException {
            String key = project + "|" + batchId;
            if (racingBatch != null) {
                BatchRow raced = racingBatch;
                racingBatch = null;
                committed.batches.put(raced.project() + "|" + raced.batchId(), raced);
                throw new SQLException("duplicate key value violates unique constraint", "23505");
            }
            if (s.batches.containsKey(key)) {
                throw new SQLException("duplicate key value violates unique constraint", "23505");
            }
            s.batches.put(key, new BatchRow(project, batchId, seq, actor, result));
        }

        @Override
        public Optional<StoredBatch> findBatch(String project, String batchId) {
            BatchRow row = s.batches.get(project + "|" + batchId);
            return row == null ? Optional.empty() : Optional.of(new StoredBatch(row.actor(), row.result().deepCopy()));
        }

        @Override
        public Optional<LastEdit> lastEdit(String project, String entity, String entityId) {
            for (int i = s.edits.size() - 1; i >= 0; i--) {
                EditRow row = s.edits.get(i);
                if (row.project().equals(project) && row.entity().equals(entity) && row.entityId().equals(entityId)) {
                    return Optional.of(new LastEdit(row.actor(), s.editTimes.get(i)));
                }
            }
            return Optional.empty();
        }

        @Override
        public List<MapItemRecord> liveItems(String project) {
            List<MapItemRecord> out = new ArrayList<>();
            for (MapItemRecord r : s.items.getOrDefault(project, new TreeMap<>()).values()) {
                if (!r.deleted()) {
                    out.add(r);
                }
            }
            return out;
        }

        @Override
        public Optional<KindSetupRecord> lockKindSetup(String project, String kindId) {
            return Optional.ofNullable(s.kindSetups.getOrDefault(project, new TreeMap<>()).get(kindId));
        }

        @Override
        public void insertKindSetup(String project, KindSetupRecord setup) throws SQLException {
            maybeFail();
            TreeMap<String, KindSetupRecord> m = s.kindSetups.computeIfAbsent(project, p -> new TreeMap<>());
            if (m.containsKey(setup.kindId())) {
                throw new SQLException("duplicate key", "23505");
            }
            m.put(setup.kindId(), setup);
        }

        @Override
        public void updateKindSetup(String project, KindSetupRecord setup) throws SQLException {
            maybeFail();
            TreeMap<String, KindSetupRecord> m = s.kindSetups.computeIfAbsent(project, p -> new TreeMap<>());
            if (!m.containsKey(setup.kindId())) {
                throw new SQLException("no row", "02000");
            }
            m.put(setup.kindId(), setup);
        }

        @Override
        public List<KindSetupRecord> liveKindSetups(String project) {
            List<KindSetupRecord> out = new ArrayList<>();
            for (KindSetupRecord r : s.kindSetups.getOrDefault(project, new TreeMap<>()).values()) {
                if (!r.deleted()) {
                    out.add(r);
                }
            }
            return out;
        }
    }
}
