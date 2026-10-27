package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.event.InputEvent;
import java.awt.event.KeyEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.function.Consumer;
import java.util.function.Supplier;

import javax.swing.AbstractAction;
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
import javax.swing.KeyStroke;
import javax.swing.ListSelectionModel;
import javax.swing.border.Border;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import javax.swing.plaf.basic.BasicArrowButton;

/**
 * An editable picker (epic 2 story 16): a text field that keeps what is typed, and a chevron
 * (or Alt+Down, or Down) that opens a list of suggestions. The list may hold notes ("Loading...",
 * "List unavailable") and actions ("Insert placeholder..."), which never become the value.
 */
final class PickerField extends JPanel {

    /** One line of the list. */
    record Item(Kind kind, String text, String detail, Runnable action) {
        enum Kind { VALUE, NOTE, ACTION }

        static Item value(String text, String detail) {
            return new Item(Kind.VALUE, text, detail == null ? "" : detail, null);
        }

        static Item note(String text) {
            return new Item(Kind.NOTE, text, "", null);
        }

        static Item action(String text, Runnable action) {
            return new Item(Kind.ACTION, text, "", action);
        }
    }

    private final JTextField field = new JTextField();
    private final JButton chevron = new BasicArrowButton(BasicArrowButton.SOUTH);
    private final Supplier<List<Item>> items;
    private Consumer<Item> onPick = item -> { };
    private final List<Runnable> onChange = new ArrayList<>();
    private String placeholder = "";
    private boolean filling;
    private Edge edge = Edge.NONE;

    /** The field's edge: none, the warning colour or the reason colour. */
    enum Edge { NONE, WARNING, REASON }

    PickerField(Supplier<List<Item>> items, boolean monospace) {
        super(new BorderLayout());
        this.items = items;
        setOpaque(false);
        field.setBorder(BorderFactory.createEmptyBorder(3, 8, 3, 4));
        field.setOpaque(false);
        if (monospace) {
            field.setFont(Theme.mono());
        }
        chevron.setFocusable(false);
        chevron.setPreferredSize(new Dimension(26, Theme.CONTROL_HEIGHT));
        chevron.addActionListener(e -> openList());
        JPanel box = new JPanel(new BorderLayout()) {
            @Override
            protected void paintComponent(java.awt.Graphics g) {
                g.setColor(field.isEditable() ? Theme.surface() : Theme.panel());
                g.fillRect(0, 0, getWidth(), getHeight());
                super.paintComponent(g);
            }
        };
        box.setOpaque(false);
        box.add(field, BorderLayout.CENTER);
        box.add(chevron, BorderLayout.EAST);
        add(box, BorderLayout.CENTER);
        updateBorder();
        field.addFocusListener(new java.awt.event.FocusAdapter() {
            @Override
            public void focusGained(java.awt.event.FocusEvent e) {
                updateBorder();
            }

            @Override
            public void focusLost(java.awt.event.FocusEvent e) {
                updateBorder();
            }
        });
        field.getDocument().addDocumentListener(new DocumentListener() {
            @Override public void insertUpdate(DocumentEvent e) { changed(); }
            @Override public void removeUpdate(DocumentEvent e) { changed(); }
            @Override public void changedUpdate(DocumentEvent e) { changed(); }
        });
        field.getInputMap().put(KeyStroke.getKeyStroke(KeyEvent.VK_DOWN, InputEvent.ALT_DOWN_MASK), "mapstudio-open");
        field.getInputMap().put(KeyStroke.getKeyStroke(KeyEvent.VK_DOWN, 0), "mapstudio-open");
        field.getActionMap().put("mapstudio-open", new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                openList();
            }
        });
        setPreferredSize(new Dimension(Theme.FIELD, Theme.CONTROL_HEIGHT));
        setMaximumSize(new Dimension(Theme.FIELD, Theme.CONTROL_HEIGHT));
    }

    private void changed() {
        if (!filling) {
            onChange.forEach(Runnable::run);
        }
        repaint();
    }

    void onChange(Runnable r) {
        onChange.add(r);
    }

    void onPick(Consumer<Item> c) {
        onPick = c;
    }

    String text() {
        return field.getText().trim();
    }

    /** Sets the text without telling the change listeners (the form being filled). */
    void fill(String text) {
        filling = true;
        try {
            field.setText(text == null ? "" : text);
        } finally {
            filling = false;
        }
    }

    /** Sets the text as the user would (listeners told). */
    void setText(String text) {
        field.setText(text == null ? "" : text);
    }

    JTextField textField() {
        return field;
    }

    void setPlaceholder(String text) {
        placeholder = text == null ? "" : text;
        field.repaint();
    }

    String placeholder() {
        return placeholder;
    }

    void setEditable(boolean editable) {
        field.setEditable(editable);
        field.setFocusable(editable);
        chevron.setEnabled(editable);
        repaint();
    }

    void setEdge(Edge e) {
        if (e != edge) {
            edge = e;
            updateBorder();
        }
    }

    Edge edge() {
        return edge;
    }

    private void updateBorder() {
        Color c = switch (edge) {
            case WARNING -> Theme.warning();
            case REASON -> Theme.error();
            default -> field.isFocusOwner() ? Theme.accent() : Theme.border();
        };
        Border b = BorderFactory.createLineBorder(c);
        setBorder(b);
    }

    /** The list as it would open now (tests read it; the popup shows it). */
    List<Item> offered() {
        List<Item> all = items.get();
        String typed = text().toLowerCase(Locale.ROOT);
        boolean exact = all.stream().anyMatch(i -> i.kind() == Item.Kind.VALUE && i.text().equalsIgnoreCase(text()));
        if (typed.isEmpty() || exact) {
            return all;
        }
        List<Item> out = new ArrayList<>();
        for (Item i : all) {
            if (i.kind() != Item.Kind.VALUE || i.text().toLowerCase(Locale.ROOT).contains(typed)) {
                out.add(i);
            }
        }
        // Nothing matches: show the whole list rather than an empty one.
        return out.stream().anyMatch(i -> i.kind() == Item.Kind.VALUE) ? out : all;
    }

    /** Picks an item as a click would: a value becomes the text, an action runs, a note does nothing. */
    void pick(Item item) {
        if (item.kind() == Item.Kind.VALUE) {
            setText(item.text());
            onPick.accept(item);
        } else if (item.kind() == Item.Kind.ACTION && item.action() != null) {
            item.action().run();
        }
        field.requestFocusInWindow();
    }

    void openList() {
        if (!field.isEditable() || !isShowing()) {
            return;
        }
        List<Item> list = offered();
        DefaultListModel<Item> model = new DefaultListModel<>();
        list.forEach(model::addElement);
        JList<Item> view = new JList<>(model);
        view.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        view.setCellRenderer(new DefaultListCellRenderer() {
            @Override
            public Component getListCellRendererComponent(JList<?> l, Object value, int index, boolean selected,
                                                          boolean focus) {
                Item item = (Item) value;
                String shown = item.detail().isEmpty() ? item.text()
                    : item.text() + "   " + item.detail();
                JLabel c = (JLabel) super.getListCellRendererComponent(l, shown, index,
                    selected && item.kind() != Item.Kind.NOTE, focus);
                c.setBorder(BorderFactory.createEmptyBorder(3, 8, 3, 8));
                if (item.kind() == Item.Kind.NOTE) {
                    c.setForeground(Theme.secondary());
                    c.setFont(c.getFont().deriveFont(Font.ITALIC));
                } else if (item.kind() == Item.Kind.ACTION) {
                    c.setForeground(selected ? c.getForeground() : Theme.accent());
                }
                return c;
            }
        });
        for (int i = 0; i < list.size(); i++) {
            if (list.get(i).kind() == Item.Kind.VALUE && list.get(i).text().equals(text())) {
                view.setSelectedIndex(i);
            }
        }
        JPopupMenu popup = new JPopupMenu();
        popup.setLayout(new BorderLayout());
        JScrollPane scroll = new JScrollPane(view);
        scroll.setBorder(BorderFactory.createEmptyBorder());
        scroll.setPreferredSize(new Dimension(getWidth(), Math.min(240, Math.max(28, list.size() * 24 + 6))));
        popup.add(scroll, BorderLayout.CENTER);
        Runnable choose = () -> {
            Item item = view.getSelectedValue();
            if (item != null && item.kind() != Item.Kind.NOTE) {
                popup.setVisible(false);
                pick(item);
            }
        };
        view.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                choose.run();
            }
        });
        view.getInputMap().put(KeyStroke.getKeyStroke(KeyEvent.VK_ENTER, 0), "mapstudio-choose");
        view.getActionMap().put("mapstudio-choose", new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                choose.run();
            }
        });
        popup.show(this, 0, getHeight());
        view.requestFocusInWindow();
        if (view.getSelectedIndex() < 0 && !list.isEmpty()) {
            view.setSelectedIndex(0);
        }
    }

    /** The component a label is bound to. */
    JComponent labelTarget() {
        return field;
    }

    @Override
    protected void paintChildren(java.awt.Graphics g) {
        super.paintChildren(g);
        if (field.getText().isEmpty() && !placeholder.isEmpty()) {
            java.awt.Graphics2D g2 = (java.awt.Graphics2D) g.create();
            g2.setRenderingHint(java.awt.RenderingHints.KEY_TEXT_ANTIALIASING,
                java.awt.RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g2.setColor(Theme.secondary());
            g2.setFont(Theme.font());
            java.awt.FontMetrics fm = g2.getFontMetrics();
            int y = (getHeight() - fm.getHeight()) / 2 + fm.getAscent();
            g2.drawString(placeholder, 9, y);
            g2.dispose();
        }
    }
}
