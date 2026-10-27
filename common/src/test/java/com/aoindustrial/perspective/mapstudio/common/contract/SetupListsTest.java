package com.aoindustrial.perspective.mapstudio.common.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.aoindustrial.perspective.mapstudio.common.contract.SetupLists.Entry;
import com.aoindustrial.perspective.mapstudio.common.contract.SetupLists.Part;
import com.aoindustrial.perspective.mapstudio.common.contract.SetupLists.Status;

class SetupListsTest {

    @Test
    void aReplyReadsBackAsWritten() {
        SetupLists lists = new SetupLists(Part.ok(List.of(new Entry("MapStudio", "POSTGRES"))),
            Part.notListed("This identity provider does not list its roles."), Part.okNames(List.of("Internal")));
        SetupLists back = SetupLists.fromJson(lists.toJson());
        assertEquals(lists, back);
        assertEquals(List.of("MapStudio"), back.connections().names());
        assertEquals(Status.NOT_LISTED, back.roles().status());
    }

    @Test
    void anUnreadableReplyIsEveryListUnavailable() {
        for (String text : List.of("", "[]", "not json", "{\"connections\": 3}")) {
            SetupLists lists = SetupLists.fromJson(text);
            assertEquals(Status.UNAVAILABLE, lists.connections().status(), text);
        }
        SetupLists partial = SetupLists.fromJson("{\"connections\":{\"status\":\"ok\",\"items\":[\"A\"]}}");
        assertEquals(List.of("A"), partial.connections().names());
        assertEquals(Status.UNAVAILABLE, partial.roles().status());
    }

    @Test
    void aPartWithAnUnknownStatusOrNoItemsIsUnavailable() {
        assertEquals(Status.UNAVAILABLE, Part.fromJson("{\"status\":\"maybe\"}").status());
        assertEquals(Status.UNAVAILABLE, Part.fromJson("{\"status\":\"ok\"}").status());
        assertTrue(Part.fromJson("{\"status\":\"unavailable\",\"items\":[\"x\"]}").entries().isEmpty());
    }
}
