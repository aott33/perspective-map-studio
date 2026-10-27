package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.Graphics;
import java.awt.Rectangle;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.BooleanSupplier;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.JScrollPane;
import javax.swing.JSpinner;
import javax.swing.JFormattedTextField;
import javax.swing.JTextArea;
import javax.swing.ScrollPaneConstants;
import javax.swing.SpinnerNumberModel;
import javax.swing.SwingUtilities;
import javax.swing.Timer;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import javax.swing.text.JTextComponent;

import com.inductiveautomation.ignition.common.util.LoggerEx;

import com.aoindustrial.perspective.mapstudio.common.contract.Placeholders;
import com.aoindustrial.perspective.mapstudio.common.contract.SetupLists;

/**
 * The Map Studio Setup tab's form (epic 2 stories 7 and 16), drawn to the approved mockup
 * ({@code ux-map-studio/mockups/designer-setup-form.html}) with the owner's quiet-form decisions
 * of 2026-10-27: a header with "Refresh lists" and the schema version as text; the four sections
 * Map store, Who can edit, Kinds and assets, Map; at most 760 px wide, left aligned, wrapping, no
 * horizontal scroll bar; help in each label's tooltip, the one visible note under Map token; a
 * mark only for a warning or a reason; a footer only when it has something to say. The empty
 * state ("No Map Studio setup", Create setup) and a new setup ("New setup - saves with the
 * project", Discard new setup) are the same tab and the same form.
 *
 * <p>The form owns no setup rule: reasons are {@link SetupForm#reasons()}, warnings
 * {@link SetupForm#warnings(FormLists)} from the lists that loaded. Gateway lists load off the
 * Swing thread ({@link SetupListSource.Async}); every list is a suggestion and typing always
 * works. A reason is never repeated in a dialog. Fix 16 (owner, Designer 2026-10-27): the
 * dropdowns and the refresh spinner are the Designer's own {@link javax.swing.JComboBox} and
 * {@link JSpinner}, drawn by its look and feel with nothing of ours over their UI, border or
 * background; a Gateway list that fails stays empty and typing still works, with no message (the
 * Designer already shows when it has no Gateway); the footer's reason count is plain text.
 */
public final class SetupPanel extends JPanel {

    private static final LoggerEx LOG = LoggerEx.newBuilder().build("MapStudio.designer");

    /** What the tab shows. */
    public enum Mode {
        /** No setup in the project: the empty state with Create setup. */
        EMPTY,
        /** Create setup pressed: the form with the defaults, not in the project until File > Save. */
        NEW,
        /** The project's setup, editable. */
        EDIT,
        /** Inherited and not overridable: values shown, nothing editable. */
        LOCKED,
        /** Newer schema or unreadable: setup.json as written, read only. */
        RAW
    }

    private static final List<String> BASEMAPS = List.of("none", "osm", "satellite", "mapbox");

    private final SetupListSource source;
    private final SetupListSource.Async async;
    private final BooleanSupplier confirmStartFromDefaults;
    private final Runnable onEdit;
    private Runnable onCreate = () -> { };
    private Runnable onDiscard = () -> { };

    private SetupForm base = SetupForm.defaults();
    private Mode mode = Mode.EDIT;
    private FormLists lists = FormLists.none();
    private int generation;
    private boolean filling;
    private Map<String, List<String>> shownReasons = Map.of();
    private Map<String, List<String>> shownWarnings = Map.of();
    private final List<String> basemapValues = new ArrayList<>();

    // Header
    private final FormParts.Column header = new FormParts.Column(Theme.FORM_MAX, Theme.TAB_PADDING, 16, 0);
    private final JLabel title = new JLabel(SetupForm.msg("setup.title"));
    private final JButton refreshLink = FormParts.link(SetupForm.msg("setup.refreshLists"), Theme.accent(), false);
    private final JLabel schema = new JLabel();
    private final JLabel marker = new JLabel(SetupForm.msg("setup.newMarker"));
    private final JPanel markerRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
    private final JPanel banner = new JPanel(new BorderLayout(8, 0));
    private final FormParts.MessageLine bannerText = new FormParts.MessageLine();
    private final JButton startFromDefaults = new JButton(SetupForm.msg("setup.state.startFromDefaults"));
    private final FormParts.MessageLine general = new FormParts.MessageLine();

    // Cards
    private final CardLayout cards = new CardLayout();
    private final JPanel center = new JPanel(cards);
    private final FormParts.Column form = new FormParts.Column(Theme.FORM_MAX, Theme.TAB_PADDING, 4, 24);
    private final JScrollPane formScroll = new JScrollPane(form);
    private final JTextArea raw = new JTextArea();
    private final FormParts.Column empty = new FormParts.Column(Theme.FORM_MAX, Theme.TAB_PADDING, 8, 24);
    private final JButton create = new JButton(SetupForm.msg("setup.empty.create"));

    // Fields
    private final Map<String, FormParts.Row> rows = new LinkedHashMap<>();
    private final PickerField connection = new PickerField(this::connectionItems, false);
    private final ChipField fullRoles = new ChipField(this::roleNames, this::edited);
    private final ChipField phoneRoles = new ChipField(this::roleNames, this::edited);
    private final PickerField kindsFunction = new PickerField(this::functionItems, true);
    private final PickerField assetsFunction = new PickerField(this::functionItems, true);
    /** The Designer's own number spinner; its text is the value, so any text can be typed. */
    private final JSpinner refreshSpinner = new JSpinner(new SpinnerNumberModel(10, 1, 3600, 1));
    private JFormattedTextField refresh;
    private final JPanel refreshControl = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
    private final FormParts.Flow basemaps = new FormParts.Flow(16, 4);
    private final Map<String, JCheckBox> basemapBoxes = new LinkedHashMap<>();
    private final PickerField alarmPage = new PickerField(this::pageItems, true);
    private final PickerField provider = new PickerField(this::providerItems, false);
    private final PickerField secretName = new PickerField(this::secretNameItems, false);
    private final FormParts.Flow token = new FormParts.Flow(8, 6);
    private final Timer secretNamesTimer = new Timer(400, e -> loadSecretNames());

    // Footer
    private final JPanel footer = new JPanel(new BorderLayout(12, 0));
    private final JLabel footerText = new JLabel();
    private final JLabel footerSecondary = new JLabel();
    private final JButton footerAction = FormParts.link("", Theme.accent(), false);
    private Runnable footerActionRun = () -> { };

    /** A form with no lists (tests of story 7's behaviour). */
    public SetupPanel(Runnable onEdit) {
        this(onEdit, null, SetupListSource.NONE, SetupListSource.Async.DIRECT);
    }

    /**
     * @param onEdit called on the Swing thread after every change the user makes
     * @param confirmStartFromDefaults asks before "Start from defaults" replaces the form; null asks with a dialog
     * @param source where the lists come from
     * @param async how Gateway lists load (off the Swing thread in the Designer)
     */
    SetupPanel(Runnable onEdit, BooleanSupplier confirmStartFromDefaults, SetupListSource source,
               SetupListSource.Async async) {
        super(new BorderLayout());
        this.onEdit = onEdit == null ? () -> { } : onEdit;
        this.source = source == null ? SetupListSource.NONE : source;
        this.async = async == null ? SetupListSource.Async.SWING : async;
        this.confirmStartFromDefaults = confirmStartFromDefaults != null ? confirmStartFromDefaults
            : () -> JOptionPane.showConfirmDialog(this, SetupForm.msg("setup.state.startFromDefaults.confirm"),
                SetupForm.msg("setup.state.startFromDefaults"), JOptionPane.OK_CANCEL_OPTION) == JOptionPane.OK_OPTION;
        setBackground(Theme.surface());
        secretNamesTimer.setRepeats(false);
        buildHeader();
        buildForm();
        buildEmpty();
        buildRaw();
        buildFooter();
        center.setOpaque(false);
        add(header, BorderLayout.NORTH);
        add(center, BorderLayout.CENTER);
        add(footer, BorderLayout.SOUTH);
        show(SetupForm.defaults(), false, "");
        // Lists load from the first show by the editor or workspace on, not for this placeholder.
        built = true;
    }

    /** False while the constructor runs: its placeholder show asks the Gateway nothing. */
    private boolean built;

    void onCreate(Runnable r) {
        onCreate = r == null ? () -> { } : r;
    }

    void onDiscard(Runnable r) {
        onDiscard = r == null ? () -> { } : r;
    }

    // ---------------------------------------------------------------- building

    private void buildHeader() {
        title.setFont(Theme.bold(Theme.font().getSize2D() + 3));
        title.setForeground(Theme.text());
        schema.setFont(Theme.small());
        schema.setForeground(Theme.secondary());
        refreshLink.setFont(Theme.small());
        refreshLink.addActionListener(e -> refreshLists());
        JPanel right = new JPanel(new FlowLayout(FlowLayout.RIGHT, 12, 0));
        right.setOpaque(false);
        right.add(refreshLink);
        right.add(schema);
        JPanel titleRow = new JPanel(new BorderLayout());
        titleRow.setOpaque(false);
        titleRow.add(title, BorderLayout.WEST);
        titleRow.add(right, BorderLayout.EAST);
        header.put(titleRow, 0);

        marker.setFont(Theme.small());
        marker.setForeground(Theme.text());
        marker.setIcon(new DotIcon());
        marker.setOpaque(true);
        marker.setBackground(Theme.tint(Theme.accent(), 0.10, Theme.surface()));
        marker.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createLineBorder(Theme.tint(Theme.accent(), 0.35, Theme.surface())),
            BorderFactory.createEmptyBorder(2, 8, 2, 8)));
        markerRow.setOpaque(false);
        markerRow.add(marker);
        header.put(markerRow, 6);

        banner.setOpaque(true);
        banner.setBorder(BorderFactory.createEmptyBorder(8, 10, 8, 10));
        banner.add(new BannerText(), BorderLayout.CENTER);
        startFromDefaults.addActionListener(e -> askStartFromDefaults());
        JPanel bannerButton = new JPanel(new FlowLayout(FlowLayout.RIGHT, 0, 0));
        bannerButton.setOpaque(false);
        bannerButton.add(startFromDefaults);
        banner.add(bannerButton, BorderLayout.EAST);
        header.put(banner, 10);
        header.put(general, 8);
    }

    /** The banner's text, which takes the width the banner leaves it. */
    private final class BannerText extends JPanel {
        BannerText() {
            super(null);
            setOpaque(false);
            add(bannerText);
        }

        @Override
        public void doLayout() {
            bannerText.setBounds(0, 0, getWidth(), bannerText.heightFor(getWidth()));
        }

        @Override
        public Dimension getPreferredSize() {
            int w = getWidth() > 0 ? getWidth() : Theme.MESSAGE_WIDTH;
            return new Dimension(w, bannerText.heightFor(w));
        }
    }

    private void buildForm() {
        form.setBackground(Theme.surface());
        formScroll.setBorder(BorderFactory.createEmptyBorder());
        formScroll.setHorizontalScrollBarPolicy(ScrollPaneConstants.HORIZONTAL_SCROLLBAR_NEVER);
        formScroll.getViewport().setBackground(Theme.surface());
        formScroll.getVerticalScrollBar().setUnitIncrement(16);
        formScroll.getViewport().addComponentListener(new ComponentAdapter() {
            @Override
            public void componentResized(ComponentEvent e) {
                form.revalidate();
            }
        });

        connection.onChange(this::edited);
        kindsFunction.onChange(this::edited);
        assetsFunction.onChange(this::edited);
        alarmPage.onChange(this::edited);
        alarmPage.onPick(item -> pickPage(item.text()));
        provider.onChange(() -> {
            edited();
            secretNamesTimer.restart();
        });
        provider.onPick(item -> loadSecretNames());
        secretName.onChange(this::edited);
        fullRoles.setPlaceholder(SetupForm.msg("setup.placeholder.role"));
        phoneRoles.setPlaceholder(SetupForm.msg("setup.placeholder.role"));
        secretName.setPlaceholder(SetupForm.msg("setup.placeholder.secretName"));

        buildRefresh();
        for (String b : BASEMAPS) {
            basemapBoxes.put(b, basemapBox(b, SetupForm.msg("setup.basemap." + b)));
        }
        provider.setFieldWidth(170);
        secretName.setFieldWidth(202);
        token.add(provider);
        token.add(secretName);

        form.put(new FormParts.Heading(SetupForm.msg("setup.section.store")), 8);
        form.put(row(SetupForm.CONNECTION, connection, connection.labelTarget(), Theme.FIELD), 8);
        form.put(new FormParts.Heading(SetupForm.msg("setup.section.edit")), Theme.SECTION_GAP);
        form.put(row(SetupForm.FULL_ROLES, fullRoles, fullRoles.labelTarget(), Theme.CHIP_FIELD), 8);
        form.put(row(SetupForm.PHONE_ROLES, phoneRoles, phoneRoles.labelTarget(), Theme.CHIP_FIELD), Theme.ROW_GAP);
        form.put(new FormParts.Heading(SetupForm.msg("setup.section.kinds")), Theme.SECTION_GAP);
        form.put(row(SetupForm.KINDS_FUNCTION, kindsFunction, kindsFunction.labelTarget(), Theme.FIELD), 8);
        form.put(row(SetupForm.ASSETS_FUNCTION, assetsFunction, assetsFunction.labelTarget(), Theme.FIELD),
            Theme.ROW_GAP);
        form.put(row(SetupForm.REFRESH, refreshControl, refresh, Theme.REFRESH_FIELD + 70), Theme.ROW_GAP);
        form.put(new FormParts.Heading(SetupForm.msg("setup.section.map")), Theme.SECTION_GAP);
        form.put(row(SetupForm.BASEMAPS, basemaps, basemapBoxes.get("none"), 420), 8);
        form.put(row(SetupForm.ALARM_PAGE, alarmPage, alarmPage.labelTarget(), Theme.FIELD), Theme.ROW_GAP);
        FormParts.Row tokenRow = row(SetupForm.TOKEN_SECRET, token, provider.labelTarget(), 380);
        tokenRow.setNote(SetupForm.msg("setup.note.tokenSecret"));
        secretName.labelTarget().getAccessibleContext().setAccessibleName(SetupForm.msg("setup.label.tokenSecret.name"));
        provider.labelTarget().getAccessibleContext().setAccessibleName(
            SetupForm.msg("setup.label.tokenSecret.provider"));
        form.put(tokenRow, Theme.ROW_GAP);
        center.add(formScroll, Mode.EDIT.name());
    }

    private void buildRefresh() {
        // A plain JSpinner with the look and feel's own UI and arrows (owner, 2026-10-27: as Project
        // Properties' Client Poll Rate). Its NumberEditor pattern "0" shows 1000, not 1,000; the
        // text is the value, so a typed "abc" or "10.5" stays as typed (PERSIST on focus loss) and
        // the form gives its reason. The arrows commit the typed number first, then step it.
        refreshSpinner.setEditor(new JSpinner.NumberEditor(refreshSpinner, "0"));
        refresh = ((JSpinner.DefaultEditor) refreshSpinner.getEditor()).getTextField();
        refresh.setFocusLostBehavior(JFormattedTextField.PERSIST);
        refresh.setColumns(5);
        refresh.getDocument().addDocumentListener(new DocumentListener() {
            @Override public void insertUpdate(DocumentEvent e) { edited(); }
            @Override public void removeUpdate(DocumentEvent e) { edited(); }
            @Override public void changedUpdate(DocumentEvent e) { edited(); }
        });
        Dimension d = refreshSpinner.getPreferredSize();
        refreshSpinner.setPreferredSize(new Dimension(Theme.REFRESH_FIELD, d.height));
        JLabel seconds = new JLabel(SetupForm.msg("setup.seconds"));
        seconds.setForeground(Theme.secondary());
        seconds.setBorder(BorderFactory.createEmptyBorder(0, 8, 0, 0));
        refreshControl.setOpaque(false);
        refreshControl.add(refreshSpinner);
        refreshControl.add(seconds);
    }

    /** Shows the refresh interval as written: a number in range goes through the spinner's model. */
    private void fillRefresh(String text) {
        String t = text == null ? "" : text;
        try {
            int v = Integer.parseInt(t.trim());
            if (v >= 1 && v <= 3600) {
                refreshSpinner.setValue(v);
            }
        } catch (NumberFormatException ex) {
            // Shown as written below; the form gives the reason.
        }
        if (!refresh.getText().equals(t)) {
            refresh.setText(t);
        }
    }

    private JCheckBox basemapBox(String value, String text) {
        JCheckBox box = new JCheckBox(text);
        box.setOpaque(false);
        box.addActionListener(e -> {
            if (filling) {
                return;
            }
            if (box.isSelected()) {
                if (!basemapValues.contains(value)) {
                    basemapValues.add(value);
                }
            } else {
                basemapValues.removeIf(value::equals);
            }
            edited();
        });
        basemaps.add(box);
        return box;
    }

    private FormParts.Row row(String field, JComponent control, JComponent labelTarget, int width) {
        JLabel label = new JLabel(SetupForm.msg("setup.label." + field));
        label.setForeground(Theme.text());
        label.setLabelFor(labelTarget);
        String help = help(field);
        label.setToolTipText(help);
        labelTarget.setToolTipText(null);
        labelTarget.getAccessibleContext().setAccessibleDescription(help);
        FormParts.Row r = new FormParts.Row(label, control, width);
        rows.put(field, r);
        return r;
    }

    private String help(String field) {
        return field.equals(SetupForm.FULL_ROLES)
            ? SetupForm.msg("setup.help." + field, lists.project().identityProvider())
            : SetupForm.msg("setup.help." + field);
    }

    private void buildEmpty() {
        JLabel tile = new JLabel(Theme.Glyph.MAP, JLabel.CENTER) {
            @Override
            protected void paintComponent(Graphics g) {
                g.setColor(Theme.tint(Theme.accent(), 0.12, Theme.surface()));
                g.fillRoundRect(0, 0, 40, 40, 8, 8);
                super.paintComponent(g);
            }
        };
        tile.setPreferredSize(new Dimension(40, 40));
        JPanel tileRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
        tileRow.setOpaque(false);
        tile.setPreferredSize(new Dimension(40, 40));
        tileRow.add(tile);
        JLabel heading = new JLabel(SetupForm.msg("setup.empty.heading"));
        heading.setFont(Theme.bold(Theme.font().getSize2D() + 1));
        heading.setForeground(Theme.text());
        FormParts.MessageLine text = new FormParts.MessageLine().set(null, SetupForm.msg("setup.empty.text"),
            Theme.text(), Theme.font());
        create.setBackground(Theme.accent());
        create.setForeground(Color.WHITE);
        create.setFont(Theme.bold(Theme.font().getSize2D()));
        create.addActionListener(e -> pressCreateSetup());
        JPanel buttonRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
        buttonRow.setOpaque(false);
        buttonRow.add(create);
        FormParts.MessageLine help = new FormParts.MessageLine().set(null, SetupForm.msg("setup.empty.help"),
            Theme.secondary(), Theme.small());
        empty.put(tileRow, 40);
        empty.put(heading, 16);
        empty.put(text, 6);
        empty.put(buttonRow, 14);
        empty.put(help, 12);
        JScrollPane s = new JScrollPane(empty);
        s.setBorder(BorderFactory.createEmptyBorder());
        s.setHorizontalScrollBarPolicy(ScrollPaneConstants.HORIZONTAL_SCROLLBAR_NEVER);
        s.getViewport().setBackground(Theme.surface());
        center.add(s, Mode.EMPTY.name());
    }

    private void buildRaw() {
        raw.setEditable(false);
        raw.setLineWrap(true);
        raw.setFont(Theme.mono());
        raw.setBorder(BorderFactory.createEmptyBorder(8, 10, 8, 10));
        raw.setBackground(Theme.panel());
        FormParts.Column col = new FormParts.Column(Theme.FORM_MAX, Theme.TAB_PADDING, 8, 24);
        JLabel heading = new JLabel(SetupForm.msg("setup.state.asWritten"));
        heading.setForeground(Theme.secondary());
        heading.setFont(Theme.small());
        col.put(heading, 6);
        col.put(new RawBox(), 6);
        JScrollPane s = new JScrollPane(col);
        s.setBorder(BorderFactory.createEmptyBorder());
        s.setHorizontalScrollBarPolicy(ScrollPaneConstants.HORIZONTAL_SCROLLBAR_NEVER);
        s.getViewport().setBackground(Theme.surface());
        center.add(s, Mode.RAW.name());
    }

    /** The read-only setup.json box, as tall as its wrapped text. */
    private final class RawBox extends JPanel implements HeightForWidth {
        RawBox() {
            super(new FormParts.Fill());
            setBorder(BorderFactory.createLineBorder(Theme.border()));
            add(raw);
        }

        @Override
        public int heightFor(int width) {
            javax.swing.text.View v = raw.getUI().getRootView(raw);
            v.setSize(Math.max(1, width - 22), Integer.MAX_VALUE);
            return (int) Math.ceil(v.getPreferredSpan(javax.swing.text.View.Y_AXIS)) + 18;
        }
    }

    private void buildFooter() {
        footer.setBackground(Theme.panel());
        footer.setBorder(BorderFactory.createCompoundBorder(BorderFactory.createMatteBorder(1, 0, 0, 0, Theme.divider()),
            BorderFactory.createEmptyBorder(8, Theme.TAB_PADDING, 8, Theme.TAB_PADDING)));
        JPanel lead = new JPanel(new FlowLayout(FlowLayout.LEFT, 4, 0));
        lead.setOpaque(false);
        footerText.setFont(Theme.font());
        footerText.setIconTextGap(6);
        footerSecondary.setFont(Theme.small());
        footerSecondary.setForeground(Theme.secondary());
        footerSecondary.setBorder(BorderFactory.createEmptyBorder(0, 10, 0, 0));
        lead.add(footerText);
        // The secondary words take what is left of the line and end in "..." on a narrow tab.
        JPanel left = new JPanel(new BorderLayout());
        left.setOpaque(false);
        left.add(lead, BorderLayout.WEST);
        left.add(footerSecondary, BorderLayout.CENTER);
        footer.add(left, BorderLayout.CENTER);
        footerAction.addActionListener(e -> footerActionRun.run());
        footer.add(footerAction, BorderLayout.EAST);
        footer.setVisible(false);
    }

    // ---------------------------------------------------------------- states

    /**
     * Shows a setup of the project.
     *
     * @param setup the setup read from the project
     * @param lockedByProject true when the project may not change it (inherited, not overridable)
     * @param note a line above the form (for example "Inherited from ..."), or empty
     */
    public void show(SetupForm setup, boolean lockedByProject, String note) {
        base = setup;
        mode = !setup.isEditable() ? Mode.RAW : lockedByProject ? Mode.LOCKED : Mode.EDIT;
        fill(setup.isEditable() ? setup : SetupForm.defaults());
        setEditable(mode == Mode.EDIT);
        String bannerWords = "";
        Theme.Glyph glyph = Theme.Glyph.INFO;
        if (mode == Mode.RAW) {
            raw.setText(setup.toJson() == null ? "" : setup.toJson());
            bannerWords = setup.state() == SetupForm.State.NEWER_SCHEMA
                ? SetupForm.msg("setup.state.newer.banner", setup.stateReason()) : setup.stateReason();
            glyph = Theme.Glyph.LOCK;
        } else if (note != null && !note.isEmpty()) {
            bannerWords = note;
            glyph = lockedByProject ? Theme.Glyph.LOCK : Theme.Glyph.INFO;
        }
        setBanner(bannerWords, glyph, mode == Mode.LOCKED || mode == Mode.RAW);
        startFromDefaults.setVisible(setup.state() == SetupForm.State.UNREADABLE && !lockedByProject);
        boolean newer = setup.state() == SetupForm.State.NEWER_SCHEMA;
        schema.setText(newer ? SetupForm.msg("setup.schema.readOnly", setup.schemaVersion())
            : SetupForm.msg("setup.schema", setup.schemaVersion()));
        cards.show(center, mode == Mode.RAW ? Mode.RAW.name() : Mode.EDIT.name());
        if (mode != Mode.RAW && built) {
            refreshLists();
        }
        refreshChrome();
        recompute();
    }

    /** The empty state: no setup in this project. */
    public void showEmpty() {
        base = SetupForm.defaults();
        mode = Mode.EMPTY;
        setBanner("", null, false);
        startFromDefaults.setVisible(false);
        cards.show(center, Mode.EMPTY.name());
        refreshChrome();
        recompute();
    }

    /** A new setup: the defaults in the form, marked new; nothing is in the project until File > Save. */
    public void showNew() {
        base = SetupForm.defaults();
        mode = Mode.NEW;
        fill(base);
        setEditable(true);
        setBanner("", null, false);
        startFromDefaults.setVisible(false);
        schema.setText(SetupForm.msg("setup.schema", base.schemaVersion()));
        cards.show(center, Mode.EDIT.name());
        refreshLists();
        refreshChrome();
        recompute();
        SwingUtilities.invokeLater(() -> connection.labelTarget().requestFocusInWindow());
    }

    public Mode mode() {
        return mode;
    }

    private void refreshChrome() {
        boolean formShown = mode == Mode.EDIT || mode == Mode.NEW || mode == Mode.LOCKED;
        refreshLink.setVisible(formShown);
        schema.setVisible(mode != Mode.EMPTY);
        markerRow.setVisible(mode == Mode.NEW);
        header.revalidate();
        header.repaint();
    }

    private void setBanner(String words, Theme.Glyph glyph, boolean warningTint) {
        boolean shown = words != null && !words.isEmpty();
        banner.setVisible(shown);
        if (shown) {
            bannerText.set(glyph, words, Theme.text(), Theme.font());
            banner.setBackground(warningTint ? Theme.tint(Theme.warning(), 0.12, Theme.panel())
                : Theme.tint(Theme.accent(), 0.10, Theme.panel()));
        }
    }

    private void fill(SetupForm setup) {
        filling = true;
        try {
            connection.fill(setup.text(SetupForm.CONNECTION));
            fullRoles.fill(setup.list(SetupForm.FULL_ROLES));
            phoneRoles.fill(setup.list(SetupForm.PHONE_ROLES));
            kindsFunction.fill(setup.text(SetupForm.KINDS_FUNCTION));
            assetsFunction.fill(setup.text(SetupForm.ASSETS_FUNCTION));
            fillRefresh(setup.text(SetupForm.REFRESH));
            alarmPage.fill(setup.text(SetupForm.ALARM_PAGE));
            String[] t = SetupForm.splitToken(setup.text(SetupForm.TOKEN_SECRET));
            provider.fill(t[0]);
            secretName.fill(t[1]);
            basemapValues.clear();
            basemapValues.addAll(setup.list(SetupForm.BASEMAPS));
            // A basemap the form has no box for gets one, ticked, so it can be unticked.
            for (String b : basemapValues) {
                if (!basemapBoxes.containsKey(b)) {
                    basemapBoxes.put(b, basemapBox(b, b));
                }
            }
            for (Map.Entry<String, JCheckBox> e : basemapBoxes.entrySet()) {
                e.getValue().setSelected(basemapValues.contains(e.getKey()));
                e.getValue().setVisible(BASEMAPS.contains(e.getKey()) || basemapValues.contains(e.getKey()));
            }
        } finally {
            filling = false;
        }
    }

    private void setEditable(boolean editable) {
        connection.setEditable(editable);
        fullRoles.setEditable(editable);
        phoneRoles.setEditable(editable);
        kindsFunction.setEditable(editable);
        assetsFunction.setEditable(editable);
        refreshSpinner.setEnabled(editable);
        alarmPage.setEditable(editable);
        provider.setEditable(editable);
        secretName.setEditable(editable);
        basemapBoxes.values().forEach(b -> b.setEnabled(editable));
    }

    /** The setup as the fields now hold it; a read-only setup comes back unchanged. */
    public SetupForm current() {
        if (mode == Mode.RAW || mode == Mode.LOCKED || mode == Mode.EMPTY || !base.isEditable()) {
            return base;
        }
        SetupForm f = base.copy();
        f.setText(SetupForm.CONNECTION, connection.text());
        f.setList(SetupForm.FULL_ROLES, fullRoles.values());
        f.setList(SetupForm.PHONE_ROLES, phoneRoles.values());
        f.setText(SetupForm.KINDS_FUNCTION, kindsFunction.text());
        f.setText(SetupForm.ASSETS_FUNCTION, assetsFunction.text());
        f.setText(SetupForm.REFRESH, refresh.getText());
        f.setText(SetupForm.ALARM_PAGE, alarmPage.text());
        f.setList(SetupForm.BASEMAPS, basemapValues);
        String original = base.text(SetupForm.TOKEN_SECRET);
        String[] t = SetupForm.splitToken(original);
        // Unchanged fields keep the stored text exactly ("/name" splits and joins differently).
        f.setText(SetupForm.TOKEN_SECRET, t[0].equals(provider.text()) && t[1].equals(secretName.text())
            ? original : SetupForm.joinToken(provider.text(), secretName.text()));
        return f;
    }

    public boolean isLocked() {
        return mode == Mode.LOCKED || mode == Mode.RAW || mode == Mode.EMPTY || !base.isEditable();
    }

    private void edited() {
        if (filling) {
            return;
        }
        recompute();
        onEdit.run();
    }

    // ---------------------------------------------------------------- lists

    /** Reads every list again: the project's now, the Gateway's off the Swing thread. */
    void refreshLists() {
        lists = lists.withProject(source.project());
        int gen = ++generation;
        String idp = lists.project().identityProvider();
        relabelRoles();
        async.run(() -> source.gatewayLists(idp), json -> {
            if (gen != generation) {
                return;
            }
            lists = lists.withGateway(SetupLists.fromJson(json));
            loadSecretNames();
            recompute();
        }, ex -> {
            if (gen != generation) {
                return;
            }
            // The lists stay empty and typing still works, with no message: the Designer itself
            // shows when it has no Gateway connection (owner, 2026-10-27).
            LOG.debugf("Map Studio setup lists: the Gateway call failed (%s).", ex.getClass().getSimpleName());
            lists = lists.withGateway(SetupLists.unavailable(""));
            recompute();
        });
        recompute();
    }

    private void relabelRoles() {
        FormParts.Row full = rows.get(SetupForm.FULL_ROLES);
        if (full != null) {
            String help = help(SetupForm.FULL_ROLES);
            full.label.setToolTipText(help);
            fullRoles.labelTarget().getAccessibleContext().setAccessibleDescription(help);
        }
    }

    /** Loads the chosen provider's secret names when the provider is one the Gateway listed. */
    private void loadSecretNames() {
        secretNamesTimer.stop();
        String p = provider.text();
        SetupLists.Part providers = lists.secretProviders();
        if (p.isEmpty() || providers == null || !providers.names().contains(p)) {
            return;
        }
        if (p.equals(lists.secretNamesProvider()) && lists.secretNames() != null) {
            return;
        }
        int gen = generation;
        async.run(() -> source.secretNames(p), json -> {
            if (gen == generation && p.equals(provider.text())) {
                lists = lists.withSecretNames(p, SetupLists.Part.fromJson(json));
                recompute();
            }
        }, ex -> {
            if (gen == generation && p.equals(provider.text())) {
                lists = lists.withSecretNames(p, SetupLists.Part.unavailable(""));
                recompute();
            }
        });
    }

    /** A Gateway list's names; empty while loading or when the list failed (no message). */
    private List<PickerField.Item> gatewayItems(java.util.function.Function<SetupLists, SetupLists.Part> part,
                                                boolean withDetail) {
        List<PickerField.Item> out = new ArrayList<>();
        SetupLists g = lists.gateway();
        SetupLists.Part p = g == null ? null : part.apply(g);
        if (p != null && p.isOk()) {
            for (SetupLists.Entry e : p.entries()) {
                out.add(PickerField.Item.value(e.name(), withDetail ? FormLists.vendorWords(e.detail()) : ""));
            }
        }
        return out;
    }

    private List<PickerField.Item> connectionItems() {
        return gatewayItems(SetupLists::connections, true);
    }

    private List<PickerField.Item> providerItems() {
        return gatewayItems(SetupLists::secretProviders, false);
    }

    /** The chosen provider's secret names, once they loaded. */
    private List<PickerField.Item> secretNameItems() {
        List<PickerField.Item> out = new ArrayList<>();
        String p = provider.text();
        SetupLists.Part names = p.isEmpty() || !p.equals(lists.secretNamesProvider()) ? null : lists.secretNames();
        if (names != null && names.isOk()) {
            names.names().forEach(n -> out.add(PickerField.Item.value(n, "")));
        }
        return out;
    }

    /** The identity provider's roles; empty while loading, when not listed or when the list failed. */
    private List<String> roleNames() {
        SetupLists g = lists.gateway();
        return g != null && g.roles().isOk() ? g.roles().names() : List.of();
    }

    private List<PickerField.Item> functionItems() {
        List<PickerField.Item> out = new ArrayList<>();
        lists.project().offeredFunctions().forEach(f -> out.add(PickerField.Item.value(f, "")));
        return out;
    }

    private List<PickerField.Item> pageItems() {
        List<PickerField.Item> out = new ArrayList<>();
        if (lists.project().pages() != null) {
            lists.project().pages().forEach(p -> out.add(PickerField.Item.value(p, "")));
        }
        out.add(PickerField.Item.action(SetupForm.msg("setup.list.insertPlaceholder"), this::showPlaceholders));
        return out;
    }

    /** A picked page: each {@code :param} becomes {@code {item.name}}, the first selected for the next pick. */
    private void pickPage(String page) {
        String value = ProjectLists.asAlarmPage(page);
        alarmPage.setText(value);
        int at = value.indexOf(Placeholders.ITEM_NAME);
        JTextComponent f = alarmPage.textField();
        if (at >= 0 && page.contains(":")) {
            f.select(at, at + Placeholders.ITEM_NAME.length());
        } else {
            f.setCaretPosition(value.length());
        }
    }

    /** The placeholders, inserted at the caret (replacing a selection). */
    List<String> placeholders() {
        List<String> out = new ArrayList<>(Placeholders.FIXED);
        out.add(Placeholders.PROPERTY_PREFIX + "}");
        return out;
    }

    void insertPlaceholder(String placeholder) {
        JTextComponent f = alarmPage.textField();
        f.replaceSelection(placeholder);
        if (placeholder.equals(Placeholders.PROPERTY_PREFIX + "}")) {
            f.setCaretPosition(f.getCaretPosition() - 1);
        }
    }

    private void showPlaceholders() {
        if (!alarmPage.isShowing()) {
            return;
        }
        JPopupMenu menu = new JPopupMenu();
        for (String p : placeholders()) {
            JMenuItem item = new JMenuItem(p.equals(Placeholders.PROPERTY_PREFIX + "}")
                ? Placeholders.PROPERTY_PREFIX + "<field key>}" : p);
            item.setFont(Theme.mono());
            item.addActionListener(e -> {
                insertPlaceholder(p);
                alarmPage.textField().requestFocusInWindow();
            });
            menu.add(item);
        }
        menu.show(alarmPage, 0, alarmPage.getHeight());
    }

    // ---------------------------------------------------------------- reasons, warnings, footer

    private void recompute() {
        boolean editable = mode == Mode.EDIT || mode == Mode.NEW;
        SetupForm now = current();
        Map<String, List<String>> reasons = editable ? now.reasons() : Map.of();
        Map<String, List<String>> warnings = editable || mode == Mode.LOCKED ? now.warnings(lists) : Map.of();
        if (mode == Mode.LOCKED) {
            warnings = Map.of();
        }
        shownReasons = reasons;
        shownWarnings = warnings;
        for (Map.Entry<String, FormParts.Row> e : rows.entrySet()) {
            String field = e.getKey();
            List<String> r = reasons.getOrDefault(field, List.of());
            List<String> w = warnings.getOrDefault(field, List.of());
            List<FormParts.MessageLine> lines = new ArrayList<>();
            r.forEach(t -> lines.add(new FormParts.MessageLine().set(Theme.Glyph.ERROR, t, Theme.error(), Theme.font())));
            w.forEach(t -> lines.add(new FormParts.MessageLine().set(Theme.Glyph.WARNING, t, Theme.warning(),
                Theme.font())));
            FormParts.Row row = e.getValue();
            row.setMessages(lines);
            // A mark beside the field only for a warning (a reason has its line under the field);
            // the control itself keeps the Designer's look, with no coloured edge of ours.
            row.mark.setIcon(r.isEmpty() && !w.isEmpty() && field.equals(SetupForm.CONNECTION) || r.isEmpty()
                && !w.isEmpty() && isPickerField(field) ? Theme.Glyph.WARNING : null);
            row.mark.setToolTipText(row.mark.getIcon() == null ? null : String.join(" ", w));
        }
        fullRoles.setUnknown(Set.copyOf(now.unknownRoles(SetupForm.FULL_ROLES, lists)));
        phoneRoles.setUnknown(Set.copyOf(now.unknownRoles(SetupForm.PHONE_ROLES, lists)));
        List<String> g = reasons.get(SetupForm.GENERAL);
        general.set(g == null ? null : Theme.Glyph.ERROR, g == null ? "" : String.join(" ", g), Theme.error(),
            Theme.font());
        general.setVisible(g != null);
        provider.setPlaceholder(SetupForm.msg("setup.placeholder.selectOne"));
        connection.setPlaceholder(mode == Mode.NEW ? SetupForm.msg("setup.placeholder.connectionNew")
            : SetupForm.msg("setup.placeholder.selectOne"));
        kindsFunction.setPlaceholder(SetupForm.msg("setup.placeholder.selectOne"));
        assetsFunction.setPlaceholder(SetupForm.msg("setup.placeholder.selectOne"));
        alarmPage.setPlaceholder(SetupForm.msg("setup.placeholder.page"));
        for (PickerField p : List.of(connection, kindsFunction, assetsFunction, alarmPage, provider, secretName)) {
            p.refreshItems();
        }
        fullRoles.input().refreshItems();
        phoneRoles.input().refreshItems();
        updateFooter(reasons, warnings);
        form.revalidate();
        form.repaint();
        header.revalidate();
    }

    private static boolean isPickerField(String field) {
        return field.equals(SetupForm.KINDS_FUNCTION) || field.equals(SetupForm.ASSETS_FUNCTION)
            || field.equals(SetupForm.ALARM_PAGE) || field.equals(SetupForm.TOKEN_SECRET);
    }

    /**
     * The footer, only when it has something to say: the reasons left as plain text (no link, the
     * form is short: owner, 2026-10-27) with the warning count, or a new setup's state with
     * Discard new setup.
     */
    private void updateFooter(Map<String, List<String>> reasons, Map<String, List<String>> warnings) {
        int reasonCount = reasons.values().stream().mapToInt(List::size).sum();
        int warningCount = warnings.values().stream().mapToInt(List::size).sum();
        boolean editable = mode == Mode.EDIT || mode == Mode.NEW;
        footerText.setIcon(null);
        footerText.setText("");
        footerText.setForeground(Theme.text());
        footerSecondary.setText("");
        footerSecondary.setToolTipText(null);
        footerAction.setVisible(false);
        boolean shown = true;
        if (editable && reasonCount > 0) {
            footerText.setIcon(Theme.Glyph.ERROR);
            footerText.setText(reasonCount == 1 ? SetupForm.msg("setup.footer.reasons.one")
                : SetupForm.msg("setup.footer.reasons.many", reasonCount));
            footerText.setForeground(Theme.error());
            footerSecondary.setText(mode == Mode.NEW ? SetupForm.msg("setup.footer.newHeldBack")
                : warningCount == 0 ? "" : warningCount == 1 ? SetupForm.msg("setup.footer.warnings.one")
                : SetupForm.msg("setup.footer.warnings.many", warningCount));
        } else if (mode == Mode.NEW) {
            footerText.setIcon(Theme.Glyph.INFO);
            footerText.setText(SetupForm.msg("setup.footer.new"));
        } else {
            shown = false;
        }
        if (mode == Mode.NEW) {
            footerAction.setText(SetupForm.msg("setup.footer.discard"));
            footerAction.setVisible(true);
            footerActionRun = this::pressDiscard;
        }
        footerSecondary.setToolTipText(footerSecondary.getText().isEmpty() ? null : footerSecondary.getText());
        footer.setVisible(shown);
        footer.revalidate();
    }

    /**
     * True when the form holds changes the project does not have: an editable setup whose fields
     * differ from the setup read, or a new setup. A refused save leaves them here (fix 16).
     */
    boolean hasUnsavedChanges() {
        if (mode == Mode.NEW) {
            return true;
        }
        return mode == Mode.EDIT && !current().equals(base);
    }

    /**
     * The project has this setup now (a project save wrote it): it becomes the setup the form
     * compares with, so "(unsaved)" goes. The fields are left as they are. Only for an editable
     * setup; any other state keeps what {@link #show} set.
     */
    void markSaved(SetupForm saved) {
        if (mode == Mode.EDIT && saved != null) {
            base = saved;
        }
    }

    private void askStartFromDefaults() {
        if (confirmStartFromDefaults.getAsBoolean()) {
            show(SetupForm.defaults(), false, "");
            onEdit.run();
        }
    }

    private void pressCreateSetup() {
        onCreate.run();
    }

    private void pressDiscard() {
        onDiscard.run();
    }

    // ---------------------------------------------------------------- test hooks

    /** For tests: types a value into a field as the user would ({@link SetupForm#FULL_ROLES} and the like: one per line). */
    void type(String field, String value) {
        switch (field) {
            case SetupForm.CONNECTION -> connection.setText(value);
            case SetupForm.KINDS_FUNCTION -> kindsFunction.setText(value);
            case SetupForm.ASSETS_FUNCTION -> assetsFunction.setText(value);
            case SetupForm.REFRESH -> refresh.setText(value);
            case SetupForm.ALARM_PAGE -> alarmPage.setText(value);
            case SetupForm.FULL_ROLES, SetupForm.PHONE_ROLES -> {
                ChipField c = field.equals(SetupForm.FULL_ROLES) ? fullRoles : phoneRoles;
                while (!c.values().isEmpty()) {
                    c.removeAt(c.values().size() - 1);
                }
                SetupForm.lines(value).forEach(c::add);
            }
            case SetupForm.BASEMAPS -> {
                for (String b : BASEMAPS) {
                    boolean want = SetupForm.lines(value).contains(b);
                    if (basemapBoxes.get(b).isSelected() != want) {
                        basemapBoxes.get(b).doClick();
                    }
                }
            }
            case SetupForm.TOKEN_SECRET -> {
                String[] t = SetupForm.splitToken(value);
                provider.setText(t[0]);
                secretName.setText(t[1]);
            }
            default -> throw new IllegalArgumentException(field);
        }
    }

    void typeProvider(String value) {
        provider.setText(value);
    }

    void typeSecretName(String value) {
        secretName.setText(value);
    }

    /** For tests: picks the provider from its list (loads its secret names). */
    void pickProvider(String value) {
        provider.pick(PickerField.Item.value(value, ""));
    }

    void pickPageForTest(String page) {
        alarmPage.pick(PickerField.Item.value(page, ""));
    }

    String alarmPageText() {
        return alarmPage.textField().getText();
    }

    String alarmPageSelection() {
        return alarmPage.textField().getSelectedText();
    }

    /** For tests: what a field's list offers now. */
    List<String> offered(String field) {
        List<PickerField.Item> items = switch (field) {
            case SetupForm.CONNECTION -> connection.offered();
            case SetupForm.KINDS_FUNCTION -> kindsFunction.offered();
            case SetupForm.ASSETS_FUNCTION -> assetsFunction.offered();
            case SetupForm.ALARM_PAGE -> alarmPage.offered();
            case "provider" -> provider.offered();
            case "secretName" -> secretName.offered();
            case SetupForm.FULL_ROLES -> null;
            case SetupForm.PHONE_ROLES -> null;
            default -> throw new IllegalArgumentException(field);
        };
        if (items == null) {
            return (field.equals(SetupForm.FULL_ROLES) ? fullRoles : phoneRoles).offered();
        }
        List<String> out = new ArrayList<>();
        items.forEach(i -> out.add(i.detail().isEmpty() ? i.text() : i.text() + " (" + i.detail() + ")"));
        return out;
    }

    ChipField chips(String field) {
        return field.equals(SetupForm.FULL_ROLES) ? fullRoles : phoneRoles;
    }

    /** For tests: the reason lines under a field ({@link SetupForm#GENERAL}: the line at the top). */
    String reasonText(String field) {
        if (field.equals(SetupForm.GENERAL)) {
            return general.isVisible() ? general.text() : "";
        }
        return String.join(" ", shownReasons.getOrDefault(field, List.of()));
    }

    String warningText(String field) {
        return String.join(" ", shownWarnings.getOrDefault(field, List.of()));
    }

    /** For tests: the warning glyph beside a field, if any. */
    boolean hasMark(String field) {
        return rows.get(field).mark.getIcon() != null;
    }

    String bannerText() {
        return banner.isVisible() ? bannerText.text() : "";
    }

    /** For tests: the footer's words as shown, empty when hidden. */
    String footerText() {
        if (!footer.isVisible()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        sb.append(footerText.getText());
        if (!footerSecondary.getText().isEmpty()) {
            sb.append(" | ").append(footerSecondary.getText());
        }
        if (footerAction.isVisible()) {
            sb.append(" [").append(footerAction.getText()).append(']');
        }
        return sb.toString();
    }

    /** For tests: the footer's visible buttons, by their words. */
    List<String> footerButtons() {
        List<String> out = new ArrayList<>();
        collectButtons(footer, out);
        return out;
    }

    private static void collectButtons(java.awt.Container c, List<String> out) {
        if (!c.isVisible()) {
            return;
        }
        for (java.awt.Component k : c.getComponents()) {
            if (k instanceof JButton b && b.isVisible()) {
                out.add(b.getText());
            } else if (k instanceof java.awt.Container sub) {
                collectButtons(sub, out);
            }
        }
    }

    void pressFooterAction() {
        footerAction.doClick();
    }

    void pressCreate() {
        create.doClick();
    }

    void pressRefreshLists() {
        refreshLink.doClick();
    }

    boolean showsRefreshLists() {
        return refreshLink.isVisible();
    }

    String schemaText() {
        return schema.isVisible() ? schema.getText() : "";
    }

    boolean showsNewMarker() {
        return markerRow.isVisible();
    }

    void pressStartFromDefaults() {
        startFromDefaults.doClick();
    }

    boolean offersStartFromDefaults() {
        return startFromDefaults.isVisible();
    }

    String rawText() {
        return raw.getText();
    }

    boolean fieldsEditable() {
        return refreshSpinner.isEnabled();
    }

    /** For tests: the refresh spinner, to press its arrows as its own UI does. */
    JSpinner refreshSpinner() {
        return refreshSpinner;
    }

    /** For tests: a field's dropdown. */
    PickerField picker(String field) {
        return switch (field) {
            case SetupForm.CONNECTION -> connection;
            case SetupForm.KINDS_FUNCTION -> kindsFunction;
            case SetupForm.ASSETS_FUNCTION -> assetsFunction;
            case SetupForm.ALARM_PAGE -> alarmPage;
            case "provider" -> provider;
            case "secretName" -> secretName;
            default -> throw new IllegalArgumentException(field);
        };
    }

    /** For tests: the label of a field, with its tooltip. */
    JLabel label(String field) {
        return rows.get(field).label;
    }

    /** For tests: the bounds of a field's row inside the form. */
    Rectangle rowBounds(String field) {
        return rows.get(field).getBounds();
    }

    Rectangle controlBounds(String field) {
        return rows.get(field).control.getBounds();
    }

    JScrollPane formScroll() {
        return formScroll;
    }

    /** For tests: the help line under a field, if shown (only Map token has one). */
    String noteText(String field) {
        FormParts.Row r = rows.get(field);
        return r.note.isVisible() ? r.note.text() : "";
    }

    /** A small accent dot for the new-setup marker. */
    private static final class DotIcon implements javax.swing.Icon {
        @Override
        public void paintIcon(java.awt.Component c, Graphics g, int x, int y) {
            java.awt.Graphics2D g2 = (java.awt.Graphics2D) g.create();
            g2.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, java.awt.RenderingHints.VALUE_ANTIALIAS_ON);
            g2.setColor(Theme.accent());
            g2.fillOval(x + 1, y + 3, 6, 6);
            g2.dispose();
        }

        @Override
        public int getIconWidth() {
            return 10;
        }

        @Override
        public int getIconHeight() {
            return 12;
        }
    }
}
