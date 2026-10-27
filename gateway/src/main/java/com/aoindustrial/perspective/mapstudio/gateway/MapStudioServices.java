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

import com.aoindustrial.perspective.mapstudio.gateway.adapter.AdapterService;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.ProjectFunctionCaller;
import com.aoindustrial.perspective.mapstudio.gateway.load.MapLoader;
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
import com.aoindustrial.perspective.mapstudio.gateway.write.ChangeHook;
import com.aoindustrial.perspective.mapstudio.gateway.write.NoChangeHook;
import com.aoindustrial.perspective.mapstudio.gateway.write.WriteService;

/**
 * The Gateway core's parts, wired once per module start: the setup loader, the
 * store registry (connection wait and migrations), the map store repository, the
 * write service, the host adapters (kind and asset lists, with their own small pool),
 * the map loader, the scripting module and two small thread pools (one for the
 * connection wait, one bounded pool for the delegates' database work).
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
    final WriteService writes;
    final AdapterService adapters;
    final MapLoader loader;
    final GatewayScriptModule scriptModule;
    private final SetupLifecycleFactory lifecycles;

    MapStudioServices(GatewayContext context) {
        this.scheduler = Executors.newSingleThreadScheduledExecutor(daemon("MapStudio-store"));
        this.work = newWorkPool(WORK_THREADS, WORK_QUEUE, daemon("MapStudio-work"));
        ConnectionSource connections = new DatasourceConnections(context.getDatasourceManager());
        this.stores = new StoreRegistry(connections, new Migrator(Migrations.all(), moduleVersion()), scheduler,
            System::nanoTime, ConnectionWait.INTERVAL, ConnectionWait.MAX);
        this.setups = new SetupRegistry(setup -> stores.ensure(setup.connection()));
        this.gate = new StoreGate(setups, stores::state);
        this.store = new JdbcMapStore(connections);
        ChangeHook hook = new NoChangeHook();
        this.writes = new WriteService(gate, store, hook);
        this.adapters = AdapterService.create(setups::find, setups::projects,
            new ProjectFunctionCaller(context.getProjectManager()));
        this.loader = new MapLoader(gate, store, adapters::snapshot);
        this.scriptModule = new GatewayScriptModule(writes, loader, adapters);
        this.lifecycles = new SetupLifecycleFactory(context, setups);
    }

    void start() {
        lifecycles.startup();
        adapters.start();
    }

    void stop() {
        adapters.stop();
        lifecycles.shutdown();
        scheduler.shutdownNow();
        work.shutdownNow();
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

    private static String moduleVersion() {
        String v = MapStudioServices.class.getPackage().getImplementationVersion();
        return v == null ? "dev" : v;
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
