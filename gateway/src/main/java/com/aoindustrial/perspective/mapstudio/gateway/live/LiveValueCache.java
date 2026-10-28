package com.aoindustrial.perspective.mapstudio.gateway.live;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Function;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.util.LoggerEx;

import com.aoindustrial.perspective.mapstudio.common.contract.Asset;
import com.aoindustrial.perspective.mapstudio.common.contract.KindDisplay;
import com.aoindustrial.perspective.mapstudio.common.contract.LiveValue;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.StyleRule;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.AdapterSnapshot;
import com.aoindustrial.perspective.mapstudio.gateway.change.ChangeBus;
import com.aoindustrial.perspective.mapstudio.gateway.load.MapLoader;

/**
 * The shared live-value cache (AD-6, epic 3 entry 5): per project, one subscription per distinct
 * tag path the kind setups turn on, whatever the number of open maps or map items, the last
 * delivery per path, and the LiveValue of every slot of every planned map item, with stale worked
 * out from the quality and the item's comms (plan decisions 1 and 3).
 *
 * <p>Threads: deliveries arrive on the tag system's threads and only store the value, bump the
 * project's change sequence, mark the items the path serves and tell the item listeners (an open
 * popup); nothing else runs there. Plan rebuilds run on the one live thread ({@code live}), asked
 * for by {@link #ensure}, by every committed batch of the project (the change bus: a link, a kind
 * setup or an item change) and by {@link #checkAssets} when the asset list was replaced. A rebuild
 * subscribes the new paths, unsubscribes the gone ones, logs one line per path on
 * {@code MapStudio.live}, and makes every open map's next batch full.
 *
 * <p>Batches are built by the open maps' sessions ({@link LiveSession}) from {@link #batch}: the
 * items whose last change is after the session's last batch, or every item on a full batch.
 */
public final class LiveValueCache implements AutoCloseable {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.live");
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_INSTANT;

    /** The tag was subscribed and the tag system answered that it does not exist. */
    static final String NOT_FOUND = "the tag was not found";

    /** A subscription of an item's changes (an open popup); run it to stop. */
    @FunctionalInterface
    public interface Subscription {
        void cancel();
    }

    /** One batch: the project's sequence when it was built, whether it is full, and the body. */
    public record Batch(long seq, boolean full, JsonObject body) {
    }

    private static final class ProjectLive {
        volatile ValuePlan.Plan plan = ValuePlan.EMPTY;
        /** Only on the live thread. */
        final Map<String, TagSubscriber.Handle> subscriptions = new ConcurrentHashMap<>();
        final ConcurrentHashMap<String, TagSubscriber.Delivery> values = new ConcurrentHashMap<>();
        final AtomicLong seq = new AtomicLong();
        /** The sequence of the last rebuild: a session behind it needs a full batch. */
        volatile long fullSeq;
        final ConcurrentHashMap<String, Long> itemSeq = new ConcurrentHashMap<>();
        volatile List<Asset> plannedAssets = List.of();
        final List<ItemListener> listeners = new CopyOnWriteArrayList<>();
        ChangeBus.Subscription changes;
    }

    private record ItemListener(String itemId, Runnable onChange) {
    }

    private final TagSubscriber tags;
    private final Function<String, MapLoader.Snapshot> store;
    private final Function<String, AdapterSnapshot> adapters;
    private final ChangeBus changes;
    private final Executor live;
    private final ConcurrentHashMap<String, ProjectLive> projects = new ConcurrentHashMap<>();

    /**
     * @param store    the project's live items and kind setups ({@code MapLoader::snapshot}); may throw
     *                 {@code store-unreachable}, which keeps the last plan
     * @param adapters the project's kind and asset lists ({@code AdapterService::snapshot})
     * @param changes  the change bus, so a committed batch rebuilds the plan (null in tests without one)
     * @param live     the one thread rebuilds run on (the sessions' timers share it)
     */
    public LiveValueCache(TagSubscriber tags, Function<String, MapLoader.Snapshot> store,
                          Function<String, AdapterSnapshot> adapters, ChangeBus changes, Executor live) {
        this.tags = tags;
        this.store = store;
        this.adapters = adapters;
        this.changes = changes;
        this.live = live;
    }

    /** Start the project's cache if it is not running: a rebuild on the live thread and the change bus subscription. */
    public void ensure(String project) {
        if (projects.containsKey(project)) {
            return;
        }
        ProjectLive state = new ProjectLive();
        if (projects.putIfAbsent(project, state) != null) {
            return;
        }
        // The state is in the map before the first rebuild is asked for (a direct executor runs it now).
        if (changes != null) {
            state.changes = changes.subscribe(project, body -> schedule(project));
        }
        schedule(project);
    }

    private void schedule(String project) {
        try {
            live.execute(() -> rebuild(project));
        } catch (RejectedExecutionException ex) {
            log.debugf("Project %s: live plan not rebuilt, the module is stopping.", project);
        }
    }

    /** Rebuild the project's plan now, on the calling thread (the live thread, or a test). */
    public void rebuild(String project) {
        ProjectLive state = projects.get(project);
        if (state == null) {
            return;
        }
        MapLoader.Snapshot snapshot;
        try {
            snapshot = store.apply(project);
        } catch (MapStudioException ex) {
            log.debugf("Project %s: live plan kept, the map store could not be read (%s).", project, ex.code());
            return;
        } catch (RuntimeException ex) {
            log.warnf("Project %s: live plan kept, the map could not be read: %s", project, ex.getClass().getSimpleName());
            return;
        }
        AdapterSnapshot lists = adapters.apply(project);
        ValuePlan.Plan plan = ValuePlan.build(snapshot.kindSetups(), snapshot.items(), lists.assets(), lists.kinds());
        int added = 0;
        int removed = 0;
        for (String path : plan.paths()) {
            if (!state.subscriptions.containsKey(path)) {
                try {
                    state.subscriptions.put(path, tags.subscribe(path, d -> onDelivery(project, state, path, d)));
                    log.infof("Project %s: subscribed %s", project, path);
                    added++;
                } catch (RuntimeException ex) {
                    log.warnf("Project %s: could not subscribe %s: %s", project, path, ex.getMessage());
                }
            }
        }
        for (String path : new ArrayList<>(state.subscriptions.keySet())) {
            if (!plan.paths().contains(path)) {
                TagSubscriber.Handle handle = state.subscriptions.remove(path);
                state.values.remove(path);
                if (handle != null) {
                    handle.cancel();
                }
                log.infof("Project %s: unsubscribed %s", project, path);
                removed++;
            }
        }
        state.plan = plan;
        state.plannedAssets = lists.assets();
        long seq = state.seq.incrementAndGet();
        state.fullSeq = seq;
        state.itemSeq.keySet().retainAll(plan.items().keySet());
        for (String id : plan.items().keySet()) {
            state.itemSeq.put(id, seq);
        }
        log.infof("Project %s: live plan rebuilt: %d map items, %d tag paths (%d subscribed, %d unsubscribed), %d unresolved slots.",
            project, plan.items().size(), plan.paths().size(), added, removed, plan.problemCount());
    }

    /** Rebuild when the asset list was replaced since the plan (the adapters refreshed); called at a session's tick. */
    public void checkAssets(String project) {
        ProjectLive state = projects.get(project);
        if (state == null) {
            return;
        }
        if (!adapters.apply(project).assets().equals(state.plannedAssets)) {
            rebuild(project);
        }
    }

    private void onDelivery(String project, ProjectLive state, String path, TagSubscriber.Delivery delivery) {
        state.values.put(path, delivery);
        long seq = state.seq.incrementAndGet();
        Set<String> items = state.plan.itemsByPath().get(path);
        if (items == null) {
            return;
        }
        for (String id : items) {
            state.itemSeq.put(id, seq);
        }
        for (ItemListener listener : state.listeners) {
            if (items.contains(listener.itemId())) {
                try {
                    listener.onChange().run();
                } catch (RuntimeException ex) {
                    log.debugf("Project %s: a popup listener failed (%s).", project, ex.getClass().getSimpleName());
                }
            }
        }
    }

    /** The project's change sequence now. */
    public long seq(String project) {
        ProjectLive state = projects.get(project);
        return state == null ? 0 : state.seq.get();
    }

    /**
     * The batch for a session whose last batch was at {@code sinceSeq} (-1 before the first): full
     * when the plan was rebuilt since, else the items changed since; null when nothing changed.
     */
    public Batch batch(String project, long sinceSeq) {
        ProjectLive state = projects.get(project);
        if (state == null) {
            return null;
        }
        boolean full = sinceSeq < state.fullSeq;
        long seq = state.seq.get();
        ValuePlan.Plan plan = state.plan;
        JsonArray items = new JsonArray();
        for (ValuePlan.ItemPlan item : plan.items().values()) {
            Long changed = state.itemSeq.get(item.id());
            if (full || (changed != null && changed > sinceSeq)) {
                items.add(itemJson(state, item));
            }
        }
        if (!full && items.isEmpty()) {
            return null;
        }
        JsonObject body = new JsonObject();
        body.addProperty("seq", seq);
        body.addProperty("full", full);
        body.add("items", items);
        if (full) {
            body.add("kindDisplay", KindDisplay.toJson(plan.display()));
        }
        return new Batch(seq, full, body);
    }

    /** One item's values as a changes-only batch (an open popup), or null when the item is not planned. */
    public Batch itemBatch(String project, String itemId) {
        ProjectLive state = projects.get(project);
        if (state == null) {
            return null;
        }
        ValuePlan.ItemPlan item = state.plan.items().get(itemId);
        if (item == null) {
            return null;
        }
        JsonArray items = new JsonArray();
        items.add(itemJson(state, item));
        JsonObject body = new JsonObject();
        long seq = state.seq.get();
        body.addProperty("seq", seq);
        body.addProperty("full", false);
        body.add("items", items);
        return new Batch(seq, false, body);
    }

    /** Be told, on the tag system's thread, whenever a value of {@code itemId} is delivered. */
    public Subscription onItemChange(String project, String itemId, Runnable onChange) {
        ProjectLive state = projects.get(project);
        if (state == null) {
            return () -> { };
        }
        ItemListener listener = new ItemListener(itemId, onChange);
        state.listeners.add(listener);
        return () -> state.listeners.remove(listener);
    }

    /** The distinct paths subscribed for the project now (tests and the log check). */
    public Set<String> subscribedPaths(String project) {
        ProjectLive state = projects.get(project);
        return state == null ? Set.of() : Set.copyOf(state.subscriptions.keySet());
    }

    /** One map item's slots, with the comms rule applied, as the batch carries it. */
    JsonObject itemJson(ProjectLive state, ValuePlan.ItemPlan item) {
        Map<String, String> slots = item.slots();
        JsonObject o = new JsonObject();
        o.addProperty("id", item.id());
        List<ValuePlan.Problem> problems = new ArrayList<>(item.problems());
        LiveValue comms = null;
        boolean commsLost = false;
        String commsPath = slots.get(ValuePlan.COMMS);
        if (commsPath != null) {
            TagSubscriber.Delivery d = state.values.get(commsPath);
            comms = slot(d);
            if (d != null && d.notFound()) {
                problems.add(new ValuePlan.Problem(ValuePlan.COMMS, NOT_FOUND));
            }
            commsLost = comms.stale() || Boolean.FALSE.equals(d == null ? null : d.value());
            o.add("comms", comms.toJson());
        }
        JsonObject kpis = new JsonObject();
        for (Map.Entry<String, String> slot : slots.entrySet()) {
            if (!slot.getKey().startsWith(ValuePlan.KPI_PREFIX)) {
                continue;
            }
            TagSubscriber.Delivery d = state.values.get(slot.getValue());
            LiveValue value = slot(d);
            if (d != null && d.notFound()) {
                problems.add(new ValuePlan.Problem(slot.getKey(), NOT_FOUND));
            }
            if (commsLost) {
                value = value.staleFor(LiveValue.COMMS_LOST);
            }
            kpis.add(slot.getKey().substring(ValuePlan.KPI_PREFIX.length()), value.toJson());
        }
        o.add("kpis", kpis);
        if (slots.containsKey(ValuePlan.ALARM_PRIORITY)) {
            TagSubscriber.Delivery acked = state.values.get(slots.get(ValuePlan.ALARM_ACKED));
            TagSubscriber.Delivery unacked = state.values.get(slots.get(ValuePlan.ALARM_UNACKED));
            TagSubscriber.Delivery priority = state.values.get(slots.get(ValuePlan.ALARM_PRIORITY));
            LiveValue alarms = alarms(acked, unacked, priority);
            if ((acked != null && acked.notFound()) || (unacked != null && unacked.notFound())
                    || (priority != null && priority.notFound())) {
                problems.add(new ValuePlan.Problem(ValuePlan.ALARMS, NOT_FOUND));
            }
            if (commsLost) {
                alarms = alarms.staleFor(LiveValue.COMMS_LOST);
            }
            o.add("alarms", alarms.toJson());
        }
        if (item.style() != null && slots.containsKey(ValuePlan.STYLE)) {
            TagSubscriber.Delivery d = state.values.get(slots.get(ValuePlan.STYLE));
            if (d != null && d.notFound()) {
                problems.add(new ValuePlan.Problem(ValuePlan.STYLE, NOT_FOUND));
            }
            o.add("style", style(item.style(), commsLost ? slot(d).staleFor(LiveValue.COMMS_LOST) : slot(d), d, problems));
        }
        o.add("problems", ValuePlan.problemsJson(problems));
        return o;
    }

    /**
     * The style slot (epic 3 entry 1): {@code {preset, stale, reason}}. A stale source (no value yet,
     * a bad quality, comms lost) gives {@code normal} marked stale with the reason, so the map draws
     * the stale look alone; else the rule's preset for the value, a value the rule cannot read
     * drawing {@code normal} with a {@code style} problem.
     */
    static JsonObject style(ValuePlan.Style style, LiveValue source, TagSubscriber.Delivery d, List<ValuePlan.Problem> problems) {
        JsonObject o = new JsonObject();
        String preset = StyleRule.NORMAL;
        String problem = null;
        if (!source.stale()) {
            if (style.expression() != null) {
                StyleExpressions.Result result = style.expression().run(d == null ? null : d.value());
                preset = result.preset();
                problem = result.problem();
            } else {
                StyleRule.Outcome outcome = style.rule().preset(source.value());
                if (outcome != null) {
                    preset = outcome.preset();
                    problem = outcome.problem();
                }
            }
        }
        if (problem != null) {
            problems.add(new ValuePlan.Problem(ValuePlan.STYLE, problem));
        }
        o.addProperty("preset", preset);
        o.addProperty("stale", source.stale());
        o.addProperty("reason", source.stale() ? source.reason() : "");
        return o;
    }

    /** The LiveValue of one delivery: stale with the quality name when it is not good. */
    static LiveValue slot(TagSubscriber.Delivery d) {
        if (d == null) {
            return LiveValue.none();
        }
        String t = d.t() == null ? null : ISO.format(d.t().truncatedTo(ChronoUnit.MILLIS));
        return new LiveValue(LiveValue.json(d.value()), d.quality(), t, !d.good(), d.good() ? "" : d.quality());
    }

    /**
     * The alarms slot from the three metrics: value {@code {active, unacked, priority}} (plan decision
     * 1), the worst quality of the three, the latest time; stale when any of them is not good.
     */
    static LiveValue alarms(TagSubscriber.Delivery acked, TagSubscriber.Delivery unacked,
                            TagSubscriber.Delivery priority) {
        List<TagSubscriber.Delivery> all = new ArrayList<>();
        for (TagSubscriber.Delivery d : new TagSubscriber.Delivery[] {acked, unacked, priority}) {
            if (d != null) {
                all.add(d);
            }
        }
        if (all.size() < 3) {
            return LiveValue.none();
        }
        int ackedCount = AlarmMetrics.count(acked.value());
        int unackedCount = AlarmMetrics.count(unacked.value());
        JsonObject value = new JsonObject();
        value.addProperty("active", ackedCount + unackedCount);
        value.addProperty("unacked", unackedCount);
        value.addProperty("priority", AlarmMetrics.priority(priority.value()));
        String worst = "Good";
        boolean good = true;
        Instant latest = null;
        for (TagSubscriber.Delivery d : all) {
            if (!d.good() && good) {
                good = false;
                worst = d.quality();
            }
            if (d.t() != null && (latest == null || d.t().isAfter(latest))) {
                latest = d.t();
            }
        }
        String t = latest == null ? null : ISO.format(latest.truncatedTo(ChronoUnit.MILLIS));
        return new LiveValue(value, worst, t, !good, good ? "" : worst);
    }

    /** Unsubscribe everything (module stop). */
    @Override
    public void close() {
        for (Map.Entry<String, ProjectLive> e : projects.entrySet()) {
            ProjectLive state = e.getValue();
            if (state.changes != null) {
                state.changes.cancel();
            }
            for (TagSubscriber.Handle handle : state.subscriptions.values()) {
                handle.cancel();
            }
            state.subscriptions.clear();
        }
        projects.clear();
    }

    /** For tests: the values the project holds now, by path. */
    Map<String, TagSubscriber.Delivery> values(String project) {
        ProjectLive state = projects.get(project);
        return state == null ? Map.of() : Map.copyOf(state.values);
    }

    /** For tests: the ids of the items the plan holds. */
    Set<String> plannedItems(String project) {
        ProjectLive state = projects.get(project);
        return state == null ? Set.of() : new HashSet<>(state.plan.items().keySet());
    }
}
