package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Component;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.Ellipse2D;
import java.awt.geom.Path2D;

import javax.swing.Icon;
import javax.swing.UIManager;

/**
 * The setup form's look (DESIGN.md, Designer setup form): colours are UIManager keys of the
 * Designer's look and feel, read when asked, so the form follows its light or dark theme; this is
 * the one place with fallback colours, used only when a key is missing. Sizes are DESIGN.md's
 * {@code designer-*} spacing. Glyphs are drawn, so reasons and warnings are a glyph and words,
 * never colour alone.
 */
final class Theme {

    private Theme() {
    }

    static final int CONTROL_HEIGHT = 28;
    static final int LABEL_COLUMN = 184;
    static final int FIELD = 340;
    static final int CHIP_FIELD = 420;
    static final int REFRESH_FIELD = 96;
    static final int MESSAGE_WIDTH = 560;
    static final int ROW_GAP = 10;
    static final int SECTION_GAP = 14;
    static final int FORM_MAX = 760;
    static final int TAB_PADDING = 24;
    /** Below this width a row's label sits above its control. */
    static final int STACK_BELOW = LABEL_COLUMN + 300;

    static Color panel() {
        return color("Panel.background", new Color(0xF2, 0xF3, 0xF5));
    }

    static Color surface() {
        return color("TextField.background", Color.WHITE);
    }

    static Color border() {
        return color("Component.borderColor", new Color(0xC4, 0xC8, 0xCE));
    }

    static Color divider() {
        return color("Separator.foreground", new Color(0xD8, 0xDB, 0xE0));
    }

    static Color text() {
        return color("Label.foreground", new Color(0x1F, 0x23, 0x28));
    }

    static Color secondary() {
        return color("Label.disabledForeground", new Color(0x6B, 0x72, 0x7B));
    }

    static Color accent() {
        return color("Component.accentColor", new Color(0x1F, 0x6F, 0xC5));
    }

    static Color error() {
        return color("Component.error.focusedBorderColor", new Color(0xC4, 0x1E, 0x2A));
    }

    static Color warning() {
        return color("Component.warning.focusedBorderColor", new Color(0xC2, 0x7A, 0x00));
    }

    /** {@code c} at {@code alpha} (0 to 1) over {@code base}. */
    static Color tint(Color c, double alpha, Color base) {
        return new Color((int) Math.round(c.getRed() * alpha + base.getRed() * (1 - alpha)),
            (int) Math.round(c.getGreen() * alpha + base.getGreen() * (1 - alpha)),
            (int) Math.round(c.getBlue() * alpha + base.getBlue() * (1 - alpha)));
    }

    private static Color color(String key, Color fallback) {
        Color c = UIManager.getColor(key);
        return c != null ? c : fallback;
    }

    static Font font() {
        Font f = UIManager.getFont("defaultFont");
        if (f == null) {
            f = UIManager.getFont("Label.font");
        }
        return f != null ? f : new Font(Font.SANS_SERIF, Font.PLAIN, 13);
    }

    static Font bold(float size) {
        return font().deriveFont(Font.BOLD, size);
    }

    static Font small() {
        return font().deriveFont(font().getSize2D() - 1f);
    }

    static Font mono() {
        return new Font(Font.MONOSPACED, Font.PLAIN, Math.round(font().getSize2D()));
    }

    /** A drawn glyph; its colour is read when painted. */
    enum Glyph implements Icon {
        ERROR, WARNING, LOCK, INFO, MAP;

        @Override
        public void paintIcon(Component c, Graphics g0, int x, int y) {
            Graphics2D g = (Graphics2D) g0.create();
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.translate(x, y);
            switch (this) {
                case ERROR -> {
                    g.setColor(error());
                    g.fill(new Ellipse2D.Double(1, 1, 12, 12));
                    g.setColor(Color.WHITE);
                    g.setStroke(new BasicStroke(1.6f));
                    g.drawLine(4, 4, 10, 10);
                    g.drawLine(10, 4, 4, 10);
                }
                case WARNING -> {
                    g.setColor(warning());
                    Path2D p = new Path2D.Double();
                    p.moveTo(7, 1);
                    p.lineTo(13.5, 13);
                    p.lineTo(0.5, 13);
                    p.closePath();
                    g.fill(p);
                    g.setColor(Color.WHITE);
                    g.fillRect(6, 5, 2, 4);
                    g.fillRect(6, 10, 2, 2);
                }
                case LOCK -> {
                    g.setColor(secondary());
                    g.setStroke(new BasicStroke(1.4f));
                    g.drawArc(4, 1, 6, 8, 0, 180);
                    g.fillRoundRect(2, 6, 10, 7, 2, 2);
                }
                case INFO -> {
                    g.setColor(accent());
                    g.fill(new Ellipse2D.Double(1, 1, 12, 12));
                    g.setColor(Color.WHITE);
                    g.fillRect(6, 6, 2, 5);
                    g.fillRect(6, 3, 2, 2);
                }
                case MAP -> {
                    g.setColor(accent());
                    g.setStroke(new BasicStroke(1.3f));
                    Path2D p = new Path2D.Double();
                    p.moveTo(1, 3);
                    p.lineTo(5, 1);
                    p.lineTo(9, 3);
                    p.lineTo(13, 1);
                    p.lineTo(13, 11);
                    p.lineTo(9, 13);
                    p.lineTo(5, 11);
                    p.lineTo(1, 13);
                    p.closePath();
                    g.draw(p);
                    g.drawLine(5, 1, 5, 11);
                    g.drawLine(9, 3, 9, 13);
                }
                default -> {
                }
            }
            g.dispose();
        }

        @Override
        public int getIconWidth() {
            return 14;
        }

        @Override
        public int getIconHeight() {
            return 14;
        }
    }
}
