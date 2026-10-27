package com.aoindustrial.perspective.mapstudio.gateway.load;

import java.sql.SQLException;
import java.util.List;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonNull;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.util.LoggerEx;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.gateway.store.MapStore;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;

/**
 * Assembles {@code map.load}'s reply, {@code {level, seq, items, readOnly}}, and
 * {@code getMap}'s list from the map store. Kind setups join the reply in entry 3.
 * A read-only store (newer schema, or this Gateway a standby) is read as usual;
 * {@code readOnly} carries the reason, null when saving works (epic 2 story 5).
 */
public final class MapLoader {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.load");

    /** A project's live map items and its last change sequence number, read in one transaction. */
    public record Snapshot(long seq, List<MapItemRecord> items) {
    }

    /** A snapshot and why the map cannot be saved here (null when it can). */
    public record Loaded(Snapshot snapshot, String readOnly) {
    }

    private final StoreGate gate;
    private final MapStore store;

    public MapLoader(StoreGate gate, MapStore store) {
        this.gate = gate;
        this.store = store;
    }

    /** @throws MapStudioException {@code store-unreachable} when the project's map store cannot be read */
    public Snapshot snapshot(String project) {
        return load(project).snapshot();
    }

    /** @throws MapStudioException {@code store-unreachable} when the project's map store cannot be read */
    public Loaded load(String project) {
        StoreGate.Readable readable = gate.requireReadable(project);
        Setup setup = readable.setup();
        try {
            return new Loaded(store.inTransaction(setup.connection(),
                tx -> new Snapshot(tx.currentSeq(project), tx.liveItems(project))), readable.readOnly());
        } catch (SQLException ex) {
            log.errorf("Map Studio could not read the map of project %s on database connection %s (SQLState %s): %s",
                project, setup.connection(), ex.getSQLState(), ex.getClass().getSimpleName());
            throw new MapStudioException(Messages.CODE_STORE_UNREACHABLE,
                "The map store could not be read (SQLState " + ex.getSQLState() + ").");
        }
    }

    /** The {@code map.load.reply} body for a session at {@code level}. */
    public JsonObject mapLoadReply(String project, String level) {
        Loaded loaded = load(project);
        Snapshot snapshot = loaded.snapshot();
        JsonObject body = new JsonObject();
        body.addProperty("level", level);
        body.addProperty("seq", snapshot.seq());
        body.add("items", toJson(snapshot.items()));
        if (loaded.readOnly() == null) {
            body.add("readOnly", JsonNull.INSTANCE);
        } else {
            body.addProperty("readOnly", loaded.readOnly());
        }
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
