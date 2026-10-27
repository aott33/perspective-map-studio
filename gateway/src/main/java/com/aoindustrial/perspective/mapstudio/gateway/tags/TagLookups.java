package com.aoindustrial.perspective.mapstudio.gateway.tags;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.util.LoggerEx;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.Asset;
import com.aoindustrial.perspective.mapstudio.common.contract.Kind;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Rows;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.common.contract.TagChild;
import com.aoindustrial.perspective.mapstudio.common.contract.TagPaths;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.AdapterSnapshot;
import com.aoindustrial.perspective.mapstudio.gateway.setup.SetupRegistry;
import com.aoindustrial.perspective.mapstudio.gateway.store.MapStore;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;
import com.aoindustrial.perspective.mapstudio.gateway.write.RoleMatrix;

/**
 * The tag browser's two lookups (entry 15, docs/contract.md): {@code tags.browse} lists the
 * tag providers and one folder's children, {@code tags.resolve} turns a picked path into the
 * asset-relative {@code {asset.path}/...} form and counts the kind's linked map items it resolves
 * for. Checks, in order: the project's setup ({@code store-unreachable}), the session's level
 * (anything but {@code full} is {@code role}, before the body is read), the body and the names
 * ({@code invalid}), the map store for {@code tags.resolve} ({@code store-unreachable}), then the
 * tag calls ({@code tags-unavailable}). For {@code tags.resolve} the level is decided again on the
 * setup the map items are read under, so the role and the read always come from one setup.
 * Reads tag structure only; writes nothing.
 */
public final class TagLookups {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.tags");

    /** The most children one {@code tags.browse} returns. */
    public static final int MAX_CHILDREN = 1000;

    static final String ROLE_MESSAGE = "Browsing tags needs a full editing role. Ask for a Map Studio editing role.";

    private final SetupRegistry setups;
    private final StoreGate gate;
    private final MapStore store;
    private final Function<String, AdapterSnapshot> adapters;
    private final TagSource source;

    public TagLookups(SetupRegistry setups, StoreGate gate, MapStore store, Function<String, AdapterSnapshot> adapters,
            TagSource source) {
        this.setups = setups;
        this.gate = gate;
        this.store = store;
        this.adapters = adapters;
        this.source = source;
    }

    /** The {@code tags.browse.reply} body. */
    public JsonObject browseReply(String project, Collection<String> roles, JsonObject body) {
        requireFull(project, roles);
        String askedProvider = optionalString(body, "provider");
        String folder = TagPaths.folder(optionalString(body, "folder"));
        List<String> providers = sorted(source.providers());
        String defaultProvider = defaultProvider(providers, source.projectDefault(project));
        String provider;
        if (askedProvider == null || askedProvider.isEmpty()) {
            if (defaultProvider == null) {
                throw new MapStudioException(Messages.CODE_INVALID, "The Gateway has no tag provider to browse.");
            }
            provider = defaultProvider;
        } else {
            provider = named(providers, askedProvider);
            if (provider == null) {
                throw new MapStudioException(Messages.CODE_INVALID,
                    "There is no tag provider named " + Rows.echo(askedProvider) + " on this Gateway.");
            }
        }
        TagSource.Browse browse = source.browse(provider, folder, roles, MAX_CHILDREN);
        if (!browse.found()) {
            throw new MapStudioException(Messages.CODE_INVALID,
                "The folder " + Rows.echo(folder) + " was not found in tag provider " + provider + ".");
        }
        List<TagChild> children = new ArrayList<>(browse.children());
        children.sort(TagChild.BY_NAME);
        JsonObject reply = new JsonObject();
        reply.addProperty("provider", provider);
        reply.addProperty("folder", folder);
        JsonArray list = new JsonArray();
        for (String name : providers) {
            JsonObject p = new JsonObject();
            p.addProperty("name", name);
            p.addProperty("isDefault", name.equals(defaultProvider));
            list.add(p);
        }
        reply.add("providers", list);
        JsonArray kids = new JsonArray();
        children.forEach(c -> kids.add(c.toJson()));
        reply.add("children", kids);
        reply.addProperty("truncated", browse.truncated());
        return reply;
    }

    /** The {@code tags.resolve.reply} body. */
    public JsonObject resolveReply(String project, Collection<String> roles, JsonObject body) {
        requireFull(project, roles);
        String kindId = requiredString(body, "kindId");
        String assetId = requiredString(body, "assetId");
        String path = requiredString(body, "path");
        AdapterSnapshot lists = adapters.apply(project);
        boolean kindKnown = false;
        for (Kind kind : lists.kinds()) {
            kindKnown |= kind.id().equals(kindId);
        }
        if (!kindKnown) {
            throw new MapStudioException(Messages.CODE_INVALID,
                "The kind " + Rows.echo(kindId) + " is not in the kind list.");
        }
        Map<String, Asset> assets = new LinkedHashMap<>();
        lists.assets().forEach(a -> assets.put(a.id(), a));
        Asset asset = assets.get(assetId);
        if (asset == null) {
            throw new MapStudioException(Messages.CODE_INVALID,
                "The asset " + Rows.echo(assetId) + " is not in the asset list.");
        }
        if (!asset.kind().equals(kindId)) {
            throw new MapStudioException(Messages.CODE_INVALID,
                "The asset " + Rows.echo(assetId) + " is a " + asset.kind() + ", not a " + kindId + ".");
        }
        if (!path.startsWith("{")) {
            TagPaths.parseFull(path);
            if (!usable(asset.basePath())) {
                throw new MapStudioException(Messages.CODE_INVALID, "The asset " + Rows.echo(assetId)
                    + "'s basePath " + Rows.echo(asset.basePath())
                    + " cannot be used for tag paths; the host adapter must give a full path such as [default]Mesa/P12.");
            }
        }
        TagPaths.Resolved resolved = TagPaths.resolve(path, asset.basePath());
        StoreGate.Readable readable = gate.requireReadable(project);
        // The setup the items are read under decides the level too (a setup change may land in between).
        requireFull(readable.setup(), roles);
        JsonObject reply = new JsonObject();
        reply.addProperty("path", resolved.path());
        reply.addProperty("relative", resolved.relative());
        if (!resolved.relative()) {
            return reply;
        }
        // An item whose asset's basePath is not a usable full path counts in m but never in n.
        int m = 0;
        List<String> candidates = new ArrayList<>();
        for (MapItemRecord item : liveItems(project, readable.setup())) {
            if (kindId.equals(item.kind()) && item.assetId() != null && assets.containsKey(item.assetId())) {
                m++;
                String base = assets.get(item.assetId()).basePath();
                if (usable(base)) {
                    candidates.add(TagPaths.under(base, resolved.suffix()));
                }
            }
        }
        Set<String> existing = candidates.isEmpty()
            ? Set.of()
            : source.existing(new LinkedHashSet<>(candidates), roles);
        int n = 0;
        for (String candidate : candidates) {
            if (existing.contains(candidate)) {
                n++;
            }
        }
        reply.addProperty("n", n);
        reply.addProperty("m", m);
        return reply;
    }

    /**
     * The provider marked {@code isDefault} (owner decision, 2026-10-27): the project's default tag
     * provider when it names one of {@code providers}; else {@code default} when present; else the
     * first by name other than {@code System}; else {@code System}; null when there is none. Pure.
     */
    static String defaultProvider(List<String> providers, String projectDefault) {
        if (projectDefault != null && !projectDefault.isBlank()) {
            String named = named(providers, projectDefault.trim());
            if (named != null) {
                return named;
            }
        }
        String fallback = named(providers, "default");
        if (fallback != null) {
            return fallback;
        }
        for (String p : sorted(providers)) {
            if (!p.equalsIgnoreCase("System")) {
                return p;
            }
        }
        return providers.isEmpty() ? null : sorted(providers).get(0);
    }

    private void requireFull(String project, Collection<String> roles) {
        requireFull(setups.require(project), roles);
    }

    private static void requireFull(Setup setup, Collection<String> roles) {
        if (!Messages.LEVEL_FULL.equals(RoleMatrix.level(setup, roles))) {
            throw new MapStudioException(Messages.CODE_ROLE, ROLE_MESSAGE);
        }
    }

    private List<MapItemRecord> liveItems(String project, Setup setup) {
        try {
            return store.inTransaction(setup.connection(), tx -> tx.liveItems(project));
        } catch (SQLException ex) {
            log.errorf("Map Studio could not read the map of project %s on database connection %s (SQLState %s): %s",
                project, setup.connection(), ex.getSQLState(), ex.getClass().getSimpleName());
            throw new MapStudioException(Messages.CODE_STORE_UNREACHABLE,
                "The map store could not be read (SQLState " + ex.getSQLState() + ").");
        }
    }

    /**
     * Whether an asset's basePath is a full path the lookups can build on: story 3's adapter check
     * is looser ({@code [~]Mesa/P12} and {@code [default]/Mesa/P12} pass it).
     */
    private static boolean usable(String basePath) {
        try {
            TagPaths.parseFull(basePath);
            return true;
        } catch (MapStudioException ex) {
            return false;
        }
    }

    /** Case-insensitive lookup (Ignition's own rule for provider names, live 8.3.10); the Gateway's spelling. */
    private static String named(List<String> providers, String name) {
        for (String p : providers) {
            if (p.equalsIgnoreCase(name)) {
                return p;
            }
        }
        return null;
    }

    private static List<String> sorted(List<String> providers) {
        List<String> copy = new ArrayList<>(providers);
        copy.sort(Comparator.comparing((String s) -> s.toLowerCase(Locale.ROOT)).thenComparing(s -> s));
        return copy;
    }

    private static String optionalString(JsonObject body, String key) {
        JsonElement e = body.get(key);
        if (e == null || e.isJsonNull()) {
            return null;
        }
        if (!e.isJsonPrimitive() || !e.getAsJsonPrimitive().isString()) {
            throw new MapStudioException(Messages.CODE_INVALID, key + " must be a string.");
        }
        return e.getAsString();
    }

    private static String requiredString(JsonObject body, String key) {
        String s = optionalString(body, key);
        if (s == null || s.isEmpty()) {
            throw new MapStudioException(Messages.CODE_INVALID, "tags.resolve needs " + key + ".");
        }
        return s;
    }
}
