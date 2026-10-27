package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.awt.Color;
import java.awt.Component;
import java.awt.Container;
import java.awt.Cursor;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Insets;
import java.awt.LayoutManager;
import java.awt.Rectangle;
import java.awt.font.TextAttribute;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import javax.swing.BorderFactory;
import javax.swing.Icon;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JTextArea;
import javax.swing.Scrollable;
import javax.swing.SwingConstants;
import javax.swing.text.View;

/**
 * The small Swing parts of the setup form (epic 2 story 16): a width-capped column, a form row
 * whose label sits beside or above its control, wrapping text, message lines with their glyph,
 * section headings and link buttons. Heights follow the width given, so the form wraps instead of
 * scrolling sideways.
 */
final class FormParts {

    private FormParts() {
    }

    /** Wrapping, read-only text whose height follows its width. */
    static final class WrapText extends JTextArea implements HeightForWidth {
        WrapText(String text) {
            super(text);
            setLineWrap(true);
            setWrapStyleWord(true);
            setEditable(false);
            setFocusable(false);
            setOpaque(false);
            setBorder(BorderFactory.createEmptyBorder());
            setFont(Theme.font());
            setForeground(Theme.text());
        }

        @Override
        public int heightFor(int width) {
            if (getText().isEmpty()) {
                return 0;
            }
            View v = getUI().getRootView(this);
            v.setSize(Math.max(1, width), Integer.MAX_VALUE);
            return (int) Math.ceil(v.getPreferredSpan(View.Y_AXIS));
        }
    }

    /** A reason, a warning or a note: a glyph (or none) and wrapping words. */
    static final class MessageLine extends JPanel implements HeightForWidth {
        private final JLabel icon = new JLabel();
        private final WrapText text = new WrapText("");

        MessageLine() {
            super(null);
            setOpaque(false);
            add(icon);
            add(text);
        }

        MessageLine set(Icon glyph, String words, Color color, Font font) {
            icon.setIcon(glyph);
            text.setText(words);
            text.setForeground(color);
            text.setFont(font);
            return this;
        }

        String text() {
            return text.getText();
        }

        Icon glyph() {
            return icon.getIcon();
        }

        private int indent() {
            return icon.getIcon() == null ? 0 : 19;
        }

        @Override
        public int heightFor(int width) {
            return Math.max(icon.getIcon() == null ? 0 : 16, text.heightFor(width - indent()));
        }

        @Override
        public void doLayout() {
            int ind = indent();
            icon.setBounds(0, 1, ind, 16);
            text.setBounds(ind, 0, Math.max(1, getWidth() - ind), text.heightFor(getWidth() - ind));
        }

        @Override
        public Dimension getPreferredSize() {
            int w = getWidth() > 0 ? getWidth() : Theme.MESSAGE_WIDTH;
            return new Dimension(w, heightFor(w));
        }
    }

    /** A section heading with a rule to its right, as Project Properties' "Tag Settings". */
    static final class Heading extends JLabel {
        Heading(String text) {
            super(text);
            setFont(Theme.bold(Theme.font().getSize2D()));
            setForeground(Theme.text());
            setBorder(BorderFactory.createEmptyBorder(2, 0, 2, 0));
        }

        @Override
        protected void paintComponent(Graphics g) {
            super.paintComponent(g);
            int textEnd = getFontMetrics(getFont()).stringWidth(getText()) + 12;
            g.setColor(Theme.divider());
            int y = getHeight() / 2;
            g.drawLine(textEnd, y, getWidth(), y);
        }
    }

    /** A link-looking button. */
    static JButton link(String text, Color color, boolean underline) {
        JButton b = new JButton(text);
        b.setBorder(BorderFactory.createEmptyBorder(1, 2, 1, 2));
        b.setContentAreaFilled(false);
        b.setBorderPainted(false);
        b.setFocusPainted(true);
        b.setForeground(color);
        b.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        b.setHorizontalAlignment(SwingConstants.LEFT);
        Font f = Theme.font();
        if (underline) {
            f = f.deriveFont(Map.of(TextAttribute.UNDERLINE, TextAttribute.UNDERLINE_ON));
        }
        b.setFont(f);
        return b;
    }

    /**
     * A vertical stack of children, each at most {@code max} wide and left aligned after
     * {@code pad}, with a gap before each; tracks its viewport's width (no horizontal scroll bar).
     */
    static final class Column extends JPanel implements Scrollable, HeightForWidth {
        private final int max;
        private final int pad;
        private final int top;
        private final int bottom;
        private final List<Integer> gaps = new ArrayList<>();

        Column(int max, int pad, int top, int bottom) {
            super(null);
            this.max = max;
            this.pad = pad;
            this.top = top;
            this.bottom = bottom;
            setOpaque(false);
        }

        void put(JComponent c, int gapBefore) {
            super.add(c);
            gaps.add(gapBefore);
        }

        int contentWidth(int width) {
            return Math.max(40, Math.min(max, width - 2 * pad));
        }

        @Override
        public int heightFor(int width) {
            int cw = contentWidth(width);
            int y = top;
            Component[] kids = getComponents();
            for (int i = 0; i < kids.length; i++) {
                if (kids[i].isVisible()) {
                    y += gaps.get(i) + height(kids[i], cw);
                }
            }
            return y + bottom;
        }

        static int height(Component c, int width) {
            return c instanceof HeightForWidth ? ((HeightForWidth) c).heightFor(width) : c.getPreferredSize().height;
        }

        @Override
        public void doLayout() {
            int cw = contentWidth(getWidth());
            int y = top;
            Component[] kids = getComponents();
            for (int i = 0; i < kids.length; i++) {
                if (kids[i].isVisible()) {
                    y += gaps.get(i);
                    int h = height(kids[i], cw);
                    kids[i].setBounds(pad, y, cw, h);
                    y += h;
                }
            }
        }

        @Override
        public Dimension getPreferredSize() {
            int w = getWidth() > 0 ? getWidth() : max + 2 * pad;
            if (getParent() != null && getParent().getWidth() > 0) {
                w = getParent().getWidth();
            }
            return new Dimension(Math.min(w, max + 2 * pad), heightFor(w));
        }

        @Override
        public Dimension getMinimumSize() {
            return new Dimension(0, 0);
        }

        @Override
        public Dimension getPreferredScrollableViewportSize() {
            return getPreferredSize();
        }

        @Override
        public int getScrollableUnitIncrement(Rectangle r, int o, int d) {
            return 16;
        }

        @Override
        public int getScrollableBlockIncrement(Rectangle r, int o, int d) {
            return Math.max(16, r.height - 32);
        }

        @Override
        public boolean getScrollableTracksViewportWidth() {
            return true;
        }

        @Override
        public boolean getScrollableTracksViewportHeight() {
            return false;
        }
    }

    /**
     * One field of the form: its label left in the label column (or above the control on a narrow
     * tab), the control with a mark slot after it, then its reasons and warnings, then a note.
     */
    static final class Row extends JPanel implements HeightForWidth {
        static final int MARK = 22;

        final JLabel label;
        final JComponent control;
        final int controlWidth;
        final JLabel mark = new JLabel();
        final List<MessageLine> messages = new ArrayList<>();
        final MessageLine note = new MessageLine();

        Row(JLabel label, JComponent control, int controlWidth) {
            super(null);
            this.label = label;
            this.control = control;
            this.controlWidth = controlWidth;
            setOpaque(false);
            add(label);
            add(control);
            add(mark);
            add(note);
            note.setVisible(false);
        }

        void setNote(String text) {
            note.set(null, text, Theme.secondary(), Theme.small());
            note.setVisible(text != null && !text.isEmpty());
        }

        /** Shows these lines under the control, replacing the ones shown. */
        void setMessages(List<MessageLine> lines) {
            messages.forEach(this::remove);
            messages.clear();
            messages.addAll(lines);
            lines.forEach(this::add);
        }

        boolean stacked(int width) {
            return width < Theme.STACK_BELOW;
        }

        private int areaX(int width) {
            return stacked(width) ? 0 : Theme.LABEL_COLUMN;
        }

        private int labelHeight() {
            return label.getPreferredSize().height;
        }

        private int controlW(int width) {
            int area = width - areaX(width);
            return Math.max(40, Math.min(controlWidth, area - MARK));
        }

        private int msgW(int width) {
            return Math.max(40, Math.min(Theme.MESSAGE_WIDTH, width - areaX(width)));
        }

        @Override
        public int heightFor(int width) {
            int y = stacked(width) ? labelHeight() + 4 : 0;
            y += Column.height(control, controlW(width));
            for (MessageLine m : messages) {
                y += 4 + m.heightFor(msgW(width));
            }
            if (note.isVisible()) {
                y += 4 + note.heightFor(msgW(width));
            }
            return y;
        }

        @Override
        public void doLayout() {
            int w = getWidth();
            int ax = areaX(w);
            int y = 0;
            int lh = labelHeight();
            if (stacked(w)) {
                label.setBounds(0, 0, w, lh);
                y = lh + 4;
            } else {
                label.setBounds(0, Math.max(0, (Theme.CONTROL_HEIGHT - lh) / 2), Theme.LABEL_COLUMN - 8, lh);
            }
            int cw = controlW(w);
            int ch = Column.height(control, cw);
            control.setBounds(ax, y, cw, ch);
            mark.setBounds(ax + cw + 6, y + Math.max(0, (Math.min(ch, Theme.CONTROL_HEIGHT) - 16) / 2), 16, 16);
            y += ch;
            int mw = msgW(w);
            for (MessageLine m : messages) {
                int h = m.heightFor(mw);
                m.setBounds(ax, y + 4, mw, h);
                y += 4 + h;
            }
            if (note.isVisible()) {
                int h = note.heightFor(mw);
                note.setBounds(ax, y + 4, mw, h);
            }
        }

        @Override
        public Dimension getPreferredSize() {
            int w = getWidth() > 0 ? getWidth() : Theme.FORM_MAX;
            return new Dimension(w, heightFor(w));
        }
    }

    /** Lays children left to right and wraps them inside the width given (checkboxes, a field pair). */
    static final class Flow extends JPanel implements HeightForWidth {
        private final int hgap;
        private final int vgap;

        Flow(int hgap, int vgap) {
            super(null);
            this.hgap = hgap;
            this.vgap = vgap;
            setOpaque(false);
        }

        @Override
        public int heightFor(int width) {
            return place(width, false);
        }

        @Override
        public void doLayout() {
            place(getWidth(), true);
        }

        private int place(int width, boolean apply) {
            int x = 0;
            int y = 0;
            int lineH = 0;
            for (Component c : getComponents()) {
                if (!c.isVisible()) {
                    continue;
                }
                Dimension d = c.getPreferredSize();
                int w = Math.min(d.width, width);
                if (x > 0 && x + w > width) {
                    x = 0;
                    y += lineH + vgap;
                    lineH = 0;
                }
                int h = c instanceof HeightForWidth ? ((HeightForWidth) c).heightFor(w) : d.height;
                if (apply) {
                    c.setBounds(x, y, w, h);
                }
                x += w + hgap;
                lineH = Math.max(lineH, h);
            }
            return y + lineH;
        }

        @Override
        public Dimension getPreferredSize() {
            int w = 0;
            int h = 0;
            for (Component c : getComponents()) {
                if (c.isVisible()) {
                    Dimension d = c.getPreferredSize();
                    w += d.width + hgap;
                    h = Math.max(h, d.height);
                }
            }
            return new Dimension(Math.max(0, w - hgap), h);
        }
    }

    /** A {@link LayoutManager} that gives one child the whole area (a card's content). */
    static final class Fill implements LayoutManager {
        @Override
        public void layoutContainer(Container c) {
            Insets in = c.getInsets();
            for (Component k : c.getComponents()) {
                k.setBounds(in.left, in.top, c.getWidth() - in.left - in.right, c.getHeight() - in.top - in.bottom);
            }
        }

        @Override
        public Dimension preferredLayoutSize(Container c) {
            return c.getComponentCount() == 0 ? new Dimension() : c.getComponent(0).getPreferredSize();
        }

        @Override
        public Dimension minimumLayoutSize(Container c) {
            return new Dimension();
        }

        @Override
        public void addLayoutComponent(String n, Component c) {
        }

        @Override
        public void removeLayoutComponent(Component c) {
        }
    }
}
