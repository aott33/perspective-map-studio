package com.aoindustrial.perspective.mapstudio.gateway.load;

import java.sql.SQLException;
import java.util.List;
import java.util.function.Function;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.util.LoggerEx;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.Asset;
import com.aoindustrial.perspective.mapstudio.common.contract.Kind;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.AdapterSnapshot;
import com.aoindustrial.perspective.mapstudio.gateway.store.MapStore;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;

/**
 * Assembles {@code map.load}'s reply, {@code {level, seq, items, kinds, assets,
 * adapters}}, and {@code getMap}'s list from the map store and the host adapters'
 * cache. {@code assets} (with their tag paths) go only to sessions that may link
 * items, {@code phone} and {@code full} (owner decision, 2026-10-26); every level
 * gets the kinds and both statuses.
 */
public final class MapLoader {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.load");

    /** A project's live map items and its last change sequence number, read in one transaction. */
    public record Snapshot(long seq, List<MapItemRecord> items) {
    }

    private final StoreGate gate;
    private final MapStore store;
    private final Function<String, AdapterSnapshot> adapters;

    public MapLoader(StoreGate gate, MapStore store, Function<String, AdapterSnapshot> adapters) {
        this.gate = gate;
        this.store = store;
        this.adapters = adapters;
    }

    /** @throws MapStudioException {@code store-unreachable} when the project's map store cannot be read */
    public Snapshot snapshot(String project) {
        Setup setup = gate.requireReady(project);
        try {
            return store.inTransaction(setup.connection(),
                tx -> new Snapshot(tx.currentSeq(project), tx.liveItems(project)));
        } catch (SQLException ex) {
            log.errorf("Map Studio could not read the map of project %s on database connection %s (SQLState %s): %s",
                project, setup.connection(), ex.getSQLState(), ex.getClass().getSimpleName());
            throw new MapStudioException(Messages.CODE_STORE_UNREACHABLE,
                "The map store could not be read (SQLState " + ex.getSQLState() + ").");
        }
    }

    /** The {@code map.load.reply} body for a session at {@code level}. */
    public JsonObject mapLoadReply(String project, String level) {
        Snapshot snapshot = snapshot(project);
        JsonObject body = new JsonObject();
        body.addProperty("level", level);
        body.addProperty("seq", snapshot.seq());
        body.add("items", toJson(snapshot.items()));
        AdapterSnapshot lists = adapters.apply(project);
        body.add("kinds", Kind.toJson(lists.kinds()));
        if (Messages.LEVEL_PHONE.equals(level) || Messages.LEVEL_FULL.equals(level)) {
            body.add("assets", Asset.toJson(lists.assets()));
        }
        body.add("adapters", lists.statusJson());
        return body;
    }

    public static JsonArray toJson(List<MapItemRecord> items) {
        JsonArray array = new JsonArray();
        for (MapItemRecord item : items) {
            array.add(item.toJson());
        }
        return array;
    }
}
