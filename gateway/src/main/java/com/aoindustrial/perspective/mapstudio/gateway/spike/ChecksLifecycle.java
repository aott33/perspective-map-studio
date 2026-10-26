package com.aoindustrial.perspective.mapstudio.gateway.spike;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import com.inductiveautomation.ignition.common.resourcecollection.Resource;
import com.inductiveautomation.ignition.common.resourcecollection.ResourceId;
import com.inductiveautomation.ignition.common.resourcecollection.RuntimeResourceCollection;
import com.inductiveautomation.ignition.common.util.LoggerEx;
import com.inductiveautomation.ignition.gateway.model.GatewayContext;
import com.inductiveautomation.ignition.gateway.resourcecollection.ResourceCollectionLifecycle;

/**
 * Spike check 4 and the driver of the others: one lifecycle per runnable project.
 * {@link #onStartup(List)} receives the project's loaded {@code setup} resources
 * (the custom resource type check); when one is present the remaining checks run
 * on a single worker thread and each logs one {@code CHECK} line.
 */
public final class ChecksLifecycle extends ResourceCollectionLifecycle {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.check.setup");

    /** Project scripts load in their own lifecycle; give them a moment, then retry. */
    static final int SCRIPT_RETRIES = 6;
    static final long SCRIPT_RETRY_SECONDS = 5;

    private final GatewayContext context;
    private final ExecutorService worker;
    private volatile AlarmMetricsCheck alarmMetrics;

    public ChecksLifecycle(RuntimeResourceCollection project, GatewayContext context) {
        super(project);
        this.context = context;
        this.worker = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "MapStudio-checks-" + project.getName());
            t.setDaemon(true);
            return t;
        });
    }

    @Override
    protected void onStartup(List<Resource> resources) {
        String project = getResourceCollection().getName();
        Optional<SetupResource> setup = findSetup(resources);
        if (setup.isEmpty()) {
            log.debugf("Project %s holds no Map Studio setup resource; no checks.", project);
            return;
        }
        CheckResult.pass("setup", String.format(
            "project %s: lifecycle onStartup received %d resource(s) of type %s; parsed %s",
            project, resources.size(), SetupResource.RESOURCE_TYPE, setup.get())).log();
        SetupResource s = setup.get();
        worker.submit(() -> runChecks(project, s));
    }

    private void runChecks(String project, SetupResource setup) {
        try {
            new PostgresCheck(context.getDatasourceManager()).checkOwner(setup.connection()).log();
            new PostgresCheck(context.getDatasourceManager()).checkMissingRights(setup.connectionNoRights()).log();

            CheckResult script = null;
            for (int attempt = 1; attempt <= SCRIPT_RETRIES; attempt++) {
                script = new ProjectScriptCheck(context.getProjectManager()).run(project, setup);
                if (script.passed()) {
                    script = CheckResult.pass(script.name(), "attempt " + attempt + ": " + script.evidence());
                    break;
                }
                log.infof("project-script attempt %d of %d did not pass yet: %s", attempt, SCRIPT_RETRIES,
                    script.evidence());
                Thread.sleep(TimeUnit.SECONDS.toMillis(SCRIPT_RETRY_SECONDS));
            }
            script.log();

            alarmMetrics = new AlarmMetricsCheck(context.getTagManager());
            alarmMetrics.run(setup.alarmMetricPaths()).log();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        } catch (RuntimeException ex) {
            log.error("A platform check threw: " + ex, ex);
        }
    }

    @Override
    protected void onShutdown(List<ResourceId> resources) {
        AlarmMetricsCheck check = alarmMetrics;
        if (check != null) {
            check.unsubscribe();
        }
        worker.shutdownNow();
    }

    @Override
    protected void onResourcesCreated(List<Resource> resources) {
        findSetup(resources).ifPresent(s -> CheckResult.pass("setup-created",
            "project " + getResourceCollection().getName() + ": " + s).log());
    }

    @Override
    protected void onResourcesModified(List<Resource> resources) {
        findSetup(resources).ifPresent(s -> CheckResult.pass("setup-modified",
            "project " + getResourceCollection().getName() + ": re-read " + s).log());
    }

    @Override
    protected void onResourcesDeleted(List<ResourceId> resources) {
        log.infof("Project %s: %d setup resource(s) deleted.", getResourceCollection().getName(), resources.size());
    }

    private static Optional<SetupResource> findSetup(List<Resource> resources) {
        for (Resource resource : resources) {
            if (SetupResource.RESOURCE_TYPE.equals(resource.getResourceType())) {
                try {
                    Optional<SetupResource> parsed = SetupResource.fromResource(resource);
                    if (parsed.isPresent()) {
                        return parsed;
                    }
                } catch (IllegalArgumentException ex) {
                    CheckResult.fail("setup", "resource " + resource.getResourcePath() + ": " + ex.getMessage()).log();
                }
            }
        }
        return Optional.empty();
    }
}
