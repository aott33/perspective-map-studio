package com.aoindustrial.perspective.mapstudio.common;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;

import javax.swing.ImageIcon;

import com.inductiveautomation.perspective.common.api.ComponentDescriptor;
import com.inductiveautomation.perspective.common.api.ComponentDescriptorImpl;

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

    /** The descriptor registered with Perspective's component registries. */
    public static final ComponentDescriptor DESCRIPTOR;

    static {
        BufferedImage icon = paletteIcon();
        DESCRIPTOR = ComponentDescriptorImpl.ComponentBuilder.newBuilder()
            .setPaletteCategory(MapStudioModule.COMPONENT_CATEGORY)
            .setId(COMPONENT_ID)
            .setModuleId(MapStudioModule.MODULE_ID)
            .setSchema(MapStudioModule.schema("/mapstudio.props.json"))
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
