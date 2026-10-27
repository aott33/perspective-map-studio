package com.aoindustrial.perspective.mapstudio.designer.setup;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;

/** The Swing form built headless: fields filled, reasons as the user types, read-only states. */
class SetupPanelTest {

    private static final String DEV = "{\"schemaVersion\": 1, \"connection\": \"MapStudio\","
        + " \"roles\": {\"full\": [\"MapEditor\"], \"phone\": [\"MapOperator\"]}, \"note\": \"x\"}";

    @Test
    void showsTheSetupAndGivesItBackUnchanged() {
        SetupPanel panel = new SetupPanel(null);
        SetupForm form = SetupForm.fromJson(DEV);
        panel.show(form, false, "");
        assertEquals("MapStudio", panel.input(SetupForm.CONNECTION).getText());
        assertEquals("none\nosm", panel.input(SetupForm.BASEMAPS).getText());
        assertEquals(form, panel.current());
        assertTrue(panel.current().toJson().contains("\"note\": \"x\""));
        assertEquals("", panel.bannerText());
        assertTrue(panel.input(SetupForm.CONNECTION).isEditable());
    }

    @Test
    void reasonsFollowTheTyping() {
        AtomicInteger edits = new AtomicInteger();
        SetupPanel panel = new SetupPanel(edits::incrementAndGet);
        panel.show(SetupForm.fromJson(DEV), false, "");
        panel.input(SetupForm.CONNECTION).setText("");
        assertTrue(panel.reasonText(SetupForm.CONNECTION).contains("Name the database connection"));
        panel.input(SetupForm.REFRESH).setText("0");
        assertTrue(panel.reasonText(SetupForm.REFRESH).contains("1 or more"));
        panel.input(SetupForm.CONNECTION).setText("MapStudio");
        panel.input(SetupForm.REFRESH).setText("15");
        assertEquals(" ", panel.reasonText(SetupForm.CONNECTION));
        assertEquals(" ", panel.reasonText(SetupForm.REFRESH));
        assertTrue(edits.get() > 0);
        panel.input(SetupForm.FULL_ROLES).setText("MapEditor\nEngineer");
        assertEquals(List.of("MapEditor", "Engineer"), panel.current().list(SetupForm.FULL_ROLES));
        assertTrue(panel.current().canSave());
    }

    @Test
    void aNewerSchemaIsShownReadOnly() {
        SetupPanel panel = new SetupPanel(null);
        SetupForm form = SetupForm.fromJson("{\"schemaVersion\": 2}");
        panel.show(form, false, "");
        assertTrue(panel.bannerText().contains("newer Map Studio (schema 2)"));
        assertFalse(panel.input(SetupForm.CONNECTION).isEditable());
        assertFalse(panel.offersStartFromDefaults());
        assertEquals(form, panel.current());
        assertTrue(panel.isLocked());
    }

    @Test
    void anUnreadableFileOffersStartFromDefaults() {
        SetupPanel panel = new SetupPanel(null);
        panel.show(SetupForm.fromJson("not json"), false, "");
        assertTrue(panel.bannerText().contains("cannot be read"));
        assertTrue(panel.offersStartFromDefaults());
        assertTrue(panel.isLocked());
    }

    @Test
    void anInheritedSetupShowsWhereItComesFrom() {
        SetupPanel panel = new SetupPanel(null);
        String note = SetupForm.msg("setup.state.inherited", "parent-project");
        panel.show(SetupForm.fromJson(DEV), false, note);
        assertTrue(panel.bannerText().contains("Inherited from parent-project. Saving makes this project's own copy."));
        assertTrue(panel.input(SetupForm.CONNECTION).isEditable());
        panel.show(SetupForm.fromJson(DEV), true, SetupForm.msg("setup.state.inheritedLocked", "parent-project"));
        assertFalse(panel.input(SetupForm.CONNECTION).isEditable());
        assertTrue(panel.isLocked());
    }

    @Test
    void startFromDefaultsAsksFirstAndCancelKeepsTheFile() {
        AtomicInteger asked = new AtomicInteger();
        AtomicInteger edits = new AtomicInteger();
        SetupPanel panel = new SetupPanel(edits::incrementAndGet, () -> {
            asked.incrementAndGet();
            return false;
        });
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
        SetupPanel panel = new SetupPanel(edits::incrementAndGet, () -> true);
        panel.show(SetupForm.fromJson("not json"), false, "");
        panel.pressStartFromDefaults();
        assertEquals(1, edits.get());
        assertFalse(panel.isLocked());
        assertFalse(panel.offersStartFromDefaults());
        assertEquals(SetupForm.defaults(), panel.current());
        assertTrue(panel.input(SetupForm.CONNECTION).isEditable());
    }

    // SetupEditor's commit step (getObjectForSave), on a panel.

    @Test
    void aReadOnlySetupIsHandedBackAsReadSoNothingIsWritten() throws Exception {
        SetupPanel panel = new SetupPanel(null);
        SetupForm newer = SetupForm.fromJson("{\"schemaVersion\": 2, \"x\": 1}");
        panel.show(newer, false, "");
        assertSame(newer, SetupCommit.formToSave(panel, newer));
        SetupForm dev = SetupForm.fromJson(DEV);
        panel.show(dev, true, "");
        panel.input(SetupForm.CONNECTION).setText("");
        assertSame(dev, SetupCommit.formToSave(panel, dev));
        assertSame(dev, SetupCommit.formToSave(null, dev));
    }

    @Test
    void aSetupWithReasonsIsRefusedAndAValidOneIsSaved() throws Exception {
        SetupPanel panel = new SetupPanel(null);
        SetupForm dev = SetupForm.fromJson(DEV);
        panel.show(dev, false, "");
        assertEquals(dev, SetupCommit.formToSave(panel, dev));
        panel.input(SetupForm.REFRESH).setText("0");
        SetupRefusedException refused =
            assertThrows(SetupRefusedException.class, () -> SetupCommit.formToSave(panel, dev));
        assertEquals(List.of(SetupForm.REFRESH), List.copyOf(refused.reasons().keySet()));
        panel.input(SetupForm.REFRESH).setText("20");
        SetupForm saved = SetupCommit.formToSave(panel, dev);
        assertEquals("20", saved.text(SetupForm.REFRESH));
        assertFalse(saved.equals(dev));
    }
}
