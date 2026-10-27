package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Rectangle;
import java.awt.RenderingHints;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Supplier;

import javax.swing.AbstractListModel;
import javax.swing.ComboBoxModel;
import javax.swing.JComboBox;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JLayer;
import javax.swing.JPanel;
import javax.swing.ListCellRenderer;
import javax.swing.SwingUtilities;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import javax.swing.event.PopupMenuEvent;
import javax.swing.event.PopupMenuListener;
import javax.swing.plaf.LayerUI;
import javax.swing.text.JTextComponent;

/**
 * An editable dropdown (epic 2 story 16, fix 16): a plain editable {@link JComboBox} drawn
 * entirely by the Designer's look and feel, as Project Properties' Default Database (owner,
 * 2026-10-27: "dropdowns use the Designer's own controls"). No UI delegate, arrow button, border
 * or background of ours: the list's lines are the look and feel's renderer, given the words; the
 * placeholder is painted by a {@link JLayer} over the empty editor, which leaves the combo's own
 * painting alone. What is typed is kept; the list only suggests. An action line ("Insert
 * placeholder...") runs when chosen and never becomes the value.
 */
final class PickerField extends JPanel {

    /** One line of the list: a value (with a detail such as the connection type) or an action. */
    record Item(Kind kind, String text, String detail, Runnable action) {
        enum Kind { VALUE, ACTION }

        static Item value(String text, String detail) {
            return new Item(Kind.VALUE, text, detail == null ? "" : detail, null);
        }

        static Item action(String text, Runnable action) {
            return new Item(Kind.ACTION, text, "", action);
        }

        /** What the editor shows when the line is chosen. */
        @Override
        public String toString() {
            return text;
        }

        /** What the list shows. */
        String shown() {
            return detail.isEmpty() ? text : text + "   " + detail;
        }
    }

    private final Supplier<List<Item>> items;
    private final Model model = new Model();
    private final JComboBox<Object> combo = new JComboBox<>(model);
    private final JLayer<JComboBox<Object>> layer;
    private Consumer<Item> onPick = item -> { };
    private Runnable onEnter = () -> { };
    private final List<Runnable> onChange = new ArrayList<>();
    private final List<java.awt.event.KeyListener> editorKeys = new ArrayList<>();
    private String placeholder = "";
    private boolean filling;
    private int width = Theme.FIELD;
    private JTextComponent editorText;
    private final DocumentListener documentListener = new DocumentListener() {
        @Override public void insertUpdate(DocumentEvent e) { changed(); }
        @Override public void removeUpdate(DocumentEvent e) { changed(); }
        @Override public void changedUpdate(DocumentEvent e) { changed(); }
    };

    PickerField(Supplier<List<Item>> items, boolean monospace) {
        super(new BorderLayout());
        this.items = items;
        setOpaque(false);
        combo.setEditable(true);
        if (monospace) {
            combo.setFont(Theme.mono());
        }
        // The look and feel's own renderer draws each line; only its words are ours.
        ListCellRenderer<? super Object> lafRenderer = combo.getRenderer();
        combo.setRenderer((list, value, index, selected, focus) -> {
            Component c = lafRenderer.getListCellRendererComponent(list, value, index, selected, focus);
            if (index >= 0 && value instanceof Item && c instanceof JLabel) {
                ((JLabel) c).setText(((Item) value).shown());
            }
            return c;
        });
        combo.addActionListener(e -> {
            if (filling) {
                return;
            }
            if ("comboBoxEdited".equals(e.getActionCommand())) {
                onEnter.run();
            } else if (combo.getSelectedItem() instanceof Item item && item.kind() == Item.Kind.VALUE) {
                onPick.accept(item);
            }
        });
        combo.addPopupMenuListener(new PopupMenuListener() {
            @Override
            public void popupMenuWillBecomeVisible(PopupMenuEvent e) {
                model.pendingAction = null;
                refreshItems();
            }

            @Override
            public void popupMenuWillBecomeInvisible(PopupMenuEvent e) {
                Item action = model.pendingAction;
                model.pendingAction = null;
                if (action != null && action.action() != null) {
                    SwingUtilities.invokeLater(action.action());
                }
            }

            @Override
            public void popupMenuCanceled(PopupMenuEvent e) {
                model.pendingAction = null;
            }
        });
        // The look and feel makes the editor; a theme change makes a new one.
        combo.addPropertyChangeListener("editor", e -> attachEditor());
        attachEditor();
        layer = new JLayer<>(combo, new Placeholder());
        add(layer, BorderLayout.CENTER);
        refreshItems();
    }

    private void attachEditor() {
        if (editorText != null) {
            editorText.getDocument().removeDocumentListener(documentListener);
            editorKeys.forEach(editorText::removeKeyListener);
        }
        Component c = combo.getEditor() == null ? null : combo.getEditor().getEditorComponent();
        editorText = c instanceof JTextComponent ? (JTextComponent) c : null;
        if (editorText != null) {
            editorText.getDocument().addDocumentListener(documentListener);
            editorKeys.forEach(editorText::addKeyListener);
            if (combo.getFont() != null) {
                editorText.setFont(combo.getFont());
            }
        }
    }

    private void changed() {
        if (!filling) {
            onChange.forEach(Runnable::run);
        }
        layer.repaint();
    }

    void onChange(Runnable r) {
        onChange.add(r);
    }

    void onPick(Consumer<Item> c) {
        onPick = c;
    }

    /** Enter in the editor (or the editor committing its text). */
    void onEnter(Runnable r) {
        onEnter = r == null ? () -> { } : r;
    }

    /** A key listener on the editor, kept across a new editor. */
    void addEditorKeyListener(java.awt.event.KeyListener l) {
        editorKeys.add(l);
        if (editorText != null) {
            editorText.addKeyListener(l);
        }
    }

    String text() {
        if (editorText != null) {
            return editorText.getText().trim();
        }
        Object item = combo.getEditor().getItem();
        return item == null ? "" : item.toString().trim();
    }

    /** Sets the text without telling the change listeners (the form being filled). */
    void fill(String text) {
        filling = true;
        try {
            put(text);
        } finally {
            filling = false;
        }
    }

    /** Sets the text as the user would (listeners told). */
    void setText(String text) {
        put(text);
    }

    private void put(String text) {
        String t = text == null ? "" : text;
        // The look and feel's editor follows the selection; the text is then set as well, in case
        // the selection was already this text while the editor showed something else.
        model.setSelectedItem(t);
        if (editorText != null) {
            if (!editorText.getText().equals(t)) {
                editorText.setText(t);
            }
        } else {
            combo.getEditor().setItem(t);
        }
    }

    /** The editor's text field (the alarm page inserts placeholders at its caret). */
    JTextComponent textField() {
        return editorText;
    }

    void setPlaceholder(String text) {
        String t = text == null ? "" : text;
        if (!t.equals(placeholder)) {
            placeholder = t;
            layer.repaint();
        }
    }

    String placeholder() {
        return placeholder;
    }

    void setEditable(boolean editable) {
        combo.setEnabled(editable);
    }

    /** The list as it opens now (tests read it; the combo shows it). */
    List<Item> offered() {
        return List.copyOf(items.get());
    }

    /** Reads the list again when it changed; what is typed is kept. */
    void refreshItems() {
        List<Item> now = items.get();
        if (!sameLines(now, model.items)) {
            // The look and feel puts the selection back in the editor when the list changes: make
            // the selection what is typed first, so the editor keeps it untouched.
            String typed = editorText != null ? editorText.getText() : text();
            model.selectQuietly(typed);
            model.setItems(now);
        }
    }

    /** Same lines on screen (an action's Runnable is a new object on every read). */
    private static boolean sameLines(List<Item> a, List<Item> b) {
        if (a.size() != b.size()) {
            return false;
        }
        for (int i = 0; i < a.size(); i++) {
            Item x = a.get(i);
            Item y = b.get(i);
            if (x.kind() != y.kind() || !x.text().equals(y.text()) || !x.detail().equals(y.detail())) {
                return false;
            }
        }
        return true;
    }

    /** Picks an item as a click would: a value becomes the text, an action runs. */
    void pick(Item item) {
        if (item.kind() == Item.Kind.VALUE) {
            setText(item.text());
            onPick.accept(item);
        } else if (item.action() != null) {
            item.action().run();
        }
    }

    /** The component a label is bound to: the combo, as on any Designer form. */
    JComponent labelTarget() {
        return combo;
    }

    JComboBox<Object> combo() {
        return combo;
    }

    /** The width the form gives the field; the height is the look and feel's. */
    void setFieldWidth(int w) {
        width = w;
        revalidate();
    }

    @Override
    public Dimension getPreferredSize() {
        return new Dimension(width, combo.getPreferredSize().height);
    }

    @Override
    public Dimension getMaximumSize() {
        return getPreferredSize();
    }

    /**
     * The combo's list and selection. An action line is never selected: choosing it (a click, or
     * Enter on it) runs it once the list closes, and Escape drops it.
     */
    private static final class Model extends AbstractListModel<Object> implements ComboBoxModel<Object> {
        private List<Item> items = List.of();
        private Object selected;
        private Item pendingAction;

        /** Makes {@code typed} the selection without telling anyone (it is already in the editor). */
        void selectQuietly(String typed) {
            if (selected == null || !selected.toString().equals(typed)) {
                selected = typed;
            }
        }

        void setItems(List<Item> now) {
            int old = items.size();
            items = List.copyOf(now);
            if (old > 0) {
                fireIntervalRemoved(this, 0, old - 1);
            }
            if (!items.isEmpty()) {
                fireIntervalAdded(this, 0, items.size() - 1);
            }
        }

        @Override
        public int getSize() {
            return items.size();
        }

        @Override
        public Object getElementAt(int index) {
            return items.get(index);
        }

        @Override
        public void setSelectedItem(Object item) {
            if (item instanceof Item i && i.kind() == Item.Kind.ACTION) {
                pendingAction = i;
                return;
            }
            pendingAction = null;
            if (item == null ? selected != null : !item.equals(selected)) {
                selected = item;
                fireContentsChanged(this, -1, -1);
            }
        }

        @Override
        public Object getSelectedItem() {
            return selected;
        }
    }

    /** Paints the placeholder over the empty editor, in the secondary text colour. */
    private final class Placeholder extends LayerUI<JComboBox<Object>> {
        @Override
        public void paint(Graphics g, JComponent c) {
            super.paint(g, c);
            if (placeholder.isEmpty() || editorText == null || !combo.isEnabled()
                || !editorText.getText().isEmpty()) {
                return;
            }
            Rectangle r = SwingUtilities.convertRectangle(editorText.getParent(), editorText.getBounds(), c);
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g2.setColor(Theme.secondary());
            g2.setFont(editorText.getFont());
            g2.clipRect(r.x, r.y, r.width, r.height);
            FontMetrics fm = g2.getFontMetrics();
            int x = r.x + editorText.getInsets().left + (editorText.getMargin() == null ? 0 : editorText.getMargin().left);
            int y = r.y + (r.height - fm.getHeight()) / 2 + fm.getAscent();
            g2.drawString(placeholder, x, y);
            g2.dispose();
        }
    }
}
