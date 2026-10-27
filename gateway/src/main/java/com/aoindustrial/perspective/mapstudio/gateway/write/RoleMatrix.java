package com.aoindustrial.perspective.mapstudio.gateway.write;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import com.inductiveautomation.ignition.common.gson.JsonElement;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.EditOp;
import com.aoindustrial.perspective.mapstudio.common.contract.Kind;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;

/**
 * The role matrix (AD-2). The level comes from the roles the Gateway sees for the
 * session user ({@code WebAuthStatus.getUser().getRoles()}, docs/platform-checks.md,
 * epic 2 story 1) against the setup's role lists; never from the browser.
 *
 * <p>{@code full} may create, update, delete and restore map items. {@code phone}
 * (epic 2 story 2) may only update a map item's {@code properties} and move a
 * point: an {@code update} of an {@code item} whose {@code data} carries no field
 * but {@code geometry} and {@code properties}, the geometry a {@code Point}
 * ({@link #check}, before the transaction), on a map item stored as a point
 * ({@link #checkStored}, inside it). {@code none} may not save.
 */
public final class RoleMatrix {

    /** The fields a phone editor's update may carry. */
    public static final Set<String> PHONE_FIELDS = Set.of("geometry", "properties");

    static final String PHONE_MESSAGE = "Phone editing may move a point and change a map item's properties;"
        + " this change needs a full editing role. Nothing in this save was written.";
    static final String INSTRUMENT_MESSAGE = "An instrument moves along its line; only full editing can move it."
        + " Nothing in this save was written.";
    static final String NONE_MESSAGE =
        "You do not have a role that lets you change the map. Ask for a Map Studio editing role.";

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
     * Refuse the op with {@code role} when the level may not do it, from the op alone.
     *
     * @throws MapStudioException {@code role}, naming the op
     */
    public static void check(String level, EditOp op) {
        if (Messages.LEVEL_FULL.equals(level)) {
            return;
        }
        if (Messages.LEVEL_PHONE.equals(level) && phoneMayChange(op)) {
            return;
        }
        if (Messages.LEVEL_PHONE.equals(level) && EditOp.UPDATE.equals(op.op()) && op.data().has("attachment")) {
            throw new MapStudioException(Messages.CODE_ROLE, INSTRUMENT_MESSAGE, op.index(), op.id());
        }
        throw refusal(level, op);
    }

    /**
     * Refuse, inside the transaction, a phone editor's geometry change of a map item not
     * stored as a point (a line's geometry), and of a map item of an instrument kind (owner,
     * 2026-10-27, epic 2 story 14: an instrument moves along its line, so only full editing
     * moves it). A missing item is left to the write service.
     *
     * @param kinds the project's kind list in use, by id
     * @throws MapStudioException {@code role}, naming the op
     */
    public static void checkStored(String level, EditOp op, Optional<MapItemRecord> stored, Map<String, Kind> kinds) {
        if (!Messages.LEVEL_PHONE.equals(level) || !op.data().has("geometry") || stored.isEmpty()) {
            return;
        }
        JsonElement type = stored.get().geometry().get("type");
        if (type == null || !"Point".equals(type.getAsString())) {
            throw refusal(level, op);
        }
        Kind kind = kinds.get(stored.get().kind());
        if ((kind != null && kind.instrument()) || stored.get().attachment() != null) {
            throw new MapStudioException(Messages.CODE_ROLE, INSTRUMENT_MESSAGE, op.index(), op.id());
        }
    }

    private static boolean phoneMayChange(EditOp op) {
        if (!EditOp.UPDATE.equals(op.op()) || !EditOp.ENTITY_ITEM.equals(op.entity()) || op.data().size() == 0) {
            return false;
        }
        for (String field : op.data().keySet()) {
            if (!PHONE_FIELDS.contains(field)) {
                return false;
            }
        }
        JsonElement geometry = op.data().get("geometry");
        if (geometry == null) {
            return true;
        }
        if (!geometry.isJsonObject()) {
            return false;
        }
        JsonElement type = geometry.getAsJsonObject().get("type");
        return type != null && type.isJsonPrimitive() && "Point".equals(type.getAsString());
    }

    private static MapStudioException refusal(String level, EditOp op) {
        String message = Messages.LEVEL_PHONE.equals(level) ? PHONE_MESSAGE : NONE_MESSAGE;
        return new MapStudioException(Messages.CODE_ROLE, message, op.index(), op.id());
    }
}
