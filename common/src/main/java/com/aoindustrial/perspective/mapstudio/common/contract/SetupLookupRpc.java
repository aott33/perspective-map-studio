package com.aoindustrial.perspective.mapstudio.common.contract;

import com.inductiveautomation.ignition.common.rpc.RpcInterface;

/**
 * The Designer's read-only lookups for the setup form (epic 2 story 16): the Gateway lists the
 * form offers as suggestions. Names only: a connection's name and type, the identity provider's
 * role names, secret provider names and a provider's secret names. Never a secret value, never a
 * password, never a write.
 *
 * <p>Each method answers JSON text ({@link SetupLists}), so only {@code String} crosses the RPC
 * serializer. The Gateway implementation is not callable from a Vision client (no
 * {@code RunsOnClient}) and refuses a caller whose session is not a Designer's.
 */
@RpcInterface(packageId = SetupLookupRpc.PACKAGE_ID)
public interface SetupLookupRpc {

    /** The RPC package of this interface, under the module id. */
    String PACKAGE_ID = "mapstudio-setup";

    /**
     * The Gateway's database connections, the role names of {@code identityProvider} and the
     * secret provider names, each list answered on its own ({@link SetupLists#toJson()}).
     *
     * @param identityProvider the project's identity provider name, as the Designer reads it
     */
    String lists(String identityProvider);

    /** The secret names of one secret provider ({@link SetupLists.Part#toJson()}); names only. */
    String secretNames(String provider);
}
