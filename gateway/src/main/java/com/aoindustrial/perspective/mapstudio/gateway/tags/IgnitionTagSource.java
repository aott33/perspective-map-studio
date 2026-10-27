package com.aoindustrial.perspective.mapstudio.gateway.tags;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import com.google.common.collect.ImmutableList;
import com.inductiveautomation.ignition.common.browsing.BrowseFilter;
import com.inductiveautomation.ignition.common.browsing.Results;
import com.inductiveautomation.ignition.common.model.values.QualityCode;
import com.inductiveautomation.ignition.common.tags.browsing.NodeDescription;
import com.inductiveautomation.ignition.common.tags.model.SecurityContext;
import com.inductiveautomation.ignition.common.tags.model.TagPath;
import com.inductiveautomation.ignition.common.tags.model.TagProvider;
import com.inductiveautomation.ignition.common.tags.paths.parser.TagPathParser;
import com.inductiveautomation.ignition.common.util.LoggerEx;
import com.inductiveautomation.ignition.gateway.project.ProjectManager;
import com.inductiveautomation.ignition.gateway.tags.model.GatewayTagManager;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.TagChild;

/**
 * {@link TagSource} over the Gateway's tag manager (docs/platform-checks.md, epic 2 story 15,
 * live 8.3.10): {@code getTagProviderNames()}, {@code getTagProvider(name)} (case-insensitive),
 * {@code TagProvider.browseAsync(path, filter, SecurityContext)} one level deep, with the
 * session user's roles through {@code SecurityContext.fromRolesAndZones} and no security zones
 * (the session's zones are not read, [unverified] whether a zone-scoped tag permission then hides
 * a tag). A folder that does not exist answers {@code Bad_NotFound}; any other bad quality is
 * {@code tags-unavailable}. Existence is checked by browsing each distinct parent folder once, at
 * most {@link #MAX_IN_FLIGHT} at a time, within one 5 s deadline: 300 distinct parents took 55 ms
 * on the dev Gateway, one after another. On a timeout or a failure every browse still running is
 * cancelled. Structure only: no value is read.
 */
public final class IgnitionTagSource implements TagSource {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.tags");

    /** Every tag call answers within this, or the lookup is {@code tags-unavailable}. */
    static final long TIMEOUT_MS = 5_000;

    /** The most parent-folder browses one existence check has running at once. */
    static final int MAX_IN_FLIGHT = 50;

    /**
     * Nodes asked for beyond the cap, for the ones that are never listed (tag properties, a UDT
     * instance's {@code Parameters}), so a folder whose listed children fit is not reported truncated.
     */
    static final int UNLISTED_SLACK = 64;

    private final GatewayTagManager tags;
    private final ProjectManager projects;
    private final long timeoutMs;

    public IgnitionTagSource(GatewayTagManager tags, ProjectManager projects) {
        this(tags, projects, TIMEOUT_MS);
    }

    /** With another deadline (tests). */
    IgnitionTagSource(GatewayTagManager tags, ProjectManager projects, long timeoutMs) {
        this.tags = tags;
        this.projects = projects;
        this.timeoutMs = timeoutMs;
    }

    @Override
    public List<String> providers() {
        try {
            return List.copyOf(tags.getTagProviderNames());
        } catch (RuntimeException ex) {
            throw unavailable("list the tag providers", ex);
        }
    }

    @Override
    public String projectDefault(String project) {
        try {
            return projects.getProjectProps(project).getDefaultSQLTagsProviderName();
        } catch (Exception ex) {
            log.debugf("Could not read the default tag provider of project %s: %s", project, ex.getClass().getSimpleName());
            return null;
        }
    }

    @Override
    public Browse browse(String provider, String folder, Collection<String> roles, int max) {
        TagProvider p = provider(provider);
        if (p == null) {
            return new Browse(false, List.of(), false);
        }
        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMs);
        // More than the cap, so a full folder shows as truncated (the browse reports no total, live),
        // with room for the nodes that are never listed.
        int asked = max + 1 + UNLISTED_SLACK;
        BrowseFilter filter = new BrowseFilter().setMaxResults(asked);
        Results<NodeDescription> r = await(p.browseAsync(path(provider, folder), filter, context(roles)), deadline,
            "browse a folder");
        if (isNotFound(r.getResultQuality())) {
            return new Browse(false, List.of(), false);
        }
        requireGood(r, "browse a folder");
        List<TagChild> children = new ArrayList<>();
        int returned = 0;
        boolean truncated = false;
        if (r.getResults() != null) {
            for (NodeDescription d : r.getResults()) {
                returned++;
                String type = d.getObjectType() == null ? null : d.getObjectType().name();
                String full = d.getFullPath() == null ? null : d.getFullPath().toStringFull();
                if (!TagChild.listed(type, full)) {
                    continue;
                }
                if (children.size() == max) {
                    truncated = true;
                    break;
                }
                children.add(TagChild.of(d.getName(), full, type,
                    d.getDataType() == null ? null : d.getDataType().name(), d.hasChildren()));
            }
        }
        // A full answer may have left out listed nodes beyond it.
        return new Browse(true, children, truncated || returned >= asked);
    }

    @Override
    public Set<String> existing(Collection<String> fullPaths, Collection<String> roles) {
        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMs);
        SecurityContext context = context(roles);
        Map<String, List<String>> byParent = new LinkedHashMap<>();
        Map<String, TagPath> parents = new LinkedHashMap<>();
        for (String full : fullPaths) {
            TagPath path = parse(full);
            if (path == null || path.getParentPath() == null) {
                continue;
            }
            TagPath parent = path.getParentPath();
            String key = parent.toStringFull().toLowerCase(Locale.ROOT);
            parents.putIfAbsent(key, parent);
            byParent.computeIfAbsent(key, k -> new ArrayList<>()).add(full);
        }
        List<Map.Entry<String, TagPath>> pending = new ArrayList<>(parents.entrySet());
        Set<String> found = new HashSet<>();
        for (int start = 0; start < pending.size(); start += MAX_IN_FLIGHT) {
            List<Map.Entry<String, TagPath>> batch = pending.subList(start, Math.min(pending.size(), start + MAX_IN_FLIGHT));
            Map<String, CompletableFuture<Results<NodeDescription>>> calls = new LinkedHashMap<>();
            try {
                for (Map.Entry<String, TagPath> e : batch) {
                    TagProvider p = provider(e.getValue().getSource());
                    if (p != null) {
                        calls.put(e.getKey(), p.browseAsync(e.getValue(), new BrowseFilter(), context));
                    }
                }
                for (Map.Entry<String, CompletableFuture<Results<NodeDescription>>> e : calls.entrySet()) {
                    Results<NodeDescription> r = await(e.getValue(), deadline, "check that tags exist");
                    if (isNotFound(r.getResultQuality())) {
                        continue;
                    }
                    requireGood(r, "check that tags exist");
                    if (r.getResults() == null) {
                        continue;
                    }
                    Set<String> names = new HashSet<>();
                    for (NodeDescription d : r.getResults()) {
                        String type = d.getObjectType() == null ? null : d.getObjectType().name();
                        String full = d.getFullPath() == null ? null : d.getFullPath().toStringFull();
                        if (TagChild.listed(type, full) && d.getName() != null) {
                            names.add(d.getName().toLowerCase(Locale.ROOT));
                        }
                    }
                    for (String full : byParent.get(e.getKey())) {
                        TagPath path = parse(full);
                        if (path != null && names.contains(path.getItemName().toLowerCase(Locale.ROOT))) {
                            found.add(full);
                        }
                    }
                }
            } catch (RuntimeException ex) {
                // A timeout or a failure answers now: nothing of this check may keep running.
                calls.values().forEach(f -> f.cancel(true));
                throw ex;
            }
        }
        return found;
    }

    private TagProvider provider(String name) {
        try {
            return tags.getTagProvider(name);
        } catch (RuntimeException ex) {
            throw unavailable("find a tag provider", ex);
        }
    }

    private static SecurityContext context(Collection<String> roles) {
        return SecurityContext.fromRolesAndZones(ImmutableList.copyOf(roles), ImmutableList.of());
    }

    private static TagPath path(String provider, String folder) {
        TagPath p = parse("[" + provider + "]" + folder);
        if (p == null) {
            throw new MapStudioException(Messages.CODE_INVALID, "The folder could not be read as a tag path.");
        }
        return p;
    }

    private static TagPath parse(String full) {
        try {
            return TagPathParser.parse(full);
        } catch (IOException | RuntimeException ex) {
            return null;
        }
    }

    /** A bad quality other than {@code Bad_NotFound} means the tag system could not answer: {@code tags-unavailable}. */
    private static void requireGood(Results<NodeDescription> r, String what) {
        if (r.getResultQuality() != null && r.getResultQuality().isNotGood()) {
            throw unavailable(what + " (quality " + r.getResultQuality().getName() + ")", null);
        }
    }

    private static boolean isNotFound(QualityCode q) {
        return q != null && q.is(QualityCode.Bad_NotFound);
    }

    private <T> T await(CompletableFuture<T> future, long deadline, String what) {
        long left = deadline - System.nanoTime();
        try {
            return future.get(Math.max(0L, left), TimeUnit.NANOSECONDS);
        } catch (TimeoutException ex) {
            future.cancel(true);
            log.warnf("The tag system did not answer within %d ms when asked to %s.", timeoutMs, what);
            throw new MapStudioException(Messages.CODE_TAGS_UNAVAILABLE,
                "The tag system did not answer within " + TIMEOUT_MS / 1000 + " s.");
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw unavailable(what, ex);
        } catch (ExecutionException ex) {
            throw unavailable(what, ex.getCause());
        }
    }

    private static MapStudioException unavailable(String what, Throwable cause) {
        log.warnf("The tag system failed when asked to %s: %s", what,
            cause == null ? "no answer" : cause.getClass().getSimpleName());
        return new MapStudioException(Messages.CODE_TAGS_UNAVAILABLE,
            "The tag system could not be asked to " + what + "; see the Gateway log.");
    }
}
