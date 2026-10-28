package com.aoindustrial.perspective.mapstudio.gateway.basemap;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.util.LoggerEx;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;

/**
 * The {@code basemap.source.reply} for a project (epic 3 entry 6, AD-12): the satellite basemap's raster
 * tile source, Mapbox satellite through the Raster Tiles API, with the token read from the secret the
 * setup names ({@code tokenSecret}, {@code <provider>/<name>}). The provider is a setting of this class,
 * never of the browser, so a later provider (Esri, MapTiler) changes the reply and nothing else.
 *
 * <p>Rules: only {@code satellite} is answered (OpenStreetMap needs no token and is built in the browser;
 * None has no tiles); the setup must offer it; the token must be a public Mapbox token ({@code pk.}): a
 * secret token ({@code sk.}) or anything else is refused, since the token reaches every viewer's browser
 * in the tile URL. Every refusal is {@code token-unavailable} (or {@code invalid} for a wrong ask) with a
 * plain-words message naming the secret's name, never its value. Logger {@code MapStudio.basemap} logs
 * the secret's name and the problem; a line never holds the value ({@code BasemapSourcesTest} proves it).
 */
public final class BasemapSources {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.basemap");

    public static final String SATELLITE = "satellite";
    public static final String PROVIDER_MAPBOX = "mapbox";
    /** Mapbox public tokens start with this; secret tokens with {@code sk.}. */
    public static final String PUBLIC_TOKEN_PREFIX = "pk.";
    /** Mapbox Raster Tiles API, satellite tileset, 512 px tiles (the @2x size), JPEG quality 90. */
    public static final String MAPBOX_SATELLITE_TILES =
        "https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=";
    public static final int MAPBOX_TILE_SIZE = 512;
    public static final int MAPBOX_MAXZOOM = 22;
    /** Mapbox's text attribution for its satellite imagery, with the feedback link Mapbox asks for. */
    public static final String MAPBOX_ATTRIBUTION =
        "&copy; <a href=\"https://www.mapbox.com/about/maps/\" target=\"_blank\" rel=\"noopener\">Mapbox</a> "
        + "&copy; Maxar "
        + "<a href=\"https://apps.mapbox.com/feedback/\" target=\"_blank\" rel=\"noopener\">Improve this map</a>";

    private final TokenSource tokens;

    public BasemapSources(TokenSource tokens) {
        this.tokens = tokens;
    }

    /**
     * The reply body for {@code basemap.source}'s {@code body} under {@code setup}.
     *
     * @throws MapStudioException {@code invalid} for a basemap other than satellite or one the setup does
     *     not offer; {@code token-unavailable} for every token problem
     */
    public JsonObject reply(String project, Setup setup, JsonObject body) {
        JsonElement b = body == null ? null : body.get("basemap");
        String basemap = b != null && b.isJsonPrimitive() && b.getAsJsonPrimitive().isString() ? b.getAsString() : "";
        if (!SATELLITE.equals(basemap)) {
            throw new MapStudioException(Messages.CODE_INVALID,
                "basemap.source answers the satellite basemap only; none and osm need no source from the Gateway.");
        }
        if (!setup.basemaps().contains(SATELLITE)) {
            throw new MapStudioException(Messages.CODE_INVALID,
                "The Map Studio setup does not offer the satellite basemap; add satellite to its basemaps.");
        }
        String token = token(project, setup.tokenSecret());
        JsonObject out = new JsonObject();
        out.addProperty("basemap", SATELLITE);
        out.addProperty("provider", PROVIDER_MAPBOX);
        JsonArray tiles = new JsonArray();
        tiles.add(MAPBOX_SATELLITE_TILES + URLEncoder.encode(token, StandardCharsets.UTF_8));
        out.add("tiles", tiles);
        out.addProperty("tileSize", MAPBOX_TILE_SIZE);
        out.addProperty("maxzoom", MAPBOX_MAXZOOM);
        out.addProperty("attribution", MAPBOX_ATTRIBUTION);
        return out;
    }

    /** The public token from the secret {@code tokenSecret} names, or {@code token-unavailable}. */
    String token(String project, String tokenSecret) {
        String named = tokenSecret == null ? "" : tokenSecret.trim();
        if (named.isEmpty()) {
            throw refused(project, "The Map Studio setup names no map token secret (tokenSecret): name the secret "
                + "that holds a public Mapbox token as <provider>/<name>.");
        }
        int slash = named.indexOf('/');
        String provider = slash < 0 ? "" : named.substring(0, slash).trim();
        String name = slash < 0 ? named : named.substring(slash + 1).trim();
        if (provider.isEmpty() || name.isEmpty()) {
            throw refused(project, "The map token secret " + named + " must name the secret provider and the secret, "
                + "as <provider>/<name>.");
        }
        String value;
        try {
            value = tokens.read(provider, name);
        } catch (TokenSource.TokenException ex) {
            switch (ex.problem()) {
                case NO_PROVIDER:
                    throw refused(project, "There is no secret provider named " + provider + " on this Gateway, so the "
                        + "map token secret " + named + " cannot be read.");
                case NOT_FOUND:
                    throw refused(project, "The map token secret " + named + " was not found.");
                default:
                    Throwable cause = ex.getCause();
                    log.warn("Project " + project + ": the map token secret " + named + " could not be read: "
                        + (cause == null ? "unknown failure" : cause.getClass().getSimpleName()));
                    throw new MapStudioException(Messages.CODE_TOKEN_UNAVAILABLE, "The map token secret " + named
                        + " could not be read; see the Gateway log.");
            }
        }
        if (value == null || value.isEmpty()) {
            throw refused(project, "The map token secret " + named + " is empty.");
        }
        if (!value.startsWith(PUBLIC_TOKEN_PREFIX)) {
            throw refused(project, "The map token secret " + named + " is not a public Mapbox token: it must start "
                + "with pk. (a secret sk. token is never sent to a browser).");
        }
        log.debugf("Project %s: satellite tile source answered from the map token secret %s.", project, named);
        return value;
    }

    private static MapStudioException refused(String project, String message) {
        log.infof("Project %s: satellite basemap refused: %s", project, message);
        return new MapStudioException(Messages.CODE_TOKEN_UNAVAILABLE, message);
    }
}
