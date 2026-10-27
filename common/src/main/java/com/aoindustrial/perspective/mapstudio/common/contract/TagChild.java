package com.aoindustrial.perspective.mapstudio.common.contract;

import java.util.Comparator;
import java.util.Locale;

import com.inductiveautomation.ignition.common.gson.JsonNull;
import com.inductiveautomation.ignition.common.gson.JsonObject;

/**
 * One child of a {@code tags.browse} folder (entry 15): {@code {name, path, type, dataType,
 * hasChildren}}. {@code path} is the full path with its {@code [provider]}; {@code type} is one of
 * {@code folder}, {@code tag}, {@code udt-instance}, {@code udt-type}, {@code other};
 * {@code dataType} is Ignition's data type name for a tag, null otherwise.
 */
public record TagChild(String name, String path, String type, String dataType, boolean hasChildren) {

    public static final String FOLDER = "folder";
    public static final String TAG = "tag";
    public static final String UDT_INSTANCE = "udt-instance";
    public static final String UDT_TYPE = "udt-type";
    public static final String OTHER = "other";

    /** By name, ignoring letter case first (Ignition's own order is not stated), then exactly. */
    public static final Comparator<TagChild> BY_NAME =
        Comparator.comparing((TagChild c) -> c.name().toLowerCase(Locale.ROOT)).thenComparing(TagChild::name);

    /** A child whose data type is kept only for a tag. */
    public static TagChild of(String name, String path, String objectType, String dataType, boolean hasChildren) {
        String type = typeWord(objectType);
        return new TagChild(name, path, type, TAG.equals(type) ? dataType : null, hasChildren);
    }

    /**
     * The contract's type word for Ignition's {@code TagObjectType} name: {@code Folder},
     * {@code AtomicTag}, {@code UdtInstance}, {@code UdtType}; anything else is {@code other}.
     */
    public static String typeWord(String objectType) {
        if (objectType == null) {
            return OTHER;
        }
        return switch (objectType) {
            case "Folder" -> FOLDER;
            case "AtomicTag" -> TAG;
            case "UdtInstance" -> UDT_INSTANCE;
            case "UdtType" -> UDT_TYPE;
            default -> OTHER;
        };
    }

    /**
     * Whether a browse node is listed: a tag property ({@code Property}) and a node without a full
     * path (a UDT instance's {@code Parameters}, seen live) are left out.
     */
    public static boolean listed(String objectType, String fullPath) {
        return !"Property".equals(objectType) && fullPath != null && !fullPath.isEmpty();
    }

    public JsonObject toJson() {
        JsonObject o = new JsonObject();
        o.addProperty("name", name);
        o.addProperty("path", path);
        o.addProperty("type", type);
        if (dataType == null) {
            o.add("dataType", JsonNull.INSTANCE);
        } else {
            o.addProperty("dataType", dataType);
        }
        o.addProperty("hasChildren", hasChildren);
        return o;
    }
}
