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

import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.gateway.store.MapStore;

/**
 * An in-memory {@link MapStore} for the write path's tests: each transaction works
 * on a copy of the committed state, which replaces it only when the work returns,
 * so a refusal half way through leaves nothing behind (all or none). Shared by the
 * write service's tests; later entries (retries, deletes, kind setups, failure
 * cases) extend it rather than adding another fake.
 */
public class FakeMapStore implements MapStore {

    /** One committed batch row. */
    public record BatchRow(String project, String batchId, long seq, String actor, JsonObject result) {
    }

    /** Everything the store holds; copied per transaction. */
    public static final class State {
        public final Map<String, Long> seqs = new HashMap<>();
        public final Map<String, TreeMap<String, MapItemRecord>> items = new HashMap<>();
        public final List<EditRow> edits = new ArrayList<>();
        public final Map<String, BatchRow> batches = new LinkedHashMap<>();

        State copy() {
            State s = new State();
            s.seqs.putAll(seqs);
            items.forEach((p, m) -> s.items.put(p, new TreeMap<>(m)));
            s.edits.addAll(edits);
            s.batches.putAll(batches);
            return s;
        }
    }

    public State committed = new State();
    public int transactions;
    /** When set, the next transaction throws it at its first write (a database failure). */
    public SQLException failNextWrite;

    @Override
    public <T> T inTransaction(String connection, Work<T> work) throws SQLException {
        transactions++;
        State working = committed.copy();
        T result = work.run(new FakeTx(working));
        committed = working;
        return result;
    }

    public List<MapItemRecord> items(String project) {
        return new ArrayList<>(committed.items.getOrDefault(project, new TreeMap<>()).values());
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
        }

        @Override
        public void insertBatch(String project, String batchId, long seq, String actor, JsonObject result)
                throws SQLException {
            String key = project + "|" + batchId;
            if (s.batches.containsKey(key)) {
                throw new SQLException("duplicate key value violates unique constraint", "23505");
            }
            s.batches.put(key, new BatchRow(project, batchId, seq, actor, result));
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
    }
}
