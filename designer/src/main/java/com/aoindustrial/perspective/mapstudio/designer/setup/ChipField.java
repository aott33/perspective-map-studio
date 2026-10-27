package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.Insets;
import java.awt.LayoutManager;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;

/**
 * A role picker (epic 2 story 16, fix 16): one chip per role with a remove cross, and under the
 * chips the Designer's own editable dropdown, a plain {@link PickerField}, whose list is the
 * identity provider's roles (owner, 2026-10-27: its arrow matches the other dropdowns). Enter adds
 * what is typed, picking a role adds it, and Backspace in the empty input removes the last chip.
 * A role the provider does not have takes the warning glyph on its chip, a role listed twice the
 * reason glyph. The chips wrap; the field grows in height, never in width.
 */
final class ChipField extends JPanel implements HeightForWidth {

    static final int GAP = 4;

    private final List<String> values = new ArrayList<>();
    private final PickerField input;
    private final JPanel chips = new JPanel(new WrapLayout(4, 3));
    private final Supplier<List<String>> roles;
    private final Runnable onChange;
    private Set<String> unknown = Set.of();
    private boolean editable = true;

    /**
     * @param roles the identity provider's roles; empty while not loaded or when the list failed
     *              (typing still works, no message, as any Ignition dropdown)
     */
    ChipField(Supplier<List<String>> roles, Runnable onChange) {
        super(null);
        this.roles = roles;
        this.onChange = onChange == null ? () -> { } : onChange;
        this.input = new PickerField(this::items, false);
        setOpaque(false);
        chips.setOpaque(false);
        input.onPick(item -> {
            if (!values.contains(item.text())) {
                add(item.text());
            } else {
                input.setText("");
            }
        });
        input.onEnter(this::addTyped);
        input.addEditorKeyListener(new KeyAdapter() {
            @Override
            public void keyPressed(KeyEvent e) {
                if (e.getKeyCode() == KeyEvent.VK_BACK_SPACE && input.text().isEmpty() && !values.isEmpty()
                    && editable) {
                    removeAt(values.size() - 1);
                    e.consume();
                }
            }
        });
        add(chips);
        add(input);
        rebuild();
    }

    private List<PickerField.Item> items() {
        List<PickerField.Item> out = new ArrayList<>();
        List<String> names = roles.get();
        if (names != null) {
            for (String n : names) {
                out.add(PickerField.Item.value(n, values.contains(n) ? SetupForm.msg("setup.list.added") : ""));
            }
        }
        return out;
    }

    void setPlaceholder(String text) {
        input.setPlaceholder(text);
    }

    List<String> values() {
        return List.copyOf(values);
    }

    /** Shows {@code names} without telling the change listener. */
    void fill(List<String> names) {
        values.clear();
        values.addAll(names);
        input.fill("");
        rebuild();
    }

    /** Adds a role as Enter would. */
    void add(String name) {
        String n = name == null ? "" : name.trim();
        if (!n.isEmpty()) {
            values.add(n);
            input.fill("");
            rebuild();
            onChange.run();
        }
    }

    void removeAt(int index) {
        values.remove(index);
        rebuild();
        onChange.run();
        input.labelTarget().requestFocusInWindow();
    }

    void setUnknown(Set<String> names) {
        if (!names.equals(unknown)) {
            unknown = Set.copyOf(names);
            rebuild();
        }
    }

    void setEditable(boolean editable) {
        this.editable = editable;
        input.setEditable(editable);
        input.setVisible(editable);
        rebuild();
    }

    PickerField input() {
        return input;
    }

    JComponent labelTarget() {
        return input.labelTarget();
    }

    private void addTyped() {
        String typed = input.text();
        if (!typed.isEmpty()) {
            add(typed);
        }
    }

    /** The lines the role list shows now (tests read it). */
    List<String> offered() {
        List<String> out = new ArrayList<>();
        for (PickerField.Item i : items()) {
            out.add(i.detail().isEmpty() ? i.text() : i.text() + "  (" + i.detail() + ")");
        }
        return out;
    }

    private void rebuild() {
        chips.removeAll();
        List<Integer> duplicates = new ArrayList<>();
        for (int i = 0; i < values.size(); i++) {
            if (values.subList(0, i).contains(values.get(i))) {
                duplicates.add(i);
            }
        }
        for (int i = 0; i < values.size(); i++) {
            chips.add(chip(i, duplicates.contains(i)));
        }
        chips.setVisible(!values.isEmpty());
        input.refreshItems();
        revalidate();
        repaint();
    }

    private JComponent chip(int index, boolean duplicate) {
        String name = values.get(index);
        boolean warn = !duplicate && unknown.contains(name);
        Color edgeColor = duplicate ? Theme.error() : warn ? Theme.warning() : Theme.border();
        Color fill = duplicate ? Theme.tint(Theme.error(), 0.08, Theme.surface())
            : warn ? Theme.tint(Theme.warning(), 0.10, Theme.surface()) : Theme.tint(Theme.text(), 0.08, Theme.surface());
        JPanel chip = new JPanel(new BorderLayout(4, 0));
        chip.setBackground(fill);
        chip.setBorder(BorderFactory.createCompoundBorder(BorderFactory.createLineBorder(edgeColor),
            BorderFactory.createEmptyBorder(1, 6, 1, 4)));
        JLabel text = new JLabel(name, duplicate ? Theme.Glyph.ERROR : warn ? Theme.Glyph.WARNING : null,
            JLabel.LEADING);
        text.setForeground(duplicate ? Theme.error() : Theme.text());
        chip.add(text, BorderLayout.CENTER);
        if (editable) {
            JButton cross = new JButton("\u00d7");
            cross.setMargin(new Insets(0, 2, 0, 2));
            cross.setBorderPainted(false);
            cross.setContentAreaFilled(false);
            cross.setFocusable(false);
            cross.setToolTipText("Remove " + name);
            cross.getAccessibleContext().setAccessibleName("Remove " + name);
            cross.addActionListener(e -> removeAt(index));
            chip.add(cross, BorderLayout.EAST);
        }
        chip.getAccessibleContext().setAccessibleName(name
            + (duplicate ? ", listed twice" : warn ? ", not a role of the identity provider" : ""));
        return chip;
    }

    /** For tests: the chips as shown, with "!" for a warning chip and "x" for a duplicate. */
    List<String> chipStates() {
        List<String> out = new ArrayList<>();
        for (int i = 0; i < values.size(); i++) {
            String v = values.get(i);
            boolean dup = values.subList(0, i).contains(v);
            out.add(dup ? v + " x" : unknown.contains(v) ? v + " !" : v);
        }
        return out;
    }

    private int chipsHeight(int width) {
        return chips.isVisible() ? ((WrapLayout) chips.getLayout()).heightFor(chips, Math.max(40, width)) : 0;
    }

    private int inputHeight() {
        return input.isVisible() ? input.getPreferredSize().height : 0;
    }

    @Override
    public int heightFor(int width) {
        int c = chipsHeight(width);
        int i = inputHeight();
        return Math.max(Theme.CONTROL_HEIGHT / 2, c + (c > 0 && i > 0 ? GAP : 0) + i);
    }

    @Override
    public void doLayout() {
        int w = getWidth();
        int c = chipsHeight(w);
        chips.setBounds(0, 0, w, c);
        int y = c > 0 ? c + GAP : 0;
        input.setBounds(0, y, Math.min(w, Theme.FIELD), inputHeight());
    }

    @Override
    public Dimension getPreferredSize() {
        int w = getWidth() > 0 ? getWidth() : Theme.CHIP_FIELD;
        return new Dimension(w, heightFor(w));
    }

    /** A flow layout whose height follows the width it is given, so chips wrap inside a fixed width. */
    static final class WrapLayout implements LayoutManager {
        private final int hgap;
        private final int vgap;

        WrapLayout(int hgap, int vgap) {
            this.hgap = hgap;
            this.vgap = vgap;
        }

        int heightFor(Container c, int width) {
            Insets in = c.getInsets();
            int x = 0;
            int lineH = 0;
            int h = 0;
            int avail = Math.max(1, width - in.left - in.right);
            for (Component k : c.getComponents()) {
                if (!k.isVisible()) {
                    continue;
                }
                Dimension d = k.getPreferredSize();
                if (x > 0 && x + d.width > avail) {
                    h += lineH + vgap;
                    x = 0;
                    lineH = 0;
                }
                x += Math.min(d.width, avail) + hgap;
                lineH = Math.max(lineH, d.height);
            }
            return h + lineH + in.top + in.bottom;
        }

        @Override
        public void layoutContainer(Container c) {
            Insets in = c.getInsets();
            int avail = Math.max(1, c.getWidth() - in.left - in.right);
            int x = 0;
            int y = in.top;
            int lineH = 0;
            List<Component> line = new ArrayList<>();
            for (Component k : c.getComponents()) {
                if (!k.isVisible()) {
                    continue;
                }
                Dimension d = k.getPreferredSize();
                if (x > 0 && x + d.width > avail) {
                    y += lineH + vgap;
                    x = 0;
                    lineH = 0;
                    line.clear();
                }
                int w = Math.min(d.width, avail);
                k.setBounds(in.left + x, y, w, d.height);
                x += w + hgap;
                lineH = Math.max(lineH, d.height);
                line.add(k);
            }
        }

        @Override
        public Dimension preferredLayoutSize(Container c) {
            int w = c.getWidth() > 0 ? c.getWidth() : Theme.CHIP_FIELD;
            return new Dimension(w, heightFor(c, w));
        }

        @Override
        public Dimension minimumLayoutSize(Container c) {
            return preferredLayoutSize(c);
        }

        @Override
        public void addLayoutComponent(String name, Component comp) {
        }

        @Override
        public void removeLayoutComponent(Component comp) {
        }
    }
}
