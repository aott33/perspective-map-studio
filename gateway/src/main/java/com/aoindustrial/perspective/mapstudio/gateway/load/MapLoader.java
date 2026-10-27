package com.aoindustrial.perspective.mapstudio.gateway.load;

import java.sql.SQLException;
import java.util.List;
import java.util.function.Function;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonNull;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.util.LoggerEx;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.Asset;
import com.aoindustrial.perspective.mapstudio.common.contract.Kind;
import com.aoindustrial.perspective.mapstudio.common.contract.KindSetupRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.AdapterSnapshot;
import com.aoindustrial.perspective.mapstudio.gateway.store.MapStore;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;

/**
 * Assembles {@code map.load}'s reply, {@code {level, seq, items, kinds, assets,
 * adapters, readOnly, setup}}, and {@code getMap}'s list from the map store and the host
 * adapters' cache. {@code assets} (with their tag paths) go only to sessions that may link
 * items, {@code phone} and {@code full} (owner decision, 2026-10-26); every level
 * gets the kinds and both statuses, but level {@code none} gets the viewer
 * messages, without host error text or row ids. A read-only store (newer schema, or
 * this Gateway a standby) is read as usual; {@code readOnly} carries the reason, null
 * when saving works (epic 2 story 5). {@code setup} is the part of the project setup
 * the browser needs (epic 2 story 6). {@code kindSetups}, the project's live kind setups
 * (they hold tag paths), go to {@code phone} and {@code full} only, like the assets (owner
 * decision, 2026-10-27, epic 2 story 9).
 */
public final class MapLoader {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.load");

    /** A project's live map items, live kind setups and last change sequence number, read in one transaction. */
    public record Snapshot(long seq, List<MapItemRecord> items, List<KindSetupRecord> kindSetups) {

        /** A snapshot with no kind setups. */
        public Snapshot(long seq, List<MapItemRecord> items) {
            this(seq, items, List.of());
        }
    }

    /** A snapshot and why the map cannot be saved here (null when it can). */
    public record Loaded(Snapshot snapshot, String readOnly) {
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
        return load(project).snapshot();
    }

    /** @throws MapStudioException {@code store-unreachable} when the project's map store cannot be read */
    public Loaded load(String project) {
        return load(project, gate.requireReadable(project));
    }

    private Loaded load(String project, StoreGate.Readable readable) {
        Setup setup = readable.setup();
        try {
            return new Loaded(store.inTransaction(setup.connection(),
                tx -> new Snapshot(tx.currentSeq(project), tx.liveItems(project), tx.liveKindSetups(project))),
                readable.readOnly());
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
        StoreGate.Readable readable = gate.requireReadable(project);
        Setup setup = readable.setup();
        String level = levelOf.apply(setup);
        Loaded loaded = load(project, readable);
        Snapshot snapshot = loaded.snapshot();
        JsonObject body = new JsonObject();
        body.addProperty("level", level);
        body.addProperty("seq", snapshot.seq());
        body.add("items", toJson(snapshot.items()));
        AdapterSnapshot lists = adapters.apply(project);
        body.add("kinds", Kind.toJson(lists.kinds()));
        boolean editor = Messages.LEVEL_PHONE.equals(level) || Messages.LEVEL_FULL.equals(level);
        if (editor) {
            body.add("assets", Asset.toJson(lists.assets()));
            body.add("kindSetups", kindSetupsJson(snapshot.kindSetups()));
        }
        body.add("adapters", lists.statusJson(editor));
        if (loaded.readOnly() == null) {
            body.add("readOnly", JsonNull.INSTANCE);
        } else {
            body.addProperty("readOnly", loaded.readOnly());
        }
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

    public static JsonArray kindSetupsJson(List<KindSetupRecord> setups) {
        JsonArray array = new JsonArray();
        for (KindSetupRecord setup : setups) {
            array.add(setup.toJson());
        }
        return array;
    }

    public static JsonArray toJson(List<MapItemRecord> items) {
        JsonArray array = new JsonArray();
        for (MapItemRecord item : items) {
            array.add(item.toJson());
        }
        return array;
    }
}
