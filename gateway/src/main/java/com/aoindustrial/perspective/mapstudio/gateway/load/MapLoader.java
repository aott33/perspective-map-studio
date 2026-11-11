package com.aoindustrial.perspective.mapstudio.gateway.load;

import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.function.Function;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonNull;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.util.LoggerEx;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.Asset;
import com.aoindustrial.perspective.mapstudio.common.contract.Kind;
import com.aoindustrial.perspective.mapstudio.common.contract.KindSetupRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Rows;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.AdapterSnapshot;
import com.aoindustrial.perspective.mapstudio.gateway.store.HistoryPage;
import com.aoindustrial.perspective.mapstudio.gateway.store.MapStore;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;
import com.aoindustrial.perspective.mapstudio.gateway.write.RoleMatrix;

/**
 * Assembles {@code map.load}'s reply, {@code {level, seq, items, kinds, assets,
 * adapters, readOnly, setup, changed}}, and {@code getMap}'s list from the map store and the host
 * adapters' cache. {@code assets} (with their tag paths) go only to sessions that may link
 * items, {@code phone} and {@code full} (owner decision, 2026-10-26); every level
 * gets the kinds, {@code assetNames} (the assets' ids and names alone, for the search of
 * epic 3 entry 9) and both statuses, but level {@code none} gets the viewer
 * messages, without host error text or row ids. A read-only store (newer schema, or
 * this Gateway a standby) is read as usual; {@code readOnly} carries the reason, null
 * when saving works (epic 2 story 5). {@code setup} is the part of the project setup
 * the browser needs (epic 2 story 6). {@code kindSetups}, the project's live kind setups
 * (they hold tag paths), go to {@code phone} and {@code full} only, like the assets (owner
 * decision, 2026-10-27, epic 2 story 9). {@code changed}, who last changed each item and when (epic 4 entry 7a, 0.4.0),
 * goes to {@code phone} and {@code full} only, read in the load's transaction in one query.
 */
public final class MapLoader {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.load");

    /**
     * A project's live map items, live kind setups and last change sequence number, read in one transaction, and, when
     * asked for (an editor's map.load, entry 7a), who last changed each item and when ({@code changed}, else empty).
     */
    public record Snapshot(long seq, List<MapItemRecord> items, List<KindSetupRecord> kindSetups,
                           Map<String, MapStore.LastEdit> changed) {

        /** A snapshot with no last edits. */
        public Snapshot(long seq, List<MapItemRecord> items, List<KindSetupRecord> kindSetups) {
            this(seq, items, kindSetups, Map.of());
        }

        /** A snapshot with no kind setups. */
        public Snapshot(long seq, List<MapItemRecord> items) {
            this(seq, items, List.of());
        }
    }

    /** A snapshot and why the map cannot be saved here (null when it can). */
    public record Loaded(Snapshot snapshot, String readOnly) {
    }

    private static final LoggerEx storeLog = LoggerEx.newBuilder().build("MapStudio.store");

    private final StoreGate gate;
    private final MapStore store;
    private final Function<String, AdapterSnapshot> adapters;
    /** The projects whose stored tag paths were reported since this Gateway (this module) started (entry 13a). */
    private final Set<String> pathsReported = ConcurrentHashMap.newKeySet();
    private final Consumer<StoredPathReport> pathReports;

    public MapLoader(StoreGate gate, MapStore store, Function<String, AdapterSnapshot> adapters) {
        this(gate, store, adapters, MapLoader::logPaths);
    }

    /** With another sink for the stored tag path report (tests). */
    MapLoader(StoreGate gate, MapStore store, Function<String, AdapterSnapshot> adapters,
            Consumer<StoredPathReport> pathReports) {
        this.gate = gate;
        this.store = store;
        this.adapters = adapters;
        this.pathReports = pathReports;
    }

    /** One warning per stored row the tag path rule refuses, then one info line (logger MapStudio.store). */
    private static void logPaths(StoredPathReport report) {
        report.warnings().forEach(storeLog::warn);
        storeLog.info(report.info());
    }

    /**
     * The first read of a project's store after the Gateway starts reports the stored tag paths the
     * rule would refuse (entry 13a). The rows are read as they are and returned unchanged; a report
     * that fails never fails the read.
     */
    private void reportPaths(String project, Snapshot snapshot) {
        if (!pathsReported.add(project)) {
            return;
        }
        try {
            pathReports.accept(StoredPathReport.of(project, snapshot.kindSetups(), snapshot.items()));
        } catch (RuntimeException ex) {
            storeLog.warnf("Project %s: its stored tag paths could not be checked against the tag path rule (%s).",
                Rows.echo(project), ex.getClass().getSimpleName());
        }
    }

    /** @throws MapStudioException {@code store-unreachable} when the project's map store cannot be read */
    public Snapshot snapshot(String project) {
        return load(project).snapshot();
    }

    /** @throws MapStudioException {@code store-unreachable} when the project's map store cannot be read */
    public Loaded load(String project) {
        return load(project, gate.requireReadable(project), false);
    }

    /** {@code withChanged}: the items' last edits are read too, in the same transaction, in one query (entry 7a). */
    private Loaded load(String project, StoreGate.Readable readable, boolean withChanged) {
        Setup setup = readable.setup();
        try {
            Snapshot snapshot = store.inTransaction(setup.connection(),
                tx -> new Snapshot(tx.currentSeq(project), tx.liveItems(project), tx.liveKindSetups(project),
                    withChanged ? tx.lastEdits(project) : Map.of()));
            reportPaths(project, snapshot);
            return new Loaded(snapshot, readable.readOnly());
        } catch (SQLException ex) {
            log.errorf("Map Studio could not read the map of project %s on database connection %s (SQLState %s): %s",
                project, setup.connection(), ex.getSQLState(), ex.getClass().getSimpleName());
            throw new MapStudioException(Messages.CODE_STORE_UNREACHABLE,
                "The map store could not be read (SQLState " + ex.getSQLState() + ").");
        }
    }

    /** Why a viewer may not read the edit record ({@code role}): it names the editors and their items. */
    static final String HISTORY_ROLE_MESSAGE = "Recent changes need an editing role. Ask for a Map Studio editing role.";

    /**
     * The {@code edits.history.reply} body (epic-editing entry 11a): one page of the edit record, newest first,
     * for levels {@code phone} and {@code full}; {@code none} is refused {@code role} before anything is read, so
     * a viewer never learns names. {@code before} (a change sequence number) and {@code limit} (1 to 50, default
     * 50) are checked, else {@code invalid}. A read-only store is read as usual.
     *
     * @throws MapStudioException {@code role}, {@code invalid} or {@code store-unreachable}
     */
    public JsonObject historyReply(String project, Function<Setup, String> levelOf, JsonObject body) {
        StoreGate.Readable readable = gate.requireReadable(project);
        Setup setup = readable.setup();
        if (!RoleMatrix.isEditor(levelOf.apply(setup))) {
            throw new MapStudioException(Messages.CODE_ROLE, HISTORY_ROLE_MESSAGE);
        }
        Long before = historyNumber(body, "before", 1, Long.MAX_VALUE);
        Long limit = historyNumber(body, "limit", 1, HistoryPage.MAX_ENTRIES);
        int pageSize = limit == null ? HistoryPage.MAX_ENTRIES : limit.intValue();
        try {
            return store.inTransaction(setup.connection(), tx -> tx.history(project, before, pageSize)).toJson();
        } catch (SQLException ex) {
            log.errorf("Map Studio could not read the edit record of project %s on database connection %s (SQLState %s):"
                + " %s", project, setup.connection(), ex.getSQLState(), ex.getClass().getSimpleName());
            throw new MapStudioException(Messages.CODE_STORE_UNREACHABLE,
                "The map store could not be read (SQLState " + ex.getSQLState() + ").");
        }
    }

    /** An optional whole number of the history request between {@code min} and {@code max}; null when absent. */
    static Long historyNumber(JsonObject body, String key, long min, long max) {
        JsonElement e = body == null ? null : body.get(key);
        if (e == null || e.isJsonNull()) {
            return null;
        }
        if (e.isJsonPrimitive() && e.getAsJsonPrimitive().isNumber()) {
            // Exact: a double check passes 2^63, which getAsLong would wrap to Long.MIN_VALUE.
            try {
                java.math.BigDecimal d = e.getAsBigDecimal();
                if (d.stripTrailingZeros().scale() <= 0 && d.compareTo(java.math.BigDecimal.valueOf(min)) >= 0
                        && d.compareTo(java.math.BigDecimal.valueOf(max)) <= 0) {
                    return d.longValueExact();
                }
            } catch (NumberFormatException | ArithmeticException ex) {
                // Not a number we can read exactly: refused below.
            }
        }
        String range = max == Long.MAX_VALUE ? "a whole number from " + min : "a whole number from " + min + " to " + max;
        throw new MapStudioException(Messages.CODE_INVALID, "edits.history: " + key + " must be " + range + ".");
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
        boolean editor = RoleMatrix.isEditor(level);
        Loaded loaded = load(project, readable, editor);
        Snapshot snapshot = loaded.snapshot();
        JsonObject body = new JsonObject();
        body.addProperty("level", level);
        body.addProperty("seq", snapshot.seq());
        JsonArray items = toJson(snapshot.items());
        if (!editor) {
            // An item's overrides hold full tag paths, which viewers do not get (as kindSetups).
            for (JsonElement item : items) {
                item.getAsJsonObject().add("overrides", new JsonObject());
            }
        }
        body.add("items", items);
        AdapterSnapshot lists = adapters.apply(project);
        body.add("kinds", Kind.toJson(lists.kinds()));
        if (editor) {
            body.add("assets", Asset.toJson(lists.assets()));
            body.add("kindSetups", kindSetupsJson(snapshot.kindSetups()));
            body.add("changed", changedJson(snapshot.items(), snapshot.changed()));
        }
        // Every level gets the asset names (no base path), so a viewer's search finds a map item by its asset (entry 9).
        body.add("assetNames", Asset.namesJson(lists.assets()));
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
     * {@code setup}, since 0.2.0): never the connection, the roles, the functions or
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

    /**
     * {@code map.load.reply}'s {@code changed} (entry 7a, 0.4.0): {@code {<itemId>: {actor, at}}} for each live item with an
     * edit record, {@code at} ISO 8601 UTC to the second; an item with none (or no time) is left out.
     */
    public static JsonObject changedJson(List<MapItemRecord> items, Map<String, MapStore.LastEdit> edits) {
        JsonObject o = new JsonObject();
        for (MapItemRecord item : items) {
            MapStore.LastEdit edit = edits.get(item.id());
            if (edit == null || edit.actor() == null || edit.at() == null) {
                continue;
            }
            JsonObject e = new JsonObject();
            e.addProperty("actor", edit.actor());
            e.addProperty("at", edit.at());
            o.add(item.id(), e);
        }
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
