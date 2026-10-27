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
 * a tag). A folder that does not exist answers {@code Bad_NotFound}. Existence is checked by
 * browsing each distinct parent folder once, all at once, within one 5 s deadline: 300 distinct
 * parents took 55 ms on the dev Gateway. Structure only: no value is read.
 */
public final class IgnitionTagSource implements TagSource {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.tags");

    /** Every tag call answers within this, or the lookup is {@code tags-unavailable}. */
    static final long TIMEOUT_MS = 5_000;

    private final GatewayTagManager tags;
    private final ProjectManager projects;

    public IgnitionTagSource(GatewayTagManager tags, ProjectManager projects) {
        this.tags = tags;
        this.projects = projects;
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
        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(TIMEOUT_MS);
        // One more than the cap, so a full folder shows as truncated (the browse reports no total, live).
        BrowseFilter filter = new BrowseFilter().setMaxResults(max + 1);
        Results<NodeDescription> r = await(p.browseAsync(path(provider, folder), filter, context(roles)), deadline,
            "browse a folder");
        if (isNotFound(r.getResultQuality())) {
            return new Browse(false, List.of(), false);
        }
        if (r.getResultQuality() != null && r.getResultQuality().isNotGood()) {
            throw unavailable("browse a folder (quality " + r.getResultQuality().getName() + ")", null);
        }
        List<TagChild> children = new ArrayList<>();
        int seen = 0;
        if (r.getResults() != null) {
            for (NodeDescription d : r.getResults()) {
                seen++;
                if (seen > max) {
                    break;
                }
                String type = d.getObjectType() == null ? null : d.getObjectType().name();
                String full = d.getFullPath() == null ? null : d.getFullPath().toStringFull();
                if (TagChild.listed(type, full)) {
                    children.add(TagChild.of(d.getName(), full, type,
                        d.getDataType() == null ? null : d.getDataType().name(), d.hasChildren()));
                }
            }
        }
        return new Browse(true, children, seen > max);
    }

    @Override
    public Set<String> existing(Collection<String> fullPaths, Collection<String> roles) {
        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(TIMEOUT_MS);
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
        Map<String, CompletableFuture<Results<NodeDescription>>> calls = new LinkedHashMap<>();
        for (Map.Entry<String, TagPath> e : parents.entrySet()) {
            TagProvider p = provider(e.getValue().getSource());
            if (p != null) {
                calls.put(e.getKey(), p.browseAsync(e.getValue(), new BrowseFilter(), context));
            }
        }
        Set<String> found = new HashSet<>();
        for (Map.Entry<String, CompletableFuture<Results<NodeDescription>>> e : calls.entrySet()) {
            Results<NodeDescription> r = await(e.getValue(), deadline, "check that tags exist");
            if (r.getResults() == null || isNotFound(r.getResultQuality())) {
                continue;
            }
            Set<String> names = new HashSet<>();
            for (NodeDescription d : r.getResults()) {
                String type = d.getObjectType() == null ? null : d.getObjectType().name();
                if (!"Property".equals(type) && d.getName() != null) {
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

    private static boolean isNotFound(QualityCode q) {
        return q != null && q.is(QualityCode.Bad_NotFound);
    }

    private static <T> T await(CompletableFuture<T> future, long deadline, String what) {
        long left = deadline - System.nanoTime();
        try {
            return future.get(Math.max(0L, left), TimeUnit.NANOSECONDS);
        } catch (TimeoutException ex) {
            future.cancel(true);
            log.warnf("The tag system did not answer within %d s when asked to %s.", TIMEOUT_MS / 1000, what);
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
