package com.aoindustrial.perspective.mapstudio.gateway.tags;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.browsing.BrowseFilter;
import com.inductiveautomation.ignition.common.browsing.Results;
import com.inductiveautomation.ignition.common.model.values.QualityCode;
import com.inductiveautomation.ignition.common.sqltags.model.types.DataType;
import com.inductiveautomation.ignition.common.tags.browsing.NodeDescription;
import com.inductiveautomation.ignition.common.tags.config.types.TagObjectType;
import com.inductiveautomation.ignition.common.tags.model.TagPath;
import com.inductiveautomation.ignition.common.tags.model.TagProvider;
import com.inductiveautomation.ignition.common.tags.paths.parser.TagPathParser;
import com.inductiveautomation.ignition.gateway.tags.model.GatewayTagManager;

import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;

/**
 * Epic 2 story 15: {@link IgnitionTagSource} against a stub tag manager and provider: the
 * deadline, the cap and {@code truncated}, the nodes that are never listed, {@code Bad_NotFound}
 * and other bad qualities, the case-insensitive grouping by parent, and the bounded fan-out.
 */
class IgnitionTagSourceTest {

    static final List<String> ROLES = List.of("MapEditor");

    /** What the stub provider answers for one browsed path (its full string, as Ignition prints it). */
    Function<TagPath, CompletableFuture<Results<NodeDescription>>> answer = p -> done(Results.of(List.of()));
    final List<String> browsed = new CopyOnWriteArrayList<>();
    final List<Integer> maxResults = new CopyOnWriteArrayList<>();
    final List<CompletableFuture<?>> futures = new CopyOnWriteArrayList<>();

    IgnitionTagSource source(long timeoutMs) {
        TagProvider provider = (TagProvider) Proxy.newProxyInstance(TagProvider.class.getClassLoader(),
            new Class<?>[] {TagProvider.class}, (proxy, method, args) -> {
                if (method.getName().equals("browseAsync")) {
                    TagPath path = (TagPath) args[0];
                    BrowseFilter filter = (BrowseFilter) args[1];
                    browsed.add(path.toStringFull());
                    maxResults.add(filter.hasMaxResults() ? filter.getMaxResults() : -1);
                    CompletableFuture<Results<NodeDescription>> f = answer.apply(path);
                    futures.add(f);
                    return f;
                }
                return null;
            });
        GatewayTagManager manager = (GatewayTagManager) Proxy.newProxyInstance(GatewayTagManager.class.getClassLoader(),
            new Class<?>[] {GatewayTagManager.class}, (proxy, method, args) -> switch (method.getName()) {
                case "getTagProviderNames" -> List.of("default");
                case "getTagProvider" -> "default".equalsIgnoreCase((String) args[0]) ? provider : null;
                default -> null;
            });
        return new IgnitionTagSource(manager, null, timeoutMs);
    }

    static CompletableFuture<Results<NodeDescription>> done(Results<NodeDescription> r) {
        return CompletableFuture.completedFuture(r);
    }

    static TagPath path(String full) {
        try {
            return TagPathParser.parse(full);
        } catch (Exception ex) {
            throw new IllegalArgumentException(full, ex);
        }
    }

    static NodeDescription tag(String full) {
        TagPath p = path(full);
        return NodeDescription.newBuilder().name(p.getItemName()).fullPath(p).objectType(TagObjectType.AtomicTag)
            .dataType(DataType.Float8).hasChildren(false).build();
    }

    static NodeDescription property(String name, String parent) {
        return NodeDescription.newBuilder().name(name).fullPath(path(parent + "." + name))
            .objectType(TagObjectType.Property).build();
    }

    /** A UDT instance's {@code Parameters} node: no full path. */
    static NodeDescription parameters() {
        return NodeDescription.newBuilder().name("Parameters").objectType(TagObjectType.Node).hasChildren(true).build();
    }

    MapStudioException refused(Runnable r) {
        return assertThrows(MapStudioException.class, r::run);
    }

    // browse

    @Test
    void aFullUdtInstanceWithItsParametersNodeIsNotTruncated() {
        List<NodeDescription> nodes = new ArrayList<>();
        nodes.add(parameters());
        nodes.add(property("Documentation", "[default]Big"));
        for (int i = 0; i < TagLookups.MAX_CHILDREN; i++) {
            nodes.add(tag("[default]Big/T" + String.format("%04d", i)));
        }
        answer = p -> done(Results.of(nodes));
        TagSource.Browse b = source(1000).browse("default", "Big", ROLES, TagLookups.MAX_CHILDREN);
        assertTrue(b.found());
        assertEquals(TagLookups.MAX_CHILDREN, b.children().size(), "only listed nodes count toward the cap");
        assertFalse(b.truncated());
        assertEquals(List.of("[default]Big"), browsed);
        assertEquals(TagLookups.MAX_CHILDREN + 1 + IgnitionTagSource.UNLISTED_SLACK, maxResults.get(0));
    }

    @Test
    void oneListedChildOverTheCapIsTruncated() {
        List<NodeDescription> nodes = new ArrayList<>();
        for (int i = 0; i <= TagLookups.MAX_CHILDREN; i++) {
            nodes.add(tag("[default]Big/T" + String.format("%04d", i)));
        }
        answer = p -> done(Results.of(nodes));
        TagSource.Browse b = source(1000).browse("default", "Big", ROLES, TagLookups.MAX_CHILDREN);
        assertEquals(TagLookups.MAX_CHILDREN, b.children().size());
        assertTrue(b.truncated());
    }

    @Test
    void anAnswerAsLargeAsAskedMayHaveLeftOutChildrenSoItIsTruncated() {
        int max = 2;
        int asked = max + 1 + IgnitionTagSource.UNLISTED_SLACK;
        List<NodeDescription> nodes = new ArrayList<>();
        nodes.add(tag("[default]A/T"));
        for (int i = 1; i < asked; i++) {
            nodes.add(property("P" + i, "[default]A/T"));
        }
        answer = p -> done(Results.of(nodes));
        TagSource.Browse full = source(1000).browse("default", "A", ROLES, max);
        assertEquals(1, full.children().size(), "properties are never listed");
        assertEquals("tag", full.children().get(0).type());
        assertTrue(full.truncated(), "the tag system stopped at the limit asked for");
        nodes.remove(nodes.size() - 1);
        assertFalse(source(1000).browse("default", "A", ROLES, max).truncated());
    }

    @Test
    void aMissingFolderIsNotFoundAndAnyOtherBadQualityIsTagsUnavailable() {
        answer = p -> done(Results.error(QualityCode.Bad_NotFound));
        assertFalse(source(1000).browse("default", "Nope", ROLES, 10).found());
        answer = p -> done(Results.error(QualityCode.Bad_AccessDenied));
        assertEquals("tags-unavailable", refused(() -> source(1000).browse("default", "Mesa", ROLES, 10)).code());
        assertFalse(source(1000).browse("nope", "", ROLES, 10).found(), "an unknown provider has no folder");
    }

    @Test
    void aBrowseThatNeverAnswersIsTagsUnavailableAndIsCancelled() {
        answer = p -> new CompletableFuture<>();
        MapStudioException ex = refused(() -> source(50).browse("default", "", ROLES, 10));
        assertEquals("tags-unavailable", ex.code());
        assertEquals("The tag system did not answer within 5 s.", ex.plainMessage());
        assertTrue(futures.get(0).isCancelled());
    }

    @Test
    void aFailedBrowseIsTagsUnavailable() {
        answer = p -> CompletableFuture.failedFuture(new IllegalStateException("boom"));
        MapStudioException ex = refused(() -> source(1000).browse("default", "", ROLES, 10));
        assertEquals("tags-unavailable", ex.code());
        assertTrue(ex.plainMessage().startsWith("The tag system could not be asked to browse a folder"));
    }

    // existing

    @Test
    void parentsAreGroupedWithoutCaseAndPropertiesDoNotCountAsTags() {
        answer = p -> p.toStringFull().equalsIgnoreCase("[default]Mesa/P12")
            ? done(Results.of(List.of(tag("[default]Mesa/P12/Pressure"), property("Flow", "[default]Mesa/P12"))))
            : done(Results.error(QualityCode.Bad_NotFound));
        Set<String> found = source(1000).existing(
            List.of("[default]Mesa/P12/Pressure", "[default]mesa/p12/PRESSURE", "[default]Mesa/P12/Flow",
                "[default]Mesa/P99/Pressure", "[nope]Mesa/P12/Pressure"), ROLES);
        assertEquals(Set.of("[default]Mesa/P12/Pressure", "[default]mesa/p12/PRESSURE"), found);
        assertEquals(2, browsed.size(), "one browse per distinct parent of a known provider: " + browsed);
    }

    @Test
    void aParentWithABadQualityIsTagsUnavailableNotMissing() {
        answer = p -> done(Results.error(QualityCode.Bad_Stale));
        assertEquals("tags-unavailable",
            refused(() -> source(1000).existing(List.of("[default]Mesa/P12/Pressure"), ROLES)).code());
    }

    @Test
    void aTimeoutCancelsEveryBrowseStillRunning() {
        answer = p -> new CompletableFuture<>();
        IgnitionTagSource s = source(50);
        assertEquals("tags-unavailable", refused(() -> s.existing(
            List.of("[default]A/X", "[default]B/X", "[default]C/X"), ROLES)).code());
        assertEquals(3, futures.size());
        for (CompletableFuture<?> f : futures) {
            assertTrue(f.isCancelled());
        }
    }

    @Test
    void theFanOutIsBounded() {
        AtomicInteger inFlight = new AtomicInteger();
        AtomicInteger most = new AtomicInteger();
        Map<String, Boolean> seen = new ConcurrentHashMap<>();
        answer = p -> {
            most.accumulateAndGet(inFlight.incrementAndGet(), Math::max);
            seen.put(p.toStringFull(), true);
            return CompletableFuture.supplyAsync(() -> {
                inFlight.decrementAndGet();
                return Results.of(List.of(tag(p.toStringFull() + "/X")));
            }, CompletableFuture.delayedExecutor(5, TimeUnit.MILLISECONDS));
        };
        List<String> paths = new ArrayList<>();
        for (int i = 0; i < 3 * IgnitionTagSource.MAX_IN_FLIGHT + 7; i++) {
            paths.add("[default]Mesa/P" + i + "/X");
        }
        Set<String> found = source(5000).existing(paths, ROLES);
        assertEquals(paths.size(), found.size());
        assertEquals(paths.size(), seen.size());
        assertTrue(most.get() <= IgnitionTagSource.MAX_IN_FLIGHT, "at most " + IgnitionTagSource.MAX_IN_FLIGHT
            + " at once, saw " + most.get());
    }
}
