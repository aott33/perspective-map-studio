package com.aoindustrial.perspective.mapstudio.gateway.store;

import java.util.List;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonNull;
import com.inductiveautomation.ignition.common.gson.JsonObject;

import com.aoindustrial.perspective.mapstudio.common.contract.EditBatch;

/**
 * One page of the edit record, as {@code edits.history.reply}'s body (epic-editing entry 11a):
 * {@code {entries: [{seq, batchId, actor, at, source, ops: [{op, entity, id, name, kind, version, before,
 * after}]}], more}}, one entry per committed batch, newest first.
 *
 * <p>The page rule ({@link #take}): a page closes at {@code limit} entries (at most {@link #MAX_ENTRIES}) or
 * once adding the next batch would take it past {@link #MAX_OPS} ops, always with at least one whole entry;
 * a batch is never split, and no batch alone exceeds {@link EditBatch#MAX_OPS}. {@code more} is true when older
 * batches remain.
 */
public record HistoryPage(List<Entry> entries, boolean more) {

    /** The most entries one page holds, and {@code limit}'s default. */
    public static final int MAX_ENTRIES = 50;

    /** The most ops one page holds once it has an entry: one batch's cap. */
    public static final int MAX_OPS = EditBatch.MAX_OPS;

    /** One committed batch: when, by whom, from where, and its ops in the order they were saved. */
    public record Entry(long seq, String batchId, String actor, String at, String source, List<Op> ops) {
    }

    /** One saved op; {@code before}, {@code after}, {@code name} and {@code kind} may be null. */
    public record Op(String op, String entity, String id, String name, String kind, int version, JsonObject before,
                     JsonObject after) {
    }

    /**
     * How many of the batches, newest first, given as their op counts, one page takes: at most {@code limit},
     * and no more once adding the next would take the page past {@link #MAX_OPS} ops; at least one when there
     * is any. Pure.
     */
    public static int take(List<Integer> opCounts, int limit) {
        int n = 0;
        int ops = 0;
        for (int count : opCounts) {
            if (n >= limit || (n > 0 && ops + count > MAX_OPS)) {
                break;
            }
            n++;
            ops += count;
        }
        return n;
    }

    /** The reply body. */
    public JsonObject toJson() {
        JsonArray list = new JsonArray();
        for (Entry e : entries) {
            JsonObject entry = new JsonObject();
            entry.addProperty("seq", e.seq());
            entry.addProperty("batchId", e.batchId());
            entry.addProperty("actor", e.actor());
            entry.addProperty("at", e.at());
            entry.addProperty("source", e.source());
            JsonArray ops = new JsonArray();
            for (Op op : e.ops()) {
                JsonObject o = new JsonObject();
                o.addProperty("op", op.op());
                o.addProperty("entity", op.entity());
                o.addProperty("id", op.id());
                addNullable(o, "name", op.name());
                addNullable(o, "kind", op.kind());
                o.addProperty("version", op.version());
                o.add("before", op.before() == null ? JsonNull.INSTANCE : op.before().deepCopy());
                o.add("after", op.after() == null ? JsonNull.INSTANCE : op.after().deepCopy());
                ops.add(o);
            }
            entry.add("ops", ops);
            list.add(entry);
        }
        JsonObject body = new JsonObject();
        body.add("entries", list);
        body.addProperty("more", more);
        return body;
    }

    private static void addNullable(JsonObject o, String key, String value) {
        if (value == null) {
            o.add(key, JsonNull.INSTANCE);
        } else {
            o.addProperty(key, value);
        }
    }
}
