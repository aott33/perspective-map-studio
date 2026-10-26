package com.aoindustrial.perspective.mapstudio.gateway.write;

import java.util.Collection;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.EditOp;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;

/**
 * The role matrix (AD-2). The level comes from the roles the Gateway sees for the
 * session user ({@code WebAuthStatus.getUser().getRoles()}, docs/platform-checks.md,
 * epic 2 story 1) against the setup's role lists; never from the browser.
 *
 * <p>This version: {@code full} may create and update map items; {@code phone}
 * (a point's geometry and a map item's properties) is entry 2's, so a phone
 * editor's save is refused here; {@code none} may not save.
 */
public final class RoleMatrix {

    private RoleMatrix() {
    }

    /** {@code full}, {@code phone} or {@code none} for these roles under this setup. */
    public static String level(Setup setup, Collection<String> roles) {
        if (setup == null || roles == null || roles.isEmpty()) {
            return Messages.LEVEL_NONE;
        }
        for (String role : setup.fullRoles()) {
            if (roles.contains(role)) {
                return Messages.LEVEL_FULL;
            }
        }
        for (String role : setup.phoneRoles()) {
            if (roles.contains(role)) {
                return Messages.LEVEL_PHONE;
            }
        }
        return Messages.LEVEL_NONE;
    }

    /**
     * Refuse the op with {@code role} when the level may not do it.
     *
     * @throws MapStudioException {@code role}, naming the op
     */
    public static void check(String level, EditOp op) {
        if (Messages.LEVEL_FULL.equals(level)) {
            return;
        }
        String message = Messages.LEVEL_PHONE.equals(level)
            ? "Your role lets you edit on a phone only; saving this change needs a full editing role."
            : "You do not have a role that lets you change the map. Ask for a Map Studio editing role.";
        throw new MapStudioException(Messages.CODE_ROLE, message, op.index(), op.id());
    }
}
