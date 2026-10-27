package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Insets;
import java.awt.LayoutManager;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.function.Supplier;

import javax.swing.BorderFactory;
import javax.swing.DefaultListCellRenderer;
import javax.swing.DefaultListModel;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.JScrollPane;
import javax.swing.JTextField;
import javax.swing.ListSelectionModel;
import javax.swing.plaf.basic.BasicArrowButton;

/**
 * A role picker (epic 2 story 16): one chip per role with a remove cross, an "Add a role..."
 * input and a chevron that opens the identity provider's roles. Enter adds the highlighted role or
 * the typed text; Backspace in the empty input removes the last chip. A role the provider does not
 * have takes the warning edge and glyph, a role listed twice the reason edge and glyph. The
 * chips wrap; the field grows in height, never in width.
 */
final class ChipField extends JPanel implements HeightForWidth {

    /** What the role list shows: the roles, or a note when it has none to show. */
    record Roles(List<String> names, String note, String header) {
    }

    private final List<String> values = new ArrayList<>();
    private final JTextField input = new JTextField(10);
    private final JButton chevron = new BasicArrowButton(BasicArrowButton.SOUTH);
    private final JPanel chips = new JPanel(new WrapLayout(4, 3));
    private final Supplier<Roles> roles;
    private final Runnable onChange;
    private Set<String> unknown = Set.of();
    private boolean editable = true;
    private PickerField.Edge edge = PickerField.Edge.NONE;
    private String placeholder = "";

    ChipField(Supplier<Roles> roles, Runnable onChange) {
        super(new BorderLayout());
        this.roles = roles;
        this.onChange = onChange == null ? () -> { } : onChange;
        setOpaque(false);
        chips.setOpaque(false);
        chips.setBorder(BorderFactory.createEmptyBorder(2, 4, 2, 2));
        input.setBorder(BorderFactory.createEmptyBorder(2, 4, 2, 4));
        input.setOpaque(false);
        input.addKeyListener(new KeyAdapter() {
            @Override
            public void keyPressed(KeyEvent e) {
                if (e.getKeyCode() == KeyEvent.VK_ENTER) {
                    addTyped();
                    e.consume();
                } else if (e.getKeyCode() == KeyEvent.VK_BACK_SPACE && input.getText().isEmpty() && !values.isEmpty()) {
                    removeAt(values.size() - 1);
                    e.consume();
                } else if (e.getKeyCode() == KeyEvent.VK_DOWN) {
                    openList();
                    e.consume();
                }
            }
        });
        input.addFocusListener(new FocusAdapter() {
            @Override
            public void focusLost(FocusEvent e) {
                if (!e.isTemporary() && !input.getText().isBlank()) {
                    addTyped();
                }
            }
        });
        chevron.setFocusable(false);
        chevron.setPreferredSize(new Dimension(26, Theme.CONTROL_HEIGHT));
        chevron.addActionListener(e -> openList());
        JPanel box = new JPanel(new BorderLayout()) {
            @Override
            protected void paintComponent(Graphics g) {
                g.setColor(editable ? Theme.surface() : Theme.panel());
                g.fillRect(0, 0, getWidth(), getHeight());
            }
        };
        box.setOpaque(false);
        box.add(chips, BorderLayout.CENTER);
        JPanel east = new JPanel(new BorderLayout());
        east.setOpaque(false);
        east.add(chevron, BorderLayout.NORTH);
        box.add(east, BorderLayout.EAST);
        add(box, BorderLayout.CENTER);
        updateBorder();
        rebuild();
    }

    void setPlaceholder(String text) {
        placeholder = text == null ? "" : text;
        input.repaint();
    }

    List<String> values() {
        return List.copyOf(values);
    }

    /** Shows {@code names} without telling the change listener. */
    void fill(List<String> names) {
        values.clear();
        values.addAll(names);
        input.setText("");
        rebuild();
    }

    /** Adds a role as Enter would. */
    void add(String name) {
        String n = name == null ? "" : name.trim();
        if (!n.isEmpty()) {
            values.add(n);
            input.setText("");
            rebuild();
            onChange.run();
        }
    }

    void removeAt(int index) {
        values.remove(index);
        rebuild();
        onChange.run();
        input.requestFocusInWindow();
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
        input.setFocusable(editable);
        input.setVisible(editable);
        chevron.setEnabled(editable);
        rebuild();
    }

    void setEdge(PickerField.Edge e) {
        if (e != edge) {
            edge = e;
            updateBorder();
        }
    }

    PickerField.Edge edge() {
        return edge;
    }

    JTextField input() {
        return input;
    }

    JComponent labelTarget() {
        return input;
    }

    private void updateBorder() {
        Color c = switch (edge) {
            case WARNING -> Theme.warning();
            case REASON -> Theme.error();
            default -> Theme.border();
        };
        setBorder(BorderFactory.createLineBorder(c));
    }

    private void addTyped() {
        String typed = input.getText().trim();
        if (typed.isEmpty()) {
            return;
        }
        // Enter in the input adds what is typed; the open list adds its highlighted role instead.
        add(typed);
    }

    private List<String> matches(String typed) {
        List<String> out = new ArrayList<>();
        Roles r = roles.get();
        if (r.names() != null) {
            for (String n : r.names()) {
                if (n.toLowerCase(Locale.ROOT).contains(typed.toLowerCase(Locale.ROOT))) {
                    out.add(n);
                }
            }
        }
        return out;
    }

    /** The lines the role list would show now (tests read it). */
    List<String> offered() {
        Roles r = roles.get();
        List<String> out = new ArrayList<>();
        if (r.names() == null) {
            out.add(r.note());
            return out;
        }
        String typed = input.getText().trim();
        for (String n : typed.isEmpty() ? r.names() : matches(typed)) {
            out.add(values.contains(n) ? n + "  (" + SetupForm.msg("setup.list.added") + ")" : n);
        }
        if (out.isEmpty()) {
            out.add(r.note() == null || r.note().isEmpty() ? SetupForm.msg("setup.list.empty") : r.note());
        }
        return out;
    }

    private void openList() {
        if (!editable || !isShowing()) {
            return;
        }
        Roles r = roles.get();
        DefaultListModel<String> model = new DefaultListModel<>();
        List<String> names = new ArrayList<>();
        if (r.names() != null) {
            String typed = input.getText().trim();
            names.addAll(typed.isEmpty() ? r.names() : matches(typed));
        }
        names.forEach(model::addElement);
        JList<String> view = new JList<>(model);
        view.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        view.setCellRenderer(new DefaultListCellRenderer() {
            @Override
            public Component getListCellRendererComponent(JList<?> l, Object v, int i, boolean s, boolean f) {
                boolean added = values.contains(v);
                JLabel c = (JLabel) super.getListCellRendererComponent(l,
                    added ? "\u2713 " + v + "   " + SetupForm.msg("setup.list.added") : "    " + v, i, s, f);
                c.setBorder(BorderFactory.createEmptyBorder(3, 8, 3, 8));
                if (added && !s) {
                    c.setForeground(Theme.secondary());
                }
                return c;
            }
        });
        JPopupMenu popup = new JPopupMenu();
        popup.setLayout(new BorderLayout());
        if (r.header() != null && !r.header().isEmpty()) {
            JLabel head = new JLabel(r.header());
            head.setFont(Theme.small());
            head.setForeground(Theme.secondary());
            head.setBorder(BorderFactory.createEmptyBorder(4, 8, 4, 8));
            popup.add(head, BorderLayout.NORTH);
        }
        JScrollPane scroll = new JScrollPane(view);
        scroll.setBorder(BorderFactory.createEmptyBorder());
        scroll.setPreferredSize(new Dimension(getWidth(), Math.min(220, Math.max(28, names.size() * 24 + 6))));
        if (!names.isEmpty()) {
            popup.add(scroll, BorderLayout.CENTER);
        }
        JLabel foot = new JLabel(r.names() == null ? r.note() : SetupForm.msg("setup.list.typeNew"));
        foot.setFont(Theme.small().deriveFont(Font.ITALIC));
        foot.setForeground(Theme.secondary());
        foot.setBorder(BorderFactory.createEmptyBorder(4, 8, 4, 8));
        popup.add(foot, BorderLayout.SOUTH);
        Runnable choose = () -> {
            String v = view.getSelectedValue();
            if (v != null && !values.contains(v)) {
                popup.setVisible(false);
                add(v);
                input.requestFocusInWindow();
            }
        };
        view.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                choose.run();
            }
        });
        view.addKeyListener(new KeyAdapter() {
            @Override
            public void keyPressed(KeyEvent e) {
                if (e.getKeyCode() == KeyEvent.VK_ENTER) {
                    choose.run();
                }
            }
        });
        popup.show(this, 0, getHeight());
        for (int i = 0; i < names.size(); i++) {
            if (!values.contains(names.get(i))) {
                view.setSelectedIndex(i);
                break;
            }
        }
        view.requestFocusInWindow();
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
        chips.add(input);
        input.setColumns(values.isEmpty() ? 14 : 8);
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

    @Override
    public int heightFor(int width) {
        int inner = Math.max(40, width - 2 - 26);
        return Math.max(Theme.CONTROL_HEIGHT, ((WrapLayout) chips.getLayout()).heightFor(chips, inner) + 2);
    }

    @Override
    public Dimension getPreferredSize() {
        int w = Theme.CHIP_FIELD;
        return new Dimension(w, heightFor(w));
    }

    @Override
    protected void paintChildren(Graphics g) {
        super.paintChildren(g);
        if (editable && input.getText().isEmpty() && !placeholder.isEmpty()) {
            java.awt.Point p = javax.swing.SwingUtilities.convertPoint(input, 0, 0, this);
            java.awt.Graphics2D g2 = (java.awt.Graphics2D) g.create();
            g2.setRenderingHint(java.awt.RenderingHints.KEY_TEXT_ANTIALIASING,
                java.awt.RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g2.setColor(Theme.secondary());
            g2.setFont(Theme.font());
            java.awt.FontMetrics fm = g2.getFontMetrics();
            g2.drawString(placeholder, p.x + 4, p.y + (input.getHeight() - fm.getHeight()) / 2 + fm.getAscent());
            g2.dispose();
        }
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
                // The input takes the rest of its line.
                if (k instanceof JTextField) {
                    w = Math.max(w, avail - x);
                }
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
