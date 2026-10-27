package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.FlowLayout;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BooleanSupplier;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.UIManager;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import javax.swing.text.JTextComponent;

/**
 * The setup form in Swing (epic 2 story 7): a field for every setup v1 key, the
 * reasons under each field updated as the user types, and a banner for a read-only
 * setup (newer schema, unreadable file, inherited and not overridable). Used by
 * {@link SetupEditor} in the workspace and by the "Create setup" dialog.
 *
 * <p>Swing layout and colours are not seen in a Designer yet [not verified].
 */
public final class SetupPanel extends JPanel {

    private final Map<String, JTextComponent> inputs = new LinkedHashMap<>();
    private final Map<String, JLabel> reasonLabels = new LinkedHashMap<>();
    private final JLabel banner = new JLabel();
    private final JLabel general = new JLabel();
    private final JButton startFromDefaults = new JButton(SetupForm.msg("setup.state.startFromDefaults"));
    private final JTextField schemaVersion = new JTextField(4);
    private final Runnable onEdit;
    private final BooleanSupplier confirmStartFromDefaults;

    private SetupForm base = SetupForm.defaults();
    private boolean locked;
    private boolean filling;

    /** @param onEdit called on the Swing thread after every change the user makes */
    public SetupPanel(Runnable onEdit) {
        this(onEdit, null);
    }

    /**
     * @param onEdit called on the Swing thread after every change the user makes
     * @param confirmStartFromDefaults asks before "Start from defaults" replaces the form; null for the dialog
     */
    SetupPanel(Runnable onEdit, BooleanSupplier confirmStartFromDefaults) {
        super(new BorderLayout());
        this.onEdit = onEdit == null ? () -> { } : onEdit;
        this.confirmStartFromDefaults = confirmStartFromDefaults != null ? confirmStartFromDefaults
            : () -> JOptionPane.showConfirmDialog(this, SetupForm.msg("setup.state.startFromDefaults.confirm"),
                SetupForm.msg("setup.state.startFromDefaults"), JOptionPane.OK_CANCEL_OPTION) == JOptionPane.OK_OPTION;

        JPanel top = new JPanel(new BorderLayout());
        JPanel bannerRow = new JPanel(new FlowLayout(FlowLayout.LEFT));
        bannerRow.add(banner);
        bannerRow.add(startFromDefaults);
        top.add(bannerRow, BorderLayout.NORTH);
        top.add(general, BorderLayout.SOUTH);
        general.setForeground(reasonColour());
        startFromDefaults.addActionListener(e -> askStartFromDefaults());

        JPanel form = new JPanel(new GridBagLayout());
        form.setBorder(BorderFactory.createEmptyBorder(8, 8, 8, 8));
        int row = 0;
        schemaVersion.setEditable(false);
        row = addRow(form, row, "schemaVersion", schemaVersion, null);
        for (String field : SetupForm.FIELDS) {
            JTextComponent input = isList(field) ? new JTextArea(3, 30) : new JTextField(30);
            inputs.put(field, input);
            input.getDocument().addDocumentListener(new DocumentListener() {
                @Override public void insertUpdate(DocumentEvent e) { edited(); }
                @Override public void removeUpdate(DocumentEvent e) { edited(); }
                @Override public void changedUpdate(DocumentEvent e) { edited(); }
            });
            JLabel reason = new JLabel();
            reason.setForeground(reasonColour());
            reasonLabels.put(field, reason);
            JComponent shown = input instanceof JTextArea ? new JScrollPane(input) : input;
            row = addRow(form, row, field, shown, reason);
        }
        GridBagConstraints filler = new GridBagConstraints();
        filler.gridy = row;
        filler.weighty = 1;
        form.add(new JPanel(), filler);

        add(top, BorderLayout.NORTH);
        add(new JScrollPane(form), BorderLayout.CENTER);
        show(SetupForm.defaults(), false, "");
    }

    private static boolean isList(String field) {
        return field.equals(SetupForm.FULL_ROLES) || field.equals(SetupForm.PHONE_ROLES)
            || field.equals(SetupForm.BASEMAPS);
    }

    private static Color reasonColour() {
        Color c = UIManager.getColor("Component.error.focusedBorderColor");
        return c != null ? c : new Color(0xB0, 0x00, 0x20);
    }

    private static int addRow(JPanel form, int row, String field, JComponent input, JLabel reason) {
        GridBagConstraints label = new GridBagConstraints();
        label.gridx = 0;
        label.gridy = row;
        label.anchor = GridBagConstraints.NORTHWEST;
        label.insets = new Insets(6, 0, 0, 12);
        form.add(new JLabel(SetupForm.msg("setup.label." + field)), label);
        GridBagConstraints value = new GridBagConstraints();
        value.gridx = 1;
        value.gridy = row;
        value.weightx = 1;
        value.fill = GridBagConstraints.HORIZONTAL;
        value.insets = new Insets(4, 0, 0, 0);
        form.add(input, value);
        if (reason == null) {
            return row + 1;
        }
        GridBagConstraints under = new GridBagConstraints();
        under.gridx = 1;
        under.gridy = row + 1;
        under.anchor = GridBagConstraints.WEST;
        form.add(reason, under);
        return row + 2;
    }

    /**
     * Shows a setup.
     *
     * @param form the setup read from the project
     * @param lockedByProject true when the project may not change it (inherited, not overridable)
     * @param note a line shown above the form (for example "Inherited from ..."), or empty
     */
    public void show(SetupForm form, boolean lockedByProject, String note) {
        this.base = form;
        this.locked = lockedByProject || !form.isEditable();
        filling = true;
        try {
            schemaVersion.setText(form.schemaVersion());
            for (String field : SetupForm.FIELDS) {
                JTextComponent input = inputs.get(field);
                input.setText(form.isEditable() ? valueOf(form, field) : "");
                input.setEditable(!locked);
            }
        } finally {
            filling = false;
        }
        String bannerText = !form.isEditable() ? form.stateReason() : note;
        banner.setText(bannerText == null || bannerText.isEmpty() ? "" : html(bannerText));
        banner.setVisible(!banner.getText().isEmpty());
        startFromDefaults.setVisible(form.state() == SetupForm.State.UNREADABLE && !lockedByProject);
        showReasons(form.isEditable() ? current().reasons() : Map.of());
    }

    private static String valueOf(SetupForm form, String field) {
        return isList(field) ? String.join("\n", form.list(field)) : form.text(field);
    }

    /** The setup as the fields now hold it; a read-only setup comes back unchanged. */
    public SetupForm current() {
        if (!base.isEditable()) {
            return base;
        }
        SetupForm form = base.copy();
        for (String field : SetupForm.FIELDS) {
            String value = inputs.get(field).getText();
            if (isList(field)) {
                form.setList(field, SetupForm.lines(value));
            } else {
                form.setText(field, value);
            }
        }
        return form;
    }

    public boolean isLocked() {
        return locked;
    }

    private void edited() {
        if (filling) {
            return;
        }
        showReasons(current().reasons());
        onEdit.run();
    }

    private void showReasons(Map<String, List<String>> reasons) {
        for (Map.Entry<String, JLabel> e : reasonLabels.entrySet()) {
            List<String> r = reasons.get(e.getKey());
            e.getValue().setText(r == null ? " " : html(String.join(" ", r)));
        }
        List<String> g = reasons.get(SetupForm.GENERAL);
        general.setText(g == null || !base.isEditable() ? "" : html(String.join(" ", g)));
    }

    private void askStartFromDefaults() {
        if (confirmStartFromDefaults.getAsBoolean()) {
            show(SetupForm.defaults(), false, "");
            onEdit.run();
        }
    }

    /** For tests: the input of a field. */
    JTextComponent input(String field) {
        return inputs.get(field);
    }

    /** For tests: the reason line under a field, as shown. */
    String reasonText(String field) {
        return reasonLabels.get(field).getText();
    }

    /** For tests: the banner line, as shown (empty when hidden). */
    String bannerText() {
        return banner.isVisible() ? banner.getText() : "";
    }

    /** For tests: presses "Start from defaults". */
    void pressStartFromDefaults() {
        startFromDefaults.doClick();
    }

    /** For tests: whether "Start from defaults" is offered. */
    boolean offersStartFromDefaults() {
        return startFromDefaults.isVisible();
    }

    private static String html(String text) {
        return "<html>" + text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;") + "</html>";
    }
}
