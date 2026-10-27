package com.aoindustrial.perspective.mapstudio.designer.setup;

import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.util.function.Consumer;

import javax.imageio.ImageIO;
import javax.swing.UIManager;
import javax.swing.plaf.FontUIResource;

import org.junit.jupiter.api.Test;

/**
 * Paints the setup form headless into PNGs (epic 2 story 16), for a look against the mockup
 * PNGs: normal, reasons, empty, new and unreachable. Runs only with
 * {@code -PmapstudioScreenshots=<folder>}. Swing's cross-platform look with the DESIGN.md
 * stand-in colours on the UIManager keys the form reads; the Designer's own look and feel is
 * not on the test class path, so a Designer shows its own controls.
 */
class SetupPanelRenderTest {

    private static final int WIDTH = 1176;
    private static final int HEIGHT = 790;

    private static final String SETUP = "{\"schemaVersion\": 1, \"connection\": \"MapStudio\","
        + " \"roles\": {\"full\": [\"MapEditor\", \"Administrator\"], \"phone\": [\"MapOperator\"]},"
        + " \"kindsFunction\": \"mapstudio_dev.kinds\", \"assetsFunction\": \"mapstudio_dev.assets\","
        + " \"refreshIntervalSeconds\": 10, \"alarmPage\": \"/alarms/{item.name}\", \"basemaps\": [\"none\", \"osm\"],"
        + " \"tokenSecret\": \"\"}";

    private static void lookOfTheMock() {
        UIManager.put("Panel.background", new Color(0xF4, 0xF5, 0xF7));
        UIManager.put("TextField.background", Color.WHITE);
        UIManager.put("Component.borderColor", new Color(0xC9, 0xCD, 0xD3));
        UIManager.put("Separator.foreground", new Color(0xDD, 0xE0, 0xE4));
        UIManager.put("Label.foreground", new Color(0x1F, 0x23, 0x28));
        UIManager.put("Label.disabledForeground", new Color(0x6B, 0x72, 0x7B));
        UIManager.put("Component.accentColor", new Color(0x1F, 0x6F, 0xC5));
        UIManager.put("Component.error.focusedBorderColor", new Color(0xC4, 0x1E, 0x2A));
        UIManager.put("Component.warning.focusedBorderColor", new Color(0xB8, 0x6E, 0x00));
        Font font = new Font("DejaVu Sans", Font.PLAIN, 13);
        UIManager.put("defaultFont", new FontUIResource(font));
        for (String k : new String[] {"Label.font", "TextField.font", "CheckBox.font", "Button.font", "TextArea.font",
            "List.font", "ToolTip.font"}) {
            UIManager.put(k, new FontUIResource(font));
        }
        UIManager.put("Panel.background", new Color(0xF4, 0xF5, 0xF7));
        UIManager.put("CheckBox.background", Color.WHITE);
        UIManager.put("Button.background", new Color(0xF4, 0xF5, 0xF7));
    }

    private static void render(String dir, String name, Consumer<SetupPanel> state, FakeListSource source)
        throws IOException {
        SetupPanel panel = new SetupPanel(null, () -> true, source, SetupListSource.Async.DIRECT);
        state.accept(panel);
        SetupPanelTest.layout(panel, WIDTH, HEIGHT);
        BufferedImage img = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, WIDTH, HEIGHT);
        panel.printAll(g);
        g.dispose();
        ImageIO.write(img, "png", new File(dir, "setup-editor-" + name + ".png"));
    }

    @Test
    void renderTheStates() throws IOException {
        String dir = System.getProperty("mapstudio.screenshots", "");
        assumeFalse(dir.isEmpty(), "no -PmapstudioScreenshots folder");
        new File(dir).mkdirs();
        lookOfTheMock();
        render(dir, "normal", p -> p.show(SetupForm.fromJson(SETUP), false, ""), new FakeListSource());
        render(dir, "reasons", p -> {
            p.show(SetupForm.fromJson(SETUP), false, "");
            p.type(SetupForm.CONNECTION, "MapStore");
            p.type(SetupForm.FULL_ROLES, "MapEditor\nMapEdtor");
            p.type(SetupForm.PHONE_ROLES, "MapOperator\nMapOperator");
            p.type(SetupForm.REFRESH, "0");
        }, new FakeListSource());
        render(dir, "empty", SetupPanel::showEmpty, new FakeListSource());
        render(dir, "new", SetupPanel::showNew, new FakeListSource());
        FakeListSource down = new FakeListSource();
        down.reachable = false;
        render(dir, "unreachable", p -> p.show(SetupForm.fromJson(SETUP), false, ""), down);
    }
}
