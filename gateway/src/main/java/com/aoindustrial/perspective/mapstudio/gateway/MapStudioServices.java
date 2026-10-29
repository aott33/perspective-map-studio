package com.aoindustrial.perspective.mapstudio.gateway;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import com.inductiveautomation.ignition.gateway.model.GatewayContext;
import com.inductiveautomation.ignition.gateway.redundancy.RedundancyManager;
import com.inductiveautomation.ignition.gateway.redundancy.types.RedundancyState;
import com.inductiveautomation.ignition.gateway.redundancy.types.RedundancyStateAdapter;
import com.inductiveautomation.ignition.gateway.redundancy.types.RedundancyStateListener;

import com.aoindustrial.perspective.mapstudio.gateway.adapter.AdapterService;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.ProjectFunctionCaller;
import com.aoindustrial.perspective.mapstudio.gateway.basemap.BasemapSources;
import com.aoindustrial.perspective.mapstudio.gateway.basemap.IgnitionTokenSource;
import com.aoindustrial.perspective.mapstudio.gateway.change.ChangeBus;
import com.aoindustrial.perspective.mapstudio.gateway.live.IgnitionAlarmStatus;
import com.aoindustrial.perspective.mapstudio.gateway.live.IgnitionTagSubscriber;
import com.aoindustrial.perspective.mapstudio.gateway.live.LiveValueCache;
import com.aoindustrial.perspective.mapstudio.gateway.load.MapLoader;
import com.aoindustrial.perspective.mapstudio.gateway.redundancy.RedundancyGate;
import com.aoindustrial.perspective.mapstudio.gateway.script.GatewayScriptModule;
import com.aoindustrial.perspective.mapstudio.gateway.setup.SetupLifecycleFactory;
import com.aoindustrial.perspective.mapstudio.gateway.setup.SetupRegistry;
import com.aoindustrial.perspective.mapstudio.gateway.store.ConnectionSource;
import com.aoindustrial.perspective.mapstudio.gateway.store.ConnectionWait;
import com.aoindustrial.perspective.mapstudio.gateway.store.DatasourceConnections;
import com.aoindustrial.perspective.mapstudio.gateway.store.JdbcMapStore;
import com.aoindustrial.perspective.mapstudio.gateway.store.MapStore;
import com.aoindustrial.perspective.mapstudio.gateway.store.Migrations;
import com.aoindustrial.perspective.mapstudio.gateway.store.Migrator;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreRegistry;
import com.aoindustrial.perspective.mapstudio.gateway.tags.IgnitionTagSource;
import com.aoindustrial.perspective.mapstudio.gateway.tags.TagLookups;
import com.aoindustrial.perspective.mapstudio.gateway.write.WriteService;

/**
 * The Gateway core's parts, wired once per module start: the setup loader, the
 * store registry (connection wait and migrations), the map store repository, the
 * write service, the change bus (its change hook), the host adapters (kind and asset
 * lists, with their own small pool), the map loader, the tag lookups (entry 15), the scripting module, three
 * small thread pools (one for the connection wait, one bounded pool for the delegates' database
 * work, one thread for the change bus), and the redundancy gate (epic 2 story 5: a
 * standby reads, refuses saves and does not migrate).
 * Each part is its own class, so later entries change one without the others.
 */
public final class MapStudioServices {

    /** Threads for the delegates' map.load and edits.apply work (database calls stay off Perspective's threads). */
    static final int WORK_THREADS = 4;
    /** Waiting map.load and edits.apply messages beyond the busy threads; more are refused as busy. */
    static final int WORK_QUEUE = 64;

    final ScheduledExecutorService scheduler;
    final ExecutorService work;
    final SetupRegistry setups;
    final StoreRegistry stores;
    final StoreGate gate;
    final MapStore store;
    final ChangeBus changes;
    final WriteService writes;
    final AdapterService adapters;
    final MapLoader loader;
    /** The tag browser's lookups (entry 15); nothing to start or stop. */
    final TagLookups tags;
    /** The satellite basemap's tile source (epic 3 entry 6), its token read from the setup's secret; nothing to start. */
    final BasemapSources basemaps;
    /** The shared live-value cache (AD-6, epic 3 entry 5) and the one thread its rebuilds and the maps' batch timers run on. */
    final LiveValueCache live;
    final ScheduledExecutorService liveThread;
    final GatewayScriptModule scriptModule;
    final RedundancyGate redundancy;
    private final SetupLifecycleFactory lifecycles;
    private final RedundancyManager redundancyManager;
    private final RedundancyStateListener redundancyListener;

    MapStudioServices(GatewayContext context) {
        this.scheduler = Executors.newSingleThreadScheduledExecutor(daemon("MapStudio-store"));
        this.work = newWorkPool(WORK_THREADS, WORK_QUEUE, daemon("MapStudio-work"));
        ConnectionSource connections = new DatasourceConnections(context.getDatasourceManager());
        // [SDK 8.3.0 javap], unverified live beyond an independent Gateway (RedundancyGate).
        this.redundancyManager = context.getRedundancyManager();
        this.redundancy = new RedundancyGate(RedundancyGate.of(redundancyManager), this::retryStores);
        this.redundancyListener = new RedundancyStateAdapter() {
            @Override
            public void redundancyStateChanged(RedundancyState state) {
                redundancy.stateChanged();
            }
        };
        this.stores = new StoreRegistry(connections, new Migrator(Migrations.all(), moduleVersion()), scheduler,
            System::nanoTime, ConnectionWait.INTERVAL, ConnectionWait.MAX, redundancy::mayWrite, StoreRegistry.RETRY);
        this.setups = new SetupRegistry(setup -> stores.ensure(setup.connection()));
        this.gate = new StoreGate(setups, stores::state, redundancy::standbyReason);
        this.store = new JdbcMapStore(connections);
        this.changes = ChangeBus.start(Executors.newSingleThreadScheduledExecutor(daemon("MapStudio-changes")));
        this.adapters = AdapterService.create(setups::find, setups::projects,
            new ProjectFunctionCaller(context.getProjectManager()));
        this.writes = new WriteService(gate, store, changes, adapters::snapshot);
        this.loader = new MapLoader(gate, store, adapters::snapshot);
        this.tags = new TagLookups(setups, gate, store, adapters::snapshot,
            new IgnitionTagSource(context.getTagManager(), context.getProjectManager()));
        this.basemaps = new BasemapSources(new IgnitionTokenSource(context.getSecretProviderManager()));
        this.scriptModule = new GatewayScriptModule(writes, loader, adapters);
        this.liveThread = Executors.newSingleThreadScheduledExecutor(daemon("MapStudio-live"));
        this.live = new LiveValueCache(new IgnitionTagSubscriber(context.getTagManager()), loader::snapshot,
            adapters::snapshot, changes, liveThread, new IgnitionAlarmStatus(context.getAlarmManager()));
        this.lifecycles = new SetupLifecycleFactory(context, setups);
    }

    void start() {
        redundancy.stateChanged();
        if (redundancyManager != null) {
            redundancyManager.addRedundancyStateListener(redundancyListener);
        }
        lifecycles.startup();
        adapters.start();
    }

    void stop() {
        live.close();
        liveThread.shutdownNow();
        adapters.stop();

        if (redundancyManager != null) {
            redundancyManager.removeRedundancyStateListener(redundancyListener);
        }
        lifecycles.shutdown();
        scheduler.shutdownNow();
        work.shutdownNow();
        changes.close();
    }

    /**
     * A fixed pool with a bounded queue: when every thread is busy and the queue is full,
     * {@code execute} throws {@code RejectedExecutionException} (abort policy), and the
     * delegate answers that message at once with a busy error rather than queueing without bound.
     */
    static ThreadPoolExecutor newWorkPool(int threads, int queue, ThreadFactory factory) {
        return new ThreadPoolExecutor(threads, threads, 0L, TimeUnit.MILLISECONDS, new ArrayBlockingQueue<>(queue),
            factory, new ThreadPoolExecutor.AbortPolicy());
    }

    private void retryStores() {
        stores.retryNow();
    }

    /** The build's version from the gateway jar's manifest, recorded by the migrator (ModuleVersion). */
    private static String moduleVersion() {
        return ModuleVersion.of(MapStudioServices.class);
    }

    private static ThreadFactory daemon(String name) {
        AtomicInteger n = new AtomicInteger();
        return r -> {
            Thread t = new Thread(r, name + "-" + n.incrementAndGet());
            t.setDaemon(true);
            return t;
        };
    }
}
