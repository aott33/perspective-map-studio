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
 *
 * <p>Instruments on lines (epic 3 entry 2): a line whose style rule is the instruments source carries
 * a {@code segments} slot graded by {@link Segments} from the instruments at each segment's ends, and
 * an instrument's delivery marks that line changed too; an open popup of a line follows the line
 * and every instrument attached to it ({@link #popupItems}).
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

    /** A listener of the items in {@code itemIds} (an open popup: the item, and a line's instruments). */
    private record ItemListener(Set<String> itemIds, Runnable onChange) {
    }

    private final TagSubscriber tags;
    private final Function<String, MapLoader.Snapshot> store;
    private final Function<String, AdapterSnapshot> adapters;
    private final ChangeBus changes;
    private final Executor live;
    private final AlarmStatus alarms;
    private final ConcurrentHashMap<String, ProjectLive> projects = new ConcurrentHashMap<>();

    /** The alarm status could not be read; said in the popup detail, never with a path. */
    static final String ALARMS_UNREADABLE = "the alarm status could not be read";
    static final String ALARMS_UNAVAILABLE = "the alarm status is not available";
    /** How many alarms the popup detail lists, the most important first; the counts cover them all. */
    static final int POPUP_ALARMS = 3;

    /**
     * @param store    the project's live items and kind setups ({@code MapLoader::snapshot}); may throw
     *                 {@code store-unreachable}, which keeps the last plan
     * @param adapters the project's kind and asset lists ({@code AdapterService::snapshot})
     * @param changes  the change bus, so a committed batch rebuilds the plan (null in tests without one)
     * @param live     the one thread rebuilds run on (the sessions' timers share it)
     */
    public LiveValueCache(TagSubscriber tags, Function<String, MapLoader.Snapshot> store,
                          Function<String, AdapterSnapshot> adapters, ChangeBus changes, Executor live) {
        this(tags, store, adapters, changes, live, null);
    }

    /**
     * @param alarms the alarm status the open popup's alarm summary is read from (epic 3 entry 8);
     *               null when the Gateway has none (tests), which the summary says in words
     */
    public LiveValueCache(TagSubscriber tags, Function<String, MapLoader.Snapshot> store,
                          Function<String, AdapterSnapshot> adapters, ChangeBus changes, Executor live,
                          AlarmStatus alarms) {
        this.tags = tags;
        this.store = store;
        this.adapters = adapters;
        this.changes = changes;
        this.live = live;
        this.alarms = alarms;
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
        ValuePlan.Plan plan = state.plan;
        Set<String> served = plan.itemsByPath().get(path);
        if (served == null) {
            return;
        }
        // An instrument's change regrades the segments of the line it sits on (entry 2), so that
        // line is marked changed too and an open line popup hears of it.
        Set<String> items = new HashSet<>(served);
        for (String id : served) {
            items.addAll(plan.linesRegradedBy(id));
        }
        for (String id : items) {
            state.itemSeq.put(id, seq);
        }
        for (ItemListener listener : state.listeners) {
            if (!java.util.Collections.disjoint(items, listener.itemIds())) {
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

    /**
     * One item's values as a changes-only batch (an open popup), or null when the item is not planned.
     * The item carries the popup detail (epic 3 entry 8, AD-7): the asset's base path and the alarms
     * path, so the browser fills a custom popup view's params and the link, and, when the kind shows
     * alarms, the alarm summary read from the alarm status now. The detail goes to the one session
     * whose popup is open; the batches every map gets stay path-free.
     */
    public Batch itemBatch(String project, String itemId) {
        return itemsBatch(project, Set.of(itemId), itemId);
    }

    /**
     * The planned items among {@code itemIds} as one changes-only batch (an open popup: the item
     * and, for a line, every instrument attached to it; entry 2), or null when none of them is
     * planned. No item carries the popup detail.
     */
    public Batch itemsBatch(String project, Set<String> itemIds) {
        return itemsBatch(project, itemIds, null);
    }

    /**
     * As {@link #itemsBatch(String, Set)}, the item {@code popupItemId} (the one whose popup is open)
     * carrying the popup detail (entry 8); its instruments never do.
     */
    public Batch itemsBatch(String project, Set<String> itemIds, String popupItemId) {
        ProjectLive state = projects.get(project);
        if (state == null) {
            return null;
        }
        JsonArray items = new JsonArray();
        for (ValuePlan.ItemPlan item : state.plan.items().values()) {
            if (itemIds.contains(item.id())) {
                JsonObject json = itemJson(state, item);
                if (item.id().equals(popupItemId)) {
                    json.add("popup", popupDetail(project, item));
                }
                items.add(json);
            }
        }
        if (items.isEmpty()) {
            return null;
        }
        JsonObject body = new JsonObject();
        long seq = state.seq.get();
        body.addProperty("seq", seq);
        body.addProperty("full", false);
        body.add("items", items);
        return new Batch(seq, false, body);
    }

    /**
     * The items an open popup of {@code itemId} follows (AD-7, entry 2): the item itself and, when
     * it is a line, every instrument attached to it, so the popup's rows stay live.
     */
    public Set<String> popupItems(String project, String itemId) {
        ProjectLive state = projects.get(project);
        Set<String> ids = new HashSet<>();
        ids.add(itemId);
        if (state != null) {
            for (ValuePlan.Instrument i : state.plan.instrumentsOf(itemId)) {
                ids.add(i.id());
            }
        }
        return Set.copyOf(ids);
    }

    /**
     * The popup detail of one item: {@code {basePath, alarmsPath, alarms?}}; {@code alarms} is
     * {@code {counts: {"1", "2", "3"}, list: [{name, source, priority, unacked, activeTime}], reason}}
     * when the item has an alarms path: the active alarms below it counted by the map's priority (a
     * Diagnostic alarm counts in none), the {@link #POPUP_ALARMS} most important listed (priority 1
     * first, unacknowledged before acknowledged, the newest first), and the reason in words when the
     * status could not be read (the list then empty, the counts zero).
     */
    JsonObject popupDetail(String project, ValuePlan.ItemPlan item) {
        JsonObject o = new JsonObject();
        o.addProperty("basePath", item.basePath());
        o.addProperty("alarmsPath", item.alarmsPath());
        if (item.alarmsPath() == null) {
            return o;
        }
        JsonObject summary = new JsonObject();
        int[] counts = new int[4];
        List<AlarmStatus.ActiveAlarm> active = new ArrayList<>();
        String reason = "";
        if (alarms == null) {
            reason = ALARMS_UNAVAILABLE;
        } else {
            try {
                active.addAll(alarms.active(item.alarmsPath()));
            } catch (RuntimeException ex) {
                log.warnf("Project %s: the alarm status of a popup could not be read: %s", project,
                    ex.getClass().getSimpleName());
                reason = ALARMS_UNREADABLE;
            }
        }
        for (AlarmStatus.ActiveAlarm a : active) {
            if (a.priority() >= 1 && a.priority() <= 3) {
                counts[a.priority()]++;
            }
        }
        active.sort((a, b) -> {
            int pa = a.priority() >= 1 && a.priority() <= 3 ? a.priority() : 4;
            int pb = b.priority() >= 1 && b.priority() <= 3 ? b.priority() : 4;
            if (pa != pb) {
                return Integer.compare(pa, pb);
            }
            if (a.unacked() != b.unacked()) {
                return a.unacked() ? -1 : 1;
            }
            long ta = a.activeTime() == null ? Long.MIN_VALUE : a.activeTime().toEpochMilli();
            long tb = b.activeTime() == null ? Long.MIN_VALUE : b.activeTime().toEpochMilli();
            return Long.compare(tb, ta);
        });
        JsonObject byPriority = new JsonObject();
        for (int p = 1; p <= 3; p++) {
            byPriority.addProperty(String.valueOf(p), counts[p]);
        }
        summary.add("counts", byPriority);
        JsonArray list = new JsonArray();
        for (AlarmStatus.ActiveAlarm a : active) {
            if (list.size() >= POPUP_ALARMS) {
                break;
            }
            JsonObject row = new JsonObject();
            row.addProperty("name", a.name() == null ? "" : a.name());
            row.addProperty("source", a.source() == null ? "" : a.source());
            row.addProperty("priority", a.priority());
            row.addProperty("unacked", a.unacked());
            row.addProperty("activeTime", a.activeTime() == null ? null
                : ISO.format(a.activeTime().truncatedTo(ChronoUnit.MILLIS)));
            list.add(row);
        }
        summary.add("list", list);
        summary.addProperty("reason", reason);
        o.add("alarms", summary);
        return o;
    }

    /** Be told, on the tag system's thread, whenever a value of {@code itemId} is delivered. */
    public Subscription onItemChange(String project, String itemId, Runnable onChange) {
        return onItemsChange(project, Set.of(itemId), onChange);
    }

    /** Be told, on the tag system's thread, whenever a value of any of {@code itemIds} is delivered. */
    public Subscription onItemsChange(String project, Set<String> itemIds, Runnable onChange) {
        ProjectLive state = projects.get(project);
        if (state == null) {
            return () -> { };
        }
        ItemListener listener = new ItemListener(Set.copyOf(itemIds), onChange);
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
        if (item.style() != null && item.style().rule().instruments()) {
            // The instruments source (entry 2): the line's segments graded from the instruments at
            // their ends, each instrument's grade read from its own batch item; the line's own style
            // slot is the worst over them. The line's own alarm, comms and KPIs stay its own slots.
            ValuePlan.Plan plan = state.plan;
            List<ValuePlan.Instrument> instruments = plan.instrumentsOf(item.id());
            Map<String, Segments.Grade> grades = new java.util.HashMap<>();
            for (ValuePlan.Instrument i : instruments) {
                if (!i.measures()) {
                    continue;
                }
                ValuePlan.ItemPlan ip = plan.items().get(i.id());
                grades.put(i.id(), ip == null
                    ? new Segments.Grade(StyleRule.NORMAL, true, i.name() + ": " + LiveValue.NO_VALUE_YET, null)
                    : Segments.of(i.name(), itemJson(state, ip), i.iconKpi()));
            }
            List<Segments.Segment> segments = Segments.grade(Segments.nodes(plan.endsOf(item.id()), instruments), grades);
            o.add("style", Segments.lineStyle(segments));
            o.add("segments", Segments.toJson(segments));
        } else if (item.style() != null && slots.containsKey(ValuePlan.STYLE)) {
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
