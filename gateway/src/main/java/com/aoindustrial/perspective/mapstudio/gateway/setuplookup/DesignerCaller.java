package com.aoindustrial.perspective.mapstudio.gateway.setuplookup;

import java.util.function.BooleanSupplier;

import com.inductiveautomation.ignition.gateway.clientcomm.ClientReqSession;
import com.inductiveautomation.ignition.gateway.rpc.RpcDelegate;

/**
 * True only inside an RPC call from a Designer session ({@code RpcDelegate.session().isDesigner()},
 * [SDK 8.3.0 javap]). Outside an RPC call, or from any other session, false.
 */
public final class DesignerCaller implements BooleanSupplier {

    @Override
    public boolean getAsBoolean() {
        try {
            ClientReqSession session = RpcDelegate.session();
            return session != null && session.isDesigner();
        } catch (RuntimeException ex) {
            // "No RpcContext available": not an RPC call at all.
            return false;
        }
    }
}
