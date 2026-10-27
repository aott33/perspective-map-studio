package com.aoindustrial.perspective.mapstudio.gateway.load;

import java.sql.SQLException;
import java.util.List;
import java.util.function.Function;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.util.LoggerEx;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.gateway.store.MapStore;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;

/**
 * Assembles {@code map.load}'s reply, {@code {level, seq, items, setup}}, and
 * {@code getMap}'s list from the map store. Kind setups join the reply in entry 3.
 */
public final class MapLoader {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.load");

    /** A project's live map items and its last change sequence number, read in one transaction. */
    public record Snapshot(long seq, List<MapItemRecord> items) {
    }

    private final StoreGate gate;
    private final MapStore store;

    public MapLoader(StoreGate gate, MapStore store) {
        this.gate = gate;
        this.store = store;
    }

    /** @throws MapStudioException {@code store-unreachable} when the project's map store cannot be read */
    public Snapshot snapshot(String project) {
        return snapshot(project, gate.requireReady(project));
    }

    private Snapshot snapshot(String project, Setup setup) {
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

    /** The {@code map.load.reply} body for a session at a fixed {@code level}. */
    public JsonObject mapLoadReply(String project, String level) {
        return mapLoadReply(project, setup -> level);
    }

    /**
     * The {@code map.load.reply} body, with the level worked out by {@code levelOf} from the
     * same setup the reply is built from. The setup is read once per call (never kept here), so
     * a changed setup applies at the next map.load and one reply never mixes two setups.
     */
    public JsonObject mapLoadReply(String project, Function<Setup, String> levelOf) {
        Setup setup = gate.requireReady(project);
        String level = levelOf.apply(setup);
        Snapshot snapshot = snapshot(project, setup);
        JsonObject body = new JsonObject();
        body.addProperty("level", level);
        body.addProperty("seq", snapshot.seq());
        body.add("items", toJson(snapshot.items()));
        body.add("setup", setupJson(setup));
        return body;
    }

    /**
     * The part of the setup the browser needs ({@code map.load.reply}'s optional
     * {@code setup}, 0.2.0 draft): never the connection, the roles, the functions or
     * the token secret's name.
     */
    public static JsonObject setupJson(Setup setup) {
        JsonObject o = new JsonObject();
        o.addProperty("refreshIntervalSeconds", setup.refreshIntervalSeconds());
        JsonArray basemaps = new JsonArray();
        setup.basemaps().forEach(basemaps::add);
        o.add("basemaps", basemaps);
        o.addProperty("alarmPage", setup.alarmPage());
        return o;
    }

    public static JsonArray toJson(List<MapItemRecord> items) {
        JsonArray array = new JsonArray();
        for (MapItemRecord item : items) {
            array.add(item.toJson());
        }
        return array;
    }
}
