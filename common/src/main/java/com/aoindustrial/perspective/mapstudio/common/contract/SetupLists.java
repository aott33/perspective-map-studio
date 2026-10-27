package com.aoindustrial.perspective.mapstudio.common.contract;

import java.util.ArrayList;
import java.util.List;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

/**
 * The reply of {@link SetupLookupRpc#lists(String)} (epic 2 story 16): three lists, each answered
 * on its own, so a slow secret provider never hides the connections.
 *
 * <pre>
 * {"connections": {"status": "ok", "items": [{"name": "MapStudio", "detail": "PostgreSQL"}]},
 *  "roles": {"status": "not-listed", "items": [], "reason": "..."},
 *  "secretProviders": {"status": "unavailable", "items": [], "reason": "..."}}
 * </pre>
 *
 * <p>Reading is lenient: a part that is missing or malformed reads as {@link Status#UNAVAILABLE},
 * so the form shows "List unavailable" and never a wrong list.
 */
public record SetupLists(Part connections, Part roles, Part secretProviders) {

    /** How one list was answered. */
    public enum Status {
        /** Listed; {@link Part#entries()} holds the names. */
        OK("ok"),
        /** The Gateway could not answer in time or failed; the form gives no warnings for this list. */
        UNAVAILABLE("unavailable"),
        /** The source does not list its names (an identity provider that gives roles in its claims). */
        NOT_LISTED("not-listed");

        private final String word;

        Status(String word) {
            this.word = word;
        }

        public String word() {
            return word;
        }

        static Status of(String word) {
            for (Status s : values()) {
                if (s.word.equals(word)) {
                    return s;
                }
            }
            return null;
        }
    }

    /** One name of a list, with a detail word (a connection's type), or an empty detail. */
    public record Entry(String name, String detail) {
        public Entry {
            name = name == null ? "" : name;
            detail = detail == null ? "" : detail;
        }

        public static Entry of(String name) {
            return new Entry(name, "");
        }
    }

    /** One list: its status, its entries (empty unless {@link Status#OK}) and a plain reason. */
    public record Part(Status status, List<Entry> entries, String reason) {
        public Part {
            status = status == null ? Status.UNAVAILABLE : status;
            entries = status == Status.OK && entries != null ? List.copyOf(entries) : List.of();
            reason = reason == null ? "" : reason;
        }

        public static Part ok(List<Entry> entries) {
            return new Part(Status.OK, entries, "");
        }

        public static Part okNames(List<String> names) {
            List<Entry> out = new ArrayList<>();
            names.forEach(n -> out.add(Entry.of(n)));
            return ok(out);
        }

        public static Part unavailable(String reason) {
            return new Part(Status.UNAVAILABLE, List.of(), reason);
        }

        public static Part notListed(String reason) {
            return new Part(Status.NOT_LISTED, List.of(), reason);
        }

        public boolean isOk() {
            return status == Status.OK;
        }

        /** The entry names, in the order given. */
        public List<String> names() {
            List<String> out = new ArrayList<>();
            entries.forEach(e -> out.add(e.name()));
            return out;
        }

        public JsonObject toJsonObject() {
            JsonObject o = new JsonObject();
            o.addProperty("status", status.word());
            JsonArray items = new JsonArray();
            for (Entry e : entries) {
                JsonObject item = new JsonObject();
                item.addProperty("name", e.name());
                item.addProperty("detail", e.detail());
                items.add(item);
            }
            o.add("items", items);
            if (!reason.isEmpty()) {
                o.addProperty("reason", reason);
            }
            return o;
        }

        public String toJson() {
            return toJsonObject().toString();
        }

        /** Reads a part; anything it cannot read is {@link Status#UNAVAILABLE}. */
        public static Part fromJson(String text) {
            try {
                return fromElement(JsonParser.parseString(text));
            } catch (RuntimeException ex) {
                return unavailable("The Gateway's answer could not be read.");
            }
        }

        static Part fromElement(JsonElement e) {
            if (e == null || !e.isJsonObject()) {
                return unavailable("The Gateway's answer could not be read.");
            }
            JsonObject o = e.getAsJsonObject();
            Status status = o.has("status") && o.get("status").isJsonPrimitive()
                ? Status.of(o.get("status").getAsString()) : null;
            if (status == null) {
                return unavailable("The Gateway's answer could not be read.");
            }
            String reason = o.has("reason") && o.get("reason").isJsonPrimitive() ? o.get("reason").getAsString() : "";
            List<Entry> entries = new ArrayList<>();
            if (status == Status.OK) {
                JsonElement items = o.get("items");
                if (items == null || !items.isJsonArray()) {
                    return unavailable("The Gateway's answer could not be read.");
                }
                for (JsonElement item : items.getAsJsonArray()) {
                    if (item.isJsonPrimitive()) {
                        entries.add(Entry.of(item.getAsString()));
                    } else if (item.isJsonObject() && item.getAsJsonObject().has("name")
                        && item.getAsJsonObject().get("name").isJsonPrimitive()) {
                        JsonObject io = item.getAsJsonObject();
                        String detail = io.has("detail") && io.get("detail").isJsonPrimitive()
                            ? io.get("detail").getAsString() : "";
                        entries.add(new Entry(io.get("name").getAsString(), detail));
                    }
                }
            }
            return new Part(status, entries, reason);
        }
    }

    public SetupLists {
        connections = connections == null ? Part.unavailable("") : connections;
        roles = roles == null ? Part.unavailable("") : roles;
        secretProviders = secretProviders == null ? Part.unavailable("") : secretProviders;
    }

    /** Every list unavailable for the same reason (the Gateway not reachable). */
    public static SetupLists unavailable(String reason) {
        Part p = Part.unavailable(reason);
        return new SetupLists(p, p, p);
    }

    public String toJson() {
        JsonObject o = new JsonObject();
        o.add("connections", connections.toJsonObject());
        o.add("roles", roles.toJsonObject());
        o.add("secretProviders", secretProviders.toJsonObject());
        return o.toString();
    }

    /** Reads a reply; a reply it cannot read at all is every list unavailable. */
    public static SetupLists fromJson(String text) {
        try {
            JsonElement e = JsonParser.parseString(text);
            if (!e.isJsonObject()) {
                return unavailable("The Gateway's answer could not be read.");
            }
            JsonObject o = e.getAsJsonObject();
            return new SetupLists(Part.fromElement(o.get("connections")), Part.fromElement(o.get("roles")),
                Part.fromElement(o.get("secretProviders")));
        } catch (RuntimeException ex) {
            return unavailable("The Gateway's answer could not be read.");
        }
    }
}
