package com.aoindustrial.perspective.mapstudio.gateway;

import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import com.inductiveautomation.ignition.common.licensing.LicenseState;
import com.inductiveautomation.ignition.common.rpc.proto.ProtoRpcSerializer;
import com.inductiveautomation.ignition.common.script.ScriptManager;
import com.inductiveautomation.ignition.common.script.hints.PropertiesFileDocProvider;
import com.inductiveautomation.ignition.common.util.LoggerEx;
import com.inductiveautomation.ignition.gateway.model.AbstractGatewayModuleHook;
import com.inductiveautomation.ignition.gateway.model.GatewayContext;
import com.inductiveautomation.ignition.gateway.rpc.GatewayRpcImplementation;
import com.inductiveautomation.perspective.common.api.ComponentRegistry;
import com.inductiveautomation.perspective.gateway.api.ComponentModelDelegateRegistry;
import com.inductiveautomation.perspective.gateway.api.PerspectiveContext;

import com.aoindustrial.perspective.mapstudio.common.MapStudioComponent;
import com.aoindustrial.perspective.mapstudio.common.MapStudioModule;
import com.aoindustrial.perspective.mapstudio.gateway.setuplookup.DesignerCaller;
import com.aoindustrial.perspective.mapstudio.gateway.setuplookup.IgnitionLookupSource;
import com.aoindustrial.perspective.mapstudio.gateway.setuplookup.SetupLookups;

/**
 * Gateway scope hook: registers the component and its model delegate on
 * startup and removes them on shutdown, and serves the web bundle.
 */
public class MapStudioGatewayHook extends AbstractGatewayModuleHook {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.gateway");

    private GatewayContext gatewayContext;
    private ComponentRegistry componentRegistry;
    private ComponentModelDelegateRegistry delegateRegistry;
    private MapStudioServices services;
    /** Threads of the setup form's lookups (epic 2 story 16); a few, so a slow provider cannot pile up calls. */
    private ExecutorService lookupPool;
    private GatewayRpcImplementation rpc;

    @Override
    public void setup(GatewayContext context) {
        this.gatewayContext = context;
        this.services = new MapStudioServices(context);
        this.lookupPool = new ThreadPoolExecutor(0, 6, 30, TimeUnit.SECONDS, new SynchronousQueue<>(), r -> {
            Thread t = new Thread(r, "MapStudio-setup-lookups");
            t.setDaemon(true);
            return t;
        });
        SetupLookups lookups = new SetupLookups(new IgnitionLookupSource(context.getDatasourceManager(),
            context.getUserSourceManager(), context.getSecretProviderManager()), lookupPool, new DesignerCaller());
        this.rpc = GatewayRpcImplementation.of(ProtoRpcSerializer.DEFAULT_INSTANCE, lookups);
    }

    /**
     * The Designer's setup lists (epic 2 story 16): {@code SetupLookupRpc} under the module id,
     * names only, Designer sessions only (no {@code RunsOnClient}, and {@code DesignerCaller}).
     */
    @Override
    public Optional<GatewayRpcImplementation> getRpcImplementation() {
        return Optional.ofNullable(rpc);
    }

    /**
     * Adds {@code system.mapstudio.*} to Gateway and project script scopes (AD-18);
     * the Gateway calls it for every script manager it creates (docs/platform-checks.md, check 3).
     */
    @Override
    public void initializeScriptManager(ScriptManager manager) {
        super.initializeScriptManager(manager);
        manager.addScriptModule("system.mapstudio", services.scriptModule, new PropertiesFileDocProvider());
    }

    @Override
    public void startup(LicenseState activationState) {
        PerspectiveContext perspectiveContext = PerspectiveContext.get(this.gatewayContext);
        this.componentRegistry = perspectiveContext.getComponentRegistry();
        this.delegateRegistry = perspectiveContext.getComponentModelDelegateRegistry();

        if (this.componentRegistry != null) {
            log.info("Registering the Map Studio component.");
            this.componentRegistry.registerComponent(MapStudioComponent.DESCRIPTOR);
        } else {
            log.error("Perspective component registry not found; the Map Studio component is not registered.");
        }

        if (this.delegateRegistry != null) {
            MapStudioServices s = this.services;
            this.delegateRegistry.register(MapStudioComponent.COMPONENT_ID,
                component -> new MapStudioDelegate(component, s));
        } else {
            log.error("Perspective model delegate registry not found; the Map Studio delegate is not registered.");
        }

        // Reads each runnable project's setup; each setup starts its connection's wait and migrations.
        this.services.start();
    }

    @Override
    public void shutdown() {
        if (this.services != null) {
            this.services.stop();
        }
        if (this.lookupPool != null) {
            this.lookupPool.shutdownNow();
        }
        if (this.componentRegistry != null) {
            this.componentRegistry.removeComponent(MapStudioComponent.COMPONENT_ID);
        }
        if (this.delegateRegistry != null) {
            this.delegateRegistry.remove(MapStudioComponent.COMPONENT_ID);
        }
    }

    /** Serve the bundled web resources found in the module's "mounted" resource folder. */
    @Override
    public Optional<String> getMountedResourceFolder() {
        return Optional.of("mounted");
    }

    /** Mount those resources at /res/mapstudio/ rather than under the module id. */
    @Override
    public Optional<String> getMountPathAlias() {
        return Optional.of(MapStudioModule.URL_ALIAS);
    }

    @Override
    public boolean isFreeModule() {
        return true;
    }

    @Override
    public boolean isMakerEditionCompatible() {
        return true;
    }
}
