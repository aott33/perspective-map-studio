package com.aoindustrial.perspective.mapstudio.designer.setup;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.awt.Component;
import java.awt.Container;
import java.awt.Rectangle;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import javax.swing.JComboBox;
import javax.swing.JSpinner;
import javax.swing.ScrollPaneConstants;
import javax.swing.UIManager;
import javax.swing.plaf.UIResource;

import org.junit.jupiter.api.Test;

/** The Swing form built headless (epic 2 stories 7 and 16). */
class SetupPanelTest {

    /** A valid setup the Gateway accepts. */
    private static final String VALID = "{\"schemaVersion\": 1, \"connection\": \"MapStudio\","
        + " \"roles\": {\"full\": [\"MapEditor\"], \"phone\": [\"MapOperator\"]}}";
    /** The same with a key the Gateway refuses (not a setup field), which the panel keeps and reports. */
    private static final String DEV = "{\"schemaVersion\": 1, \"connection\": \"MapStudio\","
        + " \"roles\": {\"full\": [\"MapEditor\"], \"phone\": [\"MapOperator\"]}, \"note\": \"x\"}";

    private final FakeListSource source = new FakeListSource();

    private SetupPanel panel(Runnable onEdit) {
        return new SetupPanel(onEdit, () -> true, source, SetupListSource.Async.DIRECT);
    }

    static void layout(Component c, int width, int height) {
        c.setSize(width, height);
        for (int i = 0; i < 3; i++) {
            lay(c);
        }
    }

    private static void lay(Component c) {
        if (c instanceof Container) {
            ((Container) c).doLayout();
            for (Component k : ((Container) c).getComponents()) {
                lay(k);
            }
        }
    }

    // Story 7 behaviour, kept.

    @Test
    void showsTheSetupAndGivesItBackUnchanged() {
        SetupPanel panel = panel(null);
        SetupForm form = SetupForm.fromJson(DEV);
        panel.show(form, false, "");
        assertEquals("MapStudio", panel.current().text(SetupForm.CONNECTION));
        assertEquals(List.of("none", "osm"), panel.current().list(SetupForm.BASEMAPS));
        assertEquals(form, panel.current());
        assertTrue(panel.current().toJson().contains("\"note\": \"x\""));
        assertTrue(panel.reasonText(SetupForm.GENERAL).contains("note is not a setup field of schema 1."));
        assertEquals("", panel.bannerText());
        assertTrue(panel.fieldsEditable());
        assertEquals("Schema version 1", panel.schemaText());
        assertTrue(panel.showsRefreshLists());
    }

    @Test
    void reasonsFollowTheTyping() {
        AtomicInteger edits = new AtomicInteger();
        SetupPanel panel = panel(edits::incrementAndGet);
        panel.show(SetupForm.fromJson(VALID), false, "");
        panel.type(SetupForm.CONNECTION, "");
        assertTrue(panel.reasonText(SetupForm.CONNECTION).contains("Name the database connection"));
        panel.type(SetupForm.REFRESH, "0");
        assertTrue(panel.reasonText(SetupForm.REFRESH).contains("from 1 to 3600"));
        panel.type(SetupForm.CONNECTION, "MapStudio");
        panel.type(SetupForm.REFRESH, "15");
        assertEquals("", panel.reasonText(SetupForm.CONNECTION));
        assertEquals("", panel.reasonText(SetupForm.REFRESH));
        assertTrue(edits.get() > 0);
        panel.type(SetupForm.FULL_ROLES, "MapEditor\nEngineer");
        assertEquals(List.of("MapEditor", "Engineer"), panel.current().list(SetupForm.FULL_ROLES));
        assertTrue(panel.current().canSave());
    }

    @Test
    void aNewerSchemaIsShownAsWrittenReadOnly() {
        SetupPanel panel = panel(null);
        SetupForm form = SetupForm.fromJson("{\"schemaVersion\": 2}");
        panel.show(form, false, "");
        assertEquals(SetupPanel.Mode.RAW, panel.mode());
        assertTrue(panel.bannerText().startsWith("Read only. This setup was written by a newer Map Studio (schema 2)."));
        assertTrue(panel.bannerText().endsWith("It is shown as written and never rewritten here."));
        assertEquals("{\"schemaVersion\": 2}", panel.rawText());
        assertEquals("Schema 2 - read only", panel.schemaText());
        assertFalse(panel.showsRefreshLists());
        assertFalse(panel.offersStartFromDefaults());
        assertEquals("", panel.footerText());
        assertEquals(form, panel.current());
        assertTrue(panel.isLocked());
    }

    @Test
    void anUnreadableFileOffersStartFromDefaults() {
        SetupPanel panel = panel(null);
        panel.show(SetupForm.fromJson("not json"), false, "");
        assertTrue(panel.bannerText().contains("cannot be read"));
        assertTrue(panel.offersStartFromDefaults());
        assertTrue(panel.isLocked());
    }

    @Test
    void anInheritedSetupShowsWhereItComesFrom() {
        SetupPanel panel = panel(null);
        String note = SetupForm.msg("setup.state.inherited", "parent-project");
        panel.show(SetupForm.fromJson(VALID), false, note);
        assertTrue(panel.bannerText().contains("Inherited from parent-project. Saving makes this project's own copy."));
        assertTrue(panel.fieldsEditable());
        assertEquals("", panel.footerText());
        panel.show(SetupForm.fromJson(VALID), true, SetupForm.msg("setup.state.inheritedLocked", "parent-project"));
        assertFalse(panel.fieldsEditable());
        assertTrue(panel.isLocked());
        assertTrue(panel.showsRefreshLists());
        assertEquals("", panel.footerText());
    }

    @Test
    void startFromDefaultsAsksFirstAndCancelKeepsTheFile() {
        AtomicInteger asked = new AtomicInteger();
        AtomicInteger edits = new AtomicInteger();
        SetupPanel panel = new SetupPanel(edits::incrementAndGet, () -> {
            asked.incrementAndGet();
            return false;
        }, source, SetupListSource.Async.DIRECT);
        SetupForm unreadable = SetupForm.fromJson("not json");
        panel.show(unreadable, false, "");
        panel.pressStartFromDefaults();
        assertEquals(1, asked.get());
        assertEquals(0, edits.get());
        assertSame(unreadable, panel.current());
        assertTrue(panel.isLocked());
    }

    @Test
    void startFromDefaultsConfirmedGivesTheDefaultsAndReportsAnEdit() {
        AtomicInteger edits = new AtomicInteger();
        SetupPanel panel = panel(edits::incrementAndGet);
        panel.show(SetupForm.fromJson("not json"), false, "");
        panel.pressStartFromDefaults();
        assertEquals(1, edits.get());
        assertFalse(panel.isLocked());
        assertFalse(panel.offersStartFromDefaults());
        assertEquals(SetupForm.defaults(), panel.current());
        assertTrue(panel.fieldsEditable());
    }

    @Test
    void aReadOnlySetupIsHandedBackAsReadSoNothingIsWritten() throws Exception {
        SetupPanel panel = panel(null);
        SetupForm newer = SetupForm.fromJson("{\"schemaVersion\": 2, \"x\": 1}");
        panel.show(newer, false, "");
        assertSame(newer, SetupCommit.formToSave(panel, newer).form());
        SetupForm dev = SetupForm.fromJson(DEV);
        panel.show(dev, true, "");
        panel.type(SetupForm.CONNECTION, "");
        assertSame(dev, SetupCommit.formToSave(panel, dev).form());
        assertFalse(SetupCommit.formToSave(panel, dev).isHeldBack());
        assertSame(dev, SetupCommit.formToSave(null, dev).form());
    }

    /**
     * Fix 16 (owner, 2026-10-27): reasons hold back only the setup. The commit hands back the setup
     * as read, which ResourceEditor.commit() does not write (it equals the one read), and the tab
     * keeps the changes and reasons, reading "(unsaved)".
     */
    @Test
    void aSetupWithReasonsIsHeldBackAndAValidOneIsSaved() {
        SetupPanel panel = panel(null);
        SetupForm dev = SetupForm.fromJson(VALID);
        panel.show(dev, false, "");
        assertFalse(panel.hasUnsavedChanges());
        assertEquals(dev, SetupCommit.formToSave(panel, dev).form());
        panel.type(SetupForm.REFRESH, "0");
        assertTrue(panel.hasUnsavedChanges());
        SetupCommit.Decision held = SetupCommit.formToSave(panel, dev);
        assertTrue(held.isHeldBack());
        assertSame(dev, held.form(), "the setup as read: nothing of the setup is written");
        assertEquals(List.of(SetupForm.REFRESH), List.copyOf(held.heldBack().keySet()));
        // The tab keeps what was typed and its reason after the save.
        assertEquals("0", panel.current().text(SetupForm.REFRESH));
        assertTrue(panel.reasonText(SetupForm.REFRESH).contains("from 1 to 3600"));
        assertTrue(panel.hasUnsavedChanges());
        assertEquals("Map Studio Setup (unsaved)", SetupCommit.nodeText(true, false, false, true));
        panel.type(SetupForm.REFRESH, "20");
        SetupCommit.Decision saved = SetupCommit.formToSave(panel, dev);
        assertFalse(saved.isHeldBack());
        assertEquals("20", saved.form().text(SetupForm.REFRESH));
        assertFalse(saved.form().equals(dev));
    }

    /**
     * Fix 16 review: closing a tab with reasons left would drop its changes (the commit on close
     * writes nothing), so the workspace asks first; a tab with changes and no reasons, or a
     * read-only one, closes as before.
     */
    @Test
    void closingATabWithReasonsLeftAsksFirst() {
        SetupPanel panel = panel(null);
        panel.show(SetupForm.fromJson(VALID), false, "");
        assertFalse(SetupCommit.closeDropsChanges(panel));
        panel.type(SetupForm.REFRESH, "0");
        assertTrue(SetupCommit.closeDropsChanges(panel));
        assertEquals(1, SetupCommit.reasonCount(panel));
        panel.type(SetupForm.REFRESH, "20");
        assertTrue(panel.hasUnsavedChanges());
        assertFalse(SetupCommit.closeDropsChanges(panel), "no reasons: the close commits the changes");
        panel.show(SetupForm.fromJson(VALID), true, "");
        assertFalse(SetupCommit.closeDropsChanges(panel));
        assertFalse(SetupCommit.closeDropsChanges(null));
        assertEquals(0, SetupCommit.reasonCount(null));
    }

    /**
     * Fix 16 review: after a save that wrote the setup, the form compares with what was written,
     * so "(unsaved)" goes (ResourceEditor.commit() skips its own reload while it commits).
     */
    @Test
    void unsavedGoesAfterASaveThatWroteTheSetup() {
        SetupPanel panel = panel(null);
        SetupForm dev = SetupForm.fromJson(VALID);
        panel.show(dev, false, "");
        panel.type(SetupForm.REFRESH, "20");
        assertTrue(panel.hasUnsavedChanges());
        SetupCommit.Decision saved = SetupCommit.formToSave(panel, dev);
        assertFalse(saved.isHeldBack());
        panel.markSaved(saved.form());
        assertFalse(panel.hasUnsavedChanges());
        assertEquals("Map Studio Setup", SetupCommit.nodeText(true, false, false, panel.hasUnsavedChanges()));
        assertEquals("20", panel.current().text(SetupForm.REFRESH));
        // Typing the old value back is a change now: the project holds 20.
        panel.type(SetupForm.REFRESH, dev.text(SetupForm.REFRESH));
        assertTrue(panel.hasUnsavedChanges());
        // Only an editable setup moves its base.
        panel.showEmpty();
        panel.markSaved(dev);
        assertFalse(panel.hasUnsavedChanges());
    }

    // Story 16: lists, warnings, footer, states, layout.

    @Test
    void theListsLoadAndAreOffered() {
        SetupPanel panel = panel(null);
        panel.show(SetupForm.fromJson(VALID), false, "");
        assertEquals(List.of("MapStudio (PostgreSQL)", "MES (Microsoft SQL Server)"), panel.offered(SetupForm.CONNECTION));
        assertEquals(List.of("Administrator", "MapEditor  (added)", "MapOperator"),
            panel.offered(SetupForm.FULL_ROLES));
        assertEquals(List.of("mapstudio_dev.assets", "mapstudio_dev.kinds"), panel.offered(SetupForm.KINDS_FUNCTION));
        assertEquals(List.of("/", "/alarms/:name", "/edit", "Insert placeholder..."),
            panel.offered(SetupForm.ALARM_PAGE));
        assertEquals(List.of("Internal", "MapStudioFiles"), panel.offered("provider"));
        assertEquals(List.of(), panel.offered("secretName"));
        panel.pickProvider("Internal");
        assertEquals(List.of("api-key", "mapbox-token"), panel.offered("secretName"));
        assertEquals(List.of("lists default", "secretNames Internal"), source.asked);
    }

    @Test
    void aValidSetupShowsNoMarksNoHelpLinesAndNoFooter() {
        SetupPanel panel = panel(null);
        panel.show(SetupForm.fromJson(VALID), false, "");
        for (String f : SetupForm.FIELDS) {
            assertEquals("", panel.reasonText(f), f);
            assertEquals("", panel.warningText(f), f);
            assertFalse(panel.hasMark(f), f);
        }
        assertEquals("", panel.footerText());
        assertEquals("Names only - the Designer never reads the token.", panel.noteText(SetupForm.TOKEN_SECRET));
        assertEquals("", panel.noteText(SetupForm.CONNECTION));
        assertEquals(SetupForm.msg("setup.help.connection"), panel.label(SetupForm.CONNECTION).getToolTipText());
        assertEquals("Edit everything: drawing, kinds, import. Roles of the identity provider default, compared exactly.",
            panel.label(SetupForm.FULL_ROLES).getToolTipText());
        assertSame(panel.label(SetupForm.CONNECTION).getLabelFor().getAccessibleContext().getAccessibleDescription(),
            panel.label(SetupForm.CONNECTION).getToolTipText());
    }

    @Test
    void warningsAndReasonsShowBesideTheirFieldsAndTheFooterCountsThem() {
        SetupPanel panel = panel(null);
        panel.show(SetupForm.fromJson(VALID), false, "");
        panel.type(SetupForm.CONNECTION, "MapStore");
        panel.type(SetupForm.FULL_ROLES, "MapEditor\nMapEdtor");
        panel.type(SetupForm.PHONE_ROLES, "MapOperator\nMapOperator");
        panel.type(SetupForm.REFRESH, "0");
        assertTrue(panel.warningText(SetupForm.CONNECTION).startsWith("MapStore is not a database connection"));
        assertTrue(panel.hasMark(SetupForm.CONNECTION));
        assertEquals(List.of("MapEditor", "MapEdtor !"), panel.chips(SetupForm.FULL_ROLES).chipStates());
        assertEquals(List.of("MapOperator", "MapOperator x"), panel.chips(SetupForm.PHONE_ROLES).chipStates());
        assertEquals("MapOperator is listed twice.", panel.reasonText(SetupForm.PHONE_ROLES));
        assertEquals("2 reasons left - this setup is not saved until they are fixed. | 2 warnings do not stop a save.",
            panel.footerText());
        // Plain text: no link, nothing to scroll to (owner, 2026-10-27).
        assertEquals(List.of(), panel.footerButtons());
        // Warnings never stop the save.
        panel.type(SetupForm.PHONE_ROLES, "MapOperator");
        panel.type(SetupForm.REFRESH, "10");
        assertTrue(panel.current().canSave());
        assertEquals("", panel.footerText());
        assertTrue(panel.current().toJson().contains("\"connection\": \"MapStore\""));
    }

    /** Fix 16: no Gateway-unreachable state; the Designer shows when it has no Gateway. */
    @Test
    void aGatewayThatIsDownLeavesItsListsEmptyWithNoMessageAndTypingStillWorks() {
        source.gatewayFails = true;
        SetupPanel panel = panel(null);
        panel.show(SetupForm.fromJson(VALID), false, "");
        assertEquals("", panel.footerText());
        assertEquals(List.of(), panel.offered(SetupForm.CONNECTION));
        assertEquals(List.of(), panel.offered(SetupForm.FULL_ROLES));
        assertEquals(List.of(), panel.offered("provider"));
        assertEquals(List.of("mapstudio_dev.assets", "mapstudio_dev.kinds"), panel.offered(SetupForm.KINDS_FUNCTION));
        panel.type(SetupForm.CONNECTION, "MapStore");
        assertEquals("", panel.warningText(SetupForm.CONNECTION));
        assertFalse(panel.hasMark(SetupForm.CONNECTION));
        assertEquals("MapStore", panel.current().text(SetupForm.CONNECTION));
        panel.type(SetupForm.REFRESH, "0");
        assertEquals("1 reason left - this setup is not saved until it is fixed.", panel.footerText());
        panel.type(SetupForm.REFRESH, "10");
        assertEquals("", panel.footerText());
        // The Gateway is back: the header's Refresh lists asks again.
        source.gatewayFails = false;
        panel.pressRefreshLists();
        assertEquals(List.of("MapStudio (PostgreSQL)", "MES (Microsoft SQL Server)"), panel.offered(SetupForm.CONNECTION));
        assertTrue(panel.warningText(SetupForm.CONNECTION).startsWith("MapStore is not"));
    }

    @Test
    void anIdentityProviderThatCannotListRolesLeavesTheListEmpty() {
        source.gateway = new com.aoindustrial.perspective.mapstudio.common.contract.SetupLists(
            source.gateway.connections(),
            com.aoindustrial.perspective.mapstudio.common.contract.SetupLists.Part.notListed("x"),
            source.gateway.secretProviders());
        SetupPanel panel = panel(null);
        panel.show(SetupForm.fromJson(VALID), false, "");
        assertEquals(List.of(), panel.offered(SetupForm.FULL_ROLES));
        panel.type(SetupForm.FULL_ROLES, "Anyone");
        assertEquals("", panel.warningText(SetupForm.FULL_ROLES));
    }

    @Test
    void emptyThenCreateThenDiscard() {
        SetupPanel panel = panel(null);
        AtomicInteger created = new AtomicInteger();
        AtomicInteger discarded = new AtomicInteger();
        panel.onCreate(() -> {
            created.incrementAndGet();
            panel.showNew();
        });
        panel.onDiscard(() -> {
            discarded.incrementAndGet();
            panel.showEmpty();
        });
        panel.showEmpty();
        assertEquals(SetupPanel.Mode.EMPTY, panel.mode());
        assertEquals("", panel.footerText());
        assertFalse(panel.showsRefreshLists());
        assertEquals("", panel.schemaText());
        assertTrue(panel.isLocked());
        panel.pressCreate();
        assertEquals(1, created.get());
        assertEquals(SetupPanel.Mode.NEW, panel.mode());
        assertTrue(panel.showsNewMarker());
        assertEquals(List.of("MapEditor"), panel.current().list(SetupForm.FULL_ROLES));
        assertEquals("Name the database connection Map Studio stores the map in.",
            panel.reasonText(SetupForm.CONNECTION));
        assertEquals("1 reason left - this setup is not saved until it is fixed. | File > Save saves the rest of"
            + " the project without it. [Discard new setup]", panel.footerText());
        assertTrue(panel.hasUnsavedChanges());
        panel.type(SetupForm.CONNECTION, "MapStudio");
        assertEquals("New setup - not saved yet. [Discard new setup]", panel.footerText());
        panel.pressFooterAction();
        assertEquals(1, discarded.get());
        assertEquals(SetupPanel.Mode.EMPTY, panel.mode());
        assertFalse(panel.showsNewMarker());
    }

    @Test
    void theTokenIsAProviderAndASecretName() {
        SetupPanel panel = panel(null);
        panel.show(SetupForm.fromJson(VALID), false, "");
        panel.pickProvider("Internal");
        panel.typeSecretName("mapbox-token");
        assertEquals("Internal/mapbox-token", panel.current().text(SetupForm.TOKEN_SECRET));
        assertEquals("", panel.warningText(SetupForm.TOKEN_SECRET));
        panel.typeSecretName("mapbox");
        assertEquals("No secret named mapbox in Internal. It is saved as typed.",
            panel.warningText(SetupForm.TOKEN_SECRET));
        // A story 7 value with no "/" is the secret name, with a warning; an unchanged value keeps its bytes.
        SetupForm story7 = SetupForm.fromJson(VALID.replace("}}", "}, \"tokenSecret\": \"mapbox-token\"}"));
        panel.show(story7, false, "");
        assertEquals("Name the secret provider too.", panel.warningText(SetupForm.TOKEN_SECRET));
        assertEquals(story7, panel.current());
        SetupForm slash = SetupForm.fromJson(VALID.replace("}}", "}, \"tokenSecret\": \"/odd\"}"));
        panel.show(slash, false, "");
        assertEquals(slash, panel.current());
    }

    @Test
    void aPickedPageTakesItemNameAndPlaceholdersInsertAtTheCaret() {
        SetupPanel panel = panel(null);
        panel.show(SetupForm.fromJson(VALID), false, "");
        panel.pickPageForTest("/alarms/:name");
        assertEquals("/alarms/{item.name}", panel.alarmPageText());
        assertEquals("{item.name}", panel.alarmPageSelection());
        panel.insertPlaceholder("{asset.path}");
        assertEquals("/alarms/{asset.path}", panel.current().text(SetupForm.ALARM_PAGE));
        assertEquals(List.of("{item.id}", "{item.name}", "{asset.id}", "{asset.path}", "{item.properties.}"),
            panel.placeholders());
    }

    @Test
    void aBasemapListedTwiceShowsTheReasonAndIsWrittenOnceAfterUntickAndTick() {
        SetupPanel panel = panel(null);
        panel.show(SetupForm.fromJson(VALID.replace("}}", "}, \"basemaps\": [\"osm\", \"osm\"]}")), false, "");
        assertEquals("osm is listed twice.", panel.reasonText(SetupForm.BASEMAPS));
        panel.type(SetupForm.BASEMAPS, "none");
        panel.type(SetupForm.BASEMAPS, "none\nosm");
        assertEquals(List.of("none", "osm"), panel.current().list(SetupForm.BASEMAPS));
        assertEquals("", panel.reasonText(SetupForm.BASEMAPS));
    }

    @Test
    void theFormIsAtMost760WideOnAWideTabAndStacksOnANarrowOne() {
        SetupPanel panel = panel(null);
        panel.show(SetupForm.fromJson(VALID), false, "");
        layout(panel, 2000, 900);
        Rectangle row = panel.rowBounds(SetupForm.CONNECTION);
        assertTrue(row.width <= Theme.FORM_MAX, row.toString());
        assertEquals(Theme.TAB_PADDING, row.x);
        assertEquals(Theme.FIELD, panel.controlBounds(SetupForm.CONNECTION).width);
        assertEquals(Theme.LABEL_COLUMN, panel.controlBounds(SetupForm.CONNECTION).x);
        assertEquals(Theme.CHIP_FIELD, panel.controlBounds(SetupForm.FULL_ROLES).width);

        layout(panel, 500, 900);
        assertEquals(ScrollPaneConstants.HORIZONTAL_SCROLLBAR_NEVER, panel.formScroll().getHorizontalScrollBarPolicy());
        int view = panel.formScroll().getViewport().getView().getWidth();
        assertTrue(view <= panel.formScroll().getViewport().getWidth(), view + " in " + panel.formScroll().getWidth());
        Rectangle narrow = panel.controlBounds(SetupForm.CONNECTION);
        assertEquals(0, narrow.x, "the label sits above the control");
        assertTrue(narrow.y > 0);
        assertTrue(panel.rowBounds(SetupForm.CONNECTION).x + panel.rowBounds(SetupForm.CONNECTION).width <= 500 - 24);
        assertTrue(panel.controlBounds(SetupForm.TOKEN_SECRET).width <= 452);
    }

    // Matrix: no setup and new setup - the node's words, and File > Save of a new setup.
    @Test
    void theNodeSaysWhetherThereIsASetup() {
        assertEquals("Map Studio Setup (none)", SetupCommit.nodeText(false, false, false, false));
        assertEquals("Map Studio Setup (new, unsaved)", SetupCommit.nodeText(false, false, true, false));
        assertEquals("Map Studio Setup", SetupCommit.nodeText(true, false, false, false));
        assertEquals("Map Studio Setup (inherited)", SetupCommit.nodeText(true, true, false, false));
        assertEquals("Map Studio Setup (unsaved)", SetupCommit.nodeText(true, false, false, true));
        assertEquals("Map Studio Setup (unsaved)", SetupCommit.nodeText(true, true, false, true));
    }

    @Test
    void aNewSetupWithReasonsIsHeldBackAtSaveAndOneWithoutIsCreated() {
        SetupPanel panel = panel(null);
        panel.showNew();
        SetupCommit.Decision held = SetupCommit.newSetupToSave(panel);
        assertTrue(held.isHeldBack());
        assertEquals(null, held.form(), "nothing is created");
        assertEquals(List.of(SetupForm.CONNECTION), List.copyOf(held.heldBack().keySet()));
        panel.type(SetupForm.CONNECTION, "MapStudio");
        SetupForm created = SetupCommit.newSetupToSave(panel).form();
        assertTrue(created.toJson().startsWith("{\n  \"schemaVersion\": 1,\n  \"connection\": \"MapStudio\","),
            created.toJson());
    }

    @Test
    void noMapStudioDialogRepeatsAReason() throws IOException {
        Path dir = Path.of("src/main/java/com/aoindustrial/perspective/mapstudio/designer/setup");
        List<Path> files = new java.util.ArrayList<>();
        try (java.util.stream.Stream<Path> listed = Files.list(dir)) {
            listed.filter(f -> f.toString().endsWith(".java")).forEach(files::add);
        }
        files.add(Path.of("src/main/java/com/aoindustrial/perspective/mapstudio/designer/MapStudioDesignerHook.java"));
        assertTrue(files.size() > 10, files.toString());
        int askFirst = 0;
        int askClose = 0;
        for (Path file : files) {
            String code = Files.readString(file);
            assertFalse(code.contains("JDialog"), file.toString());
            assertFalse(code.contains("ErrorUtil"), file.toString());
            assertFalse(code.contains("JOptionPane.showMessageDialog"), file.toString());
            int shows = code.split("JOptionPane.show", -1).length - 1;
            if (file.getFileName().toString().equals("SetupPanel.java")) {
                askFirst = shows;
            } else if (file.getFileName().toString().equals("SetupWorkspace.java")) {
                askClose = shows;
            } else {
                assertEquals(0, shows, file.toString());
            }
        }
        // The dialogs of the package ask before something is lost: Start from defaults, and
        // closing a setup tab whose changes cannot be kept (it names the count, not the reasons).
        assertEquals(1, askFirst);
        assertEquals(1, askClose);
        assertFalse(SetupForm.msg("setup.close.message.many", 2).contains("from 1 to 3600"));
    }

    /** Fix 16: the footer's count is plain text, with no link and no scroll-to. */
    @Test
    void theFooterCountsTheReasonsAsPlainText() {
        SetupPanel panel = panel(null);
        panel.show(SetupForm.fromJson(VALID.replace("}}", "}, \"basemaps\": [\"osm\", \"osm\"],"
            + " \"alarmPage\": \"alarms\"}")), false, "");
        assertFalse(panel.reasonText(SetupForm.ALARM_PAGE).isEmpty());
        assertFalse(panel.reasonText(SetupForm.BASEMAPS).isEmpty());
        assertEquals("2 reasons left - this setup is not saved until they are fixed.", panel.footerText());
        assertEquals(List.of(), panel.footerButtons());
    }

    @Test
    void aNewSetupWithTheGatewayDownSaysNothingAboutIt() {
        source.gatewayFails = true;
        SetupPanel panel = panel(null);
        panel.showNew();
        assertEquals("1 reason left - this setup is not saved until it is fixed. | File > Save saves the rest of"
            + " the project without it. [Discard new setup]", panel.footerText());
        panel.type(SetupForm.CONNECTION, "MapStudio");
        assertEquals("New setup - not saved yet. [Discard new setup]", panel.footerText());
        assertEquals(List.of("Discard new setup"), panel.footerButtons());
    }

    @Test
    void aRefusedCallLeavesTheListsEmptyWithNoMessage() {
        source.failure = new SecurityException("Only a Designer may ask for the setup lists.");
        SetupPanel panel = panel(null);
        panel.show(SetupForm.fromJson(VALID), false, "");
        assertEquals("", panel.footerText());
        assertEquals(List.of(), panel.offered(SetupForm.CONNECTION));
        assertEquals(List.of(), panel.offered("provider"));
        panel.type(SetupForm.CONNECTION, "MapStore");
        assertEquals("", panel.warningText(SetupForm.CONNECTION));
    }

    /** Gateway replies held back until the test hands them over, in any order. */
    private static final class HeldAsync implements SetupListSource.Async {
        final List<Runnable> held = new java.util.ArrayList<>();

        @Override
        public <T> void run(java.util.concurrent.Callable<T> work, java.util.function.Consumer<T> done,
                            java.util.function.Consumer<Exception> failed) {
            try {
                T value = work.call();
                held.add(() -> done.accept(value));
            } catch (Exception ex) {
                held.add(() -> failed.accept(ex));
            }
        }

        Runnable last() {
            return held.get(held.size() - 1);
        }
    }

    @Test
    void lateRepliesOutOfOrderNeverOverwriteNewerOnes() {
        HeldAsync async = new HeldAsync();
        SetupPanel panel = new SetupPanel(null, () -> true, source, async);
        panel.show(SetupForm.fromJson(VALID), false, "");
        Runnable first = async.last();
        // The Gateway's connections change; Refresh lists asks again.
        source.gateway = new com.aoindustrial.perspective.mapstudio.common.contract.SetupLists(
            com.aoindustrial.perspective.mapstudio.common.contract.SetupLists.Part.ok(List.of(
                new com.aoindustrial.perspective.mapstudio.common.contract.SetupLists.Entry("Other", "POSTGRES"))),
            source.gateway.roles(), source.gateway.secretProviders());
        panel.pressRefreshLists();
        Runnable second = async.last();
        second.run();
        assertEquals(List.of("Other (PostgreSQL)"), panel.offered(SetupForm.CONNECTION));
        assertTrue(panel.warningText(SetupForm.CONNECTION).startsWith("MapStudio is not"));
        first.run();
        // The older reply arrived last and is dropped.
        assertEquals(List.of("Other (PostgreSQL)"), panel.offered(SetupForm.CONNECTION));
        assertTrue(panel.warningText(SetupForm.CONNECTION).startsWith("MapStudio is not"));

        // Secret names: the provider changes before the first provider's names arrive.
        panel.pickProvider("Internal");
        Runnable internal = async.last();
        panel.pickProvider("MapStudioFiles");
        Runnable files = async.last();
        assertTrue(internal != files);
        files.run();
        assertEquals(List.of(), panel.offered("secretName"));
        internal.run();
        assertEquals(List.of(), panel.offered("secretName"));
        panel.typeSecretName("mapbox");
        assertEquals("", panel.warningText(SetupForm.TOKEN_SECRET));
    }

    // Fix 16: the Designer's own controls (owner, 2026-10-27, compared with Project Properties).

    private static void assertPlainLook(javax.swing.JComponent c, String uiKey) {
        assertEquals(UIManager.getDefaults().getUIClass(uiKey), c.getUI().getClass(), uiKey);
        assertTrue(c.getBorder() == null || c.getBorder() instanceof UIResource, uiKey + " border " + c.getBorder());
        assertTrue(c.getBackground() == null || c.getBackground() instanceof UIResource,
            uiKey + " background " + c.getBackground());
    }

    @Test
    void everyDropdownAndTheSpinnerAreTheLookAndFeelsOwn() {
        SetupPanel panel = panel(null);
        panel.show(SetupForm.fromJson(VALID), false, "");
        for (String f : List.of(SetupForm.CONNECTION, SetupForm.KINDS_FUNCTION, SetupForm.ASSETS_FUNCTION,
            SetupForm.ALARM_PAGE, "provider", "secretName")) {
            JComboBox<Object> combo = panel.picker(f).combo();
            assertSame(JComboBox.class, combo.getClass(), f);
            assertTrue(combo.isEditable(), f);
            assertPlainLook(combo, "ComboBoxUI");
        }
        for (String f : List.of(SetupForm.FULL_ROLES, SetupForm.PHONE_ROLES)) {
            JComboBox<Object> combo = panel.chips(f).input().combo();
            assertSame(JComboBox.class, combo.getClass(), f);
            assertPlainLook(combo, "ComboBoxUI");
        }
        JSpinner spinner = panel.refreshSpinner();
        assertSame(JSpinner.class, spinner.getClass());
        assertPlainLook(spinner, "SpinnerUI");
        // A reason or a warning never recolours a control: its glyph and line say it.
        panel.type(SetupForm.CONNECTION, "");
        panel.type(SetupForm.REFRESH, "0");
        assertPlainLook(panel.picker(SetupForm.CONNECTION).combo(), "ComboBoxUI");
        assertPlainLook(spinner, "SpinnerUI");
    }

    @Test
    void noCodeOfOursChangesAControlsLook() throws IOException {
        Path dir = Path.of("src/main/java/com/aoindustrial/perspective/mapstudio/designer/setup");
        try (java.util.stream.Stream<Path> listed = Files.list(dir)) {
            for (Path file : listed.filter(f -> f.toString().endsWith(".java")).toList()) {
                String code = Files.readString(file);
                for (String banned : List.of("setUI(", "BasicArrowButton", "BasicComboBoxUI", "ComboBoxUI",
                    "BasicSpinnerUI", "MetalComboBoxUI", "createArrowButton")) {
                    assertFalse(code.contains(banned), file + " uses " + banned);
                }
            }
        }
    }

    @Test
    void theSpinnersArrowsStepTheTypedNumberAndAnyTextCanBeTyped() throws Exception {
        SetupPanel panel = panel(null);
        panel.show(SetupForm.fromJson(VALID), false, "");
        assertEquals("10", panel.current().text(SetupForm.REFRESH));
        panel.type(SetupForm.REFRESH, "20");
        // What the spinner's own arrow does: commit the typed text, then step.
        JSpinner spinner = panel.refreshSpinner();
        spinner.commitEdit();
        spinner.setValue(spinner.getNextValue());
        assertEquals("21", panel.current().text(SetupForm.REFRESH));
        spinner.setValue(spinner.getPreviousValue());
        spinner.setValue(spinner.getPreviousValue());
        assertEquals("19", panel.current().text(SetupForm.REFRESH));
        panel.type(SetupForm.REFRESH, "1000");
        spinner.commitEdit();
        spinner.setValue(spinner.getNextValue());
        assertEquals("1001", panel.current().text(SetupForm.REFRESH), "no grouping comma");
        panel.type(SetupForm.REFRESH, "abc");
        assertEquals("abc", panel.current().text(SetupForm.REFRESH));
        assertTrue(panel.reasonText(SetupForm.REFRESH).contains("whole number"));
        panel.show(SetupForm.fromJson(VALID.replace("}}", "}, \"refreshIntervalSeconds\": 10.5}")), false, "");
        assertEquals("10.5", panel.current().text(SetupForm.REFRESH));
    }

    @Test
    void choosingInsertPlaceholderNeverBecomesTheValue() {
        SetupPanel panel = panel(null);
        panel.show(SetupForm.fromJson(VALID), false, "");
        panel.type(SetupForm.ALARM_PAGE, "/alarms/");
        JComboBox<Object> combo = panel.picker(SetupForm.ALARM_PAGE).combo();
        Object action = combo.getItemAt(combo.getItemCount() - 1);
        assertEquals("Insert placeholder...", action.toString());
        combo.setSelectedItem(action);
        assertEquals("/alarms/", panel.current().text(SetupForm.ALARM_PAGE));
        // A page picked from the list is the value, with {item.name} for its :param.
        combo.setSelectedItem(combo.getItemAt(1));
        assertEquals("/alarms/{item.name}", panel.current().text(SetupForm.ALARM_PAGE));
    }

    @Test
    void aRolePickedFromTheDropdownBecomesAChip() {
        SetupPanel panel = panel(null);
        panel.show(SetupForm.fromJson(VALID), false, "");
        ChipField chips = panel.chips(SetupForm.FULL_ROLES);
        JComboBox<Object> combo = chips.input().combo();
        assertEquals(List.of("Administrator", "MapEditor  (added)", "MapOperator"), chips.offered());
        combo.setSelectedItem(combo.getItemAt(0));
        assertEquals(List.of("MapEditor", "Administrator"), panel.current().list(SetupForm.FULL_ROLES));
        assertEquals("", chips.input().text());
        // A role already added is not added twice.
        combo.setSelectedItem(combo.getItemAt(1));
        assertEquals(List.of("MapEditor", "Administrator"), panel.current().list(SetupForm.FULL_ROLES));
    }
}
