package com.aoindustrial.perspective.mapstudio.designer.setup;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.awt.Component;
import java.awt.Container;
import java.awt.Rectangle;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import javax.swing.ScrollPaneConstants;

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
        assertSame(newer, SetupCommit.formToSave(panel, newer));
        SetupForm dev = SetupForm.fromJson(DEV);
        panel.show(dev, true, "");
        panel.type(SetupForm.CONNECTION, "");
        assertSame(dev, SetupCommit.formToSave(panel, dev));
        assertSame(dev, SetupCommit.formToSave(null, dev));
    }

    @Test
    void aSetupWithReasonsIsRefusedAndAValidOneIsSaved() throws Exception {
        SetupPanel panel = panel(null);
        SetupForm dev = SetupForm.fromJson(VALID);
        panel.show(dev, false, "");
        assertEquals(dev, SetupCommit.formToSave(panel, dev));
        panel.type(SetupForm.REFRESH, "0");
        SetupRefusedException refused =
            assertThrows(SetupRefusedException.class, () -> SetupCommit.formToSave(panel, dev));
        assertEquals(List.of(SetupForm.REFRESH), List.copyOf(refused.reasons().keySet()));
        panel.type(SetupForm.REFRESH, "20");
        SetupForm saved = SetupCommit.formToSave(panel, dev);
        assertEquals("20", saved.text(SetupForm.REFRESH));
        assertFalse(saved.equals(dev));
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
        assertEquals(List.of("Choose a secret provider first."), panel.offered("secretName"));
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
        panel.pressFooterLink();
        assertEquals(SetupForm.PHONE_ROLES, panel.focusedReasonField());
        // Warnings never stop the save.
        panel.type(SetupForm.PHONE_ROLES, "MapOperator");
        panel.type(SetupForm.REFRESH, "10");
        assertTrue(panel.current().canSave());
        assertEquals("", panel.footerText());
        assertTrue(panel.current().toJson().contains("\"connection\": \"MapStore\""));
    }

    @Test
    void anUnreachableGatewaySaysSoInTheFooterAndTypingStillWorks() {
        source.reachable = false;
        SetupPanel panel = panel(null);
        panel.show(SetupForm.fromJson(VALID), false, "");
        assertEquals("Gateway not reachable - lists unavailable, typing still works. | Connections, roles and secret"
            + " providers come back with the Gateway; functions and pages are still listed. [Try again]",
            panel.footerText());
        assertEquals(List.of("List unavailable"), panel.offered(SetupForm.CONNECTION));
        assertEquals(List.of("List unavailable"), panel.offered(SetupForm.FULL_ROLES));
        assertEquals(List.of("mapstudio_dev.assets", "mapstudio_dev.kinds"), panel.offered(SetupForm.KINDS_FUNCTION));
        panel.type(SetupForm.CONNECTION, "MapStore");
        assertEquals("", panel.warningText(SetupForm.CONNECTION));
        assertFalse(panel.hasMark(SetupForm.CONNECTION));
        assertEquals("MapStore", panel.current().text(SetupForm.CONNECTION));
        // Reasons win the footer: they are what stops the save.
        panel.type(SetupForm.REFRESH, "0");
        assertTrue(panel.footerText().startsWith("1 reason left"));
        panel.type(SetupForm.REFRESH, "10");
        source.reachable = true;
        panel.pressFooterAction();
        assertEquals("", panel.footerText());
        assertTrue(panel.warningText(SetupForm.CONNECTION).startsWith("MapStore is not"));
    }

    @Test
    void anIdentityProviderThatCannotListRolesSaysSo() {
        source.gateway = new com.aoindustrial.perspective.mapstudio.common.contract.SetupLists(
            source.gateway.connections(),
            com.aoindustrial.perspective.mapstudio.common.contract.SetupLists.Part.notListed("x"),
            source.gateway.secretProviders());
        SetupPanel panel = panel(null);
        panel.show(SetupForm.fromJson(VALID), false, "");
        assertEquals(List.of("This identity provider does not list its roles. Type them."),
            panel.offered(SetupForm.FULL_ROLES));
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
        assertEquals("1 reason left - this setup is not saved until it is fixed. | File > Save shows the Designer's"
            + " standard save failure. [Discard new setup]", panel.footerText());
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
        assertEquals("Map Studio Setup (none)", SetupCommit.nodeText(false, false, false));
        assertEquals("Map Studio Setup (new, unsaved)", SetupCommit.nodeText(false, false, true));
        assertEquals("Map Studio Setup", SetupCommit.nodeText(true, false, false));
        assertEquals("Map Studio Setup (inherited)", SetupCommit.nodeText(true, true, false));
    }

    @Test
    void aNewSetupWithReasonsIsRefusedAtSaveAndOneWithoutIsCreated() throws Exception {
        SetupPanel panel = panel(null);
        panel.showNew();
        SetupRefusedException refused =
            assertThrows(SetupRefusedException.class, () -> SetupCommit.newSetupToSave(panel));
        assertEquals(List.of(SetupForm.CONNECTION), List.copyOf(refused.reasons().keySet()));
        panel.type(SetupForm.CONNECTION, "MapStudio");
        SetupForm created = SetupCommit.newSetupToSave(panel);
        assertTrue(created.toJson().startsWith("{\n  \"schemaVersion\": 1,\n  \"connection\": \"MapStudio\","),
            created.toJson());
    }

    @Test
    void noMapStudioDialogRepeatsAReason() throws IOException {
        Path dir = Path.of("src/main/java/com/aoindustrial/perspective/mapstudio/designer/setup");
        for (String file : List.of("SetupEditor.java", "SetupWorkspace.java", "SetupCommit.java")) {
            String code = Files.readString(dir.resolve(file));
            assertFalse(code.contains("JOptionPane"), file);
            assertFalse(code.contains("JDialog"), file);
        }
        // The panel's one dialog is Start from defaults asking first.
        String panel = Files.readString(dir.resolve("SetupPanel.java"));
        assertEquals(1, panel.split("JOptionPane.show", -1).length - 1);
        assertNull(null);
    }
}
