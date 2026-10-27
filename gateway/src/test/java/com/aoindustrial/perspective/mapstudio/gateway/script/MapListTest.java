package com.aoindustrial.perspective.mapstudio.gateway.script;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

import org.junit.jupiter.api.Test;
import org.python.core.Py;
import org.python.core.PyList;
import org.python.core.PyObject;

/** getMap's list: still a list, plus readOnly (epic 2 story 5; live Jython 2.7.4 in docs/platform-checks.md). */
class MapListTest {

    @Test
    void theListKeepsItsRecordsAndAnswersReadOnly() {
        PyList records = new PyList(new PyObject[] {Py.newString("a"), Py.newString("b")});
        MapList writable = new MapList(records, null);
        assertEquals(2, writable.__len__());
        assertEquals("b", writable.__getitem__(1).toString());
        assertSame(Py.None, writable.__getattr__(MapList.READ_ONLY));
        assertSame(PyList.TYPE, writable.getType(), "type(getMap(p)) is list");

        MapList readOnly = new MapList(records, "saving is off");
        assertEquals("saving is off", readOnly.__getattr__(MapList.READ_ONLY).toString());
        assertEquals(2, readOnly.__len__());
    }
}
