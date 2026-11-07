package com.aoindustrial.perspective.mapstudio.common;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.util.List;

import javax.swing.ImageIcon;

import com.inductiveautomation.perspective.common.api.ComponentDescriptor;
import com.inductiveautomation.perspective.common.api.ComponentDescriptorImpl;
import com.inductiveautomation.perspective.common.api.ComponentEventDescriptor;

/**
 * Describes the Map Studio component. The {@link #COMPONENT_ID} must match the
 * {@code COMPONENT_TYPE} of the TypeScript component and the delegate
 * registration in the gateway hook.
 */
public final class MapStudioComponent {

    private MapStudioComponent() {
    }

    /** Component id, registered on the gateway, in the Designer and in the browser. */
    public static final String COMPONENT_ID = "ao.mapstudio";

    /**
     * The component's events (epic 4 entries 2 and 14, contract 0.4.0, docs/contract.md "The component's
     * events"), fired by the browser through {@code componentEvents.fireComponentEvent}, each with its payload
     * schema: {@code onItemSelected} on every selection change with the selected map item as the AD-7 map item
     * object under {@code mapItem}, or null when the selection was cleared ({@code mapstudio.events.json}).
     */
    public static final String EVENT_ITEM_SELECTED = "onItemSelected";

    /**
     * Fired when the map first settles and at every move end, never during a move, with the viewport object the
     * component also writes to its {@code viewport} prop ({@code mapstudio.events.viewport.json}).
     */
    public static final String EVENT_VIEWPORT_CHANGED = "onViewportChanged";

    /**
     * Fired wherever the Gateway is told {@code popup.open}, with {@code {itemId, segment}}
     * ({@code mapstudio.events.popup-open.json}).
     */
    public static final String EVENT_POPUP_OPEN = "onPopupOpen";

    /**
     * Fired wherever the Gateway is told {@code popup.close}, with {@code {itemId}}
     * ({@code mapstudio.events.popup-close.json}).
     */
    public static final String EVENT_POPUP_CLOSE = "onPopupClose";

    /** The events' descriptions, as the Designer's event editor shows them. */
    static final String EVENT_ITEM_SELECTED_DESCRIPTION = "Fired on every selection change: event.mapItem is the "
        + "selected map item (id, name, kind, assetId, properties, basePath, alarmsPath, values), or null when the "
        + "selection was cleared. The selectedItem prop carries the id.";

    static final String EVENT_VIEWPORT_CHANGED_DESCRIPTION = "Fired when the map first settles and at every move end, "
        + "never during a move: event.center is [lng, lat], event.zoom the zoom and event.bounds "
        + "[[west, south], [east, north]]. The viewport prop carries the same object.";

    static final String EVENT_POPUP_OPEN_DESCRIPTION = "Fired when a popup opens in View mode: event.itemId is the map "
        + "item's id and event.segment the line segment it opened at ({fromId, toId}), or null for a point. A new "
        + "segment of the same line is a new open; Edit mode opens no popup.";

    static final String EVENT_POPUP_CLOSE_DESCRIPTION = "Fired when a popup closes: event.itemId is the map item "
        + "whose popup closed.";

    /** The descriptor registered with Perspective's component registries. */
    public static final ComponentDescriptor DESCRIPTOR;

    static {
        BufferedImage icon = paletteIcon();
        DESCRIPTOR = ComponentDescriptorImpl.ComponentBuilder.newBuilder()
            .setPaletteCategory(MapStudioModule.COMPONENT_CATEGORY)
            .setId(COMPONENT_ID)
            .setModuleId(MapStudioModule.MODULE_ID)
            .setSchema(MapStudioModule.schema("/mapstudio.props.json"))
            .setEvents(List.of(
                new ComponentEventDescriptor(EVENT_ITEM_SELECTED, EVENT_ITEM_SELECTED_DESCRIPTION,
                    MapStudioModule.schema("/mapstudio.events.json")),
                new ComponentEventDescriptor(EVENT_VIEWPORT_CHANGED, EVENT_VIEWPORT_CHANGED_DESCRIPTION,
                    MapStudioModule.schema("/mapstudio.events.viewport.json")),
                new ComponentEventDescriptor(EVENT_POPUP_OPEN, EVENT_POPUP_OPEN_DESCRIPTION,
                    MapStudioModule.schema("/mapstudio.events.popup-open.json")),
                new ComponentEventDescriptor(EVENT_POPUP_CLOSE, EVENT_POPUP_CLOSE_DESCRIPTION,
                    MapStudioModule.schema("/mapstudio.events.popup-close.json"))))
            .setName("Map Studio")
            .setIcon(new ImageIcon(icon))
            .addPaletteEntry("", "Map Studio",
                "The project's map: sites and assets with their live state, edited in the browser.",
                icon, null)
            .setDefaultMetaName("mapStudio")
            .setResources(MapStudioModule.BROWSER_RESOURCES)
            .build();
    }

    /**
     * A 16 by 16 palette icon drawn with Java2D (a map pin over a path), so no
     * binary asset needs bundling. Headless safe. Also the Map Studio Setup node's icon
     * in the project browser.
     */
    public static BufferedImage paletteIcon() {
        int s = 16;
        BufferedImage img = new BufferedImage(s, s, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        // The Designer palette is Swing, not the project theme: take the look-and-feel's
        // own foreground colour rather than shipping a colour of the module's own (AD-11).
        Color fg = javax.swing.UIManager.getColor("Label.foreground");
        g.setColor(fg != null ? fg : Color.GRAY);
        g.setStroke(new BasicStroke(1.4f));
        g.drawLine(2, 13, 7, 9);
        g.drawLine(7, 9, 11, 12);
        g.drawLine(11, 12, 14, 7);
        g.drawOval(5, 2, 6, 6);
        g.fillOval(7, 4, 2, 2);
        g.dispose();
        return img;
    }
}
